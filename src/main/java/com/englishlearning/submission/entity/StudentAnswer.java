package com.englishlearning.submission.entity;

import com.englishlearning.assignment.entity.AssignmentQuestion;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "student_answers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false)
    private AssignmentAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private AssignmentQuestion question;

    @Column(name = "text_response", columnDefinition = "TEXT")
    private String textResponse;

    @Column(name = "audio_response_url", length = 1000)
    private String audioResponseUrl;

    @Column(name = "is_correct")
    private Boolean isCorrect;

    @Column(name = "earned_points")
    private Double earnedPoints;

    @Column(name = "eval_feedback", columnDefinition = "TEXT")
    private String evalFeedback;
}