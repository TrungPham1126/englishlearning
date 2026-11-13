package com.englishlearning.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class R2CostReportDto {

    private String bucketName;
    private String endpoint;
    private String publicUrl;
    private boolean liveConnected;
    private String dataSourceMode;
    private String statusMessage;

    private long totalObjects;
    private long totalBytes;
    private double totalStorageGb;
    private double freeStorageGb;
    private double billableStorageGb;
    private double freeTierUsagePercent;

    private long classAOps;
    private long freeClassAOps;
    private long billableClassAOps;

    private long classBOps;
    private long freeClassBOps;
    private long billableClassBOps;

    private long deleteOps;

    private double storageCostUsd;
    private double classACostUsd;
    private double classBCostUsd;
    private double egressCostUsd;

    private double totalPayableUsd;
    private long totalPayableVnd;
    private double grossEquivalentUsd;
    private long grossEquivalentVnd;

    private double monthlyBudgetUsd;
    private long usdToVndRate;

    private List<R2CategoryBreakdownDto> categoryBreakdowns;
    private List<R2LargestObjectDto> largestObjects;
    private Instant generatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class R2CategoryBreakdownDto {
        private String categoryKey;
        private String label;
        private String prefix;
        private long objectCount;
        private long totalBytes;
        private double sizeMb;
        private double sharePercent;
        private double estimatedGrossStorageUsd;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class R2LargestObjectDto {
        private String key;
        private String category;
        private long sizeBytes;
        private double sizeMb;
        private Instant lastModified;
    }
}
