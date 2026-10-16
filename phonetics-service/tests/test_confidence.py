from app.models.alignment import AlignedWord, AlignedPhoneme
from app.schemas import AudioQualityMetrics, EvaluationStatus
from app.services.confidence import confidence_estimator


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
