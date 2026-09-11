package com.englishlearning.analytics.entity;

import com.englishlearning.auth.entity.Student;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "student_skill_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentSkillProfile {

    @Id
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "id")
    private Student student;

    @Column(name = "listening_score")
    @Builder.Default
    private Double listeningScore = 0.0;

    @Column(name = "speaking_score")
    @Builder.Default
    private Double speakingScore = 0.0;

    @Column(name = "reading_score")
    @Builder.Default
    private Double readingScore = 0.0;

    @Column(name = "writing_score")
    @Builder.Default
    private Double writingScore = 0.0;

    @Column(name = "grammar_score")
    @Builder.Default
    private Double grammarScore = 0.0;

    @Column(name = "vocabulary_score")
    @Builder.Default
    private Double vocabularyScore = 0.0;

    @Column(name = "ai_recommended_path", columnDefinition = "TEXT")
    private String aiRecommendedPath;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}