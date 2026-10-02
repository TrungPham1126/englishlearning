package com.englishlearning.curriculum.entity;

import com.englishlearning.auth.entity.Student;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "student_vocabulary_progress", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "student_id", "vocabulary_id" })
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentVocabularyProgress {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vocabulary_id", nullable = false)
    private VocabularyItem vocabulary;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SpacedRepetitionStage stage = SpacedRepetitionStage.NEW;

    @Column(name = "next_review_at", nullable = false)
    @Builder.Default
    private Instant nextReviewAt = Instant.now();

    @Column(name = "ease_factor", nullable = false)
    @Builder.Default
    private Double easeFactor = 2.5;

    @Column(name = "interval_days", nullable = false)
    @Builder.Default
    private Integer intervalDays = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer repetitions = 0;
}