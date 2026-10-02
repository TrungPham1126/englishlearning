package com.englishlearning.curriculum.controller;

import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.curriculum.dto.CreateDailyPlanRequest;
import com.englishlearning.curriculum.dto.CreatePlanItemRequest;
import com.englishlearning.curriculum.dto.DailyHomeworkOverviewResponse;
import com.englishlearning.curriculum.dto.UpdateDailyPlanRequest;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.service.DailyStudyPlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/curriculum/daily-plans")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Daily Study Plan", description = "Quản lý lộ trình bài tập hằng ngày")
public class DailyStudyPlanController {

    private final DailyStudyPlanService dailyStudyPlanService;

    // ==================== API DÀNH CHO STUDENT ====================

    @GetMapping("/classrooms/{classroomId}/student-overview")
    @PreAuthorize("hasRole('STUDENT')")
    @Operation(summary = "Lấy tổng quan tiến trình Daily Plan cho Học viên")
    public ResponseEntity<ApiResponse<DailyHomeworkOverviewResponse>> getStudentOverview(
            @PathVariable UUID classroomId,
            @RequestParam(required = false) UUID selectedDayId,
            Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiResponse<>(401, "Phiên đăng nhập không hợp lệ", null));
        }

        UUID studentId = null;
        Object principal = authentication.getPrincipal();
        try {
            java.lang.reflect.Method getIdMethod = principal.getClass().getMethod("getId");
            studentId = (UUID) getIdMethod.invoke(principal);
        } catch (Exception ignored) {
        }

        DailyHomeworkOverviewResponse response = dailyStudyPlanService.getStudentDailyOverview(
                classroomId, studentId, selectedDayId);
        return ResponseEntity.ok(ApiResponse.success("Lấy thông tin lộ trình thành công", response));
    }

    // ==================== API DÀNH CHO TEACHER / ADMIN ====================

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Tạo một Ngày học mới (DAY)")
    public ResponseEntity<ApiResponse<DailyStudyPlan>> createDailyPlan(
            @Valid @RequestBody CreateDailyPlanRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo ngày học thành công", dailyStudyPlanService.createDailyPlan(request)));
    }

    @PutMapping("/{planId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Cập nhật thông tin Ngày học")
    public ResponseEntity<ApiResponse<DailyStudyPlan>> updateDailyPlan(
            @PathVariable UUID planId,
            @Valid @RequestBody UpdateDailyPlanRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật ngày học thành công",
                dailyStudyPlanService.updateDailyPlan(planId, request)));
    }

    @PostMapping("/{planId}/items")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Thêm một bài tập (Section / Item) vào Ngày học")
    public ResponseEntity<ApiResponse<DailyPlanItem>> addPlanItem(
            @PathVariable UUID planId,
            @Valid @RequestBody CreatePlanItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        "Thêm bài tập vào lộ trình thành công",
                        dailyStudyPlanService.addPlanItem(planId, request)));
    }

    @DeleteMapping("/items/{itemId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Xóa một bài tập khỏi Ngày học")
    public ResponseEntity<ApiResponse<Void>> deletePlanItem(
            @PathVariable UUID itemId) {
        dailyStudyPlanService.deletePlanItem(itemId);
        return ResponseEntity.ok(ApiResponse.success("Xóa bài tập thành công", null));
    }
}