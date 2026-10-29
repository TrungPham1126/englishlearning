package com.englishlearning.auth.service;

import com.englishlearning.auth.dto.UserCreateByAdminRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.dto.UserUpdateRequest;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.common.dto.PageResponse;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface AdminUserService {

    PageResponse<UserSummaryDto> getAllUsers(RoleName role, String keyword, Pageable pageable);

    PageResponse<UserSummaryDto> getAllUsers(Pageable pageable);

    UserSummaryDto getUserById(UUID userId);

    UserSummaryDto createUser(UserCreateByAdminRequest request);

    UserSummaryDto updateUser(UUID userId, UserUpdateRequest request);

    void toggleUserStatus(UUID userId, boolean isActive);

    void deleteUser(UUID userId);
}
