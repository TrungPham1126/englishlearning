package com.englishlearning.notification.service;

import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.entity.Notification;
import org.springframework.data.domain.Page;

import java.util.UUID;

public interface NotificationService {

    void dispatchNotification(NotificationDto dto);

    void sendSystemNotification(UUID recipientUserId, String title, String message, String type, String redirectUrl);

    void sendSystemNotification(String title, String message, String type, String redirectUrl);

    void processNotificationMessage(NotificationDto dto);

    Page<Notification> getBroadcastHistory(UUID adminId, int page, int size);

    Page<Notification> getBroadcastHistory(int page, int size);

    Page<Notification> getMyNotifications(UUID userId, int page, int size);

    Page<Notification> getClassroomAnnouncements(UUID classroomId, int page, int size);

    void markAsRead(UUID notificationId, UUID userId);

    void markAllAsRead(UUID userId);
}
