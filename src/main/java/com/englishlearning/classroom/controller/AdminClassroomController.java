package com.englishlearning.classroom.controller;

import com.englishlearning.classroom.dto.*;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.common.dto.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin/classrooms")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Classroom - Admin", description = "Quản lý lớp học, phân công giảng viên & duyệt học viên")
public class AdminClassroomController {

    private final ClassroomService classroomService;

    @PostMapping
    @Operation(summary = "Tạo lớp học mới")
    public ResponseEntity<ApiResponse<ClassroomResponse>> createClassroom(@Valid @RequestBody CreateClassroomRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Tạo lớp học thành công", classroomService.createClassroom(req)));
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách tất cả các lớp học")
    public ResponseEntity<ApiResponse<PageResponse<ClassroomResponse>>> getAllClassrooms(
            @RequestParam(required = false) ClassStatus status,
            @PageableDefault(size = 10) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(classroomService.getAllClassrooms(status, pageable)));
    }

    @PutMapping("/{id}/status")
    @Operation(summary = "Duyệt mở lớp, đóng lớp hoặc đổi trạng thái lớp")
    public ResponseEntity<ApiResponse<ClassroomResponse>> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateClassStatusRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật trạng thái lớp thành công", classroomService.updateClassStatus(id, req)));
    }

    @PutMapping("/{id}/assign-teacher")
    @Operation(summary = "Gán giảng viên phụ trách lớp học")
    public ResponseEntity<ApiResponse<ClassroomResponse>> assignTeacher(
            @PathVariable UUID id,
            @Valid @RequestBody AssignTeacherRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Phân công giảng viên thành công", classroomService.assignTeacher(id, req)));
    }

    @PostMapping("/{id}/enroll")
    @Operation(summary = "Tra cứu tài khoản và Add học viên vào lớp sau khi nộp học phí")
    public ResponseEntity<ApiResponse<String>> enrollStudent(
            @PathVariable UUID id,
            @Valid @RequestBody EnrollStudentRequest req) {
        classroomService.enrollStudent(id, req);
        return ResponseEntity.ok(ApiResponse.success("Ghi danh học viên vào lớp thành công", null));
    }
}