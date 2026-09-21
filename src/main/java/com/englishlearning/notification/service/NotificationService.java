package com.englishlearning.notification.service;

import com.englishlearning.auth.entity.User;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.entity.Notification;
import com.englishlearning.notification.entity.NotificationType;
import com.englishlearning.notification.repository.NotificationRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final RabbitTemplate rabbitTemplate;
    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EntityManager entityManager;

    @Value("${app.rabbitmq.queues.notification:notification.queue}")
    private String notificationQueue;

    public void dispatchNotification(NotificationDto dto) {
        rabbitTemplate.convertAndSend(notificationQueue, dto);
    }

    // Bổ sung UUID recipientUserId để truyền người nhận
    public void sendSystemNotification(UUID recipientUserId, String title, String message, String type,
            String redirectUrl) {
        NotificationDto dto = NotificationDto.builder()
                .recipientUserId(recipientUserId)
                .title(title)
                .message(message)
                .notificationType(type)
                .redirectUrl(redirectUrl)
                .build();
        dispatchNotification(dto);
    }

    // Giữ overload cũ nếu có chỗ khác gọi không truyền userId
    public void sendSystemNotification(String title, String message, String type, String redirectUrl) {
        sendSystemNotification(null, title, message, type, redirectUrl);
    }

    @RabbitListener(queues = "${app.rabbitmq.queues.notification:notification.queue}")
    @Transactional
    public void processNotificationMessage(NotificationDto dto) {
        // Kiểm tra an toàn: Bảng notifications yêu cầu recipient_id NOT NULL
        if (dto == null || dto.getRecipientUserId() == null) {
            log.warn("Bỏ qua lưu DB thông báo vì recipientUserId bị null: title={}",
                    dto != null ? dto.getTitle() : "null");
            return;
        }

        Notification notification = Notification.builder()
                .title(dto.getTitle())
                .message(dto.getMessage())
                .type(NotificationType.valueOf(dto.getNotificationType()))
                .targetUrl(dto.getRedirectUrl())
                .isRead(false)
                .build();

        User recipient = entityManager.getReference(User.class, dto.getRecipientUserId());
        notification.setRecipient(recipient);

        Notification saved = notificationRepository.save(notification);

        // Gửi realtime qua WebSocket
        messagingTemplate.convertAndSendToUser(dto.getRecipientUserId().toString(), "/queue/notifications", saved);
    }

    public Page<Notification> getMyNotifications(UUID userId, int page, int size) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
    }
}