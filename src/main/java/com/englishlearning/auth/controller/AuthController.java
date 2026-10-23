package com.englishlearning.auth.controller;

import com.englishlearning.auth.dto.AuthResponse;
import com.englishlearning.auth.dto.LoginRequest;
import com.englishlearning.auth.dto.RegistrationRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.service.AuthService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.common.exception.ForbiddenException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Endpoints dành cho Đăng ký, Đăng nhập, Token và Profile")
public class AuthController {

    private final AuthService authService;

    @Value("${jwt.refresh-token-expiration-ms:60480000000}")
    private long refreshTokenDurationMs;

    @PostMapping("/register")
    @Operation(summary = "Đăng ký tài khoản mới (Đã vô hiệu hóa)")
    public ResponseEntity<ApiResponse<UserSummaryDto>> register(@RequestBody(required = false) RegistrationRequest request) {
        throw new ForbiddenException("Chức năng tự đăng ký đã bị khóa. Vui lòng liên hệ Quản trị viên để được cấp tài khoản.");
    }

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập bằng email và mật khẩu")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        AuthService.AuthResult result = authService.login(request);
        setRefreshTokenCookie(response, result.rawRefreshToken(), refreshTokenDurationMs / 1000);

        return ResponseEntity.ok(ApiResponse.success("Đăng nhập thành công", result.response()));
    }

    @PostMapping("/refresh-token")
    @Operation(summary = "Lấy cặp Access Token mới thông qua Refresh Token (lưu trong HttpOnly cookie)")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            @CookieValue(name = "refreshToken", required = false) String refreshToken,
            HttpServletResponse response) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.<AuthResponse>builder()
                            .status(HttpStatus.UNAUTHORIZED.value())
                            .message("Cookie không chứa refreshToken hợp lệ")
                            .build());
        }

        AuthService.AuthResult result = authService.refreshToken(refreshToken);
        setRefreshTokenCookie(response, result.rawRefreshToken(), refreshTokenDurationMs / 1000);

        return ResponseEntity.ok(ApiResponse.success("Cấp mới token thành công", result.response()));
    }

    @PostMapping("/logout")
    @Operation(summary = "Đăng xuất tài khoản và vô hiệu hóa token")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = "refreshToken", required = false) String refreshToken,
            HttpServletResponse response) {
        authService.logout(refreshToken);
        deleteRefreshTokenCookie(response);
        return ResponseEntity.ok(ApiResponse.success("Đăng xuất thành công", null));
    }

    @GetMapping("/me")
    @Operation(summary = "Lấy thông tin tài khoản hiện tại")
    public ResponseEntity<ApiResponse<UserSummaryDto>> getCurrentUser(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        UserSummaryDto user = authService.getCurrentUserProfile(userDetails.getId());
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PutMapping("/me")
    @Operation(summary = "Cập nhật thông tin tài khoản hiện tại")
    public ResponseEntity<ApiResponse<UserSummaryDto>> updateProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody com.englishlearning.auth.dto.UpdateProfileRequest request) {
        UserSummaryDto user = authService.updateProfile(userDetails.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PostMapping(value = "/me/avatar", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải lên ảnh đại diện cho tài khoản hiện tại")
    public ResponseEntity<ApiResponse<UserSummaryDto>> uploadAvatar(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        UserSummaryDto user = authService.updateAvatar(userDetails.getId(), file);
        return ResponseEntity.ok(ApiResponse.success(user));
    }


    // Helper cài đặt cookie HttpOnly an toàn
    private void setRefreshTokenCookie(HttpServletResponse response, String token, long maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from("refreshToken", token)
                .httpOnly(true)
                .secure(false) // Đổi thành true khi chạy HTTPS Production
                .path("/api/v1/auth")
                .maxAge(maxAgeSeconds)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void deleteRefreshTokenCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/api/v1/auth")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}