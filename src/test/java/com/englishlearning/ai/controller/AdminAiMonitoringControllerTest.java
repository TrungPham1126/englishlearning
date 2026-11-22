package com.englishlearning.ai.controller;

import com.englishlearning.ai.dto.AiStatsResponse;
import com.englishlearning.ai.dto.StudentQuotaResponse;
import com.englishlearning.ai.dto.UpdateQuotaRequest;
import com.englishlearning.ai.service.AiMonitoringService;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.ResourceNotFoundException;
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
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminAiMonitoringController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AdminAiMonitoringController - RBAC, Thống kê AI, Quotas & Kill-Switch")
class AdminAiMonitoringControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AiMonitoringService monitoringService;
    @MockBean private JwtService jwtService;
    @MockBean private UserDetailsService userDetailsService;
    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID adminId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID studentId = UUID.fromString("22222222-2222-2222-2222-222222222222");

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
                .email(roleName.name().toLowerCase() + "@english.test")
                .password("pwd")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("GET /stats & /quotas: 401 chưa đăng nhập, 403 đối với STUDENT, 200 cho ADMIN & TEACHER")
    void statsAndQuotas_enforceAdminOrTeacherRole() throws Exception {
        AiStatsResponse stats = AiStatsResponse.builder()
                .totalTokens(12500L)
                .estimatedCostUsd(0.015)
                .systemKillSwitchActive(false)
                .build();
        when(monitoringService.getStats()).thenReturn(stats);
        when(monitoringService.getAllQuotas()).thenReturn(List.of(
                StudentQuotaResponse.builder().studentId(studentId).studentName("Lan").role("STUDENT").dailyLimit(20).build()
        ));

        mockMvc.perform(get("/api/v1/admin/ai-monitoring/stats"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/admin/ai-monitoring/stats")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/admin/ai-monitoring/stats")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalTokens").value(12500));

        mockMvc.perform(get("/api/v1/admin/ai-monitoring/quotas")
                        .with(user(userWithRole(UUID.randomUUID(), RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].studentName").value("Lan"));
    }

    @Test
    @DisplayName("PUT /quotas/{studentId}: trả 200 khi thành công và 404 khi không tìm thấy học viên")
    void updateQuota_handlesSuccessAndNotFound() throws Exception {
        UpdateQuotaRequest req = new UpdateQuotaRequest();
        req.setDailyLimit(50);
        req.setIsBlocked(false);

        doNothing().when(monitoringService).updateQuota(studentId, req);

        mockMvc.perform(put("/api/v1/admin/ai-monitoring/quotas/{studentId}", studentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Cập nhật thành công"));

        UUID missingId = UUID.randomUUID();
        doThrow(new ResourceNotFoundException("Không tìm thấy Quota của học viên này"))
                .when(monitoringService).updateQuota(missingId, req);

        mockMvc.perform(put("/api/v1/admin/ai-monitoring/quotas/{studentId}", missingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Không tìm thấy Quota của học viên này"));
    }

    @Test
    @DisplayName("POST /kill-switch/toggle: trả thông điệp tương ứng trạng thái kích hoạt và mở lại")
    void toggleKillSwitch_returnsDescriptiveMessages() throws Exception {
        when(monitoringService.toggleGlobalKillSwitch()).thenReturn(true, false);

        mockMvc.perform(post("/api/v1/admin/ai-monitoring/kill-switch/toggle")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã kích hoạt ngắt AI khẩn cấp toàn hệ thống"))
                .andExpect(jsonPath("$.data").value(true));

        mockMvc.perform(post("/api/v1/admin/ai-monitoring/kill-switch/toggle")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã mở lại hoạt động AI toàn hệ thống"))
                .andExpect(jsonPath("$.data").value(false));
    }

    @Test
    @DisplayName("RBAC /quotas, PUT /quotas/{id} & /kill-switch/toggle: chặn 401 chưa đăng nhập, 403 STUDENT và 403 TEACHER trên endpoint chỉ ADMIN")
    void adminOnlyEndpointsAndQuotas_enforceRbacForUnauthenticatedStudentAndTeacher() throws Exception {
        UpdateQuotaRequest req = new UpdateQuotaRequest();
        req.setDailyLimit(30);
        req.setIsBlocked(false);

        mockMvc.perform(get("/api/v1/admin/ai-monitoring/quotas"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/v1/admin/ai-monitoring/quotas/{studentId}", studentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/admin/ai-monitoring/kill-switch/toggle"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/admin/ai-monitoring/quotas")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/v1/admin/ai-monitoring/quotas/{studentId}", studentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/admin/ai-monitoring/kill-switch/toggle")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        UUID teacherId = UUID.randomUUID();
        mockMvc.perform(put("/api/v1/admin/ai-monitoring/quotas/{studentId}", studentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/admin/ai-monitoring/kill-switch/toggle")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isForbidden());

        org.mockito.Mockito.verifyNoInteractions(monitoringService);
    }
}
