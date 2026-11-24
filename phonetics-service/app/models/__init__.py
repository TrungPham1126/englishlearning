"""Gói chứa các mô hình dữ liệu nội bộ (domain models) phục vụ căn chỉnh âm thanh, tách đoạn tiếng nói và ghi nhận quãng ngắt."""
from app.models.alignment import (
    AlignedWord,
    AlignedPhoneme,
    SpeechSegment,
    PauseEvent,
    AlignmentResult,
)

# Danh sách các lớp dữ liệu được xuất công khai khi import từ gói `app.models`
__all__ = [
    "AlignedWord",
    "AlignedPhoneme",
    "SpeechSegment",
    "PauseEvent",
    "AlignmentResult",
]
