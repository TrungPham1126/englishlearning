import base64
import io
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.main import app
from app.models.alignment import AlignedWord, AlignedPhoneme, AlignmentResult
from app.exceptions import AlignmentError


client = TestClient(app)


def _create_mock_wav_bytes(duration_sec: float = 2.0, sample_rate: int = 16000) -> bytes:
    """Generates synthetic in-memory WAV byte stream with speech and silence."""
    import wave
    total_samples = int(duration_sec * sample_rate)
    audio_data = np.zeros(total_samples, dtype=np.int16)
    if duration_sec > 0.5:
        start_idx = int(0.25 * sample_rate)
        end_idx = int((duration_sec - 0.25) * sample_rate)
        t_mid = np.linspace(0, (end_idx - start_idx) / sample_rate, end_idx - start_idx)
        audio_data[start_idx:end_idx] = (0.5 * np.sin(2 * np.pi * 300 * t_mid) * 32767).astype(np.int16)
    else:
        t = np.linspace(0, duration_sec, total_samples)
        audio_data = (0.5 * np.sin(2 * np.pi * 300 * t) * 32767).astype(np.int16)
    
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio_data.tobytes())
    buf.seek(0)
    return buf.read()


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


@patch("app.api.routes.forced_aligner.align", new_callable=AsyncMock)
def test_successful_evaluation_scenario(mock_align):
    """Scenario 283: Successful evaluation pipeline."""
    mock_align.return_value = AlignmentResult(
        alignment_confidence=0.92,
        words=[
            AlignedWord(
                word="hello",
                start=0.1,
                end=0.6,
                confidence=0.95,
                phonemes=[
                    AlignedPhoneme(symbol="h", start=0.1, end=0.2, posterior=0.90, phoneme_type="consonant"),
                    AlignedPhoneme(symbol="e", start=0.2, end=0.4, posterior=0.94, phoneme_type="vowel"),
                    AlignedPhoneme(symbol="l", start=0.4, end=0.5, posterior=0.88, phoneme_type="consonant"),
                    AlignedPhoneme(symbol="oʊ", start=0.5, end=0.6, posterior=0.91, phoneme_type="vowel", is_word_final=True),
                ]
            )
        ]
    )

    wav_bytes = _create_mock_wav_bytes(2.0)
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {"script": "hello"}

    res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["evaluationStatus"] == "SUCCESS"
    assert "overallScore" in body
    assert "pronunciationScore" in body
    assert len(body["words"]) == 1
    assert body["words"][0]["word"] == "hello"


@patch("app.api.routes.forced_aligner.align", new_callable=AsyncMock)
def test_alignment_failure_scenario(mock_align):
    """Scenario 284: Alignment failure."""
    mock_align.side_effect = AlignmentError("CTC path not found.")

    wav_bytes = _create_mock_wav_bytes(1.5)
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {"script": "testing alignment"}

    res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
    assert res.status_code == 422
    body = res.json()
    assert body["detail"]["code"] == "ALIGNMENT_FAILED"


def test_low_quality_audio_scenario():
    """Scenario 285: Low quality audio (too short)."""
    wav_bytes = _create_mock_wav_bytes(0.15)  # Shorter than 0.4s
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {"script": "hello"}

    res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
    assert res.status_code == 422
    body = res.json()
    assert body["detail"]["code"] == "AUDIO_TOO_SHORT"


@patch("app.api.routes.forced_aligner.align", new_callable=AsyncMock)
def test_partial_evaluation_scenario(mock_align):
    """Scenario 286: Partial evaluation due to marginal alignment confidence."""
    mock_align.return_value = AlignmentResult(
        alignment_confidence=0.45,  # Marginal confidence
        words=[
            AlignedWord(
                word="cat",
                start=0.2,
                end=0.7,
                confidence=0.55,
                phonemes=[
                    AlignedPhoneme(symbol="k", start=0.2, end=0.3, posterior=0.45, phoneme_type="consonant"),
                    AlignedPhoneme(symbol="æ", start=0.3, end=0.5, posterior=0.50, phoneme_type="vowel"),
                    AlignedPhoneme(symbol="t", start=0.5, end=0.7, posterior=0.48, phoneme_type="consonant"),
                ]
            )
        ]
    )

    wav_bytes = _create_mock_wav_bytes(2.0)
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {"script": "cat"}

    res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["evaluationStatus"] in ("PARTIAL_EVALUATION", "LOW_CONFIDENCE")


def test_invalid_script_repetition_rejection():
    """Validates that garbage/repeated characters script is strictly rejected at gate."""
    wav_bytes = _create_mock_wav_bytes(2.0)
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {"script": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}

    res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
    assert res.status_code == 422
    body = res.json()
    assert body["detail"]["code"] == "INVALID_SCRIPT"
    assert "aaaaaaaa" in body["detail"]["reason"]


@patch("app.api.routes.forced_aligner.align", new_callable=AsyncMock)
def test_alignment_low_confidence_rejection(mock_align):
    """Validates that low alignment confidence (< 0.40) immediately halts the pipeline with 422."""
    mock_align.return_value = AlignmentResult(
        alignment_confidence=0.10,
        words=[]
    )

    wav_bytes = _create_mock_wav_bytes(2.0)
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {"script": "hello teacher"}

    res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
    assert res.status_code == 422
    body = res.json()
    assert body["detail"]["code"] == "ALIGNMENT_LOW_CONFIDENCE"


def test_audio_script_mismatch_scenario():
    """Validates that mismatched audio (short beep vs multi-word sentence) triggers ALIGNMENT_LOW_CONFIDENCE."""
    wav_bytes = _create_mock_wav_bytes(0.8)
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {"script": "I would like to talk about my trip to Halong Bay last month."}

    res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
    assert res.status_code == 422
    body = res.json()
    assert body["detail"]["code"] == "ALIGNMENT_LOW_CONFIDENCE"


@patch("app.api.routes.evidence_detector.detect_spoken_words")
@patch("app.api.routes.forced_aligner.align", new_callable=AsyncMock)
def test_omitted_words_not_scored_scenario(mock_align, mock_detect):
    """
    Regression Test:
    User skips 'I love you' and only speaks 'I would like to talk about my trip'.
    'I love you' must receive status='NOT_SPOKEN', score=None, phonemes=[],
    and completeness must be < 100%.
    """
    from app.services.word_aligner import DetectedWord

    script = "I love you. I would like to talk about my trip."
    # Detected words only have the latter sentence
    mock_detect.return_value = [
        DetectedWord("i", 0.5, 0.7, 0.95),
        DetectedWord("would", 0.7, 1.0, 0.92),
        DetectedWord("like", 1.0, 1.3, 0.94),
        DetectedWord("to", 1.3, 1.5, 0.90),
        DetectedWord("talk", 1.5, 1.8, 0.91),
        DetectedWord("about", 1.8, 2.1, 0.89),
        DetectedWord("my", 2.1, 2.3, 0.93),
        DetectedWord("trip", 2.3, 2.6, 0.92),
    ]

    all_words = script.split()
    mock_words = []
    for i, w in enumerate(all_words):
        mock_words.append(
            AlignedWord(
                word=w,
                start=i * 0.3,
                end=(i + 1) * 0.3,
                confidence=0.85,
                phonemes=[
                    AlignedPhoneme(symbol="a", start=i * 0.3, end=(i + 1) * 0.3, posterior=0.85, phoneme_type="vowel")
                ]
            )
        )

    mock_align.return_value = AlignmentResult(
        alignment_confidence=0.88,
        words=mock_words
    )

    wav_bytes = _create_mock_wav_bytes(3.0)
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {"script": script}

    res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
    assert res.status_code == 200
    body = res.json()

    words = body["words"]
    # Check that first 3 words ('I', 'love', 'you.') are NOT_SPOKEN
    assert words[0]["status"] == "NOT_SPOKEN"
    assert words[0]["score"] is None
    assert len(words[0]["phonemes"]) == 0

    assert words[1]["status"] == "NOT_SPOKEN"
    assert words[1]["score"] is None
    assert len(words[1]["phonemes"]) == 0

    assert words[2]["status"] == "NOT_SPOKEN"
    assert words[2]["score"] is None
    assert len(words[2]["phonemes"]) == 0

    # Spoken words should have scores and MATCH status
    assert words[3]["status"] == "MATCH"
    assert words[3]["score"] is not None

    # Completeness must not be 100%
    assert body["kpi"]["completeness"] < 100
    assert body["kpi"]["completeness"] == int(round((8 / 11) * 100))  # 8 out of 11 words spoken = 73%
    assert body["isPassed"] is False


@patch("app.api.routes.formant_service.analyze_vowel")
@patch("app.api.routes.evidence_detector.detect_spoken_words")
@patch("app.api.routes.forced_aligner.align", new_callable=AsyncMock)
def test_google_tts_high_quality_scenario(mock_align, mock_detect, mock_vowel):
    """
    Validates that a high quality standard utterance (e.g. Google TTS 'How about you?')
    receives high pronunciation and prosody score (>= 90.0 overall, >= 90.0 pronunciation).
    """
    from app.services.word_aligner import DetectedWord

    script = "How about you?"
    mock_detect.return_value = [
        DetectedWord("how", 0.05, 0.35, 0.98),
        DetectedWord("about", 0.35, 0.70, 0.97),
        DetectedWord("you", 0.70, 0.95, 0.99),
    ]

    # Standard native-quality formant responses (score >= 94.0)
    mock_vowel.return_value = (430.0, 1300.0, 430.0, 1300.0, 96.0, "Khẩu hình và vị trí đặt lưỡi chuẩn xác!", "OK")

    mock_align.return_value = AlignmentResult(
        alignment_confidence=0.95,
        words=[
            AlignedWord(
                word="How",
                start=0.05,
                end=0.35,
                confidence=0.96,
                phonemes=[
                    AlignedPhoneme(symbol="h", start=0.05, end=0.15, posterior=0.92, phoneme_type="consonant"),
                    AlignedPhoneme(symbol="aʊ", start=0.15, end=0.35, posterior=0.95, phoneme_type="vowel"),
                ]
            ),
            AlignedWord(
                word="about",
                start=0.35,
                end=0.70,
                confidence=0.95,
                phonemes=[
                    AlignedPhoneme(symbol="ə", start=0.35, end=0.45, posterior=0.91, phoneme_type="vowel"),
                    AlignedPhoneme(symbol="b", start=0.45, end=0.52, posterior=0.93, phoneme_type="consonant"),
                    AlignedPhoneme(symbol="aʊ", start=0.52, end=0.64, posterior=0.94, phoneme_type="vowel"),
                    AlignedPhoneme(symbol="t", start=0.64, end=0.70, posterior=0.92, phoneme_type="consonant"),
                ]
            ),
            AlignedWord(
                word="you?",
                start=0.70,
                end=0.95,
                confidence=0.97,
                phonemes=[
                    AlignedPhoneme(symbol="j", start=0.70, end=0.78, posterior=0.94, phoneme_type="consonant"),
                    AlignedPhoneme(symbol="uː", start=0.78, end=0.95, posterior=0.96, phoneme_type="vowel"),
                ]
            ),
        ]
    )

    wav_bytes = _create_mock_wav_bytes(1.1)
    files = {"audio": ("test.wav", wav_bytes, "audio/wav")}
    data = {"script": script}

    res = client.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["evaluationStatus"] == "SUCCESS"
    assert body["overallScore"] >= 90.0
    assert body["pronunciationScore"] >= 90.0
    assert body["isPassed"] is True
    assert body["kpi"]["completeness"] == 100
    assert body["speedScore"] >= 92.0
    # No word or phoneme penalized below 80
    for w in body["words"]:
        assert w["score"] >= 80.0


def test_rushed_consonant_duration_penalty():
    """Validates that a 1-frame rushed consonant (< 45ms) receives severe penalty."""
    from app.services.scorer import scorer
    rushed_score = scorer.score_consonant_gop(posterior=0.95, duration=0.020, alignment_confidence=0.90)
    normal_score = scorer.score_consonant_gop(posterior=0.95, duration=0.065, alignment_confidence=0.90)
    assert rushed_score < 50.0
    assert normal_score >= 85.0


def test_how_about_you_g2p_and_context_formant_calibration():
    """
    Validates:
    1. G2P dictionary ensures 'how' is strictly /haʊ/ (U+0061 U+028A), never /aɪ/.
    2. Context-dependent fronted [ʉ] target profile for /u/ in 'you' (Female F1=430, F2=1300).
    3. Soft Sigmoid Mahalanobis scoring achieves >= 90.0 for Google TTS formants.
    """
    from app.services.aligner import IPASanitizer
    from app.services.formant_service import formant_service

    # 1. G2P Validation
    sanitizer = IPASanitizer(tokenizer=None)
    tokens = sanitizer.text_to_phonemes("How about you?")
    how_word, how_phonemes = tokens[0]
    assert how_word.lower() == "how"
    vowel_syms = [p[0] for p in how_phonemes if p[1] == "vowel"]
    assert "a\u028a" in vowel_syms
    assert "a\u026a" not in vowel_syms  # Absolutely must not be /aɪ/

    # 2. Context-dependent [ʉ] profile for /u/ in 'you'
    u_ref = formant_service._get_target_profile("u\u02d0", "FEMALE", is_fronted_u=True)
    assert u_ref is not None
    assert u_ref["mean"] == [430.0, 1300.0]

    # Google TTS measured values for 'you': F1=457.6, F2=1250.4
    u_score, _ = formant_service._score_mahalanobis(
        457.6, 1250.4, u_ref["mean"][0], u_ref["mean"][1], u_ref
    )
    assert u_score >= 90.0, f"Expected /u/ score >= 90.0, got {u_score}"

    # 3. Google TTS measured values for 'how': F1=802.4, F2=1415.5
    how_ref = formant_service._get_target_profile("a\u028a", "FEMALE", is_fronted_u=False)
    assert how_ref is not None
    how_score, _ = formant_service._score_mahalanobis(
        802.4, 1415.5, how_ref["mean"][0], how_ref["mean"][1], how_ref
    )
    assert how_score >= 90.0, f"Expected /aʊ/ score >= 90.0, got {how_score}"


def test_validate_script_acronyms_and_single_letters():
    """Validates validate_script accepts single letters / vowelless abbreviations (T shirt, Ph D, Mc Gregor)."""
    from app.services.aligner import validate_script
    from app.exceptions import InvalidTranscriptError

    assert validate_script("T shirt") == ["T", "shirt"]
    assert validate_script("Ph D student") == ["Ph", "D", "student"]
    assert validate_script("Mc Gregor") == ["Mc", "Gregor"]
    assert validate_script("I like AI") == ["I", "like", "AI"]

    with pytest.raises(InvalidTranscriptError):
        validate_script("xkcdzqqq bdfgh")


def test_mid_sentence_skip_does_not_cascade_missing():
    """Validates skipping one middle word does not cascade MISSING across all subsequent spoken words."""
    from tests.audio_cases import case_full

    wav_bytes = case_full()
    script_with_skipped_word = (
        "Consistent pronunciation practice omittedword phonemic awareness enhance oral fluency."
    )
    res = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("mid_skip.wav", wav_bytes, "audio/wav")},
        data={"script": script_with_skipped_word},
    )
    assert res.status_code == 200, res.text
    tokens = res.json()["sentenceTokens"]
    assert len(tokens) == 9
    # Words after the skipped middle slot must recover and still be scored (not cascaded MISSING)
    later_statuses = [t["wordStatus"] for t in tokens[4:]]
    spoken_later = sum(1 for st in later_statuses if st in ("SPOKEN", "PARTIAL"))
    assert spoken_later >= 4, f"Unexpected cascading MISSING in later tokens: {tokens}"


def test_google_tts_strut_vowel_bus():
    """Validates standard Google TTS STRUT /ʌ/ in 'bus' is scored accurately without multilingual /a/ penalty."""
    from pathlib import Path

    fixture_path = Path(__file__).resolve().parent / "fixtures" / "tts_bus.mp3"
    assert fixture_path.exists(), f"Missing fixture: {fixture_path}"

    res = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("bus.mp3", fixture_path.read_bytes(), "audio/mpeg")},
        data={"script": "bus"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    word_entry = body["words"][0]
    assert word_entry["score"] >= 85.0, f"Expected word 'bus' score >= 85.0, got {word_entry}"
    assert body["sentenceTokens"][0]["color"] == "GREEN"

    strut_phoneme = [p for p in word_entry["phonemes"] if p["symbol"] == "ʌ"][0]
    assert strut_phoneme["score"] >= 80.0, f"Expected /ʌ/ >= 80.0, got {strut_phoneme}"
    assert "chuẩn xác" in strut_phoneme["feedback"].lower()


# ---------------------------------------------------------------------------
# Comprehensive Endpoint Integration & Error Handling Tests
# ---------------------------------------------------------------------------

def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["service"] == "phonetics-service"
    assert body["version"] == "1.0.0"
    assert body["sampleRate"] == 16000
    assert body["device"] in ("cpu", "cuda")


def test_evaluate_minimal_pair_ship_vs_sheep_real_audio():
    cache_dir = Path(__file__).resolve().parents[1] / "test_audio_cache"
    sheep_bytes = (cache_dir / "sheep.wav").read_bytes()

    # sheep.wav against "sheep" -> /iː/ should pass GREEN
    r_correct = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("sheep.wav", sheep_bytes, "audio/wav")},
        data={"script": "sheep"},
    )
    assert r_correct.status_code == 200, r_correct.text
    b_correct = r_correct.json()
    ph_iy = [p for p in b_correct["words"][0]["phonemes"] if p["symbol"] == "iː"][0]
    assert ph_iy["score"] >= 85.0
    assert b_correct["sentenceTokens"][0]["color"] == "GREEN"

    # sheep.wav against wrong word "ship" -> /ɪ/ must be penalized below 60 (RED/warning)
    r_wrong = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("sheep.wav", sheep_bytes, "audio/wav")},
        data={"script": "ship"},
    )
    assert r_wrong.status_code == 200, r_wrong.text
    b_wrong = r_wrong.json()
    ph_ih = [p for p in b_wrong["words"][0]["phonemes"] if p["symbol"] == "ɪ"][0]
    assert ph_ih["score"] < 60.0
    assert b_wrong["overallScore"] < b_correct["overallScore"]


def test_evaluate_error_responses_empty_corrupt_noise_and_oversized():
    # 0-byte empty file -> 422 EMPTY_SPEECH
    r_empty = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("empty.wav", b"", "audio/wav")},
        data={"script": "hello"},
    )
    assert r_empty.status_code == 422
    assert r_empty.json()["detail"]["code"] == "EMPTY_SPEECH"

    # Invalid text file disguised as .txt -> 415 UNSUPPORTED_AUDIO_FORMAT
    r_txt = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("fake.txt", b"plain text not audio", "text/plain")},
        data={"script": "hello"},
    )
    assert r_txt.status_code == 415
    assert r_txt.json()["detail"]["code"] == "UNSUPPORTED_AUDIO_FORMAT"

    # Pure broadband white noise > 1.2s -> 422 AUDIO_QUALITY_TOO_LOW
    rng = np.random.default_rng(123)
    noise = (0.3 * rng.standard_normal(int(1.6 * 16000))).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, noise, 16000, format="WAV", subtype="PCM_16")
    buf.seek(0)
    r_noise = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("noise.wav", buf.read(), "audio/wav")},
        data={"script": "hello"},
    )
    assert r_noise.status_code == 422
    assert r_noise.json()["detail"]["code"] == "AUDIO_QUALITY_TOO_LOW"

    # Oversized upload (> 15 MB) -> 413 AUDIO_TOO_LARGE
    huge_payload = b"\x00" * (16 * 1024 * 1024)
    r_huge = client.post(
        "/api/v1/audio/evaluate-phonetics",
        files={"audio": ("huge.wav", huge_payload, "audio/wav")},
        data={"script": "hello"},
    )
    assert r_huge.status_code == 413
    assert r_huge.json()["detail"]["code"] == "AUDIO_TOO_LARGE"


def test_evaluate_sentence_token_color_mapping_green_yellow_red_gray():
    wav_bytes = _create_mock_wav_bytes(2.4)
    al_words = [
        AlignedWord(word="good", start=0.1, end=0.45, confidence=0.95, phonemes=[
            AlignedPhoneme("g", 0.1, 0.2, 0.9, 0.9, phoneme_type="consonant"),
            AlignedPhoneme("ʊ", 0.2, 0.35, 0.9, 0.9, phoneme_type="vowel"),
            AlignedPhoneme("d", 0.35, 0.45, 0.9, 0.9, phoneme_type="consonant"),
        ]),
        AlignedWord(word="mid", start=0.5, end=0.85, confidence=0.85, phonemes=[
            AlignedPhoneme("m", 0.5, 0.6, 0.25, 0.7, phoneme_type="consonant", canonical_posterior=0.25, gop_margin=-0.6),
            AlignedPhoneme("ɪ", 0.6, 0.75, 0.20, 0.7, phoneme_type="vowel", canonical_posterior=0.20, gop_margin=-0.8),
            AlignedPhoneme("d", 0.75, 0.85, 0.25, 0.7, phoneme_type="consonant", canonical_posterior=0.25, gop_margin=-0.6),
        ]),
        AlignedWord(word="bad", start=0.9, end=1.25, confidence=0.8, phonemes=[
            AlignedPhoneme("b", 0.9, 1.0, 0.05, 0.15, phoneme_type="consonant", canonical_posterior=0.05, gop_margin=-2.5),
            AlignedPhoneme("æ", 1.0, 1.15, 0.05, 0.15, phoneme_type="vowel", canonical_posterior=0.05, gop_margin=-2.5),
            AlignedPhoneme("d", 1.15, 1.25, 0.05, 0.15, phoneme_type="consonant", canonical_posterior=0.05, gop_margin=-2.5),
        ]),
        AlignedWord(word="skipped", start=1.5, end=1.8, confidence=0.05, phonemes=[
            AlignedPhoneme("s", 1.5, 1.8, 0.01, 0.01, phoneme_type="consonant"),
        ]),
    ]
    mock_result = AlignmentResult(words=al_words, alignment_confidence=0.85)

    def _vowel_side_effect(audio, start_time, end_time, phoneme_symbol, **kwargs):
        if phoneme_symbol == "ʊ":
            return (440.0, 1150.0, 440.0, 1150.0, 95.0, "Khẩu hình và vị trí đặt lưỡi chuẩn xác!", "OK")
        if phoneme_symbol == "ɪ":
            return (460.0, 1750.0, 400.0, 1920.0, 68.0, "Điều chỉnh nhẹ", "OK")
        return (700.0, 1000.0, 680.0, 1720.0, 35.0, "Hạ hàm", "OK")

    with (
        patch("app.api.routes.forced_aligner.align", new_callable=AsyncMock, return_value=mock_result),
        patch("app.api.routes.verify_speech_content", return_value=(True, "VALID", 0.75, ["g", "ʊ", "d"], "/gʊd/")),
        patch("app.api.routes.decode_raw_speech", return_value=["g", "ʊ", "d", "m", "ɪ", "d", "b", "æ", "d"]),
        patch("app.api.routes.analyze_word_coverage", return_value=(3, [1.0, 1.0, 1.0, 0.0])),
        patch("app.api.routes.evidence_detector.detect_spoken_words", return_value=[]),
        patch("app.api.routes.formant_service.analyze_vowel", side_effect=_vowel_side_effect),
        patch("app.api.routes.check_consonant_acoustic_evidence_detailed", return_value=(True, 0.9, "ok")),
    ):
        res = client.post(
            "/api/v1/audio/evaluate-phonetics",
            files={"audio": ("colors.wav", wav_bytes, "audio/wav")},
            data={"script": "good mid bad skipped"},
        )

    assert res.status_code == 200, res.text
    tokens = res.json()["sentenceTokens"]
    assert [t["color"] for t in tokens] == ["GREEN", "YELLOW", "RED", "GRAY"]


def test_tts_endpoints_json_query_special_chars_and_error_json_safety():
    # JSON request with numbers & special characters
    r_json = client.post(
        "/api/v1/audio/tts",
        json={"text": "Train leaves at 10:30 AM! Cost $25.50 (50% off).", "voice": "af_heart", "speed": 1.0},
    )
    assert r_json.status_code == 200, r_json.text
    assert r_json.headers["content-type"].startswith("audio/wav")
    assert float(r_json.headers["x-audio-duration"]) > 1.0
    assert r_json.headers["x-audio-sample-rate"] == "24000"
    audio_out, sr_out = sf.read(io.BytesIO(r_json.content), dtype="float32")
    assert sr_out == 24000 and len(audio_out) > 24000

    # Legacy query parameter mode
    r_query = client.post("/tts?text=Hello+123&voice=bf_emma&speed=1.1")
    assert r_query.status_code == 200
    assert r_query.headers["x-audio-voice"] == "bf_emma"

    # Empty text rejected
    r_empty = client.post("/tts", json={"text": "   "})
    assert r_empty.status_code == 400

    # 500 error with quotes & newline in exception must still produce valid JSON
    with patch("app.api.routes.tts_engine.synthesize_wav_bytes", side_effect=RuntimeError('bad "quote"\nnewline')):
        r_err = client.post("/tts", json={"text": "Hello"})
    assert r_err.status_code == 500
    parsed = r_err.json()
    assert 'bad "quote"' in parsed["detail"]["message"]


def test_tts_dialogue_and_voices_endpoints():
    r_voices = client.get("/tts/voices")
    r_voices_v1 = client.get("/api/v1/audio/tts/voices")
    assert r_voices.status_code == 200 and r_voices_v1.status_code == 200
    voice_ids = {v["id"] for v in r_voices.json()}
    assert {"af_heart", "am_michael", "bf_emma", "bm_george"}.issubset(voice_ids)

    r_dlg = client.post(
        "/api/v1/audio/tts/dialogue",
        json={
            "turns": [
                {"speaker": "Alice", "text": "Meet at 10:30 AM!"},
                {"speaker": "Bob", "text": "Deal for $50!"},
            ],
            "speakerMap": {"Alice": {"voice": "af_heart", "speed": 1.0}},
            "interTurnPauseMs": 100,
        },
    )
    assert r_dlg.status_code == 200, r_dlg.text
    dlg_body = r_dlg.json()
    assert len(dlg_body["segments"]) == 2
    assert dlg_body["segments"][0]["endMs"] + 100 == dlg_body["segments"][1]["startMs"]
    wav_decoded = base64.b64decode(dlg_body["audioBase64"])
    arr, sr = sf.read(io.BytesIO(wav_decoded), dtype="float32")
    assert sr == 24000 and len(arr) > 0

    r_bad_pause = client.post(
        "/tts/dialogue",
        json={
            "turns": [{"speaker": "Alice", "text": "Hi"}],
            "interTurnPauseMs": 0,
        },
    )
    assert r_bad_pause.status_code == 422

    r_bad = client.post("/tts/dialogue", json={"turns": []})
    assert r_bad.status_code == 422


def test_main_unhandled_exception_handler_and_lifespan_resilience():
    # Ensure TestClient with raise_server_exceptions=False catches unhandled 500 cleanly via main.py handler
    local_client = TestClient(app, raise_server_exceptions=False)
    with patch("app.api.routes.tts_engine.get_available_voices", side_effect=RuntimeError("unexpected crash")):
        res = local_client.get("/tts/voices")
    assert res.status_code == 500
    body = res.json()
    assert body["detail"]["code"] == "INTERNAL_ERROR"

    # Lifespan must not crash if tts_engine.initialize() raises during startup
    with patch("app.services.tts_service.tts_engine.initialize", side_effect=RuntimeError("no weights")):
        with TestClient(app) as tc:
            assert tc.get("/health").status_code == 200




