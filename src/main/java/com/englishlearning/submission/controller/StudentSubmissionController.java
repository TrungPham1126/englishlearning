package com.englishlearning.submission.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.dto.StudentAssignmentSummaryResponse;
import com.englishlearning.submission.dto.SubmissionRequest;
import com.englishlearning.submission.service.SubmissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/student") // <-- ĐỂ BASE PATH LÀ /api/v1/student
@RequiredArgsConstructor
public class StudentSubmissionController {

    private final SubmissionService submissionService;

    // 1. API LẤY TẤT CẢ BÀI TẬP THEO 1 LỚP HỌC CỤ THỂ
    // URL: GET
    // http://localhost:8080/api/v1/student/classrooms/{classId}/assignments
    @GetMapping("/classrooms/{classId}/assignments")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<StudentAssignmentSummaryResponse>>> getAssignmentsByClass(
            @PathVariable UUID classId,
            @AuthenticationPrincipal(expression = "id") UUID studentId) {
        return ResponseEntity
                .ok(ApiResponse.success("Success", submissionService.getStudentClassAssignments(classId, studentId)));
    }

    // 2. BẮT ĐẦU LÀM BÀI
    // URL: POST
    // http://localhost:8080/api/v1/student/assignments/{assignmentId}/start
    @PostMapping("/assignments/{assignmentId}/start")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<AttemptResponse>> startAttempt(
            @PathVariable UUID assignmentId,
            @AuthenticationPrincipal(expression = "id") UUID studentId) {
        AttemptResponse response = submissionService.startAttempt(studentId, assignmentId);
        return ResponseEntity.ok(ApiResponse.success("Attempt started", response));
    }

    // 3. NỘP BÀI
    // URL: POST
    // http://localhost:8080/api/v1/student/assignments/{assignmentId}/attempts/{attemptId}/submit
    @PostMapping("/assignments/{assignmentId}/attempts/{attemptId}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<AttemptResponse>> submitAttempt(
            @PathVariable UUID assignmentId,
            @PathVariable UUID attemptId,
            @Valid @RequestBody SubmissionRequest request,
            @AuthenticationPrincipal(expression = "id") UUID studentId) {
        if (!request.getAssignmentId().equals(assignmentId)) {
            throw new IllegalArgumentException("Assignment ID mismatch");
        }
        AttemptResponse response = submissionService.submitAttempt(studentId, attemptId, request);
        return ResponseEntity.ok(ApiResponse.success("Assignment submitted successfully", response));
    }

    // 4. XEM LỊCH SỬ LÀM BÀI
    // URL: GET
    // http://localhost:8080/api/v1/student/assignments/{assignmentId}/attempts
    @GetMapping("/assignments/{assignmentId}/attempts")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<AttemptResponse>>> getMyAttempts(
            @PathVariable UUID assignmentId,
            @AuthenticationPrincipal(expression = "id") UUID studentId) {
        return ResponseEntity.ok(
                ApiResponse.success("Success", submissionService.getStudentAttemptsHistory(assignmentId, studentId)));
    }

    // 5. XEM CHI TIẾT KẾT QUẢ MỘT LƯỢT NỘP
    // URL: GET
    // http://localhost:8080/api/v1/student/assignments/attempts/{attemptId}
    @GetMapping("/assignments/attempts/{attemptId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<AttemptResponse>> getAttemptDetail(
            @PathVariable UUID attemptId,
            @AuthenticationPrincipal(expression = "id") UUID studentId) {
        return ResponseEntity
                .ok(ApiResponse.success("Success", submissionService.getAttemptDetail(attemptId, studentId, false)));
    }

    @PostMapping(value = "/assignments/attempts/{attemptId}/questions/{questionId}/audio", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<AttemptResponse>> uploadAudio(
            @PathVariable UUID attemptId, @PathVariable UUID questionId,
            @RequestParam("audio") org.springframework.web.multipart.MultipartFile audio,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Upload thành công",
                submissionService.uploadAudioResponse(userDetails.getId(), attemptId, questionId, audio)));
    }
}