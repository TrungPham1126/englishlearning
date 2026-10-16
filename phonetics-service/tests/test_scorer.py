from app.models.alignment import AlignedPhoneme, PauseEvent
from app.schemas import PhonemeSchema, PhonemeType, MeasurementStatus
from app.services.scorer import scorer


def test_vowel_scoring_formula():
    score = scorer.score_vowel(formant_score=90.0, acoustic_confidence=0.9, alignment_confidence=0.85)
    assert 83.0 <= score <= 90.0


def test_consonant_gop_scoring():
    high_score = scorer.score_consonant_gop(posterior=0.95, duration=0.06, alignment_confidence=0.9)
    low_score = scorer.score_consonant_gop(posterior=0.02, duration=0.04, alignment_confidence=0.5)
    assert high_score > 85.0
    assert low_score < 55.0


def test_word_scoring_stress_and_critical_penalty():
    # Word with normal phonemes
    p1 = PhonemeSchema(symbol="k", type=PhonemeType.CONSONANT, score=90.0, status=MeasurementStatus.OK)
    p2 = PhonemeSchema(symbol="æ", type=PhonemeType.VOWEL, score=85.0, status=MeasurementStatus.OK)
    p3 = PhonemeSchema(symbol="t", type=PhonemeType.CONSONANT, score=88.0, status=MeasurementStatus.OK)
    
    al1 = AlignedPhoneme(symbol="k", start=0.0, end=0.05, is_stress=False)
    al2 = AlignedPhoneme(symbol="æ", start=0.05, end=0.15, is_stress=True)
    al3 = AlignedPhoneme(symbol="t", start=0.15, end=0.20, is_word_final=True)

    normal_word_score = scorer.score_word([p1, p2, p3], [al1, al2, al3])
    assert normal_word_score > 85.0

    # Word with critical phoneme failure (score = 15.0)
    p2_failed = PhonemeSchema(symbol="æ", type=PhonemeType.VOWEL, score=15.0, status=MeasurementStatus.OK)
    failed_word_score = scorer.score_word([p1, p2_failed, p3], [al1, al2, al3])
    # Must be penalized significantly below simple average
    assert failed_word_score < 55.0


def test_fluency_and_completeness_scoring():
    # Fluency calculation
    fluency = scorer.calculate_fluency_score(
        pause_events=[],
        awkward_pause_count=0,
        pause_ratio=0.1,
        wpm=120.0,
        speech_ratio=0.9
    )
    assert fluency >= 80.0

    # Completeness scaling
    comp_full = scorer.calculate_completeness_score(spoken_count=9, total_expected=9)
    assert comp_full == 100.0

    comp_half = scorer.calculate_completeness_score(spoken_count=2, total_expected=9)
    assert 20.0 <= comp_half <= 25.0


def test_overall_score_clamping():
    score = scorer.calculate_overall_score(pronunciation=85.0, fluency=80.0, prosody=90.0, completeness=100.0)
    assert 84.0 <= score <= 86.5

    # With low completeness (e.g. 22%), overall score is scaled down
    score_low_comp = scorer.calculate_overall_score(pronunciation=85.0, fluency=80.0, prosody=90.0, completeness=22.2)
    assert score_low_comp <= 25.0
