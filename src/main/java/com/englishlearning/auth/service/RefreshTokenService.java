package com.englishlearning.auth.service;

import com.englishlearning.auth.entity.RefreshToken;
import com.englishlearning.auth.entity.User;

public interface RefreshTokenService {

    RefreshToken createRefreshToken(User user);

    RefreshToken verifyExpiration(String tokenString);

    void revokeToken(String tokenString);
}
