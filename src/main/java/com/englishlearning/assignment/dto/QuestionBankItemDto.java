package com.englishlearning.assignment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionBankItemDto {
    private UUID id;
    private UUID assignmentId;
    private String assignmentTitle;
    private String skillType;
    private String questionType;
    private String promptText;
    private String mediaUrl;
    private String transcript;
    private String correctAnswer;
    private String explanation;
    private Double points;
    private List<OptionDto> options;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OptionDto {
        private String optionText;
        private String matchText;
        private Boolean isCorrect;
    }
}
