package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;

import java.util.List;

public interface AiEvaluationService {

    /**
     * Đánh giá phát âm bài nói với kiến trúc Fallback 3 tầng:
     * - Tầng 1: Realtime Acoustic Python microservice (F1/F2 Formants)
     * - Tầng 2: Secondary Cloud AI API (Gemini / Groq LLM)
     * - Tầng 3: Rule-based Offline / Heuristic Grading
     */
    ShadowingEvaluationResponse evaluateSpeech(byte[] audioBytes, String filename, String referenceText);

    /**
     * Xác định mã màu âm vị/từ theo thang điểm:
     * - Score >= 80: "GREEN" (Đạt)
     * - 60 <= Score < 80: "YELLOW" (Cần cải thiện)
     * - Score < 60: "RED" (Phát âm sai)
     */
    String determinePhonemeColor(int score);

    /**
     * Tính toán chính xác các chỉ số KPI: Pronunciation (Accuracy), Fluency, Completeness, Prosody.
     */
    ShadowingEvaluationResponse.KpiMetrics calculateMetrics(
            List<ShadowingEvaluationResponse.SentenceToken> tokens,
            List<ShadowingEvaluationResponse.WordPhonemeDetail> wordRows,
            int totalReferenceWords,
            int wordsPerMinute
    );
}
