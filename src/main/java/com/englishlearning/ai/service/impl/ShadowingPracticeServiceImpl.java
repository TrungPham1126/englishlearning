package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.*;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.submission.entity.StudentAnswer;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShadowingPracticeServiceImpl implements ShadowingPracticeService {

    private final AiEvaluationService aiEvaluationService;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final EntityManager entityManager;
    private final AnalyticsService analyticsService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public ShadowingEvaluationResponse practiceShadowing(
            UUID studentAnswerId,
            byte[] audioBytes,
            String filename,
            String referenceSentence) {

        log.info("Bắt đầu xử lý luyện Shadowing cho StudentAnswer ID: {}", studentAnswerId);

        StudentAnswer studentAnswer = (studentAnswerId != null)
                ? entityManager.find(StudentAnswer.class, studentAnswerId)
                : null;

        ShadowingEvaluationResponse response = aiEvaluationService.evaluateSpeech(
                audioBytes, filename, referenceSentence);

        if (studentAnswer != null) {
            persistEvaluation(studentAnswer, response);
        }

        return response;
    }

    @Override
    public ShadowingEvaluationResponse processAudioChunk(
            String sessionId,
            byte[] audioChunk,
            String referenceText) {

        log.debug("Xử lý audio chunk cho WebSocket session: {}", sessionId);
        String chunkFilename = "chunk_" + (sessionId != null ? sessionId : "default") + ".wav";
        return aiEvaluationService.evaluateSpeech(audioChunk, chunkFilename, referenceText);
    }

    private void persistEvaluation(StudentAnswer studentAnswer, ShadowingEvaluationResponse response) {
        try {
            String rawJson = objectMapper.writeValueAsString(response);
            double scaledScore = response.getOverallScore() != null ? response.getOverallScore() / 10.0 : 0.0;

            AiEvaluation evaluation = aiEvaluationRepository.findByStudentAnswerId(studentAnswer.getId())
                    .orElseGet(() -> AiEvaluation.builder()
                            .studentAnswer(studentAnswer)
                            .evalType(AiEvaluationType.SPEAKING)
                            .build());

            evaluation.setOverallScore(scaledScore);
            evaluation.setPronunciationScore(response.getKpi() != null && response.getKpi().getPronunciation() != null
                    ? response.getKpi().getPronunciation() / 10.0 : 0.0);
            evaluation.setFluencyScore(response.getKpi() != null && response.getKpi().getFluency() != null
                    ? response.getKpi().getFluency() / 10.0 : 0.0);
            evaluation.setSuggestionsJson(rawJson);
            evaluation.setEvaluationEngine(response.getEvaluatedBy());

            aiEvaluationRepository.save(evaluation);

            studentAnswer.setEvalFeedback(rawJson);
            studentAnswer.setEarnedPoints(scaledScore);
            studentAnswer.setIsCorrect(Boolean.TRUE.equals(response.getIsPassed()));
            entityManager.merge(studentAnswer);

            if (studentAnswer.getAttempt() != null && studentAnswer.getAttempt().getStudent() != null) {
                analyticsService.updateSkillScore(
                        studentAnswer.getAttempt().getStudent().getId(),
                        "SPEAKING",
                        scaledScore * 0.1
                );
            }
        } catch (Exception ex) {
            log.warn("Lỗi khi lưu kết quả AiEvaluation vào CSDL: {}", ex.getMessage());
        }
    }
}
