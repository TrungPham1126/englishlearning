package com.englishlearning.video.entity;

import com.englishlearning.auth.entity.Student;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "video_watch_histories", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "video_id", "student_id" })
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VideoWatchHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_id", nullable = false)
    private Video video;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(name = "watched_seconds", nullable = false)
    @Builder.Default
    private Integer watchedSeconds = 0;

    @Column(name = "completion_percentage", nullable = false)
    @Builder.Default
    private Float completionPercentage = 0.0f;

    @Column(name = "is_completed", nullable = false)
        @Builder.Default
    private Boolean isCompleted = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}