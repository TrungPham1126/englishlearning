from typing import List
from app.models.alignment import PauseEvent
from app.schemas import FluencyFeedbackItem, FeedbackSeverity, WordSchema


class FeedbackGenerator:
    """
    Feedback Engine for Speech Assessment.
    Generates actionable, evidence-based feedback on:
    - Vowel formant & jaw/tongue positioning
    - Pauses, hesitations, and rhythm
    - Speaking rate & pacing
    Suppresses absolute judgments if confidence is low.
    """

    def generate_fluency_feedback(
        self,
        pause_events: List[PauseEvent],
        articulation_rate: float,
        speed_target_min: float,
        speed_target_max: float,
        confidence: float
    ) -> List[FluencyFeedbackItem]:
        """Generates structured fluency feedback items."""
        feedback_items: List[FluencyFeedbackItem] = []

        if confidence < 0.40:
            feedback_items.append(
                FluencyFeedbackItem(
                    type="audio_quality",
                    severity=FeedbackSeverity.INFO,
                    message="Bản ghi âm có độ tin cậy thấp. Vui lòng ghi âm lại ở nơi yên tĩnh để nhận nhận xét chi tiết hơn."
                )
            )
            return feedback_items

        # 1. Articulation Rate Feedback
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

        # 2. Pause & Hesitation Feedback
        long_pauses = [p for p in pause_events if p.pause_type == "long_pause"]
        hesitations = [p for p in pause_events if p.pause_type == "hesitation"]

        if long_pauses:
            for p in long_pauses[:2]:  # Limit to top 2 long pauses
                feedback_items.append(
                    FluencyFeedbackItem(
                        type="long_pause",
                        severity=FeedbackSeverity.MAJOR,
                        message=f"Khoảng ngắt nghỉ kéo dài bất thường ({p.duration:.1f} giây) tại thời điểm {p.start:.1f}s làm gián đoạn mạch câu.",
                        timestamp=p.start
                    )
                )

        if len(hesitations) >= 3:
            feedback_items.append(
                FluencyFeedbackItem(
                    type="hesitation",
                    severity=FeedbackSeverity.MODERATE,
                    message=f"Có {len(hesitations)} khoảng dừng ngập ngừng giữa các từ. Hãy luyện tập đọc liền mạch các cụm từ (thought groups)."
                )
            )

        return feedback_items


# Singleton feedback generator
feedback_generator = FeedbackGenerator()
