package com.englishlearning.assignment.controller;

import com.englishlearning.assignment.dto.AssignmentRequest;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.service.AssignmentService;
import com.englishlearning.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/teacher")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class TeacherAssignmentController {

    private final AssignmentService assignmentService;

    // 1. Lấy tất cả bài tập của lớp
    @GetMapping("/classrooms/{classroomId}/assignments")
    public ResponseEntity<ApiResponse<List<Assignment>>> getAssignmentsByClassroom(@PathVariable UUID classroomId) {
        List<Assignment> assignments = assignmentService.getAssignmentsByClassroom(classroomId);
        return ResponseEntity.ok(ApiResponse.success("Assignments retrieved successfully", assignments));
    }

    // 2. Tạo bài tập mới
    @PostMapping("/assignments")
    public ResponseEntity<ApiResponse<Assignment>> createAssignment(@Valid @RequestBody AssignmentRequest request) {
        Assignment assignment = assignmentService.createAssignment(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Assignment created successfully", assignment));
    }

    // 3. Xem chi tiết bài tập
    @GetMapping("/assignments/{id}")
    public ResponseEntity<ApiResponse<Assignment>> getAssignmentById(@PathVariable UUID id) {
        Assignment assignment = assignmentService.getAssignmentById(id);
        return ResponseEntity.ok(ApiResponse.success("Assignment retrieved successfully", assignment));
    }

    // 4. Cập nhật bài tập
    @PutMapping("/assignments/{id}")
    public ResponseEntity<ApiResponse<Assignment>> updateAssignment(
            @PathVariable UUID id,
            @Valid @RequestBody AssignmentRequest request) {
        Assignment updated = assignmentService.updateAssignment(id, request);
        return ResponseEntity.ok(ApiResponse.success("Assignment updated successfully", updated));
    }

    // 5. Xóa bài tập
    @DeleteMapping("/assignments/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteAssignment(@PathVariable UUID id) {
        assignmentService.deleteAssignment(id);
        return ResponseEntity.ok(ApiResponse.success("Assignment deleted successfully", null));
    }
}