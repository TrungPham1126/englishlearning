"""
Module tính điểm phát âm phân tầng và hiệu chuẩn thực nghiệm (`scorer.py`).

Nhiệm vụ chính:
1. Nạp và suy luận bộ hiệu chuẩn hồi quy Ridge + nội suy đơn điệu từng đoạn từ `reference_profiles/calibration.json`
   (`ScoringCalibrator`), giúp ánh xạ điểm thô sát với thang chấm của chuyên gia trên bộ dữ liệu SpeechOcean762.
2. Trích xuất tập đặc trưng âm học cấp độ câu (`extract_utterance_acoustic_features`) dùng chung giữa chấm trực tuyến và hiệu chuẩn offline.
3. Chấm điểm chi tiết từng thành phần (`Scorer`): nguyên âm, phụ âm (GOP & GOP margin), từng từ, tốc độ nói, độ trôi chảy,
   ngữ điệu (prosody), độ hoàn thiện câu và điểm tổng kết.
4. Sinh nhận xét sư phạm tiếng Việt nhất quán 100% với mức điểm (`generate_phoneme_pedagogical_feedback`).
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import numpy as np

from app.config import settings
from app.models.alignment import AlignedPhoneme, AlignedWord, PauseEvent
from app.schemas import MeasurementStatus, PhonemeSchema, PhonemeType, SpokenWordStatus, WordSchema

logger = logging.getLogger("phonetics-service")


class ScoringCalibrator:
    """
    Nạp và áp dụng bộ tham số hiệu chuẩn thực nghiệm (Ridge chuẩn hóa kết hợp nội suy đơn điệu từng đoạn)
    từ file `reference_profiles/calibration.json` (được huấn luyện trên SpeechOcean762).
    Tự động chuyển sang chế độ đồng nhất ('identity') nếu không tìm thấy file cấu hình hoặc khi chạy unit test tối giản.
    """

    def __init__(
        self,
        mode: str = "calibrated",
        calibration_path: Path = settings.CALIBRATION_PROFILE_PATH,
    ):
        """Khởi tạo bộ hiệu chuẩn và tự động nạp `calibration.json` nếu `mode != 'identity'`."""
        self.mode = mode
        self.calibration_path = calibration_path
        self.models: Dict[str, dict] = {}
        self.thresholds: Dict[str, float] = {}
        if mode != "identity":
            self._load(calibration_path)

    def _resolve_path(self, path: Path) -> Path:
        """Tìm đường dẫn file calibration (ưu tiên đường dẫn trực tiếp, fallback về thư mục gốc phonetics-service)."""
        p = Path(path)
        if not p.is_absolute() and not p.exists():
            pkg_root = Path(__file__).resolve().parents[2]
            candidate = pkg_root / p
            if candidate.exists():
                return candidate
        return p

    def _load(self, path: Path) -> None:
        """
        Đọc file JSON đã train (`reference_profiles/calibration.json`) chứa các mô hình con
        (`pronunciation`, `fluency`, `prosody`, `overall`) và các ngưỡng đạt (`thresholds`).
        Nếu file không tồn tại hoặc lỗi đọc, chuyển an toàn về chế độ `identity`.
        """
        resolved = self._resolve_path(path)
        if not resolved.exists():
            self.mode = "identity"
            return
        try:
            with open(resolved, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Đọc từ điển các mô hình hồi quy (`models`) và các ngưỡng chuẩn (`thresholds`) từ JSON
            self.models = data.get("models", {}) or {}
            self.thresholds = data.get("thresholds", {}) or {}
            if self.models:
                self.mode = "calibrated"
                logger.info(
                    "Loaded scoring calibration profile from %s (models=%s).",
                    resolved,
                    list(self.models.keys()),
                )
            else:
                self.mode = "identity"
        except Exception as ex:
            logger.warning("Failed to load calibration profile %s: %s", resolved, ex)
            self.mode = "identity"

    def has_model(self, name: str) -> bool:
        """Kiểm tra xem mô hình hiệu chuẩn cho thành phần `name` có đang hoạt động hay không."""
        return self.mode == "calibrated" and name in self.models

    def calibrate(self, raw_score: float) -> float:
        """Làm tròn điểm thô về 1 chữ số thập phân (dùng ở nhánh chưa bật mô hình hiệu chuẩn)."""
        return round(float(raw_score), 1)

    def predict_component(self, component_name: str, features: Dict[str, float]) -> Optional[float]:
        """
        Dự đoán điểm đã hiệu chuẩn cho một thành phần (`pronunciation`, `fluency`, `prosody`, hoặc `overall`)
        từ từ điển đặc trưng `features` thông qua `calibration.json`:
        1. Chuẩn hóa z-score từng đặc trưng: `(val - mu) / std` (điền `mu` nếu thiếu hoặc NaN/Inf).
        2. Tính tổ hợp tuyến tính Ridge: `z = intercept + sum(w_i * z_i)`.
        3. Ánh xạ đơn điệu từng đoạn qua các điểm nút `(x_knots, y_knots)` bằng `np.interp` để khớp phân phối điểm thực tế.
        4. Giới hạn kết quả trong `[min_score, max_score]` và làm tròn 1 chữ số thập phân.
        """
        model = self.models.get(component_name)
        if not model:
            return None
        feat_names: Sequence[str] = model.get("features", [])
        means: Sequence[float] = model.get("means", [])
        stds: Sequence[float] = model.get("stds", [])
        weights: Sequence[float] = model.get("weights", [])
        intercept = float(model.get("intercept", 0.0))

        if not feat_names or len(weights) != len(feat_names):
            return None

        # Bước 1 & 2: Chuẩn hóa z-score theo thống kê tập train và cộng trọng số tuyến tính Ridge
        z = intercept
        for name, mu, sd, w in zip(feat_names, means, stds, weights):
            val = float(features.get(name, mu))
            if np.isnan(val) or np.isinf(val):
                val = float(mu)
            safe_sd = float(sd) if float(sd) > 1e-8 else 1.0
            z += float(w) * ((val - float(mu)) / safe_sd)

        # Bước 3: Áp dụng đường cong nội suy đơn điệu từng đoạn (piecewise monotonic knots) nếu mô hình có khai báo
        x_knots = model.get("x_knots")
        y_knots = model.get("y_knots")
        if x_knots and y_knots and len(x_knots) == len(y_knots) and len(x_knots) >= 2:
            pred = float(np.interp(z, np.asarray(x_knots, dtype=np.float64), np.asarray(y_knots, dtype=np.float64)))
        else:
            pred = float(z)

        # Bước 4: Cắt ngưỡng theo biên hợp lệ của thành phần
        min_val = float(model.get("min_score", 0.0))
        max_val = float(model.get("max_score", 100.0))
        return round(float(np.clip(pred, min_val, max_val)), 1)


def _gop_margin_to_score(gop_margin: float) -> float:
    """Ánh xạ biên độ GOP (log-likelihood margin theo Witt & Young) qua hàm sigmoid sang điểm thô trong [0, 100]."""
    return float(100.0 / (1.0 + np.exp(-0.72 * (float(gop_margin) + 1.15))))


def extract_utterance_acoustic_features(
    audio_data: np.ndarray,
    sample_rate: int,
    alignment_result: Any,
    utterance_acoustics: Any,
    words_schema: Sequence[WordSchema],
    spoken_words: Sequence[WordSchema],
    pause_events: Sequence[PauseEvent],
    quality_metrics: Any,
    whole_file_sim: float,
    wpm: float,
    articulation_rate: float,
    pause_ratio: float,
    awkward_pause_count: int,
    linking_ratio: float,
    completeness_score: float,
) -> Dict[str, float]:
    """
    Tính toán bộ từ điển đặc trưng âm học chuẩn ở cấp độ toàn câu nói,
    được dùng thống nhất giữa luồng chấm điểm trực tuyến (`routes.py`) và quy trình hiệu chuẩn/đánh giá offline trên SpeechOcean762.
    """
    # 1. Động học khoảng nghỉ giữa các từ & độ ngập ngừng (hesitation)
    gaps: List[float] = []
    hesitation_count = 0
    runs: List[int] = []
    curr_run = 1 if spoken_words else 0
    for idx in range(len(spoken_words) - 1):
        curr_w = spoken_words[idx]
        next_w = spoken_words[idx + 1]
        if curr_w.end_time is None or next_w.start_time is None:
            continue
        gap = max(0.0, float(next_w.start_time - curr_w.end_time))
        gaps.append(gap)
        has_punc = any(ch in curr_w.word for ch in ",.!?;:")
        # Khoảng lặng >= 220ms tại vị trí không có dấu câu được tính là một nhịp ngập ngừng
        if gap >= 0.22 and not has_punc:
            hesitation_count += 1
            runs.append(curr_run)
            curr_run = 1
        else:
            curr_run += 1
    if spoken_words:
        runs.append(curr_run)

    total_transitions = max(1, len(spoken_words) - 1)
    hesitation_ratio = float(hesitation_count) / float(total_transitions)
    awkward_pause_ratio = float(awkward_pause_count) / float(total_transitions)
    mean_gap = float(np.mean(gaps)) if gaps else 0.0
    gap_std = float(np.std(gaps)) if len(gaps) >= 2 else 0.0
    mean_run_norm = min(1.0, (float(np.mean(runs)) if runs else 0.0) / 5.0)

    # 2. Độ ổn định tốc độ nói cục bộ từng từ (hệ số biến thiên CV của thời lượng trung bình trên mỗi âm vị)
    dur_per_ph: List[float] = []
    for w_schema, w_align in zip(words_schema, getattr(alignment_result, "words", [])):
        st = w_schema.word_status.value if hasattr(w_schema.word_status, "value") else str(w_schema.word_status)
        if st in ("SPOKEN", "PARTIAL") and w_schema.start_time is not None and w_schema.end_time is not None:
            n_ph = max(1, len(getattr(w_align, "phonemes", [])))
            dur_per_ph.append(max(0.015, float(w_schema.end_time - w_schema.start_time)) / float(n_ph))
    duration_cv = (
        float(np.std(dur_per_ph) / max(1e-4, float(np.mean(dur_per_ph))))
        if len(dur_per_ph) >= 2
        else 0.35
    )

    # 3. Tổng hợp thống kê điểm âm vị, xác suất GOP, Formant và độ tương phản trọng âm (thời lượng / năng lượng RMS / cao độ F0)
    all_ph_scores: List[float] = []
    vowel_scores: List[float] = []
    cons_scores: List[float] = []
    formant_scores: List[float] = []
    canon_posts: List[float] = []
    gop_margins: List[float] = []
    word_scores: List[float] = []

    stressed_durs: List[float] = []
    unstressed_durs: List[float] = []
    stressed_rms: List[float] = []
    unstressed_rms: List[float] = []
    stressed_f0: List[float] = []
    unstressed_f0: List[float] = []

    pitch_obj = getattr(utterance_acoustics, "pitch", None) if utterance_acoustics is not None else None
    align_words: Sequence[AlignedWord] = getattr(alignment_result, "words", []) or []

    for w_idx, w_schema in enumerate(words_schema):
        st = w_schema.word_status.value if hasattr(w_schema.word_status, "value") else str(w_schema.word_status)
        if st not in ("SPOKEN", "PARTIAL") or w_schema.score is None:
            continue
        word_scores.append(float(w_schema.score))
        align_word = align_words[w_idx] if w_idx < len(align_words) else None
        align_phs = align_word.phonemes if align_word else []

        for p_idx, p_schema in enumerate(w_schema.phonemes):
            p_score = float(p_schema.score)
            all_ph_scores.append(p_score)
            if p_schema.type == PhonemeType.VOWEL:
                vowel_scores.append(p_score)
                if (
                    p_schema.measured_f1 is not None
                    and p_schema.measured_f2 is not None
                    and p_schema.target_f1
                    and p_schema.target_f2
                ):
                    rel_dev = max(
                        abs(p_schema.measured_f1 - p_schema.target_f1) / max(1.0, p_schema.target_f1),
                        abs(p_schema.measured_f2 - p_schema.target_f2) / max(1.0, p_schema.target_f2),
                    )
                    formant_scores.append(float(np.clip(100.0 * np.exp(-1.5 * rel_dev), 20.0, 100.0)))
            else:
                cons_scores.append(p_score)

            if p_idx < len(align_phs):
                p_al = align_phs[p_idx]
                cp = p_al.canonical_posterior if p_al.canonical_posterior is not None else p_al.posterior
                canon_posts.append(float(cp))
                gm = p_al.gop_margin if p_al.gop_margin is not None else 0.0
                gop_margins.append(float(gm))

                if p_al.phoneme_type == "vowel":
                    dur = max(0.01, float(p_al.end - p_al.start))
                    s_idx = max(0, int(p_al.start * sample_rate))
                    e_idx = min(len(audio_data), int(p_al.end * sample_rate))
                    rms = float(np.sqrt(np.mean(audio_data[s_idx:e_idx] ** 2))) if e_idx > s_idx else 0.0
                    f0_val: Optional[float] = None
                    if pitch_obj is not None:
                        try:
                            mid_t = 0.5 * (p_al.start + p_al.end)
                            fv = pitch_obj.get_value_at_time(mid_t)
                            if fv and not np.isnan(fv) and not np.isinf(fv) and fv > 50.0:
                                f0_val = float(fv)
                        except Exception:
                            f0_val = None

                    if p_al.is_stress:
                        stressed_durs.append(dur)
                        if rms > 0.0:
                            stressed_rms.append(rms)
                        if f0_val is not None:
                            stressed_f0.append(f0_val)
                    else:
                        unstressed_durs.append(dur)
                        if rms > 0.0:
                            unstressed_rms.append(rms)
                        if f0_val is not None:
                            unstressed_f0.append(f0_val)

    mean_f0 = max(80.0, float(getattr(utterance_acoustics, "mean_f0", 180.0) if utterance_acoustics is not None else 180.0))
    f0_std = float(getattr(utterance_acoustics, "f0_std", 25.0) if utterance_acoustics is not None else 25.0)
    f0_iqr = float(getattr(utterance_acoustics, "f0_iqr", 30.0) if utterance_acoustics is not None else 30.0)
    f0_range = float(getattr(utterance_acoustics, "f0_range_90_10", 55.0) if utterance_acoustics is not None else 55.0)
    f0_slope = float(getattr(utterance_acoustics, "f0_slope_abs", 5.0) if utterance_acoustics is not None else 5.0)
    voiced_ratio = float(getattr(utterance_acoustics, "voiced_frame_ratio", 0.6) if utterance_acoustics is not None else 0.6)

    # Tính tỷ lệ tương phản giữa nguyên âm mang trọng âm và nguyên âm không nhấn
    stress_dur_contrast = (
        float(np.clip(np.mean(stressed_durs) / max(0.02, float(np.mean(unstressed_durs))), 0.5, 2.5))
        if (stressed_durs and unstressed_durs)
        else 1.15
    )
    stress_rms_contrast = (
        float(np.clip(np.mean(stressed_rms) / max(1e-4, float(np.mean(unstressed_rms))), 0.5, 2.5))
        if (stressed_rms and unstressed_rms)
        else 1.10
    )
    stress_f0_contrast = (
        float(np.clip((np.mean(stressed_f0) - np.mean(unstressed_f0)) / mean_f0, -0.5, 0.5))
        if (stressed_f0 and unstressed_f0)
        else 0.02
    )

    ph_arr = np.asarray(all_ph_scores, dtype=np.float64) if all_ph_scores else np.array([75.0])
    w_arr = np.asarray(word_scores, dtype=np.float64) if word_scores else np.array([75.0])
    cp_arr = np.asarray(canon_posts, dtype=np.float64) if canon_posts else np.array([0.5])
    gm_arr = np.asarray(gop_margins, dtype=np.float64) if gop_margins else np.array([0.0])

    align_conf = float(getattr(alignment_result, "alignment_confidence", 0.5))
    blank_ratio = float(getattr(alignment_result, "blank_ratio", 0.5))
    speech_ratio = float(getattr(quality_metrics, "speech_ratio", 0.8))
    duration_sec = float(getattr(quality_metrics, "duration", max(0.5, len(audio_data) / float(sample_rate))))

    return {
        "wpm": float(wpm),
        "wpm_opt": float(np.exp(-((float(wpm) - 140.0) / 70.0) ** 2)),
        "articulation_rate": float(articulation_rate),
        "art_rate_opt": float(np.exp(-((float(articulation_rate) - 4.1) / 1.8) ** 2)),
        "speech_ratio": speech_ratio,
        "duration_sec": duration_sec,
        "pause_ratio": float(pause_ratio),
        "pause_count": float(len(pause_events)),
        "awkward_pause_ratio": awkward_pause_ratio,
        "hesitation_ratio": hesitation_ratio,
        "mean_inter_word_gap": mean_gap,
        "gap_std": gap_std,
        "mean_run_length_norm": mean_run_norm,
        "linking_ratio": float(linking_ratio),
        "duration_cv": float(np.clip(duration_cv, 0.0, 2.0)),
        "blank_ratio": blank_ratio,
        "align_confidence": align_conf,
        "whole_file_sim": float(whole_file_sim),
        "completeness_ratio": float(completeness_score) / 100.0,
        "f0_rel_std": float(np.clip(f0_std / mean_f0, 0.0, 0.6)),
        "f0_iqr_norm": float(np.clip(f0_iqr / mean_f0, 0.0, 0.6)),
        "f0_range_norm": float(np.clip(f0_range / mean_f0, 0.0, 1.0)),
        "f0_slope_norm": float(np.clip(f0_slope / mean_f0, 0.0, 0.25)),
        "voiced_frame_ratio": voiced_ratio,
        "stress_dur_contrast": stress_dur_contrast,
        "stress_rms_contrast": stress_rms_contrast,
        "stress_f0_contrast": stress_f0_contrast,
        "mean_phoneme_score": float(np.mean(ph_arr)),
        "p10_phoneme_score": float(np.percentile(ph_arr, 10)),
        "p25_phoneme_score": float(np.percentile(ph_arr, 25)),
        "std_phoneme_score": float(np.std(ph_arr)),
        "mean_vowel_score": float(np.mean(vowel_scores)) if vowel_scores else float(np.mean(ph_arr)),
        "mean_cons_score": float(np.mean(cons_scores)) if cons_scores else float(np.mean(ph_arr)),
        "mean_formant_score": float(np.mean(formant_scores)) if formant_scores else 75.0,
        "mean_word_score": float(np.mean(w_arr)),
        "min_word_score": float(np.min(w_arr)),
        "p20_word_score": float(np.percentile(w_arr, 20)),
        "failed_word_ratio": float(np.mean(w_arr < 70.0)),
        "mean_canon_post": float(np.mean(cp_arr)),
        "p15_canon_post": float(np.percentile(cp_arr, 15)),
        "mean_gop_margin": float(np.mean(gm_arr)),
        "p15_gop_margin": float(np.percentile(gm_arr, 15)),
        "neg_gop_ratio": float(np.mean(gm_arr < -0.5)),
        "bad_gop_ratio": float(np.mean(gm_arr < -1.5)),
        "n_words": float(len(words_schema)),
        "n_phonemes": float(len(ph_arr)),
    }


class Scorer:
    """
    Bộ máy chấm điểm phân tầng (Hierarchical Scoring Engine):
    - Chấm điểm âm vị nhạy với biên độ GOP chưa gộp lỗi (`gop_margin`) và bảo vệ sàn bằng Formant Praat.
    - Chấm điểm cấp độ từ có trọng số nguyên âm/phụ âm và trần phạt khi âm trọng yếu bị sai/nuốt.
    - Hiệu chuẩn cấp độ toàn câu bằng mô hình thực nghiệm SpeechOcean762 (`calibration.json`).
    """

    # Tập hợp âm bật (tắc-bật) và âm tắc xát / bán nguyên âm có thời lượng ngắn
    PLOSIVES = {"p", "t", "k", "b", "d", "g", "ɡ"}
    AFFRICATES_AND_GLIDES = {"tʃ", "dʒ", "ts", "dz", "h", "j", "w"}

    def __init__(
        self,
        pron_weight: float = settings.PRONUNCIATION_WEIGHT,
        fluency_weight: float = settings.FLUENCY_WEIGHT,
        speed_weight: float = settings.SPEED_WEIGHT,
        speed_target_min: float = settings.SPEED_TARGET_MIN,
        speed_target_max: float = settings.SPEED_TARGET_MAX,
        calibrator: Optional[ScoringCalibrator] = None,
    ):
        """Khởi tạo bộ chấm điểm với trọng số thành phần, dải tốc độ mục tiêu và bộ hiệu chuẩn."""
        self.pron_weight = pron_weight
        self.fluency_weight = fluency_weight
        self.speed_weight = speed_weight
        self.speed_target_min = speed_target_min
        self.speed_target_max = speed_target_max
        self.calibrator = calibrator if calibrator is not None else ScoringCalibrator()

    def score_vowel(
        self,
        formant_score: Optional[float],
        acoustic_confidence: float,
        alignment_confidence: float,
        posterior: float = 0.5,
        symbol: Optional[str] = None,
        canonical_posterior: Optional[float] = None,
        gop_margin: Optional[float] = None,
    ) -> float:
        """
        Chấm điểm nguyên âm trên thang [0, 100] dựa trên:
        - Xác suất hậu nghiệm chuẩn (`canonical_posterior` hoặc fallback `posterior`) kết hợp biên độ GOP (`gop_margin`).
        - Điểm khẩu hình Formant F1/F2 từ Praat (chiếm 55% khi có mặt) và độ tin cậy gióng hàng (5%).
        Có cơ chế bảo vệ điểm sàn nếu Formant đạt chuẩn tốt, đồng thời phạt nặng nếu phát âm lệch rõ rệt sang âm khác (`gop_margin < -2.0`).
        """
        # Khi có `canonical_posterior`, chấm theo nhận diện phương ngữ chuẩn thay vì xác suất đã gộp lỗi
        has_strict_gop = canonical_posterior is not None or gop_margin is not None
        eff_post = canonical_posterior if canonical_posterior is not None else posterior
        safe_post = max(1e-6, min(1.0, eff_post))

        # Nếu xác suất quá thấp và biên độ GOP âm sâu (< -2.0), trả về điểm rất thấp hoặc fallback theo Formant nếu không ở chế độ GOP nghiêm ngặt
        if safe_post < 0.015 and (gop_margin is None or gop_margin < -2.0):
            if formant_score is not None and formant_score >= 55.0 and not has_strict_gop:
                return float(formant_score * 0.92)
            return float(max(0.0, _gop_margin_to_score(gop_margin))) if gop_margin is not None else 0.0

        # Tính điểm GOP thô từ log-posterior và hòa trộn với điểm biên độ cạnh tranh `gop_margin`
        log_post = float(np.log(safe_post))
        gop_div = 8.5 if symbol is not None else 5.5
        gop_cap = 100.0 if symbol is not None else 98.0
        raw_gop = float(np.clip(100.0 * (1.0 + log_post / gop_div), 0.0, gop_cap))

        if gop_margin is not None:
            margin_score = _gop_margin_to_score(gop_margin)
            raw_gop = (0.52 * raw_gop + 0.48 * margin_score) if symbol is not None else (0.50 * raw_gop + 0.50 * margin_score)

        if formant_score is not None:
            safe_formant = float(np.clip(formant_score, 0.0, 100.0))
            clean_v_sym = symbol.strip("/ ") if symbol else ""
            # Nhóm nguyên âm yếu/ngắn thường biến thiên lớn hơn trong lời nói liên tục
            is_weak_vowel = clean_v_sym in ("ə", "ɪ", "ɚ", "ʊ", "uː")
            if symbol is not None:
                # Kết hợp: 40% điểm GOP + 55% điểm Formant + 5% độ tin cậy gióng hàng
                vowel_score = (
                    raw_gop * 0.40 +
                    safe_formant * 0.55 +
                    (alignment_confidence * 100.0) * 0.05
                )
                # Bảo vệ điểm sàn theo Formant nếu khẩu hình chuẩn và Wav2Vec2 không bác bỏ mạnh
                if safe_formant >= 80.0 and safe_post >= 0.20 and (gop_margin is None or gop_margin >= -0.9):
                    vowel_score = max(vowel_score, safe_formant * 0.99)
                elif safe_formant >= 62.0 and safe_post >= 0.08 and (gop_margin is None or gop_margin >= -1.5):
                    vowel_score = max(vowel_score, safe_formant * 0.91)
                if raw_gop >= 82.0 and safe_formant >= 62.0 and (gop_margin is None or gop_margin >= -0.2):
                    vowel_score = max(vowel_score, raw_gop * 0.96)
                # Nếu là nguyên âm mạnh nhưng xác suất chuẩn rất thấp -> chặn trần kết hợp
                if safe_post < 0.08 and not is_weak_vowel and (gop_margin is None or gop_margin < -1.0):
                    vowel_score = min(vowel_score, raw_gop * 0.55 + safe_formant * 0.45)
            else:
                vowel_score = (
                    raw_gop * 0.45 +
                    safe_formant * 0.50 +
                    (alignment_confidence * 100.0) * 0.05
                )
                if safe_post < 0.45 and safe_formant >= 62.0:
                    vowel_score = max(vowel_score, safe_formant * 0.88)
                if raw_gop >= 75.0 and safe_formant >= 50.0:
                    vowel_score = max(vowel_score, raw_gop * 0.90)

            # Lỗi thay thế nguyên âm rõ rệt (ví dụ đọc /iː/ thành /ɪ/, gop_margin < -2.0) không thể được che lấp bởi Formant ngẫu nhiên
            if gop_margin is not None and gop_margin < -2.0:
                vowel_score = min(vowel_score, max(20.0, _gop_margin_to_score(gop_margin) * 1.15))

            if safe_formant < 45.0 and raw_gop < 60.0:
                vowel_score = min(vowel_score, safe_formant * 1.35)
        else:
            # Nếu không đo được Formant tin cậy, chấm dựa trên 90% GOP + 10% độ tin cậy gióng hàng
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
        acoustic_multiplier: float = 1.0,
        canonical_posterior: Optional[float] = None,
        gop_margin: Optional[float] = None,
    ) -> float:
        """
        Chấm điểm phụ âm trên thang [0, 100] dựa trên xác suất GOP, biên độ cạnh tranh `gop_margin`,
        hệ số thời lượng tối thiểu (`dur_factor`) và hệ số bằng chứng âm học (`acoustic_multiplier`).
        Có xử lý riêng cho âm bật ngắn, âm /r/ cuối âm tiết (non-rhotic UK) và phạt mạnh lỗi thay thế âm.
        """
        if acoustic_multiplier <= 0.0:
            return 0.0

        clean_sym = symbol.strip("/ ") if symbol else ""
        has_strict_gop = canonical_posterior is not None or gop_margin is not None
        eff_post = canonical_posterior if canonical_posterior is not None else posterior
        safe_post = max(1e-6, min(1.0, eff_post))

        # Chỉ nới lỏng cho âm /r/ không bật hơi ở cuối âm tiết sau nguyên âm (theo giọng Anh-Anh), tuyệt đối không nới cho /r/ đầu từ
        if is_coda_r and not has_strict_gop and alignment_confidence >= 0.35:
            return 90.0

        is_plosive = clean_sym in self.PLOSIVES
        is_short_cons = is_plosive or (clean_sym in self.AFFRICATES_AND_GLIDES) or is_word_final

        if safe_post < 0.015 and (gop_margin is None or gop_margin < -2.0):
            if not has_strict_gop and symbol is not None and is_plosive and alignment_confidence >= 0.80 and acoustic_multiplier >= 0.85:
                return 88.0
            return float(max(0.0, min(35.0, _gop_margin_to_score(gop_margin)))) if gop_margin is not None else 0.0

        log_post = float(np.log(safe_post))

        # Thiết lập tham số độ nhạy GOP và thời lượng tối thiểu tùy theo phụ âm ngắn hay kéo dài
        if symbol is not None:
            gop_scale = 5.8 if is_short_cons else 5.2
            min_dur = 0.012 if is_short_cons else 0.020
            gop_cap = 100.0
        else:
            gop_scale = 5.2
            min_dur = 0.042
            gop_cap = 98.0

        # Hòa trộn 45% log-posterior GOP + 55% điểm biên độ cạnh tranh `gop_margin`
        raw_gop_score = float(np.clip(100.0 * (1.0 + log_post / gop_scale), 0.0, gop_cap))
        if gop_margin is not None:
            margin_score = _gop_margin_to_score(gop_margin)
            raw_gop_score = 0.45 * raw_gop_score + 0.55 * margin_score

        # Giảm điểm theo tỷ lệ nếu phụ âm bị đọc lướt quá ngắn hơn ngưỡng `min_dur`, rồi nhân với bằng chứng âm học
        dur_factor = min(1.0, duration / min_dur) if duration < min_dur else 1.0
        base_score = (raw_gop_score * 0.90 + (alignment_confidence * 100.0) * 0.10) * dur_factor
        consonant_score = base_score * acoustic_multiplier

        if not has_strict_gop and symbol is not None and acoustic_multiplier >= 0.85:
            if safe_post >= 0.50 and alignment_confidence >= 0.50:
                floor_target = 96.5 + min(3.5, (safe_post - 0.50) * 7.0)
                consonant_score = max(consonant_score, floor_target)
            elif is_plosive and safe_post >= 0.22 and alignment_confidence >= 0.65:
                consonant_score = max(consonant_score, 94.0)
        elif is_coda_r and alignment_confidence >= 0.50 and (gop_margin is None or gop_margin > -2.5):
            # Dung sai cho giọng non-rhotic ở âm /r/ cuối âm tiết (vẫn yêu cầu không bị đọc nhầm sang phụ âm khác)
            consonant_score = max(consonant_score, 84.0)

        # Phạt các lỗi thay thế phụ âm rõ rệt (ví dụ /θ/ -> /f,s,t/ hoặc /ð/ -> /d,z/) khi âm đối thủ vượt trội hơn âm đích
        if gop_margin is not None and gop_margin < -1.5:
            consonant_score = min(consonant_score, max(15.0, _gop_margin_to_score(gop_margin) * 1.15))

        return float(np.clip(consonant_score, 0.0, 100.0))

    def score_word(
        self,
        phoneme_schemas: List[PhonemeSchema],
        aligned_phonemes: List[AlignedPhoneme],
        is_oov: bool = False
    ) -> float:
        """
        Tổng hợp điểm cho một từ từ danh sách điểm âm vị:
        - Phân bổ 65% trọng số cho nguyên âm (nhân 1.2x nếu là nguyên âm mang trọng âm) và 35% cho phụ âm (nhân 1.1x nếu là âm cuối từ).
        - Áp đặt các ngưỡng trần phạt (hard cap) nếu từ bị hỏng nguyên âm trọng tâm hoặc thiếu/sai phụ âm (nhất là phụ âm cuối).
        - Làm mềm điểm nhẹ cho từ ngoài từ điển (OOV / tên riêng tiếng Việt).
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
                w = per_c_weight * (1.1 if p_aligned.is_word_final else 1.0)
                weights.append(w)
                scores.append(p_schema.score)

        weighted_mean = float(np.sum(np.array(scores) * np.array(weights)) / max(1e-6, np.sum(weights)))

        # Chặn trần điểm từ nếu nguyên âm trọng tâm bị phát âm quá yếu (< 25 điểm)
        if vowels:
            if len(phoneme_schemas) <= 3:
                min_vowel_score = min(p_s.score for p_s, _ in vowels)
                if min_vowel_score < 25.0:
                    hard_cap = min(40.0, min_vowel_score * 2.2)
                    weighted_mean = min(weighted_mean, hard_cap)
            else:
                stressed_vowels = [p_s.score for p_s, p_a in vowels if p_a.is_stress]
                vowel_avg = float(np.mean([p_s.score for p_s, _ in vowels]))
                if stressed_vowels:
                    min_stressed = min(stressed_vowels)
                    if min_stressed < 25.0:
                        hard_cap = max(45.0, min_stressed * 1.8)
                        weighted_mean = min(weighted_mean, hard_cap)
                elif vowel_avg < 25.0:
                    weighted_mean = min(weighted_mean, 45.0)

        # Chặn trần điểm từ nếu phụ âm bị nuốt hoặc sai lệch (đặc biệt siết chặt ở vị trí âm cuối từ)
        for p_schema, p_aligned in consonants:
            if p_aligned.is_word_final:
                if p_schema.score < 20.0:
                    weighted_mean = min(weighted_mean, 52.0)
                elif p_schema.score < 60.0:
                    weighted_mean = min(weighted_mean, 65.0)
            else:
                if p_schema.score < 20.0:
                    weighted_mean = min(weighted_mean, 55.0)
                elif p_schema.score < 55.0:
                    weighted_mean = min(weighted_mean, 62.0)

        # Giảm nhẹ độ khắt khe đối với các từ ngoài từ điển (ví dụ tên riêng tiếng Việt)
        if is_oov:
            weighted_mean = max(weighted_mean, min(78.0, 55.0 + (weighted_mean * 0.35)))

        return float(np.clip(weighted_mean, 0.0, 100.0))

    def calculate_wpm(self, word_count: int, total_speech_duration: float) -> int:
        """Tính tốc độ nói theo số từ mỗi phút (WPM); trả về mặc định 120 nếu đoạn nói quá ngắn."""
        if total_speech_duration <= 0.2 or word_count <= 0:
            return 120
        return int(round((word_count / total_speech_duration) * 60.0))

    def calculate_speed_score(self, articulation_rate: float, wpm: float = 135.0) -> float:
        """
        Chấm điểm tốc độ phát âm dựa trên 80% tốc độ âm tiết/giây (`articulation_rate` quanh khoảng chuẩn
        `[speed_target_min, speed_target_max]`) và 20% điểm tối ưu theo WPM (vùng lý tưởng 110–195 WPM).
        """
        if articulation_rate <= 0.0:
            return 50.0
        if self.speed_target_min <= articulation_rate <= self.speed_target_max:
            center = 0.5 * (self.speed_target_min + self.speed_target_max)
            half_w = max(0.25, 0.5 * (self.speed_target_max - self.speed_target_min))
            dev = abs(articulation_rate - center) / half_w
            rate_score = 100.0 - 6.0 * (dev ** 2)
        elif articulation_rate < self.speed_target_min:
            deficit = self.speed_target_min - articulation_rate
            rate_score = max(35.0, 94.0 - (deficit / max(0.5, self.speed_target_min)) * 55.0)
        else:
            excess = articulation_rate - self.speed_target_max
            rate_score = max(72.0, 94.0 - (excess / 5.5) * 20.0)

        if float(wpm) < 110.0:
            wpm_opt = 100.0 * float(np.exp(-((110.0 - float(wpm)) / 48.0) ** 2))
        elif float(wpm) <= 195.0:
            wpm_opt = 100.0
        else:
            wpm_opt = max(62.0, 100.0 * float(np.exp(-((float(wpm) - 195.0) / 110.0) ** 2)))
        return round(float(np.clip(0.80 * rate_score + 0.20 * wpm_opt, 30.0, 100.0)), 1)

    def calculate_fluency_score(
        self,
        pause_events: List[PauseEvent],
        awkward_pause_count: int,
        pause_ratio: float,
        wpm: float,
        speech_ratio: float,
        features: Optional[Dict[str, float]] = None,
    ) -> float:
        """
        Tính điểm độ trôi chảy (`fluency`):
        - Ưu tiên dùng mô hình `'fluency'` đã hiệu chuẩn từ `calibration.json` nếu khả dụng.
        - Nếu không, dùng công thức âm học dự phòng: kết hợp 40% tốc độ WPM (tối ưu 110–195 WPM),
          40% nhịp điệu (trừ điểm ngắt nghỉ thừa, ngập ngừng và độ lệch thời lượng), 10% tỷ lệ lời nói và 10% độ dài cụm từ trôi chảy.
        """
        if features is not None and self.calibrator.has_model("fluency"):
            pred = self.calibrator.predict_component("fluency", features)
            if pred is not None:
                return float(np.clip(pred, 25.0, 100.0))

        # Công thức dự phòng mượt (tránh bão hòa): vùng tối ưu giao tiếp nằm trong [110, 195] WPM
        if float(wpm) < 110.0:
            wpm_score = 100.0 * float(np.exp(-((110.0 - float(wpm)) / 48.0) ** 2))
        elif float(wpm) <= 195.0:
            wpm_score = 100.0
        else:
            wpm_score = 100.0 * float(np.exp(-((float(wpm) - 195.0) / 55.0) ** 2))
        wpm_score = max(45.0, wpm_score) if (85.0 <= wpm <= 205.0) else max(30.0, wpm_score)
        hes_ratio = float(features.get("hesitation_ratio", 0.0)) if features else 0.0
        dur_cv = float(features.get("duration_cv", 0.25)) if features else 0.25
        mean_run = float(features.get("mean_run_length_norm", 0.85)) if features else 0.85

        pause_pen = min(40.0, pause_ratio * 55.0 + awkward_pause_count * 4.5 + hes_ratio * 22.0)
        rhythm_score = float(np.clip(100.0 - pause_pen - max(0.0, dur_cv - 0.35) * 20.0, 30.0, 100.0))
        speech_cont = float(np.clip(speech_ratio * 105.0, 35.0, 100.0))
        fluency = 0.40 * wpm_score + 0.40 * rhythm_score + 0.10 * speech_cont + 0.10 * (mean_run * 100.0)
        return round(float(np.clip(fluency, 25.0, 100.0)), 1)

    def calculate_completeness_score(
        self,
        spoken_count: int,
        total_expected: int,
        partial_count: int = 0
    ) -> int:
        """Tính phần trăm độ hoàn thiện câu đọc; các từ đọc dở (`partial_count`) được tính hệ số 0.55."""
        if total_expected <= 0:
            return 100
        effective_spoken = spoken_count + 0.55 * partial_count
        completeness = int(round((effective_spoken / float(total_expected)) * 100.0))
        return int(np.clip(completeness, 0, 100))

    def calculate_prosody_score(
        self,
        f0_std: float,
        fluency_score: float,
        pronunciation_score: float,
        linking_ratio: float = 0.0,
        features: Optional[Dict[str, float]] = None,
    ) -> float:
        """
        Tính điểm ngữ điệu (`prosody`):
        - Ưu tiên dùng mô hình `'prosody'` trong `calibration.json` nếu khả dụng.
        - Nếu không, tính từ 35% biến thiên cao độ F0 chuẩn hóa theo giới tính (`f0_rel_std`, đạt đỉnh quanh 12–24%),
          15% độ tương phản trọng âm, 25% độ trôi chảy, 25% phát âm và điểm thưởng nối âm (`linking_ratio`),
          có chặn trần để ngữ điệu không vượt quá xa mặt bằng phát âm và trôi chảy.
        """
        if features is not None and self.calibrator.has_model("prosody"):
            pred = self.calibrator.predict_component("prosody", features)
            if pred is not None:
                return float(np.clip(pred, 25.0, 100.0))

        rel_std = float(features.get("f0_rel_std", f0_std / 180.0)) if features else (f0_std / 180.0)
        stress_dur = float(features.get("stress_dur_contrast", 1.15)) if features else 1.15

        # Điểm đường cao độ chuẩn hóa theo giới tính, đạt tối ưu khi độ lệch chuẩn tương đối của F0 quanh 12%–24%
        if rel_std < 0.06:
            pitch_score = 55.0 + (rel_std / 0.06) * 22.0
        elif rel_std <= 0.28:
            pitch_score = 77.0 + min(21.0, (rel_std - 0.06) * 110.0)
        else:
            pitch_score = max(65.0, 96.0 - (rel_std - 0.28) * 60.0)

        stress_score = float(np.clip(65.0 + (stress_dur - 1.0) * 55.0, 50.0, 98.0))
        raw_prosody = (
            pitch_score * 0.35 +
            stress_score * 0.15 +
            fluency_score * 0.25 +
            pronunciation_score * 0.25 +
            min(4.0, linking_ratio * 10.0)
        )
        prosody_cap = round((pronunciation_score * 0.5 + fluency_score * 0.5) + 18.0)
        return round(float(np.clip(min(raw_prosody, prosody_cap), 30.0, 100.0)), 1)

    def calibrate_utterance_scores(
        self,
        raw_pronunciation: float,
        raw_fluency: float,
        raw_prosody: float,
        completeness: float,
        features: Dict[str, float],
    ) -> Dict[str, float]:
        """
        Áp dụng bộ dự đoán hiệu chuẩn SpeechOcean762 (từ `calibration.json`) cho cả 4 điểm:
        `pronunciation`, `fluency`, `prosody` và `overall`.
        Tự động giữ kết quả thô cho thành phần nào chưa có mô hình và điều chỉnh giảm tỷ lệ nếu người học bỏ sót từ (`completeness < 95`).
        """
        comp_ratio = max(0.0, min(1.0, float(completeness) / 100.0))

        # 1. Hiệu chuẩn điểm phát âm (`pronunciation`)
        pron = raw_pronunciation
        if self.calibrator.has_model("pronunciation"):
            feat_p = dict(features)
            feat_p["raw_pronunciation"] = float(raw_pronunciation)
            p_cal = self.calibrator.predict_component("pronunciation", feat_p)
            if p_cal is not None:
                pron = p_cal

        # 2. Hiệu chuẩn điểm trôi chảy (`fluency`) và ngữ điệu (`prosody`)
        flu = self.calibrator.predict_component("fluency", features) if self.calibrator.has_model("fluency") else None
        flu_val = flu if flu is not None else raw_fluency

        pros = self.calibrator.predict_component("prosody", features) if self.calibrator.has_model("prosody") else None
        pros_val = pros if pros is not None else raw_prosody

        # 3. Hiệu chuẩn điểm tổng kết (`overall`) dựa trên 3 điểm thành phần đã hiệu chuẩn và đặc trưng âm học
        if self.calibrator.has_model("overall"):
            feat_o = dict(features)
            feat_o["cal_pronunciation"] = float(pron)
            feat_o["cal_fluency"] = float(flu_val)
            feat_o["cal_prosody"] = float(pros_val)
            feat_o["raw_pronunciation"] = float(raw_pronunciation)
            overall = self.calibrator.predict_component("overall", feat_o)
            if overall is None:
                overall = self.calculate_overall_score(pron, flu_val, pros_val, completeness)
            else:
                # Tránh dìm điểm ở dải xuất sắc khi câu đầy đủ (>= 90%) và phát âm + trôi chảy đều đạt >= 82
                if completeness >= 90.0 and pron >= 82.0 and flu_val >= 82.0:
                    weighted_ref = (
                        self.pron_weight * pron
                        + self.fluency_weight * flu_val
                        + self.speed_weight * pros_val
                    )
                    overall = max(
                        float(overall),
                        round(0.35 * float(overall) + 0.65 * min(98.0, weighted_ref), 1),
                    )
                if completeness < 95.0:
                    overall = round(float(np.clip(overall * comp_ratio, 0.0, 100.0)), 1)
        else:
            overall = self.calculate_overall_score(pron, flu_val, pros_val, completeness)

        return {
            "pronunciation": round(float(np.clip(pron, 0.0, 100.0)), 1),
            "fluency": round(float(np.clip(flu_val, 0.0, 100.0)), 1),
            "prosody": round(float(np.clip(pros_val, 0.0, 100.0)), 1),
            "overall": round(float(np.clip(overall, 0.0, 100.0)), 1),
        }

    def calculate_overall_score(
        self,
        pronunciation: float,
        fluency: float,
        prosody: float,
        completeness: float = 100.0
    ) -> float:
        """
        Tính điểm tổng kết thô theo tổng trọng số cấu hình (`pron_weight`, `fluency_weight`, `speed_weight`),
        nhân giảm theo tỷ lệ hoàn thiện nếu đọc thiếu từ (`completeness < 95`), rồi làm tròn qua `calibrator.calibrate`.
        """
        raw_overall = (
            self.pron_weight * pronunciation +
            self.fluency_weight * fluency +
            self.speed_weight * prosody
        )
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
    # Nhóm 1: Từ bị bỏ sót hoặc âm vị hoàn toàn không có bằng chứng (điểm <= 0)
    if is_missing or score <= 0.0:
        if is_word_final and acoustic_detail and "nuốt" in acoustic_detail:
            return f"Bạn đã nuốt hoặc quên phát âm âm đuôi /{clean_sym}/ ở cuối từ."
        if is_missing:
            return "Bạn chưa đọc từ này."
        return f"Chưa phát hiện âm /{clean_sym}/ (âm bị thiếu hoặc quá nhỏ)."

    # Nhóm 2: Đạt chuẩn tốt (>= 80 điểm)
    if score >= 80.0:
        if phoneme_type == "vowel":
            return "Khẩu hình và vị trí đặt lưỡi chuẩn xác!"
        return "Phát âm rõ ràng, chuẩn xác."

    # Nhóm 3: Tương đối tốt (60 - 79.9 điểm) -> ưu tiên gợi ý điều chỉnh Formant nếu có
    elif score >= 60.0:
        if phoneme_type == "vowel" and formant_feedback and "chuẩn xác" not in formant_feedback.lower():
            return formant_feedback
        return "Phát âm tương đối tốt, cần tròn vành rõ chữ hơn."

    # Nhóm 4: Trung bình / Cần sửa (30 - 59.9 điểm)
    elif score >= 30.0:
        if phoneme_type == "vowel" and formant_feedback and "chuẩn xác" not in formant_feedback.lower():
            return formant_feedback
        if acoustic_detail and "thiếu" in acoustic_detail.lower():
            return f"Âm /{clean_sym}/ chưa đạt: {acoustic_detail}."
        return f"Phát âm âm /{clean_sym}/ chưa chuẩn xác, cần chú ý khẩu hình."

    # Nhóm 5: Sai lệch nặng hoặc nuốt âm (< 30 điểm)
    else:
        if is_word_final and ((acoustic_detail and "nuốt" in acoustic_detail) or score < 15.0):
            return f"Bạn đã nuốt hoặc quên phát âm âm đuôi /{clean_sym}/ ở cuối từ."
        if acoustic_detail and ("thiếu" in acoustic_detail.lower() or "quá nhỏ" in acoustic_detail.lower()):
            return f"Âm /{clean_sym}/ thiếu bằng chứng âm học: {acoustic_detail}."
        return f"Phát âm sai lệch hoặc phát âm chưa rõ âm /{clean_sym}/."


scorer = Scorer()
