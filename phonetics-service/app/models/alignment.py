"""
Các mô hình dữ liệu nội bộ (dataclass) dùng xuyên suốt quá trình căn chỉnh âm học,
phát hiện vùng có tiếng nói (VAD), phát hiện quãng ngắt và chấm điểm phát âm.
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class AlignedPhoneme:
    """Đại diện cho một âm vị đơn lẻ đã được căn chỉnh khớp vào trục thời gian của file âm thanh."""
    symbol: str                              # Ký hiệu âm vị IPA (ví dụ: 'æ', 'k')
    start: float                             # Thời điểm bắt đầu của âm vị (giây)
    end: float                               # Thời điểm kết thúc của âm vị (giây)
    posterior: float = 0.0                   # Xác suất hậu nghiệm đã chuẩn hóa từ mô hình âm học
    confidence: float = 1.0                  # Độ tin cậy của phép căn chỉnh âm vị (0.0 - 1.0)
    phoneme_type: str = "consonant"          # Loại âm vị: "vowel" (nguyên âm) hoặc "consonant" (phụ âm)
    is_stress: bool = False                  # True nếu âm vị nằm trong âm tiết mang trọng âm
    is_word_final: bool = False              # True nếu đây là âm vị cuối cùng của từ
    # Xác suất CTC thô của token mục tiêu (KHÔNG chuẩn hóa bỏ qua nhãn blank). Nếu là None thì lấy bằng posterior.
    raw_posterior: Optional[float] = None
    # Xác suất hậu nghiệm nghiêm ngặt chỉ tính cho đúng âm chuẩn mục tiêu (không cộng điểm cho các biến thể thay thế thường gặp của người học ngoại ngữ).
    canonical_posterior: Optional[float] = None
    # Chỉ số biên độ GOP (Goodness of Pronunciation) theo Witt & Young: hiệu log-xác suất logP(mục_tiêu|x) - max_{q != mục_tiêu} logP(q|x).
    gop_margin: Optional[float] = None
    # Bằng False khi đường đi Viterbi không gán được khung hình âm thanh nào cho âm vị này (người học đọc nuốt âm).
    has_frames: bool = True

    def __post_init__(self):
        """Khởi tạo giá trị mặc định cho `raw_posterior` nếu chưa được truyền riêng."""
        if self.raw_posterior is None:
            self.raw_posterior = self.posterior

    @property
    def duration(self) -> float:
        """Trả về thời lượng phát âm của âm vị tính bằng giây (không âm)."""
        return max(0.0, self.end - self.start)


@dataclass
class AlignedWord:
    """Đại diện cho một từ tiếng Anh hoàn chỉnh cùng danh sách các âm vị đã căn chỉnh thời gian."""
    word: str                                                    # Mặt chữ gốc của từ tham chiếu
    start: float                                                 # Thời điểm bắt đầu của từ (giây)
    end: float                                                   # Thời điểm kết thúc của từ (giây)
    phonemes: List[AlignedPhoneme] = field(default_factory=list) # Danh sách các âm vị cấu thành từ
    confidence: float = 1.0                                      # Độ tin cậy căn chỉnh ở cấp độ từ
    is_oov: bool = False                                         # True nếu là từ ngoài từ điển chuẩn (tên riêng, từ hiếm)
    # Bằng True khi thuật toán CTC Viterbi cho phép bỏ qua (skip-capable) không tìm thấy tín hiệu giọng nói cho từ này (từ bị bỏ sót không đọc).
    skipped: bool = False

    @property
    def duration(self) -> float:
        """Trả về tổng thời lượng phát âm của từ tính bằng giây (không âm)."""
        return max(0.0, self.end - self.start)


@dataclass
class SpeechSegment:
    """Đại diện cho một khoảng thời gian liên tục được bộ phát hiện tiếng nói (VAD) ghi nhận."""
    start: float             # Thời điểm bắt đầu đoạn (giây)
    end: float               # Thời điểm kết thúc đoạn (giây)
    is_speech: bool = True   # True nếu là đoạn có giọng nói, False nếu là khoảng lặng

    @property
    def duration(self) -> float:
        """Trả về độ dài của đoạn thời gian tính bằng giây (không âm)."""
        return max(0.0, self.end - self.start)


@dataclass
class PauseEvent:
    """Đại diện cho một khoảng lặng/ngắt nghỉ giữa các từ hoặc ngay trong lúc nói."""
    start: float            # Thời điểm bắt đầu quãng ngắt (giây)
    end: float              # Thời điểm kết thúc quãng ngắt (giây)
    duration: float         # Độ dài quãng ngắt (giây)
    pause_type: str         # Phân loại quãng ngắt: "natural" (tự nhiên), "punctuation" (dấu câu), "hesitation" (ngập ngừng), "long_pause" (ngưng lâu), "uncertain" (chưa rõ)
    penalty: float = 0.0    # Điểm trừ áp dụng vào điểm độ trôi chảy (fluency)
    confidence: float = 1.0 # Độ tin cậy của việc phân loại quãng ngắt


@dataclass
class AlignmentResult:
    """Kết quả tổng hợp đầy đủ do dịch vụ căn chỉnh cưỡng bức (Forced Alignment) trả về."""
    words: List[AlignedWord]                                      # Danh sách các từ đã được căn chỉnh kèm âm vị
    alignment_confidence: float                                   # Độ tin cậy căn chỉnh tổng thể của cả câu
    raw_tokens: List[str] = field(default_factory=list)           # Danh sách token âm vị thô theo câu mẫu
    blank_ratio: float = 0.0                                      # Tỷ lệ khung hình bị gán nhãn rỗng (blank) trên toàn đoạn
    duration_anomaly_penalty: float = 0.0                         # Hệ số phạt khi thời lượng các âm bị kéo giãn/co cụm bất thường
    # Lưu đệm chuỗi token giải mã tham lam (CTC greedy) từ một lần chạy duy nhất để tránh phải chạy lại mô hình Wav2Vec2 nhiều lần.
    raw_emitted_tokens: List[str] = field(default_factory=list)
    frame_tokens: List[str] = field(default_factory=list)         # Token dự đoán cao nhất tại từng khung hình (frame) âm thanh
    frame_duration: float = 0.02                                  # Thời lượng mỗi khung hình âm thanh của Wav2Vec2 (~0.02 giây = 20ms)

    def get_window_emitted_tokens(self, start_sec: float, end_sec: float) -> List[str]:
        """Cắt chuỗi token theo khung hình trong khoảng [start_sec, end_sec] và gộp các ký hiệu CTC lặp liên tiếp."""
        if not self.frame_tokens or self.frame_duration <= 0.0:
            return []
        # Quy đổi mốc thời gian (giây) sang chỉ số khung hình (frame index) tương ứng
        f_start = max(0, int(start_sec / self.frame_duration))
        f_end = min(len(self.frame_tokens), max(f_start + 1, int(math.ceil(end_sec / self.frame_duration))))
        emitted: List[str] = []
        # Bỏ qua ký hiệu đệm <pad> và gộp các ký hiệu giống nhau đứng liền kề theo đúng quy tắc giải mã CTC
        for sym in self.frame_tokens[f_start:f_end]:
            if sym and sym != "<pad>" and (not emitted or emitted[-1] != sym):
                emitted.append(sym)
        return emitted
