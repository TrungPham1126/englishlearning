package com.englishlearning.submission.service.impl;

import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionOption;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.submission.dto.GradingResult;
import com.englishlearning.submission.dto.SubmissionRequest;
import com.englishlearning.submission.service.GradingEngineService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class GradingEngineServiceImpl implements GradingEngineService {

    private final ObjectMapper objectMapper = new ObjectMapper();

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
                ? answers.stream().filter(a -> a.getQuestionId() != null)
                    .collect(Collectors.toMap(SubmissionRequest.AnswerDto::getQuestionId, a -> a, (a1, a2) -> a1))
                : Collections.emptyMap();

        Map<UUID, AssignmentQuestion> questionMap = questions.stream()
                .filter(q -> q.getId() != null)
                .collect(Collectors.toMap(AssignmentQuestion::getId, q -> q, (q1, q2) -> q1));

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

            if (type == QuestionType.MATCHING && isMultiPairMatchingQuestion(q)) {
                String studentText = ans.getTextAnswer() != null ? ans.getTextAnswer().trim() : "";
                double earned = gradeMultiPairMatching(q, studentText, point);
                boolean allMatched = Math.abs(earned - point) < 0.001 && point > 0;
                totalEarned += earned;
                earnedMap.put(q.getId(), earned);
                correctMap.put(q.getId(), allMatched);
                continue;
            }

            boolean isCorrect = gradeSingleQuestion(q, ans, questionMap);

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

    private boolean gradeSingleQuestion(AssignmentQuestion q, SubmissionRequest.AnswerDto ans, Map<UUID, AssignmentQuestion> questionMap) {
        QuestionType type = q.getQuestionType();
        String studentText = ans.getTextAnswer() != null ? normalizeText(ans.getTextAnswer()) : "";
        UUID selectedOptId = ans.getSelectedOptionId();

        if (type == QuestionType.MATCHING) {
            return gradeMatchingQuestion(q, studentText, selectedOptId, questionMap);
        }

        if (selectedOptId != null && q.getOptions() != null && !q.getOptions().isEmpty()) {
            return q.getOptions().stream()
                    .anyMatch(opt -> opt.getId() != null
                            && opt.getId().equals(selectedOptId)
                            && Boolean.TRUE.equals(opt.getIsCorrect()));
        }

        if (!studentText.isBlank()) {
            if (q.getCorrectAnswer() != null && !q.getCorrectAnswer().isBlank()) {
                String expected = normalizeText(q.getCorrectAnswer());
                if (studentText.equalsIgnoreCase(expected)) {
                    return true;
                }
                if (type == QuestionType.FILL_IN_BLANK
                        && (q.getCorrectAnswer().contains("|") || q.getCorrectAnswer().contains("/"))) {
                    String[] variants = q.getCorrectAnswer().split("[|/]");
                    for (String variant : variants) {
                        String normVariant = normalizeText(variant);
                        if (!normVariant.isBlank() && studentText.equalsIgnoreCase(normVariant)) {
                            return true;
                        }
                    }
                }
            }
            if ((type == QuestionType.MULTIPLE_CHOICE || type == QuestionType.TRUE_FALSE)
                    && q.getOptions() != null && !q.getOptions().isEmpty()) {
                return q.getOptions().stream()
                        .anyMatch(opt -> Boolean.TRUE.equals(opt.getIsCorrect())
                                && ((opt.getOptionText() != null && normalizeText(opt.getOptionText()).equalsIgnoreCase(studentText))
                                 || (opt.getOptionLabel() != null && normalizeText(opt.getOptionLabel()).equalsIgnoreCase(studentText))));
            }
        }

        return false;
    }

    private String normalizeText(String raw) {
        if (raw == null) return "";
        return Normalizer.normalize(raw.trim(), Normalizer.Form.NFC).replaceAll("\\s+", " ");
    }

    private boolean isMultiPairMatchingQuestion(AssignmentQuestion q) {
        if (q.getOptions() == null || q.getOptions().size() < 2) {
            return false;
        }
        long pairCount = q.getOptions().stream()
                .filter(opt -> opt.getOptionText() != null && !opt.getOptionText().isBlank()
                        && opt.getMatchText() != null && !opt.getMatchText().isBlank())
                .count();
        return pairCount >= 2;
    }

    private double gradeMultiPairMatching(AssignmentQuestion q, String studentText, double totalPoint) {
        if (studentText == null || studentText.isBlank() || !studentText.startsWith("{")) {
            return 0.0;
        }
        List<QuestionOption> pairOptions = q.getOptions().stream()
                .filter(opt -> opt.getOptionText() != null && !opt.getOptionText().isBlank()
                        && opt.getMatchText() != null && !opt.getMatchText().isBlank())
                .toList();
        if (pairOptions.isEmpty()) {
            return 0.0;
        }
        try {
            Map<?, ?> rawMap = objectMapper.readValue(studentText, Map.class);
            Map<String, String> normalizedSubmission = new HashMap<>();
            for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
                if (entry.getKey() != null && entry.getValue() != null) {
                    normalizedSubmission.put(normalizeText(String.valueOf(entry.getKey())).toLowerCase(),
                            normalizeText(String.valueOf(entry.getValue())));
                }
            }
            int matchedCount = 0;
            for (QuestionOption pair : pairOptions) {
                String expectedMatch = normalizeText(pair.getMatchText());
                String keyByText = normalizeText(pair.getOptionText()).toLowerCase();
                String submitted = normalizedSubmission.get(keyByText);
                if (submitted == null && pair.getOptionLabel() != null) {
                    submitted = normalizedSubmission.get(normalizeText(pair.getOptionLabel()).toLowerCase());
                }
                if (submitted == null && pair.getId() != null) {
                    submitted = normalizedSubmission.get(pair.getId().toString().toLowerCase());
                }
                if (submitted != null && submitted.equalsIgnoreCase(expectedMatch)) {
                    matchedCount++;
                }
            }
            double earned = totalPoint * ((double) matchedCount / pairOptions.size());
            return Math.round(earned * 100.0) / 100.0;
        } catch (Exception ignored) {
            return 0.0;
        }
    }

    private boolean gradeMatchingQuestion(AssignmentQuestion q, String studentText, UUID selectedOptId, Map<UUID, AssignmentQuestion> questionMap) {
        String targetAnswer = q.getCorrectAnswer() != null ? q.getCorrectAnswer().trim() : "";

        // 1. So khớp trực tiếp nội dung textAnswer với correctAnswer (không phân biệt hoa thường và khoảng trắng)
        if (!studentText.isBlank() && !targetAnswer.isBlank()) {
            if (studentText.equalsIgnoreCase(targetAnswer)) {
                return true;
            }
        }

        // 2. So khớp nếu textAnswer là JSON map kết nối: {"questionId": "targetMeaning"} hoặc {"questionId": "targetQId"}
        if (!studentText.isBlank() && studentText.startsWith("{")) {
            try {
                Map<?, ?> jsonMap = objectMapper.readValue(studentText, Map.class);
                String qIdStr = q.getId().toString();
                Object matchedVal = jsonMap.get(qIdStr);
                if (matchedVal == null && q.getPromptText() != null) {
                    matchedVal = jsonMap.get(q.getPromptText().trim());
                }
                if (matchedVal != null) {
                    String valStr = normalizeText(String.valueOf(matchedVal));
                    if (!targetAnswer.isBlank() && valStr.equalsIgnoreCase(normalizeText(targetAnswer))) {
                        return true;
                    }
                    if (valStr.equalsIgnoreCase(qIdStr)) {
                        return true;
                    }
                    try {
                        UUID targetUuid = UUID.fromString(valStr);
                        AssignmentQuestion peer = questionMap.get(targetUuid);
                        if (peer != null && peer.getCorrectAnswer() != null && !targetAnswer.isBlank()
                                && normalizeText(peer.getCorrectAnswer()).equalsIgnoreCase(normalizeText(targetAnswer))) {
                            return true;
                        }
                    } catch (IllegalArgumentException ignored) {
                    }
                }
            } catch (Exception ignored) {
            }
        }

        // 3. So khớp selectedOptionId với ID câu hỏi (tự quy chiếu câu hỏi 1-1)
        if (selectedOptId != null) {
            if (selectedOptId.equals(q.getId())) {
                return true;
            }

            // Kiểm tra nếu selectedOptId trỏ tới câu hỏi khác có cùng correctAnswer hoặc prompt
            AssignmentQuestion targetQ = questionMap.get(selectedOptId);
            if (targetQ != null && targetQ.getCorrectAnswer() != null && !targetAnswer.isBlank()) {
                if (targetQ.getCorrectAnswer().trim().equalsIgnoreCase(targetAnswer)) {
                    return true;
                }
            }
        }

        // 4. So khớp với options nếu câu hỏi có danh sách options riêng
        if (q.getOptions() != null && !q.getOptions().isEmpty()) {
            if (selectedOptId != null) {
                boolean optIdMatch = q.getOptions().stream()
                        .anyMatch(opt -> opt.getId() != null
                                && opt.getId().equals(selectedOptId)
                                && Boolean.TRUE.equals(opt.getIsCorrect()));
                if (optIdMatch) return true;
            }

            if (!studentText.isBlank()) {
                boolean optTextMatch = q.getOptions().stream()
                        .anyMatch(opt -> Boolean.TRUE.equals(opt.getIsCorrect())
                                && ((opt.getOptionText() != null && opt.getOptionText().trim().equalsIgnoreCase(studentText))
                                 || (opt.getMatchText() != null && opt.getMatchText().trim().equalsIgnoreCase(studentText))));
                if (optTextMatch) return true;
            }
        }

        return false;
    }
}
