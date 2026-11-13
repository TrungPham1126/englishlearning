import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from app.config import settings
from app.models.alignment import AlignedPhoneme, AlignedWord, PauseEvent
from app.schemas import MeasurementStatus, PhonemeSchema, PhonemeType, SpokenWordStatus, WordSchema

logger = logging.getLogger("phonetics-service")


class ScoringCalibrator:
    """
    Loads empirical standardized Ridge + piecewise monotonic calibration parameters
    from reference_profiles/calibration.json (fitted on SpeechOcean762/train).
    Falls back cleanly to identity mode when no artifact exists or in bare unit tests.
    """

    def __init__(
        self,
        mode: str = "calibrated",
        calibration_path: Path = settings.CALIBRATION_PROFILE_PATH,
    ):
        self.mode = mode
        self.calibration_path = calibration_path
        self.models: Dict[str, dict] = {}
        self.thresholds: Dict[str, float] = {}
        if mode != "identity":
            self._load(calibration_path)

    def _resolve_path(self, path: Path) -> Path:
        p = Path(path)
        if not p.is_absolute() and not p.exists():
            pkg_root = Path(__file__).resolve().parents[2]
            candidate = pkg_root / p
            if candidate.exists():
                return candidate
        return p

    def _load(self, path: Path) -> None:
        resolved = self._resolve_path(path)
        if not resolved.exists():
            self.mode = "identity"
            return
        try:
            with open(resolved, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.models = data.get("models", {}) or {}
            self.thresholds = data.get("thresholds", {}) or {}
            if self.models:
                self.mode = "calibrated"
                logger.info(
                    "Loaded scoring calibration profile from %s (models=%s).",
                    resolved,
                    list(self.models.keys()),
                )
            else:
                self.mode = "identity"
        except Exception as ex:
            logger.warning("Failed to load calibration profile %s: %s", resolved, ex)
            self.mode = "identity"

    def has_model(self, name: str) -> bool:
        return self.mode == "calibrated" and name in self.models

    def calibrate(self, raw_score: float) -> float:
        return round(float(raw_score), 1)

    def predict_component(self, component_name: str, features: Dict[str, float]) -> Optional[float]:
        model = self.models.get(component_name)
        if not model:
            return None
        feat_names: Sequence[str] = model.get("features", [])
        means: Sequence[float] = model.get("means", [])
        stds: Sequence[float] = model.get("stds", [])
        weights: Sequence[float] = model.get("weights", [])
        intercept = float(model.get("intercept", 0.0))

        if not feat_names or len(weights) != len(feat_names):
            return None

        z = intercept
        for name, mu, sd, w in zip(feat_names, means, stds, weights):
            val = float(features.get(name, mu))
            if np.isnan(val) or np.isinf(val):
                val = float(mu)
            safe_sd = float(sd) if float(sd) > 1e-8 else 1.0
            z += float(w) * ((val - float(mu)) / safe_sd)

        x_knots = model.get("x_knots")
        y_knots = model.get("y_knots")
        if x_knots and y_knots and len(x_knots) == len(y_knots) and len(x_knots) >= 2:
            pred = float(np.interp(z, np.asarray(x_knots, dtype=np.float64), np.asarray(y_knots, dtype=np.float64)))
        else:
            pred = float(z)

        min_val = float(model.get("min_score", 0.0))
        max_val = float(model.get("max_score", 100.0))
        return round(float(np.clip(pred, min_val, max_val)), 1)


def _gop_margin_to_score(gop_margin: float) -> float:
    """Maps Witt & Young GOP log-likelihood margin to an uncalibrated [0, 100] score."""
    return float(100.0 / (1.0 + np.exp(-0.72 * (float(gop_margin) + 1.15))))


def extract_utterance_acoustic_features(
    audio_data: np.ndarray,
    sample_rate: int,
    alignment_result: Any,
    utterance_acoustics: Any,
    words_schema: Sequence[WordSchema],
    spoken_words: Sequence[WordSchema],
    pause_events: Sequence[PauseEvent],
    quality_metrics: Any,
    whole_file_sim: float,
    wpm: float,
    articulation_rate: float,
    pause_ratio: float,
    awkward_pause_count: int,
    linking_ratio: float,
    completeness_score: float,
) -> Dict[str, float]:
    """
    Computes the canonical utterance-level feature dictionary shared identically between
    online evaluation (`routes.py`) and offline SpeechOcean762 calibration/evaluation.
    """
    # 1. Inter-word timing & hesitation dynamics
    gaps: List[float] = []
    hesitation_count = 0
    runs: List[int] = []
    curr_run = 1 if spoken_words else 0
    for idx in range(len(spoken_words) - 1):
        curr_w = spoken_words[idx]
        next_w = spoken_words[idx + 1]
        if curr_w.end_time is None or next_w.start_time is None:
            continue
        gap = max(0.0, float(next_w.start_time - curr_w.end_time))
        gaps.append(gap)
        has_punc = any(ch in curr_w.word for ch in ",.!?;:")
        if gap >= 0.22 and not has_punc:
            hesitation_count += 1
            runs.append(curr_run)
            curr_run = 1
        else:
            curr_run += 1
    if spoken_words:
        runs.append(curr_run)

    total_transitions = max(1, len(spoken_words) - 1)
    hesitation_ratio = float(hesitation_count) / float(total_transitions)
    awkward_pause_ratio = float(awkward_pause_count) / float(total_transitions)
    mean_gap = float(np.mean(gaps)) if gaps else 0.0
    gap_std = float(np.std(gaps)) if len(gaps) >= 2 else 0.0
    mean_run_norm = min(1.0, (float(np.mean(runs)) if runs else 0.0) / 5.0)

    # 2. Local word speaking rate regularity (duration per phoneme CV)
    dur_per_ph: List[float] = []
    for w_schema, w_align in zip(words_schema, getattr(alignment_result, "words", [])):
        st = w_schema.word_status.value if hasattr(w_schema.word_status, "value") else str(w_schema.word_status)
        if st in ("SPOKEN", "PARTIAL") and w_schema.start_time is not None and w_schema.end_time is not None:
            n_ph = max(1, len(getattr(w_align, "phonemes", [])))
            dur_per_ph.append(max(0.015, float(w_schema.end_time - w_schema.start_time)) / float(n_ph))
    duration_cv = (
        float(np.std(dur_per_ph) / max(1e-4, float(np.mean(dur_per_ph))))
        if len(dur_per_ph) >= 2
        else 0.35
    )

    # 3. Phoneme / GOP / Formant / Stress contrast aggregates
    all_ph_scores: List[float] = []
    vowel_scores: List[float] = []
    cons_scores: List[float] = []
    formant_scores: List[float] = []
    canon_posts: List[float] = []
    gop_margins: List[float] = []
    word_scores: List[float] = []

    stressed_durs: List[float] = []
    unstressed_durs: List[float] = []
    stressed_rms: List[float] = []
    unstressed_rms: List[float] = []
    stressed_f0: List[float] = []
    unstressed_f0: List[float] = []

    pitch_obj = getattr(utterance_acoustics, "pitch", None) if utterance_acoustics is not None else None
    align_words: Sequence[AlignedWord] = getattr(alignment_result, "words", []) or []

    for w_idx, w_schema in enumerate(words_schema):
        st = w_schema.word_status.value if hasattr(w_schema.word_status, "value") else str(w_schema.word_status)
        if st not in ("SPOKEN", "PARTIAL") or w_schema.score is None:
            continue
        word_scores.append(float(w_schema.score))
        align_word = align_words[w_idx] if w_idx < len(align_words) else None
        align_phs = align_word.phonemes if align_word else []

        for p_idx, p_schema in enumerate(w_schema.phonemes):
            p_score = float(p_schema.score)
            all_ph_scores.append(p_score)
            if p_schema.type == PhonemeType.VOWEL:
                vowel_scores.append(p_score)
                if (
                    p_schema.measured_f1 is not None
                    and p_schema.measured_f2 is not None
                    and p_schema.target_f1
                    and p_schema.target_f2
                ):
                    rel_dev = max(
                        abs(p_schema.measured_f1 - p_schema.target_f1) / max(1.0, p_schema.target_f1),
                        abs(p_schema.measured_f2 - p_schema.target_f2) / max(1.0, p_schema.target_f2),
                    )
                    formant_scores.append(float(np.clip(100.0 * np.exp(-1.5 * rel_dev), 20.0, 100.0)))
            else:
                cons_scores.append(p_score)

            if p_idx < len(align_phs):
                p_al = align_phs[p_idx]
                cp = p_al.canonical_posterior if p_al.canonical_posterior is not None else p_al.posterior
                canon_posts.append(float(cp))
                gm = p_al.gop_margin if p_al.gop_margin is not None else 0.0
                gop_margins.append(float(gm))

                if p_al.phoneme_type == "vowel":
                    dur = max(0.01, float(p_al.end - p_al.start))
                    s_idx = max(0, int(p_al.start * sample_rate))
                    e_idx = min(len(audio_data), int(p_al.end * sample_rate))
                    rms = float(np.sqrt(np.mean(audio_data[s_idx:e_idx] ** 2))) if e_idx > s_idx else 0.0
                    f0_val: Optional[float] = None
                    if pitch_obj is not None:
                        try:
                            mid_t = 0.5 * (p_al.start + p_al.end)
                            fv = pitch_obj.get_value_at_time(mid_t)
                            if fv and not np.isnan(fv) and not np.isinf(fv) and fv > 50.0:
                                f0_val = float(fv)
                        except Exception:
                            f0_val = None

                    if p_al.is_stress:
                        stressed_durs.append(dur)
                        if rms > 0.0:
                            stressed_rms.append(rms)
                        if f0_val is not None:
                            stressed_f0.append(f0_val)
                    else:
                        unstressed_durs.append(dur)
                        if rms > 0.0:
                            unstressed_rms.append(rms)
                        if f0_val is not None:
                            unstressed_f0.append(f0_val)

    mean_f0 = max(80.0, float(getattr(utterance_acoustics, "mean_f0", 180.0) if utterance_acoustics is not None else 180.0))
    f0_std = float(getattr(utterance_acoustics, "f0_std", 25.0) if utterance_acoustics is not None else 25.0)
    f0_iqr = float(getattr(utterance_acoustics, "f0_iqr", 30.0) if utterance_acoustics is not None else 30.0)
    f0_range = float(getattr(utterance_acoustics, "f0_range_90_10", 55.0) if utterance_acoustics is not None else 55.0)
    f0_slope = float(getattr(utterance_acoustics, "f0_slope_abs", 5.0) if utterance_acoustics is not None else 5.0)
    voiced_ratio = float(getattr(utterance_acoustics, "voiced_frame_ratio", 0.6) if utterance_acoustics is not None else 0.6)

    stress_dur_contrast = (
        float(np.clip(np.mean(stressed_durs) / max(0.02, float(np.mean(unstressed_durs))), 0.5, 2.5))
        if (stressed_durs and unstressed_durs)
        else 1.15
    )
    stress_rms_contrast = (
        float(np.clip(np.mean(stressed_rms) / max(1e-4, float(np.mean(unstressed_rms))), 0.5, 2.5))
        if (stressed_rms and unstressed_rms)
        else 1.10
    )
    stress_f0_contrast = (
        float(np.clip((np.mean(stressed_f0) - np.mean(unstressed_f0)) / mean_f0, -0.5, 0.5))
        if (stressed_f0 and unstressed_f0)
        else 0.02
    )

    ph_arr = np.asarray(all_ph_scores, dtype=np.float64) if all_ph_scores else np.array([75.0])
    w_arr = np.asarray(word_scores, dtype=np.float64) if word_scores else np.array([75.0])
    cp_arr = np.asarray(canon_posts, dtype=np.float64) if canon_posts else np.array([0.5])
    gm_arr = np.asarray(gop_margins, dtype=np.float64) if gop_margins else np.array([0.0])

    align_conf = float(getattr(alignment_result, "alignment_confidence", 0.5))
    blank_ratio = float(getattr(alignment_result, "blank_ratio", 0.5))
    speech_ratio = float(getattr(quality_metrics, "speech_ratio", 0.8))
    duration_sec = float(getattr(quality_metrics, "duration", max(0.5, len(audio_data) / float(sample_rate))))

    return {
        "wpm": float(wpm),
        "wpm_opt": float(np.exp(-((float(wpm) - 140.0) / 70.0) ** 2)),
        "articulation_rate": float(articulation_rate),
        "art_rate_opt": float(np.exp(-((float(articulation_rate) - 4.1) / 1.8) ** 2)),
        "speech_ratio": speech_ratio,
        "duration_sec": duration_sec,
        "pause_ratio": float(pause_ratio),
        "pause_count": float(len(pause_events)),
        "awkward_pause_ratio": awkward_pause_ratio,
        "hesitation_ratio": hesitation_ratio,
        "mean_inter_word_gap": mean_gap,
        "gap_std": gap_std,
        "mean_run_length_norm": mean_run_norm,
        "linking_ratio": float(linking_ratio),
        "duration_cv": float(np.clip(duration_cv, 0.0, 2.0)),
        "blank_ratio": blank_ratio,
        "align_confidence": align_conf,
        "whole_file_sim": float(whole_file_sim),
        "completeness_ratio": float(completeness_score) / 100.0,
        "f0_rel_std": float(np.clip(f0_std / mean_f0, 0.0, 0.6)),
        "f0_iqr_norm": float(np.clip(f0_iqr / mean_f0, 0.0, 0.6)),
        "f0_range_norm": float(np.clip(f0_range / mean_f0, 0.0, 1.0)),
        "f0_slope_norm": float(np.clip(f0_slope / mean_f0, 0.0, 0.25)),
        "voiced_frame_ratio": voiced_ratio,
        "stress_dur_contrast": stress_dur_contrast,
        "stress_rms_contrast": stress_rms_contrast,
        "stress_f0_contrast": stress_f0_contrast,
        "mean_phoneme_score": float(np.mean(ph_arr)),
        "p10_phoneme_score": float(np.percentile(ph_arr, 10)),
        "p25_phoneme_score": float(np.percentile(ph_arr, 25)),
        "std_phoneme_score": float(np.std(ph_arr)),
        "mean_vowel_score": float(np.mean(vowel_scores)) if vowel_scores else float(np.mean(ph_arr)),
        "mean_cons_score": float(np.mean(cons_scores)) if cons_scores else float(np.mean(ph_arr)),
        "mean_formant_score": float(np.mean(formant_scores)) if formant_scores else 75.0,
        "mean_word_score": float(np.mean(w_arr)),
        "min_word_score": float(np.min(w_arr)),
        "p20_word_score": float(np.percentile(w_arr, 20)),
        "failed_word_ratio": float(np.mean(w_arr < 70.0)),
        "mean_canon_post": float(np.mean(cp_arr)),
        "p15_canon_post": float(np.percentile(cp_arr, 15)),
        "mean_gop_margin": float(np.mean(gm_arr)),
        "p15_gop_margin": float(np.percentile(gm_arr, 15)),
        "neg_gop_ratio": float(np.mean(gm_arr < -0.5)),
        "bad_gop_ratio": float(np.mean(gm_arr < -1.5)),
        "n_words": float(len(words_schema)),
        "n_phonemes": float(len(ph_arr)),
    }


class Scorer:
    """
    Hierarchical Scoring Engine with Un-Pooled GOP Margin Sensitivity,
    Empirical SpeechOcean762 Calibration, and Formant Floor Protection.
    """

    PLOSIVES = {"p", "t", "k", "b", "d", "g", "ɡ"}
    AFFRICATES_AND_GLIDES = {"tʃ", "dʒ", "ts", "dz", "h", "j", "w"}

    def __init__(
        self,
        pron_weight: float = settings.PRONUNCIATION_WEIGHT,
        fluency_weight: float = settings.FLUENCY_WEIGHT,
        speed_weight: float = settings.SPEED_WEIGHT,
        speed_target_min: float = settings.SPEED_TARGET_MIN,
        speed_target_max: float = settings.SPEED_TARGET_MAX,
        calibrator: Optional[ScoringCalibrator] = None,
    ):
        self.pron_weight = pron_weight
        self.fluency_weight = fluency_weight
        self.speed_weight = speed_weight
        self.speed_target_min = speed_target_min
        self.speed_target_max = speed_target_max
        self.calibrator = calibrator if calibrator is not None else ScoringCalibrator()

    def score_vowel(
        self,
        formant_score: Optional[float],
        acoustic_confidence: float,
        alignment_confidence: float,
        posterior: float = 0.5,
        symbol: Optional[str] = None,
        canonical_posterior: Optional[float] = None,
        gop_margin: Optional[float] = None,
    ) -> float:
        # When canonical_posterior is provided, score strict dialect identity rather than error-pooled posterior.
        has_strict_gop = canonical_posterior is not None or gop_margin is not None
        eff_post = canonical_posterior if canonical_posterior is not None else posterior
        safe_post = max(1e-6, min(1.0, eff_post))

        if safe_post < 0.015 and (gop_margin is None or gop_margin < -2.0):
            if formant_score is not None and formant_score >= 55.0 and not has_strict_gop:
                return float(formant_score * 0.92)
            return float(max(0.0, _gop_margin_to_score(gop_margin))) if gop_margin is not None else 0.0

        log_post = float(np.log(safe_post))
        gop_div = 8.5 if symbol is not None else 5.5
        gop_cap = 100.0 if symbol is not None else 98.0
        raw_gop = float(np.clip(100.0 * (1.0 + log_post / gop_div), 0.0, gop_cap))

        if gop_margin is not None:
            margin_score = _gop_margin_to_score(gop_margin)
            raw_gop = (0.52 * raw_gop + 0.48 * margin_score) if symbol is not None else (0.50 * raw_gop + 0.50 * margin_score)

        if formant_score is not None:
            safe_formant = float(np.clip(formant_score, 0.0, 100.0))
            clean_v_sym = symbol.strip("/ ") if symbol else ""
            is_weak_vowel = clean_v_sym in ("ə", "ɪ", "ɚ", "ʊ", "uː")
            if symbol is not None:
                vowel_score = (
                    raw_gop * 0.40 +
                    safe_formant * 0.55 +
                    (alignment_confidence * 100.0) * 0.05
                )
                if safe_formant >= 80.0 and safe_post >= 0.20 and (gop_margin is None or gop_margin >= -0.9):
                    vowel_score = max(vowel_score, safe_formant * 0.99)
                elif safe_formant >= 62.0 and safe_post >= 0.08 and (gop_margin is None or gop_margin >= -1.5):
                    vowel_score = max(vowel_score, safe_formant * 0.91)
                if raw_gop >= 82.0 and safe_formant >= 62.0 and (gop_margin is None or gop_margin >= -0.2):
                    vowel_score = max(vowel_score, raw_gop * 0.96)
                if safe_post < 0.08 and not is_weak_vowel and (gop_margin is None or gop_margin < -1.0):
                    vowel_score = min(vowel_score, raw_gop * 0.55 + safe_formant * 0.45)
            else:
                vowel_score = (
                    raw_gop * 0.45 +
                    safe_formant * 0.50 +
                    (alignment_confidence * 100.0) * 0.05
                )
                if safe_post < 0.45 and safe_formant >= 62.0:
                    vowel_score = max(vowel_score, safe_formant * 0.88)
                if raw_gop >= 75.0 and safe_formant >= 50.0:
                    vowel_score = max(vowel_score, raw_gop * 0.90)

            # Clear phonetic vowel substitution (e.g. /iː/ spoken as /ɪ/, gop_margin < -2.0) cannot be masked by formant chance.
            if gop_margin is not None and gop_margin < -2.0:
                vowel_score = min(vowel_score, max(20.0, _gop_margin_to_score(gop_margin) * 1.15))

            if safe_formant < 45.0 and raw_gop < 60.0:
                vowel_score = min(vowel_score, safe_formant * 1.35)
        else:
            vowel_score = raw_gop * 0.90 + (alignment_confidence * 100.0) * 0.10

        return float(np.clip(vowel_score, 0.0, 100.0))

    def score_consonant_gop(
        self,
        posterior: float,
        duration: float,
        alignment_confidence: float,
        symbol: Optional[str] = None,
        is_word_final: bool = False,
        is_coda_r: bool = False,
        acoustic_multiplier: float = 1.0,
        canonical_posterior: Optional[float] = None,
        gop_margin: Optional[float] = None,
    ) -> float:
        if acoustic_multiplier <= 0.0:
            return 0.0

        clean_sym = symbol.strip("/ ") if symbol else ""
        has_strict_gop = canonical_posterior is not None or gop_margin is not None
        eff_post = canonical_posterior if canonical_posterior is not None else posterior
        safe_post = max(1e-6, min(1.0, eff_post))

        # Restrict non-rhotic R softening strictly to genuine post-vocalic coda /r/ (never initial /r/!).
        if is_coda_r and not has_strict_gop and alignment_confidence >= 0.35:
            return 90.0

        is_plosive = clean_sym in self.PLOSIVES
        is_short_cons = is_plosive or (clean_sym in self.AFFRICATES_AND_GLIDES) or is_word_final

        if safe_post < 0.015 and (gop_margin is None or gop_margin < -2.0):
            if not has_strict_gop and symbol is not None and is_plosive and alignment_confidence >= 0.80 and acoustic_multiplier >= 0.85:
                return 88.0
            return float(max(0.0, min(35.0, _gop_margin_to_score(gop_margin)))) if gop_margin is not None else 0.0

        log_post = float(np.log(safe_post))

        if symbol is not None:
            gop_scale = 5.8 if is_short_cons else 5.2
            min_dur = 0.012 if is_short_cons else 0.020
            gop_cap = 100.0
        else:
            gop_scale = 5.2
            min_dur = 0.042
            gop_cap = 98.0

        raw_gop_score = float(np.clip(100.0 * (1.0 + log_post / gop_scale), 0.0, gop_cap))
        if gop_margin is not None:
            margin_score = _gop_margin_to_score(gop_margin)
            raw_gop_score = 0.45 * raw_gop_score + 0.55 * margin_score

        dur_factor = min(1.0, duration / min_dur) if duration < min_dur else 1.0
        base_score = (raw_gop_score * 0.90 + (alignment_confidence * 100.0) * 0.10) * dur_factor
        consonant_score = base_score * acoustic_multiplier

        if not has_strict_gop and symbol is not None and acoustic_multiplier >= 0.85:
            if safe_post >= 0.50 and alignment_confidence >= 0.50:
                floor_target = 96.5 + min(3.5, (safe_post - 0.50) * 7.0)
                consonant_score = max(consonant_score, floor_target)
            elif is_plosive and safe_post >= 0.22 and alignment_confidence >= 0.65:
                consonant_score = max(consonant_score, 94.0)
        elif is_coda_r and alignment_confidence >= 0.50 and (gop_margin is None or gop_margin > -2.5):
            # Non-rhotic tolerance only for coda /r/ (still requires no strong foreign consonant substitution).
            consonant_score = max(consonant_score, 84.0)

        # Penalize clear consonant substitutions (e.g. /θ/ -> /f,s,t/ or /ð/ -> /d,z/) where competitor beats target.
        if gop_margin is not None and gop_margin < -1.5:
            consonant_score = min(consonant_score, max(15.0, _gop_margin_to_score(gop_margin) * 1.15))

        return float(np.clip(consonant_score, 0.0, 100.0))

    def score_word(
        self,
        phoneme_schemas: List[PhonemeSchema],
        aligned_phonemes: List[AlignedPhoneme],
        is_oov: bool = False
    ) -> float:
        if not phoneme_schemas:
            return 0.0

        vowels = []
        consonants = []
        for p_schema, p_aligned in zip(phoneme_schemas, aligned_phonemes):
            if p_schema.type == PhonemeType.VOWEL:
                vowels.append((p_schema, p_aligned))
            else:
                consonants.append((p_schema, p_aligned))

        v_weight_total = 0.65 if (vowels and consonants) else (1.0 if vowels else 0.0)
        c_weight_total = 0.35 if (vowels and consonants) else (1.0 if consonants else 0.0)

        weights = []
        scores = []

        if vowels:
            per_v_weight = v_weight_total / len(vowels)
            for p_schema, p_aligned in vowels:
                w = per_v_weight * (1.2 if p_aligned.is_stress else 1.0)
                weights.append(w)
                scores.append(p_schema.score)

        if consonants:
            per_c_weight = c_weight_total / len(consonants)
            for p_schema, p_aligned in consonants:
                w = per_c_weight * (1.1 if p_aligned.is_word_final else 1.0)
                weights.append(w)
                scores.append(p_schema.score)

        weighted_mean = float(np.sum(np.array(scores) * np.array(weights)) / max(1e-6, np.sum(weights)))

        if vowels:
            if len(phoneme_schemas) <= 3:
                min_vowel_score = min(p_s.score for p_s, _ in vowels)
                if min_vowel_score < 25.0:
                    hard_cap = min(40.0, min_vowel_score * 2.2)
                    weighted_mean = min(weighted_mean, hard_cap)
            else:
                stressed_vowels = [p_s.score for p_s, p_a in vowels if p_a.is_stress]
                vowel_avg = float(np.mean([p_s.score for p_s, _ in vowels]))
                if stressed_vowels:
                    min_stressed = min(stressed_vowels)
                    if min_stressed < 25.0:
                        hard_cap = max(45.0, min_stressed * 1.8)
                        weighted_mean = min(weighted_mean, hard_cap)
                elif vowel_avg < 25.0:
                    weighted_mean = min(weighted_mean, 45.0)

        for p_schema, p_aligned in consonants:
            if p_aligned.is_word_final:
                if p_schema.score < 20.0:
                    weighted_mean = min(weighted_mean, 52.0)
                elif p_schema.score < 60.0:
                    weighted_mean = min(weighted_mean, 65.0)
            else:
                if p_schema.score < 20.0:
                    weighted_mean = min(weighted_mean, 55.0)
                elif p_schema.score < 55.0:
                    weighted_mean = min(weighted_mean, 62.0)

        if is_oov:
            weighted_mean = max(weighted_mean, min(78.0, 55.0 + (weighted_mean * 0.35)))

        return float(np.clip(weighted_mean, 0.0, 100.0))

    def calculate_wpm(self, word_count: int, total_speech_duration: float) -> int:
        if total_speech_duration <= 0.2 or word_count <= 0:
            return 120
        return int(round((word_count / total_speech_duration) * 60.0))

    def calculate_speed_score(self, articulation_rate: float, wpm: float = 135.0) -> float:
        """Scores articulation speed cleanly against target syllable-rate bounds."""
        if articulation_rate <= 0.0:
            return 50.0
        if self.speed_target_min <= articulation_rate <= self.speed_target_max:
            center = 0.5 * (self.speed_target_min + self.speed_target_max)
            half_w = max(0.25, 0.5 * (self.speed_target_max - self.speed_target_min))
            dev = abs(articulation_rate - center) / half_w
            rate_score = 100.0 - 6.0 * (dev ** 2)
        elif articulation_rate < self.speed_target_min:
            deficit = self.speed_target_min - articulation_rate
            rate_score = max(35.0, 94.0 - (deficit / max(0.5, self.speed_target_min)) * 55.0)
        else:
            excess = articulation_rate - self.speed_target_max
            rate_score = max(72.0, 94.0 - (excess / 5.5) * 20.0)

        if float(wpm) < 110.0:
            wpm_opt = 100.0 * float(np.exp(-((110.0 - float(wpm)) / 48.0) ** 2))
        elif float(wpm) <= 195.0:
            wpm_opt = 100.0
        else:
            wpm_opt = max(62.0, 100.0 * float(np.exp(-((float(wpm) - 195.0) / 110.0) ** 2)))
        return round(float(np.clip(0.80 * rate_score + 0.20 * wpm_opt, 30.0, 100.0)), 1)

    def calculate_fluency_score(
        self,
        pause_events: List[PauseEvent],
        awkward_pause_count: int,
        pause_ratio: float,
        wpm: float,
        speech_ratio: float,
        features: Optional[Dict[str, float]] = None,
    ) -> float:
        if features is not None and self.calibrator.has_model("fluency"):
            pred = self.calibrator.predict_component("fluency", features)
            if pred is not None:
                return float(np.clip(pred, 25.0, 100.0))

        # Smooth acoustic fallback (non-saturated): conversational plateau [110, 195] WPM.
        if float(wpm) < 110.0:
            wpm_score = 100.0 * float(np.exp(-((110.0 - float(wpm)) / 48.0) ** 2))
        elif float(wpm) <= 195.0:
            wpm_score = 100.0
        else:
            wpm_score = 100.0 * float(np.exp(-((float(wpm) - 195.0) / 55.0) ** 2))
        wpm_score = max(45.0, wpm_score) if (85.0 <= wpm <= 205.0) else max(30.0, wpm_score)
        hes_ratio = float(features.get("hesitation_ratio", 0.0)) if features else 0.0
        dur_cv = float(features.get("duration_cv", 0.25)) if features else 0.25
        mean_run = float(features.get("mean_run_length_norm", 0.85)) if features else 0.85

        pause_pen = min(40.0, pause_ratio * 55.0 + awkward_pause_count * 4.5 + hes_ratio * 22.0)
        rhythm_score = float(np.clip(100.0 - pause_pen - max(0.0, dur_cv - 0.35) * 20.0, 30.0, 100.0))
        speech_cont = float(np.clip(speech_ratio * 105.0, 35.0, 100.0))
        fluency = 0.40 * wpm_score + 0.40 * rhythm_score + 0.10 * speech_cont + 0.10 * (mean_run * 100.0)
        return round(float(np.clip(fluency, 25.0, 100.0)), 1)

    def calculate_completeness_score(
        self,
        spoken_count: int,
        total_expected: int,
        partial_count: int = 0
    ) -> int:
        if total_expected <= 0:
            return 100
        effective_spoken = spoken_count + 0.55 * partial_count
        completeness = int(round((effective_spoken / float(total_expected)) * 100.0))
        return int(np.clip(completeness, 0, 100))

    def calculate_prosody_score(
        self,
        f0_std: float,
        fluency_score: float,
        pronunciation_score: float,
        linking_ratio: float = 0.0,
        features: Optional[Dict[str, float]] = None,
    ) -> float:
        if features is not None and self.calibrator.has_model("prosody"):
            pred = self.calibrator.predict_component("prosody", features)
            if pred is not None:
                return float(np.clip(pred, 25.0, 100.0))

        rel_std = float(features.get("f0_rel_std", f0_std / 180.0)) if features else (f0_std / 180.0)
        stress_dur = float(features.get("stress_dur_contrast", 1.15)) if features else 1.15

        # Gender-normalized pitch contour score peaking around 12%-24% relative F0 SD
        if rel_std < 0.06:
            pitch_score = 55.0 + (rel_std / 0.06) * 22.0
        elif rel_std <= 0.28:
            pitch_score = 77.0 + min(21.0, (rel_std - 0.06) * 110.0)
        else:
            pitch_score = max(65.0, 96.0 - (rel_std - 0.28) * 60.0)

        stress_score = float(np.clip(65.0 + (stress_dur - 1.0) * 55.0, 50.0, 98.0))
        raw_prosody = (
            pitch_score * 0.35 +
            stress_score * 0.15 +
            fluency_score * 0.25 +
            pronunciation_score * 0.25 +
            min(4.0, linking_ratio * 10.0)
        )
        prosody_cap = round((pronunciation_score * 0.5 + fluency_score * 0.5) + 18.0)
        return round(float(np.clip(min(raw_prosody, prosody_cap), 30.0, 100.0)), 1)

    def calibrate_utterance_scores(
        self,
        raw_pronunciation: float,
        raw_fluency: float,
        raw_prosody: float,
        completeness: float,
        features: Dict[str, float],
    ) -> Dict[str, float]:
        """
        Applies calibrated SpeechOcean762 predictors for pronunciation, fluency, prosody,
        and overall score when calibration.json is active, falling back cleanly otherwise.
        """
        comp_ratio = max(0.0, min(1.0, float(completeness) / 100.0))

        pron = raw_pronunciation
        if self.calibrator.has_model("pronunciation"):
            feat_p = dict(features)
            feat_p["raw_pronunciation"] = float(raw_pronunciation)
            p_cal = self.calibrator.predict_component("pronunciation", feat_p)
            if p_cal is not None:
                pron = p_cal

        flu = self.calibrator.predict_component("fluency", features) if self.calibrator.has_model("fluency") else None
        flu_val = flu if flu is not None else raw_fluency

        pros = self.calibrator.predict_component("prosody", features) if self.calibrator.has_model("prosody") else None
        pros_val = pros if pros is not None else raw_prosody

        if self.calibrator.has_model("overall"):
            feat_o = dict(features)
            feat_o["cal_pronunciation"] = float(pron)
            feat_o["cal_fluency"] = float(flu_val)
            feat_o["cal_prosody"] = float(pros_val)
            feat_o["raw_pronunciation"] = float(raw_pronunciation)
            overall = self.calibrator.predict_component("overall", feat_o)
            if overall is None:
                overall = self.calculate_overall_score(pron, flu_val, pros_val, completeness)
            else:
                if completeness >= 90.0 and pron >= 82.0 and flu_val >= 82.0:
                    weighted_ref = (
                        self.pron_weight * pron
                        + self.fluency_weight * flu_val
                        + self.speed_weight * pros_val
                    )
                    overall = max(
                        float(overall),
                        round(0.35 * float(overall) + 0.65 * min(98.0, weighted_ref), 1),
                    )
                if completeness < 95.0:
                    overall = round(float(np.clip(overall * comp_ratio, 0.0, 100.0)), 1)
        else:
            overall = self.calculate_overall_score(pron, flu_val, pros_val, completeness)

        return {
            "pronunciation": round(float(np.clip(pron, 0.0, 100.0)), 1),
            "fluency": round(float(np.clip(flu_val, 0.0, 100.0)), 1),
            "prosody": round(float(np.clip(pros_val, 0.0, 100.0)), 1),
            "overall": round(float(np.clip(overall, 0.0, 100.0)), 1),
        }

    def calculate_overall_score(
        self,
        pronunciation: float,
        fluency: float,
        prosody: float,
        completeness: float = 100.0
    ) -> float:
        raw_overall = (
            self.pron_weight * pronunciation +
            self.fluency_weight * fluency +
            self.speed_weight * prosody
        )
        if completeness < 95.0:
            comp_ratio = max(0.0, min(1.0, completeness / 100.0))
            raw_overall = raw_overall * comp_ratio

        calibrated = self.calibrator.calibrate(raw_overall)
        return float(np.clip(calibrated, 0.0, 100.0))


def generate_phoneme_pedagogical_feedback(
    symbol: str,
    score: float,
    phoneme_type: str,
    acoustic_detail: Optional[str] = None,
    formant_feedback: Optional[str] = None,
    is_word_final: bool = False,
    is_missing: bool = False
) -> str:
    """
    Tạo nhận xét sư phạm nhất quán 100% với mức điểm âm vị.
    Không bao giờ xảy ra mâu thuẫn điểm thấp nhưng khen đạt chuẩn.
    """
    clean_sym = symbol.strip("/ ")
    if is_missing or score <= 0.0:
        if is_word_final and acoustic_detail and "nuốt" in acoustic_detail:
            return f"Bạn đã nuốt hoặc quên phát âm âm đuôi /{clean_sym}/ ở cuối từ."
        if is_missing:
            return "Bạn chưa đọc từ này."
        return f"Chưa phát hiện âm /{clean_sym}/ (âm bị thiếu hoặc quá nhỏ)."

    if score >= 80.0:
        if phoneme_type == "vowel":
            return "Khẩu hình và vị trí đặt lưỡi chuẩn xác!"
        return "Phát âm rõ ràng, chuẩn xác."

    elif score >= 60.0:
        if phoneme_type == "vowel" and formant_feedback and "chuẩn xác" not in formant_feedback.lower():
            return formant_feedback
        return "Phát âm tương đối tốt, cần tròn vành rõ chữ hơn."

    elif score >= 30.0:
        if phoneme_type == "vowel" and formant_feedback and "chuẩn xác" not in formant_feedback.lower():
            return formant_feedback
        if acoustic_detail and "thiếu" in acoustic_detail.lower():
            return f"Âm /{clean_sym}/ chưa đạt: {acoustic_detail}."
        return f"Phát âm âm /{clean_sym}/ chưa chuẩn xác, cần chú ý khẩu hình."

    else:
        if is_word_final and ((acoustic_detail and "nuốt" in acoustic_detail) or score < 15.0):
            return f"Bạn đã nuốt hoặc quên phát âm âm đuôi /{clean_sym}/ ở cuối từ."
        if acoustic_detail and ("thiếu" in acoustic_detail.lower() or "quá nhỏ" in acoustic_detail.lower()):
            return f"Âm /{clean_sym}/ thiếu bằng chứng âm học: {acoustic_detail}."
        return f"Phát âm sai lệch hoặc phát âm chưa rõ âm /{clean_sym}/."


scorer = Scorer()
