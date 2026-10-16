package com.englishlearning.curriculum.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class GlobalResourceResponse {
    private UUID id;
    private String name;
    private String size;
    private Integer usedCount;
    private String uploadedAt;
    private String url;
}