"""Gói tập hợp các dịch vụ cốt lõi về xử lý tín hiệu âm thanh, kiểm tra chất lượng, căn chỉnh âm vị, phân tích formant và chấm điểm phát âm."""

# Tiền xử lý âm thanh (chuyển đổi định dạng, đưa về mono 16kHz, chuẩn hóa biên độ)
from app.services.audio_preprocessor import AudioPreprocessor, preprocessor
# Cổng kiểm tra chất lượng âm thanh đầu vào & kiểm tra bằng chứng âm học của phụ âm
from app.services.audio_quality import AudioQualityGate, quality_gate, check_consonant_acoustic_evidence, check_consonant_acoustic_evidence_detailed
# Phát hiện vùng có giọng nói và các khoảng ngắt nghỉ (VAD)
from app.services.vad import SpeechDetector, speech_detector
# Nạp mô hình Wav2Vec2, chuẩn hóa ký hiệu IPA và thực hiện căn chỉnh cưỡng bức (Forced Alignment)
from app.services.aligner import ModelManager, IPASanitizer, ForcedAligner, forced_aligner
# Trích xuất tần số cộng hưởng F1/F2 của nguyên âm bằng thư viện âm học Praat
from app.services.formant_service import FormantService, formant_service
# Chấm điểm phát âm/trôi chảy/tốc độ, hiệu chỉnh điểm và tạo phản hồi sư phạm cho từng âm vị
from app.services.scorer import (
    Scorer,
    scorer,
    ScoringCalibrator,
    generate_phoneme_pedagogical_feedback,
    extract_utterance_acoustic_features,
)
# Ước lượng độ tin cậy tổng thể của kết quả chấm điểm
from app.services.confidence import ConfidenceEstimator, confidence_estimator
# Sinh nhận xét về độ trôi chảy và tốc độ nói cho người học
from app.services.feedback import FeedbackGenerator, feedback_generator
# Đối chiếu chuỗi từ đã đọc với câu mẫu để phát hiện từ bỏ sót, đọc sai hoặc đọc thiếu âm
from app.services.word_aligner import (
    SpeechEvidenceDetector,
    WordSequenceAligner,
    evidence_detector,
    word_sequence_aligner,
    WordAlignmentStatus,
    AlignedWordEvidence,
    analyze_word_coverage,
    detect_spoken_prefix_count,
    decode_raw_speech,
    compute_phoneme_similarity,
    verify_speech_content
)

# Danh sách các lớp, hàm và thể hiện singleton được xuất công khai khi import từ gói `app.services`
__all__ = [
    "AudioPreprocessor",
    "preprocessor",
    "AudioQualityGate",
    "quality_gate",
    "SpeechDetector",
    "speech_detector",
    "ModelManager",
    "IPASanitizer",
    "ForcedAligner",
    "forced_aligner",
    "FormantService",
    "formant_service",
    "Scorer",
    "scorer",
    "ScoringCalibrator",
    "generate_phoneme_pedagogical_feedback",
    "ConfidenceEstimator",
    "confidence_estimator",
    "FeedbackGenerator",
    "feedback_generator",
    "SpeechEvidenceDetector",
    "WordSequenceAligner",
    "evidence_detector",
    "word_sequence_aligner",
    "WordAlignmentStatus",
    "AlignedWordEvidence",
    "detect_spoken_prefix_count",
    "decode_raw_speech",
    "compute_phoneme_similarity",
    "verify_speech_content",
    "check_consonant_acoustic_evidence",
    "check_consonant_acoustic_evidence_detailed",
]
