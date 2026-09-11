package com.englishlearning.assignment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "assignment_questions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssignmentQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_id", nullable = false)
    private Assignment assignment;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false, length = 30)
    private QuestionType questionType;

    @Column(name = "prompt_text", columnDefinition = "TEXT", nullable = false)
    private String promptText;

    @Column(name = "media_url", length = 1000)
    private String mediaUrl;

    @Column(columnDefinition = "TEXT")
    private String transcript;

    @Column(name = "correct_answer", columnDefinition = "TEXT")
    private String correctAnswer;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(nullable = false)
    @Builder.Default
    private Double points = 1.0;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<QuestionOption> options = new ArrayList<>();
}