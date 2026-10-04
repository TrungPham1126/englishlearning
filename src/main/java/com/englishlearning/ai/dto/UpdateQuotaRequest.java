package com.englishlearning.ai.dto;

import lombok.Data;

@Data
public class UpdateQuotaRequest {
    private Integer dailyLimit;
    private Boolean isBlocked;
}