package com.englishlearning.curriculum.service;

import com.englishlearning.assignment.service.ExerciseAudioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class TtsService {

    private final ExerciseAudioService exerciseAudioService;

    /**
     * Tổng hợp giọng nói tiếng Anh tự nhiên bằng mô hình Kokoro-82M Neural TTS (hỗ trợ cả hội thoại đa giọng đọc và đơn thoại).
     *
     * @param text     Nội dung văn bản hoặc kịch bản hội thoại cần đọc
     * @param voice    Tên giọng đọc Kokoro-82M (af_heart, am_michael, bf_emma, bm_george) hoặc legacy voice
     * @param speedStr Tốc độ đọc (0.75x, 1.0x, 1.25x, 1.5x)
     * @return URL của file audio WAV/MP3 đã lưu trữ trên R2 / Local
     */
    public String synthesizeAudio(String text, String voice, String speedStr) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Nội dung văn bản để tổng hợp âm thanh không được để trống.");
        }

        double speed = parseSpeed(speedStr);
        String effectiveVoice = ExerciseAudioService.normalizeKokoroVoice(voice);
        log.info("Tổng hợp Kokoro-82M TTS qua TtsService: voice='{}', speed={}", effectiveVoice, speed);

        return exerciseAudioService.synthesizeRawScriptToUrl(text, effectiveVoice, speed);
    }

    private double parseSpeed(String speedStr) {
        if (speedStr == null || speedStr.isBlank()) {
            return 1.0;
        }
        String clean = speedStr.replace("x", "").replace("X", "").trim();
        try {
            double s = Double.parseDouble(clean);
            return Math.max(0.5, Math.min(2.0, s));
        } catch (Exception e) {
            return 1.0;
        }
    }
}

