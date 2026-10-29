package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.AiStatsResponse;
import com.englishlearning.ai.dto.StudentQuotaResponse;
import com.englishlearning.ai.dto.UpdateQuotaRequest;

import java.util.List;
import java.util.UUID;

public interface AiMonitoringService {

    void checkRateLimitAndQuota(UUID studentId, boolean isTeacher);

    void recordTokenUsage(UUID userId, String role, long promptTokens, long completionTokens, String serviceType);

    void recordTokenUsage(UUID userId, long promptTokens, long completionTokens);

    boolean toggleGlobalKillSwitch();

    boolean isGlobalKillSwitchActive();

    AiStatsResponse getStats();

    List<StudentQuotaResponse> getAllQuotas();

    void updateQuota(UUID userId, UpdateQuotaRequest request);
}
