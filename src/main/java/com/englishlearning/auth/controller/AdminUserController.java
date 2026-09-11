package com.englishlearning.auth.controller;

import com.englishlearning.auth.dto.UserCreateByAdminRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.dto.UserUpdateRequest;
import com.englishlearning.auth.service.AdminUserService;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.common.dto.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@Tag(name = "Admin User Management", description = "Các API CRUD quản lý người dùng dành riêng cho ADMIN")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    @Operation(summary = "Lấy danh sách người dùng phân trang")
    public ResponseEntity<ApiResponse<PageResponse<UserSummaryDto>>> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        Sort sort = direction.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        return ResponseEntity.ok(ApiResponse.success(adminUserService.getAllUsers(pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Xem chi tiết một người dùng")
    public ResponseEntity<ApiResponse<UserSummaryDto>> getUserById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(adminUserService.getUserById(id)));
    }

    @PostMapping
    @Operation(summary = "Admin tạo tài khoản người dùng mới")
    public ResponseEntity<ApiResponse<UserSummaryDto>> createUser(
            @Valid @RequestBody UserCreateByAdminRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo tài khoản thành công", adminUserService.createUser(request)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật thông tin và phân quyền người dùng")
    public ResponseEntity<ApiResponse<UserSummaryDto>> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thành công", adminUserService.updateUser(id, request)));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Khóa hoặc kích hoạt tài khoản")
    public ResponseEntity<ApiResponse<Void>> toggleStatus(
            @PathVariable UUID id,
            @RequestParam boolean active) {
        adminUserService.toggleUserStatus(id, active);
        return ResponseEntity.ok(ApiResponse.success(active ? "Đã kích hoạt tài khoản" : "Đã khóa tài khoản", null));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa người dùng khỏi hệ thống")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable UUID id) {
        adminUserService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa tài khoản thành công", null));
    }
}