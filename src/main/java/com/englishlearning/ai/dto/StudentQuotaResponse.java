package com.englishlearning.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentQuotaResponse {
    private UUID studentId;
    private String email;
    private String studentName;
    private String role; // "STUDENT" | "TEACHER"
    private String serviceEngine; // "GEMINI" | "GROQ"
    private Integer dailyUsed;
    private Integer dailyLimit;
    private Boolean isBlocked;
    private Long promptTokensUsed;
    private Long completionTokensUsed;
    private Long totalTokensUsed;
    private Double estimatedCostUsd;
}