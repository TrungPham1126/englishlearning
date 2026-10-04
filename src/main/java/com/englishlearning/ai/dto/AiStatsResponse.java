package com.englishlearning.ai.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiStatsResponse {
    private long totalTokens;
    private double estimatedCostUsd;
    private long activeUsers;
    private long blockedUsers;
}