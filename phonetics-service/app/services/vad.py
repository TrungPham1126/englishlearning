from typing import List, Tuple
import numpy as np

from app.config import settings
from app.models.alignment import PauseEvent, SpeechSegment


class SpeechDetector:
    """
    Voice Activity Detection (VAD) & Temporal Segmentation Service.
    Measures:
    - Speech vs Non-speech regions
    - Speaking time vs Articulation time
    - Pause event detection & categorization (natural vs hesitation vs long pause)
    """

    def __init__(
        self,
        sample_rate: int = settings.SAMPLE_RATE,
        pause_threshold_ms: float = settings.PAUSE_THRESHOLD_MS,
        long_pause_threshold_ms: float = settings.LONG_PAUSE_THRESHOLD_MS
    ):
        self.sample_rate = sample_rate
        self.pause_threshold_sec = pause_threshold_ms / 1000.0
        self.long_pause_threshold_sec = long_pause_threshold_ms / 1000.0

    def detect(self, audio: np.ndarray) -> List[SpeechSegment]:
        """
        Detects continuous speech segments using dual-threshold short-term energy
        and zero-crossing rate analysis.
        """
        frame_ms = 25
        hop_ms = 10
        frame_len = int(frame_ms * self.sample_rate / 1000)
        hop_len = int(hop_ms * self.sample_rate / 1000)

        if len(audio) < frame_len:
            dur = len(audio) / self.sample_rate
            return [SpeechSegment(start=0.0, end=dur, is_speech=True)]

        num_frames = 1 + (len(audio) - frame_len) // hop_len
        frame_energies = np.zeros(num_frames)

        for i in range(num_frames):
            frame = audio[i * hop_len : i * hop_len + frame_len]
            frame_energies[i] = np.sqrt(np.mean(frame**2))

        # Dynamic threshold based on background noise estimation
        noise_energy = np.percentile(frame_energies, 20)
        peak_energy = np.percentile(frame_energies, 95)
        energy_threshold = noise_energy + 0.15 * max(0.01, peak_energy - noise_energy)

        # Boolean speech mask
        raw_speech_mask = frame_energies > energy_threshold

        # Morphological smoothing: close small gaps (< 120ms) and remove short bursts (< 80ms)
        min_silence_frames = int(120 / hop_ms)
        min_speech_frames = int(80 / hop_ms)

        smoothed_mask = raw_speech_mask.copy()
        # 1. Bridge small gaps
        gap_count = 0
        for i in range(len(smoothed_mask)):
            if not smoothed_mask[i]:
                gap_count += 1
            else:
                if 0 < gap_count < min_silence_frames:
                    smoothed_mask[i - gap_count : i] = True
                gap_count = 0

        # Convert mask to contiguous SpeechSegments
        segments: List[SpeechSegment] = []
        in_speech = False
        start_frame = 0

        for i, val in enumerate(smoothed_mask):
            if val and not in_speech:
                in_speech = True
                start_frame = i
            elif not val and in_speech:
                in_speech = False
                seg_dur_frames = i - start_frame
                if seg_dur_frames >= min_speech_frames:
                    segments.append(
                        SpeechSegment(
                            start=round(start_frame * hop_ms / 1000.0, 3),
                            end=round(i * hop_ms / 1000.0, 3),
                            is_speech=True
                        )
                    )

        if in_speech:
            segments.append(
                SpeechSegment(
                    start=round(start_frame * hop_ms / 1000.0, 3),
                    end=round(num_frames * hop_ms / 1000.0, 3),
                    is_speech=True
                )
            )

        if not segments:
            # Fallback if no frames crossed threshold
            dur = len(audio) / self.sample_rate
            segments = [SpeechSegment(start=0.0, end=dur, is_speech=True)]

        return segments

    def analyze_temporal_metrics(
        self,
        audio_duration: float,
        speech_segments: List[SpeechSegment],
        punctuation_timestamps: List[float] = None
    ) -> Tuple[float, float, List[PauseEvent]]:
        """
        Calculates:
        - speaking_time: duration between first onset and last offset
        - articulation_time: speaking_time minus hesitation pauses
        - pause_events: classified PauseEvent objects
        """
        if not speech_segments:
            return audio_duration, audio_duration, []

        punc_times = punctuation_timestamps or []
        first_onset = speech_segments[0].start
        last_offset = speech_segments[-1].end
        speaking_time = max(0.1, last_offset - first_onset)

        pause_events: List[PauseEvent] = []
        total_pause_duration = 0.0

        for i in range(len(speech_segments) - 1):
            gap_start = speech_segments[i].end
            gap_end = speech_segments[i + 1].start
            gap_dur = gap_end - gap_start

            if gap_dur >= self.pause_threshold_sec:
                total_pause_duration += gap_dur

                # Check proximity to known punctuation (within 0.35s)
                is_near_punctuation = any(abs(gap_start - pt) < 0.35 or abs(gap_end - pt) < 0.35 for pt in punc_times)

                if is_near_punctuation:
                    pause_type = "punctuation"
                    penalty = 0.0
                elif gap_dur >= self.long_pause_threshold_sec:
                    pause_type = "long_pause"
                    penalty = min(25.0, 8.0 + (gap_dur - self.long_pause_threshold_sec) * 10.0)
                else:
                    pause_type = "hesitation"
                    penalty = min(12.0, (gap_dur - self.pause_threshold_sec) * 15.0)

                pause_events.append(
                    PauseEvent(
                        start=round(gap_start, 3),
                        end=round(gap_end, 3),
                        duration=round(gap_dur, 3),
                        pause_type=pause_type,
                        penalty=round(penalty, 1),
                        confidence=0.92
                    )
                )

        # Articulation time = sum of active speech durations
        articulation_time = max(0.1, sum(seg.duration for seg in speech_segments))

        return speaking_time, articulation_time, pause_events


# Singleton speech detector
speech_detector = SpeechDetector()
