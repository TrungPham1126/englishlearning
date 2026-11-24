"""
Tiện ích dùng chung (chạy ngoại tuyến / offline) cho quá trình hiệu chuẩn và đánh giá thực nghiệm.

Chức năng chính:
  - Đọc dữ liệu SpeechOcean762 (người học) và LibriSpeech clean/validation (người bản ngữ) từ file Parquet.
  - Giải mã âm thanh thô sang chuẩn 16 kHz mono float32 hoặc đóng gói byte WAV PCM-16.
  - Chia tập train/test tách biệt hoàn toàn theo người nói (speaker-disjoint) để tránh rò rỉ dữ liệu.
  - Tính các chỉ số đánh giá hồi quy (Pearson r, Spearman rho, MAE, RMSE) so sánh điểm máy với điểm chuyên gia.
"""
import io
import math
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
import pyarrow.parquet as pq
import scipy.signal
import scipy.stats as stats
import soundfile as sf

# Đường dẫn thư mục gốc của phonetics-service và vị trí lưu bộ dữ liệu Parquet cục bộ
PHONETICS_ROOT = Path(__file__).resolve().parent.parent
CACHE_DATASETS_DIR = PHONETICS_ROOT / "cache" / "datasets"
SPEECHOCEAN_TRAIN = CACHE_DATASETS_DIR / "speechocean762" / "data" / "train-00000-of-00001.parquet"
SPEECHOCEAN_TEST = CACHE_DATASETS_DIR / "speechocean762" / "data" / "test-00000-of-00001.parquet"
LIBRISPEECH_VAL = CACHE_DATASETS_DIR / "librispeech" / "clean" / "validation" / "0000.parquet"


def load_parquet_rows(path: Path) -> List[dict]:
    """Đọc toàn bộ bảng dữ liệu Parquet tại `path` và trả về danh sách các dòng dạng dictionary."""
    table = pq.read_table(str(path))
    return table.to_pylist()


def decode_parquet_audio(audio_dict: dict, target_sr: int = 16000) -> np.ndarray:
    """Giải mã trực tiếp byte âm thanh gốc (FLAC/WAV) trong Parquet sang mảng numpy float32 đơn kênh (mono) ở tần số `target_sr` (mặc định 16 kHz)."""
    raw_bytes = audio_dict.get("bytes")
    if not raw_bytes:
        raise ValueError("Missing audio bytes in dataset row")
    data, sr = sf.read(io.BytesIO(raw_bytes), dtype="float32")
    # Nếu âm thanh có nhiều hơn 1 kênh (stereo), lấy trung bình cộng để đưa về mono
    if data.ndim > 1:
        data = np.mean(data, axis=1)
    # Nếu tần số lấy mẫu gốc khác tần số mục tiêu (16 kHz), thực hiện resample đa pha chính xác theo tỷ lệ tối giản
    if sr != target_sr:
        g = math.gcd(sr, target_sr)
        data = scipy.signal.resample_poly(data, target_sr // g, sr // g).astype(np.float32)
    return data.astype(np.float32)


def numpy_to_wav_bytes(audio: np.ndarray, sample_rate: int = 16000) -> bytes:
    """Chuyển đổi mảng âm thanh numpy thành chuỗi byte định dạng WAV (PCM 16-bit) trong RAM để gửi vào API kiểm thử."""
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
    """
    Chia tách tất định (deterministic) danh sách mẫu thành 2 tập train và test tách biệt hoàn toàn người nói (speaker-disjoint).

    Mục đích: bảo đảm cùng một người nói không xuất hiện ở cả tập huấn luyện và tập kiểm thử (tránh rò rỉ dữ liệu / data leakage).
    Tập mã người nói được sắp xếp trước khi xáo trộn bằng `seed` để mọi script gọi lại luôn ra đúng cùng 1 phép chia.
    """
    speakers = sorted({row[speaker_key] for row in rows})
    rng = np.random.default_rng(seed)
    shuffled = list(speakers)
    rng.shuffle(shuffled)
    # Tính số lượng người nói cho tập train (tối thiểu 1 người nói) rồi phân tách toàn bộ câu theo tập người nói tương ứng
    n_train = max(1, int(round(len(shuffled) * train_frac)))
    train_spk = set(shuffled[:n_train])
    train_rows = [r for r in rows if r[speaker_key] in train_spk]
    test_rows = [r for r in rows if r[speaker_key] not in train_spk]
    return train_rows, test_rows


def compute_regression_metrics(y_true: Sequence[float], y_pred: Sequence[float]) -> Dict[str, float]:
    """
    Tính bộ chỉ số đánh giá hồi quy giữa điểm chuẩn chuyên gia (`y_true`) và điểm mô hình dự đoán (`y_pred`).

    Bao gồm: số mẫu `n`, tương quan tuyến tính Pearson `r`, tương quan hạng Spearman `rho`,
    sai số tuyệt đối trung bình `mae`, căn bậc hai sai số toàn phương trung bình `rmse`, và trung bình/độ lệch chuẩn của 2 chuỗi.
    """
    yt = np.asarray(y_true, dtype=np.float64)
    yp = np.asarray(y_pred, dtype=np.float64)
    # Bảo vệ trường hợp quá ít mẫu (< 3) hoặc phương sai gần bằng 0 khiến hàm tính tương quan trả về NaN
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
