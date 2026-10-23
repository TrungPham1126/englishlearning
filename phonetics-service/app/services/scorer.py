from typing import List, Tuple, Optional
import numpy as np

from app.config import settings
from app.models.alignment import AlignedWord, AlignedPhoneme, PauseEvent
from app.schemas import PhonemeSchema, WordSchema, PhonemeType, MeasurementStatus


class ScoringCalibrator:
    def __init__(self, mode: str = "identity"):
        self.mode = mode

    def calibrate(self, raw_score: float) -> float:
        return round(raw_score, 1)


class Scorer:
    """
    Hierarchical Scoring Engine with Formant Floor Protection & Fast-Speech Adaptation:
    - Bảo vệ điểm nguyên âm bằng Formant Floor (không bị CTC làm tụt điểm khi khẩu hình đã chuẩn).
    - Hỗ trợ phụ âm tắc-xát (tʃ, dʒ) và âm xát (h) trong phát âm nhanh (>= 4.5 syl/s).
    """

    PLOSIVES = {"p", "t", "k", "b", "d", "g", "ɡ"}
    AFFRICATES_AND_GLIDES = {"tʃ", "dʒ", "ts", "dz", "h", "j", "w"}

    def __init__(
        self,
        pron_weight: float = settings.PRONUNCIATION_WEIGHT,
        fluency_weight: float = settings.FLUENCY_WEIGHT,
        speed_weight: float = settings.SPEED_WEIGHT,
        speed_target_min: float = settings.SPEED_TARGET_MIN,
        speed_target_max: float = settings.SPEED_TARGET_MAX
    ):
        self.pron_weight = pron_weight
        self.fluency_weight = fluency_weight
        self.speed_weight = speed_weight
        self.speed_target_min = speed_target_min
        self.speed_target_max = speed_target_max
        self.calibrator = ScoringCalibrator()

    def score_vowel(
        self,
        formant_score: Optional[float],
        acoustic_confidence: float,
        alignment_confidence: float,
        posterior: float = 0.5,
        symbol: Optional[str] = None
    ) -> float:
        safe_post = max(1e-6, min(1.0, posterior))
        if safe_post < 0.02:
            if formant_score is not None and formant_score >= 60.0:
                return float(formant_score * 0.75)
            return 0.0

        log_post = float(np.log(safe_post))
        raw_gop = float(np.clip(100.0 * (1.0 + log_post / 5.5), 0.0, 98.0))

        if formant_score is not None:
            safe_formant = float(np.clip(formant_score, 0.0, 100.0))
            # Vowel score blends GOP and Formant F1/F2 distance
            vowel_score = (
                raw_gop * 0.45 +
                safe_formant * 0.50 +
                (alignment_confidence * 100.0) * 0.05
            )
            # Nếu Formant F1/F2 bị lệch nhiều (< 65 điểm), trừ trực tiếp và khống chế trần
            if safe_formant < 65.0:
                vowel_score = min(vowel_score, safe_formant * 1.25)
        else:
            vowel_score = raw_gop * 0.90 + (alignment_confidence * 100.0) * 0.10

        return float(np.clip(vowel_score, 0.0, 100.0))

    def score_consonant_gop(
        self,
        posterior: float,
        duration: float,
        alignment_confidence: float,
        symbol: Optional[str] = None,
        is_word_final: bool = False,
        is_coda_r: bool = False,
        acoustic_multiplier: float = 1.0
    ) -> float:
        if acoustic_multiplier <= 0.0:
            return 0.0

        clean_sym = symbol.strip("/ ") if symbol else ""

        # Non-rhotic Coda R trong giọng Anh (dark, car)
        if (clean_sym in ("r", "ɹ") or is_coda_r) and alignment_confidence >= 0.50:
            return 85.0

        safe_post = max(1e-6, min(1.0, posterior))
        if safe_post < 0.02:
            return 0.0

        log_post = float(np.log(safe_post))

        is_plosive = clean_sym in self.PLOSIVES
        is_short_cons = is_plosive or (clean_sym in self.AFFRICATES_AND_GLIDES) or is_word_final

        # Chuẩn GOP cho CTC posterior: không gán sàn điểm ảo
        gop_scale = 5.8 if is_plosive else 5.2
        raw_gop_score = float(np.clip(100.0 * (1.0 + log_post / gop_scale), 0.0, 98.0))

        min_dur = 0.018 if is_short_cons else 0.035
        dur_factor = min(1.0, duration / min_dur) if duration < min_dur else 1.0

        base_score = (
            raw_gop_score * 0.90 +
            (alignment_confidence * 100.0) * 0.10
        ) * dur_factor

        consonant_score = base_score * acoustic_multiplier
        return float(np.clip(consonant_score, 0.0, 100.0))

    def score_word(
        self,
        phoneme_schemas: List[PhonemeSchema],
        aligned_phonemes: List[AlignedPhoneme],
        is_oov: bool = False
    ) -> float:
        """
        Cơ chế VOWEL NUCLEUS GATE theo chuẩn ngữ âm quốc tế:
        1. Trọng số: Nguyên âm 0.65, Phụ âm 0.35.
        2. Hard Cap: Nếu nguyên âm chính < 35 điểm, word.score <= min(35, vowel_score * 1.8).
        3. Từ ngắn 2 âm vị nếu mất âm đuôi, word.score <= 35.
        4. OOV Proper Noun Tolerance cho tên riêng nước ngoài.
        """
        if not phoneme_schemas:
            return 0.0

        vowels = []
        consonants = []
        for p_schema, p_aligned in zip(phoneme_schemas, aligned_phonemes):
            if p_schema.type == PhonemeType.VOWEL:
                vowels.append((p_schema, p_aligned))
            else:
                consonants.append((p_schema, p_aligned))

        v_weight_total = 0.65 if (vowels and consonants) else (1.0 if vowels else 0.0)
        c_weight_total = 0.35 if (vowels and consonants) else (1.0 if consonants else 0.0)

        weights = []
        scores = []

        if vowels:
            per_v_weight = v_weight_total / len(vowels)
            for p_schema, p_aligned in vowels:
                w = per_v_weight * (1.2 if p_aligned.is_stress else 1.0)
                weights.append(w)
                scores.append(p_schema.score)

        if consonants:
            per_c_weight = c_weight_total / len(consonants)
            for p_schema, p_aligned in consonants:
                w = per_c_weight * (1.2 if p_aligned.is_word_final else 1.0)
                weights.append(w)
                scores.append(p_schema.score)

        weighted_mean = float(np.sum(np.array(scores) * np.array(weights)) / max(1e-6, np.sum(weights)))

        # VOWEL NUCLEUS GATE:
        # Đối với từ đơn ngắn (<= 3 âm vị): Nguyên âm là hạt nhân duy nhất, nếu hỏng (< 35) thì từ hỏng.
        # Đối với từ đa âm tiết: Chỉ phạt trần nếu NGUYÊN ÂM TRỌNG ÂM CHÍNH (stressed vowel) bị hỏng nặng.
        if vowels:
            if len(phoneme_schemas) <= 3:
                min_vowel_score = min(p_s.score for p_s, _ in vowels)
                if min_vowel_score < 35.0:
                    hard_cap = min(35.0, min_vowel_score * 1.8)
                    weighted_mean = min(weighted_mean, hard_cap)
            else:
                stressed_vowels = [p_s.score for p_s, p_a in vowels if p_a.is_stress]
                vowel_avg = float(np.mean([p_s.score for p_s, _ in vowels]))
                if stressed_vowels:
                    min_stressed = min(stressed_vowels)
                    if min_stressed < 35.0:
                        hard_cap = max(35.0, min_stressed * 1.5)
                        weighted_mean = min(weighted_mean, hard_cap)
                elif vowel_avg < 35.0:
                    weighted_mean = min(weighted_mean, 35.0)

        # Ràng buộc từ ngắn 2 âm vị (ví dụ "is", "it", "at") nếu mất âm cuối (/z/ = 0)
        if len(phoneme_schemas) <= 2:
            for p_schema, p_aligned in consonants:
                if p_aligned.is_word_final and (p_schema.score < 20.0 or p_schema.status == MeasurementStatus.INSUFFICIENT_EVIDENCE):
                    weighted_mean = min(weighted_mean, 35.0)

        # OOV / Tên riêng tiếng Việt: nới lỏng ngưỡng phạt
        if is_oov:
            weighted_mean = max(weighted_mean, min(70.0, 48.0 + (weighted_mean * 0.35)))

        return float(np.clip(weighted_mean, 0.0, 100.0))

    def calculate_wpm(self, word_count: int, total_speech_duration: float) -> int:
        """
        Đo WPM chuẩn De Jong & Wempe: tính trên tổng thời gian nói (đã cắt khoảng lặng đầu/cuối).
        """
        if total_speech_duration <= 0.2 or word_count <= 0:
            return 120
        return int(round((word_count / total_speech_duration) * 60.0))

    def calculate_fluency_score(
        self,
        pause_events: List[PauseEvent],
        awkward_pause_count: int,
        pause_ratio: float,
        wpm: float,
        speech_ratio: float
    ) -> float:
        """
        Đo Fluency chuẩn:
        - Phạt nặng khi đọc ngắt từng chữ (pause_ratio > 0.4 kéo điểm xuống 35-50).
        """
        # Đánh giá tốc độ WPM (chuẩn 110 - 165 WPM)
        if 110.0 <= wpm <= 165.0:
            speed_factor = 95.0
        elif wpm < 110.0:
            deficit = 110.0 - wpm
            speed_factor = max(25.0, 95.0 - (deficit / 110.0) * 55.0)
        else:
            excess = wpm - 165.0
            speed_factor = max(40.0, 95.0 - (excess / 60.0) * 35.0)

        # Phạt ngắt nghỉ (Pause Penalty)
        if pause_ratio > 0.40:
            # Ngắt quãng bất thường giữa hầu hết các từ
            penalty = awkward_pause_count * 15.0
            fluency = float(np.clip(speed_factor * 0.4 + 40.0 - penalty, 25.0, 50.0))
        elif pause_ratio > 0.20:
            penalty = awkward_pause_count * 8.0
            fluency = float(np.clip(speed_factor * 0.7 + 30.0 - penalty, 45.0, 72.0))
        else:
            total_penalty = sum(p.penalty for p in pause_events)
            fluency = float(np.clip(speed_factor * 0.6 + (100.0 - total_penalty) * 0.4, 60.0, 98.0))

        return float(np.clip(fluency, 20.0, 98.0))

    def calculate_completeness_score(
        self,
        spoken_count: int,
        total_expected: int,
        partial_count: int = 0
    ) -> int:
        """
        Completeness = (số từ thực sự được đọc / tổng số từ trong câu mẫu) x 100.
        Tính theo toàn bộ câu mẫu, không theo số từ nhận diện được.
        """
        if total_expected <= 0:
            return 100
        effective_spoken = spoken_count + 0.35 * partial_count
        completeness = int(round((effective_spoken / float(total_expected)) * 100.0))
        return int(np.clip(completeness, 0, 100))

    def calculate_prosody_score(
        self,
        f0_std: float,
        fluency_score: float,
        pronunciation_score: float,
        linking_ratio: float = 0.0
    ) -> float:
        """
        Đo Prosody kết hợp: biến thiên cao độ F0 (tránh giọng đọc đều đều monotone)
        + nhịp điệu nối âm + ràng buộc trần logic theo phát âm và lưu loát.
        """
        if f0_std < 14.0:
            pitch_score = 40.0 + f0_std * 1.5
        elif 20.0 <= f0_std <= 50.0:
            pitch_score = 88.0 + min(10.0, (f0_std - 20.0) * 0.3)
        else:
            pitch_score = 72.0

        raw_prosody = (
            pitch_score * 0.40 +
            fluency_score * 0.35 +
            pronunciation_score * 0.25 +
            linking_ratio * 10.0
        )

        # Ràng buộc trần logic: Prosody không thể đạt 93 khi pronunciation=58 và fluency=40
        prosody_cap = round((pronunciation_score * 0.5 + fluency_score * 0.5) + 15.0)
        final_prosody = min(raw_prosody, prosody_cap)
        return float(np.clip(final_prosody, 20.0, 98.0))

    def calculate_overall_score(
        self,
        pronunciation: float,
        fluency: float,
        prosody: float,
        completeness: float = 100.0
    ) -> float:
        raw_overall = (
            self.pron_weight * pronunciation +
            self.fluency_weight * fluency +
            self.speed_weight * prosody
        )
        # Điểm tổng (overall) bị kéo xuống theo Completeness nếu thí sinh đọc thiếu/bỏ dở câu
        if completeness < 95.0:
            comp_ratio = max(0.0, min(1.0, completeness / 100.0))
            raw_overall = raw_overall * comp_ratio

        calibrated = self.calibrator.calibrate(raw_overall)
        return float(np.clip(calibrated, 0.0, 100.0))


def generate_phoneme_pedagogical_feedback(
    symbol: str,
    score: float,
    phoneme_type: str,
    acoustic_detail: Optional[str] = None,
    formant_feedback: Optional[str] = None,
    is_word_final: bool = False,
    is_missing: bool = False
) -> str:
    """
    Tạo nhận xét sư phạm nhất quán 100% với mức điểm âm vị.
    Không bao giờ xảy ra mâu thuẫn điểm thấp nhưng khen đạt chuẩn.
    """
    clean_sym = symbol.strip("/ ")
    if is_missing or score <= 0.0:
        if is_word_final and acoustic_detail and "nuốt" in acoustic_detail:
            return f"Bạn đã nuốt hoặc quên phát âm âm đuôi /{clean_sym}/ ở cuối từ."
        if is_missing:
            return "Bạn chưa đọc từ này."
        return f"Chưa phát hiện âm /{clean_sym}/ (âm bị thiếu hoặc quá nhỏ)."

    if score >= 80.0:
        if phoneme_type == "vowel":
            return "Khẩu hình và vị trí đặt lưỡi chuẩn xác!"
        return "Phát âm rõ ràng, chuẩn xác."

    elif score >= 60.0:
        if phoneme_type == "vowel" and formant_feedback and "chuẩn xác" not in formant_feedback.lower():
            return formant_feedback
        return "Phát âm tương đối tốt, cần tròn vành rõ chữ hơn."

    elif score >= 30.0:
        if phoneme_type == "vowel" and formant_feedback and "chuẩn xác" not in formant_feedback.lower():
            return formant_feedback
        if acoustic_detail and "thiếu" in acoustic_detail.lower():
            return f"Âm /{clean_sym}/ chưa đạt: {acoustic_detail}."
        return f"Phát âm âm /{clean_sym}/ chưa chuẩn xác, cần chú ý khẩu hình."

    else:  # score < 30.0
        if is_word_final and ((acoustic_detail and "nuốt" in acoustic_detail) or score < 15.0):
            return f"Bạn đã nuốt hoặc quên phát âm âm đuôi /{clean_sym}/ ở cuối từ."
        if acoustic_detail and ("thiếu" in acoustic_detail.lower() or "quá nhỏ" in acoustic_detail.lower()):
            return f"Âm /{clean_sym}/ thiếu bằng chứng âm học: {acoustic_detail}."
        return f"Phát âm sai lệch hoặc phát âm chưa rõ âm /{clean_sym}/."


scorer = Scorer()