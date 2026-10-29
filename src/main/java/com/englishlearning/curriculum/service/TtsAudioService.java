package com.englishlearning.curriculum.service;

public interface TtsAudioService {

    /**
     * Tổng hợp giọng nói TTS cho văn bản bài học/câu hỏi và trả về URL audio.
     */
    String synthesizeTtsAudio(String text, String voice);

    /**
     * Tổng hợp giọng nói TTS và trả về byte array dữ liệu âm thanh.
     */
    byte[] synthesizeTtsAudioBytes(String text, String voice);
}
