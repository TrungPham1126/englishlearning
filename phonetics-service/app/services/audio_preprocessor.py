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

# 1. Discover or configure ffmpeg executable
def get_ffmpeg_executable() -> str:
    """Finds ffmpeg CLI executable from system PATH or bundled imageio-ffmpeg."""
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    try:
        import imageio_ffmpeg
        bundled = imageio_ffmpeg.get_ffmpeg_exe()
        if bundled and os.path.exists(bundled):
            b_dir = os.path.dirname(bundled)
            # Create a copy or symlink named ffmpeg.exe if needed
            target_exe = os.path.join(b_dir, "ffmpeg.exe")
            if not os.path.exists(target_exe):
                try:
                    shutil.copyfile(bundled, target_exe)
                except Exception:
                    pass
            # Inject directory into PATH for subprocess calls & pydub
            if b_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = b_dir + os.pathsep + os.environ.get("PATH", "")
            return target_exe if os.path.exists(target_exe) else bundled
    except Exception as ex:
        logger.warning("imageio-ffmpeg discovery warning: %s", ex)

    return "ffmpeg"


FFMPEG_BIN = get_ffmpeg_executable()

# 2. Configure pydub
try:
    import pydub
    from pydub import AudioSegment
    if FFMPEG_BIN:
        pydub.AudioSegment.converter = FFMPEG_BIN
    HAS_PYDUB = True
except Exception:
    HAS_PYDUB = False

# 3. Soundfile support
try:
    import soundfile as sf
    HAS_SOUNDFILE = True
except ImportError:
    sf = None
    HAS_SOUNDFILE = False

# 4. Parselmouth support
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
    Chuyển đổi âm thanh bất kỳ (WebM, Opus, Ogg, MP3, WAV) thành parselmouth.Sound (16kHz PCM WAV Mono).
    Bảo đảm không làm hỏng dữ liệu nhị phân khi nạp vào Praat.
    """
    if not HAS_PARSELMOUTH:
        raise RuntimeError("parselmouth library is not installed.")

    try:
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
    Audio preprocessing pipeline:
    1. Decode multi-format inputs (.wav, .mp3, .m4a, .webm, .ogg)
    2. Convert stereo to mono
    3. Resample to standard 16,000 Hz
    4. Amplitude normalization
    5. Denoise with Butterworth SOS Band-pass filter (80Hz - 7500Hz) fallback
    """

    def __init__(self, target_sample_rate: int = settings.SAMPLE_RATE):
        self.target_sample_rate = target_sample_rate
        # Design 4th order Butterworth bandpass filter (80 Hz to 7500 Hz at 16kHz)
        nyquist = self.target_sample_rate / 2.0
        low = 80.0 / nyquist
        high = min(7500.0, nyquist - 100.0) / nyquist
        self.sos = scipy.signal.butter(4, [low, high], btype="bandpass", output="sos")

    def decode_and_resample(self, audio_bytes: bytes, filename: str = "audio.wav") -> np.ndarray:
        """
        Decodes raw audio bytes into normalized 16kHz float32 mono numpy array.
        Tự động giải mã WebM, Opus, MP3, M4A, OGG, WAV một cách an toàn.
        """
        if not audio_bytes or len(audio_bytes) == 0:
            raise EmptySpeechError("Dữ liệu âm thanh rỗng (0 bytes).")

        data: Optional[np.ndarray] = None
        sr: int = self.target_sample_rate

        # 1. Thử soundfile trước trong RAM (WAV, FLAC, OGG nhanh tức thời, không gọi subprocess/ffprobe)
        if HAS_SOUNDFILE:
            try:
                with io.BytesIO(audio_bytes) as bio:
                    data, sr = sf.read(bio, dtype="float32")
            except Exception:
                data = None

        # 2. Thử giải mã qua pydub nếu soundfile không hỗ trợ định dạng (WebM/Opus, MP3, M4A)
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

        # 3. Fallback qua ffmpeg subprocess
        if data is None:
            data, sr = self._decode_via_ffmpeg(audio_bytes, filename)

        if data is None or len(data) == 0:
            raise EmptySpeechError("Không thể trích xuất tín hiệu âm thanh hợp lệ từ file ghi âm.")

        # 1. Convert multi-channel to mono
        if data.ndim > 1:
            data = np.mean(data, axis=1)

        # 2. Resample if needed
        if sr != self.target_sample_rate:
            data = self._resample(data, sr, self.target_sample_rate)

        # 3. Peak Normalization
        max_val = np.max(np.abs(data))
        if max_val > 1e-4:
            data = (data / max_val) * 0.95

        # 4. Band-pass filtering (80Hz - 7500Hz) for rumble & high-freq noise suppression
        data = self._apply_bandpass_filter(data)

        return data.astype(np.float32)

    def _decode_via_ffmpeg(self, audio_bytes: bytes, filename: str) -> Tuple[np.ndarray, int]:
        """Decodes audio using ffmpeg CLI pipe into 16kHz mono PCM float32."""
        suffix = Path(filename).suffix.lower() or ".wav"
        if suffix not in [".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".webm"]:
            suffix = ".webm"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_in:
            temp_in.write(audio_bytes)
            temp_in_path = temp_in.name

        try:
            ffmpeg_cmd = get_ffmpeg_executable() or FFMPEG_BIN
            if not ffmpeg_cmd:
                raise UnsupportedAudioError("Máy chủ chưa cấu hình bộ giải mã ffmpeg để đọc định dạng âm thanh này.")
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
            if os.path.exists(temp_in_path):
                try:
                    os.remove(temp_in_path)
                except Exception:
                    pass

    def _resample(self, audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
        """High-precision polyphase resampler."""
        import math
        gcd = math.gcd(orig_sr, target_sr)
        up = target_sr // gcd
        down = orig_sr // gcd
        resampled = scipy.signal.resample_poly(audio, up, down)
        return resampled

    def _apply_bandpass_filter(self, audio: np.ndarray) -> np.ndarray:
        """Applies zero-phase 4th order Butterworth SOS bandpass filter."""
        try:
            filtered = scipy.signal.sosfiltfilt(self.sos, audio)
            return filtered
        except Exception:
            return audio

    @contextmanager
    def export_temp_wav(self, audio: np.ndarray) -> Generator[str, None, None]:
        """Context manager to safely create and clean up 16kHz PCM16 WAV file for Praat."""
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        try:
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


# Singleton preprocessor
preprocessor = AudioPreprocessor()
