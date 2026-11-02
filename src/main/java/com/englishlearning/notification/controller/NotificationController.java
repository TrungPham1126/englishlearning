package com.englishlearning.notification.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.notification.dto.NotificationClassroomDto;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.dto.NotificationRecipientDto;
import com.englishlearning.notification.entity.Notification;
import com.englishlearning.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Notification>>> getNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @RequestParam(required = false) UUID classId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (classId != null) {
            return ResponseEntity.ok(ApiResponse.success(
                    notificationService.getClassroomAnnouncements(classId, page, size)));
        }
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.getMyNotifications(userDetails.getId(), page, size)));
    }

    @GetMapping("/classrooms/{classId}")
    public ResponseEntity<ApiResponse<Page<Notification>>> getClassroomAnnouncements(
            @PathVariable UUID classId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.getClassroomAnnouncements(classId, page, size)));
    }

    @GetMapping("/broadcast-history")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<Notification>>> getBroadcastHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        UUID adminId = userDetails != null ? userDetails.getId() : null;
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.getBroadcastHistory(adminId, page, size)));
    }

    @GetMapping("/recipients")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<ApiResponse<List<NotificationRecipientDto>>> searchRecipients(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String role) {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.searchRecipients(query, role)));
    }

    @GetMapping("/classrooms")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<ApiResponse<List<NotificationClassroomDto>>> getAvailableClassrooms(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        UUID currentUserId = userDetails != null ? userDetails.getId() : null;
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.getAvailableClassrooms(currentUserId)));
    }

    @PostMapping("/broadcast")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<ApiResponse<String>> broadcastNotification(@RequestBody NotificationDto dto) {
        try {
            if (dto.getActionType() == null || dto.getActionType().isBlank()) {
                dto.setActionType("TEXT_ANNOUNCEMENT");
            }
            notificationService.dispatchNotification(dto);
            return ResponseEntity.ok(ApiResponse.success("Phát thông báo thành công", null));
        } catch (Exception e) {
            log.error("Lỗi khi phát thông báo broadcast: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(ApiResponse.error(500, "Lỗi khi phát thông báo: " + e.getMessage()));
        }
    }

    @RequestMapping(value = "/{id}/read", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<ApiResponse<Void>> markAsRead(@PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        notificationService.markAsRead(id, userDetails.getId());
        return ResponseEntity.ok(ApiResponse.success("Đã đọc", null));
    }

    @RequestMapping(value = "/read-all", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<ApiResponse<Void>> markAllAsRead(@AuthenticationPrincipal CustomUserDetails userDetails) {
        notificationService.markAllAsRead(userDetails.getId());
        return ResponseEntity.ok(ApiResponse.success("Đã đọc tất cả", null));
    }
}
