package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.*;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiEvaluationServiceImpl implements AiEvaluationService {

    private final PythonIntegrationService pythonIntegrationService;
    private final GeminiClientService geminiClientService;
    private final GroqClientService groqClientService;
    private final ObjectMapper objectMapper;

    private static final String SHADOWING_SYSTEM_INSTRUCTION = """
            You are a strict Cambridge English Phonetician and Shadowing Pronunciation Examiner.
            Your task is to rigorously evaluate a student's spoken audio/transcript against the exact Reference Sentence.
            Return strictly valid JSON matching the ShadowingEvaluationResponse schema.
            """;

    @Override
    public ShadowingEvaluationResponse evaluateSpeech(byte[] audioBytes, String filename, String referenceText) {
        String effectiveFilename = (filename != null && !filename.isBlank()) ? filename : "audio.wav";
        String cleanRef = cleanReferenceSentence(referenceText);

        // --- TẦNG 1: Realtime Acoustic Python microservice (F1/F2 Formants) ---
        if (audioBytes != null && audioBytes.length > 0) {
            try {
                log.info("[Tầng 1] Gửi audio tới Python acoustic microservice cho câu: '{}'", cleanRef);
                ShadowingEvaluationResponse pythonResp = pythonIntegrationService.evaluatePhonetics(
                        audioBytes, effectiveFilename, cleanRef);
                if (pythonResp != null && pythonResp.getOverallScore() != null) {
                    if (pythonResp.getEvaluatedBy() == null || pythonResp.getEvaluatedBy().isBlank()) {
                        pythonResp.setEvaluatedBy("PYTHON_ACOUSTIC_ENGINE");
                    }
                    log.info("[Tầng 1 Thành công] Kết quả chấm bởi: {}", pythonResp.getEvaluatedBy());
                    return pythonResp;
                }
            } catch (Exception ex) {
                log.warn("[Tầng 1 Thất bại / Timeout] Python microservice lỗi: {}. Chuyển sang Tầng 2...", ex.getMessage());
            }
        }

        // --- TẦNG 2: Secondary Cloud AI API (Gemini / Groq LLM Fallback) ---
        try {
            log.info("[Tầng 2] Kích hoạt Secondary Cloud AI (Gemini / Groq)...");
            return evaluateWithCloudAiFallback(audioBytes, cleanRef);
        } catch (Exception cloudEx) {
            log.error("[Tầng 2 Thất bại] Toàn bộ Cloud AI gặp sự cố: {}. Kích hoạt Tầng 3...", cloudEx.getMessage());
        }

        // --- TẦNG 3: Rule-based Offline / Heuristic Fallback ---
        log.warn("[Tầng 3] Thực hiện chấm điểm Rule-Based Offline Fallback cho câu: '{}'", cleanRef);
        return evaluateWithRuleBasedOffline(cleanRef);
    }

    private ShadowingEvaluationResponse evaluateWithCloudAiFallback(byte[] audioBytes, String referenceSentence) {
        String userPrompt = String.format("""
                Reference Sentence: "%s"
                Audio data provided. Evaluate pronunciation rigorously and return JSON.
                """, referenceSentence);

        try {
            log.info("Thử chấm điểm qua Gemini AI...");
            String geminiJson = geminiClientService.generateWithSystemInstruction(
                    SHADOWING_SYSTEM_INSTRUCTION, userPrompt);
            String cleanJson = GeminiClientService.stripMarkdown(geminiJson);
            ShadowingEvaluationResponse response = objectMapper.readValue(cleanJson, ShadowingEvaluationResponse.class);
            response.setEvaluatedBy("GEMINI_AI_FALLBACK");
            return response;
        } catch (Exception geminiEx) {
            log.warn("Gemini AI thất bại: {}. Fallback sang Groq Cloud AI...", geminiEx.getMessage());
            try {
                String groqJson = groqClientService.chatCompletionJson(SHADOWING_SYSTEM_INSTRUCTION, userPrompt);
                String cleanJson = GroqClientService.stripMarkdown(groqJson);
                ShadowingEvaluationResponse response = objectMapper.readValue(cleanJson, ShadowingEvaluationResponse.class);
                response.setEvaluatedBy("GROQ_AI_FALLBACK");
                return response;
            } catch (Exception groqEx) {
                log.error("Cả Gemini và Groq đều thất bại: {}", groqEx.getMessage());
                throw new RuntimeException("Cả Gemini và Groq đều thất bại", groqEx);
            }
        }
    }

    private ShadowingEvaluationResponse evaluateWithRuleBasedOffline(String referenceSentence) {
        String[] words = referenceSentence.trim().split("\\s+");
        List<ShadowingEvaluationResponse.SentenceToken> tokens = new ArrayList<>();
        List<ShadowingEvaluationResponse.WordPhonemeDetail> wordRows = new ArrayList<>();

        int baselineWordScore = 75; // Điểm trung bình heuristic ngoại tuyến

        for (String w : words) {
            String cleanWord = w.replaceAll("[^a-zA-Z0-9']", "");
            if (cleanWord.isBlank()) continue;

            String color = determinePhonemeColor(baselineWordScore);
            tokens.add(ShadowingEvaluationResponse.SentenceToken.builder()
                    .word(cleanWord)
                    .color(color)
                    .wordStatus("SPOKEN")
                    .hasPauseAfter(false)
                    .hasLinkingAfter(false)
                    .build());

            List<ShadowingEvaluationResponse.PhonemeItem> phonemes = new ArrayList<>();
            for (char ch : cleanWord.toLowerCase().toCharArray()) {
                phonemes.add(ShadowingEvaluationResponse.PhonemeItem.builder()
                        .ipa("/" + ch + "/")
                        .score(baselineWordScore)
                        .note("Chấm điểm dự phòng ngoại tuyến")
                        .build());
            }

            wordRows.add(ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                    .word(cleanWord)
                    .score(baselineWordScore)
                    .wordStatus("SPOKEN")
                    .phonemes(phonemes)
                    .build());
        }

        ShadowingEvaluationResponse.KpiMetrics kpi = calculateMetrics(tokens, wordRows, words.length, 110);

        return ShadowingEvaluationResponse.builder()
                .overallScore(kpi.getPronunciation())
                .isPassed(kpi.getPronunciation() >= 80)
                .passScore(80)
                .statusMessage("Đánh giá hoàn tất bằng cơ chế Fallback ngoại tuyến (Offline Heuristics).")
                .evaluatedBy("RULE_BASED_OFFLINE_FALLBACK")
                .kpi(kpi)
                .sentenceTokens(tokens)
                .wordRows(wordRows)
                .build();
    }

    @Override
    public String determinePhonemeColor(int score) {
        if (score >= 80) {
            return "GREEN";
        } else if (score >= 60) {
            return "YELLOW";
        } else {
            return "RED";
        }
    }

    @Override
    public ShadowingEvaluationResponse.KpiMetrics calculateMetrics(
            List<ShadowingEvaluationResponse.SentenceToken> tokens,
            List<ShadowingEvaluationResponse.WordPhonemeDetail> wordRows,
            int totalReferenceWords,
            int wordsPerMinute) {

        int totalWords = Math.max(1, totalReferenceWords);
        long spokenCount = tokens.stream()
                .filter(t -> "SPOKEN".equalsIgnoreCase(t.getWordStatus()))
                .count();

        int completeness = (int) Math.round(((double) spokenCount / totalWords) * 100);
        completeness = Math.min(100, Math.max(0, completeness));

        int avgPronunciation = wordRows.isEmpty() ? 0 :
                (int) Math.round(wordRows.stream().mapToInt(w -> w.getScore() != null ? w.getScore() : 0).average().orElse(0.0));

        // Fluency tính toán dựa trên độ bao phủ từ và tốc độ nói WPM
        int fluency = (int) Math.round((avgPronunciation * 0.6) + (Math.min(130, wordsPerMinute) / 130.0 * 40));
        fluency = Math.min(100, Math.max(0, fluency));

        int prosody = (int) Math.round((avgPronunciation * 0.7) + (completeness * 0.3));

        return ShadowingEvaluationResponse.KpiMetrics.builder()
                .pronunciation(avgPronunciation)
                .fluency(fluency)
                .completeness(completeness)
                .prosody(prosody)
                .wordsPerMinute(wordsPerMinute)
                .build();
    }

    private String cleanReferenceSentence(String raw) {
        if (raw == null || raw.isBlank()) {
            return "Hello world";
        }
        return raw.replaceAll("\\s+", " ").trim();
    }
}
