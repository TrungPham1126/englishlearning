package com.englishlearning.submission.controller;

import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.dto.SubmissionSummaryResponse;
import com.englishlearning.submission.dto.TeacherGradeRequest;
import com.englishlearning.submission.service.SubmissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/teacher")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class TeacherGradingController {

    private final SubmissionService submissionService;

    // Xem danh sách học viên đã nộp bài cho một Assignment cụ thể
    @GetMapping("/assignments/{assignmentId}/submissions")
    public ResponseEntity<ApiResponse<List<SubmissionSummaryResponse>>> getSubmissions(
            @PathVariable UUID assignmentId) {
        return ResponseEntity.ok(ApiResponse.success("Success", submissionService.getTeacherSubmissions(assignmentId)));
    }

    // Xem chi tiết kết quả nộp bài của một học viên để chấm điểm
    @GetMapping("/submissions/{attemptId}")
    public ResponseEntity<ApiResponse<AttemptResponse>> getSubmissionDetail(@PathVariable UUID attemptId) {
        return ResponseEntity
                .ok(ApiResponse.success("Success", submissionService.getAttemptDetail(attemptId, null, true)));
    }

    // Giáo viên nhận xét và chốt điểm cuối cùng cho một Attempt
    @PostMapping("/submissions/{attemptId}/grade")
    public ResponseEntity<ApiResponse<AttemptResponse>> gradeSubmission(
            @PathVariable UUID attemptId,
            @Valid @RequestBody TeacherGradeRequest request) {
        return ResponseEntity
                .ok(ApiResponse.success("Graded successfully", submissionService.gradeSubmission(attemptId, request)));
    }
}