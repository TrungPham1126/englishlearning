package com.englishlearning.ai.entity;

import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.curriculum.entity.Lesson;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_generated_exercises")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiGeneratedExercise {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    private Lesson lesson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private Teacher teacher;

    @Column(name = "target_cefr", length = 10, nullable = false)
    private String targetCefr;

    @Column(name = "exercise_type", length = 30, nullable = false)
    private String exerciseType;

    @Column(name = "question_count", nullable = false)
    private Integer questionCount;

    @Column(name = "raw_response_json", columnDefinition = "TEXT", nullable = false)
    private String rawResponseJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private GenerationStatus status = GenerationStatus.READY_FOR_REVIEW;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}