package com.englishlearning.curriculum.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "vocabulary_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabularyItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", columnDefinition = "VARCHAR(36)", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    private Lesson lesson;

    @Column(nullable = false, length = 100)
    private String word;

    @Column(length = 100)
    private String ipa;

    @Column(name = "part_of_speech", length = 50)
    private String partOfSpeech;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String meaning;

    @Column(name = "example_sentence", columnDefinition = "TEXT")
    private String exampleSentence;

    @Column(name = "audio_url", length = 1000)
    private String audioUrl;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(columnDefinition = "TEXT")
    private String synonyms;

    @Column(columnDefinition = "TEXT")
    private String antonyms;
}