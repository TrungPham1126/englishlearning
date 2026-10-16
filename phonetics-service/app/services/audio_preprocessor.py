import io
import os
import subprocess
import tempfile
import wave
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Tuple

import numpy as np
import scipy.signal

try:
    import soundfile as sf
    HAS_SOUNDFILE = True
except ImportError:
    sf = None
    HAS_SOUNDFILE = False

from app.config import settings
from app.exceptions import UnsupportedAudioError


class AudioPreprocessor:
    """
    Audio preprocessing pipeline:
    1. Decode multi-format inputs (.wav, .mp3, .m4a)
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
        Uses soundfile first, falling back to ffmpeg for compressed formats (.m4a, .mp3).
        """
        data: np.ndarray
        sr: int

        # Attempt in-memory soundfile decoding
        try:
            with io.BytesIO(audio_bytes) as bio:
                data, sr = sf.read(bio, dtype="float32")
        except Exception:
            # Fallback to ffmpeg subprocess decoding for .m4a, webm, etc.
            data, sr = self._decode_via_ffmpeg(audio_bytes, filename)

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
            raise UnsupportedAudioError(f"Đuôi file '{suffix}' không được hỗ trợ.")

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_in:
            temp_in.write(audio_bytes)
            temp_in_path = temp_in.name

        try:
            cmd = [
                "ffmpeg",
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
                check=True
            )
            raw_audio = process.stdout
            if not raw_audio:
                raise UnsupportedAudioError("ffmpeg không thể trích xuất dữ liệu âm thanh.")
            audio_data = np.frombuffer(raw_audio, dtype=np.float32)
            return audio_data, self.target_sample_rate
        except subprocess.CalledProcessError as ex:
            err_msg = ex.stderr.decode("utf-8", errors="ignore")[:300]
            raise UnsupportedAudioError(f"Lỗi giải mã audio qua ffmpeg: {err_msg}")
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
            # sosfiltfilt provides zero-phase forward-backward filtering
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
            # Scale float32 [-1.0, 1.0] to int16
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
