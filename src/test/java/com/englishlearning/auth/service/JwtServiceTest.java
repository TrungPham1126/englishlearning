package com.englishlearning.auth.service;

import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.impl.JwtServiceImpl;
import com.englishlearning.common.config.AppProperties;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit Test cho JwtService (Tương đương JwtTokenProvider trong kiến trúc Spring Security)
 * Kiểm tra tạo token, trích xuất claims, kiểm tra hạn dùng và chữ ký mật mã.
 */
class JwtServiceTest {

    private static final String TEST_SECRET_BASE64 =
            "dGhpc2lzYXZlcnlzZWNyZXRrZXlmb3Jqd3R0ZXN0aW5nMTIzNDU2Nzg5MDEyMzQ1Ng==";

    private AppProperties appProperties;
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        appProperties = new AppProperties();
        appProperties.getJwt().setSecret(TEST_SECRET_BASE64);
        appProperties.getJwt().setAccessTokenExpirationMs(1800000L); // 30 phút

        jwtService = new JwtServiceImpl(appProperties);
    }

    @Test
    @DisplayName("should_GenerateAccessTokenAndContainClaims_when_CustomUserDetailsProvided: Cấp phát Access Token hợp lệ chứa claims")
    void should_GenerateAccessTokenAndContainClaims_when_CustomUserDetailsProvided() {
        // Given
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        UserDetails userDetails = new CustomUserDetails(user);

        // When
        String token = jwtService.generateAccessToken(userDetails);

        // Then
        assertThat(token).isNotBlank();
        assertThat(jwtService.extractUsername(token)).isEqualTo("student@elp.edu.vn");
        assertThat(jwtService.isTokenValid(token, userDetails)).isTrue();
        assertThat(jwtService.getExpirationTime()).isEqualTo(1800000L);
    }

    @Test
    @DisplayName("should_ExtractCustomClaimUserId_when_CustomUserDetailsUsed: Trích xuất chính xác claim userId từ token")
    void should_ExtractCustomClaimUserId_when_CustomUserDetailsUsed() {
        // Given
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .email("teacher@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        UserDetails userDetails = new CustomUserDetails(user);

        // When
        String token = jwtService.generateAccessToken(userDetails);
        String extractedUserId = jwtService.extractClaim(token, claims -> claims.get("userId", String.class));

        // Then
        assertThat(extractedUserId).isEqualTo(userId.toString());
    }

    @Test
    @DisplayName("should_ReturnFalse_when_TokenUsernameDoesNotMatchUserDetails: Báo không hợp lệ khi kiểm tra sai người dùng")
    void should_ReturnFalse_when_TokenUsernameDoesNotMatchUserDetails() {
        // Given
        User userA = User.builder()
                .id(UUID.randomUUID())
                .email("userA@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build();
        User userB = User.builder()
                .id(UUID.randomUUID())
                .email("userB@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build();

        String tokenA = jwtService.generateAccessToken(new CustomUserDetails(userA));

        // When
        boolean isValidForUserB = jwtService.isTokenValid(tokenA, new CustomUserDetails(userB));

        // Then
        assertThat(isValidForUserB).isFalse();
    }

    @Test
    @DisplayName("should_ThrowExpiredJwtException_when_TokenIsExpired: Ném ExpiredJwtException khi token quá hạn")
    void should_ThrowExpiredJwtException_when_TokenIsExpired() {
        // Given: Cấu hình thời hạn sống âm (đã hết hạn ngay khi sinh)
        appProperties.getJwt().setAccessTokenExpirationMs(-5000L);
        JwtService expiredJwtService = new JwtServiceImpl(appProperties);

        User user = User.builder()
                .id(UUID.randomUUID())
                .email("expired@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build();
        String expiredToken = expiredJwtService.generateAccessToken(new CustomUserDetails(user));

        // When / Then
        assertThatThrownBy(() -> jwtService.extractUsername(expiredToken))
                .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    @DisplayName("should_ThrowSignatureException_when_TokenSignatureIsTampered: Chặn token bị can thiệp sửa đổi trái phép")
    void should_ThrowSignatureException_when_TokenSignatureIsTampered() {
        // Given
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("valid@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build();
        String validToken = jwtService.generateAccessToken(new CustomUserDetails(user));
        // Sửa đổi ký tự cuối cùng của chữ ký
        String tamperedToken = validToken.substring(0, validToken.length() - 4) + "XXXX";

        // When / Then
        assertThatThrownBy(() -> jwtService.extractUsername(tamperedToken))
                .isInstanceOf(SignatureException.class);
    }
}
