"""
Trích xuất đặc trưng âm học thô ở cả 3 cấp độ (câu, từ, âm vị) phân tầng theo từng người nói
bằng cách chạy trực tiếp qua pipeline FastAPI (nhưng TẮT bộ hiệu chuẩn) trên 2 bộ dữ liệu:
  - Tập train SpeechOcean762 (125 người nói -> `cache/so_train_feats.jsonl`): dùng để huấn luyện bộ hiệu chuẩn.
  - Tập test SpeechOcean762  (125 người nói mới -> `cache/so_test_feats.jsonl`): dùng để đánh giá khách quan.
  - 8 người nói held-out của LibriSpeech clean/validation -> `cache/ls_heldout_feats.jsonl`: đo kiểm giọng bản ngữ chưa thấy.
  - 32 người nói train của LibriSpeech clean/validation -> `cache/ls_train_anchors.jsonl`: làm mốc neo giọng bản ngữ khi train.

Tùy chọn hỗ trợ:
  - `--*-per-speaker 0`: trích xuất TOÀN BỘ các câu trong phân tập tương ứng.
  - `--workers N`: chạy song song nhiều tiến trình CPU.
  - `--resume`: chạy tiếp từ checkpoint dựa trên chỉ số câu `idx` đã lưu trong file JSONL.

Chỉ dùng ngoại tuyến (offline) để tạo bộ cache train/eval; không bao giờ chạy trong luồng API thực tế.
"""
import argparse
import concurrent.futures
import json
import logging
import os
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logging.getLogger("phonetics-service").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.ERROR)

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.dataset_utils import (  # noqa: E402
    LIBRISPEECH_VAL,
    SPEECHOCEAN_TEST,
    SPEECHOCEAN_TRAIN,
    decode_parquet_audio,
    load_parquet_rows,
    numpy_to_wav_bytes,
    split_by_speaker,
)

# Ngữ cảnh lưu các đối tượng đã khởi tạo cho từng tiến trình worker
_SO_WORKER_CTX: Dict[str, Any] = {}


def _strip_arpa_stress(phone: str) -> str:
    """Xóa chữ số trọng âm (0, 1, 2) ở cuối ký hiệu âm vị ARPAbet để khớp với nhãn âm vị của SpeechOcean762."""
    return re.sub(r"[012]$", "", phone.strip())


def _init_so_worker(torch_threads: int) -> None:
    """
    Khởi tạo tiến trình worker để trích xuất đặc trưng thô trước hiệu chuẩn.

    Nạp hồ sơ formant `vowels.json` mới nhất, ép `scorer.calibrator` sang chế độ `identity`
    (không hiệu chuẩn) và nạp sẵn mô hình forced aligner vào bộ nhớ worker.
    """
    os.environ["OMP_NUM_THREADS"] = str(torch_threads)
    os.environ["MKL_NUM_THREADS"] = str(torch_threads)
    import torch

    torch.set_num_threads(max(1, int(torch_threads)))
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    logging.getLogger("phonetics-service").setLevel(logging.ERROR)
    logging.getLogger("httpx").setLevel(logging.ERROR)

    from fastapi.testclient import TestClient
    from app.api.routes import _diagnostics_sink
    from app.config import settings
    from app.main import app
    from app.services.aligner import forced_aligner, validate_script
    from app.services.formant_service import formant_service
    from app.services.scorer import ScoringCalibrator, scorer

    # Nạp hồ sơ formant hiện hành và cố tình đặt calibrator ở chế độ identity để lấy điểm thô nguyên bản
    formant_service._load_profiles_from_disk(settings.VOWEL_PROFILE_PATH)
    scorer.calibrator = ScoringCalibrator(mode="identity")
    forced_aligner.model_mgr.load_model()

    _SO_WORKER_CTX["client"] = TestClient(app)
    _SO_WORKER_CTX["_diagnostics_sink"] = _diagnostics_sink
    _SO_WORKER_CTX["validate_script"] = validate_script


def _worker_process_so_item(item: Tuple[str, int, dict]) -> Tuple[bool, Any]:
    """
    Chạy 1 mẫu SpeechOcean762 qua API `/api/v1/audio/evaluate-phonetics` (tắt hiệu chuẩn qua `_diagnostics_sink`)
    để thu về đầy đủ đặc trưng cấp câu (`utt_features`), điểm thô (`raw_scores`), điểm chuyên gia (`human`)
    cũng như cặp đối chiếu cấp từ (`word_pairs`) và cấp âm vị (`phone_pairs`).
    """
    split_name, orig_idx, row = item
    if not _SO_WORKER_CTX:
        _init_so_worker(2)

    client = _SO_WORKER_CTX["client"]
    _diagnostics_sink = _SO_WORKER_CTX["_diagnostics_sink"]

    script = row["text"]
    audio_16k = decode_parquet_audio(row["audio"], target_sr=16000)
    wav_bytes = numpy_to_wav_bytes(audio_16k, 16000)

    # Dùng ContextVar `_diagnostics_sink` để chặn hiệu chuẩn và thu vector đặc trưng nội bộ từ route
    sink: Dict[str, Any] = {"disable_calibration": True}
    tok = _diagnostics_sink.set(sink)
    try:
        res = client.post(
            "/api/v1/audio/evaluate-phonetics",
            files={"audio": (f"{split_name}_{orig_idx}.wav", wav_bytes, "audio/wav")},
            data={"script": script},
        )
    finally:
        _diagnostics_sink.reset(tok)

    if res.status_code != 200:
        try:
            code = res.json().get("detail", {}).get("code")
        except Exception:
            code = "ERR"
        return False, (int(orig_idx), res.status_code, code, script)

    body = res.json()
    ev_status = body.get("evaluationStatus")
    sim_val = sink.get("whole_file_sim")
    pred_words = body.get("words", [])
    gt_words = row.get("words", [])
    word_pairs = []
    phone_pairs = []
    diag_word_phonemes = sink.get("word_phonemes", {})

    # Chỉ ghép cặp mức từ và mức âm vị khi số lượng từ/âm vị khớp 1-1 với nhãn gốc
    if len(pred_words) == len(gt_words):
        for w_i, (pw, gw) in enumerate(zip(pred_words, gt_words)):
            if pw.get("score") is not None:
                word_pairs.append({
                    "word": pw.get("word"),
                    "human_acc": float(gw["accuracy"]) * 10.0,
                    "human_stress": float(gw["stress"]) * 10.0,
                    "human_total": float(gw["total"]) * 10.0,
                    "pred_score": float(pw["score"]),
                    "status": pw.get("wordStatus"),
                })
            gt_phones = gw.get("phones") or []
            gt_accs = gw.get("phones-accuracy") or []
            pred_ph_diag = diag_word_phonemes.get(w_i, [])
            if gt_phones and len(gt_phones) == len(gt_accs) and len(gt_phones) == len(pred_ph_diag):
                for gp, ga, pd in zip(gt_phones, gt_accs, pred_ph_diag):
                    phone_pairs.append({
                        "arpa": _strip_arpa_stress(gp),
                        "human_acc": float(ga),
                        **pd,
                    })

    rec = {
        "id": f"{split_name}_{orig_idx}",
        "idx": int(orig_idx),
        "speaker": str(row["speaker"]),
        "age": row.get("age"),
        "gender_meta": row.get("gender"),
        "text": script,
        "evaluation_status": ev_status,
        "rejected_mismatch": ev_status == "REJECTED_MISMATCH",
        "whole_file_sim": sim_val,
        "align_conf": sink.get("align_conf"),
        "mean_utt_canon": sink.get("mean_utt_canon"),
        # Điểm chuẩn chuyên gia ở thang 0..10 được quy đổi sang thang 0..100
        "human": {
            "accuracy": float(row["accuracy"]) * 10.0,
            "fluency": float(row["fluency"]) * 10.0,
            "prosodic": float(row["prosodic"]) * 10.0,
            "completeness": float(row["completeness"]) * 10.0,
            "total": float(row["total"]) * 10.0,
        },
        "raw_scores": sink.get("raw_scores", {
            "pronunciation": float(body.get("pronunciationScore", 0.0)),
            "fluency": float(body.get("fluencyScore", 0.0)),
            "prosody": float(body.get("kpi", {}).get("prosody", 0.0)),
            "overall": float(body.get("overallScore", 0.0)),
            "speed": float(body.get("speedScore", 0.0)),
            "completeness": int(body.get("kpi", {}).get("completeness", 0)),
        }),
        "utt_features": sink.get("utt_features", {}),
        "word_pairs": word_pairs,
        "phone_pairs": phone_pairs,
    }
    return True, rec


def _worker_process_ls_item(item: Tuple[str, int, dict]) -> Tuple[bool, Any]:
    """Chạy 1 mẫu LibriSpeech qua pipeline (tắt hiệu chuẩn) để thu đặc trưng thô `utt_features` và điểm thô làm tập neo/kiểm thử giọng bản ngữ."""
    split_name, orig_idx, row = item
    if not _SO_WORKER_CTX:
        _init_so_worker(2)

    client = _SO_WORKER_CTX["client"]
    _diagnostics_sink = _SO_WORKER_CTX["_diagnostics_sink"]
    validate_script = _SO_WORKER_CTX["validate_script"]

    script = row["text"]
    try:
        validate_script(script)
    except Exception as ex:
        return False, (int(orig_idx), "INVALID_SCRIPT", str(ex))

    audio_16k = decode_parquet_audio(row["audio"], target_sr=16000)
    wav_bytes = numpy_to_wav_bytes(audio_16k, 16000)

    sink: Dict[str, Any] = {"disable_calibration": True}
    tok = _diagnostics_sink.set(sink)
    try:
        res = client.post(
            "/api/v1/audio/evaluate-phonetics",
            files={"audio": (f"{split_name}_{orig_idx}.wav", wav_bytes, "audio/wav")},
            data={"script": script},
        )
    finally:
        _diagnostics_sink.reset(tok)

    if res.status_code != 200:
        try:
            code = res.json().get("detail", {}).get("code")
        except Exception:
            code = "ERR"
        return False, (int(orig_idx), res.status_code, code)

    body = res.json()
    rec = {
        "id": f"{split_name}_{orig_idx}",
        "idx": int(orig_idx),
        "speaker": str(row["speaker_id"]),
        "text": script,
        "evaluation_status": body.get("evaluationStatus"),
        "whole_file_sim": sink.get("whole_file_sim"),
        "align_conf": sink.get("align_conf"),
        "is_passed": bool(body.get("isPassed")),
        "raw_scores": sink.get("raw_scores", {}),
        "utt_features": sink.get("utt_features", {}),
    }
    return True, rec


def _sample_so_stratified(rows: List[dict], per_speaker: int, seed: int = 42) -> List[tuple]:
    """
    Chọn mẫu phân tầng tất định `per_speaker` câu cho mỗi người nói trong SpeechOcean762,
    trải đều theo dải điểm `total` từ thấp đến cao của người nói đó (`0` = lấy toàn bộ).
    """
    rng = np.random.default_rng(seed)
    by_spk: Dict[str, List[tuple]] = defaultdict(list)
    for idx, r in enumerate(rows):
        by_spk[str(r["speaker"])].append((idx, r))

    selected: List[tuple] = []
    for spk in sorted(by_spk.keys()):
        items = sorted(by_spk[spk], key=lambda pair: (float(pair[1]["total"]), float(pair[1]["accuracy"]), pair[0]))
        if per_speaker <= 0 or len(items) <= per_speaker:
            selected.extend(items)
        else:
            lin = np.linspace(0, len(items) - 1, per_speaker)
            chosen_pos = sorted({int(round(x)) for x in lin})
            while len(chosen_pos) < per_speaker:
                cand = int(rng.integers(0, len(items)))
                if cand not in chosen_pos:
                    chosen_pos.append(cand)
            selected.extend(items[p] for p in chosen_pos)
    return selected


def _sample_ls_by_speaker(rows: List[Tuple[int, dict]], per_speaker: int, seed: int = 42) -> List[tuple]:
    """Lấy mẫu tối đa `per_speaker` câu mỗi người nói trong LibriSpeech nhưng vẫn giữ nguyên chỉ số `idx` gốc trong Parquet (`0` = lấy toàn bộ)."""
    rng = np.random.default_rng(seed)
    by_spk: Dict[str, List[tuple]] = defaultdict(list)
    for orig_idx, r in rows:
        by_spk[str(r["speaker_id"])].append((orig_idx, r))

    selected: List[tuple] = []
    for spk in sorted(by_spk.keys()):
        items = by_spk[spk]
        if per_speaker <= 0 or len(items) <= per_speaker:
            selected.extend(items)
        else:
            idxs = sorted(rng.choice(len(items), size=per_speaker, replace=False).tolist())
            selected.extend(items[i] for i in idxs)
    return selected


def _load_existing_indices(out_path: Path) -> Dict[int, dict]:
    """Đọc các bản ghi đã lưu trước đó trong file JSONL và lập chỉ mục theo `idx` để hỗ trợ chạy tiếp `--resume`."""
    existing: Dict[int, dict] = {}
    if not out_path.exists():
        return existing
    with open(out_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rec = json.loads(line)
                existing[int(rec["idx"])] = rec
    return existing


def _extract_so_split(
    rows: List[dict],
    per_speaker: int,
    split_name: str,
    out_path: Path,
    seed: int = 42,
    workers: int = 1,
    torch_threads: int = 2,
    resume: bool = False,
    max_items: int = 0,
) -> Dict[str, Any]:
    """Điều phối quá trình trích xuất đặc trưng (đơn luồng hoặc đa tiến trình) cho một phân tập SpeechOcean762 và ghi ra JSONL."""
    sampled = _sample_so_stratified(rows, per_speaker=per_speaker, seed=seed)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    existing = _load_existing_indices(out_path) if resume else {}
    todo = [(split_name, orig_idx, row) for orig_idx, row in sampled if int(orig_idx) not in existing]
    total_todo = len(todo)
    if max_items and max_items > 0:
        todo = todo[:max_items]
    print(
        f"Starting {split_name}: sampled={len(sampled)}, cached={len(existing)}, todo={total_todo}, batch={len(todo)}, workers={workers}",
        flush=True,
    )

    t0 = time.time()
    errors: List[tuple] = []
    mode = "a" if (resume and existing) else "w"
    done_now = 0
    ok_now = 0

    with open(out_path, mode, encoding="utf-8") as fout:
        if workers <= 1:
            _init_so_worker(torch_threads)
            for item in todo:
                success, payload = _worker_process_so_item(item)
                done_now += 1
                if success:
                    existing[payload["idx"]] = payload
                    fout.write(json.dumps(payload, ensure_ascii=False) + "\n")
                    ok_now += 1
                else:
                    errors.append(payload)
                if done_now % 50 == 0 or done_now == len(todo):
                    fout.flush()
                    print(
                        f"  [{split_name}] {done_now}/{len(todo)} "
                        f"(ok={ok_now}, err={len(errors)}, {time.time() - t0:.1f}s)",
                        flush=True,
                    )
        else:
            with concurrent.futures.ProcessPoolExecutor(
                max_workers=workers,
                initializer=_init_so_worker,
                initargs=(torch_threads,),
            ) as executor:
                futures = [executor.submit(_worker_process_so_item, item) for item in todo]
                for fut in concurrent.futures.as_completed(futures):
                    success, payload = fut.result()
                    done_now += 1
                    if success:
                        existing[payload["idx"]] = payload
                        fout.write(json.dumps(payload, ensure_ascii=False) + "\n")
                        ok_now += 1
                    else:
                        errors.append(payload)
                    if done_now % 25 == 0 or done_now == len(todo):
                        fout.flush()
                        print(
                            f"  [{split_name} w={workers}] {done_now}/{len(todo)} "
                            f"(ok={ok_now}, err={len(errors)}, {time.time() - t0:.1f}s)",
                            flush=True,
                        )

    all_recs = [existing[k] for k in sorted(existing.keys())]
    sims = [float(r["whole_file_sim"]) for r in all_recs if r.get("whole_file_sim") is not None]
    min_sim = min(sims) if sims else 1.0
    rejected_mismatch_count = sum(1 for r in all_recs if r.get("rejected_mismatch"))

    elapsed = round(time.time() - t0, 2)
    err_counts = dict(Counter((e[1], e[2]) for e in errors))
    remaining = max(0, total_todo - done_now)
    summary = {
        "split": split_name,
        "sampled": len(sampled),
        "ok": len(all_recs),
        "processed_now": done_now,
        "remaining": remaining,
        "errors": len(errors),
        "error_breakdown": {f"{k[0]}:{k[1]}": v for k, v in err_counts.items()},
        "rejected_mismatch": rejected_mismatch_count,
        "min_whole_file_sim": round(float(min_sim), 4),
        "elapsed_sec": elapsed,
    }
    print(f"Finished {split_name}: {summary}", flush=True)
    return summary


def _extract_ls_split(
    indexed_rows: List[Tuple[int, dict]],
    per_speaker: int,
    split_name: str,
    out_path: Path,
    seed: int = 42,
    workers: int = 1,
    torch_threads: int = 2,
    resume: bool = False,
    max_items: int = 0,
) -> Dict[str, Any]:
    """Điều phối quá trình trích xuất đặc trưng (đơn luồng hoặc đa tiến trình) cho một phân tập LibriSpeech (train anchors hoặc held-out) và ghi ra JSONL."""
    sampled = _sample_ls_by_speaker(indexed_rows, per_speaker=per_speaker, seed=seed)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    existing = _load_existing_indices(out_path) if resume else {}
    todo = [(split_name, orig_idx, row) for orig_idx, row in sampled if int(orig_idx) not in existing]
    total_todo = len(todo)
    if max_items and max_items > 0:
        todo = todo[:max_items]
    print(
        f"Starting {split_name}: sampled={len(sampled)}, cached={len(existing)}, todo={total_todo}, batch={len(todo)}, workers={workers}",
        flush=True,
    )

    t0 = time.time()
    errors: List[tuple] = []
    mode = "a" if (resume and existing) else "w"
    done_now = 0
    ok_now = 0

    with open(out_path, mode, encoding="utf-8") as fout:
        if workers <= 1:
            _init_so_worker(torch_threads)
            for item in todo:
                success, payload = _worker_process_ls_item(item)
                done_now += 1
                if success:
                    existing[payload["idx"]] = payload
                    fout.write(json.dumps(payload, ensure_ascii=False) + "\n")
                    ok_now += 1
                else:
                    errors.append(payload)
                if done_now % 40 == 0 or done_now == len(todo):
                    fout.flush()
                    print(
                        f"  [{split_name}] {done_now}/{len(todo)} (ok={ok_now}, {time.time() - t0:.1f}s)",
                        flush=True,
                    )
        else:
            with concurrent.futures.ProcessPoolExecutor(
                max_workers=workers,
                initializer=_init_so_worker,
                initargs=(torch_threads,),
            ) as executor:
                futures = [executor.submit(_worker_process_ls_item, item) for item in todo]
                for fut in concurrent.futures.as_completed(futures):
                    success, payload = fut.result()
                    done_now += 1
                    if success:
                        existing[payload["idx"]] = payload
                        fout.write(json.dumps(payload, ensure_ascii=False) + "\n")
                        ok_now += 1
                    else:
                        errors.append(payload)
                    if done_now % 25 == 0 or done_now == len(todo):
                        fout.flush()
                        print(
                            f"  [{split_name} w={workers}] {done_now}/{len(todo)} (ok={ok_now}, {time.time() - t0:.1f}s)",
                            flush=True,
                        )

    remaining = max(0, total_todo - done_now)
    summary = {
        "split": split_name,
        "sampled": len(sampled),
        "ok": len(existing),
        "processed_now": done_now,
        "remaining": remaining,
        "errors": len(errors),
        "elapsed_sec": round(time.time() - t0, 2),
    }
    print(f"Finished {split_name}: {summary}", flush=True)
    return summary


def main():
    """
    Điểm khởi chạy CLI: đọc bộ dữ liệu Parquet SpeechOcean762 (train/test) và LibriSpeech clean/validation,
    chia tách người nói LibriSpeech 80/20 bằng `split_by_speaker` để tránh rò rỉ dữ liệu, rồi trích xuất
    tối đa 4 tập JSONL đặc trưng thô (`so_train`, `so_test`, `ls_heldout`, `ls_train`) và lưu báo cáo tổng hợp.
    """
    parser = argparse.ArgumentParser()
    # Tham số giới hạn số câu mỗi người nói (0 = lấy toàn bộ), số worker CPU, và chế độ chạy tiếp --resume
    parser.add_argument("--train-per-speaker", type=int, default=5, help="0 = ALL rows per speaker")
    parser.add_argument("--test-per-speaker", type=int, default=3, help="0 = ALL rows per speaker")
    parser.add_argument("--ls-heldout-per-speaker", type=int, default=6, help="0 = ALL rows per speaker")
    parser.add_argument("--ls-train-per-speaker", type=int, default=1, help="0 = ALL rows per speaker")
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--torch-threads", type=int, default=2)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--max-items", type=int, default=0, help="0 = process all remaining items")
    parser.add_argument(
        "--only",
        choices=["all", "so_train", "so_test", "ls_heldout", "ls_train"],
        default="all",
    )
    args = parser.parse_args()

    summary_path = ROOT / "cache" / "feature_extraction_summary.json"
    meta: Dict[str, Any] = {}
    if args.only != "all" and summary_path.exists():
        try:
            meta = json.loads(summary_path.read_text(encoding="utf-8"))
        except Exception:
            meta = {}

    limited = args.max_items > 0
    budget = args.max_items

    # 1. Trích xuất tập huấn luyện SpeechOcean762 (125 người nói) -> cache/so_train_feats.jsonl
    if args.only in ("all", "so_train") and (not limited or budget > 0):
        so_train_rows = load_parquet_rows(SPEECHOCEAN_TRAIN)
        res = _extract_so_split(
            so_train_rows,
            per_speaker=args.train_per_speaker,
            split_name="so_train",
            out_path=ROOT / "cache" / "so_train_feats.jsonl",
            seed=42,
            workers=args.workers,
            torch_threads=args.torch_threads,
            resume=args.resume,
            max_items=budget if limited else 0,
        )
        meta["so_train"] = res
        if limited:
            budget = max(0, budget - int(res.get("processed_now", 0)))

    # 2. Trích xuất tập kiểm thử SpeechOcean762 (125 người nói độc lập) -> cache/so_test_feats.jsonl
    if args.only in ("all", "so_test") and (not limited or budget > 0):
        so_test_rows = load_parquet_rows(SPEECHOCEAN_TEST)
        res = _extract_so_split(
            so_test_rows,
            per_speaker=args.test_per_speaker,
            split_name="so_test",
            out_path=ROOT / "cache" / "so_test_feats.jsonl",
            seed=101,
            workers=args.workers,
            torch_threads=args.torch_threads,
            resume=args.resume,
            max_items=budget if limited else 0,
        )
        meta["so_test"] = res
        if limited:
            budget = max(0, budget - int(res.get("processed_now", 0)))

    # 3. Chia tách người nói LibriSpeech 80/20 (32 người nói train vs 8 người nói held-out) tránh rò rỉ dữ liệu
    if args.only in ("all", "ls_heldout", "ls_train") and (not limited or budget > 0):
        ls_rows = load_parquet_rows(LIBRISPEECH_VAL)
        ls_train_rows, _ = split_by_speaker(ls_rows, speaker_key="speaker_id", train_frac=0.80, seed=42)
        train_spk_set = {str(r["speaker_id"]) for r in ls_train_rows}
        indexed_train = [(i, r) for i, r in enumerate(ls_rows) if str(r["speaker_id"]) in train_spk_set]
        indexed_heldout = [(i, r) for i, r in enumerate(ls_rows) if str(r["speaker_id"]) not in train_spk_set]

        if args.only in ("all", "ls_heldout") and (not limited or budget > 0):
            res = _extract_ls_split(
                indexed_heldout,
                per_speaker=args.ls_heldout_per_speaker,
                split_name="ls_heldout",
                out_path=ROOT / "cache" / "ls_heldout_feats.jsonl",
                seed=42,
                workers=args.workers,
                torch_threads=args.torch_threads,
                resume=args.resume,
                max_items=budget if limited else 0,
            )
            meta["ls_heldout"] = res
            if limited:
                budget = max(0, budget - int(res.get("processed_now", 0)))
        if args.only in ("all", "ls_train") and (not limited or budget > 0):
            res = _extract_ls_split(
                indexed_train,
                per_speaker=args.ls_train_per_speaker,
                split_name="ls_train",
                out_path=ROOT / "cache" / "ls_train_anchors.jsonl",
                seed=42,
                workers=args.workers,
                torch_threads=args.torch_threads,
                resume=args.resume,
                max_items=budget if limited else 0,
            )
            meta["ls_train"] = res
            if limited:
                budget = max(0, budget - int(res.get("processed_now", 0)))

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Saved extraction summary -> {summary_path}", flush=True)


if __name__ == "__main__":
    main()
