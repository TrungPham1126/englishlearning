package com.englishlearning.curriculum.entity;

import com.englishlearning.assignment.entity.Assignment;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "daily_plan_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyPlanItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_plan_id", nullable = false)
    private DailyStudyPlan dailyPlan;

    private String sectionName; // "A. LISTENING & READING (Bắt buộc)"
    private String title; // "1. TỪ VỰNG TRỌNG ĐIỂM 2"
    private String itemType; // VOCABULARY, LISTENING, READING, SHADOWING
    private Integer orderIndex;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_id")
    private Assignment assignment; // Liên kết trực tiếp tới bài thi/bài tập
}