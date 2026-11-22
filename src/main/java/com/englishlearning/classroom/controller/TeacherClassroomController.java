package com.englishlearning.classroom.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.classroom.dto.ClassroomResponse;
import com.englishlearning.classroom.dto.StudentProgressResponse;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.common.exception.ForbiddenException;
import com.englishlearning.common.exception.UnauthorizedException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/classrooms")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
@Tag(name = "Classroom - Teacher", description = "Danh sách lớp học phụ trách của giảng viên")
public class TeacherClassroomController {

    private final ClassroomService classroomService;

    @GetMapping
    @Operation(summary = "Lấy danh sách các lớp học Giảng viên đang phụ trách")
    public ResponseEntity<ApiResponse<List<ClassroomResponse>>> getAssignedClasses(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            throw new UnauthorizedException("Vui lòng đăng nhập");
        }
        return ResponseEntity.ok(ApiResponse.success(classroomService.getTeacherClasses(userDetails.getId())));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết lớp học theo ID")
    public ResponseEntity<ApiResponse<ClassroomResponse>> getClassDetail(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            throw new UnauthorizedException("Vui lòng đăng nhập");
        }
        ClassroomResponse classroom = classroomService.getClassroomById(id);
        enforceClassroomOwnership(classroom, userDetails);
        return ResponseEntity.ok(ApiResponse.success(classroom));
    }

    @GetMapping("/{id}/students")
    @Operation(summary = "Lấy danh sách học viên trong lớp (kèm tiến độ)")
    public ResponseEntity<ApiResponse<List<StudentProgressResponse>>> getClassStudents(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            throw new UnauthorizedException("Vui lòng đăng nhập");
        }
        ClassroomResponse classroom = classroomService.getClassroomById(id);
        enforceClassroomOwnership(classroom, userDetails);
        return ResponseEntity.ok(ApiResponse.success(classroomService.getClassStudentsProgress(id)));
    }

    private void enforceClassroomOwnership(ClassroomResponse classroom, CustomUserDetails userDetails) {
        boolean isAdmin = userDetails.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (isAdmin) {
            return;
        }
        if (classroom == null || classroom.getTeacherId() == null
                || !classroom.getTeacherId().equals(userDetails.getId())) {
            throw new ForbiddenException("Bạn không có quyền truy cập lớp học này");
        }
    }
}