"""
Module kiểm tra khớp nội dung câu mẫu và gióng hàng cấp độ từ / âm vị (`word_aligner.py`).

Nhiệm vụ chính:
1. Giải mã thô chuỗi âm vị trực tiếp từ Wav2Vec 2.0 CTC (`decode_raw_speech`).
2. Đo độ tương đồng giữa chuỗi âm vị kỳ vọng (G2P) và chuỗi âm vị thực tế người dùng phát ra (`compute_phoneme_similarity`).
3. Cổng xác thực nội dung câu mẫu (`verify_speech_content`): phát hiện nói lạc đề/sai kịch bản để tránh ảo giác forced alignment.
4. Phân tích độ bao phủ từng từ và đếm số từ mở đầu đã đọc (`analyze_word_coverage`, `detect_spoken_prefix_count`).
5. Gióng hàng chuỗi từ qua quy hoạch động Needleman-Wunsch (`SpeechEvidenceDetector`, `WordSequenceAligner`)
   để phát hiện từ bỏ sót (`NOT_SPOKEN`), đọc thay thế (`SUBSTITUTION`) hoặc khớp chuẩn (`MATCH`).
"""

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


def decode_raw_speech(audio: np.ndarray) -> List[str]:
    """
    Giải mã trực tiếp sóng âm thô thành chuỗi ký hiệu âm vị IPA bằng CTC greedy decoding (Wav2Vec 2.0).
    Chọn token có xác suất cao nhất tại mỗi khung, gộp các khung trùng liên tiếp và loại bỏ `<pad>`.
    """
    if audio is None or len(audio) < 400:
        return []

    from app.services.aligner import forced_aligner

    forced_aligner.model_mgr.load_model()
    model = forced_aligner.model_mgr.model
    tokenizer = forced_aligner.model_mgr.tokenizer
    vocab = tokenizer.get_vocab()
    rev_vocab = {v: k for k, v in vocab.items()}

    # Chuẩn hóa sóng âm theo zero-mean, unit-variance trước khi đưa vào mạng Wav2Vec 2.0
    norm_audio = (audio - np.mean(audio)) / np.sqrt(np.var(audio) + 1e-7)
    audio_tensor = torch.from_numpy(norm_audio).float().unsqueeze(0).to(forced_aligner.model_mgr.device)

    with torch.inference_mode():
        logits = model(audio_tensor).logits
        preds = torch.argmax(logits[0], dim=-1).cpu().numpy()

    # Khử lặp liên tiếp theo quy tắc gộp chuỗi của CTC và bỏ token trống `<pad>`
    emitted = []
    for p in preds:
        sym = rev_vocab.get(p, "")
        if sym and sym != "<pad>" and (not emitted or emitted[-1] != sym):
            emitted.append(sym)

    return emitted


def compute_phoneme_similarity(expected_tokens: List[str], emitted_tokens: List[str]) -> float:
    """
    Tính độ tương đồng chuỗi dựa trên khoảng cách Levenshtein có trọng số giữa
    chuỗi âm vị kỳ vọng (từ script mẫu) và chuỗi âm vị thực tế phát ra từ Wav2Vec 2.0,
    có xét dung sai cho các tha âm vị (`UNIVERSAL_ALLOPHONES`) và trường âm nguyên âm (`ː`).
    Trả về điểm chuẩn hóa trong khoảng [0.0, 1.0].
    """
    if not expected_tokens or not emitted_tokens:
        return 0.0

    from app.services.aligner import forced_aligner

    N = len(expected_tokens)
    M = len(emitted_tokens)

    # Khởi tạo bảng quy hoạch động khoảng cách chỉnh sửa (edit distance)
    dp = np.zeros((N + 1, M + 1), dtype=np.float32)
    for i in range(N + 1):
        dp[i, 0] = float(i)
    for j in range(M + 1):
        dp[0, j] = float(j)

    for i in range(1, N + 1):
        t1 = expected_tokens[i - 1]
        alts = set([t1] + list(forced_aligner.UNIVERSAL_ALLOPHONES.get(t1, ())))
        for j in range(1, M + 1):
            t2 = emitted_tokens[j - 1]
            if t1 == t2:
                cost = 0.0  # Khớp chính xác
            elif t2 in alts or t1.strip("ː") == t2.strip("ː"):
                cost = 0.35  # Thuộc nhóm tha âm vị gần âm hoặc chỉ khác dấu kéo dài (ː)
            else:
                cost = 1.0  # Khác âm hoàn toàn
            dp[i, j] = min(
                dp[i - 1, j] + 1.0,
                dp[i, j - 1] + 1.0,
                dp[i - 1, j - 1] + cost
            )

    dist = dp[N, M]
    max_len = max(N, M)
    return float(max(0.0, 1.0 - (dist / max_len)))


def verify_speech_content(
    audio: np.ndarray,
    expected_words: List[str]
) -> Tuple[bool, str, float, List[str], str]:
    """
    Cổng xác thực nội dung nói (ASR Content Verification Gate):
    Kiểm tra xem lời nói thực tế của người dùng có khớp với từ/câu mẫu bài học hay không,
    nhằm ngăn chặn hiện tượng gióng hàng cưỡng bức bị "ảo giác" khi người học đọc một câu hoàn toàn khác.

    Giá trị trả về:
        is_valid: bool (True nếu khớp câu mẫu hoặc đọc đúng phần mở đầu hợp lệ)
        reason: str ('VALID', 'VALID_PREFIX', 'LENGTH_RATIO_EXCEEDED', 'LOW_SIMILARITY', 'EMPTY_SPEECH')
        similarity: float trong [0.0, 1.0]
        emitted_tokens: List[str] chuỗi âm vị decode được từ audio
        spoken_repr: str chuỗi biểu diễn IPA tóm tắt của lời nói ghi nhận được
    """
    if not expected_words or len(audio) == 0:
        return False, "EMPTY_SPEECH", 0.0, [], ""

    from app.services.aligner import forced_aligner

    # Giải mã chuỗi âm vị thực tế từ file âm thanh
    emitted = decode_raw_speech(audio)
    if not emitted:
        return False, "EMPTY_SPEECH", 0.0, [], ""

    spoken_repr = "/" + "".join(emitted[:18]) + ("..." if len(emitted) > 18 else "") + "/"

    # Chuyển từ/câu mẫu sang chuỗi âm vị IPA kỳ vọng
    clean_script = " ".join(expected_words)
    word_phonemes = forced_aligner.g2p.convert_text(clean_script)
    if not word_phonemes:
        return False, "EMPTY_SPEECH", 0.0, emitted, spoken_repr

    expected_tokens = [
        forced_aligner.ACOUSTIC_TOKEN_FALLBACK.get(ph.token, ph.token)
        for _, ph_list in word_phonemes
        for ph in ph_list
    ]

    N = len(expected_tokens)
    M = len(emitted)
    sim = compute_phoneme_similarity(expected_tokens, emitted)
    ratio = M / max(1, N)

    logger.info(
        "[ASR Verification Gate] Expected tokens (%d): %s | Emitted tokens (%d): %s | Similarity: %.2f | Length ratio: %.2f",
        N, "".join(expected_tokens), M, "".join(emitted[:20]), sim, ratio
    )

    # 1. Kiểm tra trường hợp mục tiêu chỉ có 1 từ đơn
    if len(expected_words) == 1:
        # Nếu nói quá dài (vượt > 2.2 lần số âm vị kỳ vọng) -> khả năng đọc cả câu khác thay vì 1 từ
        if M >= 6 and ratio > 2.2:
            logger.warning(
                "[ASR Verification Gate] REJECTED: Single word '%s' spoken with abnormal length ratio %.2f (emitted %d tokens)",
                expected_words[0], ratio, M
            )
            return False, "LENGTH_RATIO_EXCEEDED", sim, emitted, spoken_repr

        # Nếu độ tương đồng âm vị quá thấp -> đọc nhầm sang từ khác
        if sim < 0.35 and M >= 5:
            logger.warning(
                "[ASR Verification Gate] REJECTED: Single word '%s' mismatch (similarity: %.2f < 0.35)",
                expected_words[0], sim
            )
            return False, "LOW_SIMILARITY", sim, emitted, spoken_repr

        return True, "VALID", sim, emitted, spoken_repr

    # 2. Kiểm tra trường hợp mục tiêu là câu gồm nhiều từ
    else:
        if sim >= 0.30:
            return True, "VALID", sim, emitted, spoken_repr

        # Nếu chưa khớp toàn câu (có thể người học mới đọc nửa câu), kiểm tra khớp theo tiền tố từ đầu câu
        curr_tokens = []
        for w_text, ph_list in word_phonemes:
            curr_tokens.extend([forced_aligner.ACOUSTIC_TOKEN_FALLBACK.get(p.token, p.token) for p in ph_list])
            p_sim = compute_phoneme_similarity(curr_tokens, emitted[:len(curr_tokens) + 3])
            if p_sim >= 0.35:
                return True, "VALID_PREFIX", p_sim, emitted, spoken_repr

        logger.warning(
            "[ASR Verification Gate] REJECTED: Sentence mismatch (similarity: %.2f < 0.30, no valid prefix)",
            sim
        )
        return False, "LOW_SIMILARITY", sim, emitted, spoken_repr


def analyze_word_coverage(
    audio: np.ndarray,
    expected_words: List[str],
    emitted_tokens: Optional[List[str]] = None,
) -> Tuple[int, List[float]]:
    """
    Thực hiện gióng hàng toàn cục Needleman-Wunsch giữa chuỗi âm vị của câu mẫu
    và chuỗi âm vị decode tham lam trực tiếp từ Wav2Vec 2.0 (tái sử dụng được `emitted_tokens`).

    Trả về:
        (spoken_prefix_len, per_word_match_ratios):
        - spoken_prefix_len: Số lượng từ liên tiếp từ đầu câu thực sự được đọc.
        - per_word_match_ratios: Tỷ lệ âm vị khớp (0.0 - 1.0) cho từng từ trong câu mẫu.
    """
    if not expected_words or len(audio) == 0:
        return 0, [0.0 for _ in expected_words]

    from app.services.aligner import forced_aligner

    emitted = emitted_tokens if emitted_tokens is not None else decode_raw_speech(audio)
    if not emitted:
        return 0, [0.0 for _ in expected_words]

    clean_script = " ".join(expected_words)
    word_phonemes = forced_aligner.g2p.convert_text(clean_script)
    if not word_phonemes:
        return 0, [0.0 for _ in expected_words]

    # Trải phẳng chuỗi âm vị kỳ vọng kèm chỉ số từ tương ứng (`token_to_word`)
    expected_tokens = []
    token_to_word = []
    for w_idx, (w_text, ph_list) in enumerate(word_phonemes):
        for ph in ph_list:
            expected_tokens.append(forced_aligner.ACOUSTIC_TOKEN_FALLBACK.get(ph.token, ph.token))
            token_to_word.append(w_idx)

    N = len(expected_tokens)
    M = len(emitted)

    # Khởi tạo bảng điểm Needleman-Wunsch (bỏ âm kỳ vọng phạt -1.0, dư âm thực tế phạt -0.5)
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

    # Truy vết ngược để đếm số âm vị khớp thành công của từng từ
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

    per_word_ratios: List[float] = [
        matched_per_word.get(w_idx, 0) / float(max(1, total_per_word.get(w_idx, 1)))
        for w_idx in range(len(word_phonemes))
    ]

    # Xác định độ dài đoạn tiền tố liên tiếp được đọc (cho phép bỏ qua 1 từ ngắn yếu nếu từ kế tiếp đạt >= 0.40)
    spoken_prefix_len = 0
    for w_idx in range(len(word_phonemes)):
        ratio = per_word_ratios[w_idx]
        if ratio >= 0.28:
            spoken_prefix_len = w_idx + 1
        else:
            next_ratio = per_word_ratios[w_idx + 1] if w_idx + 1 < len(word_phonemes) else 0.0
            if next_ratio >= 0.40:
                spoken_prefix_len = w_idx + 1
            else:
                break

    return spoken_prefix_len, per_word_ratios


def detect_spoken_prefix_count(
    audio: np.ndarray,
    expected_words: List[str],
    emitted_tokens: Optional[List[str]] = None,
) -> int:
    """
    Hàm tiện ích trả về số lượng từ liên tiếp tính từ đầu câu thực sự được người dùng đọc
    dựa trên phép gióng hàng Needleman-Wunsch âm vị học.
    """
    spoken_prefix_len, _ = analyze_word_coverage(audio, expected_words, emitted_tokens=emitted_tokens)
    return spoken_prefix_len


class WordAlignmentStatus(str, Enum):
    """Trạng thái gióng hàng ở cấp độ từ."""

    MATCH = "MATCH"
    NOT_SPOKEN = "NOT_SPOKEN"
    SUBSTITUTION = "SUBSTITUTION"


@dataclass
class DetectedWord:
    """Thông tin một từ được bộ ASR nhận diện kèm mốc thời gian ước lượng."""

    word: str
    start: float
    end: float
    confidence: float


@dataclass
class AlignedWordEvidence:
    """Kết quả đối chiếu giữa một từ kỳ vọng và bằng chứng từ ASR."""

    expected_word: str
    detected_word: Optional[str]
    status: WordAlignmentStatus
    start_time: Optional[float]
    end_time: Optional[float]
    confidence: float


class SpeechEvidenceDetector:
    """
    Bộ phát hiện các từ thực tế đã được nói bằng thư viện `speech_recognition` (Google ASR).
    Đóng vai trò cổng kiểm tra dự phòng để xác minh bằng chứng từ vựng trước khi chấm điểm.
    """

    def __init__(self):
        """Khởi tạo bộ nhận diện ASR nếu thư viện `speech_recognition` khả dụng."""
        self.recognizer = sr.Recognizer() if HAS_SR else None

    def detect_spoken_words(self, audio: np.ndarray, sample_rate: int = settings.SAMPLE_RATE) -> List[DetectedWord]:
        """
        Chạy nhận diện giọng nói trên file WAV tạm để trích xuất danh sách các từ ứng viên đã nói
        kèm mốc thời gian phân bổ đều theo tổng thời lượng âm thanh.
        """
        if not HAS_SR or len(audio) == 0:
            return []

        # 1. Xuất ra file WAV tạm thời và gọi nhận diện giọng nói
        with preprocessor.export_temp_wav(audio) as wav_path:
            try:
                with sr.AudioFile(wav_path) as source:
                    audio_data = self.recognizer.record(source)

                # Gọi Google Speech Recognition API (tích hợp sẵn, gọn nhẹ)
                transcript = self.recognizer.recognize_google(audio_data, language="en-US")
                logger.info("[ASR Evidence] Detected raw speech: '%s'", transcript)

                # Làm sạch từ, chỉ giữ ký tự chữ cái và đưa về chữ thường
                raw_words = [re.sub(r'[^a-zA-Z]', '', w).lower() for w in transcript.split() if w.strip()]
                raw_words = [w for w in raw_words if w]
                if not raw_words:
                    return []

                # Phân bổ mốc thời gian ước lượng đều cho từng từ trong tổng thời lượng đoạn âm thanh
                total_duration = float(len(audio)) / float(sample_rate)
                # Thời lượng ước lượng trung bình cho mỗi từ
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
    Thực hiện gióng hàng chuỗi giữa các từ kỳ vọng (expected words) và bằng chứng từ nhận diện được
    bằng thuật toán quy hoạch động (Needleman-Wunsch global alignment).
    Phát hiện chính xác các lỗi: bỏ sót từ (`NOT_SPOKEN`), đọc thay thế (`SUBSTITUTION`) và đọc khớp (`MATCH`).
    """

    def align(
        self,
        expected_words: List[str],
        detected_words: List[DetectedWord]
    ) -> List[AlignedWordEvidence]:
        """
        Gióng hàng danh sách từ trong kịch bản mẫu với danh sách từ ASR nghe được.
        Nếu `detected_words` rỗng (ví dụ ASR không khả dụng hoặc không nhận diện được),
        tạm đánh dấu khớp bảo thủ với độ tin cậy 0.75.
        """
        if not detected_words:
            # Nếu không thu được bằng chứng ASR thì tạm fallback về trạng thái MATCH bảo thủ
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

        # Khởi tạo ma trận điểm quy hoạch động (DP)
        # Khớp đúng = +3.0, thay thế gần giống = +1.0, thay thế xa = -2.5, thiếu từ (DELETION) = -2.0, thừa từ (INSERTION) = -1.0
        dp = np.zeros((n + 1, m + 1), dtype=np.float32)

        for i in range(1, n + 1):
            dp[i][0] = dp[i - 1][0] - 2.0  # Điểm phạt khi bỏ sót từ kỳ vọng
        for j in range(1, m + 1):
            dp[0][j] = dp[0][j - 1] - 1.0  # Điểm phạt khi chèn thêm từ thừa

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
                score_del = dp[i - 1][j] - 2.0   # Từ kỳ vọng KHÔNG được người dùng đọc
                score_ins = dp[i][j - 1] - 1.0   # Từ đọc dư ngoài kịch bản

                dp[i][j] = max(score_diag, score_del, score_ins)

        # Truy vết ngược từ ô dp[n][m] về gốc để lấy các cặp từ gióng hàng
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
                # Từ kỳ vọng bị xóa / bỏ sót (chưa đọc)
                aligned_pairs.append((i - 1, None))
                i -= 1
            else:
                # Từ đọc dư trong đoạn âm thanh -> bỏ qua
                j -= 1

        aligned_pairs.reverse()

        # Tạo danh sách AlignedWordEvidence theo đúng thứ tự các từ trong câu mẫu
        results: List[AlignedWordEvidence] = []
        for e_idx, d_idx in aligned_pairs:
            e_word = expected_words[e_idx]
            if d_idx is not None:
                d_obj = detected_words[d_idx]
                e_clean = re.sub(r'[^a-zA-Z]', '', e_word).lower()
                d_clean = re.sub(r'[^a-zA-Z]', '', d_obj.word).lower()
                is_exact = (e_clean == d_clean)
                status = WordAlignmentStatus.MATCH if is_exact else WordAlignmentStatus.SUBSTITUTION
                # Nếu là đọc thay thế sang từ gần âm, giảm độ tin cậy theo hệ số 0.65
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
        """Kiểm tra xem hai từ có gần nhau về mặt chính tả / âm vị hay không."""
        if not w1 or not w2:
            return False
        if w1 == w2:
            return True
        # Với từ ngắn (độ dài < 4 ký tự), bắt buộc phải khớp chính xác hoàn toàn
        if min(len(w1), len(w2)) < 4:
            return False
        # Với từ dài hơn, cho phép sai khác tối đa 1 ký tự (hoặc 2 nếu từ dài >= 6 ký tự)
        dist = self._levenshtein(w1, w2)
        if len(w1) >= 6 and dist <= 2:
            return True
        return dist <= 1 and abs(len(w1) - len(w2)) <= 1

    @staticmethod
    def _levenshtein(s1: str, s2: str) -> int:
        """Tính khoảng cách chỉnh sửa Levenshtein giữa hai chuỗi ký tự."""
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
