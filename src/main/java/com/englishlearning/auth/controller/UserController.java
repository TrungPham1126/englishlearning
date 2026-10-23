package com.englishlearning.auth.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.UserService;
import com.englishlearning.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "API quản lý hồ sơ người dùng cá nhân")
public class UserController {

    private final UserService userService;

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải lên và cập nhật ảnh đại diện cá nhân (Admin, Teacher, Student)")
    public ResponseEntity<ApiResponse<String>> updateAvatar(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam("file") MultipartFile file) {
        String avatarUrl = userService.uploadAndSaveAvatar(userDetails.getId(), file);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật avatar thành công", avatarUrl));
    }
}
