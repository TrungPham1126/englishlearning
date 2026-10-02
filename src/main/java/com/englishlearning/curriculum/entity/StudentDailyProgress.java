package com.englishlearning.curriculum.entity;

import com.englishlearning.auth.entity.Student;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "student_daily_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentDailyProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_plan_id", nullable = false)
    private DailyStudyPlan dailyPlan;

    @Builder.Default
    private Boolean isCompleted = false; // Hoàn thành tất cả các mục của ngày

    private Integer completedItemsCount;
    private Integer totalItemsCount;
    private Instant completedAt;
}