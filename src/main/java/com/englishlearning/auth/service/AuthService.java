package com.englishlearning.auth.service;

import com.englishlearning.auth.dto.AuthResponse;
import com.englishlearning.auth.dto.LoginRequest;
import com.englishlearning.auth.dto.RegistrationRequest;
import com.englishlearning.auth.dto.UpdateProfileRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface AuthService {

    record AuthResult(AuthResponse response, String rawRefreshToken) {
    }

    UserSummaryDto register(RegistrationRequest request);

    AuthResult login(LoginRequest request);

    AuthResult refreshToken(String oldTokenString);

    void logout(String refreshTokenString);

    UserSummaryDto getCurrentUserProfile(UUID userId);

    UserSummaryDto updateProfile(UUID userId, UpdateProfileRequest request);

    UserSummaryDto updateAvatar(UUID userId, MultipartFile file);
}
