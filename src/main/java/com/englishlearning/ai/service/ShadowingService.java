package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.submission.entity.StudentAnswer;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShadowingService {

    private final GroqClientService groqClientService;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final AnalyticsService analyticsService;

    private static final String SHADOWING_SYSTEM_INSTRUCTION = """
            You are a Senior English Phonetician and Shadowing Pronunciation Examiner.
            Your task is to compare the student's spoken transcript against the exact Reference Sentence and evaluate phoneme accuracy.

            EVALUATION SPECIFICATIONS:
            1. Parse the reference sentence word by word.
            2. Break down each word into constituent IPA phonemes and detect mispronunciations against the candidate's transcript.
            3. Compute KPI metrics (0-100): pronunciation, fluency, completeness, prosody, wordsPerMinute.
            4. If overallScore >= 80, isPassed = true.
            5. Color coding: score >= 80 -> "GREEN", 60 <= score < 80 -> "YELLOW", score < 60 -> "RED".
            6. All notes must be in Vietnamese.
            7. Return strictly valid JSON.
            """;

    @Transactional
    public ShadowingEvaluationResponse evaluateShadowing(MultipartFile audioFile, UUID studentAnswerId,
            String customSentence) {
        StudentAnswer answer = entityManager.find(StudentAnswer.class, studentAnswerId);
        if (answer == null) {
            throw new ResourceNotFoundException("Không tìm thấy câu trả lời của học sinh: " + studentAnswerId);
        }

        String referenceSentence = customSentence;
        if (referenceSentence == null || referenceSentence.isBlank()) {
            AssignmentQuestion question = answer.getQuestion();
            if (question != null && question.getPromptText() != null && !question.getPromptText().isBlank()) {
                referenceSentence = question.getPromptText();
            } else if (question != null && question.getCorrectAnswer() != null) {
                referenceSentence = question.getCorrectAnswer();
            } else {
                referenceSentence = "Small changes can make our eating habits healthier.";
            }
        }

        try {
            // 1. Nhận diện giọng nói qua Groq Whisper
            String transcript = groqClientService.transcribeAudio(audioFile);

            // 2. Chấm điểm phát âm chi tiết bằng Groq LLaMA 3.3
            String userPrompt = String.format("""
                    Reference Sentence: "%s"
                    Student Transcript: "%s"

                    Evaluate the pronunciation and return strictly JSON matching this schema:
                    {
                      "overallScore": 69,
                      "isPassed": false,
                      "passScore": 80,
                      "statusMessage": "Bạn chưa đạt! Cần >= 80 để pass.",
                      "kpi": {
                        "pronunciation": 64,
                        "fluency": 90,
                        "completeness": 88,
                        "prosody": 81,
                        "wordsPerMinute": 103
                      },
                      "sentenceTokens": [
                        {"word": "Small", "color": "GREEN", "hasPauseAfter": false, "hasLinkingAfter": false}
                      ],
                      "wordRows": [
                        {
                          "word": "Small",
                          "score": 91,
                          "phonemes": [
                            {"ipa": "/s/", "score": 84, "note": "/s/ phát âm đúng"}
                          ]
                        }
                      ]
                    }
                    """, referenceSentence, transcript);

            String rawJson = groqClientService.chatCompletionJson(SHADOWING_SYSTEM_INSTRUCTION, userPrompt);
            ShadowingEvaluationResponse response = objectMapper.readValue(rawJson, ShadowingEvaluationResponse.class);

            AiEvaluation evaluation = aiEvaluationRepository.findByStudentAnswerId(studentAnswerId)
                    .orElseGet(() -> AiEvaluation.builder()
                            .studentAnswer(answer)
                            .evalType(AiEvaluationType.SPEAKING)
                            .build());

            double overallScaled = response.getOverallScore() != null ? response.getOverallScore() / 10.0 : 0.0;
            evaluation.setOverallScore(overallScaled);
            evaluation.setSttTranscript(transcript);
            evaluation.setSuggestionsJson(rawJson);
            aiEvaluationRepository.save(evaluation);

            if (answer.getAttempt() != null && answer.getAttempt().getStudent() != null) {
                analyticsService.updateSkillScore(answer.getAttempt().getStudent().getId(), "SPEAKING",
                        overallScaled * 0.1);
            }

            return response;
        } catch (Exception e) {
            log.error("Shadowing evaluation error: ", e);
            throw new RuntimeException("Chấm bài Shadowing qua Groq thất bại: " + e.getMessage(), e);
        }
    }
}