package com.englishlearning.video.dto;

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
public class R2BucketSnapshot {

    private String bucketName;
    private String endpoint;
    private String publicUrl;
    private boolean liveConnected;
    private String statusNote;
    private long totalObjects;
    private long totalBytes;
    private long trackedPutOps;
    private long trackedListOps;
    private long trackedDeleteOps;
    private long trackedGetOps;
    private List<R2PrefixStat> prefixStats;
    private List<R2ObjectItem> largestObjects;
    private Instant checkedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class R2PrefixStat {
        private String categoryKey;
        private String categoryLabel;
        private String prefix;
        private long objectCount;
        private long totalBytes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class R2ObjectItem {
        private String key;
        private String category;
        private long sizeBytes;
        private Instant lastModified;
    }
}
