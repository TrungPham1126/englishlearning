package com.englishlearning.curriculum.entity;

import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.video.entity.Video;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "lessons")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Lesson {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id", nullable = false)
    private Classroom classroom;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(columnDefinition = "TEXT")
    private String objectives;

    @Column(columnDefinition = "TEXT")
    private String content;

    @OneToOne(mappedBy = "lesson", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Video video;

    @OneToMany(mappedBy = "lesson", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<LessonDocument> documents = new HashSet<>();

    @OneToMany(mappedBy = "lesson", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<VocabularyItem> vocabularies = new HashSet<>();

    @OneToMany(mappedBy = "lesson", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<GrammarTopic> grammarTopics = new HashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}