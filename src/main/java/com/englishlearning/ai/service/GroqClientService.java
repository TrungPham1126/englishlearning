package com.englishlearning.ai.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface GroqClientService {

    String transcribeAudio(MultipartFile audioFile);

    String transcribeAudio(byte[] audioBytes, String filename);

    String transcribeAudioVerbose(byte[] audioBytes, String filename);

    String chatCompletionJson(String systemInstruction, String userPrompt);

    String chatCompletionJson(String systemInstruction, String userPrompt, double temperature);

    String chatCompletionJson(String systemInstruction, String userPrompt, double temperature,
            UUID explicitUserId, Boolean explicitIsTeacher);

    static String stripMarkdown(String text) {
        if (text == null) return "{}";
        String s = text.trim();
        if (s.startsWith("```json")) {
            s = s.substring(7);
        } else if (s.startsWith("```")) {
            s = s.substring(3);
        }
        if (s.endsWith("```")) {
            s = s.substring(0, s.length() - 3);
        }
        return s.trim();
    }
}
