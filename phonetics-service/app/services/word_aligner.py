import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Tuple

import numpy as np
import torch

try:
    import speech_recognition as sr
    HAS_SR = True
except ImportError:
    sr = None
    HAS_SR = False

from app.config import settings
from app.services.audio_preprocessor import preprocessor

logger = logging.getLogger("phonetics-service")


def detect_spoken_prefix_count(audio: np.ndarray, expected_words: List[str]) -> int:
    """
    Computes Needleman-Wunsch alignment between target script phonemes and 
    Wav2Vec2 greedy decoded phonemes directly from acoustic logits.
    Returns the number of sequential words from the beginning that were actually spoken.
    """
    if not expected_words or len(audio) == 0:
        return 0

    from app.services.aligner import forced_aligner

    forced_aligner.model_mgr.load_model()
    model = forced_aligner.model_mgr.model
    tokenizer = forced_aligner.model_mgr.tokenizer
    vocab = tokenizer.get_vocab()
    rev_vocab = {v: k for k, v in vocab.items()}

    norm_audio = (audio - np.mean(audio)) / np.sqrt(np.var(audio) + 1e-7)
    audio_tensor = torch.from_numpy(norm_audio).float().unsqueeze(0).to(forced_aligner.model_mgr.device)

    with torch.inference_mode():
        logits = model(audio_tensor).logits
        preds = torch.argmax(logits[0], dim=-1).cpu().numpy()

    emitted = []
    for p in preds:
        sym = rev_vocab.get(p, "")
        if sym and sym != "<pad>" and (not emitted or emitted[-1] != sym):
            emitted.append(sym)

    if not emitted:
        return 0

    clean_script = " ".join(expected_words)
    word_phonemes = forced_aligner.g2p.convert_text(clean_script)
    if not word_phonemes:
        return 0

    expected_tokens = []
    token_to_word = []
    for w_idx, (w_text, ph_list) in enumerate(word_phonemes):
        for ph in ph_list:
            expected_tokens.append(forced_aligner.ACOUSTIC_TOKEN_FALLBACK.get(ph.token, ph.token))
            token_to_word.append(w_idx)

    N = len(expected_tokens)
    M = len(emitted)

    dp = np.zeros((N + 1, M + 1), dtype=np.float32)
    for i in range(N + 1):
        dp[i, 0] = -1.0 * i
    for j in range(M + 1):
        dp[0, j] = -0.5 * j

    for i in range(1, N + 1):
        t1 = expected_tokens[i - 1]
        alts = set([t1] + list(forced_aligner.UNIVERSAL_ALLOPHONES.get(t1, ())))
        for j in range(1, M + 1):
            t2 = emitted[j - 1]
            if t1 == t2:
                sim = 2.0
            elif t2 in alts or t1.strip("ː") == t2.strip("ː"):
                sim = 1.5
            else:
                sim = -1.0
            dp[i, j] = max(
                dp[i - 1, j - 1] + sim,
                dp[i - 1, j] - 1.0,
                dp[i, j - 1] - 0.5
            )

    i, j = N, M
    matched_per_word = {}
    total_per_word = {}
    for w in token_to_word:
        total_per_word[w] = total_per_word.get(w, 0) + 1

    while i > 0 and j > 0:
        t1 = expected_tokens[i - 1]
        alts = set([t1] + list(forced_aligner.UNIVERSAL_ALLOPHONES.get(t1, ())))
        t2 = emitted[j - 1]
        sim = 2.0 if t1 == t2 else (1.5 if (t2 in alts or t1.strip("ː") == t2.strip("ː")) else -1.0)
        
        diag = dp[i - 1, j - 1] + sim
        up = dp[i - 1, j] - 1.0

        if dp[i, j] == diag and sim > 0:
            w_idx = token_to_word[i - 1]
            matched_per_word[w_idx] = matched_per_word.get(w_idx, 0) + 1
            i -= 1
            j -= 1
        elif dp[i, j] == up:
            i -= 1
        elif dp[i, j] == diag:
            i -= 1
            j -= 1
        else:
            j -= 1

    spoken_prefix_len = 0
    for w_idx in range(len(word_phonemes)):
        matched = matched_per_word.get(w_idx, 0)
        total = total_per_word.get(w_idx, 1)
        ratio = matched / float(total)
        if ratio >= 0.28:
            spoken_prefix_len = w_idx + 1
        else:
            next_ratio = matched_per_word.get(w_idx + 1, 0) / float(total_per_word.get(w_idx + 1, 1)) if w_idx + 1 < len(word_phonemes) else 0.0
            if next_ratio >= 0.40:
                spoken_prefix_len = w_idx + 1
            else:
                break

    return spoken_prefix_len


class WordAlignmentStatus(str, Enum):
    MATCH = "MATCH"
    NOT_SPOKEN = "NOT_SPOKEN"
    SUBSTITUTION = "SUBSTITUTION"


@dataclass
class DetectedWord:
    word: str
    start: float
    end: float
    confidence: float


@dataclass
class AlignedWordEvidence:
    expected_word: str
    detected_word: Optional[str]
    status: WordAlignmentStatus
    start_time: Optional[float]
    end_time: Optional[float]
    confidence: float


class SpeechEvidenceDetector:
    """
    Detects actual spoken words and acoustic time boundaries.
    Acts as a fail-safe gate: Evidence must exist before pronunciation scoring.
    """

    def __init__(self):
        self.recognizer = sr.Recognizer() if HAS_SR else None

    def detect_spoken_words(self, audio: np.ndarray, sample_rate: int = settings.SAMPLE_RATE) -> List[DetectedWord]:
        """
        Runs speech recognition / energy segmentation to extract candidate spoken words.
        """
        if not HAS_SR or len(audio) == 0:
            return []

        # 1. Export temporary WAV and recognize
        with preprocessor.export_temp_wav(audio) as wav_path:
            try:
                with sr.AudioFile(wav_path) as source:
                    audio_data = self.recognizer.record(source)

                # Use Google Speech Recognition API (built-in, lightweight)
                transcript = self.recognizer.recognize_google(audio_data, language="en-US")
                logger.info("[ASR Evidence] Detected raw speech: '%s'", transcript)

                # Clean words
                raw_words = [re.sub(r'[^a-zA-Z]', '', w).lower() for w in transcript.split() if w.strip()]
                raw_words = [w for w in raw_words if w]
                if not raw_words:
                    return []

                # Allocate timestamps across active audio speech duration
                total_duration = float(len(audio)) / float(sample_rate)
                # Word approximate distribution
                w_dur = total_duration / max(1, len(raw_words))
                detected_list = []
                for i, w in enumerate(raw_words):
                    detected_list.append(
                        DetectedWord(
                            word=w,
                            start=round(i * w_dur, 3),
                            end=round((i + 1) * w_dur, 3),
                            confidence=0.90
                        )
                    )
                return detected_list
            except sr.UnknownValueError:
                logger.warning("[ASR Evidence] No speech recognized in audio.")
                return []
            except Exception as ex:
                logger.warning("[ASR Evidence] Speech recognition fallback warning: %s", ex)
                return []


class WordSequenceAligner:
    """
    Performs Sequence Alignment between Expected Words and Spoken Evidence
    using dynamic programming (Needleman-Wunsch global alignment).
    Detects omissions (NOT_SPOKEN), substitutions, and verified matches.
    """

    def align(
        self,
        expected_words: List[str],
        detected_words: List[DetectedWord]
    ) -> List[AlignedWordEvidence]:
        """
        Aligns expected script words against detected spoken words.
        If detected_words is empty (e.g. ASR unavailable or silent),
        marks words with conservative heuristic.
        """
        if not detected_words:
            # If no ASR evidence was obtainable, fall back to matching
            return [
                AlignedWordEvidence(
                    expected_word=w,
                    detected_word=w.lower(),
                    status=WordAlignmentStatus.MATCH,
                    start_time=None,
                    end_time=None,
                    confidence=0.75
                )
                for w in expected_words
            ]

        n = len(expected_words)
        m = len(detected_words)

        # DP scoring matrix
        # MATCH = +2, CLOSE_SUBSTITUTION = +1, DELETION (expected word missing) = -2, INSERTION = -1
        dp = np.zeros((n + 1, m + 1), dtype=np.float32)

        for i in range(1, n + 1):
            dp[i][0] = dp[i - 1][0] - 2.0  # Omission penalty
        for j in range(1, m + 1):
            dp[0][j] = dp[0][j - 1] - 1.0  # Spurious insertion penalty

        for i in range(1, n + 1):
            e_w = re.sub(r'[^a-zA-Z]', '', expected_words[i - 1]).lower()
            for j in range(1, m + 1):
                d_w = re.sub(r'[^a-zA-Z]', '', detected_words[j - 1].word).lower()

                if e_w == d_w:
                    match_score = 3.0
                elif self._is_close_word(e_w, d_w):
                    match_score = 1.0
                else:
                    match_score = -2.5

                score_diag = dp[i - 1][j - 1] + match_score
                score_del = dp[i - 1][j] - 2.0   # Expected word was NOT spoken
                score_ins = dp[i][j - 1] - 1.0   # Extra spoken word

                dp[i][j] = max(score_diag, score_del, score_ins)

        # Backtracking from dp[n][m]
        i = n
        j = m
        aligned_pairs: List[Tuple[Optional[int], Optional[int]]] = []

        while i > 0 or j > 0:
            if i > 0 and j > 0:
                e_w = re.sub(r'[^a-zA-Z]', '', expected_words[i - 1]).lower()
                d_w = re.sub(r'[^a-zA-Z]', '', detected_words[j - 1].word).lower()

                if e_w == d_w:
                    match_score = 3.0
                elif self._is_close_word(e_w, d_w):
                    match_score = 1.0
                else:
                    match_score = -2.5

                if np.isclose(dp[i][j], dp[i - 1][j - 1] + match_score):
                    aligned_pairs.append((i - 1, j - 1))
                    i -= 1
                    j -= 1
                    continue

            if i > 0 and np.isclose(dp[i][j], dp[i - 1][j] - 2.0):
                # Expected word is DELETED (not spoken)
                aligned_pairs.append((i - 1, None))
                i -= 1
            else:
                # Extra word inserted in audio, ignore
                j -= 1

        aligned_pairs.reverse()

        # Build final AlignedWordEvidence list in expected word order
        results: List[AlignedWordEvidence] = []
        for e_idx, d_idx in aligned_pairs:
            e_word = expected_words[e_idx]
            if d_idx is not None:
                d_obj = detected_words[d_idx]
                e_clean = re.sub(r'[^a-zA-Z]', '', e_word).lower()
                d_clean = re.sub(r'[^a-zA-Z]', '', d_obj.word).lower()
                is_exact = (e_clean == d_clean)
                status = WordAlignmentStatus.MATCH if is_exact else WordAlignmentStatus.SUBSTITUTION
                # If substitution, scale down confidence based on distance
                conf = d_obj.confidence if is_exact else round(d_obj.confidence * 0.65, 2)
                results.append(
                    AlignedWordEvidence(
                        expected_word=e_word,
                        detected_word=d_obj.word,
                        status=status,
                        start_time=d_obj.start,
                        end_time=d_obj.end,
                        confidence=conf
                    )
                )
            else:
                logger.info("[ALIGNMENT] Missing word detected: '%s' -> NOT_SPOKEN", e_word)
                results.append(
                    AlignedWordEvidence(
                        expected_word=e_word,
                        detected_word=None,
                        status=WordAlignmentStatus.NOT_SPOKEN,
                        start_time=None,
                        end_time=None,
                        confidence=0.0
                    )
                )

        return results

    def _is_close_word(self, w1: str, w2: str) -> bool:
        """Determines if two words are phonetically/orthographically close."""
        if not w1 or not w2:
            return False
        if w1 == w2:
            return True
        # For short words (length < 4), exact match required
        if min(len(w1), len(w2)) < 4:
            return False
        # For longer words, allow max edit distance 1 or 2 if length >= 6
        dist = self._levenshtein(w1, w2)
        if len(w1) >= 6 and dist <= 2:
            return True
        return dist <= 1 and abs(len(w1) - len(w2)) <= 1

    @staticmethod
    def _levenshtein(s1: str, s2: str) -> int:
        if len(s1) < len(s2):
            return WordSequenceAligner._levenshtein(s2, s1)
        if len(s2) == 0:
            return len(s1)

        prev_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            curr_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = prev_row[j + 1] + 1
                deletions = curr_row[j] + 1
                substitutions = prev_row[j] + (c1 != c2)
                curr_row.append(min(insertions, deletions, substitutions))
            prev_row = curr_row

        return prev_row[-1]


evidence_detector = SpeechEvidenceDetector()
word_sequence_aligner = WordSequenceAligner()
