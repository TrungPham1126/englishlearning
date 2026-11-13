"""
Read-only diagnostic probe for measuring the current phonetics-service baseline
on SpeechOcean762 (Apache 2.0) and LibriSpeech clean/validation (CC BY 4.0).
"""
import io
import json
import logging
import sys
import time
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import scipy.stats as stats
import soundfile as sf
from fastapi.testclient import TestClient

logging.getLogger("phonetics-service").setLevel(logging.ERROR)
logging.getLogger("httpx").setLevel(logging.ERROR)

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402


def _wav_bytes_from_parquet_audio(audio_dict: dict) -> bytes:
    raw_bytes = audio_dict.get("bytes")
    if not raw_bytes:
        raise ValueError("Missing audio bytes")
    data, sr = sf.read(io.BytesIO(raw_bytes), dtype="float32")
    if data.ndim > 1:
        data = np.mean(data, axis=1)
    if sr != 16000:
        import math
        import scipy.signal
        g = math.gcd(sr, 16000)
        data = scipy.signal.resample_poly(data, 16000 // g, sr // g).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, data, 16000, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return buf.read()


def probe_speechocean(client: TestClient, parquet_path: Path, n_samples: int = 60, seed: int = 42):
    table = pq.read_table(str(parquet_path))
    rows = table.to_pylist()
    rng = np.random.default_rng(seed)
    indices = rng.choice(len(rows), size=min(n_samples, len(rows)), replace=False)

    records = []
    errors = []
    word_pairs = []
    t0 = time.time()
    for i_loop, idx in enumerate(indices):
        row = rows[int(idx)]
        script = row["text"]
        if (i_loop + 1) % 5 == 0:
            print(f"  [LS progress] {i_loop + 1}/{len(indices)} ({time.time() - t0:.1f}s)", flush=True)
        try:
            wav_bytes = _wav_bytes_from_parquet_audio(row["audio"])
            res = client.post(
                "/api/v1/audio/evaluate-phonetics",
                files={"audio": (f"so_{idx}.wav", wav_bytes, "audio/wav")},
                data={"script": script},
            )
            if res.status_code != 200:
                code = res.json().get("detail", {}).get("code")
                errors.append((int(idx), res.status_code, code, script, row["total"]))
                continue
            body = res.json()
            kpi = body.get("kpi", {})
            rec = {
                "idx": int(idx),
                "text": script,
                "human_acc": float(row["accuracy"]) * 10.0,
                "human_flu": float(row["fluency"]) * 10.0,
                "human_pro": float(row["prosodic"]) * 10.0,
                "human_tot": float(row["total"]) * 10.0,
                "pred_overall": float(body.get("overallScore", 0.0)),
                "pred_pron": float(body.get("pronunciationScore", 0.0)),
                "pred_flu": float(body.get("fluencyScore", 0.0)),
                "pred_pro": float(kpi.get("prosody", 0.0)),
                "pred_comp": float(kpi.get("completeness", 0.0)),
                "age": row.get("age"),
            }
            records.append(rec)

            pred_words = body.get("words", [])
            gt_words = row.get("words", [])
            if len(pred_words) == len(gt_words):
                for pw, gw in zip(pred_words, gt_words):
                    if pw.get("score") is not None:
                        word_pairs.append((float(gw["accuracy"]) * 10.0, float(pw["score"])))
        except Exception as exc:
            errors.append((int(idx), "EXC", str(exc), script, row.get("total")))

    elapsed = time.time() - t0
    print(f"\n=== SpeechOcean762 Baseline ({parquet_path.name}, ok={len(records)}/{len(indices)}, errors={len(errors)}, {elapsed:.1f}s) ===", flush=True)
    if errors:
        from collections import Counter
        print("  Errors:", Counter((e[1], e[2]) for e in errors), flush=True)
        for e in errors[:3]:
            print("  Sample error:", e, flush=True)

    summary = {"ok": len(records), "total": len(indices), "errors": len(errors), "elapsed_sec": round(elapsed, 2), "metrics": {}}
    if len(records) >= 5:
        for h_key, p_key, label in [
            ("human_tot", "pred_overall", "Overall Score"),
            ("human_acc", "pred_pron", "Pronunciation/Accuracy"),
            ("human_flu", "pred_flu", "Fluency"),
            ("human_pro", "pred_pro", "Prosody"),
        ]:
            h = np.array([r[h_key] for r in records])
            p = np.array([r[p_key] for r in records])
            pr, _ = stats.pearsonr(h, p)
            sr, _ = stats.spearmanr(h, p)
            mae = float(np.mean(np.abs(h - p)))
            rmse = float(np.sqrt(np.mean((h - p) ** 2)))
            print(f"  {label:<24}: r={pr:.3f}, rho={sr:.3f}, MAE={mae:.1f}, RMSE={rmse:.1f} | human={h.mean():.1f}+/-{h.std():.1f} vs pred={p.mean():.1f}+/-{p.std():.1f}", flush=True)
            summary["metrics"][label] = {"r": round(float(pr), 4), "rho": round(float(sr), 4), "mae": round(mae, 2), "rmse": round(rmse, 2)}

    if len(word_pairs) >= 10:
        wh = np.array([x[0] for x in word_pairs])
        wp = np.array([x[1] for x in word_pairs])
        wpr, _ = stats.pearsonr(wh, wp)
        wsr, _ = stats.spearmanr(wh, wp)
        wmae = float(np.mean(np.abs(wh - wp)))
        print(f"  {'Word-level (n=' + str(len(word_pairs)) + ')':<24}: r={wpr:.3f}, rho={wsr:.3f}, MAE={wmae:.1f} | human={wh.mean():.1f} vs pred={wp.mean():.1f}", flush=True)
        summary["metrics"]["word"] = {"n": len(word_pairs), "r": round(float(wpr), 4), "rho": round(float(wsr), 4), "mae": round(wmae, 2)}

    return summary, records


def probe_librispeech(client: TestClient, parquet_path: Path, n_samples: int = 30, seed: int = 42):
    table = pq.read_table(str(parquet_path))
    rows = table.to_pylist()
    rng = np.random.default_rng(seed)
    indices = rng.choice(len(rows), size=min(n_samples, len(rows)), replace=False)

    overalls, prons, comps, passed = [], [], [], []
    errors = []
    t0 = time.time()
    for i_loop, idx in enumerate(indices):
        row = rows[int(idx)]
        script = row["text"]
        if (i_loop + 1) % 5 == 0:
            print(f"  [LS progress] {i_loop + 1}/{len(indices)} ({time.time() - t0:.1f}s)", flush=True)
        try:
            wav_bytes = _wav_bytes_from_parquet_audio(row["audio"])
            res = client.post(
                "/api/v1/audio/evaluate-phonetics",
                files={"audio": (f"ls_{idx}.wav", wav_bytes, "audio/wav")},
                data={"script": script},
            )
            if res.status_code != 200:
                errors.append((int(idx), res.status_code, res.json().get("detail", {}).get("code")))
                continue
            body = res.json()
            overalls.append(float(body.get("overallScore", 0.0)))
            prons.append(float(body.get("pronunciationScore", 0.0)))
            comps.append(float(body.get("kpi", {}).get("completeness", 0.0)))
            passed.append(bool(body.get("isPassed", False)))
        except Exception as exc:
            errors.append((int(idx), "EXC", str(exc)))

    elapsed = time.time() - t0
    print(f"\n=== LibriSpeech Native Baseline (ok={len(overalls)}/{len(indices)}, errors={len(errors)}, {elapsed:.1f}s) ===", flush=True)
    if errors:
        from collections import Counter
        print("  Errors:", Counter((e[1], e[2]) for e in errors), flush=True)
    if overalls:
        print(
            f"  Overall={np.mean(overalls):.1f}+/-{np.std(overalls):.1f}, "
            f"Pron={np.mean(prons):.1f}+/-{np.std(prons):.1f}, "
            f"Comp={np.mean(comps):.1f}%, PassRate={np.mean(passed)*100:.1f}%",
            flush=True
        )
    return {
        "ok": len(overalls),
        "total": len(indices),
        "errors": len(errors),
        "elapsed_sec": round(elapsed, 2),
        "overall_mean": round(float(np.mean(overalls)), 2) if overalls else 0.0,
        "pron_mean": round(float(np.mean(prons)), 2) if prons else 0.0,
        "comp_mean": round(float(np.mean(comps)), 2) if comps else 0.0,
        "pass_rate_pct": round(float(np.mean(passed) * 100.0), 2) if passed else 0.0,
    }


if __name__ == "__main__":
    client = TestClient(app)
    so_test = ROOT / "cache" / "datasets" / "speechocean762" / "data" / "test-00000-of-00001.parquet"
    ls_val = ROOT / "cache" / "datasets" / "librispeech" / "clean" / "validation" / "0000.parquet"
    so_summary, _ = probe_speechocean(client, so_test, n_samples=30)
    ls_summary = probe_librispeech(client, ls_val, n_samples=15)
    out = {"speechocean": so_summary, "librispeech": ls_summary}
    (ROOT / "cache" / "baseline_probe.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
