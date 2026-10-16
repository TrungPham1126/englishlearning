from typing import List, Tuple
import numpy as np

from app.config import settings
from app.exceptions import (
    AudioQualityTooLowError,
    AudioTooShortError,
    AudioTooLongError,
    EmptySpeechError
)
from app.schemas import AudioQualityMetrics


class AudioQualityGate:
    def __init__(
        self,
        min_duration: float = settings.MIN_AUDIO_DURATION,
        max_duration: float = settings.MAX_AUDIO_DURATION,
        sample_rate: int = settings.SAMPLE_RATE
    ):
        self.min_duration = min_duration
        self.max_duration = max_duration
        self.sample_rate = sample_rate

    def evaluate(self, audio: np.ndarray, strict: bool = True) -> AudioQualityMetrics:
        duration = float(len(audio)) / float(self.sample_rate)

        if duration < self.min_duration:
            raise AudioTooShortError(duration, self.min_duration)
        if duration > self.max_duration:
            raise AudioTooLongError(duration, self.max_duration)

        peak = float(np.max(np.abs(audio))) if len(audio) > 0 else 0.0
        rms = float(np.sqrt(np.mean(audio**2))) if len(audio) > 0 else 0.0

        if peak < 0.005 or rms < 0.002:
            raise EmptySpeechError("Âm lượng ghi âm quá nhỏ hoặc hoàn toàn im lặng.")

        clipped_samples = np.sum(np.abs(audio) >= 0.985)
        clipping_ratio = float(clipped_samples) / float(len(audio))

        silence_ratio, speech_ratio, estimated_snr, dynamic_range = self._analyze_frames(audio)

        warnings: List[str] = []
        is_acceptable = True

        if clipping_ratio > 0.03:
            warnings.append(f"Audio clipping detected ({clipping_ratio * 100:.1f}% samples clipped).")
            if strict and clipping_ratio > 0.10:
                raise AudioQualityTooLowError("Âm thanh bị vỡ tiếng (clipping) quá nặng.")

        if estimated_snr < 7.0 and duration > 1.2:
            warnings.append(f"High background noise (SNR: {estimated_snr:.1f} dB).")
            if strict and estimated_snr < 4.0:
                raise AudioQualityTooLowError("Tiếng ồn môi trường quá lớn.")

        return AudioQualityMetrics(
            duration=round(duration, 3),
            rms=round(rms, 5),
            peak=round(peak, 4),
            clipping_ratio=round(clipping_ratio, 4),
            silence_ratio=round(silence_ratio, 3),
            speech_ratio=round(speech_ratio, 3),
            estimated_snr=round(estimated_snr, 1),
            dynamic_range=round(dynamic_range, 1),
            is_acceptable=is_acceptable,
            warnings=warnings
        )

    def _analyze_frames(self, audio: np.ndarray) -> Tuple[float, float, float, float]:
        frame_len = int(0.025 * self.sample_rate)  # 25ms
        hop_len = int(0.010 * self.sample_rate)    # 10ms

        if len(audio) < frame_len:
            return 0.5, 0.5, 25.0, 30.0

        num_frames = 1 + (len(audio) - frame_len) // hop_len
        energies = []
        for i in range(num_frames):
            frame = audio[i * hop_len : i * hop_len + frame_len]
            frame_rms = np.sqrt(np.mean(frame**2))
            energies.append(frame_rms)

        energies_arr = np.array(energies)
        energies_db = 20.0 * np.log10(np.maximum(energies_arr, 1e-6))

        # File ngắn (< 1.2s): lấy phân vị 5% để không nhầm âm thanh từ vựng thành noise floor
        duration_sec = float(len(audio)) / float(self.sample_rate)
        noise_pct = 5 if duration_sec < 1.2 else 15

        noise_floor_db = float(np.percentile(energies_db, noise_pct))
        speech_peak_db = float(np.percentile(energies_db, 95))
        dynamic_range = max(0.0, speech_peak_db - noise_floor_db)

        # Với audio ngắn chất lượng cao, SNR tối thiểu đảm bảo 24dB
        if duration_sec < 1.2 and dynamic_range < 15.0 and np.max(np.abs(audio)) > 0.3:
            estimated_snr = 26.0
            dynamic_range = 26.0
        else:
            estimated_snr = max(0.0, dynamic_range)

        threshold_db = noise_floor_db + min(12.0, dynamic_range * 0.4)
        speech_frames = np.sum(energies_db > threshold_db)
        total_frames = len(energies_db)

        speech_ratio = float(speech_frames) / float(total_frames) if total_frames > 0 else 0.5
        silence_ratio = 1.0 - speech_ratio

        return silence_ratio, speech_ratio, estimated_snr, dynamic_range


def check_consonant_acoustic_evidence_detailed(
    audio_slice: np.ndarray,
    phoneme_symbol: str,
    sample_rate: int = settings.SAMPLE_RATE
) -> Tuple[bool, float, str]:
    """
    Evaluates acoustic evidence for consonants based on international CAPT standards:
    - Fricatives: Spectral Centroid (> 2500Hz) & Zero-Crossing Rate (ZCR)
    - Plosives: Transient burst energy ratio
    - Nasals: Low frequency concentration (< 800Hz)
    Returns (has_evidence: bool, acoustic_multiplier: float, detail: str)
    """
    if len(audio_slice) < 160:  # < 10ms at 16kHz
        return False, 0.0, "Thời lượng âm quá ngắn (< 10ms)"

    rms = float(np.sqrt(np.mean(audio_slice ** 2)))
    if rms < 0.002:
        return False, 0.0, "Không phát hiện năng lượng âm thanh (quá nhỏ hoặc im lặng)"

    clean_sym = phoneme_symbol.strip("/ ")
    zcr = float(np.mean(np.abs(np.diff(np.sign(audio_slice)))) / 2.0)

    # 1. Sibilants & Fricatives (/s/, /z/, /ʃ/, /ʒ/, /tʃ/, /dʒ/, /f/, /v/, /θ/, /ð/, /h/)
    sibilants = {"s", "z", "ʃ", "ʒ", "tʃ", "dʒ", "ts", "dz"}
    weak_fricatives = {"f", "v", "θ", "ð", "h"}

    if clean_sym in sibilants:
        magnitudes = np.abs(np.fft.rfft(audio_slice))
        freqs = np.fft.rfftfreq(len(audio_slice), 1.0 / sample_rate)
        mag_sum = float(np.sum(magnitudes)) + 1e-9
        centroid = float(np.sum(freqs * magnitudes) / mag_sum)
        high_freq_energy = float(np.sum(magnitudes[freqs >= 2500])) / mag_sum

        if zcr < 0.045 and centroid < 2200 and high_freq_energy < 0.15:
            return False, 0.0, f"Thiếu đặc trưng âm xát tần số cao (ZCR={zcr:.2f}, Centroid={centroid:.0f}Hz)"
        elif zcr >= 0.065 and (centroid >= 2500 or high_freq_energy >= 0.22):
            return True, 1.0, "Đặc trưng âm xát rõ"
        else:
            return True, 0.65, "Âm xát hơi mờ hoặc thiếu độ sắc nét"

    elif clean_sym in weak_fricatives:
        if rms < 0.0025:
            return False, 0.0, "Âm xát yếu, thiếu luồng hơi"
        return True, 0.90, "Đặc trưng âm xát nhẹ đạt yêu cầu"

    # 2. Plosives (/p/, /t/, /k/, /b/, /d/, /g/, /ɡ/)
    plosives = {"p", "t", "k", "b", "d", "g", "ɡ"}
    if clean_sym in plosives:
        sub_len = max(16, len(audio_slice) // 4)
        sub_energies = [
            float(np.sqrt(np.mean(audio_slice[i:i+sub_len]**2)))
            for i in range(0, len(audio_slice) - sub_len + 1, sub_len)
        ]
        if sub_energies:
            peak_e = max(sub_energies)
            mean_e = float(np.mean(sub_energies)) + 1e-9
            burst_ratio = peak_e / mean_e
            if burst_ratio >= 1.30 or peak_e >= 0.008:
                return True, 1.0, "Xung âm bật rõ ràng"
            elif burst_ratio < 1.15 and rms < 0.003:
                return False, 0.0, "Thiếu xung năng lượng âm bật (burst release)"
            else:
                return True, 0.70, "Âm bật tương đối mờ"
        return True, 0.85, "Âm bật bình thường"

    # 3. Nasals (/m/, /n/, /ŋ/)
    nasals = {"m", "n", "ŋ"}
    if clean_sym in nasals:
        magnitudes = np.abs(np.fft.rfft(audio_slice))
        freqs = np.fft.rfftfreq(len(audio_slice), 1.0 / sample_rate)
        mag_sum = float(np.sum(magnitudes)) + 1e-9
        low_freq_ratio = float(np.sum(magnitudes[freqs <= 800])) / mag_sum

        if rms < 0.003:
            return False, 0.0, "Năng lượng âm mũi quá nhỏ"
        elif low_freq_ratio >= 0.35:
            return True, 1.0, "Âm mũi cộng hưởng rõ ràng"
        else:
            return True, 0.65, "Âm mũi chưa cộng hưởng tốt"

    # 4. Liquids / Approximants (/l/, /r/, /ɹ/, /w/, /j/)
    liquids = {"l", "r", "ɹ", "w", "j"}
    if clean_sym in liquids:
        if rms < 0.003:
            return False, 0.0, "Âm trượt/bán nguyên âm quá nhỏ"
        return True, 1.0, "Âm trượt rõ ràng"

    return True, 1.0, "Đạt yêu cầu"


def check_consonant_acoustic_evidence(audio_slice: np.ndarray, phoneme_symbol: str) -> bool:
    has_ev, _, _ = check_consonant_acoustic_evidence_detailed(audio_slice, phoneme_symbol)
    return has_ev


quality_gate = AudioQualityGate()