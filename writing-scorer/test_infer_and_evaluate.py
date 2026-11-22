"""Unit tests for writing-scorer/infer.py and writing-scorer/evaluate.py."""

from __future__ import annotations

import json
import math
from pathlib import Path
import sys
from typing import Any

import numpy as np
import pytest
from sklearn.feature_extraction.text import TfidfVectorizer

SERVICE_DIR = Path(__file__).resolve().parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

import evaluate  # noqa: E402
import infer  # noqa: E402
from train_baseline import TARGETS  # noqa: E402


def _make_base_pred(band: float = 7.5) -> dict[str, float]:
    pred: dict[str, float] = {}
    for k in TARGETS:
        pred[k] = float(evaluate.round_to_half_band(band))
        pred[f"{k}_raw"] = float(band)
    return pred


# ===========================================================================
# 1. band_to_cefr & round_to_half_band & band_to_class
# ===========================================================================


@pytest.mark.parametrize(
    ("band", "expected_cefr"),
    [
        (9.0, "C2"),
        (8.5, "C2"),
        (8.0, "C1"),
        (7.0, "C1"),
        (6.5, "B2"),
        (5.5, "B2"),
        (5.0, "B1"),
        (4.0, "B1"),
        (3.5, "A2"),
        (1.0, "A2"),
    ],
)
def test_band_to_cefr_boundaries(band: float, expected_cefr: str) -> None:
    assert infer.band_to_cefr(band) == expected_cefr


def test_round_to_half_band_and_band_to_class() -> None:
    assert evaluate.round_to_half_band(0.2) == 1.0
    assert evaluate.round_to_half_band(9.8) == 9.0
    assert evaluate.round_to_half_band(6.24) == 6.0
    assert evaluate.round_to_half_band(6.25) == 6.5
    assert evaluate.round_to_half_band(6.74) == 6.5
    assert evaluate.round_to_half_band(6.75) == 7.0

    arr = evaluate.round_to_half_band([0.5, 5.25, 6.74, 8.75, 10.0])
    assert isinstance(arr, np.ndarray)
    np.testing.assert_allclose(arr, np.array([1.0, 5.5, 6.5, 9.0, 9.0]))

    classes = evaluate.band_to_class([1.0, 1.5, 5.0, 6.5, 9.0, 12.0])
    np.testing.assert_array_equal(classes, np.array([0, 1, 8, 11, 16, 16]))


# ===========================================================================
# 2. evaluate.py: MAE, RMSE, QWK, correlations, evaluate_predictions, JSONL
# ===========================================================================


def test_compute_metrics_empty_perfect_and_partial_error() -> None:
    empty = evaluate.compute_metrics([], [])
    assert empty["n"] == 0
    assert empty["mae"] == 0.0
    assert empty["rmse"] == 0.0
    assert empty["qwk"] == 0.0

    y_true = [5.0, 6.0, 7.0, 8.0]
    perfect = evaluate.compute_metrics(y_true, y_true)
    assert perfect["n"] == 4
    assert perfect["mae"] == 0.0
    assert perfect["rmse"] == 0.0
    assert perfect["qwk"] == 1.0
    assert perfect["pearson"] == 1.0
    assert perfect["spearman"] == 1.0
    assert perfect["exact_match_pct"] == 100.0
    assert perfect["within_0_5_pct"] == 100.0
    assert perfect["within_1_0_pct"] == 100.0

    # Partial deviations: diffs = [0.5, 0.0, -0.5, 1.0] -> MAE = 0.5, RMSE = sqrt(1.5/4) = 0.6124
    y_pred = [5.5, 6.0, 6.5, 9.0]
    m = evaluate.compute_metrics(y_true, y_pred)
    assert m["n"] == 4
    assert m["mae"] == pytest.approx(0.5, abs=1e-4)
    assert m["rmse"] == pytest.approx(math.sqrt(1.5 / 4.0), abs=1e-4)
    assert 0.70 < m["qwk"] < 1.0
    assert m["exact_match_pct"] == 25.0
    assert m["within_0_5_pct"] == 75.0
    assert m["within_1_0_pct"] == 100.0

    # Constant predictions / zero variance -> safe correlation 0.0 and no NaN QWK
    const_same = evaluate.compute_metrics([6.5, 6.5, 6.5], [6.5, 6.5, 6.5])
    assert const_same["pearson"] == 0.0
    assert const_same["spearman"] == 0.0
    assert const_same["qwk"] == 1.0

    const_diff = evaluate.compute_metrics([6.5, 6.5], [5.0, 5.0])
    assert const_diff["qwk"] == 0.0


def test_evaluate_predictions_and_load_jsonl(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    records = [
        {
            "overall_band": 6.0,
            "task_response": 6.0,
            "coherence_cohesion": 6.5,
            "lexical_resource": 6.0,
            "grammatical_range": 5.5,
            "source": "ielts_cambridge",
        },
        {
            "overall_band": 7.5,
            "task_response": 7.5,
            "coherence_cohesion": 7.5,
            "lexical_resource": 7.0,
            "grammatical_range": 7.5,
            "source": "hf_writing",
        },
        {"overall_band": None, "source": "ignored"},
    ]
    preds = [
        {
            "overall_band_raw": 6.1,
            "task_response_raw": 6.0,
            "coherence_cohesion_raw": 6.4,
            "lexical_resource_raw": 6.2,
            "grammatical_range_raw": 5.6,
        },
        {
            "overall_band": 7.5,
            "task_response": 7.5,
            "coherence_cohesion": 7.5,
            "lexical_resource": 7.0,
            "grammatical_range": 7.5,
        },
        {"overall_band": 5.0},
    ]

    jsonl_path = tmp_path / "sample.jsonl"
    jsonl_path.write_text("\n".join(json.dumps(r) for r in records[:2]) + "\n\n", encoding="utf-8")
    loaded = evaluate.load_jsonl(jsonl_path)
    assert len(loaded) == 2

    report = evaluate.evaluate_predictions(records, preds)
    assert report["overall"]["n"] == 2
    assert set(report["by_source"].keys()) == {"hf_writing", "ielts_cambridge"}
    assert set(report["subcriteria"].keys()) == set(evaluate.SUBCRITERIA_KEYS)

    evaluate.print_evaluation_summary("unit_val", report)
    captured = capsys.readouterr().out
    assert "Evaluation [unit_val]" in captured
    assert "sub:task_response" in captured


# ===========================================================================
# 3. infer.py: _build_diagnostics (off-topic, repetitive, grammar_flags)
# ===========================================================================


def test_build_diagnostics_off_topic_and_tfidf_similarity() -> None:
    prompt = "Governments should invest more money in renewable solar and wind energy infrastructure to combat climate change."
    on_topic_essay = (
        "Investing public funds in renewable solar and wind energy infrastructure is essential to combat climate change "
        "and reduce greenhouse gas emissions across modern industrial nations."
    )
    off_topic_essay = (
        "Baking chocolate cookies with butter, sugar, vanilla, and fresh strawberries is my favorite kitchen hobby "
        "during family birthday parties on Sunday afternoons."
    )

    tfidf = TfidfVectorizer(ngram_range=(1, 2)).fit([prompt, on_topic_essay, off_topic_essay])

    diag_on = infer._build_diagnostics(prompt, on_topic_essay, prompt_tfidf=tfidf)
    assert diag_on["has_prompt"] is True
    assert diag_on["is_off_topic"] is False
    assert diag_on["prompt_content_coverage"] > 0.25
    assert diag_on["prompt_tfidf_similarity"] > 0.15

    diag_off = infer._build_diagnostics(prompt, off_topic_essay, prompt_tfidf=tfidf)
    assert diag_off["has_prompt"] is True
    assert diag_off["is_off_topic"] is True
    assert diag_off["prompt_content_coverage"] == 0.0

    # Short prompt (< 4 words) -> has_prompt is False -> never flagged off-topic
    diag_short_prompt = infer._build_diagnostics("Education", off_topic_essay, prompt_tfidf=None)
    assert diag_short_prompt["has_prompt"] is False
    assert diag_short_prompt["is_off_topic"] is False


def test_build_diagnostics_repetitive_and_all_five_grammar_flags() -> None:
    prompt = "Discuss the impact of modern technology on daily communication."
    repetitive_essay = ("Modern technology improves daily communication in every office. " * 9).strip()
    diag_rep = infer._build_diagnostics(prompt, repetitive_essay)
    assert diag_rep["word_count"] >= 60
    assert diag_rep["is_repetitive"] is True
    assert diag_rep["repeated_trigram_ratio"] > 0.32

    # Craft essay triggering all 5 grammar flags simultaneously:
    # 1. lowercase standalone 'i'
    # 2. lowercase sentence start
    # 3. missing terminal punctuation
    # 4. indefinite article mismatch ('a apple', 'a elephant')
    # 5. adjacent duplicate word ('the the')
    flawed_essay = (
        "i think eating a apple and a elephant snack in the the park is fun. "
        "this second sentence starts with lowercase. "
        "third sentence also starts lowercase without ending punctuation"
    )
    diag_flags = infer._build_diagnostics(prompt, flawed_essay)
    flags_joined = " | ".join(diag_flags["grammar_flags"]).lower()
    assert "capitalize pronoun 'i'" in flags_joined
    assert "begin with a capital letter" in flags_joined
    assert "missing terminal punctuation" in flags_joined
    assert "indefinite article mismatch" in flags_joined
    assert "adjacent duplicate word" in flags_joined
    assert len(diag_flags["grammar_flags"]) == 5


# ===========================================================================
# 4. infer.py: _apply_rubric_guardrails (<50, <120, <220, off-topic, repetitive)
# ===========================================================================


def test_apply_rubric_guardrails_word_count_tiers() -> None:
    base_diag: dict[str, Any] = {
        "word_count": 30,
        "has_prompt": True,
        "prompt_tfidf_similarity": 0.45,
        "is_off_topic": False,
        "is_repetitive": False,
    }

    # Tier 1: < 50 words -> all targets capped at 3.5
    out_30, adj_30 = infer._apply_rubric_guardrails(_make_base_pred(7.5), dict(base_diag, word_count=30))
    for k in TARGETS:
        assert out_30[k] == 3.5
        assert out_30[f"{k}_raw"] == 3.5
    assert any("<50 words" in a for a in adj_30)

    # Tier 2: 50 <= wc < 120 -> task_response capped at 4.0, overall_band capped at 4.5, others untouched
    out_90, adj_90 = infer._apply_rubric_guardrails(_make_base_pred(7.5), dict(base_diag, word_count=90))
    assert out_90["task_response"] == 4.0
    assert out_90["overall_band"] == 4.5
    assert out_90["lexical_resource"] == 7.5
    assert any("<120 words" in a for a in adj_90)

    # Tier 3: 120 <= wc < 220 -> task_response capped at 5.5, overall_band capped at 6.0
    out_180, adj_180 = infer._apply_rubric_guardrails(_make_base_pred(7.5), dict(base_diag, word_count=180))
    assert out_180["task_response"] == 5.5
    assert out_180["overall_band"] == 6.0
    assert out_180["coherence_cohesion"] == 7.5
    assert any("<220 words" in a for a in adj_180)

    # Tier 4: >= 220 words on-topic & non-repetitive -> no caps
    out_270, adj_270 = infer._apply_rubric_guardrails(_make_base_pred(7.5), dict(base_diag, word_count=270))
    assert out_270["overall_band"] == 7.5
    assert out_270["task_response"] == 7.5
    assert adj_270 == []


def test_apply_rubric_guardrails_off_topic_repetitive_and_secondary_promotion() -> None:
    # 1. Explicit off-topic: TR <= 3.5, Overall <= 4.0
    diag_off = {
        "word_count": 265,
        "has_prompt": True,
        "prompt_tfidf_similarity": 0.0,
        "is_off_topic": True,
        "is_repetitive": False,
    }
    out_off, adj_off = infer._apply_rubric_guardrails(_make_base_pred(7.5), diag_off)
    assert out_off["task_response"] == 3.5
    assert out_off["overall_band"] == 4.0
    assert any("Off-topic" in a for a in adj_off)

    # 2. Secondary off-topic promotion when prompt_tfidf_similarity < 0.025 and task_response_raw <= 3.5
    pred_low_tr = _make_base_pred(6.0)
    pred_low_tr["task_response"] = 3.5
    pred_low_tr["task_response_raw"] = 3.4
    diag_border = {
        "word_count": 250,
        "has_prompt": True,
        "prompt_tfidf_similarity": 0.015,
        "is_off_topic": False,
        "is_repetitive": False,
    }
    out_border, adj_border = infer._apply_rubric_guardrails(pred_low_tr, diag_border)
    assert diag_border["is_off_topic"] is True
    assert out_border["overall_band"] == 4.0
    assert any("Off-topic" in a for a in adj_border)

    # 3. Repetitive essay: coherence_cohesion, lexical_resource, overall_band capped at 4.0
    diag_rep = {
        "word_count": 260,
        "has_prompt": True,
        "prompt_tfidf_similarity": 0.35,
        "is_off_topic": False,
        "is_repetitive": True,
    }
    out_rep, adj_rep = infer._apply_rubric_guardrails(_make_base_pred(7.0), diag_rep)
    assert out_rep["coherence_cohesion"] == 4.0
    assert out_rep["lexical_resource"] == 4.0
    assert out_rep["overall_band"] == 4.0
    assert out_rep["grammatical_range"] == 7.0
    assert any("repetition" in a for a in adj_rep)

    # 4. Guardrail still caps even if input pred dict omits *_raw keys
    rounded_only = {k: 7.0 for k in TARGETS}
    out_no_raw, _ = infer._apply_rubric_guardrails(rounded_only, dict(diag_off, word_count=40))
    assert out_no_raw["overall_band"] == 3.5


# ===========================================================================
# 5. infer.py: _retrieve_examiner_tips, _generate_feedback & WritingScorer
# ===========================================================================


def test_retrieve_examiner_tips_and_generate_feedback_tiers() -> None:
    for band in (4.5, 6.0, 7.0, 8.0):
        tips = infer._retrieve_examiner_tips(None, "Prompt", "Essay", pred_band=band, top_k=2)
        assert len(tips) == 2

    scores = {
        "overall_band": 7.0,
        "task_response": 7.5,
        "coherence_cohesion": 7.0,
        "lexical_resource": 7.0,
        "grammatical_range": 6.0,
    }
    diag = {
        "word_count": 275,
        "paragraph_count": 4,
        "discourse_markers_unique": 5,
        "lexical_diversity_ttr": 0.52,
        "is_off_topic": False,
        "is_repetitive": False,
        "grammar_flags": ["Possible indefinite article mismatch ('a' before vowel sound)."],
    }
    fb = infer._generate_feedback(scores, diag, adjustments=[], retrieved_tips=["Tip 1"])
    assert "CEFR C1" in fb["summary"]
    assert len(fb["strengths"]) >= 3
    assert any("complex clauses" in imp for imp in fb["improvements"])
    assert any("indefinite article" in imp for imp in fb["improvements"])


def test_writing_scorer_predict_batch_hybrid_and_model_resolution(tmp_path: Path) -> None:
    # Missing models directory raises FileNotFoundError
    with pytest.raises(FileNotFoundError):
        infer.WritingScorer(model_dir=tmp_path / "empty_models", model_type="best")

    # Stub a lightweight hybrid WritingScorer without loading transformer weights
    scorer = infer.WritingScorer.__new__(infer.WritingScorer)
    scorer.model_dir = tmp_path
    scorer.requested_model_type = "hybrid"
    scorer.active_model_type = "hybrid"
    scorer.hybrid_weights = {t: 0.6 for t in TARGETS}
    scorer.feedback_bank = None

    class _FakeBaseline:
        prompt_tfidf = None

        def predict_batch(self, records: list[dict[str, Any]]) -> list[dict[str, float]]:
            return [_make_base_pred(6.0) for _ in records]

    scorer.baseline = _FakeBaseline()
    scorer._predict_transformer_batch = lambda records, batch_size=16: [_make_base_pred(7.0) for _ in records]  # type: ignore[method-assign]

    assert scorer.predict_batch([]) == []

    prompt = "Governments should invest in public transport infrastructure to reduce traffic congestion in cities."
    essay = (
        "Public transportation plays a vital role in modern urban development, and many citizens debate whether governments "
        "should prioritize buses and railways over highway expansion. In my opinion, investing in reliable public transport "
        "infrastructure provides far greater long-term environmental and economic benefits for growing cities.\n\n"
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
    res = scorer.score(prompt=prompt, essay=essay)
    # 0.6 * 7.0 + 0.4 * 6.0 = 6.6 -> rounded to 6.5 half-band
    assert res["overall_band"] == 6.5
    assert res["overall_band_raw"] == pytest.approx(6.6, abs=1e-4)
    assert res["estimated_cefr"] == "B2"
    assert res["model_used"] == "hybrid"
    assert "feedback" in res and "diagnostics" in res
