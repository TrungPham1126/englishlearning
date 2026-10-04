// src/main/java/com/englishlearning/curriculum/dto/GlobalResourceResponse.java
package com.englishlearning.curriculum.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class GlobalResourceResponse {
    private UUID id;
    private String name;
    private String size; // Đã format (vd: 12MB)
    private Integer usedCount;
    private String uploadedAt;
}