package com.englishlearning.analytics.controller;

import com.englishlearning.analytics.dto.AdminDatabaseOverviewDto;
import com.englishlearning.analytics.dto.ClassroomDetailedReportDto;
import com.englishlearning.analytics.dto.ClassroomPurgeResultDto;
import com.englishlearning.analytics.dto.R2CostReportDto;
import com.englishlearning.analytics.service.AdminDatabaseService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/database")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDatabaseController {

    private final AdminDatabaseService adminDatabaseService;

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<AdminDatabaseOverviewDto>> getDatabaseOverview() {
        return ResponseEntity.ok(ApiResponse.success(adminDatabaseService.getDatabaseOverview()));
    }

    @PostMapping("/classrooms/{classroomId}/purge-submissions")
    public ResponseEntity<ApiResponse<ClassroomPurgeResultDto>> purgeClassroomSubmissions(
            @PathVariable UUID classroomId,
            @RequestParam(defaultValue = "false") boolean force,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            HttpServletRequest request) {
        UUID actorId = currentUser != null ? currentUser.getId() : null;
        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        ClassroomPurgeResultDto result = adminDatabaseService.purgeClassroomSubmissions(classroomId, force, actorId, ip);
        return ResponseEntity.ok(ApiResponse.success(result.getMessage(), result));
    }

    @DeleteMapping("/classrooms/{classroomId}")
    public ResponseEntity<ApiResponse<ClassroomPurgeResultDto>> deleteClassroom(
            @PathVariable UUID classroomId,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            HttpServletRequest request) {
        UUID actorId = currentUser != null ? currentUser.getId() : null;
        String ip = request != null ? request.getRemoteAddr() : "127.0.0.1";
        ClassroomPurgeResultDto result = adminDatabaseService.deleteClassroom(classroomId, actorId, ip);
        return ResponseEntity.ok(ApiResponse.success(result.getMessage(), result));
    }

    @GetMapping("/classrooms/{classroomId}/report-summary")
    public ResponseEntity<ApiResponse<ClassroomDetailedReportDto>> getClassroomReportSummary(
            @PathVariable UUID classroomId) {
        return ResponseEntity.ok(ApiResponse.success(adminDatabaseService.getClassroomDetailedReport(classroomId)));
    }

    @GetMapping("/classrooms/{classroomId}/report")
    public ResponseEntity<byte[]> exportClassroomReportExcel(@PathVariable UUID classroomId) {
        ClassroomDetailedReportDto summary = adminDatabaseService.getClassroomDetailedReport(classroomId);
        byte[] workbookBytes = adminDatabaseService.exportClassroomReportExcel(summary);
        String slug = toSafeFileSlug(summary.getClassroomName());
        String filename = "Bao_cao_lop_" + slug + ".xlsx";
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + encoded)
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(workbookBytes.length)
                .body(workbookBytes);
    }

    @GetMapping("/r2-report")
    public ResponseEntity<ApiResponse<R2CostReportDto>> getR2CostReport() {
        return ResponseEntity.ok(ApiResponse.success(adminDatabaseService.getR2CostReport()));
    }

    private String toSafeFileSlug(String raw) {
        if (raw == null || raw.isBlank()) {
            return "lop_hoc";
        }
        String normalized = Normalizer.normalize(raw, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replaceAll("đ", "d")
                .replaceAll("Đ", "D")
                .replaceAll("[^a-zA-Z0-9\\-_]+", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");
        return normalized.isBlank() ? "lop_hoc" : normalized;
    }
}
