package com.englishlearning.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Lời khuyên sư phạm cá nhân hóa do AI (Groq/Gemini) tổng hợp
 * trực tiếp từ dữ liệu âm học chi tiết mà Python phonetics-service hoặc Whisper đã chấm.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiCoachingAdvice {

    /** Tóm tắt nhận xét tổng quan 1–2 câu bằng tiếng Việt. */
    private String summary;

    /** Danh sách 2–4 gợi ý hành động cụ thể dựa trên từ yếu, âm vị IPA và tốc độ WPM thực tế. */
    @Builder.Default
    private List<String> actionTips = new ArrayList<>();

    /** Bài tập thực hành ngắn gọn giúp học viên cải thiện ngay lỗi vừa mắc. */
    private String practiceDrill;

    /** Nguồn AI sinh lời khuyên ("GROQ_AI_COACH", "GEMINI_AI_COACH", hoặc LLM IELTS). */
    private String generatedBy;
}
