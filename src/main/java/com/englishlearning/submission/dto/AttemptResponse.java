package com.englishlearning.submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttemptResponse {
    private UUID attemptId;
    private UUID assignmentId;
    private String assignmentTitle;
    private Integer attemptNumber;
    private String status;
    private Double score;
    private String aiFeedback;
    private String teacherFeedback;
    private Instant startedAt;
    private Instant submittedAt;
    private List<QuestionResultDetail> questions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OptionDetail {
        private UUID id;
        private String optionLabel;
        private String optionText;
        private Boolean isCorrect;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionResultDetail {
        private UUID id;
        private UUID questionId;
        private UUID studentAnswerId;
        private String promptText;
        private String questionType;
        private Double maxPoints;
        private Double earnedPoints;
        private String studentAnswer;
        private String audioUrl; // File audio học sinh nộp nói
        private String mediaUrl; // Link file audio đề bài nghe
        private String transcript; // Kịch bản bài nghe
        private List<OptionDetail> options; // Danh sách A, B, C, D
        private UUID selectedOptionId;
        private String correctAnswer;
        private String explanation;
        private Boolean isCorrect;
    }
}