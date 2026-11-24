package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.AiCoachingAdvice;
import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import com.englishlearning.ai.dto.ShadowingEvaluationResponse;

/**
 * Dịch vụ dùng AI (Groq / Gemini) đọc kết quả phân tích âm học do Python chấm
 * để tạo lời khuyên cá nhân hóa bằng tiếng Việt cho tất cả các dạng Speaking.
 */
public interface SpeakingAiCoachingService {

    /**
     * Sinh lời khuyên AI Coach dựa trên kết quả âm học Python (Wav2Vec2 + Formant F1/F2)
     * cho các dạng bài Shadowing hoặc Speaking IELTS.
     */
    AiCoachingAdvice generateShadowingCoaching(
            ShadowingEvaluationResponse acousticResult,
            String referenceSentence,
            String speakingMode);

    /**
     * Sinh lời khuyên AI Coach dựa trên kết quả đối chiếu từng từ của Whisper Pronunciation.
     */
    AiCoachingAdvice generatePronunciationCoaching(
            PhoneticEvaluationResponse phoneticResult,
            String referenceText);

    /**
     * Tổng hợp tóm tắt dữ liệu âm học chi tiết từ Python (KPI, từ yếu, âm vị IPA, từ bỏ sót, WPM)
     * để đưa vào prompt AI Coach hoặc prompt giám khảo IELTS Speaking.
     */
    String buildDetailedAcousticSummary(ShadowingEvaluationResponse phoneticResult);
}
