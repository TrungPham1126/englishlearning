import pytest

from app.models.alignment import AlignedWord, AlignedPhoneme
from app.schemas import AudioQualityMetrics, EvaluationStatus
from app.services.confidence import ConfidenceEstimator, confidence_estimator


def test_confidence_estimation():
    quality = AudioQualityMetrics(
        duration=2.5,
        rms=0.08,
        peak=0.7,
        clipping_ratio=0.0,
        silence_ratio=0.3,
        speech_ratio=0.7,
        estimated_snr=22.0,
        dynamic_range=28.0,
        is_acceptable=True
    )
    audio_conf = confidence_estimator.estimate_audio_confidence(quality)
    assert audio_conf > 0.80

    w = AlignedWord(
        word="test",
        start=0.1,
        end=0.6,
        confidence=0.92,
        phonemes=[
            AlignedPhoneme(symbol="t", start=0.1, end=0.2, posterior=0.88, confidence=0.88),
            AlignedPhoneme(symbol="e", start=0.2, end=0.4, posterior=0.92, confidence=0.92),
            AlignedPhoneme(symbol="s", start=0.4, end=0.5, posterior=0.85, confidence=0.85),
            AlignedPhoneme(symbol="t", start=0.5, end=0.6, posterior=0.90, confidence=0.90),
        ]
    )
    overall_conf = confidence_estimator.estimate_overall_confidence(audio_conf, 0.90, [w])
    assert 0.80 <= overall_conf <= 1.0

    status = confidence_estimator.determine_evaluation_status(overall_conf, 0.90, quality)
    assert status == EvaluationStatus.SUCCESS


def _make_quality(
    *,
    is_acceptable: bool = True,
    clipping_ratio: float = 0.0,
    estimated_snr: float = 20.0,
    duration: float = 2.0,
) -> AudioQualityMetrics:
    return AudioQualityMetrics(
        duration=duration,
        rms=0.08,
        peak=0.7,
        clipping_ratio=clipping_ratio,
        silence_ratio=0.2,
        speech_ratio=0.8,
        estimated_snr=estimated_snr,
        dynamic_range=25.0,
        is_acceptable=is_acceptable,
    )


def test_estimate_audio_confidence_penalties_and_clamp():
    est = ConfidenceEstimator()

    unacceptable = est.estimate_audio_confidence(_make_quality(is_acceptable=False))
    assert unacceptable == 0.30

    # Lowest computable acceptable score with max clipping, 0 SNR, 0 dynamic range, high silence
    low_acceptable_quality = AudioQualityMetrics(
        duration=0.5,
        rms=0.05,
        peak=0.5,
        clipping_ratio=0.9,
        silence_ratio=0.9,
        speech_ratio=0.1,
        estimated_snr=0.0,
        dynamic_range=0.0,
        is_acceptable=True,
    )
    assert est.estimate_audio_confidence(low_acceptable_quality) == pytest.approx(0.1785, abs=1e-4)

    clean_short = est.estimate_audio_confidence(_make_quality(duration=0.5, clipping_ratio=0.04, estimated_snr=8.0))
    assert 0.40 <= clean_short <= 0.45


def test_estimate_phoneme_confidence_branches():
    vowel = AlignedPhoneme(symbol="iː", start=0.1, end=0.2, posterior=0.8, confidence=0.8, phoneme_type="vowel")
    assert confidence_estimator.estimate_phoneme_confidence(vowel, measured_f1=300.0, status="OK") == pytest.approx(0.895, abs=1e-4)
    assert confidence_estimator.estimate_phoneme_confidence(vowel, measured_f1=None, status="OK") == pytest.approx(0.76, abs=1e-4)
    assert confidence_estimator.estimate_phoneme_confidence(vowel, measured_f1=300.0, status="TOO_SHORT") == pytest.approx(0.76, abs=1e-4)

    low_post_vowel = AlignedPhoneme(symbol="iː", start=0.1, end=0.11, posterior=0.01, confidence=0.1, phoneme_type="vowel")
    assert confidence_estimator.estimate_phoneme_confidence(low_post_vowel, measured_f1=None, status="INVALID") == pytest.approx(0.342, abs=1e-3)

    cons = AlignedPhoneme(symbol="p", start=0.0, end=0.1, posterior=0.9, confidence=0.9, phoneme_type="consonant")
    assert confidence_estimator.estimate_phoneme_confidence(cons) == pytest.approx(0.93, abs=1e-4)


def test_estimate_overall_confidence_and_determine_evaluation_status_all_paths():
    assert confidence_estimator.estimate_overall_confidence(0.9, 0.8, []) == pytest.approx(0.72, abs=1e-6)

    weak_word = AlignedWord(word="bad", start=0.0, end=0.2, confidence=0.2, phonemes=[])
    penalized = confidence_estimator.estimate_overall_confidence(0.9, 0.85, [weak_word])
    assert penalized < 0.70

    q_ok = _make_quality(is_acceptable=True)
    q_bad = _make_quality(is_acceptable=False)

    assert confidence_estimator.determine_evaluation_status(0.9, 0.9, q_bad) == EvaluationStatus.AUDIO_QUALITY_TOO_LOW
    assert confidence_estimator.determine_evaluation_status(0.9, 0.05, q_ok) == EvaluationStatus.ALIGNMENT_FAILED
    assert confidence_estimator.determine_evaluation_status(0.2, 0.9, q_ok) == EvaluationStatus.LOW_CONFIDENCE
    assert confidence_estimator.determine_evaluation_status(0.52, 0.9, q_ok) == EvaluationStatus.PARTIAL_EVALUATION
    assert confidence_estimator.determine_evaluation_status(0.80, 0.9, q_ok) == EvaluationStatus.SUCCESS

    # Kiểm tra nhánh alignment_conf < 0.45 -> LOW_CONFIDENCE và alignment_conf < 0.60 -> PARTIAL_EVALUATION
    assert confidence_estimator.determine_evaluation_status(0.75, 0.42, q_ok) == EvaluationStatus.LOW_CONFIDENCE
    assert confidence_estimator.determine_evaluation_status(0.75, 0.55, q_ok) == EvaluationStatus.PARTIAL_EVALUATION

    # Kiểm tra non-plosive consonant ('s') dùng target_dur = 0.045 và kẹp dur_factor tối thiểu 0.75
    short_fricative = AlignedPhoneme(symbol="/s/", start=0.0, end=0.01, posterior=0.80, confidence=0.80, phoneme_type="consonant")
    assert confidence_estimator.estimate_phoneme_confidence(short_fricative) == pytest.approx(0.80 * 0.70 + 0.75 * 0.30, abs=1e-4)

