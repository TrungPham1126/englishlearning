package com.englishlearning.ai.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class WritingEvaluationResponse {
    private Double estimatedBand;
    private Integer wordCount;
    private String generalFeedback;
    private List<GrammarIssue> issues;

    @Data
    @Builder
    public static class GrammarIssue {
        private String originalText;
        private String suggestedText;
        private String reason;
    }
}