package com.englishlearning.ai.service;

import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.submission.entity.StudentAnswer;
import com.fasterxml.jackson.databind.JsonNode;
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
public class AiLabService {

    private final GeminiClientService geminiClientService;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final AiGeneratedExerciseRepository aiGeneratedExerciseRepository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    private static final String SPEAKING_SYSTEM_INSTRUCTION = """
        You are an expert Cambridge Certified IELTS Speaking Examiner and Senior Phonetician.
        Evaluate audio recordings with objective rigor against official IELTS Band Descriptors and CEFR levels.
        Return strictly valid JSON according to the specified schema.
        All explanations and general feedback must be in Vietnamese.
        """;

    private static final String WRITING_SYSTEM_INSTRUCTION = """
        You are an IELTS Writing Examiner and Master English Grammarian.
        Evaluate written essays strictly against Task Response, Coherence/Cohesion, Lexical Resource, and Grammatical Range/Accuracy.
        Return strictly valid JSON according to the specified schema.
        All explanations and general feedback must be in Vietnamese.
        """;

    private static final String QUIZ_GEN_SYSTEM_INSTRUCTION = """
        You are an expert English Curriculum Specialist creating rigorous assessment materials based on CEFR benchmarks.
        Ensure options are plausible and explanations are pedagogical and in Vietnamese.
        Return strictly valid JSON.
        """;

    @Transactional
    public JsonNode evaluateSpeakingTopic(String questionTopic, MultipartFile audioFile, UUID studentAnswerId) {
        try {
            String userPrompt = String.format("""
                Topic/Question: "%s"
                Evaluate this response according to IELTS criteria and return JSON schema:
                {
                  "transcript": "...",
                  "wordsPerMinute": 130,
                  "overallBand": 6.5,
                  "estimatedCefr": "B2",
                  "pronunciationScore": 6.5,
                  "fluencyScore": 6.0,
                  "lexicalScore": 7.0,
                  "grammarScore": 6.5,
                  "coherenceScore": 6.5,
                  "correctedText": "...",
                  "mistakes": [{"original": "...", "correction": "...", "type": "...", "explanation": "..."}],
                  "suggestions": [{"area": "...", "recommendation": "..."}],
                  "generalFeedback": "..."
                }
                """, questionTopic);

            String mimeType = audioFile.getContentType() != null ? audioFile.getContentType() : "audio/wav";
            String rawJson = geminiClientService.evaluateAudioWithInstruction(
                    SPEAKING_SYSTEM_INSTRUCTION, audioFile.getBytes(), mimeType, userPrompt
            );

            JsonNode node = objectMapper.readTree(rawJson);
            StudentAnswer answer = entityManager.getReference(StudentAnswer.class, studentAnswerId);

            AiEvaluation evaluation = AiEvaluation.builder()
                    .studentAnswer(answer)
                    .evalType(AiEvaluationType.SPEAKING)
                    .overallScore(node.path("overallBand").asDouble(0.0))
                    .pronunciationScore(node.path("pronunciationScore").asDouble(0.0))
                    .fluencyScore(node.path("fluencyScore").asDouble(0.0))
                    .grammarScore(node.path("grammarScore").asDouble(0.0))
                    .vocabularyScore(node.path("lexicalScore").asDouble(0.0))
                    .coherenceScore(node.path("coherenceScore").asDouble(0.0))
                    .estimatedCefr(node.path("estimatedCefr").asText("B1"))
                    .sttTranscript(node.path("transcript").asText())
                    .correctedText(node.path("correctedText").asText())
                    .mistakesJson(node.path("mistakes").toString())
                    .suggestionsJson(node.path("suggestions").toString())
                    .build();

            aiEvaluationRepository.save(evaluation);
            return node;
        } catch (Exception e) {
            log.error("Speaking evaluation error: ", e);
            throw new RuntimeException("Đánh giá Speaking thất bại: " + e.getMessage());
        }
    }

    @Transactional
    public JsonNode evaluateWriting(String topic, String essayText, UUID studentAnswerId) {
        try {
            String userPrompt = String.format("""
                Topic: "%s"
                Essay Content:
                "%s"

                Evaluate the essay and return JSON schema:
                {
                  "wordCount": 150,
                  "overallBand": 6.0,
                  "estimatedCefr": "B2",
                  "grammarScore": 6.0,
                  "vocabularyScore": 6.5,
                  "coherenceScore": 6.0,
                  "correctedText": "...",
                  "mistakes": [{"original": "...", "correction": "...", "type": "...", "explanation": "..."}],
                  "suggestions": [{"area": "...", "recommendation": "..."}],
                  "generalFeedback": "..."
                }
                """, topic, essayText);

            String rawJson = geminiClientService.generateWithSystemInstruction(WRITING_SYSTEM_INSTRUCTION, userPrompt);
            JsonNode node = objectMapper.readTree(rawJson);
            StudentAnswer answer = entityManager.getReference(StudentAnswer.class, studentAnswerId);

            AiEvaluation evaluation = AiEvaluation.builder()
                    .studentAnswer(answer)
                    .evalType(AiEvaluationType.WRITING)
                    .overallScore(node.path("overallBand").asDouble(0.0))
                    .grammarScore(node.path("grammarScore").asDouble(0.0))
                    .vocabularyScore(node.path("vocabularyScore").asDouble(0.0))
                    .coherenceScore(node.path("coherenceScore").asDouble(0.0))
                    .estimatedCefr(node.path("estimatedCefr").asText("B1"))
                    .correctedText(node.path("correctedText").asText())
                    .mistakesJson(node.path("mistakes").toString())
                    .suggestionsJson(node.path("suggestions").toString())
                    .build();

            aiEvaluationRepository.save(evaluation);
            return node;
        } catch (Exception e) {
            log.error("Writing evaluation error: ", e);
            throw new RuntimeException("Chấm Writing thất bại: " + e.getMessage());
        }
    }

    @Transactional
    public AiGeneratedExercise generateQuizFromContent(String lessonContent, String targetCefr, int questionCount, UUID teacherId, UUID lessonId) {
        Teacher teacher = entityManager.getReference(Teacher.class, teacherId);
        Lesson lesson = entityManager.getReference(Lesson.class, lessonId);

        String userPrompt = String.format("""
            Target CEFR: %s
            Number of Questions: %d
            Lesson Material:
            "%s"

            Generate multiple-choice questions with answer choices and detailed explanations in Vietnamese.
            """, targetCefr, questionCount, lessonContent);

        AiGeneratedExercise exercise = AiGeneratedExercise.builder()
                .lesson(lesson)
                .teacher(teacher)
                .targetCefr(targetCefr)
                .exerciseType("MULTIPLE_CHOICE")
                .questionCount(questionCount)
                .rawResponseJson("{}")
                .status(GenerationStatus.PENDING_GENERATION)
                .build();
        aiGeneratedExerciseRepository.save(exercise);

        try {
            String rawJson = geminiClientService.generateWithSystemInstruction(QUIZ_GEN_SYSTEM_INSTRUCTION, userPrompt);
            exercise.setRawResponseJson(rawJson);
            exercise.setStatus(GenerationStatus.READY_FOR_REVIEW);
        } catch (Exception e) {
            log.error("Quiz generation error: ", e);
            exercise.setStatus(GenerationStatus.REJECTED);
        }
        return aiGeneratedExerciseRepository.save(exercise);
    }
}