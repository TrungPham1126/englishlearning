// src/main/java/com/englishlearning/ai/entity/StudentAiQuota.java
package com.englishlearning.ai.entity;

import com.englishlearning.auth.entity.Student;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "student_ai_quotas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAiQuota {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", columnDefinition = "VARCHAR(36)", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false, unique = true)
    private Student student;

    @Column(name = "daily_limit", nullable = false)
    @Builder.Default
    private Integer dailyLimit = 20; // Mặc định cho phép dùng AI 20 lần/ngày

    @Column(name = "used_today", nullable = false)
    @Builder.Default
    private Integer usedToday = 0;

    @Column(name = "last_reset_date", nullable = false)
    @Builder.Default
    private LocalDate lastResetDate = LocalDate.now();

    @Column(name = "is_blocked", nullable = false)
    @Builder.Default
    private Boolean isBlocked = false;
}