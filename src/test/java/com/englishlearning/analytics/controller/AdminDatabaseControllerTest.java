package com.englishlearning.analytics.controller;

import com.englishlearning.analytics.dto.AdminDatabaseOverviewDto;
import com.englishlearning.analytics.dto.ClassroomDetailedReportDto;
import com.englishlearning.analytics.dto.ClassroomPurgeResultDto;
import com.englishlearning.analytics.dto.R2CostReportDto;
import com.englishlearning.analytics.service.AdminDatabaseService;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = AdminDatabaseController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AdminDatabaseController - Kiểm thử Phân quyền ROLE_ADMIN & Export Báo Cáo")
class AdminDatabaseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminDatabaseService adminDatabaseService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID adminId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID teacherId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID classId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User user = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@englishlearning.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(user);
    }

    @Test
    @DisplayName("ROLE_ADMIN truy cập thành công overview, purge, delete, r2-report và xuất Excel")
    void adminEndpoints_allowAdminRole() throws Exception {
        when(adminDatabaseService.getDatabaseOverview()).thenReturn(
                AdminDatabaseOverviewDto.builder().totalClassrooms(2).completedClassrooms(1).classrooms(Collections.emptyList()).build());
        when(adminDatabaseService.purgeClassroomSubmissions(eq(classId), eq(false), eq(adminId), any()))
                .thenReturn(ClassroomPurgeResultDto.builder().classroomId(classId).deletedAttempts(5).message("Đã dọn sạch").build());
        when(adminDatabaseService.deleteClassroom(eq(classId), eq(adminId), any()))
                .thenReturn(ClassroomPurgeResultDto.builder().classroomId(classId).entireClassroomDeleted(true).message("Đã xóa lớp").build());
        when(adminDatabaseService.getClassroomDetailedReport(classId))
                .thenReturn(ClassroomDetailedReportDto.builder().classroomId(classId).classroomName("IELTS K01").build());
        when(adminDatabaseService.exportClassroomReportExcel(any(ClassroomDetailedReportDto.class)))
                .thenReturn(new byte[]{1, 2, 3});
        when(adminDatabaseService.exportCenterOverviewExcel())
                .thenReturn(new byte[]{4, 5, 6});
        when(adminDatabaseService.getR2CostReport())
                .thenReturn(R2CostReportDto.builder().bucketName("test-r2").totalPayableUsd(0.0).build());

        CustomUserDetails admin = userWithRole(adminId, RoleName.ROLE_ADMIN);

        mockMvc.perform(get("/api/v1/admin/database/overview").with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalClassrooms").value(2));

        mockMvc.perform(post("/api/v1/admin/database/classrooms/{id}/purge-submissions", classId).with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deletedAttempts").value(5));

        mockMvc.perform(delete("/api/v1/admin/database/classrooms/{id}", classId).with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.entireClassroomDeleted").value(true));

        mockMvc.perform(get("/api/v1/admin/database/classrooms/{id}/report", classId).with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("Bao_cao_lop_IELTS_K01.xlsx")));

        mockMvc.perform(get("/api/v1/admin/database/export-center-report").with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("Bao_cao_tong_hop_trung_tam_ELP.xlsx")));

        mockMvc.perform(get("/api/v1/admin/database/r2-report").with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bucketName").value("test-r2"));
    }

    @Test
    @DisplayName("ROLE_TEACHER và ROLE_STUDENT bị từ chối 403 Forbidden trên mọi endpoint quản trị DB/R2")
    void adminEndpoints_forbidTeacherAndStudent() throws Exception {
        CustomUserDetails teacher = userWithRole(teacherId, RoleName.ROLE_TEACHER);
        CustomUserDetails student = userWithRole(UUID.randomUUID(), RoleName.ROLE_STUDENT);

        mockMvc.perform(get("/api/v1/admin/database/overview").with(user(teacher)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/admin/database/classrooms/{id}/purge-submissions", classId).with(user(teacher)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/admin/database/classrooms/{id}", classId).with(user(student)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/database/r2-report").with(user(student)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/database/export-center-report").with(user(student)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/database/classrooms/{id}/report-summary", classId).with(user(teacher)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/database/overview"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Kiểm thử report-summary, purge force=true, mã lỗi 400/404 và làm sạch tên file Excel chống ký tự độc hại/SQLi")
    void adminEndpoints_handleReportSummaryForcePurgeErrorCodesAndSafeFilenameSlug() throws Exception {
        CustomUserDetails admin = userWithRole(adminId, RoleName.ROLE_ADMIN);

        when(adminDatabaseService.getClassroomDetailedReport(classId))
                .thenReturn(ClassroomDetailedReportDto.builder()
                        .classroomId(classId)
                        .classroomName("Lớp Đàm Thoại'; DROP TABLE users;--")
                        .totalStudents(12)
                        .build())
                .thenReturn(ClassroomDetailedReportDto.builder()
                        .classroomId(classId)
                        .classroomName("Lớp Đàm Thoại'; DROP TABLE users;--")
                        .build())
                .thenReturn(ClassroomDetailedReportDto.builder()
                        .classroomId(classId)
                        .classroomName("   ??? ***   ")
                        .build());
        when(adminDatabaseService.exportClassroomReportExcel(any(ClassroomDetailedReportDto.class)))
                .thenReturn(new byte[]{7, 8, 9});

        mockMvc.perform(get("/api/v1/admin/database/classrooms/{id}/report-summary", classId).with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalStudents").value(12));

        // Tên lớp chứa tiếng Việt có dấu đ/Đ và chuỗi SQL injection -> chuẩn hóa thành slug an toàn
        mockMvc.perform(get("/api/v1/admin/database/classrooms/{id}/report", classId).with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("Bao_cao_lop_Lop_Dam_Thoai_DROP_TABLE_users_--.xlsx")));

        // Tên lớp chỉ gồm ký tự đặc biệt -> fallback về Bao_cao_lop_lop_hoc.xlsx
        mockMvc.perform(get("/api/v1/admin/database/classrooms/{id}/report", classId).with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("Bao_cao_lop_lop_hoc.xlsx")));

        // Purge với force=true khi lớp không tồn tại (404) hoặc vi phạm điều kiện (400)
        UUID missingId = UUID.randomUUID();
        when(adminDatabaseService.purgeClassroomSubmissions(eq(missingId), eq(true), eq(adminId), any()))
                .thenThrow(new com.englishlearning.common.exception.ResourceNotFoundException("Không tìm thấy lớp học"));
        mockMvc.perform(post("/api/v1/admin/database/classrooms/{id}/purge-submissions", missingId)
                        .param("force", "true")
                        .with(user(admin)))
                .andExpect(status().isNotFound());

        when(adminDatabaseService.purgeClassroomSubmissions(eq(classId), eq(false), eq(adminId), any()))
                .thenThrow(new com.englishlearning.common.exception.BadRequestException("Lớp chưa kết thúc"));
        mockMvc.perform(post("/api/v1/admin/database/classrooms/{id}/purge-submissions", classId)
                        .with(user(admin)))
                .andExpect(status().isBadRequest());
    }
}
