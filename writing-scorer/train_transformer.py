"""Huấn luyện mô hình Transformer đa nhiệm trên GPU (mặc định DeBERTa-v3-small) để chấm điểm IELTS Writing Task 2.

Được tối ưu để huấn luyện ổn định trong giới hạn 4GB VRAM (như NVIDIA GTX 1650) bằng cách kết hợp:
- Trình tối ưu Adafactor hoặc AdamW tiết kiệm bộ nhớ, hỗ trợ FP16 AMP và activation/gradient checkpointing.
- Chia bucket theo độ dài (length-bucketed dynamic padding) + cắt ghép đầu/đuôi bài luận trong ngưỡng 512 token.
- Kiến trúc DeBERTa + đầu hồi quy `AttentionMeanPoolHead` giám sát đa nhiệm 5 đầu điểm (Overall + TR/CC/LR/GRA).
- Trọng số mẫu kết hợp độ tin cậy CoT của Jackrong và tăng nhẹ trọng số cho các band hiếm (tail weighting).
- Xây dựng chỉ mục lời khuyên `feedback_bank.joblib` chỉ từ tập train, hiệu chỉnh tuyến tính trên tập val,
  dò trọng số lai `hybrid_config.json` với mô hình Baseline và cập nhật `best_manifest.json`.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import time
from collections import Counter
from pathlib import Path
from typing import Any, Iterator

import joblib
import numpy as np
import torch
import torch.nn as nn
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from torch.utils.data import DataLoader, Dataset, Sampler
from tqdm import tqdm
from transformers import (
    Adafactor,
    AutoConfig,
    AutoModel,
    AutoTokenizer,
    get_cosine_schedule_with_warmup,
)

from evaluate import (
    SUBCRITERIA_KEYS,
    evaluate_predictions,
    load_jsonl,
    print_evaluation_summary,
    round_to_half_band,
)

# Giới hạn kích thước mảnh cấp phát CUDA để giảm phân mảnh VRAM trên GPU bộ nhớ nhỏ (4GB)
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "max_split_size_mb:128")

TARGETS = ("overall_band",) + SUBCRITERIA_KEYS


def set_seed(seed: int) -> None:
    """Cố định seed ngẫu nhiên cho Python, NumPy và PyTorch (CPU + GPU) để tái lập kết quả."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def encode_prompt_essay_pair(
    tokenizer: Any,
    prompt: str,
    essay: str,
    max_length: int = 512,
    max_prompt_tokens: int = 96,
) -> dict[str, list[int]]:
    """Mã hóa cặp (prompt, essay): giữ trọn đề bài (tối đa 96 token) và lấy đầu+đuôi (72% + 28%) nếu bài viết vượt giới hạn."""
    prompt_text = f"Topic: {(prompt or '').strip()}"
    essay_text = (essay or "").strip()

    prompt_ids = tokenizer.encode(prompt_text, add_special_tokens=False)
    if len(prompt_ids) > max_prompt_tokens:
        prompt_ids = prompt_ids[:max_prompt_tokens]

    cls_id = (
        tokenizer.cls_token_id
        if tokenizer.cls_token_id is not None
        else (tokenizer.bos_token_id if tokenizer.bos_token_id is not None else 1)
    )
    sep_id = (
        tokenizer.sep_token_id
        if tokenizer.sep_token_id is not None
        else (tokenizer.eos_token_id if tokenizer.eos_token_id is not None else 2)
    )

    # Dành phần ngân sách còn lại (trừ [CLS] và 2 [SEP]) cho nội dung bài luận
    essay_budget = max(32, max_length - len(prompt_ids) - 3)
    essay_ids = tokenizer.encode(essay_text, add_special_tokens=False)
    if len(essay_ids) > essay_budget:
        # Giữ 72% phần mở đầu + thân bài và 28% phần kết luận thay vì cắt cụt toàn bộ đoạn cuối
        head_len = int(essay_budget * 0.72)
        tail_len = essay_budget - head_len
        essay_ids = essay_ids[:head_len] + (essay_ids[-tail_len:] if tail_len > 0 else [])

    input_ids = [cls_id] + prompt_ids + [sep_id] + essay_ids + [sep_id]
    # Phân đoạn token_type_ids: 0 cho vùng đề bài, 1 cho vùng bài luận
    token_type_ids = [0] * (len(prompt_ids) + 2) + [1] * (len(essay_ids) + 1)
    attention_mask = [1] * len(input_ids)
    return {
        "input_ids": input_ids,
        "token_type_ids": token_type_ids,
        "attention_mask": attention_mask,
    }


def _compute_sample_weights(records: list[dict[str, Any]]) -> list[float]:
    """Tính trọng số mẫu dựa trên độ tin cậy nhãn (Jackrong CoT + độ khớp overall/subcriteria) và cân bằng band hiếm chỉ trên tập train."""
    band_counts = Counter(float(round_to_half_band(float(r["overall_band"]))) for r in records)
    median_count = float(np.median(list(band_counts.values()))) if band_counts else 1.0

    raw_weights: list[float] = []
    for rec in records:
        has_reasoning = bool((rec.get("reasoning") or "").strip())
        subs = [rec.get(k) for k in SUBCRITERIA_KEYS]
        overall = rec.get("overall_band")
        # Ưu tiên mẫu có chuỗi suy luận CoT (x1.15); giảm trọng số (0.70) nếu điểm tổng và trung bình 4 tiêu chí lệch > 1.25
        conf_w = 1.15 if has_reasoning else 1.0
        if overall is not None and all(v is not None for v in subs):
            mean_sub = float(np.mean([float(v) for v in subs]))
            diff = abs(mean_sub - float(overall))
            if diff <= 0.75:
                conf_w = max(conf_w, 1.10)
            elif diff > 1.25:
                conf_w = 0.70

        # Tăng nhẹ trọng số cho các band điểm ít xuất hiện theo lũy thừa êm 0.20, kẹp trong [0.90, 1.55]
        b_key = float(round_to_half_band(float(overall)))
        b_cnt = max(1, band_counts.get(b_key, 1))
        tail_w = float(np.clip((median_count / b_cnt) ** 0.20, 0.90, 1.55))
        raw_weights.append(conf_w * tail_w)

    # Chuẩn hóa để trung bình trọng số xấp xỉ 1.0, giữ ổn định thang gradient
    mean_w = float(np.mean(raw_weights)) if raw_weights else 1.0
    return [w / max(1e-6, mean_w) for w in raw_weights]


class IeltsEssayDataset(Dataset):
    """Dataset đã tokenize sẵn, gắn mặt nạ nhãn tiêu chí con (`label_mask`) và hỗ trợ padding động."""

    def __init__(
        self,
        records: list[dict[str, Any]],
        tokenizer: Any,
        max_length: int = 512,
        is_train: bool = False,
    ) -> None:
        self.samples: list[dict[str, Any]] = []
        weights = _compute_sample_weights(records) if is_train else [1.0] * len(records)
        for rec, w in zip(records, weights):
            enc = encode_prompt_essay_pair(
                tokenizer,
                str(rec.get("prompt") or ""),
                str(rec.get("essay") or ""),
                max_length=max_length,
            )
            labels = []
            mask = []
            # Đánh dấu mask=0.0 cho các tiêu chí con bị khuyết (ví dụ một số mẫu chillies không ghi đủ 4 sub-criteria)
            for key in TARGETS:
                val = rec.get(key)
                if val is None:
                    labels.append(0.0)
                    mask.append(0.0)
                else:
                    labels.append(float(val))
                    mask.append(1.0)
            enc["labels"] = labels
            enc["label_mask"] = mask
            enc["sample_weight"] = float(w)
            self.samples.append(enc)

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        return self.samples[idx]


class BucketBatchSampler(Sampler[list[int]]):
    """Bộ gom batch theo nhóm độ dài (length bucketing) để giảm tối đa lượng padding thừa mà vẫn giữ tính ngẫu nhiên."""

    def __init__(self, lengths: list[int], batch_size: int, seed: int = 42) -> None:
        self.lengths = lengths
        self.batch_size = batch_size
        self.seed = seed
        self.epoch = 0

    def __iter__(self) -> Iterator[list[int]]:
        rng = random.Random(self.seed + self.epoch)
        self.epoch += 1
        indices = list(range(len(self.lengths)))
        # Cộng nhiễu nhẹ ±24 token khi sắp xếp độ dài để thành phần mỗi batch thay đổi qua từng epoch
        indices.sort(key=lambda i: self.lengths[i] + rng.randint(-24, 24))
        batches = [
            indices[i : i + self.batch_size]
            for i in range(0, len(indices), self.batch_size)
        ]
        rng.shuffle(batches)
        return iter(batches)

    def __len__(self) -> int:
        return math.ceil(len(self.lengths) / self.batch_size)


def make_collate_fn(pad_token_id: int, use_token_type_ids: bool = True):
    """Tạo hàm collate thực hiện dynamic padding theo độ dài câu dài nhất trong từng batch."""
    def collate(batch: list[dict[str, Any]]) -> dict[str, torch.Tensor]:
        max_len = max(len(x["input_ids"]) for x in batch)
        bs = len(batch)
        input_ids = torch.full((bs, max_len), pad_token_id, dtype=torch.long)
        attention_mask = torch.zeros((bs, max_len), dtype=torch.long)
        token_type_ids = torch.zeros((bs, max_len), dtype=torch.long)

        for i, item in enumerate(batch):
            l = len(item["input_ids"])
            input_ids[i, :l] = torch.tensor(item["input_ids"], dtype=torch.long)
            attention_mask[i, :l] = torch.tensor(item["attention_mask"], dtype=torch.long)
            if use_token_type_ids and "token_type_ids" in item:
                token_type_ids[i, :l] = torch.tensor(item["token_type_ids"], dtype=torch.long)

        out = {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
            "labels": torch.tensor([x["labels"] for x in batch], dtype=torch.float32),
            "label_mask": torch.tensor([x["label_mask"] for x in batch], dtype=torch.float32),
            "sample_weight": torch.tensor([x["sample_weight"] for x in batch], dtype=torch.float32),
        }
        if use_token_type_ids:
            out["token_type_ids"] = token_type_ids
        return out

    return collate


class AttentionMeanPoolHead(nn.Module):
    """Đầu hồi quy kết hợp Attention Pooling + Mean Pooling an toàn cho FP16 để dự đoán đồng thời 5 đầu điểm IELTS."""

    def __init__(self, hidden_size: int, num_targets: int = 5, dropout: float = 0.15) -> None:
        super().__init__()
        # Mạng chú ý 2 tầng tính trọng số quan trọng cho từng token trong bài viết
        self.attn_proj = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.Tanh(),
            nn.Linear(hidden_size // 2, 1),
        )
        # MLP nhận vector ghép [attn_pool, mean_pool] kích thước hidden_size * 2 -> 5 giá trị band
        self.head = nn.Sequential(
            nn.LayerNorm(hidden_size * 2),
            nn.Dropout(dropout),
            nn.Linear(hidden_size * 2, 256),
            nn.GELU(),
            nn.Dropout(dropout * 0.7),
            nn.Linear(256, num_targets),
        )
        # Khởi tạo bias lớp cuối = 6.0 (gần trung bình thang IELTS) giúp mô hình hội tụ nhanh ngay từ bước đầu
        nn.init.constant_(self.head[-1].bias, 6.0)

    def forward(self, last_hidden_state: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        mask = attention_mask.unsqueeze(-1).to(last_hidden_state.dtype)
        # Dùng -1e4 để che token padding trước softmax (tránh tràn underflow/NaN ở FP16)
        scores = self.attn_proj(last_hidden_state).masked_fill(mask == 0, -1e4)
        attn_weights = torch.softmax(scores, dim=1)
        attn_pool = torch.sum(last_hidden_state * attn_weights, dim=1)

        denom = mask.sum(dim=1).clamp(min=1e-4)
        mean_pool = torch.sum(last_hidden_state * mask, dim=1) / denom

        pooled = torch.cat([attn_pool, mean_pool], dim=-1)
        return self.head(pooled)


class IeltsTransformerRegressor(nn.Module):
    """Kiến trúc mô hình gồm backbone DeBERTa và đầu hồi quy đa nhiệm `AttentionMeanPoolHead`."""

    def __init__(self, backbone: nn.Module, hidden_size: int, dropout: float = 0.15) -> None:
        super().__init__()
        self.backbone = backbone
        self.regressor = AttentionMeanPoolHead(
            hidden_size=hidden_size, num_targets=len(TARGETS), dropout=dropout
        )

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        token_type_ids: torch.Tensor | None = None,
    ) -> torch.Tensor:
        kwargs: dict[str, Any] = {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
        }
        if token_type_ids is not None and getattr(self.backbone.config, "type_vocab_size", 0) > 0:
            kwargs["token_type_ids"] = token_type_ids
        outputs = self.backbone(**kwargs)
        return self.regressor(outputs.last_hidden_state, attention_mask)


def compute_multitask_loss(
    preds: torch.Tensor,
    labels: torch.Tensor,
    label_mask: torch.Tensor,
    sample_weight: torch.Tensor,
) -> torch.Tensor:
    """Hàm mất mát đa nhiệm: SmoothL1 có trọng số/mặt nạ cho Overall + 4 sub-criteria cộng ràng buộc nhất quán IELTS."""
    huber = nn.functional.smooth_l1_loss(preds, labels, reduction="none", beta=0.5)
    # Ưu tiên overall (1.0) và chia đều cho 4 tiêu chí thành phần (mỗi tiêu chí 0.35)
    target_weights = torch.tensor(
        [1.0, 0.35, 0.35, 0.35, 0.35], device=preds.device, dtype=preds.dtype
    )
    masked = huber * label_mask * target_weights.unsqueeze(0) * sample_weight.unsqueeze(1)
    denom = (label_mask * target_weights.unsqueeze(0) * sample_weight.unsqueeze(1)).sum().clamp(min=1.0)
    reg_loss = masked.sum() / denom

    # Ràng buộc nhất quán: điểm Overall dự đoán phải gần với trung bình cộng 4 tiêu chí con (hệ số 0.12)
    crit_mean = preds[:, 1:].mean(dim=1)
    consistency_loss = nn.functional.mse_loss(preds[:, 0], crit_mean)
    return reg_loss + 0.12 * consistency_loss


@torch.no_grad()
def predict_transformer(
    model: IeltsTransformerRegressor,
    loader: DataLoader,
    device: torch.device,
    use_amp: bool,
) -> np.ndarray:
    """Chạy suy luận Transformer theo batch (tắt gradient) trả về mảng điểm thô kích thước (N, 5)."""
    model.eval()
    all_preds: list[np.ndarray] = []
    for batch in loader:
        input_ids = batch["input_ids"].to(device, non_blocking=True)
        attention_mask = batch["attention_mask"].to(device, non_blocking=True)
        token_type_ids = batch.get("token_type_ids")
        if token_type_ids is not None:
            token_type_ids = token_type_ids.to(device, non_blocking=True)

        with torch.amp.autocast("cuda", enabled=use_amp and device.type == "cuda", dtype=torch.float16):
            out = model(input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids)
        all_preds.append(out.float().cpu().numpy())
    return np.vstack(all_preds)


def _preds_array_to_dicts(
    arr: np.ndarray,
    calibrators: dict[str, tuple[float, float]] | None = None,
) -> list[dict[str, float]]:
    """Chuyển mảng kết quả (N, 5) sang danh sách dict gồm điểm thô (`*_raw`) và điểm làm tròn bước 0.5."""
    out: list[dict[str, float]] = []
    for row in arr:
        d: dict[str, float] = {}
        for idx, target in enumerate(TARGETS):
            val = float(row[idx])
            if calibrators and target in calibrators:
                slope, intercept = calibrators[target]
                val = slope * val + intercept
            val = float(np.clip(val, 1.0, 9.0))
            d[f"{target}_raw"] = round(val, 4)
            d[target] = float(round_to_half_band(val))
        out.append(d)
    return out


def _fit_val_calibrators(
    records: list[dict[str, Any]],
    raw_arr: np.ndarray,
) -> dict[str, tuple[float, float]]:
    """Khớp bộ hiệu chỉnh tuyến tính (slope, intercept) trên tập validation cho từng đầu điểm nếu giúp giảm MAE."""
    calibrators: dict[str, tuple[float, float]] = {}
    for idx, target in enumerate(TARGETS):
        pairs = [
            (float(r[target]), float(np.clip(raw_arr[i, idx], 1.0, 9.0)))
            for i, r in enumerate(records)
            if r.get(target) is not None
        ]
        if len(pairs) < 25:
            calibrators[target] = (1.0, 0.0)
            continue
        yt = np.asarray([p[0] for p in pairs], dtype=np.float64)
        yp = np.asarray([p[1] for p in pairs], dtype=np.float64)
        if np.std(yp) < 1e-6:
            calibrators[target] = (1.0, 0.0)
            continue
        slope, intercept = np.polyfit(yp, yt, deg=1)
        slope = float(np.clip(slope, 0.80, 1.35))
        intercept = float(np.clip(intercept, -1.5, 1.5))
        cal_yp = np.clip(slope * yp + intercept, 1.0, 9.0)
        if float(np.mean(np.abs(yt - cal_yp))) < float(np.mean(np.abs(yt - yp))) - 1e-4:
            calibrators[target] = (round(slope, 6), round(intercept, 6))
        else:
            calibrators[target] = (1.0, 0.0)
    return calibrators


def _extract_concise_tips(feedback: str) -> list[str]:
    """Rút trích tối đa 3 gạch đầu dòng lời khuyên ngắn gọn, hữu ích từ phần đánh giá của giám khảo Jackrong."""
    tips: list[str] = []
    in_improvement_section = False
    for line in feedback.splitlines():
        s = line.strip()
        lower = s.lower()
        if lower.startswith("###") or lower.startswith("####"):
            in_improvement_section = any(
                kw in lower
                for kw in (
                    "weakness",
                    "improve",
                    "advice",
                    "actionable",
                    "next step",
                    "mistake",
                    "suggestion",
                )
            )
            continue
        if any(kw in lower for kw in ("**weakness", "**areas for improvement", "**to improve")):
            in_improvement_section = True
            continue
        if in_improvement_section and (s.startswith("*") or s.startswith("-") or re.match(r"^\d+\.", s)):
            clean = re.sub(r"^[\*\-\d\.\s]+", "", s)
            clean = re.sub(r"\*\*", "", clean).strip()
            if 25 <= len(clean) <= 220 and "hello" not in clean.lower():
                tips.append(clean)
                if len(tips) >= 3:
                    break
    return tips


def build_feedback_bank(train_recs: list[dict[str, Any]], out_path: Path, max_entries: int = 2500) -> None:
    """Xây dựng chỉ mục truy xuất lời khuyên (`feedback_bank.joblib`) bằng TF-IDF + SVD 64 chiều chỉ từ tập train."""
    candidates: list[dict[str, Any]] = []
    for rec in train_recs:
        fb = (rec.get("feedback") or "").strip()
        if not fb or len(fb) < 100:
            continue
        tips = _extract_concise_tips(fb)
        if not tips:
            continue
        candidates.append(
            {
                "prompt": str(rec.get("prompt") or "")[:400],
                "band": float(rec.get("overall_band") or 6.0),
                "tips": tips,
            }
        )
        if len(candidates) >= max_entries:
            break

    if not candidates:
        return

    # Vector hóa (prompt + tips) bằng TF-IDF rồi nén về 64 chiều chuẩn hóa L2 để tra cứu nhanh bằng cosine similarity
    texts = [f"{c['prompt']} " + " ".join(c["tips"]) for c in candidates]
    vec = TfidfVectorizer(max_features=8000, ngram_range=(1, 2), stop_words="english", min_df=2)
    mat = vec.fit_transform(texts)
    n_comp = min(64, max(2, mat.shape[1] - 1), max(2, mat.shape[0] - 1))
    svd = TruncatedSVD(n_components=n_comp, random_state=42)
    emb = svd.fit_transform(mat).astype(np.float32)
    norms = np.linalg.norm(emb, axis=1, keepdims=True) + 1e-8
    emb = emb / norms

    bank = {
        "vectorizer": vec,
        "svd": svd,
        "embeddings": emb,
        "bands": np.asarray([c["band"] for c in candidates], dtype=np.float32),
        "prompts": [c["prompt"] for c in candidates],
        "tips": [c["tips"] for c in candidates],
    }
    joblib.dump(bank, out_path, compress=3)
    print(f"Saved train-only Jackrong feedback bank ({len(candidates)} entries) to {out_path}", flush=True)


def _tune_hybrid_on_val(
    val_recs: list[dict[str, Any]],
    tr_val_arr: np.ndarray,
    tr_calibrators: dict[str, tuple[float, float]],
    baseline_dir: Path,
) -> dict[str, Any] | None:
    """Dò trọng số lai tối ưu (`transformer_weights`) giữa Transformer và Baseline chỉ trên tập `val.jsonl` nếu có Baseline."""
    bundle_path = baseline_dir / "baseline_bundle.joblib"
    if not bundle_path.exists():
        return None
    import sys

    from train_baseline import load_baseline_bundle

    base_module_dir = str(Path(__file__).resolve().parent)
    if base_module_dir not in sys.path:
        sys.path.insert(0, base_module_dir)
    baseline = load_baseline_bundle(bundle_path)
    base_val_preds = baseline.predict_batch(val_recs)
    tr_val_dicts = _preds_array_to_dicts(tr_val_arr, tr_calibrators)

    # Tìm kiếm lưới bước 0.05 trong [0.0, 1.0] cho từng đầu điểm để tối thiểu hóa MSE trên tập val
    weights: dict[str, float] = {}
    for target in TARGETS:
        pairs = []
        for rec, tp, bp in zip(val_recs, tr_val_dicts, base_val_preds):
            yt = rec.get(target)
            if yt is None:
                continue
            pairs.append((float(yt), float(tp[f"{target}_raw"]), float(bp[f"{target}_raw"])))
        if len(pairs) < 20:
            weights[target] = 1.0
            continue
        yt_arr = np.asarray([p[0] for p in pairs])
        tp_arr = np.asarray([p[1] for p in pairs])
        bp_arr = np.asarray([p[2] for p in pairs])

        best_w = 1.0
        best_score = float("inf")
        for w in np.linspace(0.0, 1.0, 21):
            cand = w * tp_arr + (1.0 - w) * bp_arr
            mse = float(np.mean((yt_arr - cand) ** 2))
            if mse < best_score:
                best_score = mse
                best_w = float(round(w, 2))
        weights[target] = best_w

    return {"transformer_weights": weights}


def _enable_activation_ckpt(backbone: nn.Module) -> None:
    """Bật activation/gradient checkpointing cho backbone nhằm tiết kiệm VRAM khi huấn luyện."""
    if hasattr(backbone, "activation_checkpointing_enable"):
        try:
            backbone.activation_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
            return
        except TypeError:
            pass
    try:
        backbone.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    except TypeError:
        backbone.gradient_checkpointing_enable()


def train_transformer(args: argparse.Namespace) -> dict[str, Any]:
    """Quy trình huấn luyện đầy đủ DeBERTa + AttentionMeanPoolHead, lưu checkpoint tốt nhất, tạo feedback_bank và dò hybrid_config.json."""
    set_seed(args.seed)
    t0 = time.time()

    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    train_recs = load_jsonl(data_dir / "train.jsonl")
    val_recs = load_jsonl(data_dir / "val.jsonl")
    test_recs = load_jsonl(data_dir / "test.jsonl")

    if args.max_train_samples and args.max_train_samples < len(train_recs):
        train_recs = train_recs[: args.max_train_samples]

    device = torch.device("cuda" if torch.cuda.is_available() and not args.cpu else "cpu")
    use_amp = (device.type == "cuda") and args.fp16
    print(
        f"Device: {device} | FP16 AMP: {use_amp} | Optimizer: {args.optimizer} | "
        f"GradCkpt: {not args.no_grad_ckpt} | Backbone: {args.backbone}",
        flush=True,
    )
    if device.type == "cuda":
        print(
            f"GPU: {torch.cuda.get_device_name(0)} | "
            f"Total VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**2:.0f} MB",
            flush=True,
        )
        torch.cuda.reset_peak_memory_stats()

    tokenizer = AutoTokenizer.from_pretrained(args.backbone, use_fast=True)
    config = AutoConfig.from_pretrained(args.backbone)
    config.use_cache = False
    # Ép trọng số backbone ở float32 để GradScaler / Adafactor không gặp lỗi unscale trọng số FP16
    backbone = AutoModel.from_pretrained(args.backbone, config=config, dtype=torch.float32)

    if not args.no_grad_ckpt:
        _enable_activation_ckpt(backbone)
        print("Activation/gradient checkpointing enabled.", flush=True)

    model = IeltsTransformerRegressor(
        backbone=backbone,
        hidden_size=config.hidden_size,
        dropout=args.dropout,
    ).to(device)

    use_tti = getattr(config, "type_vocab_size", 0) > 0
    print(f"Tokenizing train={len(train_recs)}, val={len(val_recs)}, test={len(test_recs)}...", flush=True)
    train_ds = IeltsEssayDataset(train_recs, tokenizer, max_length=args.max_length, is_train=True)
    val_ds = IeltsEssayDataset(val_recs, tokenizer, max_length=args.max_length, is_train=False)
    test_ds = IeltsEssayDataset(test_recs, tokenizer, max_length=args.max_length, is_train=False)

    pad_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else 0
    collate_fn = make_collate_fn(pad_id, use_token_type_ids=use_tti)

    train_lengths = [len(s["input_ids"]) for s in train_ds.samples]
    batch_sampler = BucketBatchSampler(train_lengths, batch_size=args.batch_size, seed=args.seed)
    train_loader = DataLoader(
        train_ds,
        batch_sampler=batch_sampler,
        collate_fn=collate_fn,
        pin_memory=(device.type == "cuda"),
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.eval_batch_size,
        shuffle=False,
        collate_fn=collate_fn,
        pin_memory=(device.type == "cuda"),
    )
    test_loader = DataLoader(
        test_ds,
        batch_size=args.eval_batch_size,
        shuffle=False,
        collate_fn=collate_fn,
        pin_memory=(device.type == "cuda"),
    )

    # Tách nhóm tham số: áp dụng weight decay cho trọng số ma trận, bỏ weight decay cho bias & LayerNorm; head học nhanh hơn 4 lần backbone
    no_decay = ("bias", "LayerNorm.weight", "LayerNorm.bias")
    optimizer_grouped_parameters = [
        {
            "params": [p for n, p in model.backbone.named_parameters() if not any(nd in n for nd in no_decay)],
            "weight_decay": args.weight_decay,
            "lr": args.lr,
        },
        {
            "params": [p for n, p in model.backbone.named_parameters() if any(nd in n for nd in no_decay)],
            "weight_decay": 0.0,
            "lr": args.lr,
        },
        {
            "params": [p for n, p in model.regressor.named_parameters() if not any(nd in n for nd in no_decay)],
            "weight_decay": args.weight_decay,
            "lr": args.lr * 4.0,
        },
        {
            "params": [p for n, p in model.regressor.named_parameters() if any(nd in n for nd in no_decay)],
            "weight_decay": 0.0,
            "lr": args.lr * 4.0,
        },
    ]

    if args.optimizer == "adafactor":
        optimizer: torch.optim.Optimizer = Adafactor(
            optimizer_grouped_parameters,
            lr=args.lr,
            scale_parameter=False,
            relative_step=False,
            warmup_init=False,
        )
    else:
        optimizer = torch.optim.AdamW(optimizer_grouped_parameters, lr=args.lr, foreach=False)

    total_opt_steps = max(1, math.ceil(len(train_loader) / args.grad_accum) * args.epochs)
    warmup_steps = max(1, int(total_opt_steps * args.warmup_ratio))
    scheduler = get_cosine_schedule_with_warmup(
        optimizer, num_warmup_steps=warmup_steps, num_training_steps=total_opt_steps
    )
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    best_score = -1e9
    best_val_arr: np.ndarray | None = None
    best_epoch = 0
    history: list[dict[str, Any]] = []

    backbone_save_dir = out_dir / "backbone"
    head_save_path = out_dir / "regressor_head.pt"

    # Vòng lặp huấn luyện qua từng epoch và chọn checkpoint có (QWK - 0.1 * MAE) cao nhất trên tập validation
    for epoch in range(1, args.epochs + 1):
        model.train()
        optimizer.zero_grad(set_to_none=True)
        running_loss = 0.0
        n_batches = 0
        consecutive_nonfinite = 0
        ep_t0 = time.time()
        total_steps = len(train_loader)

        for step, batch in enumerate(train_loader, start=1):
            input_ids = batch["input_ids"].to(device, non_blocking=True)
            attention_mask = batch["attention_mask"].to(device, non_blocking=True)
            token_type_ids = batch.get("token_type_ids")
            if token_type_ids is not None:
                token_type_ids = token_type_ids.to(device, non_blocking=True)
            labels = batch["labels"].to(device, non_blocking=True)
            label_mask = batch["label_mask"].to(device, non_blocking=True)
            sample_weight = batch["sample_weight"].to(device, non_blocking=True)

            with torch.amp.autocast("cuda", enabled=use_amp, dtype=torch.float16):
                preds = model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    token_type_ids=token_type_ids,
                )
                loss = compute_multitask_loss(preds, labels, label_mask, sample_weight)
                scaled_loss = loss / args.grad_accum

            # Bỏ qua batch nếu loss bị NaN/Inf và dừng hẳn nếu xảy ra quá 25 lần liên tiếp
            if not torch.isfinite(scaled_loss):
                consecutive_nonfinite += 1
                optimizer.zero_grad(set_to_none=True)
                if consecutive_nonfinite > 25:
                    raise RuntimeError("Too many consecutive non-finite losses in training.")
                continue
            consecutive_nonfinite = 0

            if use_amp:
                scaler.scale(scaled_loss).backward()
            else:
                scaled_loss.backward()
            running_loss += float(loss.item())
            n_batches += 1

            # Cộng dồn gradient đủ `grad_accum` bước mới cắt ngưỡng gradient và cập nhật trọng số
            if step % args.grad_accum == 0 or step == total_steps:
                if use_amp:
                    scaler.unscale_(optimizer)
                    torch.nn.utils.clip_grad_norm_(model.parameters(), args.max_grad_norm)
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    torch.nn.utils.clip_grad_norm_(model.parameters(), args.max_grad_norm)
                    optimizer.step()
                optimizer.zero_grad(set_to_none=True)
                scheduler.step()

            if step % 250 == 0 or step == total_steps:
                elapsed_ep = time.time() - ep_t0
                eta = (elapsed_ep / step) * (total_steps - step)
                print(
                    f"  [Epoch {epoch}/{args.epochs}] step {step}/{total_steps} | "
                    f"avg_loss={running_loss / max(1, n_batches):.4f} | "
                    f"elapsed={elapsed_ep:.0f}s | eta={eta:.0f}s",
                    flush=True,
                )

        if device.type == "cuda":
            torch.cuda.empty_cache()

        val_arr = predict_transformer(model, val_loader, device=device, use_amp=use_amp)
        val_dicts = _preds_array_to_dicts(val_arr)
        val_rep = evaluate_predictions(val_recs, val_dicts)
        ov = val_rep["overall"]

        # Tiêu chí chọn checkpoint tốt nhất: cân bằng giữa độ đồng thuận QWK và sai số MAE
        sel_score = ov["qwk"] - 0.1 * ov["mae"]
        peak_vram_mb = (
            round(torch.cuda.max_memory_allocated() / (1024 ** 2), 1)
            if device.type == "cuda"
            else 0.0
        )
        ep_secs = round(time.time() - ep_t0, 1)
        avg_train_loss = round(running_loss / max(1, n_batches), 4)

        print(
            f"Epoch {epoch}/{args.epochs} ({ep_secs}s) | train_loss={avg_train_loss:.4f} | "
            f"val MAE={ov['mae']:.4f}, RMSE={ov['rmse']:.4f}, QWK={ov['qwk']:.4f}, "
            f"Pearson={ov['pearson']:.4f}, Within0.5={ov['within_0_5_pct']:.2f}% | "
            f"PeakVRAM={peak_vram_mb:.0f} MB",
            flush=True,
        )
        history.append(
            {
                "epoch": epoch,
                "train_loss": avg_train_loss,
                "val_overall": ov,
                "epoch_seconds": ep_secs,
                "peak_vram_mb": peak_vram_mb,
            }
        )

        if sel_score > best_score:
            best_score = sel_score
            best_val_arr = val_arr.copy()
            best_epoch = epoch
            backbone_save_dir.mkdir(parents=True, exist_ok=True)
            model.backbone.save_pretrained(backbone_save_dir)
            tokenizer.save_pretrained(backbone_save_dir)
            torch.save(model.regressor.state_dict(), head_save_path)
            print(f"  -> Saved new best checkpoint (epoch={epoch}, sel_score={sel_score:.4f})", flush=True)

    # Giải phóng bộ nhớ optimizer/gradient trước khi nạp lại checkpoint tốt nhất để đánh giá
    del model, optimizer, scheduler, scaler
    if device.type == "cuda":
        torch.cuda.empty_cache()

    best_backbone = AutoModel.from_pretrained(backbone_save_dir, dtype=torch.float32)
    best_model = IeltsTransformerRegressor(
        backbone=best_backbone,
        hidden_size=config.hidden_size,
        dropout=args.dropout,
    ).to(device)
    best_model.regressor.load_state_dict(torch.load(head_save_path, map_location=device))

    if best_val_arr is None:
        best_val_arr = predict_transformer(best_model, val_loader, device=device, use_amp=use_amp)

    # Khớp hệ số hiệu chỉnh tuyến tính trên val rồi đánh giá cuối cùng trên cả val và test
    calibrators = _fit_val_calibrators(val_recs, best_val_arr)
    test_arr = predict_transformer(best_model, test_loader, device=device, use_amp=use_amp)

    val_preds = _preds_array_to_dicts(best_val_arr, calibrators)
    test_preds = _preds_array_to_dicts(test_arr, calibrators)

    val_report = evaluate_predictions(val_recs, val_preds)
    test_report = evaluate_predictions(test_recs, test_preds)
    print_evaluation_summary("transformer/val", val_report)
    print_evaluation_summary("transformer/test", test_report)

    peak_vram_mb = (
        round(torch.cuda.max_memory_allocated() / (1024 ** 2), 1)
        if device.type == "cuda"
        else 0.0
    )

    meta = {
        "model_type": "transformer_multitask",
        "backbone": args.backbone,
        "optimizer": args.optimizer,
        "hidden_size": int(config.hidden_size),
        "dropout": float(args.dropout),
        "max_length": int(args.max_length),
        "use_token_type_ids": bool(use_tti),
        "best_epoch": int(best_epoch),
        "epochs": int(args.epochs),
        "batch_size": int(args.batch_size),
        "grad_accum": int(args.grad_accum),
        "lr": float(args.lr),
        "fp16": bool(use_amp),
        "gradient_checkpointing": bool(not args.no_grad_ckpt),
        "peak_vram_mb": peak_vram_mb,
        "train_seconds": round(time.time() - t0, 1),
        "calibrators": {k: list(v) for k, v in calibrators.items()},
        "history": history,
        "val": val_report,
        "test": test_report,
    }
    (out_dir / "model_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    # Tạo chỉ mục lời khuyên giám khảo từ tập train để dùng khi suy luận
    build_feedback_bank(train_recs, out_dir / "feedback_bank.joblib")

    models_root = out_dir.parent
    baseline_dir = models_root / "baseline"
    best_model_name = "transformer"
    best_val_qwk = val_report["overall"]["qwk"]
    best_val_mae = val_report["overall"]["mae"]

    # Nếu đã huấn luyện Baseline trước đó, dò trọng số lai Hybrid trên tập val và lưu hybrid_config.json
    if (baseline_dir / "baseline_bundle.joblib").exists():
        import sys

        from train_baseline import load_baseline_bundle

        base_module_dir = str(Path(__file__).resolve().parent)
        if base_module_dir not in sys.path:
            sys.path.insert(0, base_module_dir)
        baseline = load_baseline_bundle(baseline_dir / "baseline_bundle.joblib")
        base_val_preds = baseline.predict_batch(val_recs)
        base_test_preds = baseline.predict_batch(test_recs)
        base_val_rep = evaluate_predictions(val_recs, base_val_preds)

        hybrid_cfg = _tune_hybrid_on_val(val_recs, best_val_arr, calibrators, baseline_dir)
        if hybrid_cfg is not None:
            tw = hybrid_cfg["transformer_weights"]

            def _combine(
                tr_dicts: list[dict[str, float]], b_dicts: list[dict[str, float]]
            ) -> list[dict[str, float]]:
                combined: list[dict[str, float]] = []
                for tp, bp in zip(tr_dicts, b_dicts):
                    row: dict[str, float] = {}
                    for target in TARGETS:
                        w = float(tw.get(target, 1.0))
                        t_raw = tp.get(f"{target}_raw")
                        b_raw = bp.get(f"{target}_raw")
                        if t_raw is not None and b_raw is not None:
                            val = float(np.clip(w * t_raw + (1.0 - w) * b_raw, 1.0, 9.0))
                        else:
                            val = float(t_raw if t_raw is not None else b_raw)
                        row[f"{target}_raw"] = round(val, 4)
                        row[target] = float(round_to_half_band(val))
                    combined.append(row)
                return combined

            hyb_val_preds = _combine(val_preds, base_val_preds)
            hyb_test_preds = _combine(test_preds, base_test_preds)
            hyb_val_rep = evaluate_predictions(val_recs, hyb_val_preds)
            hyb_test_rep = evaluate_predictions(test_recs, hyb_test_preds)

            print_evaluation_summary("hybrid/val", hyb_val_rep)
            print_evaluation_summary("hybrid/test", hyb_test_rep)

            hybrid_dir = models_root / "hybrid"
            hybrid_dir.mkdir(parents=True, exist_ok=True)
            hybrid_payload = {
                "transformer_weights": tw,
                "val": hyb_val_rep,
                "test": hyb_test_rep,
            }
            (hybrid_dir / "hybrid_config.json").write_text(
                json.dumps(hybrid_payload, indent=2), encoding="utf-8"
            )

            # So sánh 3 ứng viên (baseline, transformer, hybrid) trên tập val để chọn mô hình tốt nhất vào best_manifest.json
            candidates = [
                ("baseline", base_val_rep["overall"]["qwk"], base_val_rep["overall"]["mae"]),
                ("transformer", val_report["overall"]["qwk"], val_report["overall"]["mae"]),
                ("hybrid", hyb_val_rep["overall"]["qwk"], hyb_val_rep["overall"]["mae"]),
            ]
            best_cand = max(candidates, key=lambda c: c[1] - 0.1 * c[2])
            best_model_name, best_val_qwk, best_val_mae = best_cand

    manifest = {
        "selected_model": best_model_name,
        "val_qwk": best_val_qwk,
        "val_mae": best_val_mae,
        "transformer_dir": str(out_dir),
        "baseline_dir": str(baseline_dir) if (baseline_dir / "baseline_bundle.joblib").exists() else None,
        "hybrid_dir": str(models_root / "hybrid")
        if (models_root / "hybrid" / "hybrid_config.json").exists()
        else None,
    }
    (models_root / "best_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(
        f"\nBest model selected on validation split: {best_model_name} "
        f"(QWK={best_val_qwk:.4f}, MAE={best_val_mae:.4f})",
        flush=True,
    )
    return meta


def main() -> None:
    """Điểm vào CLI cấu hình siêu tham số và khởi chạy huấn luyện mô hình Transformer."""
    base_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Train GPU Transformer IELTS Writing Task 2 scorer.")
    parser.add_argument("--data-dir", type=str, default=str(base_dir / "data"))
    parser.add_argument("--out-dir", type=str, default=str(base_dir / "models" / "transformer"))
    parser.add_argument("--backbone", type=str, default="microsoft/deberta-v3-small")
    parser.add_argument("--optimizer", choices=["adafactor", "adamw"], default="adafactor")
    parser.add_argument("--max-length", type=int, default=512)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--eval-batch-size", type=int, default=16)
    parser.add_argument("--grad-accum", type=int, default=8)
    parser.add_argument("--lr", type=float, default=3e-5)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--warmup-ratio", type=float, default=0.08)
    parser.add_argument("--dropout", type=float, default=0.15)
    parser.add_argument("--max-grad-norm", type=float, default=1.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-grad-ckpt", action="store_true")
    parser.add_argument("--fp16", action="store_true", help="Enable FP16 autocast (recommended only on Tensor Core GPUs).")
    parser.add_argument("--cpu", action="store_true")
    parser.add_argument("--max-train-samples", type=int, default=None)
    args = parser.parse_args()

    train_transformer(args)


if __name__ == "__main__":
    main()
