"""
Định nghĩa toàn bộ các kiểu liệt kê (Enum) và cấu trúc dữ liệu JSON (Pydantic Schema)
dùng cho giao tiếp API của dịch vụ đánh giá phát âm và tổng hợp giọng nói (TTS).
Các model kế thừa `CamelModel` sẽ tự động chuyển tên trường từ `snake_case` sang `camelCase`
khi trả JSON để tương thích trực tiếp với backend Spring Boot và giao diện Frontend React.
"""

from enum import Enum
from typing import List, Optional, Literal
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# ==============================================================================
# CÁC KIỂU LIỆT KÊ TRẠNG THÁI VÀ MÃ LỖI (ENUMS)
# ==============================================================================
class EvaluationStatus(str, Enum):
    """Trạng thái tổng thể của một lượt chấm điểm phát âm trả về cho hệ thống gọi API."""
    SUCCESS = "SUCCESS"                              # Đánh giá hoàn chỉnh với độ tin cậy đạt yêu cầu
    COMPLETED = "COMPLETED"                          # Hoàn tất chấm điểm (tương thích trạng thái cũ)
    LOW_CONFIDENCE = "LOW_CONFIDENCE"                # Có kết quả nhưng độ tin cậy thấp (âm thanh nhiễu/mơ hồ)
    INSUFFICIENT_AUDIO = "INSUFFICIENT_AUDIO"        # Âm thanh không đủ dữ liệu/thời lượng để đánh giá
    ALIGNMENT_FAILED = "ALIGNMENT_FAILED"            # Không thể căn chỉnh âm thanh khớp với câu mẫu
    ALIGNMENT_LOW_CONFIDENCE = "ALIGNMENT_LOW_CONFIDENCE"  # Căn chỉnh được nhưng mức độ khớp với câu mẫu quá thấp
    AUDIO_QUALITY_TOO_LOW = "AUDIO_QUALITY_TOO_LOW"  # Chất lượng ghi âm quá kém (rè, nhỏ hoặc nhiễu nặng)
    PARTIAL_EVALUATION = "PARTIAL_EVALUATION"        # Chỉ đánh giá được một phần câu (người học đọc thiếu nhiều từ)
    REJECTED_MISMATCH = "REJECTED_MISMATCH"          # Từ chối chấm điểm do nội dung nói lệch hoàn toàn câu mẫu
    WRONG_WORD = "WRONG_WORD"                        # Người học đọc sai từ so với từ khóa mục tiêu


class PhonemeType(str, Enum):
    """Phân loại nhóm âm vị theo cấu âm học."""
    VOWEL = "vowel"          # Nguyên âm (luồng hơi thoát ra tự do, có thể đo formant F1/F2)
    CONSONANT = "consonant"  # Phụ âm (luồng hơi bị cản trở bởi môi, răng, lưỡi...)


class MeasurementStatus(str, Enum):
    """Mức độ tin cậy của phép đo âm học cho từng âm vị riêng lẻ."""
    OK = "OK"                                        # Đo đạc ổn định và đáng tin cậy
    FORMANT_NOT_RELIABLE = "FORMANT_NOT_RELIABLE"    # Tần số formant (F1/F2) của nguyên âm không ổn định/khó bắt
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"  # Thiếu bằng chứng âm thanh tại đoạn âm vị này
    UNVOICED = "UNVOICED"                            # Âm vô thanh (dây thanh không rung nên không đo được formant)


class PauseType(str, Enum):
    """Phân loại các khoảng im lặng (quãng ngắt) phát hiện được trong bài nói."""
    NATURAL = "natural"          # Ngắt nghỉ tự nhiên hợp lý giữa các cụm từ
    PUNCTUATION = "punctuation"  # Ngắt nghỉ đúng vị trí dấu phẩy, dấu chấm trong câu
    HESITATION = "hesitation"    # Ngập ngừng ngắn ngoài ý muốn
    LONG_PAUSE = "long_pause"    # Ngưng kéo dài gây đứt mạch nói (bị trừ điểm trôi chảy)
    UNCERTAIN = "uncertain"      # Khoảng lặng chưa thể kết luận chắc chắn nguyên nhân


class FeedbackSeverity(str, Enum):
    """Mức độ nghiêm trọng của nhận xét về độ trôi chảy (fluency)."""
    INFO = "info"          # Thông tin tham khảo / khen ngợi
    MINOR = "minor"        # Lỗi nhẹ, ảnh hưởng ít
    MODERATE = "moderate"  # Lỗi trung bình, cần chú ý cải thiện
    MAJOR = "major"        # Lỗi nặng, làm gián đoạn mạch nói


class ErrorCode(str, Enum):
    """Danh mục mã lỗi chuẩn hóa trả về trong JSON khi xử lý yêu cầu thất bại."""
    INVALID_AUDIO = "INVALID_AUDIO"                          # File âm thanh hỏng hoặc không đọc được
    UNSUPPORTED_AUDIO_FORMAT = "UNSUPPORTED_AUDIO_FORMAT"    # Định dạng file âm thanh không được hỗ trợ
    AUDIO_TOO_LARGE = "AUDIO_TOO_LARGE"                      # Dung lượng file vượt mức tối đa
    AUDIO_TOO_SHORT = "AUDIO_TOO_SHORT"                      # Độ dài ghi âm quá ngắn
    AUDIO_TOO_LONG = "AUDIO_TOO_LONG"                        # Độ dài ghi âm quá dài
    AUDIO_QUALITY_TOO_LOW = "AUDIO_QUALITY_TOO_LOW"          # Bản ghi âm quá nhiễu hoặc vỡ tiếng
    EMPTY_SPEECH = "EMPTY_SPEECH"                            # Không phát hiện giọng nói trong bản ghi
    INVALID_SCRIPT = "INVALID_SCRIPT"                        # Câu mẫu đầu vào rỗng hoặc không hợp lệ
    ALIGNMENT_FAILED = "ALIGNMENT_FAILED"                    # Lỗi căn chỉnh âm thanh với văn bản mẫu
    ALIGNMENT_LOW_CONFIDENCE = "ALIGNMENT_LOW_CONFIDENCE"    # Độ khớp giữa giọng nói và câu mẫu quá thấp
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"                  # Mô hình AI chưa sẵn sàng hoặc lỗi khi nạp
    FORMANT_EXTRACTION_FAILED = "FORMANT_EXTRACTION_FAILED"  # Lỗi trích xuất tần số formant từ Praat
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"          # Không đủ dữ liệu âm học để kết luận điểm
    INTERNAL_ERROR = "INTERNAL_ERROR"                        # Lỗi hệ thống nội bộ ngoài dự kiến


# ==============================================================================
# SCHEMA CƠ SỞ (CẤU HÌNH TỰ ĐỘNG ĐỔI TÊN TRƯỜNG SANG camelCase)
# ==============================================================================
class CamelModel(BaseModel):
    """
    Lớp schema cơ sở cho hầu hết các đối tượng API.
    - `alias_generator=to_camel`: tự động chuyển tên biến Python (snake_case) thành camelCase khi xuất JSON.
    - `populate_by_name=True`: cho phép khởi tạo model bằng cả tên snake_case lẫn camelCase.
    - `use_enum_values=True`: xuất thẳng giá trị chuỗi của Enum thay vì đối tượng Enum.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        use_enum_values=True
    )


# ==============================================================================
# CÁC SCHEMA THÀNH PHẦN (ÂM VỊ, TỪ, QUÃNG NGẮT, CHẤT LƯỢNG ÂM THANH)
# ==============================================================================
class PhonemeSchema(CamelModel):
    """Thông tin đánh giá chi tiết cho một âm vị (phoneme) trong một từ."""
    symbol: str = Field(..., description="IPA phoneme character, e.g. /æ/, /k/")
    type: PhonemeType = Field(..., description="'vowel' or 'consonant'")
    score: float = Field(..., ge=0.0, le=100.0, description="Phoneme pronunciation score 0-100")
    feedback: Optional[str] = Field(None, description="Detailed pedagogical feedback on anatomical execution")
    # Các giá trị tần số cộng hưởng F1/F2 (đơn vị Hz) dùng để so sánh vị trí lưỡi & độ mở miệng với người bản ngữ
    measured_f1: Optional[float] = Field(None, description="Actual extracted Praat F1 formant in Hz")
    measured_f2: Optional[float] = Field(None, description="Actual extracted Praat F2 formant in Hz")
    target_f1: Optional[float] = Field(None, description="Reference distribution target F1 in Hz")
    target_f2: Optional[float] = Field(None, description="Reference distribution target F2 in Hz")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Phoneme-level measurement confidence")
    status: Optional[MeasurementStatus] = Field(MeasurementStatus.OK, description="Measurement reliability status")


class WordStatus(str, Enum):
    """Trạng thái căn chỉnh của từ (tương thích ngược với contract cũ)."""
    MATCH = "MATCH"                # Khớp với từ trong câu mẫu
    NOT_SPOKEN = "NOT_SPOKEN"      # Không tìm thấy tiếng nói cho từ này
    SUBSTITUTION = "SUBSTITUTION"  # Đọc nhầm/thay thế bằng từ khác


class SpokenWordStatus(str, Enum):
    """Trạng thái đọc thực tế chi tiết của từng từ trong câu mẫu."""
    SPOKEN = "SPOKEN"          # Đã đọc đầy đủ
    MISSING = "MISSING"        # Bị bỏ sót hoàn toàn, không đọc
    PARTIAL = "PARTIAL"        # Chỉ đọc được một phần các âm của từ
    WRONG_WORD = "WRONG_WORD"  # Đọc sai sang từ khác
    MISMATCH = "MISMATCH"      # Không khớp với từ mẫu


class WordSchema(CamelModel):
    """Thông tin đánh giá cấp độ từ (word), gom nhóm từ các âm vị cấu thành."""
    word: str = Field(..., description="Orthographic reference word text")
    start_time: Optional[float] = Field(None, ge=0.0, description="Word onset timestamp in seconds")
    end_time: Optional[float] = Field(None, ge=0.0, description="Word offset timestamp in seconds")
    score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Aggregated word pronunciation score 0-100")
    phonemes: List[PhonemeSchema] = Field(default_factory=list, description="Phoneme breakdown for this word")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Word-level alignment confidence")
    status: Optional[WordStatus] = Field(WordStatus.MATCH, description="Spoken word alignment status")
    word_status: Optional[SpokenWordStatus] = Field(SpokenWordStatus.SPOKEN, description="SPOKEN, MISSING, or PARTIAL")
    # Cờ True nếu từ là tên riêng hoặc từ hiếm không có sẵn trong từ điển phát âm chuẩn (Out-Of-Vocabulary)
    is_oov: Optional[bool] = Field(False, description="True if word is OOV / proper noun")


class PauseEventSchema(CamelModel):
    """Mô tả một khoảng lặng/ngắt nghỉ được phát hiện trong lúc nói và mức phạt tương ứng."""
    start: float = Field(..., ge=0.0, description="Start timestamp of silent gap in seconds")
    end: float = Field(..., ge=0.0, description="End timestamp of silent gap in seconds")
    duration: float = Field(..., ge=0.0, description="Duration of gap in seconds")
    type: PauseType = Field(..., description="Categorization of pause event")
    penalty: float = Field(0.0, ge=0.0, description="Deduction point applied to fluency")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence in pause classification")


class FluencyFeedbackItem(CamelModel):
    """Một mục nhận xét cụ thể về độ trôi chảy (ngập ngừng, ngắt nghỉ dài, nhịp nói...)."""
    type: str = Field(..., description="Category of fluency observation (pause, hesitation, etc.)")
    severity: FeedbackSeverity = Field(..., description="Issue severity: info, minor, moderate, major")
    message: str = Field(..., description="Actionable student feedback")
    timestamp: Optional[float] = Field(None, description="Occurrence time in seconds")


class AudioQualityMetrics(CamelModel):
    """Các chỉ số kỹ thuật đo chất lượng bản ghi âm trước khi đưa vào chấm điểm."""
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
# PHẢN HỒI API CHÍNH (PRIMARY API CONTRACT RESPONSES)
# ==============================================================================
class SpeechAssessmentResponse(CamelModel):
    """
    Cấu trúc phản hồi chuẩn cho API đánh giá phát âm, khớp hợp đồng dữ liệu với Spring Boot Microservice.
    Toàn bộ tên trường khi xuất JSON được chuyển sang `camelCase` và giữ đầy đủ tính tương thích ngược.
    """
    overall_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Weighted composite score 0-100")
    pronunciation_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Pronunciation score 0-100")
    fluency_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Fluency score 0-100")
    speed_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Speaking rate score 0-100")
    articulation_rate: Optional[float] = Field(None, description="Spoken syllables per second of articulation time")
    words: List[WordSchema] = Field(default_factory=list, description="Word-level evaluation details")
    fluency_feedback: List[FluencyFeedbackItem] = Field(default_factory=list, description="Fluency commentary")

    # Các trường mở rộng tùy chọn (giữ tương thích ngược với các phiên bản DTO cũ)
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

    # Các trường bổ sung phục vụ hiển thị trực tiếp trên giao diện Shadowing (Spring Boot / React)
    is_passed: Optional[bool] = Field(None, description="True if overallScore >= passScore")
    # Ngưỡng điểm tối thiểu để đạt bài luyện nói (mặc định 80/100 điểm)
    pass_score: Optional[int] = Field(80, description="Pass threshold score, default 80")
    status_message: Optional[str] = Field(None, description="Vietnamese pedagogical status message")
    evaluated_by: Optional[str] = Field("PYTHON_ACOUSTIC_ENGINE", description="Evaluation engine identifier")
    kpi: Optional[dict] = Field(None, description="KPI metrics object")
    sentence_tokens: Optional[List[dict]] = Field(None, description="Visual tokens for UI")
    word_rows: Optional[List[dict]] = Field(None, description="Word and phoneme rows")


class ErrorDetail(BaseModel):
    """Chi tiết lỗi có cấu trúc giúp client hiển thị thông báo và hướng dẫn sửa cho người dùng."""
    code: ErrorCode
    message: str
    reason: str
    suggestion: str


class ErrorResponse(BaseModel):
    """Vỏ bọc JSON phản hồi lỗi chuẩn của FastAPI (`{"detail": ...}`)."""
    detail: ErrorDetail


# ==============================================================================
# CÁC SCHEMA CHO DỊCH VỤ CHUYỂN VĂN BẢN THÀNH GIỌNG NÓI (TTS SCHEMAS)
# ==============================================================================
class TtsRequest(CamelModel):
    """Yêu cầu tổng hợp giọng nói cho một câu hoặc đoạn văn bản đơn lẻ."""
    text: str = Field(..., min_length=1, max_length=2000, description="Sentence text to synthesize")
    voice: Optional[str] = Field("af_heart", description="Voice identifier, e.g. af_heart, am_michael, bf_emma")
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0, description="Playback speed factor 0.5 - 2.0")


class VoiceInfo(CamelModel):
    """Thông tin mô tả một giọng đọc Kokoro TTS đang khả dụng trên hệ thống."""
    id: str
    name: str
    accent: str
    gender: str
    description: str
    pipeline: str
    is_default: bool


class DialogueTurn(CamelModel):
    """Một lượt thoại của một nhân vật trong đoạn hội thoại nhiều người nói."""
    speaker: str = Field(..., description="Speaker identifier, e.g. 'A', 'B', 'Dr. Watson', 'Alice'")
    text: str = Field(..., min_length=1, max_length=2000, description="Utterance text for this turn")
    voice: Optional[str] = Field(None, description="Optional override voice for this specific turn")
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0, description="Playback speed for this turn")


class SpeakerVoiceConfig(CamelModel):
    """Cấu hình giọng đọc và tốc độ nói mặc định gắn cho từng vai người nói."""
    voice: str = Field(..., description="Kokoro voice ID assigned to this speaker")
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0, description="Speed factor")


class DialogueTtsRequest(CamelModel):
    """Yêu cầu tạo file âm thanh ghép nối nhiều lượt hội thoại kèm cấu hình giọng và khoảng nghỉ giữa lượt."""
    turns: List[DialogueTurn] = Field(..., min_length=1, max_length=50, description="List of sequential dialogue turns")
    speaker_map: Optional[dict[str, SpeakerVoiceConfig]] = Field(
        default_factory=dict,
        description="Optional mapping from speaker identifier to specific voice and speed"
    )
    # Thời gian khoảng lặng chèn giữa hai lượt nói liên tiếp (mặc định 450 mili-giây)
    inter_turn_pause_ms: Optional[int] = Field(
        450, ge=100, le=2000,
        description="Pause duration between turns in milliseconds (default 450ms)"
    )


class DialogueSegmentMetadata(CamelModel):
    """Mốc thời gian (tính bằng mili-giây) của một lượt thoại trong file audio hội thoại đã ghép."""
    speaker: str = Field(..., description="Speaker label (e.g. 'A', 'B')")
    voice: str = Field(..., description="Kokoro voice identifier used")
    text: str = Field(..., description="Transcript text spoken in this segment")
    start_ms: int = Field(..., ge=0, description="Turn onset in audio timeline (milliseconds)")
    end_ms: int = Field(..., ge=0, description="Turn offset in audio timeline (milliseconds)")


class DialogueTtsResponse(CamelModel):
    """Kết quả trả về khi tổng hợp hội thoại: tổng thời lượng, tần số mẫu, mốc từng câu và audio WAV Base64."""
    duration_ms: int = Field(..., description="Total dialogue audio duration in milliseconds")
    sample_rate: int = Field(24000, description="Sample rate in Hz (default 24000)")
    segments: List[DialogueSegmentMetadata] = Field(default_factory=list, description="Per-turn timeline alignment metadata")
    audio_base64: str = Field(..., description="Base64-encoded WAV (16-bit PCM 24kHz mono) audio payload")


