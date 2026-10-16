import io
from unittest.mock import AsyncMock, patch
import numpy as np
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


