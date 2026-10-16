from typing import List, Optional
import numpy as np

from app.config import settings
from app.models.alignment import AlignedWord, AlignedPhoneme
from app.schemas import AudioQualityMetrics, EvaluationStatus


class ConfidenceEstimator:
    PLOSIVES = {"p", "t", "k", "b", "d", "g", "\u0261", "\u027e"}

    def __init__(
        self,
        min_alignment_conf: float = settings.MIN_ALIGNMENT_CONFIDENCE,
        min_audio_conf: float = settings.MIN_AUDIO_CONFIDENCE
    ):
        self.min_alignment_conf = min_alignment_conf
        self.min_audio_conf = min_audio_conf

    def estimate_audio_confidence(self, quality: AudioQualityMetrics) -> float:
        if not quality.is_acceptable:
            return 0.30

        snr_factor = float(np.clip((quality.estimated_snr - 6.0) / 18.0, 0.2, 1.0))
        clip_factor = float(np.clip(1.0 - quality.clipping_ratio * 15.0, 0.1, 1.0))
        dyn_factor = float(np.clip(quality.dynamic_range / 25.0, 0.4, 1.0))
        silence_penalty = 0.85 if quality.silence_ratio > 0.70 else 1.0

        audio_conf = snr_factor * 0.50 + clip_factor * 0.30 + dyn_factor * 0.20
        return float(np.clip(audio_conf * silence_penalty, 0.1, 1.0))

    def estimate_phoneme_confidence(
        self,
        phoneme: AlignedPhoneme,
        measured_f1: Optional[float] = None,
        status: str = "OK"
    ) -> float:
        base_posterior = phoneme.posterior
        clean_sym = phoneme.symbol.strip("/ ")

        target_dur = 0.018 if clean_sym in self.PLOSIVES else 0.045
        dur_factor = float(np.clip(phoneme.duration / target_dur, 0.75, 1.0))

        if phoneme.phoneme_type == "vowel":
            if status != "OK" or measured_f1 is None:
                acoustic_conf = 0.50
            else:
                acoustic_conf = 0.95
            phoneme_conf = base_posterior * 0.45 + dur_factor * 0.25 + acoustic_conf * 0.30
        else:
            phoneme_conf = base_posterior * 0.70 + dur_factor * 0.30

        return float(np.clip(phoneme_conf, 0.30, 1.0))

    def estimate_overall_confidence(
        self,
        audio_conf: float,
        alignment_conf: float,
        words: List[AlignedWord]
    ) -> float:
        all_phoneme_confs = []
        all_word_confs = []

        for w in words:
            w_conf = min(w.confidence, alignment_conf + 0.15)
            all_word_confs.append(w_conf)
            for p in w.phonemes:
                p_conf = min(p.confidence, alignment_conf + 0.15)
                all_phoneme_confs.append(p_conf)

        mean_ph_conf = float(np.mean(all_phoneme_confs)) if all_phoneme_confs else alignment_conf
        mean_w_conf = float(np.mean(all_word_confs)) if all_word_confs else alignment_conf

        internal_reliability = (
            0.50 * alignment_conf +
            0.30 * mean_ph_conf +
            0.20 * mean_w_conf
        )

        raw_overall = audio_conf * internal_reliability
        overall = min(raw_overall, alignment_conf + 0.05)
        return float(np.clip(overall, 0.0, 1.0))

    def determine_evaluation_status(
        self,
        overall_conf: float,
        alignment_conf: float,
        audio_quality: AudioQualityMetrics
    ) -> EvaluationStatus:
        if not audio_quality.is_acceptable:
            return EvaluationStatus.AUDIO_QUALITY_TOO_LOW

        if alignment_conf < self.min_alignment_conf:
            return EvaluationStatus.ALIGNMENT_FAILED

        if alignment_conf < 0.45 or overall_conf < 0.40:
            return EvaluationStatus.LOW_CONFIDENCE

        if alignment_conf < 0.60 or overall_conf < 0.55:
            return EvaluationStatus.PARTIAL_EVALUATION

        return EvaluationStatus.SUCCESS


confidence_estimator = ConfidenceEstimator()