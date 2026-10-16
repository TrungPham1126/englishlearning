package com.englishlearning.assignment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "exercise_audios", indexes = {
    @Index(name = "idx_ex_audio_question", columnList = "question_id, is_active"),
    @Index(name = "idx_ex_audio_assignment", columnList = "assignment_id"),
    @Index(name = "idx_ex_audio_hash", columnList = "content_hash")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExerciseAudio {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "exercise_type", nullable = false, length = 30)
    private ExerciseAudioType exerciseType;

    @Column(name = "assignment_id", nullable = false)
    private UUID assignmentId;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(name = "content_hash", nullable = false, length = 64)
    private String contentHash;

    @Column(name = "voice_config", columnDefinition = "TEXT")
    private String voiceConfig;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private AudioGenerationStatus status = AudioGenerationStatus.PENDING;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(length = 1000)
    private String url;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(columnDefinition = "LONGTEXT")
    private String segments;

    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "generated_by", nullable = false, length = 30)
    @Builder.Default
    private AudioGeneratedBy generatedBy = AudioGeneratedBy.SYSTEM;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

