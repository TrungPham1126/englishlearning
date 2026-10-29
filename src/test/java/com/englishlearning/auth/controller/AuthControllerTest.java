package com.englishlearning.auth.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.dto.AuthResponse;
import com.englishlearning.auth.dto.LoginRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.service.AuthService;
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
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AuthController - Kiểm thử Hợp đồng HTTP & Request Validation")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    @Test
    @DisplayName("Đăng nhập hợp lệ -> Trả về HTTP 200 OK và Token Response DTO chuẩn")
    void should_Return200AndTokenResponse_when_ValidLoginRequest() throws Exception {
        // Given
        UserSummaryDto userSummary = UserSummaryDto.builder()
                .id(UUID.fromString("11111111-1111-1111-1111-111111111111"))
                .email("student@englishlearning.com")
                .firstName("Van A")
                .lastName("Nguyen")
                .roles(List.of("ROLE_STUDENT"))
                .build();

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken("mocked.access.jwt.token")
                .tokenType("Bearer")
                .expiresIn(3600)
                .user(userSummary)
                .build();

        when(authService.login(any(LoginRequest.class)))
                .thenReturn(new AuthService.AuthResult(authResponse, "mocked-refresh-token-value"));

        // json-serialization.md: Dùng explicit JSON string literal
        String validLoginJson = """
                {
                  "email": "student@englishlearning.com",
                  "password": "Password123!"
                }
                """;

        // When & Then
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validLoginJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Đăng nhập thành công"))
                .andExpect(jsonPath("$.data.accessToken").value("mocked.access.jwt.token"))
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.expiresIn").value(3600))
                .andExpect(jsonPath("$.data.user.email").value("student@englishlearning.com"))
                .andExpect(jsonPath("$.data.user.firstName").value("Van A"));
    }

    @Test
    @DisplayName("Request body thiếu trường bắt buộc -> Trả về HTTP 400 Bad Request do @Valid validation")
    void should_Return400BadRequest_when_RequestBodyFailsValidation() throws Exception {
        // Given: Email sai định dạng và password để trống để kích hoạt MethodArgumentNotValidException
        String invalidLoginJson = """
                {
                  "email": "not-an-email",
                  "password": ""
                }
                """;

        // When & Then
        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidLoginJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.validationErrors.email").exists())
                .andExpect(jsonPath("$.validationErrors.password").exists());
    }

    @Test
    @DisplayName("Gọi refresh-token không có cookie refreshToken -> Trả về HTTP 401 Unauthorized")
    void should_Return401Unauthorized_when_TokenIsMissingOrInvalid() throws Exception {
        // When & Then: Không truyền Cookie refreshToken
        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .with(csrf()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Cookie không chứa refreshToken hợp lệ"));
    }
}
