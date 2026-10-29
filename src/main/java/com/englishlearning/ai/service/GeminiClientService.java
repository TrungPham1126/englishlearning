package com.englishlearning.ai.service;

import java.util.UUID;

public interface GeminiClientService {

    String generateWithSystemInstruction(String systemInstruction, String userPrompt);

    String generateWithSystemInstruction(String systemInstruction, String userPrompt, double temperature);

    String generateWithSystemInstruction(String systemInstruction, String userPrompt, double temperature,
            UUID explicitUserId, Boolean explicitIsTeacher);

    String evaluateAudioWithInstruction(String systemInstruction, byte[] audioBytes, String mimeType,
            String userPrompt);

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
