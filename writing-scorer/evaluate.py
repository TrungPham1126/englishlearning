"""Tiện ích đánh giá và giao diện dòng lệnh (CLI) cho các mô hình chấm điểm IELTS Writing Task 2.

Tính toán các chỉ số đánh giá gồm MAE, RMSE, hệ số tương quan Pearson r, Spearman rho,
Quadratic Weighted Kappa (QWK trên thang band làm tròn 0.5 từ 1.0..9.0 ánh xạ sang 17 lớp 0..16),
tỷ lệ đoán chính xác tuyệt đối (Exact Match %) và tỷ lệ sai lệch trong khoảng 0.5 / 1.0 band
trên các tập dữ liệu kiểm định (val) và kiểm thử (test) định dạng JSONL.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from scipy.stats import pearsonr, spearmanr
from sklearn.metrics import cohen_kappa_score, mean_absolute_error, root_mean_squared_error

# 4 tiêu chí chấm điểm thành phần chuẩn của IELTS Writing
SUBCRITERIA_KEYS = (
    "task_response",
    "coherence_cohesion",
    "lexical_resource",
    "grammatical_range",
)

# Danh sách 17 lớp rời rạc phục vụ tính QWK: 1.0, 1.5, ..., 9.0 -> 0..16
BAND_CLASSES = list(range(17))


def round_to_half_band(values: np.ndarray | Iterable[float] | float) -> np.ndarray | float:
    """Giới hạn điểm trong [1.0, 9.0] và làm tròn nửa lên (half-up) về bội số 0.5 gần nhất."""
    scalar = np.ndim(values) == 0
    arr = np.asarray(values, dtype=np.float64)
    clipped = np.clip(arr, 1.0, 9.0)
    # Nhân 2, cộng 0.5 rồi lấy floor để làm tròn half-up theo bước 0.5
    rounded = np.floor(clipped * 2.0 + 0.5) / 2.0
    rounded = np.clip(rounded, 1.0, 9.0)
    if scalar:
        return float(rounded.item())
    return rounded


def band_to_class(values: np.ndarray | Iterable[float]) -> np.ndarray:
    """Ánh xạ điểm band IELTS trong [1.0, 9.0] (bước nhảy 0.5) sang nhãn lớp nguyên 0..16."""
    rounded = np.asarray(round_to_half_band(values), dtype=np.float64)
    classes = np.rint((rounded - 1.0) * 2.0).astype(np.int64)
    return np.clip(classes, 0, 16)


def _safe_corr(fn: Any, y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Tính hệ số tương quan an toàn, trả về 0.0 nếu mảng quá ngắn hoặc phương sai bằng 0."""
    if len(y_true) < 2 or np.std(y_true) < 1e-12 or np.std(y_pred) < 1e-12:
        return 0.0
    res = fn(y_true, y_pred)
    val = float(res.statistic if hasattr(res, "statistic") else res[0])
    return 0.0 if math.isnan(val) else val


def compute_metrics(y_true: Iterable[float], y_pred: Iterable[float]) -> dict[str, float | int]:
    """Tính toán đầy đủ các chỉ số hồi quy (MAE, RMSE, tương quan) và độ đồng thuận band IELTS (QWK, Exact, Within 0.5/1.0)."""
    yt = np.asarray(list(y_true), dtype=np.float64)
    yp_raw = np.clip(np.asarray(list(y_pred), dtype=np.float64), 1.0, 9.0)
    if len(yt) == 0:
        return {
            "n": 0,
            "mae": 0.0,
            "rmse": 0.0,
            "rounded_mae": 0.0,
            "rounded_rmse": 0.0,
            "pearson": 0.0,
            "spearman": 0.0,
            "qwk": 0.0,
            "exact_match_pct": 0.0,
            "within_0_5_pct": 0.0,
            "within_1_0_pct": 0.0,
        }

    # Làm tròn nhãn thật và giá trị dự đoán về bước 0.5 trước khi tính QWK và sai lệch rời rạc
    yt_round = np.asarray(round_to_half_band(yt), dtype=np.float64)
    yp_round = np.asarray(round_to_half_band(yp_raw), dtype=np.float64)

    yt_cls = band_to_class(yt_round)
    yp_cls = band_to_class(yp_round)
    # Tránh lỗi chia cho 0 trong cohen_kappa_score khi toàn bộ mẫu chỉ rơi vào 1 lớp duy nhất
    if len(np.unique(yt_cls)) == 1 and len(np.unique(yp_cls)) == 1:
        qwk = 1.0 if yt_cls[0] == yp_cls[0] else 0.0
    else:
        qwk = float(cohen_kappa_score(yt_cls, yp_cls, labels=BAND_CLASSES, weights="quadratic"))
        if math.isnan(qwk):
            qwk = 0.0

    abs_diff_round = np.abs(yp_round - yt_round)
    return {
        "n": int(len(yt)),
        "mae": round(float(mean_absolute_error(yt, yp_raw)), 4),
        "rmse": round(float(root_mean_squared_error(yt, yp_raw)), 4),
        "rounded_mae": round(float(mean_absolute_error(yt_round, yp_round)), 4),
        "rounded_rmse": round(float(root_mean_squared_error(yt_round, yp_round)), 4),
        "pearson": round(_safe_corr(pearsonr, yt, yp_raw), 4),
        "spearman": round(_safe_corr(spearmanr, yt, yp_raw), 4),
        "qwk": round(qwk, 4),
        "exact_match_pct": round(float(np.mean(abs_diff_round < 1e-6) * 100.0), 2),
        "within_0_5_pct": round(float(np.mean(abs_diff_round <= 0.5 + 1e-6) * 100.0), 2),
        "within_1_0_pct": round(float(np.mean(abs_diff_round <= 1.0 + 1e-6) * 100.0), 2),
    }


def load_jsonl(path: str | Path) -> list[dict[str, Any]]:
    """Đọc danh sách bản ghi JSON từ tệp JSONL (mỗi dòng một đối tượng JSON)."""
    records: list[dict[str, Any]] = []
    with Path(path).open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def evaluate_predictions(
    records: list[dict[str, Any]],
    predictions: list[dict[str, Any]],
) -> dict[str, Any]:
    """Tính chỉ số đánh giá tổng thể (overall), tách theo nguồn dữ liệu (by_source) và theo từng tiêu chí con (subcriteria)."""
    y_true_all: list[float] = []
    y_pred_all: list[float] = []
    by_source: dict[str, tuple[list[float], list[float]]] = {}

    # Gom cặp điểm thật và điểm dự đoán thô (ưu tiên overall_band_raw để đánh giá chính xác MAE/RMSE liên tục)
    for rec, pred in zip(records, predictions):
        yt = rec.get("overall_band")
        yp = pred.get("overall_band_raw", pred.get("overall_band"))
        if yt is None or yp is None:
            continue
        yt_f = float(yt)
        yp_f = float(yp)
        y_true_all.append(yt_f)
        y_pred_all.append(yp_f)
        src = str(rec.get("source") or "unknown")
        if src not in by_source:
            by_source[src] = ([], [])
        by_source[src][0].append(yt_f)
        by_source[src][1].append(yp_f)

    result: dict[str, Any] = {
        "overall": compute_metrics(y_true_all, y_pred_all),
        "by_source": {
            src: compute_metrics(vals[0], vals[1]) for src, vals in sorted(by_source.items())
        },
        "subcriteria": {},
    }

    # Đánh giá riêng cho 4 tiêu chí thành phần (TR, CC, LR, GRA) trên các bản ghi có nhãn
    for key in SUBCRITERIA_KEYS:
        yt_sub: list[float] = []
        yp_sub: list[float] = []
        for rec, pred in zip(records, predictions):
            yt = rec.get(key)
            yp = pred.get(f"{key}_raw", pred.get(key))
            if yt is None or yp is None:
                continue
            yt_sub.append(float(yt))
            yp_sub.append(float(yp))
        if yt_sub:
            result["subcriteria"][key] = compute_metrics(yt_sub, yp_sub)

    return result


def _format_metrics_row(label: str, m: dict[str, Any]) -> str:
    """Định dạng một dòng bảng tóm tắt các chỉ số đánh giá để in ra terminal."""
    return (
        f"{label:<22} | n={m['n']:<5} | MAE={m['mae']:.4f} | RMSE={m['rmse']:.4f} | "
        f"Pearson={m['pearson']:.4f} | Spearman={m['spearman']:.4f} | QWK={m['qwk']:.4f} | "
        f"Exact={m['exact_match_pct']:.2f}% | Within0.5={m['within_0_5_pct']:.2f}%"
    )


def print_evaluation_summary(split_name: str, report: dict[str, Any]) -> None:
    """In báo cáo đánh giá tổng thể, theo nguồn và theo 4 tiêu chí thành phần ra màn hình."""
    print(f"\n=== Evaluation [{split_name}] ===")
    print(_format_metrics_row("overall", report["overall"]))
    for src, m in report.get("by_source", {}).items():
        print(_format_metrics_row(f"  source:{src}", m))
    for key, m in report.get("subcriteria", {}).items():
        print(_format_metrics_row(f"  sub:{key}", m))


def _resolve_default_paths() -> tuple[Path, Path]:
    """Xác định đường dẫn mặc định tới thư mục data/ và models/ tương đối theo vị trí tệp hiện tại."""
    base_dir = Path(__file__).resolve().parent
    return base_dir / "data", base_dir / "models"


def main() -> None:
    """Điểm vào CLI cho phép đánh giá mô hình baseline/transformer/hybrid/best trên tập val/test."""
    data_dir, models_dir = _resolve_default_paths()

    parser = argparse.ArgumentParser(description="Evaluate IELTS Writing Task 2 models.")
    parser.add_argument(
        "--model-type",
        choices=["best", "baseline", "transformer", "hybrid", "all"],
        default="best",
        help="Which model artifact to evaluate (default: best).",
    )
    parser.add_argument(
        "--model-dir",
        type=str,
        default=str(models_dir),
        help="Root models directory containing baseline/, transformer/, and best_manifest.json.",
    )
    parser.add_argument(
        "--split",
        choices=["val", "test", "both"],
        default="both",
        help="Which dataset split(s) to evaluate when --data is not specified.",
    )
    parser.add_argument(
        "--data",
        type=str,
        default=None,
        help="Optional explicit path to a JSONL file to evaluate.",
    )
    parser.add_argument(
        "--preds",
        type=str,
        default=None,
        help="Optional pre-computed predictions JSONL file (must align with --data).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Batch size for transformer inference.",
    )
    parser.add_argument(
        "--json-out",
        type=str,
        default=None,
        help="Optional output JSON path for the full evaluation report.",
    )
    args = parser.parse_args()

    # Xác định các tập dữ liệu cần đánh giá (từ --data hoặc mặc định val.jsonl / test.jsonl)
    split_paths: dict[str, Path] = {}
    if args.data:
        p = Path(args.data)
        split_paths[p.stem] = p
    else:
        if args.split in ("val", "both"):
            split_paths["val"] = data_dir / "val.jsonl"
        if args.split in ("test", "both"):
            split_paths["test"] = data_dir / "test.jsonl"

    for name, path in split_paths.items():
        if not path.exists():
            raise FileNotFoundError(f"Split '{name}' not found at: {path}")

    loaded_splits = {name: load_jsonl(path) for name, path in split_paths.items()}

    # Nhánh 1: Đánh giá trực tiếp từ tệp dự đoán đã tính sẵn (--preds)
    if args.preds:
        preds_records = load_jsonl(args.preds)
        if len(loaded_splits) != 1:
            raise ValueError("--preds requires a single split via --data or --split val/test.")
        split_name, recs = next(iter(loaded_splits.items()))
        if len(preds_records) != len(recs):
            raise ValueError(
                f"Prediction count ({len(preds_records)}) != dataset count ({len(recs)})."
            )
        report = {split_name: evaluate_predictions(recs, preds_records)}
        print_evaluation_summary(split_name, report[split_name])
        if args.json_out:
            Path(args.json_out).write_text(json.dumps(report, indent=2), encoding="utf-8")
        return

    # Import lười (lazy import) WritingScorer để tránh vòng lặp import trong lúc huấn luyện
    from infer import WritingScorer

    root_models = Path(args.model_dir)
    # Nhánh 2: Khi chọn --model-type all, tự động quét toàn bộ mô hình đã huấn luyện hiện có
    if args.model_type == "all":
        candidate_types = []
        if (root_models / "baseline" / "baseline_bundle.joblib").exists():
            candidate_types.append("baseline")
        if (root_models / "transformer" / "model_meta.json").exists():
            candidate_types.append("transformer")
        if (root_models / "best_manifest.json").exists():
            manifest = json.loads((root_models / "best_manifest.json").read_text(encoding="utf-8"))
            if manifest.get("selected_model") == "hybrid":
                candidate_types.append("hybrid")
        if not candidate_types:
            raise FileNotFoundError(f"No trained models found under {root_models}")
    else:
        candidate_types = [args.model_type]

    # Chạy suy luận hàng loạt (tắt feedback để đánh giá nhanh) rồi tổng hợp chỉ số cho từng mô hình
    full_report: dict[str, Any] = {}
    for mtype in candidate_types:
        scorer = WritingScorer(model_dir=root_models, model_type=mtype)
        model_report: dict[str, Any] = {"resolved_model_type": scorer.active_model_type}
        print(f"\n>>> Model: {mtype} (resolved={scorer.active_model_type})")
        for split_name, recs in loaded_splits.items():
            preds = scorer.predict_batch(recs, batch_size=args.batch_size, include_feedback=False)
            split_rep = evaluate_predictions(recs, preds)
            model_report[split_name] = split_rep
            print_evaluation_summary(f"{mtype}/{split_name}", split_rep)
        full_report[mtype] = model_report

    print("\n--- JSON SUMMARY ---")
    print(json.dumps(full_report, indent=2))

    if args.json_out:
        out_path = Path(args.json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(full_report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
