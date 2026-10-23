package com.englishlearning.notification.repository;

import com.englishlearning.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    Page<Notification> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);
    Page<Notification> findByClassroomIdOrderByCreatedAtDesc(UUID classroomId, Pageable pageable);
    Page<Notification> findByClassroomIdIsNullOrderByCreatedAtDesc(Pageable pageable);
    Page<Notification> findByRecipientIsNullAndClassroomIdIsNullOrderByCreatedAtDesc(Pageable pageable);

    @Query("""
        SELECT n FROM Notification n
        WHERE n.recipient.id = :userId
           OR (n.recipient IS NULL AND n.classroomId IS NULL)
           OR (n.recipient IS NULL AND n.classroomId IN (
               SELECT cs.classroom.id FROM ClassStudent cs WHERE cs.student.id = :userId OR cs.student.user.id = :userId
           ))
        ORDER BY n.createdAt DESC
    """)
    Page<Notification> findAllVisibleForUser(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT n FROM Notification n WHERE n.recipient.id = :userId OR (n.recipient IS NULL AND n.classroomId IS NULL AND NOT EXISTS (SELECT 1 FROM Notification sub WHERE sub.recipient.id = :userId AND sub.title = n.title AND sub.message = n.message)) ORDER BY n.createdAt DESC")
    Page<Notification> findAllForUser(@Param("userId") UUID userId, Pageable pageable);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.recipient.id = :userId")
    void markAllAsReadByUserId(@Param("userId") UUID userId);
}