"""
Cấu hình trung tâm cho dịch vụ đánh giá phát âm (phonetics-service).
Đọc và kiểm tra toàn bộ tham số từ biến môi trường hoặc file `.env`.
"""

import os
from pathlib import Path
from typing import Literal

# Thư viện pydantic-settings hỗ trợ nạp cấu hình từ file `.env`;
# nếu môi trường chưa cài gói này thì tạm dùng BaseModel làm lớp cơ sở dự phòng.
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    HAS_PYDANTIC_SETTINGS = True
except ImportError:
    from pydantic import BaseModel as BaseSettings
    SettingsConfigDict = None
    HAS_PYDANTIC_SETTINGS = False

from pydantic import Field, model_validator


class Settings(BaseSettings):
    """
    Lớp cấu hình trung tâm cho hệ thống đánh giá phát âm (Speech Assessment Engine).
    Mọi tham số đều có thể thay đổi linh hoạt qua biến môi trường hoặc file `.env`,
    không gắn cứng các ngưỡng chấm điểm trong mã nguồn xử lý nghiệp vụ.
    """
    # Cấu hình nguồn đọc biến môi trường từ file `.env` (phân biệt hoa/thường, bỏ qua biến lạ)
    if HAS_PYDANTIC_SETTINGS:
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            case_sensitive=True,
            extra="ignore"
        )

    # --------------------------------------------------------------------------
    # 1. Cấu hình mô hình AI nhận dạng âm vị (Model Configurations)
    # --------------------------------------------------------------------------
    # Tên checkpoint mô hình Wav2Vec2 trên Hugging Face dùng để nhận dạng âm vị và căn chỉnh CTC
    MODEL_NAME: str = Field(
        default="facebook/wav2vec2-xlsr-53-espeak-cv-ft",
        description="Hugging Face model checkpoint for phoneme recognition & CTC alignment."
    )
    # Thiết bị chạy suy luận mô hình: 'cpu' (mặc định) hoặc 'cuda' (nếu máy chủ có GPU NVIDIA)
    MODEL_DEVICE: Literal["cpu", "cuda"] = Field(
        default="cpu",
        description="Device to run neural inference ('cpu' or 'cuda')."
    )
    # Thư mục lưu bộ nhớ đệm các mô hình đã tải về để tái sử dụng ở các lần khởi động sau
    MODEL_CACHE_DIR: Path = Field(
        default=Path("cache/huggingface"),
        description="Directory for caching downloaded pre-trained models."
    )

    # --------------------------------------------------------------------------
    # 2. Cấu hình xử lý âm thanh đầu vào (Audio Processing Configurations)
    # --------------------------------------------------------------------------
    # Tần số lấy mẫu chuẩn (16.000 Hz) bắt buộc cho cả Wav2Vec2 và công cụ phân tích âm học Praat
    SAMPLE_RATE: int = Field(
        default=16000,
        description="Standardized audio sample rate required by Wav2Vec2 & Praat."
    )
    # Thời lượng ghi âm tối thiểu (giây); ngắn hơn ngưỡng này sẽ bị từ chối vì thiếu dữ liệu
    MIN_AUDIO_DURATION: float = Field(
        default=0.4,
        description="Minimum allowed audio recording length in seconds."
    )
    # Thời lượng ghi âm tối đa cho phép (giây, mặc định 180 giây = 3 phút)
    MAX_AUDIO_DURATION: float = Field(
        default=180.0,
        description="Maximum allowed audio recording length in seconds."
    )
    # Dung lượng tối đa cho phép của file âm thanh tải lên (tính theo MB)
    MAX_UPLOAD_SIZE_MB: int = Field(
        default=15,
        description="Maximum multipart payload size in megabytes."
    )

    # --------------------------------------------------------------------------
    # 3. Cấu hình phát hiện tiếng nói và khoảng ngắt nghỉ (Speech & Pause Detection)
    # --------------------------------------------------------------------------
    # Ngưỡng thời gian im lặng (ms) trở lên để tính là một lần ngắt nghỉ giữa các từ/cụm
    PAUSE_THRESHOLD_MS: float = Field(
        default=250.0,
        description="Threshold (ms) above which silent gaps are classified as pauses."
    )
    # Ngưỡng thời gian im lặng (ms, mặc định 1000 ms = 1 giây) bị coi là ngập ngừng kéo dài
    LONG_PAUSE_THRESHOLD_MS: float = Field(
        default=1000.0,
        description="Threshold (ms) for hesitations considered long pauses."
    )

    # --------------------------------------------------------------------------
    # 4. Cấu hình trọng số chấm điểm và tốc độ nói mục tiêu (Scoring Weights & Speed)
    # --------------------------------------------------------------------------
    # Trọng số điểm phát âm (chiếm 60% điểm tổng hợp)
    PRONUNCIATION_WEIGHT: float = Field(
        default=0.60,
        description="Weight of pronunciation score in overall score calculation."
    )
    # Trọng số điểm độ trôi chảy (chiếm 28% điểm tổng hợp)
    FLUENCY_WEIGHT: float = Field(
        default=0.28,
        description="Weight of fluency score in overall score calculation."
    )
    # Trọng số điểm tốc độ nói/ngữ điệu (chiếm 12% điểm tổng hợp)
    SPEED_WEIGHT: float = Field(
        default=0.12,
        description="Weight of speed/prosody score in overall score calculation."
    )
    # Tốc độ nói lý tưởng tối thiểu (số âm tiết phát âm trên mỗi giây)
    SPEED_TARGET_MIN: float = Field(
        default=3.5,
        description="Optimal minimum speech rate in spoken syllables per second."
    )
    # Tốc độ nói lý tưởng tối đa (số âm tiết phát âm trên mỗi giây)
    SPEED_TARGET_MAX: float = Field(
        default=5.5,
        description="Optimal maximum speech rate in spoken syllables per second."
    )

    # --------------------------------------------------------------------------
    # 5. Cấu hình ngưỡng độ tin cậy tối thiểu (Threshold Confidence Configurations)
    # --------------------------------------------------------------------------
    # Ngưỡng tin cậy căn chỉnh tối thiểu để chấp nhận phân đoạn âm vị (thấp hơn thường do đọc lệch câu mẫu)
    MIN_ALIGNMENT_CONFIDENCE: float = Field(
        default=0.15,
        description="Minimum alignment confidence required to trust phoneme segmentation."
    )
    # Ngưỡng điểm chất lượng âm thanh tối thiểu (dưới ngưỡng này bản ghi âm bị từ chối vì nhiễu/kém)
    MIN_AUDIO_CONFIDENCE: float = Field(
        default=0.45,
        description="Minimum audio quality score before rejecting audio recording."
    )

    # --------------------------------------------------------------------------
    # 5b. Cấu hình phát hiện từ đọc sót / chưa đọc (Missing-word detection)
    # --------------------------------------------------------------------------
    # Điểm phạt log-xác suất trên mỗi âm vị khi thuật toán CTC Viterbi chọn bỏ qua (skip) cả một từ mẫu.
    # Ép gán vào khoảng lặng/nhiễu tốn ~8-10 nats, gán vào từ đọc sai nhưng có phát tiếng tốn ~1-2 nats,
    # nên mức 4.0 giúp thuật toán chỉ bỏ qua đúng những từ hoàn toàn không được đọc.
    WORD_SKIP_PENALTY_PER_TOKEN: float = Field(
        default=4.0,
        description=(
            "Log-probability penalty per phoneme token for letting the CTC Viterbi skip a whole "
            "reference word. Forcing a token onto silence/noise costs ~8-10 nats, onto a "
            "mispronounced-but-spoken segment ~1-2 nats, so 4.0 skips only absent words."
        )
    )
    # Khoảng đệm an toàn (giây) giữ lại hai bên vùng tiếng nói khi cắt khoảng lặng đầu/cuối file
    SPEECH_TRIM_MARGIN_SEC: float = Field(
        default=0.25,
        description="Margin kept around the VAD speech region when trimming leading/trailing silence."
    )
    # Ngưỡng xác suất hậu nghiệm CTC thô trung bình; thấp hơn mức này từ bị coi là không có bằng chứng âm học (MISSING)
    MISSING_WORD_MIN_RAW_POSTERIOR: float = Field(
        default=0.02,
        description="Below this mean raw CTC posterior a word has no reliable acoustic evidence (MISSING)."
    )
    # Tỷ lệ giữa năng lượng RMS của từ và RMS trung vị cả câu; thấp hơn mức này bị xem là khoảng lặng (MISSING)
    MISSING_WORD_MIN_ENERGY_RATIO: float = Field(
        default=0.06,
        description="Word RMS / median speech RMS below which the word segment is treated as silence (MISSING)."
    )
    # Tỷ lệ số âm vị tối thiểu trong từ phải có bằng chứng âm học; thấp hơn mức này từ bị đánh dấu đọc thiếu (PARTIAL)
    PARTIAL_WORD_MIN_EVIDENCE_RATIO: float = Field(
        default=0.5,
        description="If fewer than this fraction of a word's phonemes have acoustic evidence, the word is PARTIAL."
    )

    # --------------------------------------------------------------------------
    # 6. Cấu hình đường dẫn hồ sơ chuẩn và giới hạn thời gian xử lý
    # --------------------------------------------------------------------------
    # Đường dẫn tới file JSON lưu phân phối tần số formant (F1, F2) chuẩn của người bản ngữ cho các nguyên âm
    VOWEL_PROFILE_PATH: Path = Field(
        default=Path("reference_profiles/vowels.json"),
        description="Path to native speaker formant reference distributions."
    )
    # Đường dẫn tới file JSON chứa tham số hiệu chỉnh điểm được khớp thực nghiệm từ SpeechOcean762/LibriSpeech
    CALIBRATION_PROFILE_PATH: Path = Field(
        default=Path("reference_profiles/calibration.json"),
        description="Path to SpeechOcean762/LibriSpeech empirically fitted calibration weights."
    )
    # Thời gian tối đa (giây) cho phép chạy bước căn chỉnh và phân tích formant trước khi ngắt quá hạn
    INFERENCE_TIMEOUT_SEC: float = Field(
        default=60.0,
        description="Timeout limit (seconds) for running alignment and formant analysis."
    )

    @model_validator(mode="after")
    def validate_weights(self) -> "Settings":
        """Kiểm tra tổng ba trọng số (phát âm + trôi chảy + tốc độ) phải bằng 1.0 (sai số cho phép ±0.01)."""
        total_w = self.PRONUNCIATION_WEIGHT + self.FLUENCY_WEIGHT + self.SPEED_WEIGHT
        if not (0.99 <= total_w <= 1.01):
            raise ValueError(
                f"Scoring weights must sum to 1.0, current sum is {total_w:.2f}"
            )
        return self


# Thể hiện cấu hình dùng chung duy nhất (singleton) trên toàn bộ ứng dụng
settings = Settings()
