"""
Test-only audio composition helpers for ELP phonetics regression tests.
All synthetic data lives in tests/ only and is never used by production code.
"""
import io
import wave
from pathlib import Path

import numpy as np

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"
SR = 16000

FULL_SENTENCE = "Consistent pronunciation practice and phonemic awareness enhance oral fluency."


def _ensure_fixture_wav(name: str, text: str) -> Path:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    wav_path = FIXTURE_DIR / name
    if wav_path.exists():
        return wav_path
    import gtts
    import soundfile as sf
    import scipy.signal
    mp3_path = FIXTURE_DIR / (name.replace(".wav", ".mp3"))
    if not mp3_path.exists():
        tts = gtts.gTTS(text, lang="en", tld="com")
        tts.save(str(mp3_path))
    data, orig_sr = sf.read(str(mp3_path), dtype="float32")
    if data.ndim > 1:
        data = np.mean(data, axis=1)
    if orig_sr != SR:
        import math
        g = math.gcd(orig_sr, SR)
        data = scipy.signal.resample_poly(data, SR // g, orig_sr // g).astype(np.float32)
    pcm = (np.clip(data, -1.0, 1.0) * 32767).astype(np.int16)
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())
    return wav_path


def read_wav(name: str) -> np.ndarray:
    text = FULL_SENTENCE if "full" in name else "Consistent pronunciation"
    wav_path = _ensure_fixture_wav(name, text)
    with wave.open(str(wav_path), "rb") as wf:
        assert wf.getframerate() == SR and wf.getnchannels() == 1
        raw = wf.readframes(wf.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def silence(sec: float) -> np.ndarray:
    return np.zeros(int(sec * SR), dtype=np.float32)


def noise(sec: float, level: float = 0.02, seed: int = 7) -> np.ndarray:
    """Broadband background hiss/hum (room noise, fan) — NOT speech."""
    rng = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    hiss = rng.normal(0.0, level, n)
    hum = 0.5 * level * np.sin(2 * np.pi * 50.0 * t)
    return (hiss + hum).astype(np.float32)


def to_wav_bytes(audio: np.ndarray) -> bytes:
    pcm = np.clip(audio, -1.0, 1.0)
    pcm = (pcm * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


def case_full() -> bytes:
    return to_wav_bytes(np.concatenate([silence(0.4), read_wav("tts_full.wav"), silence(0.6)]))


def case_half_then_silence() -> bytes:
    # Student reads only "Consistent pronunciation" then keeps the recorder running.
    return to_wav_bytes(np.concatenate([silence(0.4), read_wav("tts_half.wav"), silence(4.0)]))


def case_total_silence() -> bytes:
    return to_wav_bytes(silence(4.0))


def case_half_then_noise() -> bytes:
    # Low room noise throughout + louder background noise in the trailing part.
    half = read_wav("tts_half.wav")
    speech = np.concatenate([silence(0.4), half])
    speech = speech + noise(len(speech) / SR, level=0.002, seed=1)
    tail = noise(4.0, level=0.02, seed=2)
    return to_wav_bytes(np.concatenate([speech, tail]))

