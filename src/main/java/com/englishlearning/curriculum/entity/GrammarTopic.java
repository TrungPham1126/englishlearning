package com.englishlearning.curriculum.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "grammar_topics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GrammarTopic {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    private Lesson lesson;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(name = "rule_summary", columnDefinition = "TEXT", nullable = false)
    private String ruleSummary;

    @Column(columnDefinition = "TEXT")
    private String formula;

    @Column(columnDefinition = "TEXT")
    private String examples;
}