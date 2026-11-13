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
public class AiExamGenerateRequest {
    private String title;
    private String topic;
    private String targetCefr;
    private String customInstructions;
    private List<SkillSectionSpec> sections;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SkillSectionSpec {
        private String skillType;      // READING, LISTENING, GRAMMAR, VOCABULARY, WRITING, SPEAKING
        private String questionFormat; // e.g., MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_BLANK, MATCHING, ESSAY, AUDIO_RESPONSE, MIXED
        private Integer questionCount;
        private Double pointsPerQuestion;
    }
}
