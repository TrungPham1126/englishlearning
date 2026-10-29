package com.englishlearning.ai.service;

import com.englishlearning.ai.entity.AiGeneratedExercise;

import java.util.UUID;

public interface ExerciseGenerationService {

    /**
     * Sinh câu hỏi/bài tập thông minh từ yêu cầu của giảng viên bằng AI kèm tổng hợp âm thanh TTS nếu có bài nghe.
     */
    AiGeneratedExercise generateQuestionsFromPrompt(
            String prompt,
            String targetCefr,
            int questionCount,
            UUID teacherId,
            boolean generateAudio
    );
}
