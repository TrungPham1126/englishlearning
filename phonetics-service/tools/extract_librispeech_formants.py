"""
Extract continuous-speech empirical F1/F2 vowel distributions (means, stds, 2x2 covariances)
from LibriSpeech clean/validation speakers (CC BY 4.0) and update reference_profiles/vowels.json.

Supports:
  - Speaker-disjoint 80/20 split (default: updates vowels.json from 80% train speakers only)
  - Full dataset aggregation (--all-speakers / --from-cache) over all 2,703 utterances
  - Multiprocess CPU extraction (--workers N) + per-utterance JSONL cache (--points-cache)
"""
import argparse
import concurrent.futures
import json
import logging
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np

logging.getLogger("phonetics-service").setLevel(logging.ERROR)

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.dataset_utils import (  # noqa: E402
    LIBRISPEECH_VAL,
    decode_parquet_audio,
    load_parquet_rows,
    split_by_speaker,
)

_WORKER_CTX: Dict[str, Any] = {}


def _init_formant_worker(torch_threads: int) -> None:
    os.environ["OMP_NUM_THREADS"] = str(torch_threads)
    os.environ["MKL_NUM_THREADS"] = str(torch_threads)
    import torch

    torch.set_num_threads(max(1, int(torch_threads)))
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    logging.getLogger("phonetics-service").setLevel(logging.ERROR)

    from app.config import settings
    from app.services.aligner import forced_aligner, validate_script
    from app.services.audio_preprocessor import preprocessor
    from app.services.formant_service import formant_service

    # Ensure model is warm once per worker
    forced_aligner.model_mgr.load_model()
    _WORKER_CTX["settings"] = settings
    _WORKER_CTX["forced_aligner"] = forced_aligner
    _WORKER_CTX["validate_script"] = validate_script
    _WORKER_CTX["preprocessor"] = preprocessor
    _WORKER_CTX["formant_service"] = formant_service


def _process_formant_item(item: Tuple[int, str, bool, str, dict]) -> Dict[str, Any]:
    orig_idx, speaker_id, is_train, text, audio_dict = item
    if not _WORKER_CTX:
        _init_formant_worker(2)

    settings = _WORKER_CTX["settings"]
    forced_aligner = _WORKER_CTX["forced_aligner"]
    validate_script = _WORKER_CTX["validate_script"]
    preprocessor = _WORKER_CTX["preprocessor"]
    formant_service = _WORKER_CTX["formant_service"]

    try:
        validate_script(text)
        audio = decode_parquet_audio(audio_dict, target_sr=settings.SAMPLE_RATE)
        if len(audio) < int(settings.SAMPLE_RATE * 0.5):
            return {"idx": orig_idx, "speaker_id": speaker_id, "is_train": is_train, "ok": False}

        max_val = float(np.max(np.abs(audio)))
        if max_val > 1e-4:
            audio = (audio / max_val) * 0.95
        audio = preprocessor._apply_bandpass_filter(audio)

        alignment = forced_aligner._align_sync(audio, text)
        acoustics = formant_service.extract_utterance_acoustics(audio, settings.SAMPLE_RATE)
        if acoustics.formants is None:
            return {"idx": orig_idx, "speaker_id": speaker_id, "is_train": is_train, "ok": False}

        gender = acoustics.gender
        formants = acoustics.formants
        pts: List[List[Any]] = []
        for word_obj in alignment.words:
            for p_obj in word_obj.phonemes:
                if p_obj.phoneme_type != "vowel" or not p_obj.has_frames:
                    continue
                dur = p_obj.end - p_obj.start
                canon_post = (
                    p_obj.canonical_posterior
                    if p_obj.canonical_posterior is not None
                    else p_obj.posterior
                )
                if dur < 0.025 or canon_post < 0.40:
                    continue

                mid = p_obj.start + 0.5 * dur
                w_start = max(p_obj.start, mid - 0.014)
                w_end = min(p_obj.end, mid + 0.014)
                f1_vals, f2_vals = [], []
                curr_t = w_start
                while curr_t <= w_end + 1e-6:
                    try:
                        v1 = formants.get_value_at_time(1, curr_t)
                        v2 = formants.get_value_at_time(2, curr_t)
                        if v1 and not np.isnan(v1) and not np.isinf(v1) and 180.0 <= v1 <= 1250.0:
                            f1_vals.append(float(v1))
                        if v2 and not np.isnan(v2) and not np.isinf(v2) and 500.0 <= v2 <= 3200.0:
                            f2_vals.append(float(v2))
                    except Exception:
                        pass
                    curr_t += 0.004

                if len(f1_vals) >= 2 and len(f2_vals) >= 2:
                    clean_sym = p_obj.symbol.strip("/ ")
                    norm_sym = formant_service.VOWEL_NORM_MAP.get(clean_sym, clean_sym)
                    pts.append([
                        norm_sym,
                        round(float(np.median(f1_vals)), 2),
                        round(float(np.median(f2_vals)), 2),
                    ])

        return {
            "idx": orig_idx,
            "speaker_id": speaker_id,
            "is_train": is_train,
            "ok": True,
            "gender": gender,
            "points": pts,
        }
    except Exception:
        return {"idx": orig_idx, "speaker_id": speaker_id, "is_train": is_train, "ok": False}


def _sample_balanced_by_speaker(
    rows: List[Tuple[int, dict]],
    max_per_speaker: int,
    seed: int = 42,
) -> List[Tuple[int, dict]]:
    if max_per_speaker <= 0:
        return list(rows)
    rng = np.random.default_rng(seed)
    by_spk: Dict[str, List[Tuple[int, dict]]] = defaultdict(list)
    for orig_idx, r in rows:
        by_spk[str(r["speaker_id"])].append((orig_idx, r))

    selected: List[Tuple[int, dict]] = []
    for spk in sorted(by_spk.keys()):
        items = by_spk[spk]
        if len(items) > max_per_speaker:
            idxs = rng.choice(len(items), size=max_per_speaker, replace=False)
            selected.extend(items[int(i)] for i in idxs)
        else:
            selected.extend(items)
    return selected


def _robust_stats_2d(points: List[Tuple[float, float]]) -> Tuple[List[float], List[float], List[List[float]], int]:
    arr = np.asarray(points, dtype=np.float64)
    if len(arr) < 8:
        mean = np.mean(arr, axis=0)
        std = np.maximum(np.std(arr, axis=0), [35.0, 90.0])
        cov = np.diag(std ** 2)
        return (
            [round(float(mean[0]), 1), round(float(mean[1]), 1)],
            [round(float(std[0]), 1), round(float(std[1]), 1)],
            cov.tolist(),
            len(arr),
        )

    q1_1, q3_1 = np.percentile(arr[:, 0], [25, 75])
    q1_2, q3_2 = np.percentile(arr[:, 1], [25, 75])
    iqr_1 = max(25.0, q3_1 - q1_1)
    iqr_2 = max(60.0, q3_2 - q1_2)

    mask = (
        (arr[:, 0] >= q1_1 - 1.8 * iqr_1)
        & (arr[:, 0] <= q3_1 + 1.8 * iqr_1)
        & (arr[:, 1] >= q1_2 - 1.8 * iqr_2)
        & (arr[:, 1] <= q3_2 + 1.8 * iqr_2)
    )
    clean = arr[mask] if np.sum(mask) >= max(8, len(arr) // 2) else arr

    mean = np.mean(clean, axis=0)
    cov = np.cov(clean, rowvar=False)
    if cov.shape != (2, 2):
        cov = np.diag([np.var(clean[:, 0]), np.var(clean[:, 1])])
    cov[0, 0] = max(625.0, float(cov[0, 0]))
    cov[1, 1] = max(3600.0, float(cov[1, 1]))
    std = np.sqrt(np.diag(cov))

    return (
        [round(float(mean[0]), 1), round(float(mean[1]), 1)],
        [round(float(std[0]), 1), round(float(std[1]), 1)],
        [
            [round(float(cov[0, 0]), 1), round(float(cov[0, 1]), 1)],
            [round(float(cov[1, 0]), 1), round(float(cov[1, 1]), 1)],
        ],
        int(len(clean)),
    )


def _aggregate_and_save(
    records: List[Dict[str, Any]],
    all_speakers: bool,
    min_samples: int,
    elapsed_sec: float,
) -> None:
    samples: Dict[str, Dict[str, List[Tuple[float, float]]]] = {
        "MALE": defaultdict(list),
        "FEMALE": defaultdict(list),
    }
    ok_utts = 0
    skipped = 0
    used_speakers = set()
    for rec in records:
        if not all_speakers and not rec.get("is_train", True):
            continue
        if not rec.get("ok"):
            skipped += 1
            continue
        ok_utts += 1
        used_speakers.add(str(rec.get("speaker_id")))
        gender = rec["gender"]
        for sym, f1, f2 in rec.get("points", []):
            samples[gender][sym].append((float(f1), float(f2)))

    vowels_path = ROOT / "reference_profiles" / "vowels.json"
    with open(vowels_path, "r", encoding="utf-8") as f:
        vowels_data = json.load(f)

    split_desc = (
        f"all {len(used_speakers)} speakers (n={ok_utts} utts)"
        if all_speakers
        else f"80% speaker-disjoint train split ({len(used_speakers)} speakers, n={ok_utts} utts)"
    )
    summary = {
        "ok_utts": ok_utts,
        "skipped": skipped,
        "speakers": len(used_speakers),
        "all_speakers": all_speakers,
        "elapsed_sec": round(elapsed_sec, 2),
        "updated": {},
    }
    bucket_map = {"MALE": "en-US-male", "FEMALE": "en-US-female"}

    for gender, json_key in bucket_map.items():
        section = vowels_data.get(json_key, {})
        summary["updated"][json_key] = {}
        alias_to_key = {"ɛ": "e", "ɚ": "ɜː", "ɑ": "ɑː", "ɔ": "ɔː", "i": "iː", "u": "uː"}
        for sym, pts in sorted(samples[gender].items()):
            target_key = sym if sym in section else alias_to_key.get(sym)
            if target_key is None or target_key not in section or len(pts) < min_samples:
                continue

            old_mean = section[target_key]["mean"]
            mean, std, cov, clean_n = _robust_stats_2d(pts)
            section[target_key]["mean"] = mean
            section[target_key]["std"] = std
            section[target_key]["covariance"] = cov
            section[target_key]["sample_count"] = clean_n
            section[target_key]["source"] = (
                f"Empirical continuous speech derived from LibriSpeech clean/validation "
                f"(CC BY 4.0, n={clean_n} vowel tokens, {split_desc})"
            )
            summary["updated"][json_key][target_key] = {
                "n_raw": len(pts),
                "n_clean": clean_n,
                "old_mean": old_mean,
                "new_mean": mean,
                "new_std": std,
            }
        vowels_data[json_key] = section

    vowels_data["_metadata"]["version"] = "3.1.0" if all_speakers else "3.0.0"
    vowels_data["_metadata"]["description"] = (
        "Dual-gender continuous-speech vowel formant profiles calibrated from LibriSpeech clean "
        f"(CC BY 4.0, {split_desc}), preserving canonical Hillenbrand en-US baseline"
    )

    with open(vowels_path, "w", encoding="utf-8") as f:
        json.dump(vowels_data, f, ensure_ascii=False, indent=2)

    out_summary = ROOT / "cache" / "librispeech_formants_summary.json"
    out_summary.parent.mkdir(parents=True, exist_ok=True)
    with open(out_summary, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(
        f"Done in {summary['elapsed_sec']}s ({split_desc}): ok={ok_utts}, skipped={skipped}. "
        f"Updated male={len(summary['updated']['en-US-male'])}, "
        f"female={len(summary['updated']['en-US-female'])} vowel profiles.",
        flush=True,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-per-speaker", type=int, default=14, help="0 = use ALL utterances per speaker")
    parser.add_argument("--min-samples", type=int, default=20)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--torch-threads", type=int, default=2)
    parser.add_argument("--all-speakers", action="store_true", help="Include all 40 speakers instead of 80% train split")
    parser.add_argument("--extract-both-splits", action="store_true", help="Cache held-out speaker points too while updating train-only or all")
    parser.add_argument("--points-cache", type=Path, default=ROOT / "cache" / "ls_all_formant_points.jsonl")
    parser.add_argument("--from-cache", action="store_true", help="Aggregate vowels.json directly from points-cache")
    parser.add_argument("--resume", action="store_true", help="Skip utterance indices already present in points-cache")
    parser.add_argument("--max-items", type=int, default=0, help="0 = process all remaining todo items in this run")
    parser.add_argument("--skip-aggregate", action="store_true", help="Skip updating vowels.json and summary at the end")
    args = parser.parse_args()

    t0 = time.time()
    if args.from_cache:
        records = []
        with open(args.points_cache, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
        print(f"Loaded {len(records)} cached LibriSpeech formant records from {args.points_cache}", flush=True)
        _aggregate_and_save(records, all_speakers=args.all_speakers, min_samples=args.min_samples, elapsed_sec=time.time() - t0)
        return

    all_rows = load_parquet_rows(LIBRISPEECH_VAL)
    train_rows, heldout_rows = split_by_speaker(all_rows, speaker_key="speaker_id", train_frac=0.80, seed=42)
    train_spk_set = {str(r["speaker_id"]) for r in train_rows}

    indexed_train = [(i, r) for i, r in enumerate(all_rows) if str(r["speaker_id"]) in train_spk_set]
    indexed_heldout = [(i, r) for i, r in enumerate(all_rows) if str(r["speaker_id"]) not in train_spk_set]

    sampled_pairs = _sample_balanced_by_speaker(indexed_train, max_per_speaker=args.max_per_speaker, seed=42)
    if args.all_speakers or args.extract_both_splits:
        sampled_pairs.extend(_sample_balanced_by_speaker(indexed_heldout, max_per_speaker=args.max_per_speaker, seed=42))

    existing_records: Dict[int, Dict[str, Any]] = {}
    if args.resume and args.points_cache.exists():
        with open(args.points_cache, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    r_json = json.loads(line)
                    existing_records[int(r_json["idx"])] = r_json

    todo_items: List[Tuple[int, str, bool, str, dict]] = []
    for orig_idx, row in sampled_pairs:
        if orig_idx in existing_records:
            continue
        spk = str(row["speaker_id"])
        is_train = spk in train_spk_set
        todo_items.append((orig_idx, spk, is_train, row["text"], row["audio"]))

    total_todo = len(todo_items)
    if args.max_items and args.max_items > 0:
        todo_items = todo_items[: args.max_items]

    print(
        f"LibriSpeech formants extraction: total_target={len(sampled_pairs)}, "
        f"cached={len(existing_records)}, todo={total_todo}, batch={len(todo_items)}, workers={args.workers}",
        flush=True,
    )

    args.points_cache.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if (args.resume and existing_records) else "w"
    processed_now = 0
    ok_now = 0
    skip_now = 0

    with open(args.points_cache, mode, encoding="utf-8") as fout:
        if args.workers <= 1:
            _init_formant_worker(args.torch_threads)
            for item in todo_items:
                rec = _process_formant_item(item)
                existing_records[rec["idx"]] = rec
                fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
                processed_now += 1
                if rec.get("ok"):
                    ok_now += 1
                else:
                    skip_now += 1
                if processed_now % 50 == 0 or processed_now == len(todo_items):
                    fout.flush()
                    print(
                        f"  [Formant extraction] {processed_now}/{len(todo_items)} "
                        f"(ok={ok_now}, skip={skip_now}, {time.time() - t0:.1f}s)",
                        flush=True,
                    )
        else:
            with concurrent.futures.ProcessPoolExecutor(
                max_workers=args.workers,
                initializer=_init_formant_worker,
                initargs=(args.torch_threads,),
            ) as executor:
                futures = [executor.submit(_process_formant_item, item) for item in todo_items]
                for fut in concurrent.futures.as_completed(futures):
                    rec = fut.result()
                    existing_records[rec["idx"]] = rec
                    fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    processed_now += 1
                    if rec.get("ok"):
                        ok_now += 1
                    else:
                        skip_now += 1
                    if processed_now % 25 == 0 or processed_now == len(todo_items):
                        fout.flush()
                        print(
                            f"  [Formant extraction w={args.workers}] {processed_now}/{len(todo_items)} "
                            f"(ok={ok_now}, skip={skip_now}, {time.time() - t0:.1f}s)",
                            flush=True,
                        )

    remaining = max(0, total_todo - processed_now)
    print(
        f"LibriSpeech batch complete: cached_now={len(existing_records)}/{len(sampled_pairs)}, "
        f"processed_now={processed_now}, remaining={remaining}, elapsed={time.time() - t0:.1f}s",
        flush=True,
    )
    if not args.skip_aggregate:
        ordered = [existing_records[k] for k in sorted(existing_records.keys())]
        _aggregate_and_save(
            ordered,
            all_speakers=args.all_speakers,
            min_samples=args.min_samples,
            elapsed_sec=time.time() - t0,
        )


if __name__ == "__main__":
    main()
