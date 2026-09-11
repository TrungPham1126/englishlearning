package com.englishlearning.auth.service;

import com.englishlearning.auth.entity.RefreshToken;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.RefreshTokenRepository;
import com.englishlearning.common.exception.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    @Value("${jwt.refresh-token-expiration-ms:604800000}")
    private long refreshTokenDurationMs;

    private final RefreshTokenRepository refreshTokenRepository;

    @Transactional
    public RefreshToken createRefreshToken(User user) {
        // Thu hồi toàn bộ refresh token cũ của user để chỉ cho phép 1 session chủ động
        // (hoặc luân phiên)
        refreshTokenRepository.deleteByUser(user);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString())
                .expiryDate(Instant.now().plusMillis(refreshTokenDurationMs))
                .revoked(false)
                .build();

        return refreshTokenRepository.save(refreshToken);
    }

    @Transactional(readOnly = true)
    public RefreshToken verifyExpiration(String tokenString) {
        RefreshToken token = refreshTokenRepository.findByToken(tokenString)
                .orElseThrow(() -> new UnauthorizedException("Refresh token không tồn tại trong hệ thống"));

        if (token.isRevoked()) {
            throw new UnauthorizedException("Refresh token đã bị thu hồi");
        }

        if (token.getExpiryDate().isBefore(Instant.now())) {
            refreshTokenRepository.delete(token);
            throw new UnauthorizedException("Refresh token đã hết hạn. Vui lòng đăng nhập lại");
        }

        return token;
    }

    @Transactional
    public void revokeToken(String tokenString) {
        refreshTokenRepository.findByToken(tokenString).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
    }
}