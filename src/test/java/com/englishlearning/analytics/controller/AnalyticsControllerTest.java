package com.englishlearning.analytics.controller;

import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.service.AnalyticsService;
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

import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AnalyticsController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AnalyticsController - RBAC & Hồ sơ năng lực cá nhân")
class AnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AnalyticsService analyticsService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID studentId = UUID.fromString("11111111-aaaa-bbbb-cccc-111111111111");
    private final UUID teacherId = UUID.fromString("22222222-aaaa-bbbb-cccc-222222222222");

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
    @DisplayName("ROLE_STUDENT truy cập được cả /my-profile và /student/me; ROLE_TEACHER bị 403; chưa đăng nhập bị 401")
    void getMyProfile_enforcesStudentRoleAcrossBothRoutes() throws Exception {
        StudentSkillProfile profile = StudentSkillProfile.builder()
                .id(studentId)
                .listeningScore(82.5)
                .readingScore(78.0)
                .speakingScore(75.0)
                .aiRecommendedPath("Tập trung kỹ năng Nói")
                .build();

        when(analyticsService.getMyProfile(studentId)).thenReturn(profile);

        mockMvc.perform(get("/api/v1/analytics/my-profile"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/analytics/my-profile")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/analytics/my-profile")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.listeningScore").value(82.5))
                .andExpect(jsonPath("$.data.aiRecommendedPath").value("Tập trung kỹ năng Nói"));

        mockMvc.perform(get("/api/v1/analytics/student/me")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.readingScore").value(78.0));
    }
}
