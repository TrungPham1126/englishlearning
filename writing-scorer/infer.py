"""CLI and importable inference engine for IELTS Writing Task 2 scoring & diagnostics."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from evaluate import SUBCRITERIA_KEYS, round_to_half_band
from train_baseline import (
    TARGETS,
    compute_prompt_essay_cosine,
    extract_surface_features,
    load_baseline_bundle,
)


def band_to_cefr(band: float) -> str:
    """Map IELTS overall band to CEFR level."""
    if band >= 8.5:
        return "C2"
    if band >= 7.0:
        return "C1"
    if band >= 5.5:
        return "B2"
    if band >= 4.0:
        return "B1"
    return "A2"


def _build_diagnostics(
    prompt: str,
    essay: str,
    prompt_tfidf: Any | None = None,
) -> dict[str, Any]:
    feats = extract_surface_features(prompt, essay)
    cos_sim = 0.0
    if prompt_tfidf is not None and prompt.strip() and essay.strip():
        cos_sim = float(compute_prompt_essay_cosine(prompt_tfidf, [prompt], [essay])[0])
    else:
        cos_sim = float(feats["prompt_content_coverage"])

    wc = int(round(feats["word_count"]))
    has_prompt = bool(feats["prompt_word_count"] >= 4)
    cov = float(feats["prompt_content_coverage"])
    is_off_topic = bool(
        has_prompt
        and (
            (cov == 0.0 and cos_sim < 0.04)
            or (cos_sim == 0.0 and cov < 0.20)
            or (cos_sim < 0.012 and cov < 0.16)
            or (cov < 0.08 and cos_sim < 0.025)
        )
    )
    is_repetitive = bool(
        (wc >= 40 and feats["repeated_trigram_ratio"] > 0.32)
        or (wc >= 60 and feats["ttr"] < 0.22)
        or (wc >= 40 and feats["top1_content_ratio"] > 0.22)
    )

    grammar_flags: list[str] = []
    if feats["lowercase_i_per_100"] > 0.1:
        grammar_flags.append("Lowercase standalone 'i' detected; capitalize pronoun 'I'.")
    if feats["lowercase_sent_start_ratio"] > 0.15:
        grammar_flags.append("Several sentences do not begin with a capital letter.")
    if feats["missing_end_punct_ratio"] > 0.25:
        grammar_flags.append("Missing terminal punctuation (. ! ?) at sentence boundaries.")
    if feats["article_err_per_100"] > 0.2:
        grammar_flags.append("Possible indefinite article mismatch ('a' before vowel sound).")
    if feats["adjacent_dup_per_100"] > 0.1:
        grammar_flags.append("Repeated adjacent duplicate word detected.")

    return {
        "word_count": wc,
        "sentence_count": int(round(feats["sent_count"])),
        "paragraph_count": int(round(feats["para_count"])),
        "avg_sentence_length": round(feats["avg_sent_len"], 1),
        "lexical_diversity_ttr": round(feats["ttr"], 3),
        "root_ttr": round(feats["rttr"], 2),
        "discourse_markers_unique": int(round(feats["dm_unique_types"])),
        "prompt_content_coverage": round(feats["prompt_content_coverage"], 3),
        "prompt_tfidf_similarity": round(cos_sim, 3),
        "repeated_trigram_ratio": round(feats["repeated_trigram_ratio"], 3),
        "has_prompt": has_prompt,
        "is_off_topic": is_off_topic,
        "is_repetitive": is_repetitive,
        "grammar_flags": grammar_flags,
    }


def _apply_rubric_guardrails(
    pred: dict[str, float],
    diag: dict[str, Any],
) -> tuple[dict[str, float], list[str]]:
    """Apply IELTS rubric caps for severely short, off-topic, or repetitive inputs."""
    out = dict(pred)
    adjustments: list[str] = []
    wc = diag["word_count"]

    if wc < 50:
        cap = 3.5
        for k in TARGETS:
            if out.get(f"{k}_raw", out.get(k, 0.0)) > cap or out.get(k, 0.0) > cap:
                out[f"{k}_raw"] = round(cap, 4)
                out[k] = float(round_to_half_band(cap))
        adjustments.append("Severely under-length (<50 words): band capped at 3.5.")
    elif wc < 120:
        tr_cap = 4.0
        ov_cap = 4.5
        if out.get("task_response_raw", out.get("task_response", 0.0)) > tr_cap or out.get("task_response", 0.0) > tr_cap:
            out["task_response_raw"] = round(tr_cap, 4)
            out["task_response"] = float(round_to_half_band(tr_cap))
        if out.get("overall_band_raw", out.get("overall_band", 0.0)) > ov_cap or out.get("overall_band", 0.0) > ov_cap:
            out["overall_band_raw"] = round(ov_cap, 4)
            out["overall_band"] = float(round_to_half_band(ov_cap))
        adjustments.append("Significantly under-length (<120 words): overall capped at 4.5.")
    elif wc < 220:
        tr_cap = 5.5
        if out.get("task_response_raw", out.get("task_response", 0.0)) > tr_cap or out.get("task_response", 0.0) > tr_cap:
            out["task_response_raw"] = round(tr_cap, 4)
            out["task_response"] = float(round_to_half_band(tr_cap))
        if out.get("overall_band_raw", out.get("overall_band", 0.0)) > 6.0 or out.get("overall_band", 0.0) > 6.0:
            out["overall_band_raw"] = 6.0
            out["overall_band"] = 6.0
        adjustments.append("Under IELTS 250-word minimum (<220 words): Task Response capped.")

    if (
        not diag["is_off_topic"]
        and diag.get("has_prompt", False)
        and diag.get("prompt_tfidf_similarity", 1.0) < 0.025
        and out.get("task_response_raw", out.get("task_response", 9.0)) <= 3.5
    ):
        diag["is_off_topic"] = True

    if diag["is_off_topic"]:
        if out.get("task_response_raw", out.get("task_response", 0.0)) > 3.5 or out.get("task_response", 0.0) > 3.5:
            out["task_response_raw"] = 3.5
            out["task_response"] = 3.5
        if out.get("overall_band_raw", out.get("overall_band", 0.0)) > 4.0 or out.get("overall_band", 0.0) > 4.0:
            out["overall_band_raw"] = 4.0
            out["overall_band"] = 4.0
        adjustments.append("Off-topic response detected: Task Response capped at 3.5 and Overall at 4.0.")

    if diag["is_repetitive"]:
        for k in ("coherence_cohesion", "lexical_resource", "overall_band"):
            if out.get(f"{k}_raw", out.get(k, 0.0)) > 4.0 or out.get(k, 0.0) > 4.0:
                out[f"{k}_raw"] = 4.0
                out[k] = 4.0
        adjustments.append("Heavy phrase/word repetition detected: Coherence, Lexical, and Overall capped at 4.0.")

    return out, adjustments


def _retrieve_examiner_tips(
    feedback_bank: dict[str, Any] | None,
    prompt: str,
    essay: str,
    pred_band: float,
    top_k: int = 3,
) -> list[str]:
    tips: list[str] = []
    if feedback_bank:
        vec = feedback_bank["vectorizer"]
        svd = feedback_bank["svd"]
        bank_emb = feedback_bank["embeddings"]
        bank_bands = feedback_bank["bands"]
        bank_tips = feedback_bank["tips"]

        q_vec = vec.transform([f"{prompt} {essay[:1200]}"])
        q_emb = svd.transform(q_vec).astype(np.float32)
        q_norm = np.linalg.norm(q_emb) + 1e-8
        q_emb = (q_emb / q_norm).ravel()

        cos_scores = bank_emb @ q_emb
        band_penalty = 0.12 * np.abs(bank_bands - pred_band)
        combined = cos_scores - band_penalty
        top_indices = np.argsort(-combined)[:10]

        from train_baseline import _content_tokens

        # Require strong prompt overlap before surfacing prompt-specific retrieved tips
        prompt_tokens = set(_content_tokens(prompt)) if prompt.strip() else set()
        bank_prompts = feedback_bank.get("prompts")

        seen = set()
        for idx in top_indices:
            i = int(idx)
            sim = float(cos_scores[i])
            if sim < 0.60:
                continue
            if bank_prompts is None or not prompt_tokens:
                continue
            bp_tokens = set(_content_tokens(str(bank_prompts[i])))
            jaccard = len(prompt_tokens & bp_tokens) / max(1, len(prompt_tokens | bp_tokens))
            if jaccard < 0.45:
                continue
            for tip in bank_tips[i]:
                tl = tip.lower()
                if '"' in tip or "e.g." in tl or "mentioned above" in tl or "the prompt asks" in tl:
                    continue
                key = tip.lower()[:60]
                if key not in seen:
                    seen.add(key)
                    tips.append(tip)
                    if len(tips) >= top_k:
                        return tips

    # Fallback: band-calibrated general IELTS examiner guidance (never wrong-topic)
    if not tips:
        if pred_band < 5.0:
            tips = [
                "Focus first on answering every part of the prompt clearly with a consistent stance.",
                "Write at least four distinct paragraphs (Introduction, two Body paragraphs, Conclusion) totaling 250+ words.",
                "Prioritize clear subject-verb agreement, basic sentence boundaries, and accurate everyday vocabulary.",
            ]
        elif pred_band < 6.5:
            tips = [
                "Develop each body paragraph around one central idea supported by a concrete explanation or example.",
                "Vary cohesive devices beyond basic sequencers and check pronoun referencing across sentences.",
                "Expand complex sentence structures (relative clauses, subordination) while minimizing article and tense slips.",
            ]
        elif pred_band < 7.5:
            tips = [
                "Deepen analysis of opposing perspectives or underlying causes to push Task Response from Band 6.5 to 7.5+.",
                "Use less-common academic collocations naturally rather than relying on repetitive high-frequency phrasing.",
                "Maintain high grammatical accuracy across multi-clause sentences and hedging expressions.",
            ]
        else:
            tips = [
                "Sustain nuanced, fully extended arguments with seamless cohesion and zero mechanical linking.",
                "Polish register precision and subtle lexical collocations to consolidate Band 8.0+ performance.",
            ]
    return tips[:top_k]


def _generate_feedback(
    scores: dict[str, float],
    diag: dict[str, Any],
    adjustments: list[str],
    retrieved_tips: list[str],
) -> dict[str, Any]:
    overall = scores["overall_band"]
    sub_scores = {k: scores.get(k, overall) for k in SUBCRITERIA_KEYS}
    strongest = max(sub_scores.items(), key=lambda kv: kv[1])
    weakest = min(sub_scores.items(), key=lambda kv: kv[1])

    label_names = {
        "task_response": "Task Response",
        "coherence_cohesion": "Coherence & Cohesion",
        "lexical_resource": "Lexical Resource",
        "grammatical_range": "Grammatical Range & Accuracy",
    }

    strengths: list[str] = []
    improvements: list[str] = []

    wc = diag["word_count"]
    if wc >= 250 and not diag["is_off_topic"]:
        strengths.append(f"Meets IELTS Task 2 length requirement ({wc} words across {diag['paragraph_count']} paragraphs).")
    if diag["discourse_markers_unique"] >= 4 and not diag["is_repetitive"]:
        strengths.append(f"Uses varied linking devices ({diag['discourse_markers_unique']} distinct discourse markers).")
    if diag["lexical_diversity_ttr"] >= 0.48 and wc >= 150:
        strengths.append(f"Good lexical variety (type-token ratio {diag['lexical_diversity_ttr']:.2f}).")
    if strongest[1] >= 6.5 and not diag["is_off_topic"]:
        strengths.append(f"Strongest criterion: {label_names[strongest[0]]} (Band {strongest[1]:.1f}).")
    if not strengths:
        strengths.append(f"Attempted response with {wc} words; focus first on prompt relevance and paragraph structure.")

    if diag["is_off_topic"]:
        improvements.append("Address the specific prompt question directly in your thesis statement and topic sentences.")
    if wc < 250:
        improvements.append(f"Expand essay length from {wc} words to at least 260–290 words with developed examples.")
    if diag["paragraph_count"] < 4 and wc >= 120:
        improvements.append("Organize ideas into 4 clear paragraphs (Introduction, 2 Body paragraphs, Conclusion).")
    if diag["is_repetitive"]:
        improvements.append("Avoid repeating whole clauses or overusing the same phrases; paraphrase key concepts.")
    if weakest[0] == "task_response" and not diag["is_off_topic"]:
        improvements.append("Support main arguments with specific explanations and concrete examples tied to the prompt.")
    elif weakest[0] == "coherence_cohesion":
        improvements.append("Improve paragraph progression using clear topic sentences and natural cohesive references.")
    elif weakest[0] == "lexical_resource":
        improvements.append("Replace generic words with precise academic collocations and topic-specific vocabulary.")
    elif weakest[0] == "grammatical_range":
        improvements.append("Mix complex clauses (subordination, relative clauses) with accurate tense and punctuation control.")

    for flag in diag["grammar_flags"]:
        improvements.append(flag)

    summary = (
        f"Estimated Band {overall:.1f} (CEFR {band_to_cefr(overall)}). "
        f"Strongest area: {label_names[strongest[0]]} ({strongest[1]:.1f}); "
        f"priority area to improve: {label_names[weakest[0]]} ({weakest[1]:.1f})."
    )
    if adjustments:
        summary += " Note: " + " ".join(adjustments)

    return {
        "summary": summary,
        "strengths": strengths,
        "improvements": improvements,
        "retrieved_examiner_tips": retrieved_tips,
    }


class WritingScorer:
    """Unified inference wrapper supporting baseline, transformer, hybrid, and best models."""

    def __init__(
        self,
        model_dir: str | Path | None = None,
        model_type: str = "best",
        device: str | None = None,
    ) -> None:
        base_dir = Path(__file__).resolve().parent
        self.model_dir = Path(model_dir) if model_dir else (base_dir / "models")
        self.requested_model_type = model_type
        self.active_model_type = self._resolve_model_type(model_type)

        self.baseline = None
        self.transformer_model = None
        self.tokenizer = None
        self.transformer_meta: dict[str, Any] = {}
        self.hybrid_weights: dict[str, float] = {}
        self.feedback_bank: dict[str, Any] | None = None
        self.device_str = device

        # Ensure joblib unpickling finds BaselineScorer regardless of cwd
        if str(base_dir) not in sys.path:
            sys.path.insert(0, str(base_dir))

        baseline_bundle = self.model_dir / "baseline" / "baseline_bundle.joblib"
        if baseline_bundle.exists() and self.active_model_type in ("baseline", "hybrid"):
            self.baseline = load_baseline_bundle(baseline_bundle)
        elif baseline_bundle.exists():
            self.baseline = load_baseline_bundle(baseline_bundle)

        feedback_path = self.model_dir / "transformer" / "feedback_bank.joblib"
        if feedback_path.exists():
            self.feedback_bank = joblib.load(feedback_path)

        if self.active_model_type in ("transformer", "hybrid"):
            self._load_transformer()

        if self.active_model_type == "hybrid":
            hyb_path = self.model_dir / "hybrid" / "hybrid_config.json"
            if hyb_path.exists():
                hyb_cfg = json.loads(hyb_path.read_text(encoding="utf-8"))
                self.hybrid_weights = hyb_cfg.get("transformer_weights", {})
            else:
                self.hybrid_weights = {t: 0.75 for t in TARGETS}

    def _resolve_model_type(self, model_type: str) -> str:
        if model_type != "best":
            return model_type
        manifest_path = self.model_dir / "best_manifest.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            selected = manifest.get("selected_model")
            if selected in ("baseline", "transformer", "hybrid"):
                return selected
        if (self.model_dir / "hybrid" / "hybrid_config.json").exists():
            return "hybrid"
        if (self.model_dir / "transformer" / "model_meta.json").exists():
            return "transformer"
        if (self.model_dir / "baseline" / "baseline_bundle.joblib").exists():
            return "baseline"
        raise FileNotFoundError(f"No trained models found in {self.model_dir}")

    def _load_transformer(self) -> None:
        import torch
        from transformers import AutoConfig, AutoModel, AutoTokenizer
        from train_transformer import IeltsTransformerRegressor

        tr_dir = self.model_dir / "transformer"
        meta_path = tr_dir / "model_meta.json"
        if not meta_path.exists():
            raise FileNotFoundError(f"Transformer model_meta.json not found at {meta_path}")
        self.transformer_meta = json.loads(meta_path.read_text(encoding="utf-8"))

        dev = self.device_str or ("cuda" if torch.cuda.is_available() else "cpu")
        self.torch_device = torch.device(dev)
        backbone_dir = tr_dir / "backbone"
        self.tokenizer = AutoTokenizer.from_pretrained(backbone_dir, use_fast=True)
        config = AutoConfig.from_pretrained(backbone_dir)
        backbone = AutoModel.from_pretrained(backbone_dir, config=config, dtype=torch.float32)
        self.transformer_model = IeltsTransformerRegressor(
            backbone=backbone,
            hidden_size=int(self.transformer_meta["hidden_size"]),
            dropout=float(self.transformer_meta.get("dropout", 0.15)),
        ).to(self.torch_device)
        head_state = torch.load(tr_dir / "regressor_head.pt", map_location=self.torch_device)
        self.transformer_model.regressor.load_state_dict(head_state)
        self.transformer_model.eval()

    def _predict_transformer_batch(self, records: list[dict[str, Any]], batch_size: int) -> list[dict[str, float]]:
        import torch
        from torch.utils.data import DataLoader
        from train_transformer import (
            IeltsEssayDataset,
            _preds_array_to_dicts,
            make_collate_fn,
            predict_transformer,
        )

        max_len = int(self.transformer_meta.get("max_length", 512))
        use_tti = bool(self.transformer_meta.get("use_token_type_ids", True))
        ds = IeltsEssayDataset(records, self.tokenizer, max_length=max_len, is_train=False)
        pad_id = self.tokenizer.pad_token_id if self.tokenizer.pad_token_id is not None else 0
        loader = DataLoader(
            ds,
            batch_size=batch_size,
            shuffle=False,
            collate_fn=make_collate_fn(pad_id, use_token_type_ids=use_tti),
        )
        raw_arr = predict_transformer(
            self.transformer_model,
            loader,
            device=self.torch_device,
            use_amp=(self.torch_device.type == "cuda") and bool(self.transformer_meta.get("fp16", False)),
        )
        calibrators = {
            k: (float(v[0]), float(v[1]))
            for k, v in self.transformer_meta.get("calibrators", {}).items()
        }
        return _preds_array_to_dicts(raw_arr, calibrators)

    def predict_batch(
        self,
        records: list[dict[str, Any]],
        batch_size: int = 16,
        include_feedback: bool = False,
        apply_guardrails: bool = False,
    ) -> list[dict[str, Any]]:
        if not records:
            return []

        base_preds = (
            self.baseline.predict_batch(records)
            if (self.baseline is not None and self.active_model_type in ("baseline", "hybrid"))
            else None
        )
        tr_preds = (
            self._predict_transformer_batch(records, batch_size=batch_size)
            if self.active_model_type in ("transformer", "hybrid")
            else None
        )

        merged: list[dict[str, float]] = []
        if self.active_model_type == "baseline":
            assert base_preds is not None
            merged = base_preds
        elif self.active_model_type == "transformer":
            assert tr_preds is not None
            merged = tr_preds
        else:
            assert tr_preds is not None and base_preds is not None
            for tp, bp in zip(tr_preds, base_preds):
                row: dict[str, float] = {}
                for target in TARGETS:
                    w = float(self.hybrid_weights.get(target, 0.75))
                    t_raw = tp.get(f"{target}_raw")
                    b_raw = bp.get(f"{target}_raw")
                    if t_raw is not None and b_raw is not None:
                        val = float(np.clip(w * t_raw + (1.0 - w) * b_raw, 1.0, 9.0))
                    else:
                        val = float(t_raw if t_raw is not None else b_raw)
                    row[f"{target}_raw"] = round(val, 4)
                    row[target] = float(round_to_half_band(val))
                merged.append(row)

        prompt_tfidf = self.baseline.prompt_tfidf if self.baseline is not None else None
        results: list[dict[str, Any]] = []
        for rec, pred in zip(records, merged):
            prompt = str(rec.get("prompt") or "")
            essay = str(rec.get("essay") or "")
            if not include_feedback and not apply_guardrails:
                results.append(pred)
                continue

            diag = _build_diagnostics(prompt, essay, prompt_tfidf=prompt_tfidf)
            adjustments: list[str] = []
            if apply_guardrails:
                pred, adjustments = _apply_rubric_guardrails(pred, diag)

            item: dict[str, Any] = {
                "overall_band": pred["overall_band"],
                "overall_band_raw": pred["overall_band_raw"],
                "task_response": pred.get("task_response", pred["overall_band"]),
                "task_response_raw": pred.get("task_response_raw", pred["overall_band_raw"]),
                "coherence_cohesion": pred.get("coherence_cohesion", pred["overall_band"]),
                "coherence_cohesion_raw": pred.get("coherence_cohesion_raw", pred["overall_band_raw"]),
                "lexical_resource": pred.get("lexical_resource", pred["overall_band"]),
                "lexical_resource_raw": pred.get("lexical_resource_raw", pred["overall_band_raw"]),
                "grammatical_range": pred.get("grammatical_range", pred["overall_band"]),
                "grammatical_range_raw": pred.get("grammatical_range_raw", pred["overall_band_raw"]),
                "estimated_cefr": band_to_cefr(pred["overall_band"]),
                "word_count": diag["word_count"],
                "is_off_topic": diag["is_off_topic"],
                "model_used": self.active_model_type,
                "diagnostics": {**diag, "rubric_adjustments": adjustments},
            }
            if include_feedback:
                tips = _retrieve_examiner_tips(
                    self.feedback_bank,
                    prompt=prompt,
                    essay=essay,
                    pred_band=pred["overall_band"],
                )
                item["feedback"] = _generate_feedback(item, diag, adjustments, tips)
            results.append(item)

        return results

    def predict(
        self,
        prompt: str,
        essay: str,
        include_feedback: bool = True,
        apply_guardrails: bool = True,
    ) -> dict[str, Any]:
        return self.predict_batch(
            [{"prompt": prompt, "essay": essay}],
            batch_size=1,
            include_feedback=include_feedback,
            apply_guardrails=apply_guardrails,
        )[0]

    def score(self, prompt: str, essay: str) -> dict[str, Any]:
        return self.predict(prompt=prompt, essay=essay)


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Score an IELTS Writing Task 2 essay.")
    parser.add_argument("--prompt", type=str, default="", help="Essay prompt / topic.")
    parser.add_argument("--essay", type=str, default=None, help="Essay text.")
    parser.add_argument("--essay-file", type=str, default=None, help="Optional path to a text file containing the essay.")
    parser.add_argument(
        "--model-type",
        choices=["best", "baseline", "transformer", "hybrid"],
        default="best",
        help="Model backend to use.",
    )
    parser.add_argument("--model-dir", type=str, default=str(base_dir / "models"))
    parser.add_argument("--json", action="store_true", help="Print compact valid JSON only.")
    args = parser.parse_args()

    essay_text = args.essay
    if essay_text is None and args.essay_file:
        essay_text = Path(args.essay_file).read_text(encoding="utf-8")
    if not essay_text or not essay_text.strip():
        raise ValueError("Provide non-empty essay text via --essay or --essay-file.")

    scorer = WritingScorer(model_dir=Path(args.model_dir), model_type=args.model_type)
    result = scorer.predict(prompt=args.prompt, essay=essay_text, include_feedback=True, apply_guardrails=True)

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
