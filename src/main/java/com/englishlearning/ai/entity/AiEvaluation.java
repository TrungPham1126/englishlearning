package com.englishlearning.ai.entity;

import com.englishlearning.submission.entity.StudentAnswer;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_evaluations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_answer_id", nullable = false, unique = true)
    private StudentAnswer studentAnswer;

    @Enumerated(EnumType.STRING)
    @Column(name = "eval_type", nullable = false, length = 30)
    private AiEvaluationType evalType;

    @Column(name = "overall_score")
    private Double overallScore;

    @Column(name = "pronunciation_score")
    private Double pronunciationScore;

    @Column(name = "fluency_score")
    private Double fluencyScore;

    @Column(name = "grammar_score")
    private Double grammarScore;

    @Column(name = "vocabulary_score")
    private Double vocabularyScore;

    @Column(name = "coherence_score")
    private Double coherenceScore;

    @Column(name = "estimated_cefr", length = 10)
    private String estimatedCefr;

    @Column(name = "stt_transcript", columnDefinition = "TEXT")
    private String sttTranscript;

    @Column(name = "corrected_text", columnDefinition = "TEXT")
    private String correctedText;

    @Column(name = "mistakes_json", columnDefinition = "TEXT")
    private String mistakesJson;

    @Column(name = "suggestions_json", columnDefinition = "TEXT")
    private String suggestionsJson;

    @Column(name = "tokens_used")
    private Integer tokensUsed;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}