package com.englishlearning.submission.dto;

import lombok.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GradingResult {
    private double totalScore;
    private double maxPossibleScore;
    private double scaledScore; // Thang điểm 10.0
    private Map<UUID, Double> earnedPointsPerQuestion;
    private Map<UUID, Boolean> correctnessPerQuestion;
    private boolean requiresAiGrading;
    private List<UUID> aiGradedQuestionIds;
}
