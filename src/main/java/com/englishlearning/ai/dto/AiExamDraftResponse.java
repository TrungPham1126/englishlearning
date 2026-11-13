package com.englishlearning.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiExamDraftResponse {
    private String title;
    private String description;
    private String listeningScript;
    private List<String> examSkills;
    private List<GeneratedExamQuestionDto> questions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeneratedExamQuestionDto {
        private String skillType;
        private String questionType;
        private String promptText;
        private String transcript;
        private String correctAnswer;
        private String explanation;
        private Double points;
        private List<GeneratedExamOptionDto> options;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeneratedExamOptionDto {
        private String optionText;
        private String matchText;
        private Boolean isCorrect;
    }
}
