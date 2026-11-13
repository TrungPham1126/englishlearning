from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.audio_cases import (
    FULL_SENTENCE,
    case_full,
    case_half_then_silence,
    case_total_silence,
    case_half_then_noise
)


@pytest.mark.asyncio
async def test_case_full():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        wav_bytes = case_full()
        files = {"audio": ("test_full.wav", wav_bytes, "audio/wav")}
        data = {"script": FULL_SENTENCE}
        resp = await ac.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)

        assert resp.status_code == 200, resp.text
        res = resp.json()

        assert res["overallScore"] >= 60.0
        assert res["kpi"]["completeness"] >= 90

        tokens = res["sentenceTokens"]
        assert len(tokens) == 9
        for tok in tokens:
            assert tok["wordStatus"] in ("SPOKEN", "PARTIAL")
            assert tok["color"] in ("GREEN", "YELLOW", "RED")
            assert tok["color"] != "GRAY"


@pytest.mark.asyncio
async def test_case_half_then_silence():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        wav_bytes = case_half_then_silence()
        files = {"audio": ("test_half.wav", wav_bytes, "audio/wav")}
        data = {"script": FULL_SENTENCE}
        resp = await ac.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)

        assert resp.status_code == 200, resp.text
        res = resp.json()

        # 1. First 2 words spoken, remaining 7 missing
        tokens = res["sentenceTokens"]
        assert len(tokens) == 9
        assert tokens[0]["wordStatus"] == "SPOKEN"
        assert tokens[1]["wordStatus"] == "SPOKEN"

        missing_words = ["practice", "and", "phonemic", "awareness", "enhance", "oral", "fluency"]
        for idx in range(2, 9):
            tok = tokens[idx]
            assert tok["word"].lower().strip(".,") == missing_words[idx - 2].lower()
            assert tok["wordStatus"] == "MISSING", f"Word {tok['word']} should be MISSING, got {tok['wordStatus']}"
            assert tok["color"] == "GRAY", f"Word {tok['word']} should be GRAY, got {tok['color']}"

        # 2. Check word_rows and phonemes
        word_rows = res["wordRows"]
        for idx in range(2, 9):
            row = word_rows[idx]
            assert row["score"] == 0
            assert row["wordStatus"] == "MISSING"
            for ph in row["phonemes"]:
                assert ph["score"] == 0
                assert ph["note"] == "Bạn chưa đọc từ này."

        # 3. Completeness should be ~ 22% (2 / 9 words)
        comp = res["kpi"]["completeness"]
        assert 18 <= comp <= 26, f"Expected completeness ~22%, got {comp}"

        # 4. Overall score must be severely scaled down
        assert res["overallScore"] <= 25.0, f"Expected overall <= 25, got {res['overallScore']}"
        assert res["isPassed"] is False


@pytest.mark.asyncio
async def test_case_total_silence():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        wav_bytes = case_total_silence()
        files = {"audio": ("test_silence.wav", wav_bytes, "audio/wav")}
        data = {"script": FULL_SENTENCE}
        resp = await ac.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)

        assert resp.status_code == 422, f"Expected 422, got {resp.status_code}: {resp.text}"
        detail = resp.json()["detail"]
        assert detail["code"] == "EMPTY_SPEECH"


@pytest.mark.asyncio
async def test_case_half_then_noise():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        wav_bytes = case_half_then_noise()
        files = {"audio": ("test_half_noise.wav", wav_bytes, "audio/wav")}
        data = {"script": FULL_SENTENCE}
        resp = await ac.post("/api/v1/audio/evaluate-phonetics", files=files, data=data)

        assert resp.status_code == 200, resp.text
        res = resp.json()

        # Unspoken words must not be aligned to noise
        tokens = res["sentenceTokens"]
        assert tokens[0]["wordStatus"] == "SPOKEN"
        assert tokens[1]["wordStatus"] == "SPOKEN"

        for idx in range(2, 9):
            tok = tokens[idx]
            assert tok["wordStatus"] == "MISSING", f"Word {tok['word']} should be MISSING in noise, got {tok['wordStatus']}"
            assert tok["color"] == "GRAY"

        comp = res["kpi"]["completeness"]
        assert 18 <= comp <= 26
        assert res["overallScore"] <= 25.0


@pytest.mark.asyncio
async def test_tts_half_matches_two_word_prefix_script_and_reports_nonzero_missing_count():
    fixture_half = Path(__file__).resolve().parent / "fixtures" / "tts_half.wav"
    half_bytes = fixture_half.read_bytes()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Exact matching 2-word transcript for tts_half.wav should pass cleanly
        resp_match = await ac.post(
            "/api/v1/audio/evaluate-phonetics",
            files={"audio": ("tts_half.wav", half_bytes, "audio/wav")},
            data={"script": "Consistent pronunciation"},
        )
        assert resp_match.status_code == 200, resp_match.text
        match_body = resp_match.json()
        assert match_body["kpi"]["completeness"] == 100
        assert match_body["overallScore"] >= 65.0

        # 2. Same truncated audio against full 9-word sentence must state exact missing count (7), never 0
        resp_trunc = await ac.post(
            "/api/v1/audio/evaluate-phonetics",
            files={"audio": ("tts_half.wav", half_bytes, "audio/wav")},
            data={"script": FULL_SENTENCE},
        )
        assert resp_trunc.status_code == 200, resp_trunc.text
        trunc_body = resp_trunc.json()
        assert trunc_body["kpi"]["completeness"] < 40
        assert "7 từ" in trunc_body["statusMessage"]
        assert "0 từ" not in trunc_body["statusMessage"]

