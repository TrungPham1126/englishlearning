import numpy as np

try:
    import pytest
except ImportError:
    pytest = None

from app.exceptions import (
    AudioQualityTooLowError,
    AudioTooShortError,
    AudioTooLongError,
    EmptySpeechError
)
from app.services.audio_quality import quality_gate


def test_quality_gate_normal_audio():
    # 2 seconds: 0.5s silence, 1.0s speech burst, 0.5s silence
    sr = 16000
    signal = np.zeros(int(2.0 * sr), dtype=np.float32)
    t_burst = np.linspace(0, 1.0, int(1.0 * sr))
    signal[int(0.5 * sr) : int(1.5 * sr)] = 0.5 * np.sin(2 * np.pi * 300 * t_burst)
    signal += 0.001 * np.random.randn(len(signal)).astype(np.float32)
    
    metrics = quality_gate.evaluate(signal, strict=True)
    assert metrics.duration == 2.0
    assert metrics.is_acceptable is True
    assert metrics.estimated_snr > 10.0
    assert metrics.clipping_ratio == 0.0


def test_quality_gate_too_short():
    sr = 16000
    short_audio = np.zeros(int(0.2 * sr), dtype=np.float32)
    try:
        quality_gate.evaluate(short_audio, strict=True)
        assert False, "Should have raised AudioTooShortError"
    except AudioTooShortError:
        pass


def test_quality_gate_silent_audio():
    sr = 16000
    silent_audio = np.zeros(int(2.0 * sr), dtype=np.float32)
    try:
        quality_gate.evaluate(silent_audio, strict=True)
        assert False, "Should have raised EmptySpeechError"
    except EmptySpeechError:
        pass


def test_quality_gate_clipped_audio():
    sr = 16000
    clipped_audio = np.ones(int(2.0 * sr), dtype=np.float32) * 0.999
    try:
        quality_gate.evaluate(clipped_audio, strict=True)
        assert False, "Should have raised AudioQualityTooLowError"
    except AudioQualityTooLowError:
        pass
