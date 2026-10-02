package com.englishlearning.ai.service;

import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.service.AssignmentService;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.common.exception.ResourceNotFoundException;
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

    private final GroqClientService groqClientService;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final AiGeneratedExerciseRepository aiGeneratedExerciseRepository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final AssignmentService assignmentService;
    private final AnalyticsService analyticsService;

    private static final String SPEAKING_SYSTEM_INSTRUCTION = """
            You are a Cambridge Certified IELTS Speaking Examiner and Senior Phonetician.
            Evaluate the provided student speech transcript strictly against the given Assignment Prompt and IELTS criteria.

            RULES:
            1. Verify Task Achievement: If the speech does NOT answer the Prompt or key criteria, set "isOffTopic": true and cap overallBand <= 4.0.
            2. Evaluate Pronunciation, Fluency, Lexical Resource, and Grammar.
            3. All explanations, corrections, and general feedback MUST be in Vietnamese.
            4. Return strictly valid JSON conforming to the requested schema.
            """;

    private static final String WRITING_SYSTEM_INSTRUCTION = """
            You are an expert IELTS Writing Examiner.
            Evaluate written essays against Task Response, Coherence/Cohesion, Lexical Resource, and Grammatical Range/Accuracy.

            RULES:
            1. Check Task Response: If off-topic, set "isOffTopic": true and cap overallBand <= 4.0.
            2. Provide corrections with clear explanations.
            3. All explanations and feedback MUST be in Vietnamese.
            4. Return strictly valid JSON.
            """;

    private static final String QUIZ_GEN_SYSTEM_INSTRUCTION = """
            You are an expert English Curriculum Specialist creating rigorous assessment materials based on CEFR benchmarks.
            Ensure options are plausible and explanations are pedagogical and in Vietnamese.
            Return strictly valid JSON with an array of questions under key 'questions'.
            """;

    @Transactional
    public JsonNode evaluateSpeakingTopic(String questionTopic, MultipartFile audioFile, UUID studentAnswerId) {
        try {
            StudentAnswer answer = entityManager.find(StudentAnswer.class, studentAnswerId);
            if (answer == null) {
                throw new ResourceNotFoundException("Không tìm thấy câu trả lời của học sinh: " + studentAnswerId);
            }

            // 1. Dùng Groq Whisper bóc băng Audio sang Transcript
            String transcript = groqClientService.transcribeAudio(audioFile);

            AssignmentQuestion question = answer.getQuestion();
            Assignment assignment = (question != null) ? question.getAssignment() : null;

            String assignmentTitle = (assignment != null && assignment.getTitle() != null) ? assignment.getTitle()
                    : "Speaking Assessment";
            String promptText = (question != null && question.getPromptText() != null
                    && !question.getPromptText().isBlank()) ? question.getPromptText() : questionTopic;
            String keyPoints = (question != null && question.getCorrectAnswer() != null) ? question.getCorrectAnswer()
                    : "Yêu cầu trả lời trực tiếp trọng tâm câu hỏi.";
            String rubrics = (question != null && question.getExplanation() != null) ? question.getExplanation()
                    : "Đánh giá sự lưu loát và từ vựng tự nhiên.";

            String userPrompt = String.format("""
                    === DỮ LIỆU ĐỀ BÀI ===
                    - Tiêu đề: "%s"
                    - Câu hỏi: "%s"
                    - Ý chính bắt buộc: "%s"
                    - Tiêu chí chấm: "%s"

                    === BẢN BÓC BĂNG GIỌNG NÓI HỌC SINH (TRANSCRIPT) ===
                    "%s"

                    Return strictly JSON matching this schema:
                    {
                      "transcript": "%s",
                      "wordsPerMinute": 130,
                      "isOffTopic": false,
                      "taskAchievement": {
                        "score": 6.5,
                        "addressedPoints": ["..."],
                        "missingPoints": ["..."]
                      },
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
                    """, assignmentTitle, promptText, keyPoints, rubrics, transcript, transcript.replace("\"", "\\\""));

            // 2. Dùng Groq LLaMA 3.3 chấm điểm và phân tích
            String rawJson = groqClientService.chatCompletionJson(SPEAKING_SYSTEM_INSTRUCTION, userPrompt);
            JsonNode node = objectMapper.readTree(rawJson);
            double overallBand = node.path("overallBand").asDouble(0.0);

            AiEvaluation evaluation = aiEvaluationRepository.findByStudentAnswerId(studentAnswerId)
                    .orElseGet(() -> AiEvaluation.builder()
                            .studentAnswer(answer)
                            .evalType(AiEvaluationType.SPEAKING)
                            .build());

            evaluation.setOverallScore(overallBand);
            evaluation.setPronunciationScore(node.path("pronunciationScore").asDouble(0.0));
            evaluation.setFluencyScore(node.path("fluencyScore").asDouble(0.0));
            evaluation.setGrammarScore(node.path("grammarScore").asDouble(0.0));
            evaluation.setVocabularyScore(node.path("lexicalScore").asDouble(0.0));
            evaluation.setCoherenceScore(node.path("coherenceScore").asDouble(0.0));
            evaluation.setEstimatedCefr(node.path("estimatedCefr").asText("B1"));
            evaluation.setSttTranscript(transcript);
            evaluation.setCorrectedText(node.path("correctedText").asText());
            evaluation.setMistakesJson(node.path("mistakes").toString());
            evaluation.setSuggestionsJson(node.path("suggestions").toString());

            aiEvaluationRepository.save(evaluation);

            if (answer.getAttempt() != null && answer.getAttempt().getStudent() != null) {
                analyticsService.updateSkillScore(answer.getAttempt().getStudent().getId(), "SPEAKING",
                        overallBand * 0.5);
            }

            return node;
        } catch (Exception e) {
            log.error("Speaking evaluation error: ", e);
            throw new RuntimeException("Đánh giá Speaking bằng Groq thất bại: " + e.getMessage(), e);
        }
    }

    @Transactional
    public JsonNode evaluateWriting(String topic, String essayText, UUID studentAnswerId) {
        try {
            StudentAnswer answer = entityManager.find(StudentAnswer.class, studentAnswerId);
            if (answer == null) {
                throw new ResourceNotFoundException("Không tìm thấy câu trả lời của học sinh: " + studentAnswerId);
            }

            AssignmentQuestion question = answer.getQuestion();
            Assignment assignment = (question != null) ? question.getAssignment() : null;

            String assignmentTitle = (assignment != null && assignment.getTitle() != null) ? assignment.getTitle()
                    : "Writing Assessment";
            String promptText = (question != null && question.getPromptText() != null
                    && !question.getPromptText().isBlank()) ? question.getPromptText() : topic;
            String keyPoints = (question != null && question.getCorrectAnswer() != null) ? question.getCorrectAnswer()
                    : "Yêu cầu trả lời đúng câu hỏi.";
            String rubrics = (question != null && question.getExplanation() != null) ? question.getExplanation()
                    : "Đánh giá ngữ pháp và độ mạch lạc.";

            String userPrompt = String.format("""
                    === DỮ LIỆU ĐỀ BÀI ===
                    - Tiêu đề: "%s"
                    - Đề bài: "%s"
                    - Ý chính: "%s"
                    - Tiêu chí: "%s"

                    === BÀI VIẾT HỌC SINH ===
                    "%s"

                    Return strictly JSON matching this schema:
                    {
                      "wordCount": 150,
                      "isOffTopic": false,
                      "taskAchievement": {
                        "score": 6.0,
                        "addressedPoints": ["..."],
                        "missingPoints": ["..."]
                      },
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
                    """, assignmentTitle, promptText, keyPoints, rubrics, essayText);

            String rawJson = groqClientService.chatCompletionJson(WRITING_SYSTEM_INSTRUCTION, userPrompt);
            JsonNode node = objectMapper.readTree(rawJson);
            double overallBand = node.path("overallBand").asDouble(0.0);

            AiEvaluation evaluation = aiEvaluationRepository.findByStudentAnswerId(studentAnswerId)
                    .orElseGet(() -> AiEvaluation.builder()
                            .studentAnswer(answer)
                            .evalType(AiEvaluationType.WRITING)
                            .build());

            evaluation.setOverallScore(overallBand);
            evaluation.setGrammarScore(node.path("grammarScore").asDouble(0.0));
            evaluation.setVocabularyScore(node.path("vocabularyScore").asDouble(0.0));
            evaluation.setCoherenceScore(node.path("coherenceScore").asDouble(0.0));
            evaluation.setEstimatedCefr(node.path("estimatedCefr").asText("B1"));
            evaluation.setCorrectedText(node.path("correctedText").asText());
            evaluation.setMistakesJson(node.path("mistakes").toString());
            evaluation.setSuggestionsJson(node.path("suggestions").toString());

            aiEvaluationRepository.save(evaluation);

            if (answer.getAttempt() != null && answer.getAttempt().getStudent() != null) {
                analyticsService.updateSkillScore(answer.getAttempt().getStudent().getId(), "WRITING",
                        overallBand * 0.5);
            }

            return node;
        } catch (Exception e) {
            log.error("Writing evaluation error: ", e);
            throw new RuntimeException("Chấm Writing bằng Groq thất bại: " + e.getMessage(), e);
        }
    }

    @Transactional
    public AiGeneratedExercise generateQuizFromContent(String lessonContent, String targetCefr, int questionCount,
            UUID teacherId, UUID lessonId) {
        Teacher teacher = entityManager.getReference(Teacher.class, teacherId);
        Lesson lesson = entityManager.getReference(Lesson.class, lessonId);

        String userPrompt = String.format("""
                Target CEFR: %s
                Number of Questions: %d
                Lesson Material:
                "%s"

                Return strictly JSON matching this structure:
                {
                  "questions": [
                    {
                      "question": "Question prompt text?",
                      "explanation": "Lời giải thích bằng tiếng Việt",
                      "options": [
                        {"text": "Option A", "isCorrect": true},
                        {"text": "Option B", "isCorrect": false},
                        {"text": "Option C", "isCorrect": false},
                        {"text": "Option D", "isCorrect": false}
                      ]
                    }
                  ]
                }
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
            String rawJson = groqClientService.chatCompletionJson(QUIZ_GEN_SYSTEM_INSTRUCTION, userPrompt);
            exercise.setRawResponseJson(rawJson);
            exercise.setStatus(GenerationStatus.READY_FOR_REVIEW);
        } catch (Exception e) {
            log.error("Quiz generation error: ", e);
            exercise.setStatus(GenerationStatus.REJECTED);
        }
        return aiGeneratedExerciseRepository.save(exercise);
    }

    @Transactional
    public Assignment publishExerciseToAssignment(UUID exerciseId, UUID classroomId) {
        AiGeneratedExercise exercise = aiGeneratedExerciseRepository.findById(exerciseId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bài tập AI"));

        try {
            JsonNode root = objectMapper.readTree(exercise.getRawResponseJson());
            JsonNode questionsNode = root.has("questions") ? root.get("questions") : root;

            com.englishlearning.assignment.dto.AssignmentRequest req = new com.englishlearning.assignment.dto.AssignmentRequest();
            req.setTitle("AI Generated Quiz: " + exercise.getLesson().getTitle());
            req.setDescription("Tự động tạo từ nội dung bài học bằng Groq LLaMA 3.3.");
            req.setClassroomId(classroomId);
            req.setLessonId(exercise.getLesson().getId());
            req.setSkillType("READING");
            req.setTimeLimitMinutes(15);
            req.setMaxAttempts(3);
            req.setPassScore(5.0);

            java.util.List<com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest> qReqs = new java.util.ArrayList<>();
            if (questionsNode.isArray()) {
                for (JsonNode qNode : questionsNode) {
                    com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest qReq = new com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest();
                    qReq.setPromptText(qNode.path("question").asText());
                    qReq.setQuestionType("MULTIPLE_CHOICE");
                    qReq.setExplanation(qNode.path("explanation").asText());
                    qReq.setPoints(10.0 / exercise.getQuestionCount());

                    java.util.List<com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest> optReqs = new java.util.ArrayList<>();
                    for (JsonNode optNode : qNode.path("options")) {
                        com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest optReq = new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                        optReq.setOptionText(optNode.path("text").asText());
                        optReq.setCorrect(optNode.path("isCorrect").asBoolean());
                        optReqs.add(optReq);
                    }
                    qReq.setOptions(optReqs);
                    qReqs.add(qReq);
                }
            }
            req.setQuestions(qReqs);

            Assignment assignment = assignmentService.createAssignment(req);
            exercise.setStatus(GenerationStatus.PUBLISHED);
            aiGeneratedExerciseRepository.save(exercise);
            return assignment;
        } catch (Exception e) {
            throw new RuntimeException("Lỗi parse JSON để tạo Assignment: " + e.getMessage(), e);
        }
    }
}