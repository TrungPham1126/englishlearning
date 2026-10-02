package com.englishlearning.analytics.controller;

import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {
    private final AnalyticsService analyticsService;

    @GetMapping("/my-profile")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<StudentSkillProfile>> getMyProfile(
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getMyProfile(user.getId())));
    }
}