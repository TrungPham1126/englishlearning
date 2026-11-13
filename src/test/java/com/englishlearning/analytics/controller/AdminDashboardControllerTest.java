package com.englishlearning.analytics.controller;

import com.englishlearning.analytics.dto.AdminDashboardStats;
import com.englishlearning.analytics.service.AdminDashboardService;
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

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminDashboardController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AdminDashboardController - Kiểm thử RBAC ROLE_ADMIN & Thống kê Dashboard")
class AdminDashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminDashboardService adminDashboardService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID adminId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID teacherId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID studentId = UUID.fromString("33333333-3333-3333-3333-333333333333");

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
    @DisplayName("Chỉ ROLE_ADMIN được xem Admin Dashboard; TEACHER/STUDENT bị 403 và ẩn danh bị 401")
    void getStats_allowsOnlyAdmin() throws Exception {
        AdminDashboardStats stats = AdminDashboardStats.builder()
                .totalUsers(120L)
                .totalClasses(8L)
                .completionRate(87.5)
                .averageSkillScores(Map.of("Listening", 80.0, "Reading", 75.0))
                .build();
        when(adminDashboardService.getDashboardStats()).thenReturn(stats);

        mockMvc.perform(get("/api/v1/admin/dashboard/stats"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/admin/dashboard/stats")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/admin/dashboard/stats")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/admin/dashboard/stats")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalUsers").value(120))
                .andExpect(jsonPath("$.data.completionRate").value(87.5))
                .andExpect(jsonPath("$.data.averageSkillScores.Listening").value(80.0));
    }
}
