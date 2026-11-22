package com.englishlearning.auth.service.impl;

import com.englishlearning.auth.entity.RefreshToken;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.RefreshTokenRepository;
import com.englishlearning.auth.service.RefreshTokenService;
import com.englishlearning.common.exception.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenServiceImpl implements RefreshTokenService {

    @Value("${app.secrets.jwt.refresh-token-expiration-ms:${jwt.refresh-token-expiration-ms:604800000}}")
    private long refreshTokenDurationMs = 604800000L;

    private final RefreshTokenRepository refreshTokenRepository;

    @Override
    @Transactional
    public RefreshToken createRefreshToken(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User không được để trống");
        }
        // Thu hồi toàn bộ refresh token cũ của user để chỉ cho phép 1 session chủ động (hoặc luân phiên)
        refreshTokenRepository.deleteByUser(user);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString())
                .expiryDate(Instant.now().plusMillis(refreshTokenDurationMs))
                .revoked(false)
                .build();

        return refreshTokenRepository.save(refreshToken);
    }

    @Override
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public RefreshToken verifyExpiration(String tokenString) {
        if (tokenString == null || tokenString.isBlank()) {
            throw new UnauthorizedException("Refresh token không tồn tại trong hệ thống");
        }

        RefreshToken token = refreshTokenRepository.findByToken(tokenString)
                .orElseThrow(() -> new UnauthorizedException("Refresh token không tồn tại trong hệ thống"));

        if (token.isRevoked()) {
            throw new UnauthorizedException("Refresh token đã bị thu hồi");
        }

        if (token.getExpiryDate() == null || !token.getExpiryDate().isAfter(Instant.now())) {
            refreshTokenRepository.delete(token);
            throw new UnauthorizedException("Refresh token đã hết hạn. Vui lòng đăng nhập lại");
        }

        return token;
    }

    @Override
    @Transactional
    public void revokeToken(String tokenString) {
        if (tokenString == null || tokenString.isBlank()) {
            return;
        }
        refreshTokenRepository.findByToken(tokenString).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
    }

    /**
     * Dọn dẹp định kỳ vào lúc 02:00:00 sáng mỗi ngày các refresh token đã hết hạn hoặc bị thu hồi
     * Giữ bảng refresh_tokens gọn gàng, tăng tốc độ truy vấn kiểm tra token
     */
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void cleanupExpiredTokens() {
        try {
            refreshTokenRepository.deleteExpiredOrRevoked(Instant.now());
            log.info("[TOKEN-CLEANUP] Dọn dẹp định kỳ các refresh token đã hết hạn hoặc thu hồi hoàn tất.");
        } catch (Exception e) {
            log.error("[TOKEN-CLEANUP] Lỗi dọn dẹp refresh token định kỳ: {}", e.getMessage(), e);
        }
    }
}
