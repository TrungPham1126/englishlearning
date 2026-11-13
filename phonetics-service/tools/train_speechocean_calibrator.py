"""
Train empirical speaker-disjoint scoring calibrators strictly on SpeechOcean762/train
features (cache/so_train_feats.jsonl) using GroupKFold(speaker) cross-validation
and save lightweight linear + piecewise-monotonic parameters to:
    reference_profiles/calibration.json

Never touches SpeechOcean762/test or held-out LibriSpeech speakers during fitting.
Uses scikit-learn offline only; production runtime requires only numpy + np.interp.
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import GroupKFold

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.dataset_utils import compute_regression_metrics  # noqa: E402

# Curated domain feature sets aligned strictly with online scorer.py availability:
# Note: fluency & prosody MUST only depend on features present in `utt_features`
# before calibration (since calculate_fluency_score / calculate_prosody_score receive `utt_features`).
FLUENCY_FEATURES = [
    "wpm",
    "wpm_opt",
    "articulation_rate",
    "art_rate_opt",
    "speech_ratio",
    "pause_ratio",
    "awkward_pause_ratio",
    "hesitation_ratio",
    "mean_inter_word_gap",
    "gap_std",
    "mean_run_length_norm",
    "linking_ratio",
    "duration_cv",
    "blank_ratio",
    "align_confidence",
    "whole_file_sim",
    "completeness_ratio",
    "mean_gop_margin",
    "p15_gop_margin",
    "neg_gop_ratio",
    "voiced_frame_ratio",
]

PROSODY_FEATURES = [
    "f0_rel_std",
    "f0_iqr_norm",
    "f0_range_norm",
    "f0_slope_norm",
    "voiced_frame_ratio",
    "stress_dur_contrast",
    "stress_rms_contrast",
    "stress_f0_contrast",
    "wpm",
    "articulation_rate",
    "pause_ratio",
    "hesitation_ratio",
    "linking_ratio",
    "duration_cv",
    "mean_run_length_norm",
    "align_confidence",
    "whole_file_sim",
    "mean_gop_margin",
    "p15_gop_margin",
    "mean_phoneme_score",
    "p25_phoneme_score",
]

PRONUNCIATION_FEATURES = [
    "raw_pronunciation",
    "mean_phoneme_score",
    "p10_phoneme_score",
    "p25_phoneme_score",
    "std_phoneme_score",
    "mean_vowel_score",
    "mean_cons_score",
    "mean_formant_score",
    "mean_word_score",
    "min_word_score",
    "p20_word_score",
    "failed_word_ratio",
    "mean_canon_post",
    "p15_canon_post",
    "mean_gop_margin",
    "p15_gop_margin",
    "neg_gop_ratio",
    "bad_gop_ratio",
    "align_confidence",
    "whole_file_sim",
    "blank_ratio",
    "stress_dur_contrast",
]

OVERALL_BASE_FEATURES = [
    "cal_pronunciation",
    "cal_fluency",
    "cal_prosody",
    "raw_pronunciation",
    "completeness_ratio",
    "whole_file_sim",
    "align_confidence",
    "failed_word_ratio",
    "p15_gop_margin",
    "hesitation_ratio",
    "f0_rel_std",
]


def _load_jsonl(path: Path) -> List[dict]:
    rows: List[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _build_matrix(records: Sequence[dict], feat_names: Sequence[str], extra_list: Optional[Sequence[dict]] = None) -> np.ndarray:
    X = np.zeros((len(records), len(feat_names)), dtype=np.float64)
    for i, rec in enumerate(records):
        feats = rec.get("utt_features", {})
        ext = extra_list[i] if extra_list is not None else {}
        for j, name in enumerate(feat_names):
            val = ext[name] if name in ext else feats.get(name, 0.0)
            if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
                val = 0.0
            X[i, j] = float(val)
    return X


def _extract_isotonic_knots(
    z: np.ndarray,
    y: np.ndarray,
    max_knots: int = 24,
    upper_target_cap: float = 98.5,
) -> Tuple[List[float], List[float]]:
    iso = IsotonicRegression(y_min=20.0, y_max=99.0, increasing=True, out_of_bounds="clip")
    iso.fit(z, y)

    # Sample evenly across observed z range + gentle upper linear tail for native extrapolation
    z_min, z_max = float(np.percentile(z, 0.5)), float(np.percentile(z, 99.5))
    grid = np.linspace(z_min, z_max, max_knots)
    preds = iso.predict(grid)

    x_knots: List[float] = []
    y_knots: List[float] = []
    for gx, gy in zip(grid, preds):
        rx = round(float(gx), 4)
        ry = round(float(gy), 3)
        if x_knots and rx <= x_knots[-1] + 1e-6:
            continue
        x_knots.append(rx)
        y_knots.append(ry)

    # Allow clean high-proficiency speakers slightly above SpeechOcean children ceiling to score up cleanly
    if len(x_knots) >= 2 and y_knots[-1] < upper_target_cap and x_knots[-1] < upper_target_cap:
        x_ext = max(x_knots[-1] + 8.0, upper_target_cap + 6.0)
        y_ext = round(min(upper_target_cap, max(y_knots[-1] + 2.0, min(97.5, x_ext * 0.96))), 3)
        x_knots.append(round(float(x_ext), 4))
        y_knots.append(float(y_ext))

    return x_knots, y_knots


def _fit_component_cv(
    X: np.ndarray,
    y: np.ndarray,
    groups: np.ndarray,
    feat_names: Sequence[str],
    name: str,
    use_isotonic: bool = True,
) -> Tuple[dict, np.ndarray, Dict[str, float]]:
    alphas = np.logspace(-1, 4, 24)
    gkf = GroupKFold(n_splits=5)

    oof_linear = np.zeros_like(y, dtype=np.float64)
    oof_cal = np.zeros_like(y, dtype=np.float64)

    for tr_idx, va_idx in gkf.split(X, y, groups):
        mu = np.mean(X[tr_idx], axis=0)
        sd = np.where(np.std(X[tr_idx], axis=0) > 1e-8, np.std(X[tr_idx], axis=0), 1.0)
        X_tr = (X[tr_idx] - mu) / sd
        X_va = (X[va_idx] - mu) / sd

        model = RidgeCV(alphas=alphas)
        model.fit(X_tr, y[tr_idx])
        z_tr = model.predict(X_tr)
        z_va = model.predict(X_va)
        oof_linear[va_idx] = z_va

        if use_isotonic:
            xk, yk = _extract_isotonic_knots(z_tr, y[tr_idx])
            oof_cal[va_idx] = np.interp(z_va, np.asarray(xk), np.asarray(yk))
        else:
            oof_cal[va_idx] = z_va

    # Compare linear vs isotonic OOF MAE/r; keep isotonic ONLY if it improves MAE without hurting Spearman
    m_lin = compute_regression_metrics(y, np.clip(oof_linear, 20.0, 100.0))
    m_iso = compute_regression_metrics(y, np.clip(oof_cal, 20.0, 100.0))

    keep_iso = use_isotonic and (m_iso["mae"] <= m_lin["mae"] + 0.15) and (m_iso["r"] >= m_lin["r"] - 0.015)

    # Final refit on all 125 train speakers
    mu_all = np.mean(X, axis=0)
    sd_all = np.where(np.std(X, axis=0) > 1e-8, np.std(X, axis=0), 1.0)
    X_std_all = (X - mu_all) / sd_all
    final_model = RidgeCV(alphas=alphas)
    final_model.fit(X_std_all, y)
    z_all = final_model.predict(X_std_all)

    model_dict = {
        "features": list(feat_names),
        "means": [round(float(v), 6) for v in mu_all],
        "stds": [round(float(v), 6) for v in sd_all],
        "weights": [round(float(v), 6) for v in final_model.coef_],
        "intercept": round(float(final_model.intercept_), 6),
        "alpha": round(float(final_model.alpha_), 4),
        "min_score": 25.0,
        "max_score": 99.0,
    }
    if keep_iso:
        xk, yk = _extract_isotonic_knots(z_all, y)
        model_dict["x_knots"] = xk
        model_dict["y_knots"] = yk
        oof_final = np.clip(oof_cal, 25.0, 99.0)
        chosen_metrics = m_iso
        mode_used = "ridge+isotonic"
    else:
        oof_final = np.clip(oof_linear, 25.0, 99.0)
        chosen_metrics = m_lin
        mode_used = "ridge_linear"

    print(
        f"  [{name:<13}] alpha={model_dict['alpha']:<8} mode={mode_used:<15} | "
        f"OOF r={chosen_metrics['r']:.3f} rho={chosen_metrics['rho']:.3f} "
        f"MAE={chosen_metrics['mae']:.2f} RMSE={chosen_metrics['rmse']:.2f} "
        f"(pred={chosen_metrics['mean_pred']:.1f}+/-{chosen_metrics['std_pred']:.1f} "
        f"vs true={chosen_metrics['mean_true']:.1f}+/-{chosen_metrics['std_true']:.1f})",
        flush=True,
    )
    return model_dict, oof_final, chosen_metrics


def _predict_dict(model_dict: dict, feats: dict) -> float:
    z = float(model_dict["intercept"])
    for name, mu, sd, w in zip(
        model_dict["features"], model_dict["means"], model_dict["stds"], model_dict["weights"]
    ):
        val = float(feats.get(name, mu))
        if np.isnan(val) or np.isinf(val):
            val = float(mu)
        z += float(w) * ((val - float(mu)) / (float(sd) if float(sd) > 1e-8 else 1.0))
    if "x_knots" in model_dict and "y_knots" in model_dict:
        pred = float(np.interp(z, np.asarray(model_dict["x_knots"]), np.asarray(model_dict["y_knots"])))
    else:
        pred = z
    return round(float(np.clip(pred, model_dict["min_score"], model_dict["max_score"])), 1)


def _load_many_jsonl(paths: Sequence[Path], prefix_split: bool = True) -> List[dict]:
    rows: List[dict] = []
    for p in paths:
        if not Path(p).exists():
            continue
        p_rows = _load_jsonl(Path(p))
        for r in p_rows:
            if prefix_split and "speaker" in r:
                # Guarantee speaker ID uniqueness across datasets if needed (SpeechOcean speakers are distinct across splits)
                pass
            rows.append(r)
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--train-jsonl",
        type=Path,
        nargs="+",
        default=[ROOT / "cache" / "so_train_feats.jsonl"],
    )
    parser.add_argument(
        "--ls-anchors",
        type=Path,
        nargs="+",
        default=[ROOT / "cache" / "ls_train_anchors.jsonl"],
    )
    parser.add_argument("--out", type=Path, default=ROOT / "reference_profiles" / "calibration.json")
    parser.add_argument("--version", type=str, default="1.1.0")
    parser.add_argument(
        "--license-note",
        type=str,
        default="Apache-2.0 (SpeechOcean762 empirical calibration)",
    )
    args = parser.parse_args()

    records = _load_many_jsonl(args.train_jsonl)
    # Exclude rejected mismatches if any (keep valid complete assessments for acoustic regression)
    valid = [r for r in records if r.get("utt_features") and not r.get("rejected_mismatch")]
    src_desc = ", ".join(p.name for p in args.train_jsonl)
    print(
        f"Loaded {len(valid)}/{len(records)} SpeechOcean utterances from [{src_desc}] "
        f"across {len({r['speaker'] for r in valid})} speakers.",
        flush=True,
    )

    groups = np.asarray([str(r["speaker"]) for r in valid])
    y_pron = np.asarray([float(r["human"]["accuracy"]) for r in valid], dtype=np.float64)
    y_flu = np.asarray([float(r["human"]["fluency"]) for r in valid], dtype=np.float64)
    y_pro = np.asarray([float(r["human"]["prosodic"]) for r in valid], dtype=np.float64)
    y_tot = np.asarray([float(r["human"]["total"]) for r in valid], dtype=np.float64)

    # Report raw uncalibrated correlations on train split first
    print("\n--- Uncalibrated OOF/Raw on SpeechOcean762 ---", flush=True)
    for raw_k, y_gt, lbl in [
        ("overall", y_tot, "Raw Overall"),
        ("pronunciation", y_pron, "Raw Pron"),
        ("fluency", y_flu, "Raw Fluency"),
        ("prosody", y_pro, "Raw Prosody"),
    ]:
        raw_arr = np.asarray([float(r["raw_scores"][raw_k]) for r in valid], dtype=np.float64)
        m = compute_regression_metrics(y_gt, raw_arr)
        print(
            f"  {lbl:<14}: r={m['r']:.3f} rho={m['rho']:.3f} MAE={m['mae']:.2f} RMSE={m['rmse']:.2f} "
            f"(pred={m['mean_pred']:.1f}+/-{m['std_pred']:.1f})",
            flush=True,
        )

    print("\n--- Fitting 5-Fold GroupKFold(speaker) Calibrators ---", flush=True)
    X_flu = _build_matrix(valid, FLUENCY_FEATURES)
    X_pro = _build_matrix(valid, PROSODY_FEATURES)
    X_pron = _build_matrix(valid, PRONUNCIATION_FEATURES)

    m_flu, oof_flu, cv_flu = _fit_component_cv(X_flu, y_flu, groups, FLUENCY_FEATURES, "fluency")
    m_pro, oof_pro, cv_pro = _fit_component_cv(X_pro, y_pro, groups, PROSODY_FEATURES, "prosody")
    m_pron, oof_pron, cv_pron = _fit_component_cv(X_pron, y_pron, groups, PRONUNCIATION_FEATURES, "pronunciation")

    # Fit overall strictly on honest OUT-OF-FOLD component predictions to prevent target leakage
    extra_overall = [
        {
            "cal_pronunciation": float(oof_pron[i]),
            "cal_fluency": float(oof_flu[i]),
            "cal_prosody": float(oof_pro[i]),
        }
        for i in range(len(valid))
    ]
    X_tot = _build_matrix(valid, OVERALL_BASE_FEATURES, extra_list=extra_overall)
    m_tot, oof_tot, cv_tot = _fit_component_cv(X_tot, y_tot, groups, OVERALL_BASE_FEATURES, "overall")

    # Check native LibriSpeech anchors to ensure adult native speech scores well above pass threshold 80
    ls_anchor_stats = {}
    ls_rows = _load_many_jsonl(args.ls_anchors)
    if ls_rows:
        ls_cal_overall = []
        ls_cal_pron = []
        ls_raw_overall = []
        for lr in ls_rows:
            feats = dict(lr.get("utt_features", {}))
            if not feats:
                continue
            p_c = _predict_dict(m_pron, feats)
            f_c = _predict_dict(m_flu, feats)
            r_c = _predict_dict(m_pro, feats)
            feats_o = dict(feats)
            feats_o["cal_pronunciation"] = p_c
            feats_o["cal_fluency"] = f_c
            feats_o["cal_prosody"] = r_c
            o_c = _predict_dict(m_tot, feats_o)
            ls_cal_pron.append(p_c)
            ls_cal_overall.append(o_c)
            ls_raw_overall.append(float(lr["raw_scores"]["overall"]))
        if ls_cal_overall:
            arr_o = np.asarray(ls_cal_overall)
            arr_p = np.asarray(ls_cal_pron)
            pass_80 = float(np.mean((arr_o >= 80.0) & (arr_p >= 75.0)) * 100.0)
            ls_anchor_stats = {
                "n": int(len(arr_o)),
                "raw_overall_mean": round(float(np.mean(ls_raw_overall)), 2),
                "cal_overall_mean": round(float(np.mean(arr_o)), 2),
                "cal_overall_std": round(float(np.std(arr_o)), 2),
                "cal_pron_mean": round(float(np.mean(arr_p)), 2),
                "pass_rate_pct_at_80": round(pass_80, 1),
            }
            print(f"\nLibriSpeech native anchors check: {ls_anchor_stats}", flush=True)

    artifact = {
        "metadata": {
            "version": args.version,
            "license": args.license_note,
            "train_sources": [p.name for p in args.train_jsonl],
            "train_utterances": int(len(valid)),
            "train_speakers": int(len(set(groups.tolist()))),
            "cv_strategy": "GroupKFold(n_splits=5, group=speaker)",
            "cv_metrics": {
                "pronunciation": cv_pron,
                "fluency": cv_flu,
                "prosody": cv_pro,
                "overall": cv_tot,
            },
            "librispeech_train_anchor_check": ls_anchor_stats,
        },
        "thresholds": {
            "pass_overall": 80.0,
            "pass_pronunciation": 75.0,
            "pass_completeness": 80.0,
        },
        "models": {
            "pronunciation": m_pron,
            "fluency": m_flu,
            "prosody": m_pro,
            "overall": m_tot,
        },
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(artifact, f, ensure_ascii=False, indent=2)
    print(f"\nSaved calibration profile -> {args.out}", flush=True)


if __name__ == "__main__":
    main()
