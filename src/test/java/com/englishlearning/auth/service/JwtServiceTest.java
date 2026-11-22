package com.englishlearning.auth.service;

import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.impl.JwtServiceImpl;
import com.englishlearning.common.config.AppProperties;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit Test cho JwtService:
 * Kiểm tra tạo token, trích xuất claims, kiểm tra hạn dùng từng mili-giây, token lỗi định dạng và chữ ký mật mã.
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
        @SuppressWarnings("unchecked")
        List<String> extractedRoles = jwtService.extractClaim(token, claims -> claims.get("roles", List.class));

        // Then
        assertThat(extractedUserId).isEqualTo(userId.toString());
        assertThat(extractedRoles).containsExactly("ROLE_TEACHER");
    }

    @Test
    @DisplayName("generateAccessToken: UserDetails chuẩn không phải CustomUserDetails vẫn sinh token hợp lệ không chứa userId")
    void generateAccessToken_whenStandardUserDetails_omitsUserIdClaim() {
        // Given
        UserDetails standardUser = new org.springframework.security.core.userdetails.User(
                "standard@elp.edu.vn",
                "secret",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );

        // When
        String token = jwtService.generateAccessToken(standardUser);
        String userIdClaim = jwtService.extractClaim(token, claims -> claims.get("userId", String.class));

        // Then
        assertThat(jwtService.extractUsername(token)).isEqualTo("standard@elp.edu.vn");
        assertThat(userIdClaim).isNull();
        assertThat(jwtService.isTokenValid(token, standardUser)).isTrue();
    }

    @Test
    @DisplayName("generateAccessToken: CustomUserDetails có id null không gây NullPointerException")
    void generateAccessToken_whenCustomUserDetailsHasNullId_omitsUserIdSafely() {
        // Given
        User transientUser = User.builder()
                .id(null)
                .email("transient@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails details = new CustomUserDetails(transientUser);

        // When
        String token = jwtService.generateAccessToken(details);
        String userIdClaim = jwtService.extractClaim(token, claims -> claims.get("userId", String.class));

        // Then
        assertThat(jwtService.extractUsername(token)).isEqualTo("transient@elp.edu.vn");
        assertThat(userIdClaim).isNull();
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
    @DisplayName("isTokenValid: Token hết hạn đúng 1 mili-giây (-1ms) phải ném ExpiredJwtException")
    void isTokenValid_whenExpiredByOneMillisecond_throwsExpiredJwtException() {
        // Given
        appProperties.getJwt().setAccessTokenExpirationMs(-1L);
        JwtService edgeExpiredService = new JwtServiceImpl(appProperties);

        User user = User.builder()
                .id(UUID.randomUUID())
                .email("millisecond@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build();
        CustomUserDetails details = new CustomUserDetails(user);
        String expiredByOneMsToken = edgeExpiredService.generateAccessToken(details);

        // When / Then
        assertThatThrownBy(() -> jwtService.isTokenValid(expiredByOneMsToken, details))
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
        String tamperedToken = validToken.substring(0, validToken.length() - 4) + "XXXX";

        // When / Then
        assertThatThrownBy(() -> jwtService.extractUsername(tamperedToken))
                .isInstanceOf(SignatureException.class);
    }

    @Test
    @DisplayName("extractUsername: Token rác sai cấu trúc JWT phải ném MalformedJwtException")
    void extractUsername_whenTokenIsMalformed_throwsMalformedJwtException() {
        // When / Then
        assertThatThrownBy(() -> jwtService.extractUsername("not-a-valid-jwt-string"))
                .isInstanceOf(MalformedJwtException.class);
    }

    @Test
    @DisplayName("extractUsername: Token ký bằng secret khác phải ném SignatureException")
    void extractUsername_signedWithDifferentSecret_throwsSignatureException() {
        // Given
        String otherSecret = Base64.getEncoder().encodeToString(
                "another-super-secret-signing-key-for-testing-123456".getBytes(StandardCharsets.UTF_8));
        AppProperties otherProps = new AppProperties();
        otherProps.getJwt().setSecret(otherSecret);
        otherProps.getJwt().setAccessTokenExpirationMs(60000L);
        JwtService otherJwtService = new JwtServiceImpl(otherProps);

        User user = User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build();
        String foreignToken = otherJwtService.generateAccessToken(new CustomUserDetails(user));

        // When / Then
        assertThatThrownBy(() -> jwtService.extractUsername(foreignToken))
                .isInstanceOf(SignatureException.class);
    }

    @Test
    @DisplayName("extractUsername: Token null hoặc rỗng ném IllegalArgumentException")
    void extractUsername_nullOrBlankToken_throwsIllegalArgumentException() {
        // When / Then
        assertThatThrownBy(() -> jwtService.extractUsername(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> jwtService.extractUsername("   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("isTokenValid: Token null hoặc rỗng trả về false an toàn")
    void isTokenValid_nullOrBlankToken_returnsFalse() {
        // Given
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build();
        UserDetails details = new CustomUserDetails(user);

        // When & Then
        assertThat(jwtService.isTokenValid(null, details)).isFalse();
        assertThat(jwtService.isTokenValid("   ", details)).isFalse();
    }

    @Test
    @DisplayName("isTokenValid: UserDetails null trả về false an toàn")
    void isTokenValid_nullUserDetails_returnsFalse() {
        // Given
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build();
        String validToken = jwtService.generateAccessToken(new CustomUserDetails(user));

        // When & Then
        assertThat(jwtService.isTokenValid(validToken, null)).isFalse();
    }

    @Test
    @DisplayName("isTokenValid: Token hợp lệ nhưng thiếu claim subject trả về false")
    void isTokenValid_tokenWithoutSubjectClaim_returnsFalse() {
        // Given
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(TEST_SECRET_BASE64));
        String subjectlessToken = Jwts.builder()
                .expiration(new Date(System.currentTimeMillis() + 60000L))
                .signWith(key)
                .compact();
        UserDetails details = new CustomUserDetails(User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build());

        // When & Then
        assertThat(jwtService.isTokenValid(subjectlessToken, details)).isFalse();
    }

    @Test
    @DisplayName("isTokenValid: Token hợp lệ nhưng thiếu claim expiration trả về false")
    void isTokenValid_tokenWithoutExpirationClaim_returnsFalse() {
        // Given
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(TEST_SECRET_BASE64));
        String expLessToken = Jwts.builder()
                .subject("student@elp.edu.vn")
                .signWith(key)
                .compact();
        UserDetails details = new CustomUserDetails(User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build());

        // When & Then
        assertThat(jwtService.isTokenValid(expLessToken, details)).isFalse();
    }

    @Test
    @DisplayName("isTokenValid: Token rác sai cấu trúc ném MalformedJwtException")
    void isTokenValid_malformedToken_throwsMalformedJwtException() {
        // Given
        UserDetails details = new CustomUserDetails(User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build());

        // When / Then
        assertThatThrownBy(() -> jwtService.isTokenValid("malformed.jwt", details))
                .isInstanceOf(MalformedJwtException.class);
    }

    @Test
    @DisplayName("isTokenValid: Token bị giả mạo chữ ký ném SignatureException")
    void isTokenValid_tamperedSignature_throwsSignatureException() {
        // Given
        UserDetails details = new CustomUserDetails(User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build());
        String validToken = jwtService.generateAccessToken(details);
        String tamperedToken = validToken.substring(0, validToken.length() - 4) + "YYYY";

        // When / Then
        assertThatThrownBy(() -> jwtService.isTokenValid(tamperedToken, details))
                .isInstanceOf(SignatureException.class);
    }

    @Test
    @DisplayName("generateAccessToken: UserDetails null ném IllegalArgumentException")
    void generateAccessToken_nullUserDetails_throwsIllegalArgumentException() {
        // When / Then
        assertThatThrownBy(() -> jwtService.generateAccessToken(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("generateAccessToken: User có nhiều role phải đưa đầy đủ roles vào claim")
    void generateAccessToken_multipleRoles_includesAllRolesInClaim() {
        // Given
        User multiRoleUser = User.builder()
                .id(UUID.randomUUID())
                .email("admin-teacher@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(
                        Role.builder().name(RoleName.ROLE_ADMIN).build(),
                        Role.builder().name(RoleName.ROLE_TEACHER).build()
                ))
                .build();
        CustomUserDetails details = new CustomUserDetails(multiRoleUser);

        // When
        String token = jwtService.generateAccessToken(details);
        @SuppressWarnings("unchecked")
        List<String> extractedRoles = jwtService.extractClaim(token, claims -> claims.get("roles", List.class));

        // Then
        assertThat(extractedRoles).containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_TEACHER");
    }
}
