"""Core signal processing, alignment, and acoustic services."""
from app.services.audio_preprocessor import AudioPreprocessor, preprocessor
from app.services.audio_quality import AudioQualityGate, quality_gate, check_consonant_acoustic_evidence, check_consonant_acoustic_evidence_detailed
from app.services.vad import SpeechDetector, speech_detector
from app.services.aligner import ModelManager, IPASanitizer, ForcedAligner, forced_aligner
from app.services.formant_service import FormantService, formant_service
from app.services.scorer import Scorer, scorer, ScoringCalibrator, generate_phoneme_pedagogical_feedback
from app.services.confidence import ConfidenceEstimator, confidence_estimator
from app.services.feedback import FeedbackGenerator, feedback_generator
from app.services.word_aligner import (
    SpeechEvidenceDetector,
    WordSequenceAligner,
    evidence_detector,
    word_sequence_aligner,
    WordAlignmentStatus,
    AlignedWordEvidence,
    detect_spoken_prefix_count
)

__all__ = [
    "AudioPreprocessor",
    "preprocessor",
    "AudioQualityGate",
    "quality_gate",
    "SpeechDetector",
    "speech_detector",
    "ModelManager",
    "IPASanitizer",
    "ForcedAligner",
    "forced_aligner",
    "FormantService",
    "formant_service",
    "Scorer",
    "scorer",
    "ScoringCalibrator",
    "generate_phoneme_pedagogical_feedback",
    "ConfidenceEstimator",
    "confidence_estimator",
    "FeedbackGenerator",
    "feedback_generator",
    "SpeechEvidenceDetector",
    "WordSequenceAligner",
    "evidence_detector",
    "word_sequence_aligner",
    "WordAlignmentStatus",
    "AlignedWordEvidence",
    "detect_spoken_prefix_count",
    "check_consonant_acoustic_evidence",
    "check_consonant_acoustic_evidence_detailed",
]
