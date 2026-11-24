"""
Module chuyển đổi chữ viết sang phiên âm IPA (G2P) và gióng hàng cưỡng bức (Forced Alignment).

Nhiệm vụ chính:
1. Kiểm tra tính hợp lệ của câu/từ mẫu tiếng Anh đầu vào (`validate_script`).
2. Chuyển đổi văn bản tiếng Anh thành chuỗi âm vị IPA thông qua bộ G2P (CMU + quy tắc dự phòng).
3. Quản lý tải và suy luận mô hình Wav2Vec 2.0 CTC (`ModelManager`).
4. Gióng hàng sóng âm vào từng âm vị (`ForcedAligner`) để xác định ranh giới thời gian,
   xác suất hậu nghiệm (posterior) và biên độ GOP (Goodness of Pronunciation margin).
"""

import asyncio
import json
import logging
import os
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("phonetics-service")

try:
    import torch
    import torchaudio
    HAS_TORCH = True
except ImportError:
    torch = None
    torchaudio = None
    HAS_TORCH = False

from g2p_en import G2p

from app.config import settings
from app.exceptions import (
    AlignmentError,
    InvalidTranscriptError,
    LowAlignmentConfidenceError,
    ModelLoadError,
)
from app.models.alignment import AlignedPhoneme, AlignedWord, AlignmentResult


@dataclass(frozen=True)
class PhonemeTarget:
    """Thông tin mục tiêu của một âm vị chuẩn sau bước G2P."""

    symbol: str
    token: str
    phoneme_type: str
    is_stress: bool


class G2PConverter:
    """
    Bộ chuyển đổi chữ viết sang âm vị IPA (Grapheme-to-Phoneme) dựa trên thư viện `g2p_en`.
    Ánh xạ ký hiệu ARPABET (từ từ điển CMU hoặc mô hình dự đoán G2P) sang IPA chuẩn
    và token tương ứng trong từ vựng của mô hình Wav2Vec 2.0.
    """

    # Bảng ánh xạ từ ký hiệu ARPABET -> (ký hiệu IPA hiển thị, token trong vocab Wav2Vec2, loại âm vị)
    ARPABET_MAP: Dict[str, Tuple[str, str, str]] = {
        "AA":  ("ɑː", "\u0251\u02d0", "vowel"),
        "AE":  ("æ",  "\xe6",         "vowel"),
        "AH":  ("ʌ",  "\u028c",       "vowel"),
        "AH0": ("ə",  "\u0259",       "vowel"),
        "AH1": ("ʌ",  "\u028c",       "vowel"),
        "AH2": ("ʌ",  "\u028c",       "vowel"),
        "AO":  ("ɔː", "\u0254\u02d0", "vowel"),
        "EH":  ("e",  "\u025b",       "vowel"),
        "ER":  ("ɚ",  "\u025a",       "vowel"),
        "ER0": ("ɚ",  "\u025a",       "vowel"),
        "ER1": ("ɜː", "\u025c\u02d0", "vowel"),
        "ER2": ("ɜː", "\u025c\u02d0", "vowel"),
        "IH":  ("ɪ",  "\u026a",       "vowel"),
        "IY":  ("iː", "i\u02d0",       "vowel"),
        "UH":  ("ʊ",  "\u028a",       "vowel"),
        "UW":  ("uː", "u\u02d0",       "vowel"),
        "AW":  ("aʊ", "a\u028a",      "vowel"),
        "AY":  ("aɪ", "a\u026a",      "vowel"),
        "EY":  ("eɪ", "e\u026a",      "vowel"),
        "OW":  ("oʊ", "o\u028a",      "vowel"),
        "OY":  ("ɔɪ", "o\u026a",      "vowel"),
        "B":   ("b",  "b",            "consonant"),
        "CH":  ("tʃ", "t\u0283",      "consonant"),
        "D":   ("d",  "d",            "consonant"),
        "DH":  ("ð",  "\xf0",         "consonant"),
        "F":   ("f",  "f",            "consonant"),
        "G":   ("ɡ",  "\u0261",       "consonant"),
        "HH":  ("h",  "h",            "consonant"),
        "JH":  ("dʒ", "d\u0292",      "consonant"),
        "K":   ("k",  "k",            "consonant"),
        "L":   ("l",  "l",            "consonant"),
        "M":   ("m",  "m",            "consonant"),
        "N":   ("n",  "n",            "consonant"),
        "NG":  ("ŋ",  "\u014b",       "consonant"),
        "P":   ("p",  "p",            "consonant"),
        "R":   ("r",  "\u0279",       "consonant"),
        "S":   ("s",  "s",            "consonant"),
        "SH":  ("ʃ",  "\u0283",       "consonant"),
        "T":   ("t",  "t",            "consonant"),
        "TH":  ("θ",  "\u03b8",       "consonant"),
        "V":   ("v",  "v",            "consonant"),
        "W":   ("w",  "w",            "consonant"),
        "Y":   ("j",  "j",            "consonant"),
        "Z":   ("z",  "z",            "consonant"),
        "ZH":  ("ʒ",  "\u0292",       "consonant"),
    }

    _instance: Optional["G2PConverter"] = None
    _lock = threading.Lock()

    # Danh sách tên riêng tiếng Việt phổ biến để nhận diện từ ngoài từ điển tiếng Anh (OOV)
    VIETNAMESE_PROPER_NAMES = {
        "trung", "nam", "linh", "lan", "minh", "anh", "duc", "mai", "hoa",
        "phuong", "dung", "huyen", "khanh", "quang", "thang", "tu", "viet",
        "huy", "hoang", "khoa", "long", "son", "tai", "thao", "trang", "yen",
        "ngan", "vy", "phuc", "thanh", "dat", "bac", "bao", "chau", "cuong",
        "diep", "giang", "hai", "hieu", "kien", "loan", "nga", "ngoc", "nhung",
        "oanh", "quan", "quynh", "tan", "tien", "van", "vu", "nguyen", "tran",
        "pham", "huynh", "truong", "thuong", "khuong", "tuan", "hung", "huong", "thuy"
    }

    def __init__(self):
        """Khởi tạo bộ G2P của thư viện g2p_en."""
        self._g2p = G2p()

    @classmethod
    def get_instance(cls) -> "G2PConverter":
        """Trả về thực thể singleton G2PConverter theo cơ chế an toàn đa luồng."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def is_in_cmu(self, word: str) -> bool:
        """Kiểm tra xem từ (sau khi bỏ dấu câu) có tồn tại trong từ điển phát âm CMU hay không."""
        w = word.strip(".,!?;:\"'()[]{}").lower()
        return bool(w and hasattr(self._g2p, "cmu") and w in self._g2p.cmu)

    def is_oov_word(self, word: str) -> bool:
        """Nhận diện từ ngoài từ điển tiếng Anh (OOV) như tên riêng tiếng Việt hoặc tên viết hoa lạ."""
        clean = re.sub(r'[^a-zA-Z]', '', word).lower()
        if not clean:
            return False
        if clean in self.VIETNAMESE_PROPER_NAMES:
            return True
        if not self.is_in_cmu(clean):
            if word and word[0].isupper():
                return True
            if len(clean) <= 6:
                return True
        return False

    def _tokens_to_targets(self, arpa_tokens: List[str]) -> List[PhonemeTarget]:
        """Chuyển danh sách token ARPABET thành danh sách PhonemeTarget kèm cờ trọng âm (1 hoặc 2)."""
        targets: List[PhonemeTarget] = []
        for raw_tok in arpa_tokens:
            tok = raw_tok.strip()
            if not tok or tok in ".,!?;:\"'-/\\":
                continue

            # Trong ARPABET, hậu tố '1' là trọng âm chính, '2' là trọng âm phụ, '0' là không nhấn
            is_stress = tok.endswith(("1", "2"))
            if tok in self.ARPABET_MAP:
                ipa_sym, vocab_tok, p_type = self.ARPABET_MAP[tok]
            else:
                # Nếu không có dạng phân biệt trọng âm (ví dụ AH0/ER1), bỏ số ở cuối để tra âm gốc
                base_tok = tok.rstrip("012")
                if base_tok in self.ARPABET_MAP:
                    ipa_sym, vocab_tok, p_type = self.ARPABET_MAP[base_tok]
                else:
                    continue

            targets.append(
                PhonemeTarget(
                    symbol=ipa_sym,
                    token=vocab_tok,
                    phoneme_type=p_type,
                    is_stress=is_stress
                )
            )
        return targets

    def convert_word(self, word: str) -> List[PhonemeTarget]:
        """Quy đổi một từ tiếng Anh đơn lẻ sang chuỗi âm vị IPA mục tiêu."""
        clean_word = word.strip(".,!?;:\"'()[]{}")
        if not clean_word:
            return []
        arpa_tokens = self._g2p(clean_word)
        return self._tokens_to_targets(arpa_tokens)

    def convert_text(self, text: str) -> List[Tuple[str, List[PhonemeTarget]]]:
        """
        Quy đổi toàn bộ câu văn bản tiếng Anh sang danh sách cặp (từ, danh_sách_âm_vị).
        Ưu tiên chạy G2P trên cả câu để giữ đúng ngữ cảnh (dạng yếu/mạnh của từ hư),
        nếu số nhóm token tách theo khoảng trắng không khớp số từ thì fallback chuyển từng từ.
        """
        words = validate_script(text)
        if not words:
            return []

        clean_sentence = " ".join(words)
        sentence_tokens = self._g2p(clean_sentence)

        # Gom các token ARPABET giữa những dấu cách ' ' thành từng nhóm ứng với mỗi từ
        token_groups: List[List[str]] = []
        curr_group: List[str] = []
        for t in sentence_tokens:
            if t == ' ':
                if curr_group:
                    token_groups.append(curr_group)
                    curr_group = []
            else:
                curr_group.append(t)
        if curr_group:
            token_groups.append(curr_group)

        result: List[Tuple[str, List[PhonemeTarget]]] = []
        if len(token_groups) == len(words):
            for word, arpa_tokens in zip(words, token_groups):
                ph_targets = self._tokens_to_targets(arpa_tokens)
                if not ph_targets:
                    ph_targets = self.convert_word(word)
                result.append((word, ph_targets))
        else:
            # Fallback khi bộ tách từ của g2p_en tách khác số lượng từ gốc
            for word in words:
                ph_targets = self.convert_word(word)
                if ph_targets:
                    result.append((word, ph_targets))
        return result

    def text_to_phonemes(self, text: str) -> List[Tuple[str, List[Tuple[str, str, bool]]]]:
        """Trả về phiên âm dạng tuple đơn giản (symbol, loại_âm, có_trọng_âm) cho từng từ."""
        word_targets = self.convert_text(text)
        return [
            (
                word,
                [(pt.symbol, pt.phoneme_type, pt.is_stress) for pt in ph_list]
            )
            for word, ph_list in word_targets
        ]


g2p_converter = G2PConverter.get_instance()


# Tập các từ/từ viết tắt hợp lệ trong tiếng Anh dù không chứa chữ cái nguyên âm (a, e, i, o, u, y)
_ALLOWED_NO_VOWEL_TOKENS = {
    "shh", "psst", "hmm", "nth", "by", "my",
    "mc", "ph", "st", "mr", "mrs", "dr", "jr", "sr", "vs", "tv", "pc", "dj", "ok",
}


def validate_script(text: str) -> List[str]:
    """
    Kiểm tra tính hợp lệ của chuỗi văn bản câu mẫu (script tham chiếu).
    Loại bỏ đầu vào rỗng, chuỗi ký tự lặp vô nghĩa, từ quá dài hoặc cụm phụ âm phi cấu trúc tiếng Anh.
    Trả về danh sách các từ đã làm sạch dấu câu.
    """
    if not text or not text.strip():
        raise InvalidTranscriptError("Script tham chiếu rỗng hoặc chỉ chứa khoảng trắng.")

    clean_text = text.strip()
    # Chặn trường hợp nhập chuỗi gõ nhầm lặp một chữ cái >= 3 lần liên tiếp (ví dụ: 'aaaa')
    repeat_match = re.search(r'([a-zA-Z])\1{2,}', clean_text)
    if repeat_match:
        repeated_char = repeat_match.group(0)
        raise InvalidTranscriptError(
            f"Script chứa chuỗi ký tự lặp bất thường '{repeated_char}'. Vui lòng cung cấp câu tiếng Anh chuẩn."
        )

    words = [w.strip(".,!?;:\"'()[]{}") for w in clean_text.split() if w.strip(".,!?;:\"'()[]{}")]
    if not words:
        raise InvalidTranscriptError("Script không chứa từ tiếng Anh hợp lệ.")

    valid_cmu_count = 0
    has_alpha_word = False
    for w in words:
        w_clean = re.sub(r'[^a-zA-Z]', '', w).lower()
        if not w_clean:
            continue
        has_alpha_word = True
        if len(w_clean) > 30:
            raise InvalidTranscriptError(f"Từ '{w}' có độ dài {len(w_clean)} ký tự, vượt quá giới hạn cho phép.")

        in_cmu_or_oov = g2p_converter.is_in_cmu(w_clean) or g2p_converter.is_oov_word(w)
        has_vowel = bool(re.search(r'[aeiouy]', w_clean))
        is_valid_abbrev = len(w_clean) == 1 or w_clean in _ALLOWED_NO_VOWEL_TOKENS or g2p_converter.is_in_cmu(w_clean)
        if not has_vowel and not is_valid_abbrev:
            raise InvalidTranscriptError(f"Từ '{w}' không chứa nguyên âm hợp lệ trong cấu trúc âm tiết tiếng Anh.")

        if in_cmu_or_oov or len(w_clean) == 1:
            valid_cmu_count += 1
        elif re.search(r'[^aeiouy]{5,}', w_clean):
            raise InvalidTranscriptError(f"Từ '{w}' chứa cụm phụ âm bất thường không thuộc cấu trúc tiếng Anh.")

    if not has_alpha_word:
        raise InvalidTranscriptError("Script không chứa từ tiếng Anh hợp lệ.")

    if len(words) >= 1 and valid_cmu_count == 0:
        first_alpha = next((w for w in words if re.sub(r'[^a-zA-Z]', '', w)), words[0])
        w0 = re.sub(r'[^a-zA-Z]', '', first_alpha).lower()
        if not g2p_converter.is_in_cmu(w0) and not g2p_converter.is_oov_word(first_alpha) and len(w0) > 6:
            raise InvalidTranscriptError(f"Từ '{first_alpha}' không được nhận diện trong từ điển tiếng Anh tham chiếu.")

    return words


class IPASanitizer:
    """Lớp bọc tương thích cho bộ chuyển đổi G2P sang IPA."""

    def __init__(self, tokenizer=None):
        """Khởi tạo bộ chuyển đổi IPA dùng chung."""
        self.tokenizer = tokenizer
        self.converter = g2p_converter

    def text_to_phonemes(self, text: str) -> List[Tuple[str, List[Tuple[str, str, bool]]]]:
        """Chuyển câu văn bản thành chuỗi âm vị IPA theo từng từ."""
        return self.converter.text_to_phonemes(text)


class ModelManager:
    """
    Quản lý vòng đời và bộ nhớ đệm (Singleton) cho mô hình Wav2Vec 2.0 CTC và từ vựng IPA.
    Đảm bảo mô hình chỉ được nạp một lần duy nhất một cách an toàn giữa các luồng.
    """

    _instance: Optional["ModelManager"] = None
    _lock = threading.Lock()

    def __init__(self):
        """Thiết lập thiết bị suy luận (CUDA hoặc CPU) và các biến lưu trữ mô hình."""
        if HAS_TORCH:
            self.device = torch.device(
                "cuda" if settings.MODEL_DEVICE == "cuda" and torch.cuda.is_available() else "cpu"
            )
        else:
            self.device = "cpu"
        self.model = None
        self.tokenizer = None
        self.rev_vocab: Dict[int, str] = {}
        self._is_loaded = False

    @classmethod
    def get_instance(cls) -> "ModelManager":
        """Trả về thực thể singleton ModelManager."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def load_model(self):
        """
        Tải `vocab.json` và trọng số `Wav2Vec2ForCTC` từ thư mục cache cục bộ hoặc Hugging Face Hub,
        sau đó chạy warm-up một tensor 1 giây để ổn định hiệu năng suy luận.
        """
        if self._is_loaded:
            return

        with self._lock:
            if self._is_loaded:
                return

            if not HAS_TORCH:
                raise ModelLoadError(
                    settings.MODEL_NAME,
                    "PyTorch / torchaudio chưa được cài đặt trong môi trường hiện tại."
                )

            try:
                from huggingface_hub import hf_hub_download
                from transformers import Wav2Vec2ForCTC

                # Ưu tiên tìm thư mục cache từ đường dẫn gốc package nếu chạy từ thư mục làm việc khác
                raw_cache_path = Path(settings.MODEL_CACHE_DIR)
                if not raw_cache_path.is_absolute() and not raw_cache_path.exists():
                    pkg_cache = Path(__file__).resolve().parents[2] / raw_cache_path
                    if pkg_cache.exists():
                        raw_cache_path = pkg_cache
                cache_dir = str(raw_cache_path)
                os.makedirs(cache_dir, exist_ok=True)

                class TokenizerWrapper:
                    """Lớp bọc tối giản lưu ánh xạ token IPA <-> ID từ file vocab.json."""

                    def __init__(self, vocab_dict: Dict[str, int]):
                        self._vocab = vocab_dict
                        self.pad_token_id = vocab_dict.get("<pad>", 0)

                    def get_vocab(self) -> Dict[str, int]:
                        return self._vocab

                vocab_path = hf_hub_download(
                    repo_id=settings.MODEL_NAME,
                    filename="vocab.json",
                    cache_dir=cache_dir
                )
                with open(vocab_path, "r", encoding="utf-8") as f:
                    vocab_dict = json.load(f)
                self.tokenizer = TokenizerWrapper(vocab_dict)
                self.rev_vocab = {int(v): k for k, v in vocab_dict.items()}

                self.model = Wav2Vec2ForCTC.from_pretrained(
                    settings.MODEL_NAME,
                    cache_dir=cache_dir
                ).to(self.device)
                self.model.eval()

                # Chạy thử 1 giây âm thanh rỗng để khởi tạo đồ thị tính toán trên CPU/GPU
                with torch.inference_mode():
                    dummy_input = torch.zeros(1, 16000, device=self.device)
                    self.model(dummy_input)

                self._is_loaded = True
                logger.info("Wav2Vec2 model '%s' loaded successfully on %s.", settings.MODEL_NAME, self.device)
            except Exception as ex:
                raise ModelLoadError(settings.MODEL_NAME, str(ex))


class ForcedAligner:
    """
    Bộ gióng hàng cưỡng bức (Forced Aligner) dùng Wav2Vec 2.0 CTC kết hợp hai tầng tha âm vị:
    - `UNIVERSAL_ALLOPHONES`: Gom nhóm rộng các biến thể và lỗi thay thế gần âm để tìm mốc thời gian ổn định.
    - `DIALECT_ALLOPHONES`: Chỉ gom nhóm biến thể phương ngữ chuẩn (US/UK/AU) để chấm điểm GOP công bằng.
    """
    # Ma trận tha âm vị phổ quát mở rộng — chỉ dùng khi tìm đường đi CTC xác định ranh giới thời gian
    UNIVERSAL_ALLOPHONES: Dict[str, List[str]] = {
        # ── 1. Âm bật (Plosives) ───────────────────────────────────────────────
        "b": ["p", "v", "\u03b2"],
        "p": ["b"],
        "\u0261": ["k", "g"],
        "g": ["k", "\u0261"],
        "k": ["\u0261", "g"],
        "d": ["t", "\u027e", "\u0294", "dz"],
        "t": ["d", "\u027e", "\u0294", "ts", "t\u0283", "d\u0292"],

        # ── 2. Nhóm nguyên âm /ɔː/ (across, thought) ───────────────────────────
        "\u0254\u02d0": ["\u0254", "o\u02d0", "o", "\u0251\u02d0", "\u0251", "o\u028a", "\u0259", "a\u028a"],
        "\u0254": ["\u0254\u02d0", "o\u02d0", "o", "\u0251\u02d0", "\u0251", "o\u028a", "\u0259"],

        # ── 3. Nguyên âm đôi (CHOICE, MOUTH, GOAT, FLEECE, FACE) ───────────────
        "o\u026a": ["\u0254\u026a", "\u0254", "o", "o\u028a", "\u026a", "i"],
        "\u0254\u026a": ["o\u026a", "\u0254", "o", "o\u028a", "\u026a", "i"],
        "a\u028a": ["au", "\u0251\u02d0", "a\u02d0", "a", "\u028a", "u", "o\u028a", "\u0259\u028a"],
        "o\u028a": ["\u0259\u028a", "o\u02d0", "o", "\u0254\u02d0", "\u0254", "\u0259", "\u026a", "\u028c"],
        "\u0259\u028a": ["o\u028a", "o\u02d0", "o", "\u0254\u02d0", "\u0259", "\u026a"],
        "i\u02d0": ["i", "\u026a", "j", "e\u026a"],
        "i": ["i\u02d0", "\u026a", "j"],
        "e\u026a": ["e", "\u025b", "\xe6", "i"],
        "\u028a": ["u\u02d0", "u", "o\u028a", "\u0259"],

        # ── 4. Âm xát & âm tắc xát (Fricatives & Affricates) ───────────────────
        "s": ["z", "ts", "\u0283"],
        "z": ["s", "dz", "\u0292"],
        "\u0283": ["s", "t\u0283"],
        "\u0292": ["z", "d\u0292"],
        "t\u0283": ["\u0283", "ts", "t"],
        "d\u0292": ["\u0292", "dz", "d"],
        "\u03b8": ["f", "s", "t"],
        "\xf0": ["d", "v", "z"],
        "h": ["\xe7", "x", "j"],

        # ── 5. Nguyên âm đơn & bán nguyên âm ────────────────────────────────────
        "\u028c": ["a", "\u0259", "\u0251", "u", "u\u02d0", "\u028a", "o", "o\u028a"],
        "\xe6": ["a", "\u0251\u02d0", "\u0251", "\u025b", "e"],
        "\u0279": ["\u025a", "\u0259", "r", "\u0251\u02d0", "\u0254\u02d0", "w", "j"],
        "r": ["\u0279", "\u025a", "\u0259", "w", "j"],
        "j": ["i", "u\u02d0", "\u026a", "\xe7"],
        "n": ["m", "\u014b"],
        "\u0259": ["\u025a", "a", "\u028c", "e", "\u026a"]
    }

    # CHỈ gom các cặp biến thể phương ngữ/ký hiệu IPA tương đương hợp lệ (tuyệt đối không gộp lỗi sai của người học L2 như /θ/->/f,s,t/ hay /iː/->/ɪ/).
    DIALECT_ALLOPHONES: Dict[str, List[str]] = {
        "g": ["ɡ"],
        "ɡ": ["g"],
        "r": ["ɹ", "ɚ"],
        "ɹ": ["r", "ɚ"],
        "e": ["ɛ"],
        "ɛ": ["e"],
        "tʃ": ["ʧ"],
        "dʒ": ["ʤ"],
        "iː": ["i"],
        "i": ["iː"],
        "uː": ["u"],
        "u": ["uː"],
        "ɑː": ["ɑ", "aː"],
        "ɑ": ["ɑː"],
        "ɔː": ["ɔ", "ɑː", "ɑ"],
        "ɔ": ["ɔː", "ɑː", "ɑ"],
        "ɔɪ": ["oɪ"],
        "oɪ": ["ɔɪ"],
        "ɜː": ["ɜ", "ɚ"],
        # Mô hình đa ngữ XLSR-53 thường nhận diện nguyên âm /ʌ/ (chuẩn US/UK/AU) qua các ký hiệu /ɐ, a, aː, ə/.
        "\u028c": ["\u0250", "a", "a\u02d0", "\u0259"],
        "\u0259": ["\u028c", "\u0250", "\u025a", "\u026a"],
        "t": ["ɾ", "ʔ"],
        "d": ["ɾ"],
    }

    # Nhóm âm bật (thời gian rất ngắn, điểm đánh giá lấy theo đỉnh xác suất thay vì trung bình)
    PLOSIVES_SET = {"p", "t", "k", "b", "d", "g", "\u0261", "\u027e", "\u0294"}

    # Ánh xạ ký hiệu IPA sang ký tự tương ứng có trong từ vựng của mô hình âm học Wav2Vec 2.0
    ACOUSTIC_TOKEN_FALLBACK = {
        "\u0254\u026a": "o\u026a",
        "ɔɪ": "o\u026a",
        "g": "\u0261",
        "r": "\u0279",
        "ʤ": "d\u0292",
        "ʧ": "t\u0283",
    }

    def __init__(self):
        """Khởi tạo ForcedAligner với ModelManager và bộ chuyển đổi G2P dùng chung."""
        self.model_mgr = ModelManager.get_instance()
        self.g2p = g2p_converter

    async def align(self, audio: np.ndarray, script: str) -> AlignmentResult:
        """Thực hiện gióng hàng bất đồng bộ trên thread pool để không chặn event loop của FastAPI."""
        return await asyncio.to_thread(self._align_sync, audio, script)

    def _align_sync(self, audio: np.ndarray, script: str) -> AlignmentResult:
        """Kiểm tra đầu vào và điều phối quá trình gióng hàng neural CTC đồng bộ."""
        validate_script(script)
        if not HAS_TORCH:
            raise ModelLoadError("Wav2Vec2", "PyTorch / torchaudio chưa được cài đặt trong môi trường hiện tại.")

        try:
            return self._align_neural(audio, script)
        except (LowAlignmentConfidenceError, InvalidTranscriptError, AlignmentError):
            raise
        except Exception as ex:
            logger.error("Neural alignment runtime error: %s", ex, exc_info=True)
            raise AlignmentError(f"Lỗi hệ thống khi phân tích neural alignment: {str(ex)}")

    def _align_neural(self, audio: np.ndarray, script: str) -> AlignmentResult:
        """
        Gióng hàng cưỡng bức Wav2Vec 2.0 CTC qua 5 bước chính:
        1. Chuyển câu mẫu sang chuỗi âm vị mục tiêu (G2P) và ánh xạ sang ID trong vocab Wav2Vec2.
        2. Chạy Wav2Vec2 thu được log-xác suất theo từng khung hình thời gian (~20ms/khung) và chuỗi decode tham lam.
        3. Tạo `log_probs_dialect` (chỉ gộp phương ngữ chuẩn để chấm GOP) và `log_probs_pooled` (gộp rộng để dò mốc thời gian).
        4. Chạy `torchaudio.functional.forced_align` tìm đường đi CTC tối ưu và xác định dải khung của từng âm vị.
        5. Tính xác suất hậu nghiệm (`posterior`, `canonical_posterior`) và biên độ GOP (`gop_margin`) cho mỗi âm vị.
        """
        # Bước 1: Chuẩn bị mô hình, bộ từ vựng và token trống (<pad>)
        self.model_mgr.load_model()
        model = self.model_mgr.model
        tokenizer = self.model_mgr.tokenizer
        device = self.model_mgr.device
        vocab = tokenizer.get_vocab()
        pad_id = tokenizer.pad_token_id or 0

        # Quy đổi văn bản sang danh sách (từ, âm vị IPA) thông qua G2P
        word_phonemes = self.g2p.convert_text(script)
        if not word_phonemes:
            raise InvalidTranscriptError("Không thể phân tích phiên âm cho script tham chiếu.")

        target_token_ids: List[int] = []
        raw_token_symbols: List[str] = []
        flat_targets: List[Tuple[int, int, PhonemeTarget]] = []

        # Ánh xạ từng âm vị IPA sang token ID trong vocab của mô hình (tách ký tự nếu là âm ghép chưa có sẵn)
        for w_idx, (word_text, ph_list) in enumerate(word_phonemes):
            for p_idx, ph in enumerate(ph_list):
                canonical_tok = self.ACOUSTIC_TOKEN_FALLBACK.get(ph.token, ph.token)
                token_id = vocab.get(canonical_tok)

                if token_id is None:
                    for ch in canonical_tok:
                        ch_id = vocab.get(ch)
                        if ch_id is not None:
                            target_token_ids.append(ch_id)
                            raw_token_symbols.append(ch)
                            flat_targets.append((w_idx, p_idx, ph))
                else:
                    target_token_ids.append(token_id)
                    raw_token_symbols.append(canonical_tok)
                    flat_targets.append((w_idx, p_idx, ph))

        if not target_token_ids:
            raise AlignmentError("Không thể ánh xạ chuỗi phiên âm vào từ vựng của mô hình Wav2Vec2.")

        if audio is None or len(audio) < 400:
            raise AlignmentError("Đoạn âm thanh quá ngắn để phân tích căn chỉnh.")

        # Bước 2: Chuẩn hóa sóng âm (zero-mean, unit-variance) và chạy suy luận Wav2Vec 2.0
        norm_audio = (audio - np.mean(audio)) / np.sqrt(np.var(audio) + 1e-7)
        audio_tensor = torch.from_numpy(norm_audio).float().unsqueeze(0).to(device)

        with torch.inference_mode():
            logits = model(audio_tensor).logits
            log_probs = torch.log_softmax(logits, dim=-1)
            greedy_ids = torch.argmax(logits[0], dim=-1).cpu().numpy()

        # Rút trích chuỗi âm vị decode tham lam (gộp các khung trùng liên tiếp, bỏ <pad>) để đối chiếu nội dung nói
        rev_vocab = self.model_mgr.rev_vocab or {int(v): k for k, v in vocab.items()}
        frame_tokens = [rev_vocab.get(int(pid), "<pad>") for pid in greedy_ids]
        raw_emitted_tokens: List[str] = []
        for tok in frame_tokens:
            if tok and tok != "<pad>" and (not raw_emitted_tokens or raw_emitted_tokens[-1] != tok):
                raw_emitted_tokens.append(tok)

        num_frames = log_probs.size(1)
        num_targets = len(target_token_ids)

        if num_frames < num_targets:
            raise LowAlignmentConfidenceError(
                0.0,
                settings.MIN_ALIGNMENT_CONFIDENCE,
                f"Đoạn âm thanh quá ngắn ({num_frames} frames) để căn chỉnh chuỗi đích ({num_targets} tokens)."
            )

        # Bước 3a: Log-xác suất chỉ gộp các biến thể phương ngữ hợp lệ (dùng để chấm điểm phát âm & GOP công bằng)
        log_probs_dialect = log_probs.clone()
        valid_id_groups: Dict[int, List[int]] = {}
        for target_sym, alt_syms in self.DIALECT_ALLOPHONES.items():
            tgt_id = vocab.get(target_sym)
            if tgt_id is None:
                continue
            group_ids = [tgt_id]
            seen_d = {tgt_id}
            for alt in alt_syms:
                alt_id = vocab.get(alt)
                if alt_id is not None and alt_id not in seen_d:
                    seen_d.add(alt_id)
                    group_ids.append(alt_id)
                    log_probs_dialect[0, :, tgt_id] = torch.logaddexp(
                        log_probs_dialect[0, :, tgt_id],
                        log_probs[0, :, alt_id]
                    )
            valid_id_groups[tgt_id] = group_ids

        # Bước 3b: Gộp xác suất tha âm vị rộng hơn CHỈ để thuật toán CTC tìm đúng ranh giới thời gian khi đọc lệch nhẹ
        log_probs_pooled = log_probs.clone()
        for target_sym, alt_syms in self.UNIVERSAL_ALLOPHONES.items():
            tgt_id = vocab.get(target_sym)
            if tgt_id is None:
                continue
            seen_u = {tgt_id}
            for alt in alt_syms:
                alt_id = vocab.get(alt)
                if alt_id is not None and alt_id not in seen_u:
                    seen_u.add(alt_id)
                    log_probs_pooled[0, :, tgt_id] = torch.logaddexp(
                        log_probs_pooled[0, :, tgt_id],
                        log_probs[0, :, alt_id]
                    )

        # Bước 4: Chạy CTC Forced Alignment tìm đường đi gióng hàng tối ưu qua các khung hình
        targets_tensor = torch.tensor([target_token_ids], dtype=torch.int32, device=device)
        try:
            aligned_tokens, scores = torchaudio.functional.forced_align(
                log_probs_pooled,
                targets_tensor,
                blank=pad_id
            )
        except Exception as ex:
            raise LowAlignmentConfidenceError(
                0.0,
                settings.MIN_ALIGNMENT_CONFIDENCE,
                f"Không thể tìm thấy đường đi căn chỉnh CTC phù hợp: {str(ex)}."
            )

        aligned_path = aligned_tokens[0].cpu().numpy()
        scores_path = scores[0].cpu().numpy()

        blank_log_probs = log_probs_pooled[0, :, pad_id].cpu().numpy()
        blank_probs_all = np.exp(blank_log_probs)

        # Độ tin cậy gióng hàng lấy trung bình 80% khung không phải blank có điểm cao nhất
        non_blank_scores = [np.exp(s) for s, t in zip(scores_path, aligned_path) if t != pad_id]
        if non_blank_scores:
            cutoff = max(1, int(len(non_blank_scores) * 0.8))
            align_confidence = float(np.mean(np.sort(non_blank_scores)[-cutoff:]))
        else:
            align_confidence = 0.0

        blank_ratio = float(np.sum(aligned_path == pad_id)) / float(len(aligned_path))

        if align_confidence < settings.MIN_ALIGNMENT_CONFIDENCE:
            raise LowAlignmentConfidenceError(
                round(align_confidence, 2),
                settings.MIN_ALIGNMENT_CONFIDENCE,
                f"Độ tin cậy căn chỉnh neural CTC đạt {align_confidence:.2f}, dưới ngưỡng {settings.MIN_ALIGNMENT_CONFIDENCE:.2f}."
            )

        # Gom các khung liên tiếp cùng một token không phải <pad> thành từng đoạn (runs) tương ứng thứ tự chuỗi đích
        runs: List[List[int]] = []
        in_run = False
        curr_run: List[int] = []

        for f_idx, token_id in enumerate(aligned_path):
            if token_id != pad_id:
                if not in_run:
                    in_run = True
                    curr_run = [f_idx]
                else:
                    if token_id == aligned_path[curr_run[-1]]:
                        curr_run.append(f_idx)
                    else:
                        runs.append(curr_run)
                        curr_run = [f_idx]
            else:
                if in_run:
                    runs.append(curr_run)
                    in_run = False
                    curr_run = []

        if in_run:
            runs.append(curr_run)

        frame_duration = len(audio) / float(num_frames) / float(settings.SAMPLE_RATE)
        total_audio_sec = len(audio) / float(settings.SAMPLE_RATE)

        # Ánh xạ ngược danh sách các đoạn khung (runs) về từng cặp (chỉ_số_từ, chỉ_số_âm_vị)
        phoneme_frames: Dict[Tuple[int, int], List[int]] = {}
        for r_idx, run_frames in enumerate(runs):
            if r_idx < len(flat_targets):
                w_idx, p_idx, _ = flat_targets[r_idx]
                phoneme_frames.setdefault((w_idx, p_idx), []).extend(run_frames)

        # Bước 5: Tổng hợp thời gian, xác suất hậu nghiệm và biên độ GOP cho từng âm vị & từng từ
        words_out: List[AlignedWord] = []
        last_end_time = 0.0

        for w_idx, (word_text, ph_list) in enumerate(word_phonemes):
            w_phonemes: List[AlignedPhoneme] = []
            word_start = 999999.0
            word_end = 0.0

            for p_idx, ph in enumerate(ph_list):
                frames = phoneme_frames.get((w_idx, p_idx), [])
                if frames:
                    start_frame = frames[0]
                    end_frame = frames[-1] + 1
                    p_start = start_frame * frame_duration
                    raw_end = end_frame * frame_duration
                    # Đảm bảo mỗi âm vị có độ dài tối thiểu 35ms để đủ lấy mẫu Formant/âm học
                    p_end = min(total_audio_sec, max(p_start + 0.035, raw_end))

                    f_scores = scores_path[frames]
                    f_raw_probs = np.exp(f_scores)
                    frame_blank_probs = blank_probs_all[frames]
                    mean_raw = float(np.mean(f_raw_probs))
                    mean_blank = float(np.mean(frame_blank_probs))

                    # Tính log-xác suất chuẩn (chỉ theo phương ngữ hợp lệ) từ `log_probs_dialect`
                    f_tensor = torch.tensor(frames, dtype=torch.long, device=device)
                    aligned_tids = torch.tensor(aligned_path[frames], dtype=torch.long, device=device)
                    canon_lps = log_probs_dialect[0, f_tensor, aligned_tids]
                    canon_raw_probs = torch.exp(canon_lps).cpu().numpy()

                    # Che (mask) `pad_id` và nhóm âm phương ngữ hợp lệ để tìm âm đối thủ mạnh nhất trên `log_probs` gốc -> tính GOP margin kiểu Witt & Young
                    comp_slice = log_probs[0, f_tensor, :].clone()
                    comp_slice[:, pad_id] = -1e9
                    for tid_val in aligned_path[frames]:
                        tid_int = int(tid_val)
                        excl_ids = valid_id_groups.get(tid_int, [tid_int])
                        comp_slice[:, excl_ids] = -1e9
                    best_comp_lps = comp_slice.max(dim=-1).values
                    gop_frames = (canon_lps - best_comp_lps).cpu().numpy()

                    clean_sym = ph.symbol.strip("/ ")
                    is_plosive = clean_sym in self.PLOSIVES_SET or ph.token in self.PLOSIVES_SET

                    # Không khuếch đại xác suất nếu khung hình hoàn toàn là blank/im lặng (blank > 0.90 hoặc raw < 0.03)
                    if mean_blank > 0.90 or mean_raw < 0.03:
                        p_post = float(np.max(f_raw_probs) if is_plosive else mean_raw)
                        p_raw_post = p_post
                        p_canon_post = float(np.max(canon_raw_probs) if is_plosive else np.mean(canon_raw_probs))
                        p_gop_margin = float(np.max(gop_frames) if is_plosive else np.mean(gop_frames))
                    else:
                        # Chuẩn hóa theo khối lượng xác suất không phải blank để khử hiệu ứng đỉnh nhọn đặc trưng của CTC
                        non_blank_mass = np.maximum(0.15, 1.0 - frame_blank_probs)
                        f_norm_probs = np.minimum(1.0, f_raw_probs / non_blank_mass)
                        canon_norm_probs = np.minimum(1.0, canon_raw_probs / non_blank_mass)
                        if is_plosive:
                            # Âm bật xảy ra tức thời nên lấy giá trị cực đại (peak)
                            p_post = float(max(np.max(f_norm_probs), np.max(f_raw_probs)))
                            p_raw_post = float(np.max(f_raw_probs))
                            p_canon_post = float(max(np.max(canon_norm_probs), np.max(canon_raw_probs)))
                            p_gop_margin = float(np.max(gop_frames))
                        else:
                            # Âm kéo dài lấy trung bình top-k khung tốt nhất trong đoạn được gióng hàng
                            top_k = min(len(f_raw_probs), 3)
                            norm_top = float(np.mean(np.sort(f_norm_probs)[-top_k:]))
                            raw_top = float(np.mean(np.sort(f_raw_probs)[-top_k:]))
                            p_post = float(max(norm_top, raw_top))
                            p_raw_post = raw_top
                            p_canon_post = float(max(
                                float(np.mean(np.sort(canon_norm_probs)[-top_k:])),
                                float(np.mean(np.sort(canon_raw_probs)[-top_k:]))
                            ))
                            p_gop_margin = float(np.mean(np.sort(gop_frames)[-min(len(gop_frames), 2):]))
                else:
                    # Âm vị không được gán khung hình nào: đặt điểm và biên độ GOP ở mức thấp nhất
                    p_start = max(0.0, last_end_time)
                    p_end = min(total_audio_sec, p_start + 0.05)
                    p_post = 0.0
                    p_raw_post = 0.0
                    p_canon_post = 0.0
                    p_gop_margin = -6.0

                last_end_time = p_end
                # Tính độ tin cậy của âm vị từ xác suất hậu nghiệm
                p_conf = float(np.clip(p_post, 0.0, 1.0)) if p_post < 0.10 else float(np.clip(p_post + 0.10, 0.0, 1.0))
                is_final = (p_idx == len(ph_list) - 1)

                w_phonemes.append(
                    AlignedPhoneme(
                        symbol=ph.symbol,
                        start=round(p_start, 3),
                        end=round(p_end, 3),
                        posterior=round(p_post, 3),
                        confidence=round(p_conf, 3),
                        phoneme_type=ph.phoneme_type,
                        is_stress=ph.is_stress,
                        is_word_final=is_final,
                        raw_posterior=round(p_raw_post, 3),
                        canonical_posterior=round(p_canon_post, 3),
                        gop_margin=round(p_gop_margin, 3),
                        has_frames=bool(frames)
                    )
                )

                word_start = min(word_start, p_start)
                word_end = max(word_end, p_end)

            if word_start >= 999999.0:
                word_start = 0.0

            # Đóng gói kết quả cấp độ từ kèm cờ nhận diện từ ngoài từ điển (is_oov)
            w_conf = float(np.mean([p.confidence for p in w_phonemes])) if w_phonemes else 0.90
            words_out.append(
                AlignedWord(
                    word=word_text,
                    start=round(word_start, 3),
                    end=round(word_end, 3),
                    phonemes=w_phonemes,
                    confidence=round(w_conf, 2),
                    is_oov=self.g2p.is_oov_word(word_text)
                )
            )

        return AlignmentResult(
            words=words_out,
            alignment_confidence=round(align_confidence, 3),
            raw_tokens=raw_token_symbols,
            blank_ratio=round(blank_ratio, 3),
            raw_emitted_tokens=raw_emitted_tokens,
            frame_tokens=frame_tokens,
            frame_duration=round(frame_duration, 6)
        )


forced_aligner = ForcedAligner()