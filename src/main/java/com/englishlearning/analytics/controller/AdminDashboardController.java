package com.englishlearning.analytics.controller;

import com.englishlearning.analytics.dto.AdminDashboardStats;
import com.englishlearning.analytics.service.AdminDashboardService;
import com.englishlearning.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminDashboardStats>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(adminDashboardService.getDashboardStats()));
    }
}