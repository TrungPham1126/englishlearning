package com.englishlearning.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class PhoneticEvaluationResponse {
    private Integer overallScore; // 0 - 100
    private String feedback;
    private List<WordScore> wordScores;

    @Data
    @Builder
    public static class WordScore {
        private String word;
        private Integer score;
        @JsonProperty("isAccurate")
        private boolean isAccurate;
        private String note;
    }
}