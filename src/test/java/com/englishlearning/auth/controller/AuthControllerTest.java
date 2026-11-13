package com.englishlearning.auth.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.dto.AuthResponse;
import com.englishlearning.auth.dto.LoginRequest;
import com.englishlearning.auth.dto.UpdateProfileRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.AuthService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.UnauthorizedException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AuthController - Kiểm thử Hợp đồng HTTP, Cookie, Bảo mật & Profile")
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

    private CustomUserDetails customStudentDetails;
    private UUID studentId;

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());

        studentId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        User studentUser = User.builder()
                .id(studentId)
                .email("student@englishlearning.com")
                .password("hashed")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        customStudentDetails = new CustomUserDetails(studentUser);
    }

    @Test
    @DisplayName("Đăng nhập hợp lệ -> Trả về HTTP 200 OK, Token Response DTO và Set-Cookie HttpOnly")
    void should_Return200AndTokenResponse_when_ValidLoginRequest() throws Exception {
        // Given
        UserSummaryDto userSummary = UserSummaryDto.builder()
                .id(studentId)
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
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refreshToken=mocked-refresh-token-value")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")))
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Đăng nhập thành công"))
                .andExpect(jsonPath("$.data.accessToken").value("mocked.access.jwt.token"))
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.expiresIn").value(3600))
                .andExpect(jsonPath("$.data.user.email").value("student@englishlearning.com"))
                .andExpect(jsonPath("$.data.user.firstName").value("Van A"));
    }

    @Test
    @DisplayName("Đăng nhập khi tài khoản bị khóa (DisabledException) -> Trả về HTTP 401 Unauthorized")
    void login_whenAccountDisabled_returns401Unauthorized() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new DisabledException("Tài khoản đã bị khóa"));

        String loginJson = """
                {
                  "email": "locked@englishlearning.com",
                  "password": "Password123!"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Tài khoản đã bị khóa"));
    }

    @Test
    @DisplayName("Request body thiếu trường bắt buộc -> Trả về HTTP 400 Bad Request do @Valid validation")
    void should_Return400BadRequest_when_RequestBodyFailsValidation() throws Exception {
        String invalidLoginJson = """
                {
                  "email": "not-an-email",
                  "password": ""
                }
                """;

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
    @DisplayName("POST /register khi đã xác thực -> Bị khóa chức năng tự đăng ký, trả về 403 Forbidden")
    @WithMockUser(roles = {"STUDENT"})
    void register_whenCalled_returns403Forbidden() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").value(containsString("Chức năng tự đăng ký đã bị khóa")));
    }

    @Test
    @DisplayName("Gọi refresh-token không có cookie refreshToken -> Trả về HTTP 401 Unauthorized")
    void should_Return401Unauthorized_when_TokenIsMissingOrInvalid() throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .with(csrf()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Cookie không chứa refreshToken hợp lệ"));
    }

    @Test
    @DisplayName("Gọi refresh-token với cookie hợp lệ -> Trả về 200 OK, cấp Access Token mới và xoay vòng Cookie")
    void refreshToken_withValidCookie_returns200AndRotatesCookie() throws Exception {
        AuthResponse refreshed = AuthResponse.builder()
                .accessToken("new.access.token")
                .expiresIn(1800)
                .build();

        when(authService.refreshToken("old-valid-cookie-token"))
                .thenReturn(new AuthService.AuthResult(refreshed, "new-rotated-cookie-token"));

        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .with(csrf())
                        .cookie(new Cookie("refreshToken", "old-valid-cookie-token")))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refreshToken=new-rotated-cookie-token")))
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Cấp mới token thành công"))
                .andExpect(jsonPath("$.data.accessToken").value("new.access.token"));
    }

    @Test
    @DisplayName("Gọi refresh-token khi tài khoản bị khóa hoặc token hết hạn -> Trả về HTTP 401")
    void refreshToken_whenServiceThrowsUnauthorized_returns401() throws Exception {
        when(authService.refreshToken("revoked-or-locked-token"))
                .thenThrow(new UnauthorizedException("Tài khoản đã bị khóa hoặc vô hiệu hóa"));

        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .with(csrf())
                        .cookie(new Cookie("refreshToken", "revoked-or-locked-token")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Tài khoản đã bị khóa hoặc vô hiệu hóa"));
    }

    @Test
    @DisplayName("POST /logout khi đã đăng nhập -> Thu hồi token, xóa cookie (Max-Age=0) và trả 200 OK")
    void logout_whenAuthenticatedWithCookie_revokesAndClearsCookie() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")
                        .with(user(customStudentDetails))
                        .with(csrf())
                        .cookie(new Cookie("refreshToken", "active-refresh-token")))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")))
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Đăng xuất thành công"));

        verify(authService).logout("active-refresh-token");
    }

    @Test
    @DisplayName("GET /me khi chưa đăng nhập -> JwtAuthenticationEntryPoint trả về 401 Unauthorized")
    void getCurrentUser_whenUnauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("GET /me với CustomUserDetails hợp lệ -> Trả về HTTP 200 cùng profile")
    void getCurrentUser_whenAuthenticatedWithCustomUserDetails_returns200Profile() throws Exception {
        UserSummaryDto summary = UserSummaryDto.builder()
                .id(studentId)
                .email("student@englishlearning.com")
                .firstName("Van A")
                .roles(List.of("ROLE_STUDENT"))
                .build();
        when(authService.getCurrentUserProfile(studentId)).thenReturn(summary);

        mockMvc.perform(get("/api/v1/auth/me")
                        .with(user(customStudentDetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.id").value(studentId.toString()))
                .andExpect(jsonPath("$.data.email").value("student@englishlearning.com"));
    }

    @Test
    @DisplayName("GET /me khi AuthenticationPrincipal không phải CustomUserDetails (null) -> Trả 401 thay vì 500 NPE")
    @WithMockUser
    void getCurrentUser_whenPrincipalIsNotCustomUserDetails_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("PUT /me -> Cập nhật thông tin hồ sơ thành công")
    void updateProfile_whenAuthenticated_returns200UpdatedUser() throws Exception {
        UserSummaryDto updated = UserSummaryDto.builder()
                .id(studentId)
                .email("student@englishlearning.com")
                .firstName("Updated")
                .lastName("Student")
                .targetCefr("C1")
                .build();
        when(authService.updateProfile(eq(studentId), any(UpdateProfileRequest.class))).thenReturn(updated);

        String payload = """
                {
                  "firstName": "Updated",
                  "lastName": "Student",
                  "phone": "0909998888",
                  "targetCefr": "C1"
                }
                """;

        mockMvc.perform(put("/api/v1/auth/me")
                        .with(user(customStudentDetails))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.firstName").value("Updated"))
                .andExpect(jsonPath("$.data.targetCefr").value("C1"));
    }

    @Test
    @DisplayName("POST /me/avatar hợp lệ -> Trả về HTTP 200 OK và URL ảnh đại diện")
    void uploadAvatar_whenValidMultipart_returns200() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3});
        UserSummaryDto summary = UserSummaryDto.builder()
                .id(studentId)
                .avatarUrl("/uploads/avatars/avatar_111.png")
                .build();
        when(authService.updateAvatar(eq(studentId), any())).thenReturn(summary);

        mockMvc.perform(multipart("/api/v1/auth/me/avatar")
                        .file(file)
                        .with(user(customStudentDetails))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.avatarUrl").value("/uploads/avatars/avatar_111.png"));
    }

    @Test
    @DisplayName("POST /me/avatar sai định dạng -> GlobalExceptionHandler trả về HTTP 400")
    void uploadAvatar_whenServiceRejectsFormat_returns400() throws Exception {
        MockMultipartFile badFile = new MockMultipartFile("file", "script.js", "application/javascript", "alert(1)".getBytes());
        when(authService.updateAvatar(eq(studentId), any()))
                .thenThrow(new BadRequestException("Chỉ chấp nhận các định dạng file ảnh (JPEG, PNG, WEBP, GIF)"));

        mockMvc.perform(multipart("/api/v1/auth/me/avatar")
                        .file(badFile)
                        .with(user(customStudentDetails))
                        .with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Chỉ chấp nhận các định dạng file ảnh (JPEG, PNG, WEBP, GIF)"));
    }
}
