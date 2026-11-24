"""
Module tổng hợp nhận xét và gợi ý cải thiện độ trôi chảy khi nói.

Chuyển đổi các số liệu đo đạc kỹ thuật (tốc độ phát âm, các khoảng ngắt nghỉ dài, số lần ngập ngừng,
độ tin cậy của bản ghi) thành các nhận xét ngắn gọn, mang tính xây dựng và dễ hiểu cho người học.
"""

from typing import List
from app.models.alignment import PauseEvent
from app.schemas import FluencyFeedbackItem, FeedbackSeverity, WordSchema


class FeedbackGenerator:
    """
    Bộ máy tạo nhận xét cho hệ thống đánh giá phát âm.
    Sinh ra các phản hồi cụ thể, dựa trên bằng chứng đo đạc về:
    - Tốc độ phát âm và nhịp điệu đọc (Speaking rate & pacing)
    - Các khoảng ngắt nghỉ dài, sự ngập ngừng và độ liền mạch của câu
    Tự động hạn chế đưa ra phán xét khắt khe nếu độ tin cậy của bản thu âm quá thấp.
    """

    def generate_fluency_feedback(
        self,
        pause_events: List[PauseEvent],
        articulation_rate: float,
        speed_target_min: float,
        speed_target_max: float,
        confidence: float
    ) -> List[FluencyFeedbackItem]:
        """Tổng hợp danh sách các nhận xét có cấu trúc về độ trôi chảy (tốc độ nói, ngắt nghỉ dài và ngập ngừng)."""
        feedback_items: List[FluencyFeedbackItem] = []

        # Nếu độ tin cậy quá thấp (< 0.40), tránh chấm xét sai mà khuyên người dùng thu âm lại ở môi trường yên tĩnh
        if confidence < 0.40:
            feedback_items.append(
                FluencyFeedbackItem(
                    type="audio_quality",
                    severity=FeedbackSeverity.INFO,
                    message="Bản ghi âm có độ tin cậy thấp. Vui lòng ghi âm lại ở nơi yên tĩnh để nhận nhận xét chi tiết hơn."
                )
            )
            return feedback_items

        # 1. Nhận xét về tốc độ phát âm (số âm tiết mỗi giây) so với vùng tốc độ tự nhiên mục tiêu
        if articulation_rate < speed_target_min - 0.8:
            feedback_items.append(
                FluencyFeedbackItem(
                    type="speaking_rate",
                    severity=FeedbackSeverity.MODERATE,
                    message=f"Tốc độ phát âm hơi chậm ({articulation_rate:.1f} âm tiết/giây). Hãy thử tăng nhịp điệu nói tự nhiên hơn."
                )
            )
        elif articulation_rate > speed_target_max + 1.0:
            feedback_items.append(
                FluencyFeedbackItem(
                    type="speaking_rate",
                    severity=FeedbackSeverity.MINOR,
                    message=f"Tốc độ phát âm hơi vội ({articulation_rate:.1f} âm tiết/giây). Hãy đọc thư thái và giữ tròn vành rõ chữ."
                )
            )
        else:
            feedback_items.append(
                FluencyFeedbackItem(
                    type="speaking_rate",
                    severity=FeedbackSeverity.INFO,
                    message=f"Tốc độ phát âm rất tốt và tự nhiên ({articulation_rate:.1f} âm tiết/giây)."
                )
            )

        # 2. Nhận xét về các khoảng ngắt nghỉ bất thường và tình trạng ngập ngừng giữa câu
        long_pauses = [p for p in pause_events if p.pause_type == "long_pause"]
        hesitations = [p for p in pause_events if p.pause_type == "hesitation"]

        if long_pauses:
            # Giới hạn chỉ báo tối đa 2 khoảng ngắt dài nhất để người học dễ tập trung sửa lỗi
            for p in long_pauses[:2]:
                feedback_items.append(
                    FluencyFeedbackItem(
                        type="long_pause",
                        severity=FeedbackSeverity.MAJOR,
                        message=f"Khoảng ngắt nghỉ kéo dài bất thường ({p.duration:.1f} giây) tại thời điểm {p.start:.1f}s làm gián đoạn mạch câu.",
                        timestamp=p.start
                    )
                )

        # Nếu ngập ngừng từ 3 lần trở lên, nhắc người học luyện đọc liền mạch theo từng cụm ý (thought groups)
        if len(hesitations) >= 3:
            feedback_items.append(
                FluencyFeedbackItem(
                    type="hesitation",
                    severity=FeedbackSeverity.MODERATE,
                    message=f"Có {len(hesitations)} khoảng dừng ngập ngừng giữa các từ. Hãy luyện tập đọc liền mạch các cụm từ (thought groups)."
                )
            )

        return feedback_items


# Thể hiện dùng chung duy nhất (singleton) của bộ sinh nhận xét
feedback_generator = FeedbackGenerator()
