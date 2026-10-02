package com.englishlearning.classroom.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.classroom.dto.MyCourseResponse;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/student/classrooms")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
@Tag(name = "Classroom - Student", description = "Khóa học của tôi và tiến độ")
public class StudentClassroomController {

    private final ClassroomService classroomService;

    @GetMapping("/my-courses")
    @Operation(summary = "Lấy danh sách khóa học của tôi (kèm tiến độ)")
    public ResponseEntity<ApiResponse<List<MyCourseResponse>>> getMyCourses(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success(classroomService.getStudentCourses(userDetails.getId())));
    }

    @PostMapping("/{id}/leave")
    @Operation(summary = "Học sinh tự rời lớp học")
    public ResponseEntity<ApiResponse<Void>> leaveClass(@PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        classroomService.leaveClass(id, userDetails.getId());
        return ResponseEntity.ok(ApiResponse.success("Đã rời lớp học", null));
    }
}