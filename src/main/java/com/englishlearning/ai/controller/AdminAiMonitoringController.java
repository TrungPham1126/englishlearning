// src/main/java/com/englishlearning/ai/controller/AdminAiMonitoringController.java
package com.englishlearning.ai.controller;

import com.englishlearning.ai.dto.AiStatsResponse;
import com.englishlearning.ai.dto.StudentQuotaResponse;
import com.englishlearning.ai.dto.UpdateQuotaRequest;
import com.englishlearning.ai.service.AiMonitoringService;
import com.englishlearning.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/ai-monitoring")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiMonitoringController {
    private final AiMonitoringService monitoringService;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AiStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(monitoringService.getStats()));
    }

    @GetMapping("/quotas")
    public ResponseEntity<ApiResponse<List<StudentQuotaResponse>>> getQuotas() {
        return ResponseEntity.ok(ApiResponse.success(monitoringService.getAllQuotas()));
    }

    @PutMapping("/quotas/{studentId}")
    public ResponseEntity<ApiResponse<Void>> updateQuota(@PathVariable UUID studentId,
            @RequestBody UpdateQuotaRequest request) {
        monitoringService.updateQuota(studentId, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công", null));
    }
}