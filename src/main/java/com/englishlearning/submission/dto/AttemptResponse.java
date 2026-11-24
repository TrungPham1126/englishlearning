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
    private String assignmentDescription;
    private String skillType;
    private Integer attemptNumber;
    private String status;
    private Double score;
    private String aiFeedback;
    private String teacherFeedback;
    private Instant startedAt;
    private Instant submittedAt;
    private String audioUrl;
    private String listeningScript;
    private String passage;
    private Integer timeLimitMinutes;
    private Double passScore;
    private Double maxAllowedErrorPercent;
    private Integer maxAttempts;
    private Boolean isExam;
    private String examSkills;
    private Boolean strictFullscreen;
    private Integer maxViolations;
    private Integer violationCount;
    private Boolean isCheatingFlagged;
    private String cheatingReason;
    private String violationLogJson;
    private Boolean answersPersisted;
    private List<QuestionResultDetail> questions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OptionDetail {
        private UUID id;
        private String optionLabel;
        private String optionText;
        private String matchText;
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
        private String skillType;
        private Double maxPoints;
        private Double earnedPoints;
        private String studentAnswer;
        private String audioUrl; // File audio học sinh nộp nói
        private String mediaUrl; // Link file audio đề bài nghe
        private String transcript; // Kịch bản bài nghe
        private List<OptionDetail> options; // Danh sách A, B, C, D
        private UUID selectedOptionId;
        private String correctAnswer;
        private String matchText;
        private String explanation;
        private String hint;
        private Boolean isCorrect;
        private String evalFeedback;
        private AiEvaluationDetail aiEvaluation;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiEvaluationDetail {
        private UUID id;
        private String evalType;
        private Double overallScore;
        private Double pronunciationScore;
        private Double fluencyScore;
        private Double grammarScore;
        private Double vocabularyScore;
        private Double coherenceScore;
        private String estimatedCefr;
        private String sttTranscript;
        private String correctedText;
        private String mistakesJson;
        private String suggestionsJson;
    }
}
