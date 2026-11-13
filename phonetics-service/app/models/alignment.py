import math
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
    # Strict un-pooled / dialect-only target posterior (does not reward L2 substitution errors).
    canonical_posterior: Optional[float] = None
    # Witt & Young GOP log-likelihood margin: logP(target|x) - max_{q != target} logP(q|x).
    gop_margin: Optional[float] = None
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
    # Cached single-pass CTC greedy outputs to avoid redundant Wav2Vec2 forward passes.
    raw_emitted_tokens: List[str] = field(default_factory=list)
    frame_tokens: List[str] = field(default_factory=list)
    frame_duration: float = 0.02

    def get_window_emitted_tokens(self, start_sec: float, end_sec: float) -> List[str]:
        """Slice cached greedy frame tokens in [start_sec, end_sec] and collapse CTC repeats."""
        if not self.frame_tokens or self.frame_duration <= 0.0:
            return []
        f_start = max(0, int(start_sec / self.frame_duration))
        f_end = min(len(self.frame_tokens), max(f_start + 1, int(math.ceil(end_sec / self.frame_duration))))
        emitted: List[str] = []
        for sym in self.frame_tokens[f_start:f_end]:
            if sym and sym != "<pad>" and (not emitted or emitted[-1] != sym):
                emitted.append(sym)
        return emitted
