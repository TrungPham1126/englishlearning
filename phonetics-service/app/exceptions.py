"""
Định nghĩa các lớp ngoại lệ (Exception) nghiệp vụ cho microservice đánh giá phát âm.
Mỗi ngoại lệ gắn với một mã HTTP status và một `ErrorCode` chuẩn hóa, giúp trả về
thông báo lỗi rõ ràng, có gợi ý khắc phục cho người dùng mà không lộ dấu vết lỗi nội bộ.
"""

from typing import Optional

# Nhập hằng số mã trạng thái HTTP từ FastAPI; nếu chạy thử nghiệm độc lập không có FastAPI
# thì tạo lớp giả lập tương đương để tránh lỗi ImportError.
try:
    from fastapi import status
except ImportError:
    class status:
        HTTP_400_BAD_REQUEST = 400
        HTTP_413_REQUEST_ENTITY_TOO_LARGE = 413
        HTTP_415_UNSUPPORTED_MEDIA_TYPE = 415
        HTTP_422_UNPROCESSABLE_ENTITY = 422
        HTTP_500_INTERNAL_SERVER_ERROR = 500
        HTTP_503_SERVICE_UNAVAILABLE = 503

# Starlette/FastAPI bản mới đổi tên HTTP_422_UNPROCESSABLE_ENTITY thành HTTP_422_UNPROCESSABLE_CONTENT
HTTP_422 = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422)

from app.schemas import ErrorCode, ErrorDetail


class SpeechAssessmentException(Exception):
    """
    Lớp ngoại lệ gốc cho toàn bộ hệ thống đánh giá phát âm (Speech Assessment Microservice).
    Đảm bảo mọi lỗi phát sinh đều được đóng gói thành dữ liệu JSON có cấu trúc rõ ràng
    (mã lỗi, thông báo, nguyên nhân, gợi ý sửa) và không làm lộ stack trace ra phía client.
    """
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        reason: str,
        suggestion: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        internal_error: Optional[Exception] = None
    ):
        """Khởi tạo ngoại lệ nghiệp vụ kèm mã lỗi, thông báo thân thiện, trạng thái HTTP và lỗi gốc (nếu có)."""
        super().__init__(message)
        self.code = code
        self.message = message
        self.reason = reason
        self.suggestion = suggestion
        self.status_code = status_code
        self.internal_error = internal_error

    def to_detail(self) -> ErrorDetail:
        """Chuyển đổi thông tin ngoại lệ thành schema `ErrorDetail` để trả về trong phản hồi API."""
        return ErrorDetail(
            code=self.code,
            message=self.message,
            reason=self.reason,
            suggestion=self.suggestion
        )


class UnsupportedAudioError(SpeechAssessmentException):
    """Ngoại lệ khi file âm thanh tải lên không đúng định dạng được hỗ trợ (HTTP 415 - UNSUPPORTED_AUDIO_FORMAT)."""
    def __init__(self, reason: str = "Định dạng file âm thanh không được hỗ trợ."):
        super().__init__(
            code=ErrorCode.UNSUPPORTED_AUDIO_FORMAT,
            message="Định dạng âm thanh không hợp lệ.",
            reason=reason,
            suggestion="Vui lòng cung cấp file ghi âm định dạng .wav, .mp3 hoặc .m4a.",
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
        )


class AudioTooLargeError(SpeechAssessmentException):
    """Ngoại lệ khi dung lượng file âm thanh vượt quá giới hạn `MAX_UPLOAD_SIZE_MB` (HTTP 413 - AUDIO_TOO_LARGE)."""
    def __init__(self, size_mb: float, max_mb: float):
        super().__init__(
            code=ErrorCode.AUDIO_TOO_LARGE,
            message="File âm thanh vượt quá dung lượng cho phép.",
            reason=f"Dung lượng {size_mb:.1f}MB vượt giới hạn {max_mb:.1f}MB.",
            suggestion=f"Vui lòng nén hoặc giảm độ phân giải âm thanh dưới {max_mb:.0f}MB.",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        )


class AudioTooShortError(SpeechAssessmentException):
    """Ngoại lệ khi bản ghi âm ngắn hơn `MIN_AUDIO_DURATION`, không đủ dữ liệu phân tích (HTTP 422 - AUDIO_TOO_SHORT)."""
    def __init__(self, duration: float, min_duration: float):
        super().__init__(
            code=ErrorCode.AUDIO_TOO_SHORT,
            message="Đoạn ghi âm quá ngắn để phân tích âm học.",
            reason=f"Thời lượng {duration:.2f}s ngắn hơn ngưỡng tối thiểu {min_duration:.2f}s.",
            suggestion="Hãy đọc to và phát âm đầy đủ toàn bộ câu.",
            status_code=HTTP_422
        )


class AudioTooLongError(SpeechAssessmentException):
    """Ngoại lệ khi bản ghi âm dài hơn `MAX_AUDIO_DURATION` của một bài luyện nói (HTTP 422 - AUDIO_TOO_LONG)."""
    def __init__(self, duration: float, max_duration: float):
        super().__init__(
            code=ErrorCode.AUDIO_TOO_LONG,
            message="Đoạn ghi âm quá dài cho một bài luyện nói câu.",
            reason=f"Thời lượng {duration:.1f}s vượt quá thời gian tối đa {max_duration:.1f}s.",
            suggestion="Vui lòng chỉ đọc đúng câu được yêu cầu trong thời gian quy định.",
            status_code=HTTP_422
        )


class AudioQualityTooLowError(SpeechAssessmentException):
    """Ngoại lệ khi chất lượng bản ghi không đạt cổng kiểm tra (quá nhiễu, rè/clipping hoặc âm lượng quá nhỏ) (HTTP 422 - AUDIO_QUALITY_TOO_LOW)."""
    def __init__(self, reason: str):
        super().__init__(
            code=ErrorCode.AUDIO_QUALITY_TOO_LOW,
            message="Chất lượng âm thanh quá thấp hoặc bị nhiễu nặng.",
            reason=reason,
            suggestion="Vui lòng di chuyển đến không gian yên tĩnh và ghi âm lại gần micro hơn.",
            status_code=HTTP_422
        )


class EmptySpeechError(SpeechAssessmentException):
    """Ngoại lệ khi bộ phát hiện giọng nói (VAD) không tìm thấy tiếng người nói trong bản ghi (HTTP 422 - EMPTY_SPEECH)."""
    def __init__(self, reason: str = "Không phát hiện thấy tín hiệu giọng nói của người học trong audio."):
        super().__init__(
            code=ErrorCode.EMPTY_SPEECH,
            message="Không tìm thấy giọng nói trong bản ghi âm.",
            reason=reason,
            suggestion="Kiểm tra lại quyền truy cập microphone và đọc to hơn khi ghi âm.",
            status_code=HTTP_422
        )


class InvalidTranscriptError(SpeechAssessmentException):
    """Ngoại lệ khi câu mẫu tham chiếu (script) bị rỗng hoặc chứa ký tự không hợp lệ để tách âm vị (HTTP 422 - INVALID_SCRIPT)."""
    def __init__(self, reason: str = "Script tham chiếu rỗng hoặc chứa ký tự không hợp lệ."):
        super().__init__(
            code=ErrorCode.INVALID_SCRIPT,
            message="Câu mẫu tham chiếu không hợp lệ.",
            reason=reason,
            suggestion="Vui lòng cung cấp văn bản tiếng Anh hợp lệ để đánh giá.",
            status_code=HTTP_422
        )


class AlignmentError(SpeechAssessmentException):
    """Ngoại lệ khi bước căn chỉnh cưỡng bức giữa tín hiệu âm thanh và chuỗi âm vị mẫu thất bại (HTTP 422 - ALIGNMENT_FAILED)."""
    def __init__(self, reason: str = "Không thể căn chỉnh âm học giữa giọng nói và script mẫu."):
        super().__init__(
            code=ErrorCode.ALIGNMENT_FAILED,
            message="Không thể căn chỉnh âm thanh với script.",
            reason=reason,
            suggestion="Hãy đọc lại toàn bộ câu rõ ràng hơn theo đúng văn bản mẫu.",
            status_code=HTTP_422
        )


class LowAlignmentConfidenceError(SpeechAssessmentException):
    """Ngoại lệ khi độ tin cậy căn chỉnh giữa giọng nói và câu mẫu thấp dưới ngưỡng an toàn (HTTP 422 - ALIGNMENT_LOW_CONFIDENCE)."""
    def __init__(self, confidence: float, min_confidence: float, reason: Optional[str] = None):
        detail_reason = reason or f"Độ tin cậy căn chỉnh đạt {confidence:.2f}, dưới ngưỡng tin cậy {min_confidence:.2f}. Tín hiệu âm thanh không khớp với văn bản mẫu."
        super().__init__(
            code=ErrorCode.ALIGNMENT_LOW_CONFIDENCE,
            message="Độ tin cậy căn chỉnh âm thanh không đủ cao để chấm điểm chính xác.",
            reason=detail_reason,
            suggestion="Có thể bạn đã đọc sai từ hoặc nói không khớp với văn bản mẫu. Hãy thử ghi âm lại.",
            status_code=HTTP_422
        )


class AudioScriptMismatchError(SpeechAssessmentException):
    """Ngoại lệ khi nội dung phát âm trong audio hoàn toàn không khớp với câu mẫu yêu cầu (HTTP 422 - ALIGNMENT_LOW_CONFIDENCE)."""
    def __init__(self, reason: str = "Tín hiệu âm thanh không khớp với nội dung câu mẫu tham chiếu."):
        super().__init__(
            code=ErrorCode.ALIGNMENT_LOW_CONFIDENCE,
            message="Nội dung nói không khớp với câu mẫu tham chiếu.",
            reason=reason,
            suggestion="Vui lòng đọc to, rõ ràng và đúng theo toàn bộ nội dung của câu mẫu đã cho.",
            status_code=HTTP_422
        )



class ModelLoadError(SpeechAssessmentException):
    """Ngoại lệ khi không thể tải hoặc khởi tạo mô hình AI nhận dạng âm học trên máy chủ (HTTP 503 - MODEL_UNAVAILABLE)."""
    def __init__(self, model_name: str, detail: str = ""):
        super().__init__(
            code=ErrorCode.MODEL_UNAVAILABLE,
            message="Mô hình nhận dạng âm học hiện không khả dụng trên máy chủ.",
            reason=f"Lỗi nạp mô hình {model_name}: {detail}",
            suggestion="Vui lòng kiểm tra lại dịch vụ hoặc liên hệ quản trị viên hệ thống.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )


class UnsupportedLanguageError(SpeechAssessmentException):
    """Ngoại lệ khi văn bản cần đánh giá không phải tiếng Anh (ngoài phạm vi bộ âm vị hỗ trợ) (HTTP 422 - INVALID_SCRIPT)."""
    def __init__(self, lang: str = "non-English"):
        super().__init__(
            code=ErrorCode.INVALID_SCRIPT,
            message="Hệ thống hiện chỉ hỗ trợ đánh giá ngữ âm tiếng Anh.",
            reason=f"Ngôn ngữ {lang} không nằm trong bộ từ vựng âm vị hỗ trợ.",
            suggestion="Vui lòng chọn bài luyện tập tiếng Anh.",
            status_code=HTTP_422
        )
