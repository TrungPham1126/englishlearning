from typing import Optional

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

HTTP_422 = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422)

from app.schemas import ErrorCode, ErrorDetail


class SpeechAssessmentException(Exception):
    """
    Base Exception for Speech Assessment Microservice.
    Guarantees structured error payload without exposing internal stack traces to clients.
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
        super().__init__(message)
        self.code = code
        self.message = message
        self.reason = reason
        self.suggestion = suggestion
        self.status_code = status_code
        self.internal_error = internal_error

    def to_detail(self) -> ErrorDetail:
        return ErrorDetail(
            code=self.code,
            message=self.message,
            reason=self.reason,
            suggestion=self.suggestion
        )


class UnsupportedAudioError(SpeechAssessmentException):
    def __init__(self, reason: str = "Định dạng file âm thanh không được hỗ trợ."):
        super().__init__(
            code=ErrorCode.UNSUPPORTED_AUDIO_FORMAT,
            message="Định dạng âm thanh không hợp lệ.",
            reason=reason,
            suggestion="Vui lòng cung cấp file ghi âm định dạng .wav, .mp3 hoặc .m4a.",
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
        )


class AudioTooLargeError(SpeechAssessmentException):
    def __init__(self, size_mb: float, max_mb: float):
        super().__init__(
            code=ErrorCode.AUDIO_TOO_LARGE,
            message="File âm thanh vượt quá dung lượng cho phép.",
            reason=f"Dung lượng {size_mb:.1f}MB vượt giới hạn {max_mb:.1f}MB.",
            suggestion=f"Vui lòng nén hoặc giảm độ phân giải âm thanh dưới {max_mb:.0f}MB.",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        )


class AudioTooShortError(SpeechAssessmentException):
    def __init__(self, duration: float, min_duration: float):
        super().__init__(
            code=ErrorCode.AUDIO_TOO_SHORT,
            message="Đoạn ghi âm quá ngắn để phân tích âm học.",
            reason=f"Thời lượng {duration:.2f}s ngắn hơn ngưỡng tối thiểu {min_duration:.2f}s.",
            suggestion="Hãy đọc to và phát âm đầy đủ toàn bộ câu.",
            status_code=HTTP_422
        )


class AudioTooLongError(SpeechAssessmentException):
    def __init__(self, duration: float, max_duration: float):
        super().__init__(
            code=ErrorCode.AUDIO_TOO_LONG,
            message="Đoạn ghi âm quá dài cho một bài luyện nói câu.",
            reason=f"Thời lượng {duration:.1f}s vượt quá thời gian tối đa {max_duration:.1f}s.",
            suggestion="Vui lòng chỉ đọc đúng câu được yêu cầu trong thời gian quy định.",
            status_code=HTTP_422
        )


class AudioQualityTooLowError(SpeechAssessmentException):
    def __init__(self, reason: str):
        super().__init__(
            code=ErrorCode.AUDIO_QUALITY_TOO_LOW,
            message="Chất lượng âm thanh quá thấp hoặc bị nhiễu nặng.",
            reason=reason,
            suggestion="Vui lòng di chuyển đến không gian yên tĩnh và ghi âm lại gần micro hơn.",
            status_code=HTTP_422
        )


class EmptySpeechError(SpeechAssessmentException):
    def __init__(self, reason: str = "Không phát hiện thấy tín hiệu giọng nói của người học trong audio."):
        super().__init__(
            code=ErrorCode.EMPTY_SPEECH,
            message="Không tìm thấy giọng nói trong bản ghi âm.",
            reason=reason,
            suggestion="Kiểm tra lại quyền truy cập microphone và đọc to hơn khi ghi âm.",
            status_code=HTTP_422
        )


class InvalidTranscriptError(SpeechAssessmentException):
    def __init__(self, reason: str = "Script tham chiếu rỗng hoặc chứa ký tự không hợp lệ."):
        super().__init__(
            code=ErrorCode.INVALID_SCRIPT,
            message="Câu mẫu tham chiếu không hợp lệ.",
            reason=reason,
            suggestion="Vui lòng cung cấp văn bản tiếng Anh hợp lệ để đánh giá.",
            status_code=HTTP_422
        )


class AlignmentError(SpeechAssessmentException):
    def __init__(self, reason: str = "Không thể căn chỉnh âm học giữa giọng nói và script mẫu."):
        super().__init__(
            code=ErrorCode.ALIGNMENT_FAILED,
            message="Không thể căn chỉnh âm thanh với script.",
            reason=reason,
            suggestion="Hãy đọc lại toàn bộ câu rõ ràng hơn theo đúng văn bản mẫu.",
            status_code=HTTP_422
        )


class LowAlignmentConfidenceError(SpeechAssessmentException):
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
    def __init__(self, reason: str = "Tín hiệu âm thanh không khớp với nội dung câu mẫu tham chiếu."):
        super().__init__(
            code=ErrorCode.ALIGNMENT_LOW_CONFIDENCE,
            message="Nội dung nói không khớp với câu mẫu tham chiếu.",
            reason=reason,
            suggestion="Vui lòng đọc to, rõ ràng và đúng theo toàn bộ nội dung của câu mẫu đã cho.",
            status_code=HTTP_422
        )



class ModelLoadError(SpeechAssessmentException):
    def __init__(self, model_name: str, detail: str = ""):
        super().__init__(
            code=ErrorCode.MODEL_UNAVAILABLE,
            message="Mô hình nhận dạng âm học hiện không khả dụng trên máy chủ.",
            reason=f"Lỗi nạp mô hình {model_name}: {detail}",
            suggestion="Vui lòng kiểm tra lại dịch vụ hoặc liên hệ quản trị viên hệ thống.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )


class UnsupportedLanguageError(SpeechAssessmentException):
    def __init__(self, lang: str = "non-English"):
        super().__init__(
            code=ErrorCode.INVALID_SCRIPT,
            message="Hệ thống hiện chỉ hỗ trợ đánh giá ngữ âm tiếng Anh.",
            reason=f"Ngôn ngữ {lang} không nằm trong bộ từ vựng âm vị hỗ trợ.",
            suggestion="Vui lòng chọn bài luyện tập tiếng Anh.",
            status_code=HTTP_422
        )
