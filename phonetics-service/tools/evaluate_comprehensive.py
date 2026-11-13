"""
Comprehensive Before-vs-After Benchmark Suite for phonetics-service:
  1. Unseen SpeechOcean762/test held-out speakers (utterance r/rho/MAE/RMSE, word-level, phoneme ROC-AUC & F1)
  2. Unseen LibriSpeech clean/validation held-out 8 native speakers (scores, pass rate @ 80, latency ms/utt)
  3. Targeted linguistic & bug-fix probes (mid-sentence skip non-cascading, off-script multi-word rejection)

Writes full results to cache/comprehensive_eval_report.json.
"""
import argparse
import concurrent.futures
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
from fastapi.testclient import TestClient
from sklearn.metrics import average_precision_score, f1_score, roc_auc_score
import scipy.stats as stats

logging.getLogger("phonetics-service").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.ERROR)

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.api.routes import _diagnostics_sink  # noqa: E402
from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services.formant_service import formant_service  # noqa: E402
from app.services.scorer import ScoringCalibrator, scorer  # noqa: E402
from tools.dataset_utils import (  # noqa: E402
    LIBRISPEECH_VAL,
    SPEECHOCEAN_TEST,
    compute_regression_metrics,
    decode_parquet_audio,
    load_parquet_rows,
    numpy_to_wav_bytes,
)

_EVAL_WORKER_CTX: Dict[str, Any] = {}


def _init_eval_worker(torch_threads: int) -> None:
    os.environ["OMP_NUM_THREADS"] = str(torch_threads)
    os.environ["MKL_NUM_THREADS"] = str(torch_threads)
    import torch

    torch.set_num_threads(max(1, int(torch_threads)))
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    logging.getLogger("phonetics-service").setLevel(logging.ERROR)
    logging.getLogger("httpx").setLevel(logging.ERROR)

    from fastapi.testclient import TestClient
    from app.config import settings as w_settings
    from app.main import app as w_app
    from app.services.aligner import forced_aligner
    from app.services.formant_service import formant_service as w_fs
    from app.services.scorer import ScoringCalibrator as w_SC, scorer as w_scorer

    w_fs._load_profiles_from_disk(w_settings.VOWEL_PROFILE_PATH)
    w_scorer.calibrator = w_SC()
    forced_aligner.model_mgr.load_model()
    _EVAL_WORKER_CTX["client"] = TestClient(w_app)


def _eval_worker_so(item: Tuple[dict, dict]) -> Dict[str, Any]:
    rec, row = item
    client = _EVAL_WORKER_CTX["client"]
    idx = int(rec["idx"])
    script = row["text"]
    audio_16k = decode_parquet_audio(row["audio"], target_sr=16000)
    wav_bytes = numpy_to_wav_bytes(audio_16k, 16000)

    res = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": (f"eval_so_{idx}.wav", wav_bytes, "audio/wav")},
        data={"script": script},
    )
    if res.status_code != 200:
        return {"ok": False}
    body = res.json()
    kpi = body.get("kpi", {})
    w_pairs = []
    pred_words = body.get("words", [])
    gt_words = row.get("words", [])
    if len(pred_words) == len(gt_words):
        for pw, gw in zip(pred_words, gt_words):
            if pw.get("score") is not None:
                w_pairs.append((float(gw["accuracy"]) * 10.0, float(pw["score"])))

    return {
        "ok": True,
        "rejected": body.get("evaluationStatus") == "REJECTED_MISMATCH",
        "record": {
            "idx": idx,
            "human_tot": float(row["total"]) * 10.0,
            "human_acc": float(row["accuracy"]) * 10.0,
            "human_flu": float(row["fluency"]) * 10.0,
            "human_pro": float(row["prosodic"]) * 10.0,
            "pred_overall": float(body.get("overallScore", 0.0)),
            "pred_pron": float(body.get("pronunciationScore", 0.0)),
            "pred_flu": float(body.get("fluencyScore", 0.0)),
            "pred_pro": float(kpi.get("prosody", 0.0)),
            "pred_speed": float(body.get("speedScore", 0.0)),
            "raw_overall": float(rec["raw_scores"]["overall"]),
            "raw_pron": float(rec["raw_scores"]["pronunciation"]),
            "raw_flu": float(rec["raw_scores"]["fluency"]),
            "raw_pro": float(rec["raw_scores"]["prosody"]),
        },
        "word_pairs": w_pairs,
    }


def _eval_worker_ls(item: Tuple[int, dict]) -> Dict[str, Any]:
    idx, row = item
    client = _EVAL_WORKER_CTX["client"]
    audio_16k = decode_parquet_audio(row["audio"], target_sr=16000)
    wav_bytes = numpy_to_wav_bytes(audio_16k, 16000)
    res = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": (f"eval_ls_{idx}.wav", wav_bytes, "audio/wav")},
        data={"script": row["text"]},
    )
    if res.status_code != 200:
        return {"ok": False}
    body = res.json()
    return {
        "ok": True,
        "overall": float(body["overallScore"]),
        "pron": float(body["pronunciationScore"]),
        "flu": float(body["fluencyScore"]),
        "prosody": float(body["kpi"]["prosody"]),
        "speed": float(body["speedScore"]),
        "comp": float(body["kpi"]["completeness"]),
        "passed": bool(body["isPassed"]),
    }


def _load_jsonl(path: Path) -> List[dict]:
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def _eval_phoneme_discrimination(so_test_feats: List[dict]) -> Dict[str, Any]:
    phones = [p for r in so_test_feats for p in r.get("phone_pairs", [])]
    if len(phones) < 20:
        return {"n": len(phones), "note": "insufficient aligned phone pairs"}

    y_acc = np.asarray([float(p["human_acc"]) for p in phones], dtype=np.float64)
    # Mispronounced in SpeechOcean762 is typically human phone accuracy < 1.5 (0 or 1 on 0..2 scale)
    y_good = (y_acc >= 1.5).astype(int)
    y_bad = 1 - y_good

    scores = np.asarray([float(p["score"]) for p in phones], dtype=np.float64)
    canons = np.asarray([float(p.get("canon_posterior", p.get("posterior", 0.5))) for p in phones], dtype=np.float64)
    posts = np.asarray([float(p.get("posterior", 0.5)) for p in phones], dtype=np.float64)
    margins = np.asarray([float(p.get("gop_margin") if p.get("gop_margin") is not None else 0.0) for p in phones], dtype=np.float64)

    rho_score, _ = stats.spearmanr(y_acc, scores)
    rho_margin, _ = stats.spearmanr(y_acc, margins)
    rho_canon, _ = stats.spearmanr(y_acc, canons)
    rho_pooled, _ = stats.spearmanr(y_acc, posts)

    res: Dict[str, Any] = {
        "n_phones": int(len(phones)),
        "n_mispronounced": int(np.sum(y_bad)),
        "spearman_score_vs_human": round(float(rho_score), 4),
        "spearman_gop_margin_vs_human": round(float(rho_margin), 4),
        "spearman_canon_post_vs_human": round(float(rho_canon), 4),
        "spearman_pooled_post_vs_human": round(float(rho_pooled), 4),
    }
    if 5 <= int(np.sum(y_bad)) < len(phones):
        res["roc_auc_score"] = round(float(roc_auc_score(y_good, scores)), 4)
        res["roc_auc_gop_margin"] = round(float(roc_auc_score(y_good, margins)), 4)
        res["roc_auc_canon_post"] = round(float(roc_auc_score(y_good, canons)), 4)
        res["roc_auc_pooled_post"] = round(float(roc_auc_score(y_good, posts)), 4)
        res["pr_auc_mispron_score"] = round(float(average_precision_score(y_bad, 100.0 - scores)), 4)
        best_f1 = 0.0
        best_th = 60.0
        for th in range(30, 86, 5):
            pred_bad = (scores < float(th)).astype(int)
            f1 = float(f1_score(y_bad, pred_bad, zero_division=0))
            if f1 > best_f1:
                best_f1 = f1
                best_th = float(th)
        res["best_mispron_f1"] = round(best_f1, 4)
        res["best_mispron_threshold"] = best_th
    return res


def _run_live_so_test(
    client: TestClient,
    so_test_feats: List[dict],
    workers: int = 1,
    torch_threads: int = 2,
    fast_from_cache: bool = False,
) -> Dict[str, Any]:
    t0 = time.time()
    records = []
    word_pairs = []
    rejected_count = 0
    errors = 0

    if fast_from_cache:
        for rec in so_test_feats:
            feats = dict(rec.get("utt_features", {}))
            if not feats:
                errors += 1
                continue
            comp = float(rec["raw_scores"].get("completeness", 100.0))
            cal = scorer.calibrate_utterance_scores(
                raw_pronunciation=float(rec["raw_scores"]["pronunciation"]),
                raw_fluency=float(rec["raw_scores"]["fluency"]),
                raw_prosody=float(rec["raw_scores"]["prosody"]),
                completeness=comp,
                features=feats,
            )
            if cal["pronunciation"] < 55.0:
                cal["overall"] = min(cal["overall"], round(cal["pronunciation"] + 10.0, 1))
            if rec.get("rejected_mismatch"):
                rejected_count += 1
            records.append({
                "idx": int(rec["idx"]),
                "human_tot": float(rec["human"]["total"]),
                "human_acc": float(rec["human"]["accuracy"]),
                "human_flu": float(rec["human"]["fluency"]),
                "human_pro": float(rec["human"]["prosodic"]),
                "pred_overall": float(cal["overall"]),
                "pred_pron": float(cal["pronunciation"]),
                "pred_flu": float(cal["fluency"]),
                "pred_pro": float(cal["prosody"]),
                "pred_speed": float(rec["raw_scores"].get("speed", 0.0)),
                "raw_overall": float(rec["raw_scores"]["overall"]),
                "raw_pron": float(rec["raw_scores"]["pronunciation"]),
                "raw_flu": float(rec["raw_scores"]["fluency"]),
                "raw_pro": float(rec["raw_scores"]["prosody"]),
            })
            for wp in rec.get("word_pairs", []):
                word_pairs.append((float(wp["human_acc"]), float(wp["pred_score"])))
    else:
        raw_rows = load_parquet_rows(SPEECHOCEAN_TEST)
        items = [(rec, raw_rows[int(rec["idx"])]) for rec in so_test_feats]

        def _consume(out: Dict[str, Any]) -> None:
            nonlocal rejected_count, errors
            if not out.get("ok"):
                errors += 1
                return
            if out.get("rejected"):
                rejected_count += 1
            records.append(out["record"])
            word_pairs.extend(out["word_pairs"])

        if workers <= 1:
            for i, (rec, row) in enumerate(items):
                idx = int(rec["idx"])
                script = row["text"]
                audio_16k = decode_parquet_audio(row["audio"], target_sr=16000)
                wav_bytes = numpy_to_wav_bytes(audio_16k, 16000)

                res = client.post(
                    "/api/v1/audio/evaluate-phonetics",
                    files={"audio": (f"eval_so_{idx}.wav", wav_bytes, "audio/wav")},
                    data={"script": script},
                )
                if res.status_code != 200:
                    errors += 1
                    continue
                body = res.json()
                if body.get("evaluationStatus") == "REJECTED_MISMATCH":
                    rejected_count += 1
                kpi = body.get("kpi", {})
                records.append({
                    "idx": idx,
                    "human_tot": float(row["total"]) * 10.0,
                    "human_acc": float(row["accuracy"]) * 10.0,
                    "human_flu": float(row["fluency"]) * 10.0,
                    "human_pro": float(row["prosodic"]) * 10.0,
                    "pred_overall": float(body.get("overallScore", 0.0)),
                    "pred_pron": float(body.get("pronunciationScore", 0.0)),
                    "pred_flu": float(body.get("fluencyScore", 0.0)),
                    "pred_pro": float(kpi.get("prosody", 0.0)),
                    "pred_speed": float(body.get("speedScore", 0.0)),
                    "raw_overall": float(rec["raw_scores"]["overall"]),
                    "raw_pron": float(rec["raw_scores"]["pronunciation"]),
                    "raw_flu": float(rec["raw_scores"]["fluency"]),
                    "raw_pro": float(rec["raw_scores"]["prosody"]),
                })
                pred_words = body.get("words", [])
                gt_words = row.get("words", [])
                if len(pred_words) == len(gt_words):
                    for pw, gw in zip(pred_words, gt_words):
                        if pw.get("score") is not None:
                            word_pairs.append((float(gw["accuracy"]) * 10.0, float(pw["score"])))
                if (i + 1) % 75 == 0:
                    print(f"  [Eval SO Test] {i + 1}/{len(items)} ({time.time() - t0:.1f}s)", flush=True)
        else:
            with concurrent.futures.ProcessPoolExecutor(
                max_workers=workers,
                initializer=_init_eval_worker,
                initargs=(torch_threads,),
            ) as executor:
                for i, out in enumerate(executor.map(_eval_worker_so, items, chunksize=4)):
                    _consume(out)
                    if (i + 1) % 100 == 0 or (i + 1) == len(items):
                        print(f"  [Eval SO Test w={workers}] {i + 1}/{len(items)} ({time.time() - t0:.1f}s)", flush=True)

    elapsed = time.time() - t0
    metrics_after = {}
    metrics_uncalibrated = {}
    for h_k, a_k, r_k, lbl in [
        ("human_tot", "pred_overall", "raw_overall", "Overall"),
        ("human_acc", "pred_pron", "raw_pron", "Pronunciation"),
        ("human_flu", "pred_flu", "raw_flu", "Fluency"),
        ("human_pro", "pred_pro", "raw_pro", "Prosody"),
    ]:
        h_vals = [x[h_k] for x in records]
        metrics_after[lbl] = compute_regression_metrics(h_vals, [x[a_k] for x in records])
        metrics_uncalibrated[lbl] = compute_regression_metrics(h_vals, [x[r_k] for x in records])

    word_metrics = (
        compute_regression_metrics([x[0] for x in word_pairs], [x[1] for x in word_pairs])
        if len(word_pairs) >= 10
        else {}
    )
    return {
        "n_eval": len(records),
        "n_total": len(so_test_feats),
        "errors": errors,
        "rejected_mismatch": rejected_count,
        "elapsed_sec": round(elapsed, 2),
        "ms_per_utt": round((elapsed / max(1, len(records))) * 1000.0, 1),
        "uncalibrated_phase1_2": metrics_uncalibrated,
        "calibrated_after": metrics_after,
        "word_level": word_metrics,
    }


def _run_live_ls_heldout(
    client: TestClient,
    ls_heldout_feats: List[dict],
    workers: int = 1,
    torch_threads: int = 2,
    fast_from_cache: bool = False,
) -> Dict[str, Any]:
    t0 = time.time()
    overalls, prons, flus, pros, speeds, comps, passed = [], [], [], [], [], [], []
    errors = 0

    if fast_from_cache:
        for rec in ls_heldout_feats:
            feats = dict(rec.get("utt_features", {}))
            if not feats:
                errors += 1
                continue
            comp = float(rec["raw_scores"].get("completeness", 100.0))
            cal = scorer.calibrate_utterance_scores(
                raw_pronunciation=float(rec["raw_scores"]["pronunciation"]),
                raw_fluency=float(rec["raw_scores"]["fluency"]),
                raw_prosody=float(rec["raw_scores"]["prosody"]),
                completeness=comp,
                features=feats,
            )
            overalls.append(float(cal["overall"]))
            prons.append(float(cal["pronunciation"]))
            flus.append(float(cal["fluency"]))
            pros.append(float(cal["prosody"]))
            speeds.append(float(rec["raw_scores"].get("speed", 0.0)))
            comps.append(comp)
            passed.append(bool(cal["overall"] >= 80.0 and cal["pronunciation"] >= 75.0 and comp >= 80.0))
    else:
        raw_rows = load_parquet_rows(LIBRISPEECH_VAL)
        items = [(int(rec["idx"]), raw_rows[int(rec["idx"])]) for rec in ls_heldout_feats]
        if workers <= 1:
            for idx, row in items:
                audio_16k = decode_parquet_audio(row["audio"], target_sr=16000)
                wav_bytes = numpy_to_wav_bytes(audio_16k, 16000)
                res = client.post(
                    "/api/v1/audio/evaluate-phonetics",
                    files={"audio": (f"eval_ls_{idx}.wav", wav_bytes, "audio/wav")},
                    data={"script": row["text"]},
                )
                if res.status_code != 200:
                    errors += 1
                    continue
                body = res.json()
                overalls.append(float(body["overallScore"]))
                prons.append(float(body["pronunciationScore"]))
                flus.append(float(body["fluencyScore"]))
                pros.append(float(body["kpi"]["prosody"]))
                speeds.append(float(body["speedScore"]))
                comps.append(float(body["kpi"]["completeness"]))
                passed.append(bool(body["isPassed"]))
        else:
            with concurrent.futures.ProcessPoolExecutor(
                max_workers=workers,
                initializer=_init_eval_worker,
                initargs=(torch_threads,),
            ) as executor:
                for out in executor.map(_eval_worker_ls, items, chunksize=4):
                    if not out.get("ok"):
                        errors += 1
                        continue
                    overalls.append(out["overall"])
                    prons.append(out["pron"])
                    flus.append(out["flu"])
                    pros.append(out["prosody"])
                    speeds.append(out["speed"])
                    comps.append(out["comp"])
                    passed.append(out["passed"])

    elapsed = time.time() - t0
    return {
        "n_ok": len(overalls),
        "n_total": len(ls_heldout_feats),
        "errors": errors,
        "elapsed_sec": round(elapsed, 2),
        "ms_per_utt": round((elapsed / max(1, len(overalls))) * 1000.0, 1),
        "overall_mean": round(float(np.mean(overalls)), 2) if overalls else 0.0,
        "overall_std": round(float(np.std(overalls)), 2) if overalls else 0.0,
        "pron_mean": round(float(np.mean(prons)), 2) if prons else 0.0,
        "flu_mean": round(float(np.mean(flus)), 2) if flus else 0.0,
        "prosody_mean": round(float(np.mean(pros)), 2) if pros else 0.0,
        "speed_mean": round(float(np.mean(speeds)), 2) if speeds else 0.0,
        "comp_mean": round(float(np.mean(comps)), 2) if comps else 0.0,
        "pass_rate_pct": round(float(np.mean(passed) * 100.0), 1) if passed else 0.0,
    }


def _run_targeted_probes(client: TestClient) -> Dict[str, Any]:
    from tests.audio_cases import FULL_SENTENCE, case_full

    probes: Dict[str, Any] = {}
    # 1. Mid-sentence skip probe: splice middle silence over "phonemic" or add extra skipped word in script
    full_audio_bytes = case_full()
    alt_script = "Consistent pronunciation practice omittedword phonemic awareness enhance oral fluency."
    r_mid = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("mid_skip.wav", full_audio_bytes, "audio/wav")},
        data={"script": alt_script},
    )
    if r_mid.status_code == 200:
        toks = r_mid.json().get("sentenceTokens", [])
        later_spoken = [t["wordStatus"] for t in toks[4:]]
        probes["mid_sentence_skip"] = {
            "status_code": 200,
            "skipped_slot_status": toks[3]["wordStatus"] if len(toks) > 3 else None,
            "later_words_statuses": later_spoken,
            "no_cascade": sum(1 for s in later_spoken if s in ("SPOKEN", "PARTIAL")) >= 4,
        }
    else:
        probes["mid_sentence_skip"] = {"status_code": r_mid.status_code}

    # 2. Off-script multi-word mismatch probe: speak FULL_SENTENCE against completely unrelated target script
    unrelated_script = "Yesterday my brother bought three purple bicycles near the harbor."
    r_off = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("off_script.wav", full_audio_bytes, "audio/wav")},
        data={"script": unrelated_script},
    )
    probes["off_script_multiword"] = {
        "status_code": r_off.status_code,
        "evaluationStatus": r_off.json().get("evaluationStatus") if r_off.status_code == 200 else r_off.json().get("detail", {}).get("code"),
        "overallScore": r_off.json().get("overallScore") if r_off.status_code == 200 else None,
    }
    return probes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--so-test-jsonl", type=Path, default=ROOT / "cache" / "so_test_feats.jsonl")
    parser.add_argument("--ls-heldout-jsonl", type=Path, default=ROOT / "cache" / "ls_heldout_feats.jsonl")
    parser.add_argument("--baseline-json", type=Path, default=ROOT / "cache" / "baseline_probe.json")
    parser.add_argument("--out", type=Path, default=ROOT / "cache" / "comprehensive_eval_report.json")
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--torch-threads", type=int, default=2)
    parser.add_argument("--fast-from-cache", action="store_true")
    args = parser.parse_args()

    # Reload FormantService & Scorer calibrator to ensure newly written profiles are live
    formant_service._load_profiles_from_disk(settings.VOWEL_PROFILE_PATH)
    scorer.calibrator = ScoringCalibrator()
    print(
        f"Live artifacts loaded: calibrator_mode={scorer.calibrator.mode} ({list(scorer.calibrator.models.keys())}); "
        f"gender_formants={list(formant_service.loaded_gender_profiles.keys())}",
        flush=True,
    )

    so_test_feats = _load_jsonl(args.so_test_jsonl)
    ls_heldout_feats = _load_jsonl(args.ls_heldout_jsonl)
    baseline = json.loads(args.baseline_json.read_text(encoding="utf-8")) if args.baseline_json.exists() else {}

    client = TestClient(app)
    phoneme_metrics = _eval_phoneme_discrimination(so_test_feats)
    so_eval = _run_live_so_test(
        client,
        so_test_feats,
        workers=args.workers,
        torch_threads=args.torch_threads,
        fast_from_cache=args.fast_from_cache,
    )
    ls_eval = _run_live_ls_heldout(
        client,
        ls_heldout_feats,
        workers=args.workers,
        torch_threads=args.torch_threads,
        fast_from_cache=args.fast_from_cache,
    )
    probes = _run_targeted_probes(client)

    report = {
        "baseline_probe": baseline,
        "speechocean_test_eval": so_eval,
        "speechocean_test_phoneme_eval": phoneme_metrics,
        "librispeech_heldout_eval": ls_eval,
        "targeted_probes": probes,
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\n================ COMPREHENSIVE EVALUATION SUMMARY ================", flush=True)
    if baseline.get("speechocean_test", {}).get("metrics"):
        print("Baseline (before upgrade):", baseline["speechocean_test"]["metrics"], flush=True)
    print("Upgraded Uncalibrated (on unseen SO test):", so_eval["uncalibrated_phase1_2"], flush=True)
    print("Upgraded + Calibrated (on unseen SO test):", so_eval["calibrated_after"], flush=True)
    print("SO Test Word-level:", so_eval["word_level"], flush=True)
    print("SO Test Phoneme GOP vs Human:", phoneme_metrics, flush=True)
    print(f"SO Test runtime: {so_eval['ms_per_utt']} ms/utt, rejected_mismatch={so_eval['rejected_mismatch']}", flush=True)
    print("Held-out LibriSpeech (8 unseen speakers):", ls_eval, flush=True)
    print("Targeted Probes:", probes, flush=True)
    print(f"Saved report -> {args.out}", flush=True)


if __name__ == "__main__":
    main()
