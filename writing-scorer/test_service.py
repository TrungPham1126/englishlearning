"""FastAPI TestClient and offline diagnostics tests for writing-scorer/service.py."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
from typing import Any

from fastapi.testclient import TestClient
import pytest

SERVICE_DIR = Path(__file__).resolve().parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

import service  # noqa: E402


class StubWritingScorer:
    """Deterministic CPU-free stub mimicking WritingScorer.predict() output."""

    def __init__(self, active_model_type: str = "baseline", base_band: float = 6.5) -> None:
        self.active_model_type = active_model_type
        self.base_band = base_band
        self.torch_device = None
        self.calls: list[dict[str, Any]] = []

    def predict(
        self,
        prompt: str,
        essay: str,
        include_feedback: bool = True,
        apply_guardrails: bool = True,
    ) -> dict[str, Any]:
        self.calls.append(
            {
                "prompt": prompt,
                "essay": essay,
                "include_feedback": include_feedback,
                "apply_guardrails": apply_guardrails,
            }
        )
        words = essay.split()
        wc = len(words)
        prompt_tokens = {w.lower().strip(".,?!") for w in prompt.split() if len(w) >= 4}
        essay_tokens = {w.lower().strip(".,?!") for w in words if len(w) >= 4}
        is_off_topic = bool(prompt_tokens and not (prompt_tokens & essay_tokens))

        overall = self.base_band
        tr = self.base_band
        cc = self.base_band
        lr = min(9.0, self.base_band + 0.5)
        gra = max(1.0, self.base_band - 0.5)
        adjustments: list[str] = []

        if apply_guardrails:
            if wc < 50:
                overall = tr = cc = lr = gra = 3.5
                adjustments.append("Severely under-length (<50 words): band capped at 3.5.")
            elif wc < 120:
                tr = min(tr, 4.0)
                overall = min(overall, 4.5)
                adjustments.append("Significantly under-length (<120 words): overall capped at 4.5.")
            elif wc < 220:
                tr = min(tr, 5.5)
                overall = min(overall, 6.0)
                adjustments.append("Under IELTS 250-word minimum (<220 words): Task Response capped.")
            if is_off_topic:
                tr = min(tr, 3.5)
                overall = min(overall, 4.0)
                adjustments.append("Off-topic response detected: Task Response capped at 3.5 and Overall at 4.0.")

        return {
            "overall_band": overall,
            "overall_band_raw": round(overall + 0.08, 4),
            "task_response": tr,
            "task_response_raw": round(tr - 0.04, 4),
            "coherence_cohesion": cc,
            "coherence_cohesion_raw": round(cc + 0.03, 4),
            "lexical_resource": lr,
            "lexical_resource_raw": round(lr - 0.05, 4),
            "grammatical_range": gra,
            "grammatical_range_raw": round(gra + 0.06, 4),
            "estimated_cefr": service.band_to_cefr(overall),
            "word_count": wc,
            "is_off_topic": is_off_topic,
            "model_used": self.active_model_type,
            "diagnostics": {
                "word_count": wc,
                "rubric_adjustments": adjustments,
            },
            "feedback": {
                "summary": "Stub feedback",
                "strengths": [],
                "improvements": [],
                "retrieved_examiner_tips": ["Develop each body paragraph with a concrete example."],
            },
        }


def _make_260_word_essay() -> str:
    return (
        "Public transportation plays a vital role in modern urban development, and many citizens debate whether governments "
        "should prioritize buses and railways over highway expansion. In my opinion, investing in reliable public transit "
        "provides far greater long-term environmental and economic benefits for growing cities.\n\n"
        "First of all, an efficient public transport network significantly reduces traffic congestion and carbon emissions. "
        "When commuter trains and electric buses operate frequently and arrive on time, daily workers are much more likely "
        "to leave private cars at home. For example, major metropolitan areas that expanded underground metro lines observed "
        "a measurable decline in air pollution and peak-hour bottlenecks. In contrast, building wider roads often induces "
        "additional car ownership, which quickly fills up new lanes and increases fuel consumption across sprawling suburbs.\n\n"
        "Furthermore, affordable public transit improves social equity and urban accessibility. Low-income families, students, "
        "and elderly residents frequently cannot afford private vehicles, insurance, or daily parking fees. By subsidizing "
        "bus routes and modernizing rail stations, municipal authorities ensure that every citizen can reach schools, hospitals, "
        "and workplaces safely and predictably. Consequently, the local economy becomes more productive because labor mobility "
        "increases across neighborhoods while household transportation expenses remain manageable.\n\n"
        "In addition, modern transit corridors encourage compact urban planning that preserves green spaces and reduces noise "
        "in residential districts. Cities that integrate cycling lanes with regional train hubs foster healthier lifestyles "
        "and stronger community connections.\n\n"
        "In conclusion, although road maintenance remains necessary for freight delivery, governments should allocate the "
        "majority of infrastructure budgets to sustainable public transport. Doing so lowers emissions, eases gridlock, "
        "and creates fairer, more livable cities for future generations."
    )


def test_health_endpoint_loaded_and_degraded():
    cfg = service.ServiceConfig(model_type="baseline", device="cpu")
    loaded_app = service.create_app(config=cfg, scorer_instance=StubWritingScorer("baseline", 6.5))
    with TestClient(loaded_app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "healthy"
        assert body["service"] == "writing-scorer"
        assert body["modelType"] == "baseline"
        assert body["device"] == "cpu"
        assert body["modelLoaded"] is True
        assert body["supportedTasks"] == ["TASK_2", "TASK_1", "PARAGRAPH"]

    # Simulate missing model artifacts so lifespan reports degraded without crashing
    degraded_cfg = service.ServiceConfig(model_dir=SERVICE_DIR / "__nonexistent_models__", model_type="best", device="cpu")
    degraded_app = service.create_app(config=degraded_cfg, scorer_instance=None)
    with TestClient(degraded_app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["modelLoaded"] is False
        assert body["supportedTasks"] == ["TASK_2", "TASK_1", "PARAGRAPH"]
        assert body["error"]

        eval_resp = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": "Public transport", "essayText": "Public transport helps reduce urban traffic congestion."},
        )
        assert eval_resp.status_code == 503
        assert eval_resp.json()["detail"]["code"] == "MODEL_UNAVAILABLE"

        unsupported_resp = client.post(
            "/api/v1/writing/evaluate",
            json={
                "topic": "Describe your favorite book.",
                "essayText": "I like reading science fiction books on weekends.",
                "writingTask": "SPEAKING",
            },
        )
        assert unsupported_resp.status_code == 422
        assert unsupported_resp.json()["detail"]["error"] == "UNSUPPORTED_WRITING_TASK"
        assert unsupported_resp.json()["detail"]["requestedWritingTask"] == "SPEAKING"


def test_evaluate_writing_full_essay_matches_spring_boot_schema():
    cfg = service.ServiceConfig(model_type="baseline", device="cpu")
    stub = StubWritingScorer("baseline", 6.5)
    app = service.create_app(config=cfg, scorer_instance=stub)

    prompt = "Some people think governments should invest more in public transport than building new roads. To what extent do you agree or disagree?"
    essay = _make_260_word_essay()

    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/writing/evaluate",
            json={
                "topic": prompt,
                "essayText": essay,
                "assignmentTitle": "IELTS Task 2 Practice",
            },
        )

    assert resp.status_code == 200
    data = resp.json()

    # Exact schema fields expected by Spring Boot & frontend WritingAiEvaluationResult
    assert data["writingTask"] == "TASK_2"
    assert data["wordCount"] >= 250
    assert data["isOffTopic"] is False
    assert data["overallBand"] == 6.5
    assert data["overallScore"] == 72
    assert data["isPassed"] is True
    assert data["estimatedCefr"] == "B2"
    assert data["grammarScore"] == 6.0
    assert data["vocabularyScore"] == 7.0
    assert data["coherenceScore"] == 7.0
    assert data["taskResponseScore"] == 6.0
    assert data["evaluatedBy"] == "PYTHON_WRITING_SCORER"
    assert data["modelType"] == "baseline"

    ta = data["taskAchievement"]
    assert ta["score"] == 6.0
    assert isinstance(ta["addressedPoints"], list) and len(ta["addressedPoints"]) >= 1
    assert isinstance(ta["missingPoints"], list)

    assert "Band 6.5/9.0" in data["generalFeedback"]
    assert "B2" in data["generalFeedback"]
    assert isinstance(data["mistakes"], list)
    assert isinstance(data["suggestions"], list) and len(data["suggestions"]) >= 1
    for sug in data["suggestions"]:
        assert set(sug.keys()) == {"area", "recommendation"}
        assert sug["area"] and sug["recommendation"]

    assert set(data["criteriaDetails"].keys()) == {"TR", "CC", "LR", "GRA"}
    assert len(data["suggestedVocabulary"]) >= 6
    assert data["correctedWordCount"] >= 250

    sub = data["subcriteria"]
    assert sub["taskResponse"] == 6.0
    assert sub["coherenceCohesion"] == 7.0
    assert sub["lexicalResource"] == 7.0
    assert sub["grammaticalRange"] == 6.0
    assert "overallBandRaw" in sub


def test_evaluate_writing_under_length_warning_and_mechanics_correction():
    cfg = service.ServiceConfig(model_type="baseline", device="cpu")
    app = service.create_app(config=cfg, scorer_instance=StubWritingScorer("baseline", 6.0))

    flawed_essay = (
        "i believe protecting the enviroment is a important duty for every goverment. "
        "there is many reasons why citizens dont recycle properly. "
        "for example, one of the main problem is lack of education about the the environment"
    )
    prompt = "Governments and individuals should protect the environment. Discuss."

    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/writing/evaluate",
            json={"prompt": prompt, "essay": flawed_essay},
        )

    assert resp.status_code == 200
    data = resp.json()

    assert data["wordCount"] < 250
    assert "250 từ" in data["generalFeedback"]
    assert any("250 từ" in p for p in data["taskAchievement"]["missingPoints"])

    originals = [m["original"].lower() for m in data["mistakes"]]
    corrections = [m["correction"] for m in data["mistakes"]]
    assert "i" in originals
    assert "enviroment" in originals
    assert any("important" in o for o in originals)
    assert any("the the" in o for o in originals)
    assert any("don" in o or "cannot" in c or "do not" in c for o, c in zip(originals, corrections))

    corrected = data["correctedText"]
    assert corrected.startswith("I believe protecting the environment is an important duty for every government.")
    assert "There are many reasons why citizens do not recycle properly." in corrected
    assert "For example, one of the main problems is" in corrected
    assert "the the" not in corrected
    assert corrected.endswith("about the environment.")


def test_evaluate_writing_off_topic_vietnamese_and_repetition():
    cfg = service.ServiceConfig(model_type="baseline", device="cpu")
    app = service.create_app(config=cfg, scorer_instance=StubWritingScorer("baseline", 7.0))

    with TestClient(app) as client:
        # 1. Off-topic English essay
        off_topic_resp = client.post(
            "/api/v1/writing/evaluate",
            json={
                "topic": "Artificial intelligence in healthcare and medical diagnostics",
                "essayText": (
                    "Chocolate cake recipes require flour, sugar, butter, and fresh eggs baked inside an oven for forty minutes. "
                    "Many pastry chefs enjoy decorating desserts with strawberries and vanilla cream during birthday celebrations."
                ),
            },
        )
        assert off_topic_resp.status_code == 200
        off_data = off_topic_resp.json()
        assert off_data["isOffTopic"] is True
        assert off_data["overallBand"] <= 4.0
        assert off_data["taskAchievement"]["score"] <= 3.5
        assert off_data["isPassed"] is False
        assert "lạc đề" in off_data["generalFeedback"].lower()

        # 2. Vietnamese essay -> capped at <= 4.0 and flagged off-topic
        vi_resp = client.post(
            "/api/v1/writing/evaluate",
            json={
                "topic": "Education and technology",
                "essayText": "Hôm nay tôi rất thích đi học cùng bạn bè và cô giáo ở trường đại học để học tập tốt hơn mỗi ngày.",
            },
        )
        assert vi_resp.status_code == 200
        vi_data = vi_resp.json()
        assert vi_data["isOffTopic"] is True
        assert vi_data["overallBand"] <= 4.0
        assert "tiếng Việt" in vi_data["generalFeedback"]

        # 3. Repetitive essay
        rep_sentence = "Technology helps people work faster and technology helps people communicate better. "
        rep_resp = client.post(
            "/api/v1/writing/evaluate",
            json={
                "topic": "Technology helps people communicate better",
                "essayText": rep_sentence * 5,
            },
        )
        assert rep_resp.status_code == 200
        rep_data = rep_resp.json()
        assert rep_data["diagnostics"]["isRepetitive"] is True
        assert "lặp" in rep_data["generalFeedback"].lower()


def test_evaluate_writing_rejects_empty_and_oversized_essays():
    cfg = service.ServiceConfig(model_type="baseline", device="cpu")
    app = service.create_app(config=cfg, scorer_instance=StubWritingScorer("baseline", 6.0))

    with TestClient(app) as client:
        empty_resp = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": "Education", "essayText": "   \n\t  "},
        )
        assert empty_resp.status_code == 422
        assert empty_resp.json()["detail"]["code"] == "INVALID_ESSAY"

        long_resp = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": "Education", "essayText": "word " * 7000},
        )
        assert long_resp.status_code == 422
        assert long_resp.json()["detail"]["code"] == "ESSAY_TOO_LONG"


@pytest.mark.parametrize(
    "payload_extra",
    [
        {},
        {"writingTask": None},
        {"writingTask": ""},
        {"writingTask": "AUTO"},
        {"writingTask": "auto"},
        {"writingTask": "TASK_2"},
        {"writingTask": "WRITING_IELTS_TASK2"},
        {"writingTask": "TASK2"},
        {"writingTask": "ESSAY"},
        {"taskType": "TASK_2"},
        {"taskType": "WRITING_IELTS_TASK2"},
        {"writing_task": "task_2"},
        {"writingTask": "", "taskType": "TASK_2"},
    ],
)
def test_evaluate_writing_accepts_task2_aliases_and_auto(payload_extra: dict[str, Any]):
    cfg = service.ServiceConfig(model_type="baseline", device="cpu")
    stub = StubWritingScorer("baseline", 6.5)
    app = service.create_app(config=cfg, scorer_instance=stub)

    prompt = "Some people think governments should invest more in public transport than building new roads."
    essay = _make_260_word_essay()
    payload = {"topic": prompt, "essayText": essay, **payload_extra}

    with TestClient(app) as client:
        resp = client.post("/api/v1/writing/evaluate", json=payload)

    assert resp.status_code == 200
    data = resp.json()
    assert data["writingTask"] == "TASK_2"
    assert data["overallBand"] == 6.5
    assert len(stub.calls) == 1


@pytest.mark.parametrize(
    ("payload_extra", "expected_task"),
    [
        ({"writingTask": "SPEAKING"}, "SPEAKING"),
        ({"writingTask": "LISTENING"}, "LISTENING"),
        ({"taskType": "READING_MCQ"}, "READING_MCQ"),
    ],
)
def test_evaluate_writing_rejects_non_writing_tasks_with_422(
    payload_extra: dict[str, Any],
    expected_task: str,
):
    cfg = service.ServiceConfig(model_type="baseline", device="cpu")
    stub = StubWritingScorer("baseline", 6.5)
    app = service.create_app(config=cfg, scorer_instance=stub)

    payload = {
        "topic": "Talk about your favorite hobby.",
        "essayText": "My favorite hobby is reading novels every weekend in the park.",
        **payload_extra,
    }

    with TestClient(app) as client:
        resp = client.post("/api/v1/writing/evaluate", json=payload)

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail["error"] == "UNSUPPORTED_WRITING_TASK"
    assert detail["requestedWritingTask"] == expected_task
    assert len(stub.calls) == 0


def test_evaluate_writing_supports_task1_subtypes_and_overview_guardrail():
    cfg = service.ServiceConfig(model_type="baseline", device="cpu")
    stub = StubWritingScorer("baseline", 6.5)
    app = service.create_app(config=cfg, scorer_instance=stub)

    data_prompt = "The bar chart illustrates electricity consumption in three countries between 2010 and 2020. Summarize the information by selecting and reporting the main features."
    data_essay_with_overview = (
        "The bar chart compares the amount of electricity consumed across three industrialized nations—country A, country B, and country C—from 2010 to 2020, measured in million kilowatt hours.\n\n"
        "Overall, total electricity usage increased noticeably in country A and country C throughout the decade, while country B experienced a gradual downward trend over the ten-year period, ending considerably lower than country A.\n\n"
        "In 2010, country A consumed 120 million kilowatt hours, and this figure rose steadily to 150 million in 2013 and 180 million by 2015 before peaking sharply at 210 million units in 2020. "
        "By contrast, country B started as the highest consumer at 160 million units in 2010, fluctuated modestly around 150 million mid-decade due to industrial efficiency upgrades, and dropped slightly to 140 million in 2020.\n\n"
        "Meanwhile, country C recorded the lowest initial consumption at only 80 million units in 2010, yet demand grew significantly to 135 million in 2015 and nearly doubled to reach 155 million kilowatt hours by the end of the surveyed timeframe."
    )
    data_essay_no_overview = (
        "The chart shows electricity usage across three countries from 2010 to 2020. In 2010, country A consumed 120 units and rose to 210 units in 2020. "
        "Country B started at 160 units in 2010 and dropped to 140 units by 2020. Meanwhile, country C began at 80 units and increased steadily to 155 units by 2020 across the decade. "
        "Looking at the middle year 2015, country A reached 180 units whereas country B was around 150 units and country C hit 135 units in total electricity demand across industries and residential areas."
    )

    process_prompt = "The diagram below shows the manufacturing process of recycled paper bottles."
    process_essay = (
        "The process diagram illustrates the stages involved in manufacturing recycled paper bottles.\n\n"
        "Overall, the linear cycle consists of six main stages, beginning with collecting used cardboard and ending with packaging finished bottles for retail.\n\n"
        "First, discarded cardboard boxes are collected and transported to a sorting facility where plastic waste is removed. Next, the clean paper is shredded and mixed with water to produce wet pulp. "
        "Subsequently, impurities are filtered out and the pulp is pressed into bottle molds using high heat. After cooling, the bottles receive a waterproof plant-based coating before they are finally labeled and boxed for distribution."
    )

    map_prompt = "The two maps below show the redevelopment of a university campus between 2005 and 2025."
    map_essay = (
        "The two maps depict major structural changes to a university campus from 2005 to 2025.\n\n"
        "Overall, the campus underwent extensive modernization, with green fields in the north converted into academic buildings and new student facilities.\n\n"
        "In 2005, an open lawn occupied the northwest corner next to a small library. By 2025, that lawn was demolished and replaced by a science center, while the library was expanded eastward. "
        "In the south, the old car park adjacent to the main entrance was transformed into a pedestrian plaza with bicycle lanes."
    )

    with TestClient(app) as client:
        r_data = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": data_prompt, "essayText": data_essay_with_overview, "writingTask": "WRITING_IELTS_TASK1"},
        )
        assert r_data.status_code == 200
        d_data = r_data.json()
        assert d_data["writingTask"] == "TASK_1"
        assert d_data["writingSubType"] == "TASK1_DATA"
        assert d_data["overallBand"] >= 6.0
        assert "250 từ" not in d_data["generalFeedback"]

        r_no_ov = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": data_prompt, "essayText": data_essay_no_overview, "writingTask": "TASK_1"},
        )
        assert r_no_ov.status_code == 200
        d_no_ov = r_no_ov.json()
        assert d_no_ov["taskResponseScore"] <= 5.5
        assert any("Overview" in p for p in d_no_ov["taskAchievement"]["missingPoints"])

        r_proc = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": process_prompt, "essayText": process_essay, "writingTask": "TASK_1"},
        )
        assert r_proc.status_code == 200
        assert r_proc.json()["writingSubType"] == "TASK1_PROCESS"

        r_map = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": map_prompt, "essayText": map_essay, "writingTask": "TASK_1"},
        )
        assert r_map.status_code == 200
        assert r_map.json()["writingSubType"] == "TASK1_MAP"


def test_evaluate_writing_supports_paragraph_email_opinion_and_discursive_c1():
    cfg = service.ServiceConfig(model_type="baseline", device="cpu")
    stub = StubWritingScorer("baseline", 6.5)
    app = service.create_app(config=cfg, scorer_instance=stub)

    email_prompt = "Write a short email (40-80 words) inviting your friend Nam to a weekend study session."
    email_text = (
        "Hi Nam,\n"
        "I'm organizing a weekend English study session at the city library on Saturday morning from 9 a.m. "
        "We'll practice writing short paragraphs and review vocabulary together. Please let me know if you can join us!\n"
        "Best regards,\n"
        "Minh"
    )

    opinion_prompt = "Opinion Paragraph (100-150 words): Should high school students do part-time jobs during the school year?"
    opinion_text = (
        "In my opinion, taking a part-time job during high school brings valuable benefits if students manage their schedules well. "
        "First, earning a modest income helps teenagers learn financial responsibility and appreciate the value of hard work. "
        "Moreover, working in cafes or bookstores improves communication skills and teamwork outside the classroom. "
        "However, students must limit their working hours on weekends so that academic performance does not suffer. "
        "In short, part-time work prepares young people for future careers when balanced properly with study."
    )

    with TestClient(app) as client:
        r_email = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": email_prompt, "essayText": email_text, "writingTask": "WRITING_SHORT_EMAIL"},
        )
        assert r_email.status_code == 200
        d_email = r_email.json()
        assert d_email["writingTask"] == "PARAGRAPH"
        assert d_email["writingSubType"] == "PARAGRAPH_EMAIL"
        assert d_email["overallBand"] >= 5.5
        # Informal contractions like I'm / We'll must not be flagged as academic register mistakes in casual email
        assert not any(m["original"].lower() in ("i'm", "we'll") for m in d_email["mistakes"])

        r_op = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": opinion_prompt, "essayText": opinion_text, "writingTask": "WRITING_OPINION"},
        )
        assert r_op.status_code == 200
        d_op = r_op.json()
        assert d_op["writingTask"] == "PARAGRAPH"
        assert d_op["writingSubType"] == "PARAGRAPH_OPINION"
        assert d_op["overallBand"] >= 5.5
        assert "100–150 từ" in d_op["generalFeedback"]

        r_c1 = client.post(
            "/api/v1/writing/evaluate",
            json={
                "topic": "Discursive Academic Essay (C1): Artificial intelligence and academic integrity.",
                "essayText": _make_260_word_essay().replace("Public transportation", "Artificial intelligence").replace("public transit", "artificial intelligence"),
                "writingTask": "WRITING_DISCURSIVE_ESSAY",
            },
        )
        assert r_c1.status_code == 200
        d_c1 = r_c1.json()
        assert d_c1["writingTask"] == "TASK_2"
        assert d_c1["writingSubType"] == "TASK2_DISCURSIVE_C1"


def test_baseline_model_cpu_integration_without_gpu():
    """Verify real baseline WritingScorer output integrates cleanly into service response on CPU."""
    baseline_bundle = SERVICE_DIR / "models" / "baseline" / "baseline_bundle.joblib"
    if not baseline_bundle.exists():
        pytest.skip("Baseline bundle not found on disk.")

    prompt = "Some people think governments should invest more in public transport than building new roads."
    essay = _make_260_word_essay()

    try:
        import lightgbm  # noqa: F401
        import sklearn  # noqa: F401
        has_ml_deps = True
    except ImportError:
        has_ml_deps = False

    if has_ml_deps:
        cfg = service.ServiceConfig(model_type="baseline", device="cpu")
        real_scorer = service.load_scorer(cfg)
        app = service.create_app(config=cfg, scorer_instance=real_scorer)
        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/writing/evaluate",
                json={"topic": prompt, "essayText": essay},
            )
            assert resp.status_code == 200
            data = resp.json()
    else:
        venv_python = SERVICE_DIR / ".venv" / "Scripts" / "python.exe"
        if not venv_python.exists():
            pytest.skip("Neither local ML deps nor writing-scorer/.venv available.")
        proc = subprocess.run(
            [
                str(venv_python),
                str(SERVICE_DIR / "infer.py"),
                "--model-type",
                "baseline",
                "--prompt",
                prompt,
                "--essay",
                essay,
                "--json",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        )
        raw_pred = json.loads(proc.stdout.strip())
        data = service.build_evaluation_response(raw_pred, prompt=prompt, essay=essay, requested_model_type="baseline")

    assert 1.0 <= data["overallBand"] <= 9.0
    assert data["overallBand"] * 2 == int(data["overallBand"] * 2)
    assert data["writingTask"] == "TASK_2"
    assert data["modelType"] == "baseline"
    assert data["evaluatedBy"] == "PYTHON_WRITING_SCORER"
    assert data["isOffTopic"] is False
    assert data["wordCount"] >= 250
    assert data["estimatedCefr"] in {"A2", "B1", "B2", "C1", "C2"}
    assert "Band " in data["generalFeedback"]


def test_evaluate_writing_forumflash_rubric_rounding_297_words_and_example_upgrade():
    """Verify IELTS whole-band criteria, floor-half-band overall (7,8,8,8 -> 7.5), 297 word count, and rich criteriaDetails."""

    class RawModelStub:
        active_model_type = "hybrid"
        torch_device = "cuda"

        def predict(self, prompt: str, essay: str, include_feedback: bool = True, apply_guardrails: bool = True):
            return {
                "overall_band": 8.0,
                "overall_band_raw": 7.98,
                "task_response": 7.0,
                "task_response_raw": 7.0,
                "coherence_cohesion": 8.0,
                "coherence_cohesion_raw": 7.8159,
                "lexical_resource": 8.5,
                "lexical_resource_raw": 8.4278,
                "grammatical_range": 8.5,
                "grammatical_range_raw": 8.3938,
                "word_count": 310,
                "is_off_topic": False,
                "model_used": "hybrid",
                "diagnostics": {"guardrails_applied": True, "rubric_adjustments": []},
                "feedback": {"retrieved_examiner_tips": []},
            }

    prompt = (
        "The transition from fossil fuels to renewable energy sources is often seen as crucial for environmental sustainability. "
        "However, this shift can bring significant economic and social challenges to communities reliant on traditional energy industries. "
        "Discuss both the environmental benefits and the socio-economic challenges of a global transition to renewable energy. "
        "Give your own opinion. Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words."
    )
    essay = (
        "The global transition from fossil fuels to renewable energy is widely regarded as vital for environmental preservation, "
        "yet it simultaneously poses profound economic and social challenges for communities reliant on traditional energy sectors. "
        "While this shift inevitably inflicts severe short-term socio-economic disruption on fossil-fuel-dependent regions, "
        "I firmly believe that its enduring ecological benefits—coupled with long-term economic resilience—make decarbonization an urgent global imperative.\n\n"
        "On the one hand, accelerating the adoption of clean energy yields transformative environmental advantages essential for planetary survival. "
        "Conventional power generation driven by coal and oil is the primary catalyst of greenhouse gas emissions, accelerating global warming, extreme weather events, "
        "and irreversible biodiversity loss. Replacing legacy infrastructure with solar, wind, and hydroelectric systems drastically curtails carbon footprints "
        "and mitigates hazardous air and water pollution. For instance, Northern European nations that have heavily decarbonized their power grids have not only reduced "
        "respiratory illnesses caused by industrial smog but also stabilized local ecosystems against climate-induced degradation.\n\n"
        "On the other hand, phasing out traditional energy industries creates formidable hurdles for specialized local economies. "
        "Entire towns built around coal mining or oil extraction face structural unemployment, declining property values, and the erosion of community identity when plants close. "
        "Furthermore, the technical expertise of conventional energy workers rarely transfers seamlessly to green technology sectors without substantial retraining. "
        "Nevertheless, these setbacks are transitional rather than permanent; through targeted government intervention—such as vocational reskilling programs, "
        "green industrial subsidies, and robust social safety nets—displaced workers can be successfully integrated into the emerging clean-energy economy.\n\n"
        "In conclusion, although moving away from fossil fuels generates undeniable socio-economic strain for traditional energy communities, "
        "the environmental necessity of clean energy far outweighs these temporary difficulties. By pairing ambitious renewable energy targets with comprehensive "
        "transition policies for affected workers, governments can safeguard ecosystems while securing equitable long-term prosperity."
    )

    cfg = service.ServiceConfig(model_type="best", device="cuda")
    app = service.create_app(config=cfg, scorer_instance=RawModelStub())
    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": prompt, "essayText": essay, "writingTask": "TASK_2"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["wordCount"] == 297
    assert data["taskResponseScore"] == 7.0
    assert data["coherenceScore"] == 8.0
    assert data["vocabularyScore"] == 8.0
    assert data["grammarScore"] == 8.0
    assert data["overallBand"] == 7.5
    assert data["criteriaDetails"]["TR"]["band"] == 7.0
    assert data["criteriaDetails"]["TR"]["nextBand"] == 8
    assert data["criteriaDetails"]["CC"]["band"] == 8.0
    assert data["criteriaDetails"]["LR"]["band"] == 8.0
    assert data["criteriaDetails"]["GRA"]["band"] == 8.0
    highlights = data["criteriaDetails"]["TR"]["highlights"]
    assert len(highlights) == 1
    assert "Northern European nations" in highlights[0]["inEssay"]
    assert "Germany" in highlights[0]["rewritten"]
    assert "thirty percent" in highlights[0]["rewritten"]
    assert "Ruhr valley" in data["correctedText"]
    assert data["correctedWordCount"] > 280
    vocab_terms = {v["word"] for v in data["suggestedVocabulary"]}
    assert "fossil fuel phase-out" in vocab_terms
    assert "carbon footprint reduction" in vocab_terms
    for item in data["suggestedVocabulary"]:
        assert item["ipa"].startswith("/")
        assert item["meaning"] and item["example"] and item["usageContext"]


def test_normalize_writing_task_and_detect_writing_subtype_comprehensive():
    """Verify normalize_writing_task and detect_writing_subtype across all TASK_1, TASK_2, and PARAGRAPH subtypes."""
    assert service.normalize_writing_task(None) == "TASK_2"
    assert service.normalize_writing_task("  ") == "TASK_2"
    assert service.normalize_writing_task("AUTO") == "TASK_2"
    assert service.normalize_writing_task("task1-process") == "TASK_1"
    assert service.normalize_writing_task("TASK1_MAP") == "TASK_1"
    assert service.normalize_writing_task("TASK1_DATA") == "TASK_1"
    assert service.normalize_writing_task("writing-short-email") == "PARAGRAPH"
    assert service.normalize_writing_task("PARAGRAPH_DESCRIPTIVE") == "PARAGRAPH"
    assert service.normalize_writing_task("TASK2_DISCURSIVE_C1") == "TASK_2"

    # TASK_1 subtypes: DATA, PROCESS, MAP
    assert service.detect_writing_subtype(
        "TASK_1", prompt="The bar chart compares export earnings across five categories between 2010 and 2020."
    ) == "TASK1_DATA"
    assert service.detect_writing_subtype(
        "TASK_1", raw_task="TASK1_PROCESS", prompt="The diagram shows how glass containers are recycled."
    ) == "TASK1_PROCESS"
    assert service.detect_writing_subtype(
        "TASK_1", prompt="The diagram below shows the stages of producing cement for construction."
    ) == "TASK1_PROCESS"
    assert service.detect_writing_subtype(
        "TASK_1", prompt="The maps below show the redevelopment of a coastal village between 1995 and the present."
    ) == "TASK1_MAP"

    # TASK_2 subtypes: OPINION, DISCUSSION, DISCURSIVE_C1, ADV_DISADV, PROBLEM_SOLUTION, TWO_PART
    assert service.detect_writing_subtype(
        "TASK_2", prompt="University education should be free for all students. To what extent do you agree or disagree?"
    ) == "TASK2_OPINION"
    assert service.detect_writing_subtype(
        "TASK_2", prompt="Some people prefer working remotely while others prefer offices. Discuss both views and give your opinion."
    ) == "TASK2_DISCUSSION"
    assert service.detect_writing_subtype(
        "TASK_2", raw_task="WRITING_DISCURSIVE_ESSAY", prompt="Critically evaluate the ethics of autonomous AI systems."
    ) == "TASK2_DISCURSIVE_C1"
    assert service.detect_writing_subtype(
        "TASK_2", prompt="Do the advantages of international tourism outweigh the disadvantages?"
    ) == "TASK2_ADV_DISADV"
    assert service.detect_writing_subtype(
        "TASK_2", prompt="Plastic waste is rising rapidly. What are the causes of this problem and what solutions can be proposed?"
    ) == "TASK2_PROBLEM_SOLUTION"
    assert service.detect_writing_subtype(
        "TASK_2", prompt="Many graduates struggle to find work. Why is this happening? Is it a positive or negative development?"
    ) == "TASK2_TWO_PART"

    # PARAGRAPH subtypes: EMAIL, DESCRIPTIVE, OPINION, ADV_DISADV, CAUSE_EFFECT, PROBLEM_SOLUTION, GUIDED
    assert service.detect_writing_subtype(
        "PARAGRAPH", prompt="Write a short email to your friend inviting them to a weekend picnic."
    ) == "PARAGRAPH_EMAIL"
    assert service.detect_writing_subtype(
        "PARAGRAPH", prompt="Write a descriptive paragraph about your daily routine and favorite hobby."
    ) == "PARAGRAPH_DESCRIPTIVE"
    assert service.detect_writing_subtype(
        "PARAGRAPH", raw_task="PARAGRAPH_OPINION", prompt="Write an opinion paragraph on whether homework helps students."
    ) == "PARAGRAPH_OPINION"
    assert service.detect_writing_subtype(
        "PARAGRAPH", prompt="Write a paragraph about the advantage and disadvantage of online shopping."
    ) == "PARAGRAPH_ADV_DISADV"
    assert service.detect_writing_subtype(
        "PARAGRAPH", prompt="Write a paragraph explaining the cause and effect of sleep deprivation."
    ) == "PARAGRAPH_CAUSE_EFFECT"
    assert service.detect_writing_subtype(
        "PARAGRAPH", prompt="Write a paragraph about the problem and solution of campus littering."
    ) == "PARAGRAPH_PROBLEM_SOLUTION"
    assert service.detect_writing_subtype(
        "PARAGRAPH", prompt="Write a structured academic paragraph of 100 to 120 words on renewable energy."
    ) == "PARAGRAPH_GUIDED"


def test_band_rounding_word_count_and_target_range_helpers():
    """Verify floor_to_half_band (IELTS 0.5 floor rule), round_to_whole_band, round_to_half_band, and word range parsing."""
    # IELTS overall floor-to-0.5 rule: (7 + 8 + 8 + 8) / 4 = 7.75 -> 7.5; (6 + 6 + 7 + 6) / 4 = 6.25 -> 6.0
    assert service.floor_to_half_band(7.75) == 7.5
    assert service.floor_to_half_band(6.25) == 6.0
    assert service.floor_to_half_band(6.5) == 6.5
    assert service.floor_to_half_band(0.2) == 1.0
    assert service.floor_to_half_band(9.8) == 9.0

    assert service.round_to_whole_band(7.5) == 8.0
    assert service.round_to_whole_band(7.49) == 7.0
    assert service.round_to_half_band(6.26) == 6.5

    assert service._extract_target_word_range(
        "PARAGRAPH", "PARAGRAPH_EMAIL", prompt="Write an email of 40-60 words to your friend."
    ) == (40, 60)
    assert service._extract_target_word_range(
        "PARAGRAPH", "PARAGRAPH_GUIDED", rubrics="Write between 120 and 150 words."
    ) == (120, 150)
    assert service._extract_target_word_range(
        "TASK_2", "TASK2_OPINION", prompt="Write at least 250 words."
    ) == (250, 310)


def test_evaluate_writing_prompt_parroting_and_vietnamese_boundary():
    """Verify prompt parroting caps overall <= 4.0 and TR <= 3.0, and Vietnamese token ratio >= 25% triggers guardrail."""
    app = service.create_app(
        config=service.ServiceConfig(model_type="baseline", device="cpu"),
        scorer_instance=StubWritingScorer(active_model_type="baseline", base_band=7.0),
    )
    prompt = (
        "Some people believe that university education should be free for all students "
        "regardless of their financial background. To what extent do you agree or disagree?"
    )
    parroted_essay = (
        "Some people believe that university education should be free for all students "
        "regardless of their financial background and to what extent do you agree or disagree with this university education."
    )
    # Exactly >= 25% Vietnamese accented tokens (5 accented words out of 18 tokens = 27.8%)
    vn_threshold_essay = (
        "Education helps students develop skills nhưng nhiều người nghĩ rằng học phí "
        "creates financial burden for families today."
    )

    with TestClient(app) as client:
        resp_parrot = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": prompt, "essayText": parroted_essay, "writingTask": "TASK_2"},
        )
        resp_vn = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": prompt, "essayText": vn_threshold_essay, "writingTask": "TASK_2"},
        )

    assert resp_parrot.status_code == 200
    parrot_data = resp_parrot.json()
    assert parrot_data["isOffTopic"] is True
    assert parrot_data["taskResponseScore"] <= 3.0
    assert parrot_data["overallBand"] <= 4.0
    assert any("parroting" in r.lower() for r in parrot_data["diagnostics"]["rubricAdjustments"])
    assert "lặp lại câu chữ của đề bài" in parrot_data["generalFeedback"]

    assert resp_vn.status_code == 200
    vn_data = resp_vn.json()
    assert vn_data["isOffTopic"] is True
    assert vn_data["overallBand"] <= 4.0
    assert any("non-english" in r.lower() and "vietnamese" in r.lower() for r in vn_data["diagnostics"]["rubricAdjustments"])


def test_evaluate_writing_email_missing_greeting_signoff_and_descriptive_paragraph():
    """Verify PARAGRAPH_EMAIL missing greeting/sign-off caps TR <= 5.0 and flags missing parts, plus PARAGRAPH_DESCRIPTIVE."""
    app = service.create_app(
        config=service.ServiceConfig(model_type="baseline", device="cpu"),
        scorer_instance=StubWritingScorer(active_model_type="baseline", base_band=7.0),
    )
    email_prompt = "Write a short email (40-60 words) to your friend Nam about your weekend trip."
    email_without_greeting_or_signoff = (
        "I went to Da Lat with my family last weekend and the weather was cool and sunny. "
        "We visited the flower garden, drank hot coffee by the lake, and took many photos together. "
        "Let us meet at the library tomorrow afternoon so I can show you the pictures."
    )
    descriptive_prompt = "Write a descriptive paragraph (60-90 words) about your favorite hobby and daily routine."
    descriptive_essay = (
        "My favorite hobby is playing badminton in the park every evening after finishing my school classes. "
        "Firstly, this daily routine helps me stay healthy, energetic, and focused on my academic studies. "
        "For example, practicing twenty minutes of footwork drills with my classmates improves my stamina and teamwork skills. "
        "Therefore, playing badminton brings both physical fitness and lasting happiness to my everyday life."
    )

    with TestClient(app) as client:
        resp_email = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": email_prompt, "essayText": email_without_greeting_or_signoff, "writingTask": "PARAGRAPH_EMAIL"},
        )
        resp_desc = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": descriptive_prompt, "essayText": descriptive_essay, "writingTask": "PARAGRAPH_DESCRIPTIVE"},
        )

    assert resp_email.status_code == 200
    email_data = resp_email.json()
    assert email_data["writingTask"] == "PARAGRAPH"
    assert email_data["writingSubType"] == "PARAGRAPH_EMAIL"
    assert email_data["taskResponseScore"] <= 5.0
    assert email_data["coherenceScore"] <= 6.0
    assert any("thiếu lời chào mở đầu hoặc lời kết thư" in r.lower() for r in email_data["diagnostics"]["rubricAdjustments"])
    missing_points = " ".join(email_data["taskAchievement"]["missingPoints"])
    assert "Thiếu lời chào mở đầu" in missing_points
    assert "Thiếu lời kết thư" in missing_points

    assert resp_desc.status_code == 200
    desc_data = resp_desc.json()
    assert desc_data["writingTask"] == "PARAGRAPH"
    assert desc_data["writingSubType"] == "PARAGRAPH_DESCRIPTIVE"
    assert desc_data["overallBand"] >= 6.0


def test_evaluate_writing_non_alphanumeric_and_unexpected_internal_error():
    """Verify punctuation-only essay returns 422 INVALID_ESSAY and unexpected scorer crash returns 500 INTERNAL_ERROR."""
    app = service.create_app(
        config=service.ServiceConfig(model_type="baseline", device="cpu"),
        scorer_instance=StubWritingScorer(active_model_type="baseline", base_band=6.5),
    )
    with TestClient(app) as client:
        resp_punct = client.post(
            "/api/v1/writing/evaluate",
            json={"topic": "Any topic", "essayText": "... !!! ??? ---", "writingTask": "TASK_2"},
        )
    assert resp_punct.status_code == 422
    assert resp_punct.json()["detail"]["code"] == "INVALID_ESSAY"

    class ExplodingScorerStub:
        active_model_type = "baseline"
        torch_device = "cpu"

        def predict(self, *args, **kwargs):
            raise RuntimeError("Simulated tensor shape failure")

    err_app = service.create_app(
        config=service.ServiceConfig(model_type="baseline", device="cpu"),
        scorer_instance=ExplodingScorerStub(),
    )
    with TestClient(err_app, raise_server_exceptions=False) as err_client:
        resp_500 = err_client.post(
            "/api/v1/writing/evaluate",
            json={
                "topic": "University education should be free.",
                "essayText": "University education plays an important role in modern society and supports social mobility.",
                "writingTask": "TASK_2",
            },
        )
    assert resp_500.status_code == 500
    assert resp_500.json()["detail"]["code"] == "INTERNAL_ERROR"

