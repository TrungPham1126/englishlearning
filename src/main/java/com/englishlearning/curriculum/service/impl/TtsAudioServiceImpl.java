package com.englishlearning.curriculum.service.impl;

import com.englishlearning.curriculum.service.*;

import com.englishlearning.assignment.service.ExerciseAudioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
@Slf4j
public class TtsAudioServiceImpl implements TtsAudioService {

    private final ExerciseAudioService exerciseAudioService;

    @Override
    public String synthesizeTtsAudio(String text, String voice) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Nội dung văn bản để tổng hợp âm thanh không được để trống.");
        }
        String effectiveVoice = (voice != null && !voice.isBlank())
                ? ExerciseAudioService.normalizeKokoroVoice(voice)
                : "af_heart";

        log.info("Tổng hợp âm thanh TTS cho câu: '{}' với giọng: {}", text, effectiveVoice);
        return exerciseAudioService.synthesizeRawScriptToUrl(text, effectiveVoice, 1.0);
    }

    @Override
    public byte[] synthesizeTtsAudioBytes(String text, String voice) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Nội dung văn bản để tổng hợp âm thanh không được để trống.");
        }
        String audioUrl = synthesizeTtsAudio(text, voice);
        return (audioUrl != null) ? audioUrl.getBytes(StandardCharsets.UTF_8) : new byte[0];
    }
}
