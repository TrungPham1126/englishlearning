from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class AlignedPhoneme:
    """Represents a single phoneme aligned to the audio timeline."""
    symbol: str
    start: float
    end: float
    posterior: float = 0.0
    confidence: float = 1.0
    phoneme_type: str = "consonant"  # "vowel" or "consonant"
    is_stress: bool = False
    is_word_final: bool = False
    # Raw CTC probability of the target token (NOT blank-normalized). None -> same as posterior.
    raw_posterior: Optional[float] = None
    # False when the Viterbi path assigned no audio frame to this phoneme.
    has_frames: bool = True

    def __post_init__(self):
        if self.raw_posterior is None:
            self.raw_posterior = self.posterior

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class AlignedWord:
    """Represents an orthographic word with its aligned phoneme tokens."""
    word: str
    start: float
    end: float
    phonemes: List[AlignedPhoneme] = field(default_factory=list)
    confidence: float = 1.0
    is_oov: bool = False
    # True when the skip-capable CTC Viterbi found no audio for this word (word not read).
    skipped: bool = False

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class SpeechSegment:
    """Represents a contiguous temporal region detected by VAD."""
    start: float
    end: float
    is_speech: bool = True

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class PauseEvent:
    """Represents an inter-speech or intra-word silent pause."""
    start: float
    end: float
    duration: float
    pause_type: str  # "natural", "punctuation", "hesitation", "long_pause", "uncertain"
    penalty: float = 0.0
    confidence: float = 1.0


@dataclass
class AlignmentResult:
    """Complete result returned by the forced alignment service."""
    words: List[AlignedWord]
    alignment_confidence: float
    raw_tokens: List[str] = field(default_factory=list)
    blank_ratio: float = 0.0
    duration_anomaly_penalty: float = 0.0
