package com.englishlearning.ai.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SpeakingIeltsResponse {
    private String transcript;
    private Double pronunciationScore; // max 9.0
    private Double fluencyScore;
    private Double lexicalScore;
    private Double grammarScore;
    private Double overallBand;
    private String detailedFeedback;
    private Integer wordsPerMinute;
}