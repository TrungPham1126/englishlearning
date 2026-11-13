package com.englishlearning.auth.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.auth.service.UserService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.BadRequestException;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UserController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("UserController - Kiểm thử endpoint tải lên ảnh đại diện /api/v1/users/avatar")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private UUID userId;
    private CustomUserDetails customUserDetails;

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());

        userId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        User user = User.builder()
                .id(userId)
                .email("teacher@englishlearning.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        customUserDetails = new CustomUserDetails(user);
    }

    @Test
    @DisplayName("POST /api/v1/users/avatar hợp lệ -> Trả về 200 OK và avatarUrl")
    void updateAvatar_whenAuthenticatedWithCustomUserDetails_returns200() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[]{1, 2, 3});
        when(userService.uploadAndSaveAvatar(eq(userId), any()))
                .thenReturn("/uploads/avatars/avatar_" + userId + "_123.jpg");

        mockMvc.perform(multipart("/api/v1/users/avatar")
                        .file(file)
                        .with(user(customUserDetails))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Cập nhật avatar thành công"))
                .andExpect(jsonPath("$.data").value("/uploads/avatars/avatar_" + userId + "_123.jpg"));
    }

    @Test
    @DisplayName("POST /api/v1/users/avatar khi chưa đăng nhập -> Trả về 401 Unauthorized")
    void updateAvatar_whenUnauthenticated_returns401() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[]{1, 2});

        mockMvc.perform(multipart("/api/v1/users/avatar")
                        .file(file)
                        .with(csrf()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("POST /api/v1/users/avatar khi principal không phải CustomUserDetails -> Trả 401")
    @WithMockUser
    void updateAvatar_whenNullCustomUserDetails_returns401() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[]{1, 2});

        mockMvc.perform(multipart("/api/v1/users/avatar")
                        .file(file)
                        .with(csrf()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("POST /api/v1/users/avatar khi file sai định dạng hoặc vượt quá 5MB -> Trả về 400 Bad Request")
    void updateAvatar_whenServiceThrowsBadRequest_returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "huge.exe", "application/octet-stream", new byte[]{1});
        when(userService.uploadAndSaveAvatar(eq(userId), any()))
                .thenThrow(new BadRequestException("Dung lượng file ảnh tối đa là 5MB"));

        mockMvc.perform(multipart("/api/v1/users/avatar")
                        .file(file)
                        .with(user(customUserDetails))
                        .with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Dung lượng file ảnh tối đa là 5MB"));
    }
}
