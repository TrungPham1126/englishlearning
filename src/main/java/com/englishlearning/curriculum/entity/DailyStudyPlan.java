package com.englishlearning.curriculum.entity;

import com.englishlearning.classroom.entity.Classroom;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "daily_study_plans")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyStudyPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @Column(nullable = false)
    private Integer dayNumber; // Ví dụ: 20

    @Column(nullable = false)
    private LocalDate scheduledDate; // Ngày được mở khóa (VD: 2026-10-02)

    private String title; // "DAY 20"
    private Integer estimatedMinutes; // Thời lượng dự kiến (VD: 40 min)

    @Builder.Default
    private Boolean isUnlocked = false; // Tự động bật true vào 00:00

    @OneToMany(mappedBy = "dailyPlan", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @Builder.Default
    private List<DailyPlanItem> items = new ArrayList<>();
}