package com.englishlearning.notification.service.impl;

import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.notification.dto.NotificationClassroomDto;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.dto.NotificationRecipientDto;
import com.englishlearning.notification.entity.Notification;
import com.englishlearning.notification.entity.NotificationType;
import com.englishlearning.notification.repository.NotificationRepository;
import com.englishlearning.notification.service.NotificationService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationServiceImpl implements NotificationService {

    private final RabbitTemplate rabbitTemplate;
    private final NotificationRepository notificationRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassroomRepository classroomRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EntityManager entityManager;

    @Value("${app.rabbitmq.queues.notification:notification.queue}")
    private String notificationQueue;

    @Override
    @Transactional
    public void dispatchNotification(NotificationDto dto) {
        // LUÔN LUÔN lưu trực tiếp vào MySQL ngay lập tức để đảm bảo 100% không mất thông báo
        processNotificationMessage(dto);
    }

    @Override
    public void sendSystemNotification(UUID recipientUserId, String title, String message, String type,
            String redirectUrl) {
        sendSystemNotification(recipientUserId, title, message, type, null, redirectUrl, null);
    }

    @Override
    public void sendSystemNotification(String title, String message, String type, String redirectUrl) {
        sendSystemNotification(null, title, message, type, null, redirectUrl, null);
    }

    @Override
    public void sendSystemNotification(UUID recipientUserId, String title, String message, String type,
            String actionType, String targetUrl, Object referenceId) {
        NotificationDto dto = NotificationDto.builder()
                .recipientUserId(recipientUserId)
                .title(title)
                .message(message)
                .content(message)
                .notificationType(type)
                .actionType(actionType)
                .redirectUrl(targetUrl)
                .targetUrl(targetUrl)
                .referenceId(referenceId != null ? referenceId.toString() : null)
                .build();
        dispatchNotification(dto);
    }

    @Override
    public void sendSystemNotification(String title, String message, String type,
            String actionType, String targetUrl, Object referenceId) {
        sendSystemNotification(null, title, message, type, actionType, targetUrl, referenceId);
    }

    private NotificationType resolveNotificationType(String typeStr, UUID classroomId) {
        if (typeStr == null || typeStr.isBlank()) {
            return classroomId != null ? NotificationType.ANNOUNCEMENT : NotificationType.SYSTEM_ALERT;
        }
        String clean = typeStr.trim().toUpperCase();
        for (NotificationType nt : NotificationType.values()) {
            if (nt.name().equalsIgnoreCase(clean)) {
                return nt;
            }
        }
        return classroomId != null ? NotificationType.ANNOUNCEMENT : NotificationType.SYSTEM_ALERT;
    }

    @Override
    @Transactional
    public void processNotificationMessage(NotificationDto dto) {
        if (dto == null) {
            return;
        }

        NotificationType type = resolveNotificationType(dto.getNotificationType(), dto.getClassroomId());
        String targetUrl = dto.getTargetUrl() != null && !dto.getTargetUrl().isBlank()
                ? dto.getTargetUrl()
                : dto.getRedirectUrl();

        String safeTitle = (dto.getTitle() != null && !dto.getTitle().isBlank())
                ? dto.getTitle().trim()
                : "Thông báo hệ thống";

        String content = (dto.getMessage() != null && !dto.getMessage().isBlank())
                ? dto.getMessage().trim()
                : ((dto.getContent() != null && !dto.getContent().isBlank())
                        ? dto.getContent().trim()
                        : safeTitle);

        String actionType = dto.getActionType() != null && !dto.getActionType().isBlank()
                ? dto.getActionType()
                : "TEXT_ANNOUNCEMENT";
        String referenceId = dto.getReferenceId();

        // =========================================================================
        // Nhánh 1: Gửi đến TỪNG CÁ NHÂN (dto.getRecipientUserId() != null)
        // =========================================================================
        if (dto.getRecipientUserId() != null) {
            User recipient = userRepository.findById(dto.getRecipientUserId())
                    .orElseGet(() -> entityManager.getReference(User.class, dto.getRecipientUserId()));

            Notification notification = Notification.builder()
                    .title(safeTitle)
                    .message(content)
                    .type(type)
                    .targetUrl(targetUrl)
                    .actionType(actionType)
                    .referenceId(referenceId)
                    .recipient(recipient)
                    .classroomId(dto.getClassroomId())
                    .isRead(false)
                    .build();

            Notification saved = notificationRepository.save(notification);

            try {
                messagingTemplate.convertAndSendToUser(dto.getRecipientUserId().toString(), "/queue/notifications", saved);
            } catch (Exception ex) {
                log.warn("Không thể gửi WebSocket tới recipient {}: {}", dto.getRecipientUserId(), ex.getMessage());
            }
            return;
        }

        // =========================================================================
        // Nhánh 2: Gửi TOÀN LỚP HỌC (dto.getClassroomId() != null)
        // =========================================================================
        else if (dto.getClassroomId() != null) {
            List<ClassStudent> classStudents = classStudentRepository.findByClassroomId(dto.getClassroomId());
            if (classStudents != null && !classStudents.isEmpty()) {
                List<Notification> notifs = new ArrayList<>();
                for (ClassStudent cs : classStudents) {
                    if (cs.getStudent() != null && cs.getStudent().getUser() != null) {
                        User studentUser = cs.getStudent().getUser();
                        notifs.add(Notification.builder()
                                .title(safeTitle)
                                .message(content)
                                .type(type)
                                .targetUrl(targetUrl)
                                .actionType(actionType)
                                .referenceId(referenceId)
                                .recipient(studentUser)
                                .classroomId(dto.getClassroomId())
                                .isRead(false)
                                .build());
                    }
                }
                if (!notifs.isEmpty()) {
                    List<Notification> savedList = notificationRepository.saveAll(notifs);
                    for (Notification sn : savedList) {
                        if (sn.getRecipient() != null && sn.getRecipient().getId() != null) {
                            try {
                                messagingTemplate.convertAndSendToUser(
                                        sn.getRecipient().getId().toString(),
                                        "/queue/notifications",
                                        sn
                                );
                            } catch (Exception ex) {
                                log.warn("Lỗi gửi WebSocket tới user: {}", ex.getMessage());
                            }
                        }
                    }
                }
            }
            try {
                messagingTemplate.convertAndSend("/topic/classroom." + dto.getClassroomId(), dto);
            } catch (Exception ex) {
                log.warn("Lỗi gửi WebSocket broadcast tới topic classroom.{}: {}", dto.getClassroomId(), ex.getMessage());
            }
            return;
        }

        // =========================================================================
        // Nhánh 3: Gửi TOÀN ROLE hoặc TOÀN HỆ THỐNG
        // =========================================================================
        else {
            List<User> allUsers = userRepository.findAll();
            if (allUsers == null || allUsers.isEmpty()) {
                log.warn("Không tìm thấy user nào trong hệ thống để phát thông báo.");
                return;
            }

            RoleName targetRole = null;
            if (dto.getTargetAudience() != null && !dto.getTargetAudience().isBlank()) {
                String aud = dto.getTargetAudience().trim().toUpperCase();
                if (aud.equals("ROLE_STUDENT") || aud.equals("STUDENT")) {
                    targetRole = RoleName.ROLE_STUDENT;
                } else if (aud.equals("ROLE_TEACHER") || aud.equals("TEACHER")) {
                    targetRole = RoleName.ROLE_TEACHER;
                } else if (aud.equals("ROLE_ADMIN") || aud.equals("ADMIN")) {
                    targetRole = RoleName.ROLE_ADMIN;
                }
            }

            final RoleName roleFilter = targetRole;
            List<User> recipients = new ArrayList<>(allUsers.stream()
                    .filter(u -> u.getIsActive() == null || Boolean.TRUE.equals(u.getIsActive()))
                    .filter(u -> roleFilter == null || (u.getRoles() != null && u.getRoles().stream().anyMatch(r -> r.getName() == roleFilter)))
                    .toList());

            if (recipients.isEmpty() && roleFilter == null) {
                recipients = new ArrayList<>(allUsers);
            }

            final String msgToSave = content;
            final NotificationType finalType = type;
            final String finalTargetUrl = targetUrl;
            final String finalTitle = safeTitle;
            final String finalActionType = actionType;
            final String finalReferenceId = referenceId;

            List<Notification> userNotifs = recipients.stream()
                    .map(u -> Notification.builder()
                            .title(finalTitle)
                            .message(msgToSave)
                            .type(finalType)
                            .targetUrl(finalTargetUrl)
                            .actionType(finalActionType)
                            .referenceId(finalReferenceId)
                            .recipient(u)
                            .classroomId(null)
                            .isRead(false)
                            .build())
                    .toList();

            List<Notification> savedUserNotifs = notificationRepository.saveAll(userNotifs);

            for (Notification un : savedUserNotifs) {
                if (un.getRecipient() != null && un.getRecipient().getId() != null) {
                    try {
                        messagingTemplate.convertAndSendToUser(
                                un.getRecipient().getId().toString(),
                                "/queue/notifications",
                                un
                        );
                    } catch (Exception ex) {
                        log.warn("Không thể gửi WebSocket tới user {}: {}", un.getRecipient().getId(), ex.getMessage());
                    }
                }
            }

            try {
                messagingTemplate.convertAndSend("/topic/system-announcements", dto);
                messagingTemplate.convertAndSend("/topic/public", dto);
            } catch (Exception ex) {
                log.warn("Lỗi gửi WebSocket broadcast tới topic hệ thống: {}", ex.getMessage());
            }
        }
    }

    @Override
    public List<NotificationRecipientDto> searchRecipients(String query, String role) {
        String cleanQuery = query != null ? query.trim().toLowerCase() : "";
        RoleName targetRole = null;
        if (role != null && !role.isBlank()) {
            String r = role.trim().toUpperCase();
            if (r.contains("STUDENT")) targetRole = RoleName.ROLE_STUDENT;
            else if (r.contains("TEACHER")) targetRole = RoleName.ROLE_TEACHER;
            else if (r.contains("ADMIN")) targetRole = RoleName.ROLE_ADMIN;
        }

        final RoleName finalRole = targetRole;
        return userRepository.findAll().stream()
                .filter(u -> u.getIsActive() == null || Boolean.TRUE.equals(u.getIsActive()))
                .filter(u -> finalRole == null || (u.getRoles() != null && u.getRoles().stream().anyMatch(ro -> ro.getName() == finalRole)))
                .filter(u -> {
                    if (cleanQuery.isEmpty()) return true;
                    String fullName = ((u.getLastName() != null ? u.getLastName() : "") + " " +
                                       (u.getFirstName() != null ? u.getFirstName() : "")).toLowerCase();
                    String email = u.getEmail() != null ? u.getEmail().toLowerCase() : "";
                    return fullName.contains(cleanQuery) || email.contains(cleanQuery);
                })
                .limit(50)
                .map(u -> {
                    String fn = ((u.getLastName() != null ? u.getLastName() : "") + " " +
                                 (u.getFirstName() != null ? u.getFirstName() : "")).trim();
                    if (fn.isEmpty()) fn = u.getEmail();
                    String userRole = u.getRoles() != null && !u.getRoles().isEmpty()
                            ? u.getRoles().iterator().next().getName().name()
                            : "ROLE_STUDENT";
                    return NotificationRecipientDto.builder()
                            .id(u.getId())
                            .fullName(fn)
                            .email(u.getEmail())
                            .role(userRole)
                            .avatarUrl(u.getAvatarUrl())
                            .build();
                })
                .toList();
    }

    @Override
    public List<NotificationClassroomDto> getAvailableClassrooms(UUID currentUserId) {
        List<Classroom> classrooms;
        if (currentUserId != null) {
            User user = userRepository.findById(currentUserId).orElse(null);
            boolean isAdmin = user != null && user.getRoles() != null &&
                    user.getRoles().stream().anyMatch(r -> r.getName() == RoleName.ROLE_ADMIN);

            if (isAdmin) {
                classrooms = classroomRepository.findAll();
            } else {
                classrooms = classroomRepository.findByTeacherId(currentUserId);
                if (classrooms.isEmpty()) {
                    classrooms = classroomRepository.findAll();
                }
            }
        } else {
            classrooms = classroomRepository.findAll();
        }

        return classrooms.stream().map(c -> {
            String teacherName = "Chưa phân công";
            if (c.getTeacher() != null && c.getTeacher().getUser() != null) {
                User tu = c.getTeacher().getUser();
                teacherName = ((tu.getLastName() != null ? tu.getLastName() : "") + " " +
                               (tu.getFirstName() != null ? tu.getFirstName() : "")).trim();
            }
            int count = c.getClassStudents() != null ? c.getClassStudents().size() : 0;
            return NotificationClassroomDto.builder()
                    .id(c.getId())
                    .name(c.getName())
                    .joinCode(c.getJoinCode())
                    .teacherName(teacherName)
                    .studentCount(count)
                    .build();
        }).toList();
    }

    @Override
    public Page<Notification> getBroadcastHistory(UUID adminId, int page, int size) {
        if (adminId != null) {
            return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(adminId, PageRequest.of(page, size));
        }
        return notificationRepository.findByClassroomIdIsNullOrderByCreatedAtDesc(PageRequest.of(page, size));
    }

    @Override
    public Page<Notification> getBroadcastHistory(int page, int size) {
        return getBroadcastHistory(null, page, size);
    }

    @Override
    public Page<Notification> getMyNotifications(UUID userId, int page, int size) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
    }

    @Override
    public Page<Notification> getClassroomAnnouncements(UUID classroomId, int page, int size) {
        return notificationRepository.findByClassroomIdOrderByCreatedAtDesc(classroomId, PageRequest.of(page, size));
    }

    @Override
    @Transactional
    public void markAsRead(UUID notificationId, UUID userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thông báo"));

        if (notification.getRecipient() != null && !notification.getRecipient().getId().equals(userId)) {
            throw new RuntimeException("Không có quyền truy cập");
        }
        notification.setIsRead(true);
        notificationRepository.save(notification);
    }

    @Override
    @Transactional
    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllAsReadByUserId(userId);
    }
}
