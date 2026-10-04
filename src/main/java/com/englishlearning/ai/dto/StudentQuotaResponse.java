package com.englishlearning.ai.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class StudentQuotaResponse {
    private UUID studentId;
    private String email;
    private Integer dailyUsed;
    private Integer dailyLimit;
    private Boolean isBlocked;
}