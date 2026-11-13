package com.englishlearning.curriculum.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.curriculum.dto.GlobalResourceResponse;
import com.englishlearning.curriculum.service.GlobalResourceService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminResourceController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AdminResourceController - Kho tài nguyên dùng chung & Phân quyền")
class AdminResourceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GlobalResourceService resourceService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID adminId = UUID.fromString("aaaaaaaa-0000-0000-0000-000000000001");
    private final UUID resourceId = UUID.fromString("bbbbbbbb-0000-0000-0000-000000000002");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User u = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@test.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("GET /api/v1/admin/resources - ADMIN & TEACHER truy cập được, STUDENT bị 403, type lỗi trả 400")
    void getResources_allBranches() throws Exception {
        GlobalResourceResponse item = GlobalResourceResponse.builder()
                .id(resourceId)
                .name("cambridge_18.pdf")
                .size("2.50 MB")
                .usedCount(3)
                .uploadedAt("13-11-2026 07:00")
                .url("https://cdn.test/cambridge_18.pdf")
                .build();
        when(resourceService.getResourcesByType("DOC")).thenReturn(List.of(item));

        mockMvc.perform(get("/api/v1/admin/resources")
                        .param("type", "DOC")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("cambridge_18.pdf"));

        mockMvc.perform(get("/api/v1/admin/resources")
                        .param("type", "DOC")
                        .with(user(userWithRole(adminId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/resources")
                        .param("type", "DOC")
                        .with(user(userWithRole(adminId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/admin/resources")
                        .param("type", "DOC"))
                .andExpect(status().isUnauthorized());

        when(resourceService.getResourcesByType("BAD"))
                .thenThrow(new BadRequestException("Loại tài nguyên không hợp lệ: BAD"));
        mockMvc.perform(get("/api/v1/admin/resources")
                        .param("type", "BAD")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/v1/admin/resources/upload & DELETE /{id} - Upload thành công, non-CustomUserDetails 401, xóa 200")
    void uploadAndDeleteResource_allBranches() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "deck.pdf", "application/pdf", new byte[]{1, 2});
        doNothing().when(resourceService).uploadResource(any(), eq("DOC"), eq(adminId));

        mockMvc.perform(multipart("/api/v1/admin/resources/upload")
                        .file(file)
                        .param("type", "DOC")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN)))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Upload thành công"));

        verify(resourceService).uploadResource(any(), eq("DOC"), eq(adminId));

        mockMvc.perform(multipart("/api/v1/admin/resources/upload")
                        .file(file)
                        .param("type", "DOC")
                        .with(user("plainAdmin").roles("ADMIN"))
                        .with(csrf()))
                .andExpect(status().isUnauthorized());

        doNothing().when(resourceService).deleteResource(resourceId);
        mockMvc.perform(delete("/api/v1/admin/resources/{id}", resourceId)
                        .with(user(userWithRole(adminId, RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Xóa thành công"));
    }
}
