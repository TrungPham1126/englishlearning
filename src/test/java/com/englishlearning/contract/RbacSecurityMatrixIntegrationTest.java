package com.englishlearning.contract;

import com.englishlearning.ai.controller.AdminAiMonitoringController;
import com.englishlearning.ai.dto.AiStatsResponse;
import com.englishlearning.ai.dto.StudentQuotaResponse;
import com.englishlearning.ai.dto.UpdateQuotaRequest;
import com.englishlearning.ai.service.AiMonitoringService;
import com.englishlearning.ai.websocket.AudioWebSocketHandler;
import com.englishlearning.analytics.controller.AdminDashboardController;
import com.englishlearning.analytics.controller.AdminDatabaseController;
import com.englishlearning.analytics.controller.AnalyticsController;
import com.englishlearning.analytics.dto.AdminDashboardStats;
import com.englishlearning.analytics.dto.AdminDatabaseOverviewDto;
import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.service.AdminDashboardService;
import com.englishlearning.analytics.service.AdminDatabaseService;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.controller.AdminUserController;
import com.englishlearning.auth.controller.AuthController;
import com.englishlearning.auth.dto.AuthResponse;
import com.englishlearning.auth.dto.LoginRequest;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.AdminUserService;
import com.englishlearning.auth.service.AuthService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.classroom.controller.AdminClassroomController;
import com.englishlearning.classroom.controller.StudentClassroomController;
import com.englishlearning.classroom.controller.TeacherClassroomController;
import com.englishlearning.classroom.dto.ClassroomResponse;
import com.englishlearning.classroom.dto.CreateClassroomRequest;
import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.config.AudioWebSocketConfig;
import com.englishlearning.common.config.JacksonConfig;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.curriculum.controller.AdminResourceController;
import com.englishlearning.curriculum.service.GlobalResourceService;
import com.englishlearning.submission.controller.StudentSubmissionController;
import com.englishlearning.submission.controller.TeacherGradingController;
import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.service.SubmissionService;
import com.englishlearning.system.controller.AuditLogController;
import com.englishlearning.system.repository.AuditLogRepository;
import com.englishlearning.video.controller.VideoController;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.service.VideoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistration;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {
        AdminAiMonitoringController.class,
        AdminUserController.class,
        AuditLogController.class,
        AdminDashboardController.class,
        AdminDatabaseController.class,
        AdminClassroomController.class,
        TeacherClassroomController.class,
        StudentClassroomController.class,
        TeacherGradingController.class,
        StudentSubmissionController.class,
        AnalyticsController.class,
        AuthController.class,
        VideoController.class,
        AdminResourceController.class
})
@AutoConfigureMockMvc
@Import({
        SecurityConfig.class,
        JwtAuthenticationEntryPoint.class,
        GlobalExceptionHandler.class,
        JacksonConfig.class
})
@DisplayName("RBAC Security Matrix, Public PermitAll Endpoints, CORS & WebSocket Registration")
class RbacSecurityMatrixIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AiMonitoringService aiMonitoringService;
    @MockBean private AdminUserService adminUserService;
    @MockBean private AuditLogRepository auditLogRepository;
    @MockBean private AdminDashboardService adminDashboardService;
    @MockBean private AdminDatabaseService adminDatabaseService;
    @MockBean private ClassroomService classroomService;
    @MockBean private SubmissionService submissionService;
    @MockBean private AnalyticsService analyticsService;
    @MockBean private AuthService authService;
    @MockBean private VideoService videoService;
    @MockBean private GlobalResourceService globalResourceService;

    @MockBean private JwtService jwtService;
    @MockBean private UserDetailsService userDetailsService;
    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID adminId = UUID.fromString("aaaaaaaa-0000-0000-0000-000000000001");
    private final UUID teacherId = UUID.fromString("bbbbbbbb-0000-0000-0000-000000000002");
    private final UUID studentId = UUID.fromString("cccccccc-0000-0000-0000-000000000003");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User u = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@rbac.test")
                .password("secret")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("Admin AI Monitoring RBAC: TEACHER xem GET /stats & /quotas nhưng bị 403 ở PUT /quotas & POST /kill-switch/toggle")
    void adminAiMonitoringRbac_restrictsMutationsToAdminOnly() throws Exception {
        when(aiMonitoringService.getStats()).thenReturn(AiStatsResponse.builder().build());
        when(aiMonitoringService.getAllQuotas()).thenReturn(List.of(StudentQuotaResponse.builder().studentId(studentId).build()));
        when(aiMonitoringService.toggleGlobalKillSwitch()).thenReturn(true);
        doNothing().when(aiMonitoringService).updateQuota(eq(studentId), any());

        UpdateQuotaRequest req = new UpdateQuotaRequest();
        req.setDailyLimit(100);
        req.setIsBlocked(false);

        // Unauthenticated -> 401
        mockMvc.perform(get("/api/v1/admin/ai-monitoring/stats")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/admin/ai-monitoring/kill-switch/toggle")).andExpect(status().isUnauthorized());

        // STUDENT -> 403 across all
        mockMvc.perform(get("/api/v1/admin/ai-monitoring/stats").with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/ai-monitoring/quotas").with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        // TEACHER -> 200 on GET (used by Teacher AI Quotas check), 403 on PUT/POST mutations
        mockMvc.perform(get("/api/v1/admin/ai-monitoring/stats").with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/ai-monitoring/quotas").with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/v1/admin/ai-monitoring/quotas/{studentId}", studentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/admin/ai-monitoring/kill-switch/toggle")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isForbidden());

        // ADMIN -> 200 on all
        mockMvc.perform(put("/api/v1/admin/ai-monitoring/quotas/{studentId}", studentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/admin/ai-monitoring/kill-switch/toggle")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Cross-Role RBAC Matrix: phân quyền chính xác ADMIN vs TEACHER vs STUDENT vs ANONYMOUS trên toàn bộ phân hệ")
    void crossRoleMatrix_enforcesAuthorizationBoundaries() throws Exception {
        UUID anyId = UUID.randomUUID();

        when(adminUserService.getAllUsers(any(), any(), any(Pageable.class)))
                .thenReturn(PageResponse.<com.englishlearning.auth.dto.UserSummaryDto>builder().content(List.of()).build());
        when(auditLogRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));
        when(adminDashboardService.getDashboardStats()).thenReturn(AdminDashboardStats.builder().build());
        when(adminDatabaseService.getDatabaseOverview()).thenReturn(AdminDatabaseOverviewDto.builder().build());
        when(classroomService.createClassroom(any())).thenReturn(ClassroomResponse.builder().id(anyId).name("IELTS").build());
        when(classroomService.getTeacherClasses(any())).thenReturn(Collections.emptyList());
        when(classroomService.getStudentCourses(any())).thenReturn(Collections.emptyList());
        when(submissionService.getAttemptDetail(eq(anyId), any(), eq(true))).thenReturn(AttemptResponse.builder().attemptId(anyId).build());
        when(submissionService.startAttempt(eq(studentId), eq(anyId))).thenReturn(AttemptResponse.builder().attemptId(anyId).build());
        when(analyticsService.getMyProfile(studentId)).thenReturn(StudentSkillProfile.builder().id(studentId).build());
        when(globalResourceService.getResourcesByType("DOC")).thenReturn(Collections.emptyList());
        doNothing().when(globalResourceService).deleteResource(anyId);

        CustomUserDetails admin = userWithRole(adminId, RoleName.ROLE_ADMIN);
        CustomUserDetails teacher = userWithRole(teacherId, RoleName.ROLE_TEACHER);
        CustomUserDetails student = userWithRole(studentId, RoleName.ROLE_STUDENT);

        // 1. Admin-only endpoints: ADMIN=200, TEACHER=403, STUDENT=403
        mockMvc.perform(get("/api/v1/admin/users").with(user(admin))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/users").with(user(teacher))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/users").with(user(student))).andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/admin/audit-logs").with(user(admin))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/audit-logs").with(user(teacher))).andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/admin/dashboard/stats").with(user(admin))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/dashboard/stats").with(user(student))).andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/admin/database/overview").with(user(admin))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/database/overview").with(user(teacher))).andExpect(status().isForbidden());

        CreateClassroomRequest createClassReq = new CreateClassroomRequest();
        createClassReq.setName("B2 Bridge");
        createClassReq.setLevel(ClassLevel.B2);
        mockMvc.perform(post("/api/admin/classrooms").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createClassReq)).with(user(admin)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/admin/classrooms").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createClassReq)).with(user(teacher)))
                .andExpect(status().isForbidden());

        // 2. Teacher/Admin endpoints: TEACHER=200, ADMIN=200, STUDENT=403
        mockMvc.perform(get("/api/teacher/classrooms").with(user(teacher))).andExpect(status().isOk());
        mockMvc.perform(get("/api/teacher/classrooms").with(user(admin))).andExpect(status().isOk());
        mockMvc.perform(get("/api/teacher/classrooms").with(user(student))).andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/teacher/submissions/{id}", anyId).with(user(teacher))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/teacher/submissions/{id}", anyId).with(user(student))).andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/v1/admin/resources/{id}", anyId).with(user(teacher))).andExpect(status().isOk());
        mockMvc.perform(delete("/api/v1/admin/resources/{id}", anyId).with(user(student))).andExpect(status().isForbidden());

        // 3. Student endpoints: STUDENT=200, TEACHER=403
        mockMvc.perform(get("/api/student/classrooms/my-courses").with(user(student))).andExpect(status().isOk());
        mockMvc.perform(get("/api/student/classrooms/my-courses").with(user(teacher))).andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/student/assignments/{id}/start", anyId).with(user(student))).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/student/assignments/{id}/start", anyId).with(user(teacher))).andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/analytics/my-profile").with(user(student))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/analytics/my-profile").with(user(admin))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PermitAll, CORS Preflight & AudioWebSocketConfig: endpoint công khai không đòi JWT và /ws/audio được đăng ký")
    void publicEndpointsCorsAndWebSocketRegistration_workAsConfigured() throws Exception {
        UUID videoId = UUID.randomUUID();
        when(authService.login(any(LoginRequest.class)))
                .thenReturn(new AuthService.AuthResult(AuthResponse.builder().accessToken("jwt").build(), "refresh-jwt"));
        when(videoService.getVideoById(videoId)).thenReturn(Video.builder().id(videoId).rawStorageUrl("missing.mp4").build());

        LoginRequest loginReq = new LoginRequest();
        loginReq.setEmail("user@english.test");
        loginReq.setPassword("Pass@123");

        // PermitAll routes reachable without authentication
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk());

        // Missing file -> 404 (not 401), confirming anonymous access is permitted by SecurityConfig
        mockMvc.perform(get("/api/v1/videos/{id}/raw", videoId))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/videos/{id}/hls/notfound.m3u8", videoId))
                .andExpect(status().isNotFound());

        // CORS Preflight check
        mockMvc.perform(options("/api/v1/auth/login")
                        .header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));

        // Verify AudioWebSocketConfig registers /ws/audio
        AudioWebSocketHandler handler = mock(AudioWebSocketHandler.class);
        WebSocketHandlerRegistry registry = mock(WebSocketHandlerRegistry.class);
        WebSocketHandlerRegistration registration = mock(WebSocketHandlerRegistration.class);
        when(registry.addHandler(handler, "/ws/audio")).thenReturn(registration);

        new AudioWebSocketConfig(handler).registerWebSocketHandlers(registry);

        verify(registry).addHandler(handler, "/ws/audio");
        verify(registration).setAllowedOriginPatterns("*");
    }
}
