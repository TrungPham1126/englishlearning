import os
from pathlib import Path
from typing import Literal

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
    Central Configuration for Speech Assessment Engine.
    Fully configurable via Environment Variables or .env file.
    No scoring parameters or thresholds are hardcoded in application logic.
    """
    if HAS_PYDANTIC_SETTINGS:
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            case_sensitive=True,
            extra="ignore"
        )

    # --------------------------------------------------------------------------
    # 1. Model Configurations
    # --------------------------------------------------------------------------
    MODEL_NAME: str = Field(
        default="facebook/wav2vec2-xlsr-53-espeak-cv-ft",
        description="Hugging Face model checkpoint for phoneme recognition & CTC alignment."
    )
    MODEL_DEVICE: Literal["cpu", "cuda"] = Field(
        default="cpu",
        description="Device to run neural inference ('cpu' or 'cuda')."
    )
    MODEL_CACHE_DIR: Path = Field(
        default=Path("cache/huggingface"),
        description="Directory for caching downloaded pre-trained models."
    )

    # --------------------------------------------------------------------------
    # 2. Audio Processing Configurations
    # --------------------------------------------------------------------------
    SAMPLE_RATE: int = Field(
        default=16000,
        description="Standardized audio sample rate required by Wav2Vec2 & Praat."
    )
    MIN_AUDIO_DURATION: float = Field(
        default=0.4,
        description="Minimum allowed audio recording length in seconds."
    )
    MAX_AUDIO_DURATION: float = Field(
        default=45.0,
        description="Maximum allowed audio recording length in seconds."
    )
    MAX_UPLOAD_SIZE_MB: int = Field(
        default=15,
        description="Maximum multipart payload size in megabytes."
    )

    # --------------------------------------------------------------------------
    # 3. Speech & Pause Detection Configurations
    # --------------------------------------------------------------------------
    PAUSE_THRESHOLD_MS: float = Field(
        default=250.0,
        description="Threshold (ms) above which silent gaps are classified as pauses."
    )
    LONG_PAUSE_THRESHOLD_MS: float = Field(
        default=1000.0,
        description="Threshold (ms) for hesitations considered long pauses."
    )

    # --------------------------------------------------------------------------
    # 4. Scoring Weights & Target Speed Configurations
    # --------------------------------------------------------------------------
    PRONUNCIATION_WEIGHT: float = Field(
        default=0.50,
        description="Weight of pronunciation score in overall score calculation."
    )
    FLUENCY_WEIGHT: float = Field(
        default=0.30,
        description="Weight of fluency score in overall score calculation."
    )
    SPEED_WEIGHT: float = Field(
        default=0.20,
        description="Weight of speed score in overall score calculation."
    )
    SPEED_TARGET_MIN: float = Field(
        default=3.5,
        description="Optimal minimum speech rate in spoken syllables per second."
    )
    SPEED_TARGET_MAX: float = Field(
        default=5.0,
        description="Optimal maximum speech rate in spoken syllables per second."
    )

    # --------------------------------------------------------------------------
    # 5. Threshold Confidence Configurations
    # --------------------------------------------------------------------------
    MIN_ALIGNMENT_CONFIDENCE: float = Field(
        default=0.15,
        description="Minimum alignment confidence required to trust phoneme segmentation."
    )
    MIN_AUDIO_CONFIDENCE: float = Field(
        default=0.45,
        description="Minimum audio quality score before rejecting audio recording."
    )

    # --------------------------------------------------------------------------
    # 5b. Missing-word (unread word) detection
    # --------------------------------------------------------------------------
    WORD_SKIP_PENALTY_PER_TOKEN: float = Field(
        default=4.0,
        description=(
            "Log-probability penalty per phoneme token for letting the CTC Viterbi skip a whole "
            "reference word. Forcing a token onto silence/noise costs ~8-10 nats, onto a "
            "mispronounced-but-spoken segment ~1-2 nats, so 4.0 skips only absent words."
        )
    )
    SPEECH_TRIM_MARGIN_SEC: float = Field(
        default=0.25,
        description="Margin kept around the VAD speech region when trimming leading/trailing silence."
    )
    MISSING_WORD_MIN_RAW_POSTERIOR: float = Field(
        default=0.02,
        description="Below this mean raw CTC posterior a word has no reliable acoustic evidence (MISSING)."
    )
    MISSING_WORD_MIN_ENERGY_RATIO: float = Field(
        default=0.06,
        description="Word RMS / median speech RMS below which the word segment is treated as silence (MISSING)."
    )
    PARTIAL_WORD_MIN_EVIDENCE_RATIO: float = Field(
        default=0.5,
        description="If fewer than this fraction of a word's phonemes have acoustic evidence, the word is PARTIAL."
    )

    # --------------------------------------------------------------------------
    # 6. Vowel Reference Profile & Path Config
    # --------------------------------------------------------------------------
    VOWEL_PROFILE_PATH: Path = Field(
        default=Path("reference_profiles/vowels.json"),
        description="Path to native speaker formant reference distributions."
    )
    INFERENCE_TIMEOUT_SEC: float = Field(
        default=15.0,
        description="Timeout limit (seconds) for running alignment and formant analysis."
    )

    @model_validator(mode="after")
    def validate_weights(self) -> "Settings":
        total_w = self.PRONUNCIATION_WEIGHT + self.FLUENCY_WEIGHT + self.SPEED_WEIGHT
        if not (0.99 <= total_w <= 1.01):
            raise ValueError(
                f"Scoring weights must sum to 1.0, current sum is {total_w:.2f}"
            )
        return self


# Global singleton instance
settings = Settings()
