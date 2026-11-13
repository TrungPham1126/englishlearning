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
from app.services.audio_quality import (
    AudioQualityGate,
    check_consonant_acoustic_evidence,
    check_consonant_acoustic_evidence_detailed,
    quality_gate,
)


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


def test_quality_gate_duration_boundaries_and_too_long():
    sr = 16000
    t_min = np.linspace(0, 0.4, int(0.4 * sr), endpoint=False)
    min_sig = (0.4 * np.sin(2 * np.pi * 300 * t_min)).astype(np.float32)
    assert quality_gate.evaluate(min_sig, strict=True).duration == 0.4

    t_active = np.linspace(0, 0.8, int(0.8 * sr), endpoint=False)
    one_sec = np.concatenate([
        np.zeros(int(0.2 * sr), dtype=np.float32),
        (0.4 * np.sin(2 * np.pi * 300 * t_active)).astype(np.float32),
    ])
    max_sig = np.tile(one_sec, 45)
    assert quality_gate.evaluate(max_sig, strict=True).duration == 45.0

    over_max = np.ones(int(45.5 * sr), dtype=np.float32) * 0.2
    with pytest.raises(AudioTooLongError):
        quality_gate.evaluate(over_max, strict=True)


def test_quality_gate_pure_noise_strict_and_nonstrict():
    rng = np.random.default_rng(42)
    pure_noise = (0.25 * rng.standard_normal(int(1.8 * 16000))).astype(np.float32)

    with pytest.raises(AudioQualityTooLowError):
        quality_gate.evaluate(pure_noise, strict=True)

    metrics = quality_gate.evaluate(pure_noise, strict=False)
    assert metrics.is_acceptable is False
    assert any("noise" in w.lower() for w in metrics.warnings)


def test_quality_gate_severe_clipping_nonstrict_sets_unacceptable():
    sr = 16000
    clipped = np.ones(int(1.5 * sr), dtype=np.float32) * 0.995
    gate = AudioQualityGate()
    metrics = gate.evaluate(clipped, strict=False)
    assert metrics.is_acceptable is False
    assert metrics.clipping_ratio > 0.10
    assert any("clipping" in w.lower() for w in metrics.warnings)


def test_quality_gate_low_peak_or_rms_raises_empty_speech():
    t = np.linspace(0, 1.0, 16000, endpoint=False)
    quiet = (0.0025 * np.sin(2 * np.pi * 300 * t)).astype(np.float32)
    with pytest.raises(EmptySpeechError):
        quality_gate.evaluate(quiet, strict=True)


def test_check_consonant_acoustic_evidence_all_phoneme_classes():
    sr = 16000
    rng = np.random.default_rng(99)

    # Too short (< 10ms = 160 samples)
    ok_short, rms_short, reason_short = check_consonant_acoustic_evidence_detailed(np.zeros(80, dtype=np.float32), "s", sr)
    assert ok_short is False and rms_short == 0.0 and "10ms" in reason_short

    zeros = np.zeros(800, dtype=np.float32)
    white_burst = (0.15 * rng.standard_normal(800)).astype(np.float32)
    t = np.linspace(0, 0.05, 800, endpoint=False)
    low_tone = (0.2 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)

    # Sibilant ('s'): passes broadband/high-freq noise, fails silence
    assert check_consonant_acoustic_evidence_detailed(white_burst, "s", sr)[0] is True
    assert check_consonant_acoustic_evidence_detailed(zeros, "s", sr)[0] is False

    # Weak fricative ('f', 'h')
    assert check_consonant_acoustic_evidence_detailed(white_burst, "f", sr)[0] is True
    assert check_consonant_acoustic_evidence_detailed(zeros, "h", sr)[0] is False

    # Plosive ('p', 'tʃ')
    plosive_burst = zeros.copy()
    plosive_burst[200:360] = 0.25 * rng.standard_normal(160)
    assert check_consonant_acoustic_evidence_detailed(plosive_burst, "p", sr)[0] is True
    assert check_consonant_acoustic_evidence_detailed(zeros, "tʃ", sr)[0] is False

    # Nasal ('m') & Liquid ('l') & Default ('j')
    assert check_consonant_acoustic_evidence_detailed(low_tone, "m", sr)[0] is True
    assert check_consonant_acoustic_evidence_detailed(zeros, "ŋ", sr)[0] is False
    assert check_consonant_acoustic_evidence_detailed(low_tone, "l", sr)[0] is True
    assert check_consonant_acoustic_evidence_detailed(zeros, "ɹ", sr)[0] is False
    assert check_consonant_acoustic_evidence(low_tone, "j") is True
    assert check_consonant_acoustic_evidence(zeros, "w") is False
