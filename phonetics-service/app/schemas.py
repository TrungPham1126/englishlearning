from enum import Enum
from typing import List, Optional, Literal
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# ==============================================================================
# ENUMS
# ==============================================================================
class EvaluationStatus(str, Enum):
    SUCCESS = "SUCCESS"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    INSUFFICIENT_AUDIO = "INSUFFICIENT_AUDIO"
    ALIGNMENT_FAILED = "ALIGNMENT_FAILED"
    ALIGNMENT_LOW_CONFIDENCE = "ALIGNMENT_LOW_CONFIDENCE"
    AUDIO_QUALITY_TOO_LOW = "AUDIO_QUALITY_TOO_LOW"
    PARTIAL_EVALUATION = "PARTIAL_EVALUATION"



class PhonemeType(str, Enum):
    VOWEL = "vowel"
    CONSONANT = "consonant"


class MeasurementStatus(str, Enum):
    OK = "OK"
    FORMANT_NOT_RELIABLE = "FORMANT_NOT_RELIABLE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    UNVOICED = "UNVOICED"


class PauseType(str, Enum):
    NATURAL = "natural"
    PUNCTUATION = "punctuation"
    HESITATION = "hesitation"
    LONG_PAUSE = "long_pause"
    UNCERTAIN = "uncertain"


class FeedbackSeverity(str, Enum):
    INFO = "info"
    MINOR = "minor"
    MODERATE = "moderate"
    MAJOR = "major"


class ErrorCode(str, Enum):
    INVALID_AUDIO = "INVALID_AUDIO"
    UNSUPPORTED_AUDIO_FORMAT = "UNSUPPORTED_AUDIO_FORMAT"
    AUDIO_TOO_LARGE = "AUDIO_TOO_LARGE"
    AUDIO_TOO_SHORT = "AUDIO_TOO_SHORT"
    AUDIO_TOO_LONG = "AUDIO_TOO_LONG"
    AUDIO_QUALITY_TOO_LOW = "AUDIO_QUALITY_TOO_LOW"
    EMPTY_SPEECH = "EMPTY_SPEECH"
    INVALID_SCRIPT = "INVALID_SCRIPT"
    ALIGNMENT_FAILED = "ALIGNMENT_FAILED"
    ALIGNMENT_LOW_CONFIDENCE = "ALIGNMENT_LOW_CONFIDENCE"
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
    FORMANT_EXTRACTION_FAILED = "FORMANT_EXTRACTION_FAILED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


# ==============================================================================
# BASE SCHEMA (camelCase configuration)
# ==============================================================================
class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        use_enum_values=True
    )


# ==============================================================================
# COMPONENT SCHEMAS
# ==============================================================================
class PhonemeSchema(CamelModel):
    symbol: str = Field(..., description="IPA phoneme character, e.g. /æ/, /k/")
    type: PhonemeType = Field(..., description="'vowel' or 'consonant'")
    score: float = Field(..., ge=0.0, le=100.0, description="Phoneme pronunciation score 0-100")
    feedback: Optional[str] = Field(None, description="Detailed pedagogical feedback on anatomical execution")
    measured_f1: Optional[float] = Field(None, description="Actual extracted Praat F1 formant in Hz")
    measured_f2: Optional[float] = Field(None, description="Actual extracted Praat F2 formant in Hz")
    target_f1: Optional[float] = Field(None, description="Reference distribution target F1 in Hz")
    target_f2: Optional[float] = Field(None, description="Reference distribution target F2 in Hz")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Phoneme-level measurement confidence")
    status: Optional[MeasurementStatus] = Field(MeasurementStatus.OK, description="Measurement reliability status")


class WordStatus(str, Enum):
    MATCH = "MATCH"
    NOT_SPOKEN = "NOT_SPOKEN"
    SUBSTITUTION = "SUBSTITUTION"


class SpokenWordStatus(str, Enum):
    SPOKEN = "SPOKEN"
    MISSING = "MISSING"
    PARTIAL = "PARTIAL"


class WordSchema(CamelModel):
    word: str = Field(..., description="Orthographic reference word text")
    start_time: Optional[float] = Field(None, ge=0.0, description="Word onset timestamp in seconds")
    end_time: Optional[float] = Field(None, ge=0.0, description="Word offset timestamp in seconds")
    score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Aggregated word pronunciation score 0-100")
    phonemes: List[PhonemeSchema] = Field(default_factory=list, description="Phoneme breakdown for this word")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Word-level alignment confidence")
    status: Optional[WordStatus] = Field(WordStatus.MATCH, description="Spoken word alignment status")
    word_status: Optional[SpokenWordStatus] = Field(SpokenWordStatus.SPOKEN, description="SPOKEN, MISSING, or PARTIAL")
    is_oov: Optional[bool] = Field(False, description="True if word is OOV / proper noun")


class PauseEventSchema(CamelModel):
    start: float = Field(..., ge=0.0, description="Start timestamp of silent gap in seconds")
    end: float = Field(..., ge=0.0, description="End timestamp of silent gap in seconds")
    duration: float = Field(..., ge=0.0, description="Duration of gap in seconds")
    type: PauseType = Field(..., description="Categorization of pause event")
    penalty: float = Field(0.0, ge=0.0, description="Deduction point applied to fluency")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence in pause classification")


class FluencyFeedbackItem(CamelModel):
    type: str = Field(..., description="Category of fluency observation (pause, hesitation, etc.)")
    severity: FeedbackSeverity = Field(..., description="Issue severity: info, minor, moderate, major")
    message: str = Field(..., description="Actionable student feedback")
    timestamp: Optional[float] = Field(None, description="Occurrence time in seconds")


class AudioQualityMetrics(CamelModel):
    duration: float = Field(..., description="Audio duration in seconds")
    rms: float = Field(..., description="Root Mean Square energy level")
    peak: float = Field(..., description="Peak amplitude sample")
    clipping_ratio: float = Field(..., description="Ratio of clipped samples exceeding limit")
    silence_ratio: float = Field(..., description="Ratio of silent frames vs total frames")
    speech_ratio: float = Field(..., description="Ratio of active speech frames")
    estimated_snr: float = Field(..., description="Estimated Signal-to-Noise Ratio in dB")
    dynamic_range: float = Field(..., description="Dynamic range in dB")
    is_acceptable: bool = Field(..., description="Whether recording passed audio quality gate")
    warnings: List[str] = Field(default_factory=list, description="Quality alert messages")


# ==============================================================================
# PRIMARY API CONTRACT RESPONSES
# ==============================================================================
class SpeechAssessmentResponse(CamelModel):
    """
    Standard Base Response Schema matching the Spring Boot Microservice API Contract.
    Strictly camelCase serialized with full backward compatibility.
    """
    overall_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Weighted composite score 0-100")
    pronunciation_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Pronunciation score 0-100")
    fluency_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Fluency score 0-100")
    speed_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Speaking rate score 0-100")
    articulation_rate: Optional[float] = Field(None, description="Spoken syllables per second of articulation time")
    words: List[WordSchema] = Field(default_factory=list, description="Word-level evaluation details")
    fluency_feedback: List[FluencyFeedbackItem] = Field(default_factory=list, description="Fluency commentary")

    # Backward-compatible extension fields (Optional DTO fields)
    evaluation_status: Optional[EvaluationStatus] = Field(
        EvaluationStatus.SUCCESS,
        description="Overall execution status indicator"
    )
    overall_confidence: Optional[float] = Field(
        None, ge=0.0, le=1.0,
        description="Confidence estimation of total evaluation reliability"
    )
    audio_quality: Optional[AudioQualityMetrics] = Field(
        None,
        description="Audio Quality Gate metrics summary"
    )

    # Spring Boot / React Shadowing UI compatibility fields
    is_passed: Optional[bool] = Field(None, description="True if overallScore >= passScore")
    pass_score: Optional[int] = Field(80, description="Pass threshold score, default 80")
    status_message: Optional[str] = Field(None, description="Vietnamese pedagogical status message")
    evaluated_by: Optional[str] = Field("PYTHON_ACOUSTIC_ENGINE", description="Evaluation engine identifier")
    kpi: Optional[dict] = Field(None, description="KPI metrics object")
    sentence_tokens: Optional[List[dict]] = Field(None, description="Visual tokens for UI")
    word_rows: Optional[List[dict]] = Field(None, description="Word and phoneme rows")


class ErrorDetail(BaseModel):
    code: ErrorCode
    message: str
    reason: str
    suggestion: str


class ErrorResponse(BaseModel):
    detail: ErrorDetail


# ==============================================================================
# TTS SCHEMAS
# ==============================================================================
class TtsRequest(CamelModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Sentence text to synthesize")
    voice: Optional[str] = Field("af_heart", description="Voice identifier, e.g. af_heart, am_michael, bf_emma")
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0, description="Playback speed factor 0.5 - 2.0")


class VoiceInfo(CamelModel):
    id: str
    name: str
    accent: str
    gender: str
    description: str
    pipeline: str
    is_default: bool


class DialogueTurn(CamelModel):
    speaker: str = Field(..., description="Speaker identifier, e.g. 'A', 'B', 'Dr. Watson', 'Alice'")
    text: str = Field(..., min_length=1, max_length=2000, description="Utterance text for this turn")
    voice: Optional[str] = Field(None, description="Optional override voice for this specific turn")
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0, description="Playback speed for this turn")


class SpeakerVoiceConfig(CamelModel):
    voice: str = Field(..., description="Kokoro voice ID assigned to this speaker")
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0, description="Speed factor")


class DialogueTtsRequest(CamelModel):
    turns: List[DialogueTurn] = Field(..., min_length=1, max_length=50, description="List of sequential dialogue turns")
    speaker_map: Optional[dict[str, SpeakerVoiceConfig]] = Field(
        default_factory=dict,
        description="Optional mapping from speaker identifier to specific voice and speed"
    )
    inter_turn_pause_ms: Optional[int] = Field(
        450, ge=100, le=2000,
        description="Pause duration between turns in milliseconds (default 450ms)"
    )


class DialogueSegmentMetadata(CamelModel):
    speaker: str = Field(..., description="Speaker label (e.g. 'A', 'B')")
    voice: str = Field(..., description="Kokoro voice identifier used")
    text: str = Field(..., description="Transcript text spoken in this segment")
    start_ms: int = Field(..., ge=0, description="Turn onset in audio timeline (milliseconds)")
    end_ms: int = Field(..., ge=0, description="Turn offset in audio timeline (milliseconds)")


class DialogueTtsResponse(CamelModel):
    duration_ms: int = Field(..., description="Total dialogue audio duration in milliseconds")
    sample_rate: int = Field(24000, description="Sample rate in Hz (default 24000)")
    segments: List[DialogueSegmentMetadata] = Field(default_factory=list, description="Per-turn timeline alignment metadata")
    audio_base64: str = Field(..., description="Base64-encoded WAV (16-bit PCM 24kHz mono) audio payload")


