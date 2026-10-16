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
public class AiStatsResponse {
    private long totalTokens;
    private long promptTokens;
    private long completionTokens;
    private double estimatedCostUsd;
    private double monthlyCostUsd;
    private long activeUsers;
    private long blockedUsers;
    private double systemQuotaRemainingPercent;
    private boolean systemKillSwitchActive;

    // Biểu đồ xu hướng Recharts
    private List<DailyTokenUsageDto> dailyUsage;
    private CostBreakdownDto costBreakdown;
    private List<StudentQuotaResponse> studentQuotas;

    // Thống kê chuyên biệt 2 hệ thống AI: Google Gemini vs Groq LLaMA
    private AiEngineStatsDto geminiStats;
    private AiEngineStatsDto groqStats;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiEngineStatsDto {
        private String engineName;
        private String primaryRole;
        private long totalTokens;
        private long promptTokens;
        private long completionTokens;
        private double costUsd;
        private long totalRequests;
        private String pricingModel;
        private boolean isHealthy;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyTokenUsageDto {
        private String date;
        private long promptTokens;
        private long completionTokens;
        private long totalTokens;
        private double costUsd;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CostBreakdownDto {
        private double studentSpeakingCost;
        private double teacherCreationCost;
        private long studentSpeakingTokens;
        private long teacherCreationTokens;
    }
}