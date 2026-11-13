"""Shared offline dataset utilities for empirical acoustic calibration and evaluation."""
import io
import math
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
import pyarrow.parquet as pq
import scipy.signal
import scipy.stats as stats
import soundfile as sf

PHONETICS_ROOT = Path(__file__).resolve().parent.parent
CACHE_DATASETS_DIR = PHONETICS_ROOT / "cache" / "datasets"
SPEECHOCEAN_TRAIN = CACHE_DATASETS_DIR / "speechocean762" / "data" / "train-00000-of-00001.parquet"
SPEECHOCEAN_TEST = CACHE_DATASETS_DIR / "speechocean762" / "data" / "test-00000-of-00001.parquet"
LIBRISPEECH_VAL = CACHE_DATASETS_DIR / "librispeech" / "clean" / "validation" / "0000.parquet"


def load_parquet_rows(path: Path) -> List[dict]:
    table = pq.read_table(str(path))
    return table.to_pylist()


def decode_parquet_audio(audio_dict: dict, target_sr: int = 16000) -> np.ndarray:
    """Decode raw FLAC/WAV parquet bytes directly to 16kHz float32 mono numpy array."""
    raw_bytes = audio_dict.get("bytes")
    if not raw_bytes:
        raise ValueError("Missing audio bytes in dataset row")
    data, sr = sf.read(io.BytesIO(raw_bytes), dtype="float32")
    if data.ndim > 1:
        data = np.mean(data, axis=1)
    if sr != target_sr:
        g = math.gcd(sr, target_sr)
        data = scipy.signal.resample_poly(data, target_sr // g, sr // g).astype(np.float32)
    return data.astype(np.float32)


def numpy_to_wav_bytes(audio: np.ndarray, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, audio, sample_rate, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return buf.read()


def split_by_speaker(
    rows: Sequence[dict],
    speaker_key: str = "speaker_id",
    train_frac: float = 0.80,
    seed: int = 42,
) -> Tuple[List[dict], List[dict]]:
    """Deterministically splits rows into speaker-disjoint train and test subsets."""
    speakers = sorted({row[speaker_key] for row in rows})
    rng = np.random.default_rng(seed)
    shuffled = list(speakers)
    rng.shuffle(shuffled)
    n_train = max(1, int(round(len(shuffled) * train_frac)))
    train_spk = set(shuffled[:n_train])
    train_rows = [r for r in rows if r[speaker_key] in train_spk]
    test_rows = [r for r in rows if r[speaker_key] not in train_spk]
    return train_rows, test_rows


def compute_regression_metrics(y_true: Sequence[float], y_pred: Sequence[float]) -> Dict[str, float]:
    yt = np.asarray(y_true, dtype=np.float64)
    yp = np.asarray(y_pred, dtype=np.float64)
    if len(yt) < 3 or np.std(yt) < 1e-8 or np.std(yp) < 1e-8:
        return {
            "n": int(len(yt)),
            "r": 0.0,
            "rho": 0.0,
            "mae": float(np.mean(np.abs(yp - yt))) if len(yt) else 0.0,
            "rmse": float(np.sqrt(np.mean((yp - yt) ** 2))) if len(yt) else 0.0,
            "mean_true": float(np.mean(yt)) if len(yt) else 0.0,
            "std_true": float(np.std(yt)) if len(yt) else 0.0,
            "mean_pred": float(np.mean(yp)) if len(yt) else 0.0,
            "std_pred": float(np.std(yp)) if len(yt) else 0.0,
        }
    r, _ = stats.pearsonr(yt, yp)
    rho, _ = stats.spearmanr(yt, yp)
    mae = float(np.mean(np.abs(yp - yt)))
    rmse = float(np.sqrt(np.mean((yp - yt) ** 2)))
    return {
        "n": int(len(yt)),
        "r": round(float(r), 4),
        "rho": round(float(rho), 4),
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "mean_true": round(float(np.mean(yt)), 2),
        "std_true": round(float(np.std(yt)), 2),
        "mean_pred": round(float(np.mean(yp)), 2),
        "std_pred": round(float(np.std(yp)), 2),
    }
