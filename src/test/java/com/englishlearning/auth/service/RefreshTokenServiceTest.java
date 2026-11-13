package com.englishlearning.auth.service;

import com.englishlearning.auth.entity.RefreshToken;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.RefreshTokenRepository;
import com.englishlearning.auth.service.impl.RefreshTokenServiceImpl;
import com.englishlearning.common.exception.UnauthorizedException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit Test cho RefreshTokenService:
 * Kiểm tra tạo token, thu hồi token cũ, tái sử dụng token sau xóa, xác thực hạn sống và xóa token rác.
 */
@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    private RefreshTokenServiceImpl refreshTokenService;

    @Test
    @DisplayName("should_CreateRefreshTokenAndRevokeOldTokens_when_UserProvided: Xóa token cũ và tạo mới Refresh Token còn hạn")
    void should_CreateRefreshTokenAndRevokeOldTokens_when_UserProvided() {
        // Given
        ReflectionTestUtils.setField(refreshTokenService, "refreshTokenDurationMs", 604800000L);
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("learner@elp.edu.vn")
                .build();

        when(refreshTokenRepository.save(any(RefreshToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // When
        RefreshToken created = refreshTokenService.createRefreshToken(user);

        // Then
        assertThat(created).isNotNull();
        assertThat(created.getToken()).isNotBlank().contains("-");
        assertThat(created.getUser()).isEqualTo(user);
        assertThat(created.isRevoked()).isFalse();
        assertThat(created.getExpiryDate()).isAfter(Instant.now());

        verify(refreshTokenRepository).deleteByUser(user);
        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        assertThat(captor.getValue().getToken()).isEqualTo(created.getToken());
    }

    @Test
    @DisplayName("should_ReturnValidToken_when_TokenExistsAndNotExpired: Trả về đối tượng token khi hợp lệ")
    void should_ReturnValidToken_when_TokenExistsAndNotExpired() {
        // Given
        String tokenStr = "valid-active-refresh-token";
        RefreshToken token = RefreshToken.builder()
                .token(tokenStr)
                .expiryDate(Instant.now().plusSeconds(3600))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByToken(tokenStr)).thenReturn(Optional.of(token));

        // When
        RefreshToken result = refreshTokenService.verifyExpiration(tokenStr);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getToken()).isEqualTo(tokenStr);
        verify(refreshTokenRepository, never()).delete(any());
    }

    @Test
    @DisplayName("should_ThrowUnauthorizedException_when_TokenNotFound: Báo lỗi khi token không có trong DB hoặc đã bị xóa sau rotate")
    void should_ThrowUnauthorizedException_when_TokenNotFound() {
        // Given: Mô phỏng token cũ bị dùng lại sau khi createRefreshToken đã deleteByUser
        when(refreshTokenRepository.findByToken("deleted-or-unknown-token")).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> refreshTokenService.verifyExpiration("deleted-or-unknown-token"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token không tồn tại trong hệ thống");
    }

    @Test
    @DisplayName("should_ThrowUnauthorizedException_when_TokenRevoked: Chặn sử dụng khi token đã bị thu hồi (Blacklisted)")
    void should_ThrowUnauthorizedException_when_TokenRevoked() {
        // Given
        String tokenStr = "revoked-token";
        RefreshToken token = RefreshToken.builder()
                .token(tokenStr)
                .expiryDate(Instant.now().plusSeconds(3600))
                .revoked(true)
                .build();

        when(refreshTokenRepository.findByToken(tokenStr)).thenReturn(Optional.of(token));

        // When / Then
        assertThatThrownBy(() -> refreshTokenService.verifyExpiration(tokenStr))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token đã bị thu hồi");

        verify(refreshTokenRepository, never()).delete(any());
    }

    @Test
    @DisplayName("should_DeleteTokenAndThrowUnauthorizedException_when_TokenExpired: Tự động xóa khỏi DB và báo lỗi khi quá hạn")
    void should_DeleteTokenAndThrowUnauthorizedException_when_TokenExpired() {
        // Given
        String tokenStr = "expired-token";
        RefreshToken token = RefreshToken.builder()
                .token(tokenStr)
                .expiryDate(Instant.now().minusSeconds(100))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByToken(tokenStr)).thenReturn(Optional.of(token));

        // When / Then
        assertThatThrownBy(() -> refreshTokenService.verifyExpiration(tokenStr))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token đã hết hạn. Vui lòng đăng nhập lại");

        verify(refreshTokenRepository).delete(token);
    }

    @Test
    @DisplayName("verifyExpiration: Token vừa hết hạn trước hiện tại 1 mili-giây vẫn bị xóa và từ chối")
    void verifyExpiration_whenExpiredByOneMillisecond_deletesAndThrowsUnauthorized() {
        // Given
        String tokenStr = "just-expired-ms-token";
        RefreshToken token = RefreshToken.builder()
                .token(tokenStr)
                .expiryDate(Instant.now().minusMillis(1))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByToken(tokenStr)).thenReturn(Optional.of(token));

        // When / Then
        assertThatThrownBy(() -> refreshTokenService.verifyExpiration(tokenStr))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token đã hết hạn. Vui lòng đăng nhập lại");

        verify(refreshTokenRepository).delete(token);
    }

    @Test
    @DisplayName("should_RevokeToken_when_RevokeTokenCalled: Đổi trạng thái revoked = true khi đăng xuất")
    void should_RevokeToken_when_RevokeTokenCalled() {
        // Given
        String tokenStr = "token-to-revoke";
        RefreshToken token = RefreshToken.builder()
                .token(tokenStr)
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByToken(tokenStr)).thenReturn(Optional.of(token));

        // When
        refreshTokenService.revokeToken(tokenStr);

        // Then
        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        assertThat(captor.getValue().isRevoked()).isTrue();
    }

    @Test
    @DisplayName("revokeToken: Không lỗi và không gọi save khi token không tồn tại")
    void revokeToken_whenTokenDoesNotExist_doesNothing() {
        // Given
        when(refreshTokenRepository.findByToken("missing-token")).thenReturn(Optional.empty());

        // When
        refreshTokenService.revokeToken("missing-token");

        // Then
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    @DisplayName("cleanupExpiredTokens: Gọi deleteExpiredOrRevoked với thời điểm hiện tại")
    void cleanupExpiredTokens_whenInvoked_deletesExpiredOrRevokedTokens() {
        // When
        refreshTokenService.cleanupExpiredTokens();

        // Then
        verify(refreshTokenRepository).deleteExpiredOrRevoked(any(Instant.class));
    }

    @Test
    @DisplayName("cleanupExpiredTokens: Bắt ngoại lệ DB để không làm sập scheduler")
    void cleanupExpiredTokens_whenRepositoryThrowsException_doesNotPropagate() {
        // Given
        doThrow(new RuntimeException("DB lock timeout"))
                .when(refreshTokenRepository).deleteExpiredOrRevoked(any(Instant.class));

        // When & Then
        assertThatCode(() -> refreshTokenService.cleanupExpiredTokens())
                .doesNotThrowAnyException();
    }
}
