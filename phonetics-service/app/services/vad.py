"""
Module phát hiện hoạt động giọng nói (VAD - Voice Activity Detection) và phân tích nhịp độ thời gian.

Chịu trách nhiệm tách vùng có giọng nói khỏi vùng im lặng, tính thời gian phát âm thực tế
và phát hiện/phân loại các khoảng ngắt nghỉ (ngắt theo dấu câu, ngập ngừng, hoặc ngừng quá lâu).
"""

from typing import List, Tuple
import numpy as np

from app.config import settings
from app.models.alignment import PauseEvent, SpeechSegment


class SpeechDetector:
    """
    Dịch vụ Phát hiện Hoạt động Giọng nói (VAD) & Phân đoạn Thời gian.
    Thực hiện đo lường các thông số:
    - Phân tách vùng có giọng nói và vùng im lặng/nhiễu nền
    - Thời gian nói tổng thể (Speaking time) so với thời gian phát âm thực tế (Articulation time)
    - Phát hiện và phân loại các sự kiện ngắt nghỉ: tự nhiên theo dấu câu, ngập ngừng, hoặc ngừng lâu
    """

    def __init__(
        self,
        sample_rate: int = settings.SAMPLE_RATE,
        pause_threshold_ms: float = settings.PAUSE_THRESHOLD_MS,
        long_pause_threshold_ms: float = settings.LONG_PAUSE_THRESHOLD_MS
    ):
        """Khởi tạo bộ phát hiện giọng nói và quy đổi các ngưỡng ngắt nghỉ từ mili-giây sang giây."""
        self.sample_rate = sample_rate
        self.pause_threshold_sec = pause_threshold_ms / 1000.0
        self.long_pause_threshold_sec = long_pause_threshold_ms / 1000.0

    def detect(self, audio: np.ndarray) -> List[SpeechSegment]:
        """
        Phát hiện các đoạn có giọng nói liên tục dựa trên năng lượng ngắn hạn theo ngưỡng động
        và bước làm mượt để loại bỏ nhiễu chớp nhoáng hoặc khoảng lặng nhỏ giữa các âm tiết.
        """
        frame_ms = 25
        hop_ms = 10
        frame_len = int(frame_ms * self.sample_rate / 1000)
        hop_len = int(hop_ms * self.sample_rate / 1000)

        if len(audio) < frame_len:
            dur = len(audio) / self.sample_rate
            return [SpeechSegment(start=0.0, end=dur, is_speech=True)]

        # Chia sóng âm thành từng khung 25ms trượt 10ms và tính năng lượng RMS cho mỗi khung
        num_frames = 1 + (len(audio) - frame_len) // hop_len
        frame_energies = np.zeros(num_frames)

        for i in range(num_frames):
            frame = audio[i * hop_len : i * hop_len + frame_len]
            frame_energies[i] = np.sqrt(np.mean(frame**2))

        # Tính ngưỡng năng lượng động dựa trên ước lượng tiếng ồn nền (phân vị 20%) và đỉnh giọng nói (phân vị 95%)
        noise_energy = np.percentile(frame_energies, 20)
        peak_energy = np.percentile(frame_energies, 95)
        energy_threshold = noise_energy + 0.15 * max(0.01, peak_energy - noise_energy)

        # Tạo mặt nạ nhị phân (True/False) đánh dấu những khung hình vượt ngưỡng năng lượng giọng nói
        raw_speech_mask = frame_energies > energy_threshold

        # Làm mượt hình thái học: lấp khoảng ngắt nhỏ giữa từ (< 120ms) và bỏ qua tiếng động ngắn bất thường (< 80ms)
        min_silence_frames = int(120 / hop_ms)
        min_speech_frames = int(80 / hop_ms)

        smoothed_mask = raw_speech_mask.copy()
        # 1. Nối liền các khoảng lặng ngắn nằm giữa hai vùng giọng nói (không bao giờ lấp khoảng lặng ở đầu file)
        gap_count = 0
        seen_speech = False
        for i in range(len(smoothed_mask)):
            if not smoothed_mask[i]:
                gap_count += 1
            else:
                if seen_speech and 0 < gap_count < min_silence_frames:
                    smoothed_mask[i - gap_count : i] = True
                seen_speech = True
                gap_count = 0

        # Chuyển đổi mặt nạ khung hình thành danh sách các đoạn giọng nói liên tục (SpeechSegment)
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

        # Đóng đoạn giọng nói cuối cùng nếu người nói phát âm tới sát cuối file ghi âm
        if in_speech and (num_frames - start_frame) >= min_speech_frames:
            segments.append(
                SpeechSegment(
                    start=round(start_frame * hop_ms / 1000.0, 3),
                    end=round(num_frames * hop_ms / 1000.0, 3),
                    is_speech=True
                )
            )

        if not segments:
            # Phương án dự phòng: nếu không có khung nào vượt ngưỡng, xem toàn bộ file là một đoạn nói
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
        Tính toán các chỉ số về thời gian và nhịp độ nói:
        - speaking_time: khoảng thời gian từ âm tiết đầu tiên đến âm tiết cuối cùng (gồm cả khoảng nghỉ giữa câu)
        - articulation_time: thời gian phát âm thực tế (chỉ cộng dồn các đoạn có tiếng nói, loại bỏ khoảng im lặng)
        - pause_events: danh sách các sự kiện ngắt nghỉ được phân loại và gán điểm phạt độ trôi chảy
        """
        if not speech_segments:
            return audio_duration, audio_duration, []

        punc_times = punctuation_timestamps or []
        first_onset = speech_segments[0].start
        last_offset = speech_segments[-1].end
        speaking_time = max(0.1, last_offset - first_onset)

        pause_events: List[PauseEvent] = []
        total_pause_duration = 0.0

        # Duyệt từng khoảng trống nằm giữa hai đoạn nói liên tiếp để phát hiện ngập ngừng hoặc ngắt dài
        for i in range(len(speech_segments) - 1):
            gap_start = speech_segments[i].end
            gap_end = speech_segments[i + 1].start
            gap_dur = gap_end - gap_start

            if gap_dur >= self.pause_threshold_sec:
                total_pause_duration += gap_dur

                # Kiểm tra khoảng nghỉ có nằm sát vị trí dấu câu (trong phạm vi 0.35 giây) hay không
                is_near_punctuation = any(abs(gap_start - pt) < 0.35 or abs(gap_end - pt) < 0.35 for pt in punc_times)

                if is_near_punctuation:
                    # Ngắt nghỉ tự nhiên tại dấu phẩy/chấm -> không trừ điểm trôi chảy
                    pause_type = "punctuation"
                    penalty = 0.0
                elif gap_dur >= self.long_pause_threshold_sec:
                    # Ngừng quá lâu giữa mạch nói -> trừ điểm nặng
                    pause_type = "long_pause"
                    penalty = min(25.0, 8.0 + (gap_dur - self.long_pause_threshold_sec) * 10.0)
                else:
                    # Ngập ngừng ngắn giữa các từ -> trừ điểm vừa phải
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

        # Thời gian phát âm thực tế = tổng thời lượng của các đoạn có giọng nói hoạt động
        articulation_time = max(0.1, sum(seg.duration for seg in speech_segments))

        return speaking_time, articulation_time, pause_events


# Thể hiện dùng chung duy nhất (singleton) của bộ phát hiện giọng nói VAD
speech_detector = SpeechDetector()
