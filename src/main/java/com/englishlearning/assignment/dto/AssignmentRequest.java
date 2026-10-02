package com.englishlearning.assignment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
public class AssignmentRequest {
    @NotBlank(message = "Title is required")
    private String title;
    private String description;

    @NotNull(message = "Classroom ID is required")
    private UUID classroomId;

    private UUID lessonId;

    @NotBlank(message = "Skill type is required")
    private String skillType;

    private Integer timeLimitMinutes;
    private Instant dueDate;
    private Integer maxAttempts;
    private Double passScore;

    private List<QuestionRequest> questions;

    @Data
    public static class QuestionRequest {
        @NotBlank
        private String promptText;
        private String questionType;
        private String mediaUrl;
        private String transcript;
        private String correctAnswer;
        private String explanation;
        private Double points;
        private List<OptionRequest> options;
    }

    @Data
    public static class OptionRequest {
        @NotBlank
        private String optionText;
        private boolean isCorrect;
    }
}