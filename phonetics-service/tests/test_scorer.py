import json
import numpy as np
import pytest

from app.models.alignment import AlignedPhoneme, AlignedWord, AlignmentResult, PauseEvent
from app.schemas import (
    AudioQualityMetrics,
    MeasurementStatus,
    PhonemeSchema,
    PhonemeType,
    SpokenWordStatus,
    WordSchema,
)
from app.services.formant_service import UtteranceAcoustics
from app.services.scorer import (
    Scorer,
    ScoringCalibrator,
    _gop_margin_to_score,
    extract_utterance_acoustic_features,
    generate_phoneme_pedagogical_feedback,
    scorer,
)


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


def test_vowels_json_dynamic_loading_and_full_2x2_covariance(tmp_path):
    """Validates FormantService loads en-US-male/female from disk and respects full 2x2 covariance."""
    import json
    from app.services.formant_service import FormantService

    custom_vowels = {
        "en-US": {
            "iː": {"name": "FLEECE", "mean": [300.0, 2300.0], "std": [55.0, 220.0]},
        },
        "en-US-male": {
            "æ": {
                "name": "Emp TRAP Male",
                "mean": [650.0, 1650.0],
                "std": [70.0, 150.0],
                # Positive off-diagonal correlation (+0.7 * 70 * 150 = +7350)
                "covariance": [[4900.0, 7350.0], [7350.0, 22500.0]],
            }
        },
        "en-US-female": {},
    }
    vp = tmp_path / "vowels.json"
    vp.write_text(json.dumps(custom_vowels), encoding="utf-8")

    fs = FormantService(profiles_path=vp)
    assert "æ" in fs.loaded_gender_profiles["MALE"]
    ref = fs.loaded_gender_profiles["MALE"]["æ"]
    # Point along positive correlated axis (+2.5 sigma F1, +2.5 sigma F2) sits well inside the ellipse
    # compared to orthogonal (-2.5 sigma F1, +2.5 sigma F2), outside the +-24% relative tolerance box.
    sc_corr, _ = fs._score_mahalanobis(825.0, 2025.0, ref["mean"][0], ref["mean"][1], ref)
    sc_orth, _ = fs._score_mahalanobis(475.0, 2025.0, ref["mean"][0], ref["mean"][1], ref)
    assert sc_corr > sc_orth + 10.0


def test_scoring_calibrator_loading_and_monotonic_prediction(tmp_path):
    """Validates ScoringCalibrator loads JSON weights/knots, predicts monotonically, and falls back when absent."""
    import json
    from app.services.scorer import ScoringCalibrator

    cal_path = tmp_path / "calibration.json"
    cal_data = {
        "thresholds": {"pass_overall": 80.0},
        "models": {
            "overall": {
                "features": ["raw_pronunciation", "wpm"],
                "means": [70.0, 130.0],
                "stds": [15.0, 30.0],
                "weights": [12.0, 3.0],
                "intercept": 70.0,
                "min_score": 25.0,
                "max_score": 99.0,
                "x_knots": [40.0, 70.0, 95.0],
                "y_knots": [42.0, 72.0, 96.0],
            }
        },
    }
    cal_path.write_text(json.dumps(cal_data), encoding="utf-8")

    cal = ScoringCalibrator(calibration_path=cal_path)
    assert cal.has_model("overall")
    low = cal.predict_component("overall", {"raw_pronunciation": 45.0, "wpm": 90.0})
    mid = cal.predict_component("overall", {"raw_pronunciation": 70.0, "wpm": 130.0})
    high = cal.predict_component("overall", {"raw_pronunciation": 95.0, "wpm": 150.0})
    assert low is not None and mid is not None and high is not None
    assert 25.0 <= low < mid < high <= 99.0

    # Missing file falls back cleanly to identity mode
    missing_cal = ScoringCalibrator(calibration_path=tmp_path / "nonexistent.json")
    assert not missing_cal.has_model("overall")
    assert missing_cal.predict_component("overall", {"raw_pronunciation": 70.0}) is None


def test_initial_r_omission_not_softened_only_coda_r():
    """Initial onset /r/ must be strictly penalized when omitted/mispronounced; only coda /r/ gets softening."""
    from app.services.scorer import Scorer

    sc = Scorer(calibrator=None)
    # Initial /r/ in 'red' omitted or substituted: is_coda_r=False -> strict low score
    init_r_bad = sc.score_consonant_gop(
        posterior=0.02,
        duration=0.05,
        alignment_confidence=0.80,
        symbol="r",
        is_word_final=False,
        is_coda_r=False,
        acoustic_multiplier=0.5,
        canonical_posterior=0.01,
        gop_margin=-4.2,
    )
    assert init_r_bad < 35.0

    # Genuine post-vocalic coda /r/ (without strict failure evidence or with non-rhotic tolerance) stays softer
    coda_r_nonrhotic = sc.score_consonant_gop(
        posterior=0.10,
        duration=0.06,
        alignment_confidence=0.75,
        symbol="r",
        is_word_final=True,
        is_coda_r=True,
        acoustic_multiplier=0.75,
    )
    assert coda_r_nonrhotic >= 85.0


def test_unpooled_gop_margin_penalty_on_theta_to_f():
    """Substitutions like /θ/ -> /f/ must score poorly via un-pooled canonical_posterior + gop_margin."""
    from app.services.scorer import Scorer

    sc = Scorer(calibrator=None)
    # Even if pooled error posterior looks high (0.90), canonical /θ/ is 0.02 with negative GOP margin
    sub_score = sc.score_consonant_gop(
        posterior=0.90,
        duration=0.08,
        alignment_confidence=0.88,
        symbol="θ",
        is_word_final=False,
        is_coda_r=False,
        acoustic_multiplier=0.90,
        canonical_posterior=0.02,
        gop_margin=-3.8,
    )
    good_score = sc.score_consonant_gop(
        posterior=0.88,
        duration=0.08,
        alignment_confidence=0.88,
        symbol="θ",
        is_word_final=False,
        is_coda_r=False,
        acoustic_multiplier=0.95,
        canonical_posterior=0.85,
        gop_margin=3.1,
    )
    assert sub_score < 35.0
    assert good_score >= 80.0


def test_calculate_speed_score():
    """Validates independent speed_score calculation rewards target/fast articulation rates and penalizes halting speech."""
    from app.services.scorer import Scorer

    sc = Scorer(calibrator=None)
    good_speed = sc.calculate_speed_score(articulation_rate=4.2, wpm=145.0)
    fast_speed = sc.calculate_speed_score(articulation_rate=7.34, wpm=220.0)
    halting_speed = sc.calculate_speed_score(articulation_rate=1.3, wpm=55.0)
    assert good_speed >= 90.0
    assert fast_speed >= 75.0
    assert halting_speed < 60.0


def test_gentle_beginner_vowel_and_high_proficiency_overall_calibration():
    """Validates gentle beginner vowel leniency and consistent overall score for strong pron/fluency."""
    from pathlib import Path
    from app.services.scorer import Scorer, ScoringCalibrator

    cal_path = Path(__file__).resolve().parents[1] / "reference_profiles" / "calibration.json"
    cal = ScoringCalibrator(cal_path)
    sc = Scorer(calibrator=cal)

    vowel_score = sc.score_vowel(
        formant_score=82.0,
        acoustic_confidence=0.85,
        alignment_confidence=0.80,
        posterior=0.35,
        symbol="e",
        canonical_posterior=0.22,
        gop_margin=-0.5,
    )
    assert vowel_score >= 80.0

    out = sc.calibrate_utterance_scores(
        raw_pronunciation=90.5,
        raw_fluency=94.3,
        raw_prosody=80.0,
        completeness=100.0,
        features={
            "raw_pronunciation": 90.5,
            "mean_phoneme_score": 90.5,
            "p10_phoneme_score": 83.0,
            "p25_phoneme_score": 87.0,
            "std_phoneme_score": 4.5,
            "mean_vowel_score": 91.0,
            "mean_cons_score": 90.0,
            "mean_formant_score": 92.0,
            "mean_word_score": 90.5,
            "min_word_score": 86.0,
            "p20_word_score": 88.0,
            "failed_word_ratio": 0.0,
            "mean_canon_post": 0.72,
            "p15_canon_post": 0.45,
            "mean_gop_margin": 0.50,
            "p15_gop_margin": 0.05,
            "neg_gop_ratio": 0.0,
            "bad_gop_ratio": 0.0,
            "align_confidence": 0.94,
            "whole_file_sim": 0.96,
            "blank_ratio": 0.65,
            "stress_dur_contrast": 1.35,
            "wpm": 185.0,
            "wpm_opt": 100.0,
            "articulation_rate": 7.34,
            "art_rate_opt": 86.0,
            "speech_ratio": 0.88,
            "pause_ratio": 0.05,
            "awkward_pause_ratio": 0.0,
            "hesitation_ratio": 0.0,
            "mean_inter_word_gap": 0.03,
            "gap_std": 0.02,
            "mean_run_length_norm": 1.0,
            "linking_ratio": 0.75,
            "duration_cv": 0.45,
            "completeness_ratio": 1.0,
            "voiced_frame_ratio": 0.75,
            "f0_rel_std": 0.16,
            "f0_iqr_norm": 0.20,
            "f0_range_norm": 0.45,
            "f0_slope_norm": 0.05,
            "stress_rms_contrast": 1.25,
            "stress_f0_contrast": 1.15,
        },
    )
    assert out["overall"] >= 88.0


def test_scoring_calibrator_identity_corrupt_knots_and_nan_safety(tmp_path):
    id_cal = ScoringCalibrator(mode="identity")
    assert id_cal.has_model("overall") is False
    assert id_cal.predict_component("overall", {"x": 1.0}) is None
    assert id_cal.calibrate(84.44) == 84.4

    missing_cal = ScoringCalibrator(mode="calibrated", calibration_path=tmp_path / "nope.json")
    assert missing_cal.mode == "identity"

    bad_json = tmp_path / "bad.json"
    bad_json.write_text("{broken", encoding="utf-8")
    assert ScoringCalibrator(mode="calibrated", calibration_path=bad_json).mode == "identity"

    empty_models = tmp_path / "empty_models.json"
    empty_models.write_text(json.dumps({"models": {}}), encoding="utf-8")
    assert ScoringCalibrator(mode="calibrated", calibration_path=empty_models).mode == "identity"

    # Valid JSON with linear & knotted predictors, NaN/Inf features, and zero std
    cal_file = tmp_path / "cal.json"
    cal_file.write_text(
        json.dumps({
            "models": {
                "linear": {
                    "features": ["f1", "f2"],
                    "means": [10.0, 20.0],
                    "stds": [0.0, 2.0],
                    "weights": [5.0, 10.0],
                    "intercept": 70.0,
                    "min_score": 10.0,
                    "max_score": 95.0,
                },
                "knotted": {
                    "features": ["f1"],
                    "means": [0.0],
                    "stds": [1.0],
                    "weights": [1.0],
                    "intercept": 0.0,
                    "x_knots": [-1.0, 0.0, 1.0],
                    "y_knots": [40.0, 70.0, 90.0],
                },
                "bad_len": {
                    "features": ["f1", "f2"],
                    "means": [0.0],
                    "stds": [1.0],
                    "weights": [1.0],
                    "intercept": 0.0,
                },
            }
        }),
        encoding="utf-8",
    )
    cal = ScoringCalibrator(mode="calibrated", calibration_path=cal_file)
    assert cal.has_model("linear") is True
    assert cal.predict_component("bad_len", {"f1": 1.0}) is None
    # NaN in f1 falls back to mean (diff=0), f2=22 -> (22-20)/2 * 10 + 70 = 80
    assert cal.predict_component("linear", {"f1": float("nan"), "f2": 22.0}) == 80.0
    # Inf clipped gracefully & piecewise interpolated at z=0.5 -> 80.0
    assert cal.predict_component("knotted", {"f1": 0.5}) == 80.0


def test_gop_margin_to_score_monotonicity():
    low = _gop_margin_to_score(-4.0)
    mid = _gop_margin_to_score(0.0)
    high = _gop_margin_to_score(3.0)
    assert 0.0 <= low < mid < high <= 100.0


def test_score_vowel_branches_all_regimes():
    id_scorer = Scorer(calibrator=ScoringCalibrator(mode="identity"))

    # Very low posterior (< 0.015) branches: poor formant / strict GOP -> 0.0, strong formant without strict GOP rescues
    assert id_scorer.score_vowel(30.0, 0.8, 0.8, posterior=0.01, symbol="iː", gop_margin=None) == 0.0
    assert id_scorer.score_vowel(80.0, 0.8, 0.8, posterior=0.01, canonical_posterior=0.01, symbol="iː", gop_margin=None) == 0.0
    assert id_scorer.score_vowel(80.0, 0.8, 0.8, posterior=0.01, symbol="iː", gop_margin=None) == pytest.approx(80.0 * 0.92, abs=0.01)
    low_with_margin = id_scorer.score_vowel(80.0, 0.8, 0.8, posterior=0.01, symbol="iː", gop_margin=-3.0)
    assert 0.0 <= low_with_margin < 25.0

    # Formant missing
    no_formant = id_scorer.score_vowel(None, 0.5, 0.85, posterior=0.75, symbol="iː", gop_margin=1.0)
    assert no_formant >= 80.0

    # Clear substitution (gop_margin < -2.0) caps score even if formant looks close
    sub_capped = id_scorer.score_vowel(90.0, 0.9, 0.9, posterior=0.2, symbol="ɪ", gop_margin=-2.5)
    assert sub_capped < 40.0

    # Poor formant + poor raw GOP capped cleanly
    poor_both = id_scorer.score_vowel(25.0, 0.5, 0.5, posterior=0.05, symbol="æ", gop_margin=-1.2)
    assert poor_both <= 35.0


def test_score_consonant_gop_all_branches():
    id_scorer = Scorer(calibrator=ScoringCalibrator(mode="identity"))

    assert id_scorer.score_consonant_gop(0.9, 0.08, 0.9, acoustic_multiplier=0.0) == 0.0
    assert id_scorer.score_consonant_gop(0.05, 0.05, 0.5, symbol="ɹ", is_coda_r=True) == 90.0
    assert id_scorer.score_consonant_gop(0.01, 0.04, 0.85, symbol="t", acoustic_multiplier=0.9) == 88.0
    assert id_scorer.score_consonant_gop(0.01, 0.04, 0.5, symbol="s", canonical_posterior=0.01, gop_margin=-3.0) <= 35.0
    assert id_scorer.score_consonant_gop(0.25, 0.04, 0.75, symbol="p", acoustic_multiplier=0.95) >= 94.0

    # Clear substitution cap (gop_margin < -1.5)
    sub_cons = id_scorer.score_consonant_gop(0.3, 0.06, 0.8, symbol="θ", canonical_posterior=0.2, gop_margin=-2.2)
    assert sub_cons < 45.0


def test_score_word_caps_and_oov_softening():
    id_scorer = Scorer(calibrator=ScoringCalibrator(mode="identity"))
    assert id_scorer.score_word([], []) == 0.0

    # Long word (> 3 phonemes) with stressed vowel < 25 capped
    long_ps = [
        PhonemeSchema(symbol="k", type=PhonemeType.CONSONANT, score=90.0, status=MeasurementStatus.OK),
        PhonemeSchema(symbol="æ", type=PhonemeType.VOWEL, score=20.0, status=MeasurementStatus.OK),
        PhonemeSchema(symbol="t", type=PhonemeType.CONSONANT, score=90.0, status=MeasurementStatus.OK),
        PhonemeSchema(symbol="s", type=PhonemeType.CONSONANT, score=90.0, status=MeasurementStatus.OK),
    ]
    long_al = [
        AlignedPhoneme(symbol="k", start=0.0, end=0.05),
        AlignedPhoneme(symbol="æ", start=0.05, end=0.15, is_stress=True),
        AlignedPhoneme(symbol="t", start=0.15, end=0.20),
        AlignedPhoneme(symbol="s", start=0.20, end=0.25, is_word_final=True),
    ]
    assert id_scorer.score_word(long_ps, long_al) <= 45.0

    # Non-final consonant < 20 capped at <= 55.0
    bad_init = [
        PhonemeSchema(symbol="k", type=PhonemeType.CONSONANT, score=15.0, status=MeasurementStatus.OK),
        PhonemeSchema(symbol="æ", type=PhonemeType.VOWEL, score=95.0, status=MeasurementStatus.OK),
    ]
    bad_init_al = [
        AlignedPhoneme(symbol="k", start=0.0, end=0.05),
        AlignedPhoneme(symbol="æ", start=0.05, end=0.15),
    ]
    assert id_scorer.score_word(bad_init, bad_init_al) <= 55.0

    # OOV softening pulls floor up
    oov_score = id_scorer.score_word(bad_init, bad_init_al, is_oov=True)
    assert oov_score >= 55.0


def test_wpm_prosody_completeness_and_overall_identity_paths():
    id_scorer = Scorer(calibrator=ScoringCalibrator(mode="identity"))

    assert id_scorer.calculate_wpm(0, 2.0) == 120
    assert id_scorer.calculate_wpm(4, 0.1) == 120
    assert id_scorer.calculate_wpm(6, 3.0) == 120

    assert id_scorer.calculate_speed_score(0.0, 120) == 50.0
    assert id_scorer.calculate_speed_score(2.0, 80) < id_scorer.calculate_speed_score(4.2, 140)
    assert id_scorer.calculate_speed_score(7.5, 220) >= 65.0

    assert id_scorer.calculate_completeness_score(0, 0) == 100
    assert id_scorer.calculate_completeness_score(2, 5, partial_count=2) == 62

    # Prosody branches: monotone (< 0.06), optimal (0.06..0.28), overly bouncy (> 0.28)
    monotone = id_scorer.calculate_prosody_score(5.0, 85.0, 85.0, features={"f0_rel_std": 0.02, "stress_dur_contrast": 1.0})
    expressive = id_scorer.calculate_prosody_score(30.0, 85.0, 85.0, linking_ratio=0.4, features={"f0_rel_std": 0.18, "stress_dur_contrast": 1.3})
    bouncy = id_scorer.calculate_prosody_score(70.0, 85.0, 85.0, features={"f0_rel_std": 0.45, "stress_dur_contrast": 1.1})
    assert expressive > monotone
    assert expressive > bouncy

    # Identity fallback for calibrate_utterance_scores + completeness penalty
    cal_id = id_scorer.calibrate_utterance_scores(90.0, 80.0, 75.0, completeness=50.0, features={})
    assert cal_id["overall"] == round(id_scorer.calculate_overall_score(90.0, 80.0, 75.0, completeness=50.0), 1)
    assert cal_id["overall"] < 50.0


def test_extract_utterance_acoustic_features_handles_spoken_partial_and_empty():
    sr = 16000
    audio = (0.3 * np.sin(2 * np.pi * 220 * np.linspace(0, 1.0, sr))).astype(np.float32)
    quality = AudioQualityMetrics(
        duration=1.0, rms=0.2, peak=0.3, clipping_ratio=0.0,
        silence_ratio=0.1, speech_ratio=0.9, estimated_snr=20.0,
        dynamic_range=20.0, is_acceptable=True,
    )
    empty_feats = extract_utterance_acoustic_features(
        audio_data=audio, sample_rate=sr,
        alignment_result=AlignmentResult(words=[], alignment_confidence=0.8),
        utterance_acoustics=UtteranceAcoustics(),
        words_schema=[], spoken_words=[], pause_events=[],
        quality_metrics=quality, whole_file_sim=0.9,
        wpm=130.0, articulation_rate=4.0, pause_ratio=0.0,
        awkward_pause_count=0, linking_ratio=0.0, completeness_score=100.0,
    )
    assert empty_feats["completeness_ratio"] == 1.0

    al_words = [
        AlignedWord(
            word="hello", start=0.1, end=0.4, confidence=0.9,
            phonemes=[
                AlignedPhoneme(symbol="h", start=0.1, end=0.18, posterior=0.8, canonical_posterior=0.8, gop_margin=1.2),
                AlignedPhoneme(symbol="oʊ", start=0.18, end=0.4, posterior=0.85, canonical_posterior=0.85, gop_margin=1.5, is_stress=True),
            ],
        ),
        AlignedWord(
            word="world", start=0.7, end=0.95, confidence=0.8,
            phonemes=[
                AlignedPhoneme(symbol="w", start=0.7, end=0.75, posterior=0.7, canonical_posterior=0.7, gop_margin=0.5),
                AlignedPhoneme(symbol="ɜː", start=0.75, end=0.90, posterior=0.2, canonical_posterior=0.15, gop_margin=-0.6, is_stress=False),
            ],
        ),
    ]
    w_schemas = [
        WordSchema(
            word="hello", start_time=0.1, end_time=0.4, score=90.0, confidence=0.9, word_status=SpokenWordStatus.SPOKEN,
            phonemes=[
                PhonemeSchema(symbol="h", type=PhonemeType.CONSONANT, score=88.0, status=MeasurementStatus.OK),
                PhonemeSchema(symbol="oʊ", type=PhonemeType.VOWEL, score=92.0, status=MeasurementStatus.OK),
            ],
        ),
        WordSchema(
            word="world", start_time=0.7, end_time=0.95, score=62.0, confidence=0.8, word_status=SpokenWordStatus.PARTIAL,
            phonemes=[
                PhonemeSchema(symbol="w", type=PhonemeType.CONSONANT, score=75.0, status=MeasurementStatus.OK),
                PhonemeSchema(symbol="ɜː", type=PhonemeType.VOWEL, score=50.0, status=MeasurementStatus.OK),
            ],
        ),
    ]
    feats = extract_utterance_acoustic_features(
        audio_data=audio, sample_rate=sr,
        alignment_result=AlignmentResult(words=al_words, alignment_confidence=0.85),
        utterance_acoustics=UtteranceAcoustics(mean_f0=190.0, f0_std=25.0, f0_iqr=30.0, f0_range_90_10=55.0, f0_slope_abs=4.0, voiced_frame_ratio=0.7),
        words_schema=w_schemas, spoken_words=w_schemas, pause_events=[],
        quality_metrics=quality, whole_file_sim=0.85,
        wpm=140.0, articulation_rate=4.2, pause_ratio=0.1,
        awkward_pause_count=1, linking_ratio=0.0, completeness_score=80.0,
    )
    assert feats["hesitation_ratio"] == 1.0  # gap = 0.7 - 0.4 = 0.3 >= 0.22 without punctuation
    assert feats["mean_phoneme_score"] > 0.0


def test_generate_phoneme_pedagogical_feedback_all_tiers():
    assert generate_phoneme_pedagogical_feedback("t", 0.0, "consonant", is_missing=True) == "Bạn chưa đọc từ này."
    assert "nuốt" in generate_phoneme_pedagogical_feedback("t", 0.0, "consonant", acoustic_detail="nuốt âm", is_word_final=True)
    assert "Chưa phát hiện âm" in generate_phoneme_pedagogical_feedback("s", 0.0, "consonant")
    assert "chuẩn xác" in generate_phoneme_pedagogical_feedback("iː", 85.0, "vowel")
    assert "rõ ràng" in generate_phoneme_pedagogical_feedback("s", 85.0, "consonant")
    assert generate_phoneme_pedagogical_feedback("æ", 68.0, "vowel", formant_feedback="Mở miệng rộng hơn") == "Mở miệng rộng hơn"
    assert "tương đối tốt" in generate_phoneme_pedagogical_feedback("s", 68.0, "consonant")
    assert "thiếu" in generate_phoneme_pedagogical_feedback("f", 45.0, "consonant", acoustic_detail="thiếu ma sát")
    assert "nuốt" in generate_phoneme_pedagogical_feedback("d", 10.0, "consonant", is_word_final=True)
    assert "thiếu bằng chứng" in generate_phoneme_pedagogical_feedback("p", 20.0, "consonant", acoustic_detail="năng lượng quá nhỏ")
    assert "sai lệch" in generate_phoneme_pedagogical_feedback("p", 20.0, "consonant")


def test_swallowed_final_consonant_zero_contradiction_feedback_and_calibrated_completeness(tmp_path):
    id_scorer = Scorer(calibrator=ScoringCalibrator(mode="identity"))

    # 1. Nuốt âm đuôi (is_word_final=True): score < 20 bị kẹp trần <= 52.0; 20 <= score < 60 bị kẹp trần <= 65.0
    p_v = PhonemeSchema(symbol="aɪ", type=PhonemeType.VOWEL, score=95.0, status=MeasurementStatus.OK)
    p_c_swallowed = PhonemeSchema(symbol="k", type=PhonemeType.CONSONANT, score=12.0, status=MeasurementStatus.OK)
    p_c_weak = PhonemeSchema(symbol="k", type=PhonemeType.CONSONANT, score=45.0, status=MeasurementStatus.OK)
    al_v = AlignedPhoneme(symbol="aɪ", start=0.0, end=0.15, is_stress=True)
    al_c_final = AlignedPhoneme(symbol="k", start=0.15, end=0.20, is_word_final=True)

    assert id_scorer.score_word([p_v, p_c_swallowed], [al_v, al_c_final]) <= 52.0
    assert id_scorer.score_word([p_v, p_c_weak], [al_v, al_c_final]) <= 65.0

    # 2. Zero-contradiction pedagogical feedback: nguyên âm điểm trung bình/thấp (65 hoặc 40) KHÔNG được trả câu khen "chuẩn xác"
    fb_mid = generate_phoneme_pedagogical_feedback(
        "iː", 65.0, "vowel", formant_feedback="Khẩu hình và vị trí đặt lưỡi chuẩn xác!"
    )
    fb_low = generate_phoneme_pedagogical_feedback(
        "iː", 40.0, "vowel", formant_feedback="Khẩu hình và vị trí đặt lưỡi chuẩn xác!"
    )
    assert "chuẩn xác!" not in fb_mid
    assert "tương đối tốt" in fb_mid
    assert "chưa chuẩn xác" in fb_low

    # 3. Hiệu chuẩn (calibration) có model 'overall' khi completeness < 95% phải nhân tỷ lệ completeness_ratio
    cal_file = tmp_path / "cal_comp.json"
    cal_file.write_text(
        json.dumps({
            "models": {
                "overall": {
                    "features": ["raw_pronunciation"],
                    "means": [80.0],
                    "stds": [10.0],
                    "weights": [5.0],
                    "intercept": 80.0,
                }
            }
        }),
        encoding="utf-8",
    )
    cal_scorer = Scorer(calibrator=ScoringCalibrator(mode="calibrated", calibration_path=cal_file))
    res_half = cal_scorer.calibrate_utterance_scores(80.0, 80.0, 80.0, completeness=50.0, features={})
    assert res_half["overall"] == 40.0


