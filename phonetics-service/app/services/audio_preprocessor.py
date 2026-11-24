"""
Module tiền xử lý âm thanh đầu vào cho hệ thống chấm điểm phát âm.

Chịu trách nhiệm giải mã tệp thu âm từ nhiều định dạng (WebM, Opus, MP3, M4A, OGG, WAV),
chuyển về chuẩn 1 kênh âm thanh (mono), tần số lấy mẫu 16.000 Hz (16kHz), cân bằng âm lượng
và lọc bỏ tạp âm ngoài dải tần giọng nói trước khi đưa vào phân tích ngữ âm.
"""

import io
import logging
import os
import shutil
import subprocess
import tempfile
import wave
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Optional, Tuple

import numpy as np
import scipy.signal

logger = logging.getLogger("phonetics-service")

# 1. Tìm kiếm hoặc cấu hình đường dẫn tới công cụ giải mã âm thanh ffmpeg
def get_ffmpeg_executable() -> str:
    """Tìm tệp thực thi dòng lệnh ffmpeg từ biến môi trường hệ thống (PATH) hoặc từ thư viện imageio-ffmpeg đi kèm."""
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    try:
        import imageio_ffmpeg
        bundled = imageio_ffmpeg.get_ffmpeg_exe()
        if bundled and os.path.exists(bundled):
            b_dir = os.path.dirname(bundled)
            # Tạo bản sao mang tên ffmpeg.exe nếu thư mục chưa có sẵn để các thư viện khác nhận diện được
            target_exe = os.path.join(b_dir, "ffmpeg.exe")
            if not os.path.exists(target_exe):
                try:
                    shutil.copyfile(bundled, target_exe)
                except Exception:
                    pass
            # Thêm thư mục chứa ffmpeg vào biến môi trường PATH để các tiến trình con và thư viện pydub tự động tìm thấy
            if b_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = b_dir + os.pathsep + os.environ.get("PATH", "")
            return target_exe if os.path.exists(target_exe) else bundled
    except Exception as ex:
        logger.warning("imageio-ffmpeg discovery warning: %s", ex)

    return "ffmpeg"


FFMPEG_BIN = get_ffmpeg_executable()

# 2. Cấu hình thư viện pydub (hỗ trợ đọc và chuyển đổi nhiều định dạng âm thanh phổ biến)
try:
    import pydub
    from pydub import AudioSegment
    if FFMPEG_BIN:
        pydub.AudioSegment.converter = FFMPEG_BIN
    HAS_PYDUB = True
except Exception:
    HAS_PYDUB = False

# 3. Kiểm tra hỗ trợ thư viện soundfile (đọc trực tiếp file WAV, FLAC, OGG ngay trong RAM với tốc độ cao)
try:
    import soundfile as sf
    HAS_SOUNDFILE = True
except ImportError:
    sf = None
    HAS_SOUNDFILE = False

# 4. Kiểm tra hỗ trợ thư viện parselmouth (cầu nối Python tới phần mềm phân tích ngữ âm học Praat)
try:
    import parselmouth
    HAS_PARSELMOUTH = True
except ImportError:
    parselmouth = None
    HAS_PARSELMOUTH = False

from app.config import settings
from app.exceptions import UnsupportedAudioError, EmptySpeechError


def convert_to_praat_sound(audio_bytes: bytes) -> "parselmouth.Sound":
    """
    Chuyển đổi dữ liệu âm thanh bất kỳ (WebM, Opus, Ogg, MP3, WAV) thành đối tượng parselmouth.Sound (16kHz PCM WAV Mono).
    Ưu tiên giải mã trực tiếp trong bộ nhớ và bảo đảm không làm hỏng dữ liệu nhị phân khi nạp vào Praat.
    """
    if not HAS_PARSELMOUTH:
        raise RuntimeError("parselmouth library is not installed.")

    try:
        # Lớp 1: Thử đọc trực tiếp từ bộ nhớ bằng soundfile; nếu có nhiều kênh (stereo) thì gộp trung bình thành 1 kênh (mono)
        if HAS_SOUNDFILE:
            try:
                with io.BytesIO(audio_bytes) as bio:
                    data, sr = sf.read(bio, dtype="float32")
                if data is not None and len(data) > 0:
                    if data.ndim > 1:
                        data = np.mean(data, axis=1)
                    return parselmouth.Sound(data, sampling_frequency=float(sr))
            except Exception:
                pass
        # Lớp 2: Nếu soundfile không đọc được, thử giải mã bằng pydub về chuẩn 16kHz, 1 kênh, 16-bit
        if HAS_PYDUB:
            try:
                audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
                audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
                raw_samples = audio.get_array_of_samples()
                if len(raw_samples) > 0:
                    samples = np.array(raw_samples, dtype=np.float64) / 32768.0
                    return parselmouth.Sound(samples, sampling_frequency=16000.0)
            except Exception as pydub_err:
                logger.debug("pydub convert_to_praat_sound error, falling back to ffmpeg: %s", pydub_err)

        # Lớp 3: Dùng ffmpeg làm phương án dự phòng để giải mã các định dạng đặc thù (ví dụ WebM từ trình duyệt)
        decoded_data, decoded_sr = preprocessor._decode_via_ffmpeg(audio_bytes, "audio.webm")
        if decoded_data is not None and len(decoded_data) > 0:
            return parselmouth.Sound(decoded_data.astype(np.float64), sampling_frequency=float(decoded_sr))
        return parselmouth.Sound(audio_bytes)
    except UnsupportedAudioError:
        raise
    except Exception as conv_err:
        logger.warning("Lỗi chuyển đổi âm thanh sang WAV: %s. Thử nạp trực tiếp...", conv_err)
        try:
            return parselmouth.Sound(audio_bytes)
        except Exception as direct_err:
            logger.error("Không thể tạo parselmouth.Sound từ audio_bytes: %s", direct_err)
            raise UnsupportedAudioError(f"Không thể giải mã dữ liệu âm thanh: {direct_err}")


class AudioPreprocessor:
    """
    Quy trình tiền xử lý âm thanh đầu vào (Audio Preprocessing Pipeline):
    1. Giải mã âm thanh từ nhiều định dạng đầu vào (.wav, .mp3, .m4a, .webm, .ogg)
    2. Gộp âm thanh đa kênh (stereo) thành 1 kênh duy nhất (mono)
    3. Chuyển đổi tần số lấy mẫu về mức chuẩn 16.000 Hz (16kHz)
    4. Chuẩn hóa biên độ để cân bằng âm lượng
    5. Khử nhiễu bằng bộ lọc thông dải Butterworth SOS (80Hz - 7500Hz)
    """

    def __init__(self, target_sample_rate: int = settings.SAMPLE_RATE):
        """Khởi tạo bộ tiền xử lý với tần số lấy mẫu mục tiêu (mặc định 16kHz) và bộ lọc thông dải giọng nói."""
        self.target_sample_rate = target_sample_rate
        # Thiết kế bộ lọc thông dải Butterworth bậc 4 (giữ lại tần số 80 Hz - 7500 Hz ở chuẩn 16kHz, loại bỏ tiếng ù trầm và tiếng rít cao)
        nyquist = self.target_sample_rate / 2.0
        low = 80.0 / nyquist
        high = min(7500.0, nyquist - 100.0) / nyquist
        self.sos = scipy.signal.butter(4, [low, high], btype="bandpass", output="sos")

    def decode_and_resample(self, audio_bytes: bytes, filename: str = "audio.wav") -> np.ndarray:
        """
        Giải mã chuỗi byte âm thanh thô thành mảng số thực float32 chuẩn hóa (1 kênh mono, tần số 16kHz).
        Tự động giải mã WebM, Opus, MP3, M4A, OGG, WAV một cách an toàn qua nhiều lớp dự phòng.
        """
        if not audio_bytes or len(audio_bytes) == 0:
            raise EmptySpeechError("Dữ liệu âm thanh rỗng (0 bytes).")

        data: Optional[np.ndarray] = None
        sr: int = self.target_sample_rate

        # 1. Thử đọc bằng soundfile ngay trong RAM trước (WAV, FLAC, OGG nhanh tức thời, không cần gọi tiến trình con)
        if HAS_SOUNDFILE:
            try:
                with io.BytesIO(audio_bytes) as bio:
                    data, sr = sf.read(bio, dtype="float32")
            except Exception:
                data = None

        # 2. Thử giải mã qua pydub nếu soundfile không hỗ trợ định dạng (như WebM/Opus, MP3, M4A)
        if data is None and HAS_PYDUB:
            try:
                audio_seg = AudioSegment.from_file(io.BytesIO(audio_bytes))
                audio_seg = audio_seg.set_frame_rate(self.target_sample_rate).set_channels(1).set_sample_width(2)
                raw_samples = audio_seg.get_array_of_samples()
                if len(raw_samples) > 0:
                    data = np.array(raw_samples, dtype=np.float32) / 32768.0
                    sr = self.target_sample_rate
            except Exception as pydub_err:
                logger.debug("pydub decoding error, falling back: %s", pydub_err)

        # 3. Phương án dự phòng: gọi công cụ dòng lệnh ffmpeg qua tiến trình con
        if data is None:
            data, sr = self._decode_via_ffmpeg(audio_bytes, filename)

        if data is None or len(data) == 0:
            raise EmptySpeechError("Không thể trích xuất tín hiệu âm thanh hợp lệ từ file ghi âm.")

        # Bước chuẩn hóa 1: Nếu âm thanh có nhiều kênh (stereo), tính trung bình các kênh để thành 1 kênh (mono)
        if data.ndim > 1:
            data = np.mean(data, axis=1)

        # Bước chuẩn hóa 2: Chuyển đổi tần số lấy mẫu về chuẩn 16kHz nếu tần số gốc khác
        if sr != self.target_sample_rate:
            data = self._resample(data, sr, self.target_sample_rate)

        # Bước chuẩn hóa 3: Chuẩn hóa đỉnh biên độ (Peak Normalization) về mức 0.95 để âm lượng đồng đều
        max_val = np.max(np.abs(data))
        if max_val > 1e-4:
            data = (data / max_val) * 0.95

        # Bước chuẩn hóa 4: Lọc thông dải (80Hz - 7500Hz) để triệt tiêu tiếng ù nền tần số thấp và nhiễu rít tần số cao
        data = self._apply_bandpass_filter(data)

        return data.astype(np.float32)

    def _decode_via_ffmpeg(self, audio_bytes: bytes, filename: str) -> Tuple[np.ndarray, int]:
        """Giải mã âm thanh bằng công cụ dòng lệnh ffmpeg qua đường ống (pipe) thành dữ liệu PCM float32, 1 kênh, 16kHz."""
        suffix = Path(filename).suffix.lower() or ".wav"
        if suffix not in [".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".webm"]:
            suffix = ".webm"

        # Ghi dữ liệu nhị phân ra tệp tạm để ffmpeg đọc được phần đầu định dạng (container header)
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_in:
            temp_in.write(audio_bytes)
            temp_in_path = temp_in.name

        try:
            ffmpeg_cmd = get_ffmpeg_executable() or FFMPEG_BIN
            if not ffmpeg_cmd:
                raise UnsupportedAudioError("Máy chủ chưa cấu hình bộ giải mã ffmpeg để đọc định dạng âm thanh này.")
            # Cấu hình tham số: bỏ luồng hình (-vn), ép 1 kênh (-ac 1), đổi tần số (-ar), xuất luồng PCM float32 (-f f32le)
            cmd = [
                ffmpeg_cmd,
                "-y",
                "-i", temp_in_path,
                "-vn",
                "-ac", "1",
                "-ar", str(self.target_sample_rate),
                "-f", "f32le",
                "-"
            ]
            process = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=30,
                check=True
            )
            raw_audio = process.stdout
            if not raw_audio:
                raise UnsupportedAudioError("ffmpeg không thể trích xuất dữ liệu âm thanh.")
            audio_data = np.frombuffer(raw_audio, dtype=np.float32)
            return audio_data, self.target_sample_rate
        except subprocess.TimeoutExpired:
            raise UnsupportedAudioError("Quá trình giải mã audio qua ffmpeg bị quá thời gian (timeout).")
        except subprocess.CalledProcessError as ex:
            err_msg = ex.stderr.decode("utf-8", errors="ignore")[:300]
            raise UnsupportedAudioError(f"Lỗi giải mã audio qua ffmpeg: {err_msg}")
        except FileNotFoundError:
            raise UnsupportedAudioError("Máy chủ chưa cấu hình bộ giải mã ffmpeg để đọc định dạng âm thanh này.")
        finally:
            # Luôn dọn dẹp tệp tạm sau khi giải mã xong (kể cả khi xảy ra lỗi)
            if os.path.exists(temp_in_path):
                try:
                    os.remove(temp_in_path)
                except Exception:
                    pass

    def _resample(self, audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
        """Chuyển đổi tần số lấy mẫu âm thanh với độ chính xác cao bằng phương pháp lọc đa pha (polyphase resampling)."""
        import math
        # Tìm ước chung lớn nhất để rút gọn tỷ lệ tăng mẫu (up) và giảm mẫu (down)
        gcd = math.gcd(orig_sr, target_sr)
        up = target_sr // gcd
        down = orig_sr // gcd
        resampled = scipy.signal.resample_poly(audio, up, down)
        return resampled

    def _apply_bandpass_filter(self, audio: np.ndarray) -> np.ndarray:
        """Áp dụng bộ lọc thông dải Butterworth SOS bậc 4 không lệch pha (zero-phase) để làm sạch nhiễu ngoài vùng giọng nói."""
        try:
            filtered = scipy.signal.sosfiltfilt(self.sos, audio)
            return filtered
        except Exception:
            return audio

    @contextmanager
    def export_temp_wav(self, audio: np.ndarray) -> Generator[str, None, None]:
        """Trình quản lý ngữ cảnh (context manager) tạo file WAV tạm 16kHz PCM 16-bit cho Praat và tự động xóa sau khi dùng."""
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            # Giới hạn biên độ trong [-1.0, 1.0] và chuyển sang số nguyên 16-bit chuẩn WAV PCM
            scaled = np.clip(audio, -1.0, 1.0)
            int16_data = (scaled * 32767.0).astype(np.int16)
            if HAS_SOUNDFILE:
                sf.write(tmp_path, int16_data, self.target_sample_rate, subtype="PCM_16")
            else:
                with wave.open(tmp_path, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(self.target_sample_rate)
                    wf.writeframes(int16_data.tobytes())
            yield tmp_path
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass


# Thể hiện dùng chung duy nhất (singleton) của bộ tiền xử lý âm thanh
preprocessor = AudioPreprocessor()
