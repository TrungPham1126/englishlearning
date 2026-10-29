package com.englishlearning.submission.service.impl;

import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionOption;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.submission.dto.GradingResult;
import com.englishlearning.submission.dto.SubmissionRequest;
import com.englishlearning.submission.service.GradingEngineService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class GradingEngineServiceImpl implements GradingEngineService {

    @Override
    public GradingResult evaluateSubmission(List<AssignmentQuestion> questions, List<SubmissionRequest.AnswerDto> answers) {
        if (questions == null || questions.isEmpty()) {
            return GradingResult.builder()
                    .totalScore(0.0)
                    .maxPossibleScore(0.0)
                    .scaledScore(0.0)
                    .earnedPointsPerQuestion(Collections.emptyMap())
                    .correctnessPerQuestion(Collections.emptyMap())
                    .requiresAiGrading(false)
                    .aiGradedQuestionIds(Collections.emptyList())
                    .build();
        }

        Map<UUID, SubmissionRequest.AnswerDto> answerMap = (answers != null)
                ? answers.stream().filter(a -> a.getQuestionId() != null).collect(Collectors.toMap(SubmissionRequest.AnswerDto::getQuestionId, a -> a, (a1, a2) -> a1))
                : Collections.emptyMap();

        double totalEarned = 0.0;
        double maxPossible = 0.0;
        Map<UUID, Double> earnedMap = new HashMap<>();
        Map<UUID, Boolean> correctMap = new HashMap<>();
        List<UUID> aiQuestions = new ArrayList<>();

        for (AssignmentQuestion q : questions) {
            double point = q.getPoints() != null ? q.getPoints() : 1.0;
            maxPossible += point;

            QuestionType type = q.getQuestionType();
            SubmissionRequest.AnswerDto ans = answerMap.get(q.getId());

            if (type == QuestionType.ESSAY || type == QuestionType.AUDIO_RESPONSE) {
                aiQuestions.add(q.getId());
                earnedMap.put(q.getId(), 0.0);
                correctMap.put(q.getId(), false);
                continue;
            }

            if (ans == null) {
                earnedMap.put(q.getId(), 0.0);
                correctMap.put(q.getId(), false);
                continue;
            }

            boolean isCorrect = false;

            if (ans.getSelectedOptionId() != null && q.getOptions() != null) {
                // Trắc nghiệm nhiều lựa chọn (Multiple Choice)
                isCorrect = q.getOptions().stream()
                        .anyMatch(opt -> opt.getId() != null
                                && opt.getId().equals(ans.getSelectedOptionId())
                                && Boolean.TRUE.equals(opt.getIsCorrect()));
            } else if (ans.getTextAnswer() != null && !ans.getTextAnswer().isBlank() && q.getCorrectAnswer() != null) {
                // Điền từ vào chỗ trống (Fill in the blank)
                isCorrect = ans.getTextAnswer().trim().equalsIgnoreCase(q.getCorrectAnswer().trim());
            }

            double earned = isCorrect ? point : 0.0;
            totalEarned += earned;
            earnedMap.put(q.getId(), earned);
            correctMap.put(q.getId(), isCorrect);
        }

        double scaled = maxPossible > 0 ? (totalEarned / maxPossible) * 10.0 : 0.0;
        scaled = Math.round(scaled * 10.0) / 10.0;

        return GradingResult.builder()
                .totalScore(totalEarned)
                .maxPossibleScore(maxPossible)
                .scaledScore(scaled)
                .earnedPointsPerQuestion(earnedMap)
                .correctnessPerQuestion(correctMap)
                .requiresAiGrading(!aiQuestions.isEmpty())
                .aiGradedQuestionIds(aiQuestions)
                .build();
    }
}
