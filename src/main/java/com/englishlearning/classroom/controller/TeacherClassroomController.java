package com.englishlearning.classroom.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.classroom.dto.ClassroomResponse;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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
        return ResponseEntity.ok(ApiResponse.success(classroomService.getTeacherClasses(userDetails.getId())));
    }
}