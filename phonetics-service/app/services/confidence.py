"""
Module ước lượng độ tin cậy cho toàn bộ quy trình chấm điểm phát âm.

Giúp đánh giá mức độ đáng tin cậy của tín hiệu thu âm, từng âm vị, từng từ và toàn bài nói,
từ đó quyết định trạng thái đánh giá cuối cùng để tránh đưa ra điểm số hoặc nhận xét sai lệch
khi bản ghi âm bị ồn, rè tiếng hoặc mô hình căn chỉnh không chắc chắn.
"""

from typing import List, Optional
import numpy as np

from app.config import settings
from app.models.alignment import AlignedWord, AlignedPhoneme
from app.schemas import AudioQualityMetrics, EvaluationStatus


class ConfidenceEstimator:
    """
    Bộ ước lượng độ tin cậy (Confidence Estimator) qua 3 cấp độ:
    1. Độ tin cậy của chất lượng âm thanh đầu vào (dựa trên độ ồn SNR, vỡ tiếng, dải động)
    2. Độ tin cậy của từng âm vị (dựa trên xác suất mô hình, thời lượng và đặc trưng cộng hưởng)
    3. Độ tin cậy tổng thể và phân loại trạng thái đánh giá cuối cùng (`EvaluationStatus`)
    """

    # Tập hợp các âm bật (thời lượng phát âm vốn rất ngắn nên dùng ngưỡng thời lượng chuẩn nhỏ hơn các âm khác)
    PLOSIVES = {"p", "t", "k", "b", "d", "g", "\u0261", "\u027e"}

    def __init__(
        self,
        min_alignment_conf: float = settings.MIN_ALIGNMENT_CONFIDENCE,
        min_audio_conf: float = settings.MIN_AUDIO_CONFIDENCE
    ):
        """Khởi tạo các ngưỡng tin cậy tối thiểu cho bước căn chỉnh (alignment) và tín hiệu âm thanh."""
        self.min_alignment_conf = min_alignment_conf
        self.min_audio_conf = min_audio_conf

    def estimate_audio_confidence(self, quality: AudioQualityMetrics) -> float:
        """
        Ước lượng điểm tin cậy của tín hiệu âm thanh (từ 0.0 đến 1.0) dựa trên chất lượng thu âm:
        - Nếu cổng chất lượng từ chối bản thu -> chốt mức tin cậy thấp (0.30).
        - Kết hợp trọng số: tỷ lệ tín hiệu/nhiễu SNR (50%), mức độ không vỡ tiếng (30%), dải động (20%).
        - Giảm nhẹ độ tin cậy (nhân 0.85) nếu bản thu có quá nhiều khoảng im lặng (> 70%).
        """
        if not quality.is_acceptable:
            return 0.30

        # Chuẩn hóa từng thành phần chất lượng âm thanh về thang [0.1..1.0]
        snr_factor = float(np.clip((quality.estimated_snr - 6.0) / 18.0, 0.2, 1.0))
        clip_factor = float(np.clip(1.0 - quality.clipping_ratio * 15.0, 0.1, 1.0))
        dyn_factor = float(np.clip(quality.dynamic_range / 25.0, 0.4, 1.0))
        silence_penalty = 0.85 if quality.silence_ratio > 0.70 else 1.0

        audio_conf = snr_factor * 0.50 + clip_factor * 0.30 + dyn_factor * 0.20
        return float(np.clip(audio_conf * silence_penalty, 0.1, 1.0))

    def estimate_phoneme_confidence(
        self,
        phoneme: AlignedPhoneme,
        measured_f1: Optional[float] = None,
        status: str = "OK"
    ) -> float:
        """
        Ước lượng độ tin cậy cho từng âm vị đơn lẻ (từ 0.30 đến 1.0).
        Kết hợp xác suất hậu nghiệm từ mô hình căn chỉnh, độ dài phát âm thực tế
        và kết quả đo cộng hưởng âm học (như tần số formant F1 đối với nguyên âm).
        """
        base_posterior = phoneme.posterior
        clean_sym = phoneme.symbol.strip("/ ")

        # Âm bật có thời lượng chuẩn ngắn (~18ms) hơn các âm vị khác (~45ms)
        target_dur = 0.018 if clean_sym in self.PLOSIVES else 0.045
        dur_factor = float(np.clip(phoneme.duration / target_dur, 0.75, 1.0))

        if phoneme.phoneme_type == "vowel":
            # Với nguyên âm: kiểm tra thêm xem có đo được tần số cộng hưởng F1 hợp lệ hay không
            if status != "OK" or measured_f1 is None:
                acoustic_conf = 0.50
            else:
                acoustic_conf = 0.95
            phoneme_conf = base_posterior * 0.45 + dur_factor * 0.25 + acoustic_conf * 0.30
        else:
            # Với phụ âm: kết hợp xác suất từ mô hình (70%) và hệ số thời lượng (30%)
            phoneme_conf = base_posterior * 0.70 + dur_factor * 0.30

        return float(np.clip(phoneme_conf, 0.30, 1.0))

    def estimate_overall_confidence(
        self,
        audio_conf: float,
        alignment_conf: float,
        words: List[AlignedWord]
    ) -> float:
        """
        Tính độ tin cậy tổng thể của cả lượt chấm điểm phát âm (từ 0.0 đến 1.0).
        Nhân độ tin cậy chất lượng âm thanh với độ tin cậy nội bộ của mô hình căn chỉnh,
        đồng thời chặn trần để kết quả tổng thể không vượt quá độ tin cậy căn chỉnh + 0.05.
        """
        all_phoneme_confs = []
        all_word_confs = []

        # Gom độ tin cậy của từng từ và từng âm vị (chặn trên theo mức tin cậy căn chỉnh chung)
        for w in words:
            w_conf = min(w.confidence, alignment_conf + 0.15)
            all_word_confs.append(w_conf)
            for p in w.phonemes:
                p_conf = min(p.confidence, alignment_conf + 0.15)
                all_phoneme_confs.append(p_conf)

        mean_ph_conf = float(np.mean(all_phoneme_confs)) if all_phoneme_confs else alignment_conf
        mean_w_conf = float(np.mean(all_word_confs)) if all_word_confs else alignment_conf

        # Tổng hợp độ tin cậy nội bộ từ: căn chỉnh câu (50%), trung bình âm vị (30%) và trung bình từ (20%)
        internal_reliability = (
            0.50 * alignment_conf +
            0.30 * mean_ph_conf +
            0.20 * mean_w_conf
        )

        raw_overall = audio_conf * internal_reliability
        overall = min(raw_overall, alignment_conf + 0.05)
        return float(np.clip(overall, 0.0, 1.0))

    def determine_evaluation_status(
        self,
        overall_conf: float,
        alignment_conf: float,
        audio_quality: AudioQualityMetrics
    ) -> EvaluationStatus:
        """
        Quyết định trạng thái đánh giá cuối cùng (`EvaluationStatus`) dựa trên chất lượng thu âm và các ngưỡng tin cậy:
        - AUDIO_QUALITY_TOO_LOW: Âm thanh quá ồn hoặc bị vỡ tiếng, không đạt chuẩn tối thiểu.
        - ALIGNMENT_FAILED: Không khớp được giọng nói với văn bản mẫu (độ tin cậy căn chỉnh quá thấp).
        - LOW_CONFIDENCE: Độ tin cậy thấp, chỉ mang tính tham khảo.
        - PARTIAL_EVALUATION: Đánh giá đạt mức tương đối, một số phần có thể chưa thật sự chắc chắn.
        - SUCCESS: Đủ độ tin cậy cao để chấm điểm đầy đủ và chính xác.
        """
        if not audio_quality.is_acceptable:
            return EvaluationStatus.AUDIO_QUALITY_TOO_LOW

        if alignment_conf < self.min_alignment_conf:
            return EvaluationStatus.ALIGNMENT_FAILED

        if alignment_conf < 0.45 or overall_conf < 0.40:
            return EvaluationStatus.LOW_CONFIDENCE

        if alignment_conf < 0.60 or overall_conf < 0.55:
            return EvaluationStatus.PARTIAL_EVALUATION

        return EvaluationStatus.SUCCESS


# Thể hiện dùng chung duy nhất (singleton) của bộ ước lượng độ tin cậy
confidence_estimator = ConfidenceEstimator()