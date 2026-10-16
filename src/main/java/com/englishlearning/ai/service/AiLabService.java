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
import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.service.DictionaryLookupService;
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
    private final GeminiClientService geminiClientService;
    private final LessonRepository lessonRepository;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final AiGeneratedExerciseRepository aiGeneratedExerciseRepository;
    private final TeacherRepository teacherRepository;
    private final UserRepository userRepository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final AssignmentService assignmentService;
    private final ExerciseAudioService exerciseAudioService;
    private final AnalyticsService analyticsService;
    private final DictionaryLookupService dictionaryLookupService;

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

    @SuppressWarnings("unused")
    private static final String QUIZ_GEN_SYSTEM_INSTRUCTION = """
            You are an expert English Curriculum Specialist creating rigorous assessment materials based on CEFR benchmarks.
            Ensure options are plausible and explanations are pedagogical and in Vietnamese.
            Return strictly valid JSON with an array of questions under key 'questions'.
            """;

    @Transactional
    public JsonNode evaluateSpeakingTopic(String questionTopic, MultipartFile audioFile, UUID studentAnswerId) {
        try {
            StudentAnswer foundAnswer = (studentAnswerId != null)
                    ? entityManager.find(StudentAnswer.class, studentAnswerId)
                    : null;
            if (studentAnswerId != null && foundAnswer == null) {
                log.warn("Không tìm thấy StudentAnswer với ID: {}. Thử tìm theo Question ID trong các lượt làm bài đang mở...",
                        studentAnswerId);
                try {
                    java.util.List<StudentAnswer> candidates = entityManager.createQuery(
                            "SELECT a FROM StudentAnswer a WHERE a.question.id = :qId AND a.attempt.status = :status ORDER BY a.attempt.startedAt DESC",
                            StudentAnswer.class)
                            .setParameter("qId", studentAnswerId)
                            .setParameter("status", com.englishlearning.submission.entity.AttemptStatus.IN_PROGRESS)
                            .getResultList();
                    if (!candidates.isEmpty()) {
                        foundAnswer = candidates.get(0);
                        log.info("Đã tìm thấy StudentAnswer {} tương ứng với Question ID {}", foundAnswer.getId(), studentAnswerId);
                    }
                } catch (Exception ex) {
                    log.warn("Lỗi tra cứu StudentAnswer theo Question ID: {}", ex.getMessage());
                }
            }
            final StudentAnswer answer = foundAnswer;

            // 1. Dùng Groq Whisper bóc băng Audio sang Transcript
            String transcript = "";
            if (audioFile == null || audioFile.getSize() == 64044L || audioFile.isEmpty()) {
                if (answer != null && answer.getAudioResponseUrl() != null && !answer.getAudioResponseUrl().isBlank()) {
                    log.info("Downloading audio from URL: {}", answer.getAudioResponseUrl());
                    java.net.URL url = new java.net.URL(answer.getAudioResponseUrl());
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    try (java.io.InputStream in = conn.getInputStream()) {
                        byte[] audioBytes = in.readAllBytes();
                        transcript = groqClientService.transcribeAudio(audioBytes, "audio.webm");
                    }
                } else {
                    log.warn("Không tìm thấy file audio hoặc URL hợp lệ để chấm điểm. Sẽ chấm điểm với transcript rỗng.");
                    transcript = "";
                }
            } else {
                transcript = groqClientService.transcribeAudio(audioFile);
            }

            AssignmentQuestion question = (answer != null) ? answer.getQuestion() : null;
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

            if (answer != null) {
                AiEvaluation evaluation = aiEvaluationRepository.findByStudentAnswerId(answer.getId())
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

                answer.setEvalFeedback(rawJson);
                answer.setEarnedPoints(overallBand);
                answer.setIsCorrect(overallBand >= 5.0);
                entityManager.merge(answer);

                if (answer.getAttempt() != null && answer.getAttempt().getStudent() != null) {
                    analyticsService.updateSkillScore(answer.getAttempt().getStudent().getId(), "SPEAKING",
                            overallBand * 0.5);
                }
            }

            return node;
        } catch (Exception e) {
            log.error("Speaking evaluation error: ", e);
            throw new RuntimeException("Đánh giá Speaking bằng Groq thất bại: " + e.getMessage(), e);
        }
    }

    @Transactional

    public JsonNode evaluateWriting(String topic, String essayText,
            UUID studentAnswerId) {
        try {
            final StudentAnswer answer = (studentAnswerId != null)
                    ? entityManager.find(StudentAnswer.class, studentAnswerId)
                    : null;
            if (studentAnswerId != null && answer == null) {
                throw new ResourceNotFoundException("Không tìm thấy câu trả lời của học sinh: " + studentAnswerId);
            }

            AssignmentQuestion question = (answer != null) ? answer.getQuestion() : null;
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

            if (studentAnswerId != null && answer != null) {
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
        return generateQuizFromContent(lessonContent, targetCefr, questionCount, teacherId, lessonId, "MULTIPLE_CHOICE", null);
    }

    @Transactional
    public AiGeneratedExercise generateQuizFromContent(String lessonContent, String targetCefr, int questionCount,
            UUID teacherId, UUID lessonId, String exerciseType) {
        return generateQuizFromContent(lessonContent, targetCefr, questionCount, teacherId, lessonId, exerciseType, null);
    }

    @Transactional
    public AiGeneratedExercise generateQuizFromContent(String lessonContent, String targetCefr, int questionCount,
            UUID teacherId, UUID lessonId, String exerciseType, String skillType) {
        Teacher teacher = teacherRepository.findById(teacherId).orElseGet(() -> {
            User u = userRepository.findById(teacherId).orElse(null);
            if (u != null) {
                return teacherRepository.save(Teacher.builder().user(u).yearsOfExperience(1).specialization("English").build());
            }
            return entityManager.getReference(Teacher.class, teacherId);
        });

        // Lesson là tuỳ chọn - bài tập hiện tại được gán theo lộ trình ngày (Daily Plan) thay vì bài học
        Lesson lesson = null;
        if (lessonId != null) {
            lesson = lessonRepository.findById(lessonId).orElse(null);
        }

        String effectiveType = (exerciseType != null && !exerciseType.isBlank())
                ? exerciseType.trim().toUpperCase()
                : "MULTIPLE_CHOICE";

        String effectiveSkill = (skillType != null && !skillType.isBlank())
                ? skillType.trim().toUpperCase()
                : "";

        if (effectiveSkill.isBlank()) {
            if (effectiveType.startsWith("GRAMMAR")) {
                effectiveSkill = "GRAMMAR";
            } else if (effectiveType.startsWith("VOCAB")) {
                effectiveSkill = "VOCABULARY";
            } else if (effectiveType.startsWith("READING")) {
                effectiveSkill = "READING";
            } else if (effectiveType.startsWith("LISTENING")) {
                effectiveSkill = "LISTENING";
            } else if (effectiveType.startsWith("WRITING")) {
                effectiveSkill = "WRITING";
            } else if (effectiveType.startsWith("SPEAKING") || effectiveType.contains("SHADOWING") || effectiveType.contains("QA")) {
                effectiveSkill = "SPEAKING";
            } else {
                effectiveSkill = "GRAMMAR";
            }
        }

        // Chuẩn hóa và đồng bộ chặt chẽ giữa effectiveType và effectiveSkill
        if ("GRAMMAR".equals(effectiveSkill)) {
            if (!effectiveType.startsWith("GRAMMAR")) {
                if (effectiveType.contains("VERB") || effectiveType.contains("CONJUGAT")) {
                    effectiveType = "GRAMMAR_VERB_CONJUGATION";
                } else if (effectiveType.contains("ARRANGE") || effectiveType.contains("UNSCRAMBLE")) {
                    effectiveType = "GRAMMAR_WORD_ARRANGEMENT";
                } else if (effectiveType.contains("ERROR") || effectiveType.contains("CORRECT")) {
                    effectiveType = "GRAMMAR_ERROR_CORRECTION";
                } else if (effectiveType.contains("TRANSFORM")) {
                    effectiveType = "GRAMMAR_TRANSFORMATION";
                } else {
                    effectiveType = "GRAMMAR_MULTIPLE_CHOICE";
                }
            }
        } else if ("VOCABULARY".equals(effectiveSkill) || "VOCAB".equals(effectiveSkill)) {
            effectiveSkill = "VOCABULARY";
            if (!effectiveType.startsWith("VOCAB")) {
                effectiveType = "VOCAB_MEANING_TO_WORD";
            }
        } else if ("READING".equals(effectiveSkill)) {
            if (!effectiveType.startsWith("READING")) {
                effectiveType = "READING_MULTIPLE_CHOICE";
            }
        } else if ("LISTENING".equals(effectiveSkill)) {
            if (!effectiveType.startsWith("LISTENING")) {
                effectiveType = "LISTENING_MC";
            }
        } else if ("WRITING".equals(effectiveSkill)) {
            if (!effectiveType.startsWith("WRITING")) {
                effectiveType = "WRITING_PARAGRAPH";
            }
        } else if ("SPEAKING".equals(effectiveSkill)) {
            if (!effectiveType.startsWith("SPEAKING")) {
                effectiveType = (effectiveType.contains("SHADOWING")) ? "SPEAKING_SHADOWING" : "SPEAKING_QA";
            }
        }

        int count = questionCount > 0 ? questionCount : 5;
        String cefr = (targetCefr != null && !targetCefr.isBlank()) ? targetCefr.trim().toUpperCase() : "B2";

        String systemInstruction;
        String userPrompt;

        if ("SPEAKING".equals(effectiveSkill)) {
            if (effectiveType.contains("SHADOWING")) {
            // Luyện nói Shadowing: Nhại theo câu văn mẫu (CHỈ ĐỌC CÂU KHẲNG ĐỊNH / MÔ TẢ, TUYỆT ĐỐI KHÔNG PHẢI HỎI - ĐÁP Q&A)
            systemInstruction = """
                    You are an expert Cambridge Certified Speaking Coach and Senior Phonetician.
                    Generate %d natural, authentic DECLARATIVE English sentences for Shadowing (listen-and-repeat pronunciation practice) based on the provided material or topic.
                    The sentences must be appropriate for CEFR level %s.
                    CRITICAL RULES FOR SHADOWING:
                    1. EVERY sentence MUST be a declarative statement ending with a period ('.').
                    2. NEVER generate interview questions, Q&A prompts, or sentences ending with a question mark ('?').
                    3. NEVER include instruction prefixes like "Shadowing:", "Repeat after me:", or "Question 1:" inside the sentence. Output ONLY the pure English sentence to be spoken.
                    4. "question", "prompt", and "correctAnswer" MUST contain the exact same declarative English sentence.
                    For each sentence:
                    - "question" / "prompt": Pure declarative English sentence for the student to shadow.
                    - "explanation": Clear Vietnamese translation and phonetics/intonation notes (word stress, linking sounds, falling intonation).
                    - "correctAnswer": Exact same declarative English sentence.
                    - "questionType": "AUDIO_RESPONSE"
                    - "speakingMode": "SHADOWING"
                    Return strictly valid JSON conforming to the schema:
                    {
                      "speakingMode": "SHADOWING",
                      "questions": [
                        {
                          "questionType": "AUDIO_RESPONSE",
                          "speakingMode": "SHADOWING",
                          "question": "Consistent pronunciation practice and phonemic awareness enhance oral fluency.",
                          "prompt": "Consistent pronunciation practice and phonemic awareness enhance oral fluency.",
                          "explanation": "Dịch nghĩa tiếng Việt và hướng dẫn nối âm / trọng âm",
                          "correctAnswer": "Consistent pronunciation practice and phonemic awareness enhance oral fluency."
                        }
                      ]
                    }
                    """.formatted(count, cefr);

            userPrompt = String.format("""
                    Exercise Mode: SPEAKING SHADOWING (Declarative Reference Sentences ONLY - NO Q&A Questions)
                    Target CEFR Level: %s
                    Number of Sentences: %d
                    Topic or Material:
                    "%s"
                    """, cefr, count, lessonContent);

            } else {
                // Luyện nói Hỏi - Đáp (Speaking Q&A / Phỏng Vấn AI):
                systemInstruction = """
                        You are an expert Cambridge and IELTS Speaking Examiner.
                        Generate %d engaging speaking questions for an interactive Speaking Q&A / Interview practice suitable for CEFR level %s based on the topic or material.
                        For each question:
                        - "question" / "prompt": The English question that the student will read and answer by recording their voice.
                        - "explanation": Guidelines in Vietnamese: key vocabulary suggestions, recommended phrases, and sample answering structure.
                        - "correctAnswer": Core key points / required ideas to address (Ý chính cần trả lời đúng trọng tâm câu hỏi để AI đối chiếu chấm Task Response xem học sinh trả lời đúng trọng tâm hay lạc đề).
                        - "questionType": "AUDIO_RESPONSE"
                        Return strictly valid JSON conforming to the schema:
                        {
                          "questions": [
                            {
                              "questionType": "AUDIO_RESPONSE",
                              "question": "Speaking interview question prompt in English",
                              "prompt": "Speaking interview question prompt in English",
                              "explanation": "Hướng dẫn trả lời, từ vựng trọng tâm và cấu trúc câu mẫu bằng tiếng Việt",
                              "correctAnswer": "Các ý chính trọng tâm cần trả lời (Key points to address)"
                            }
                          ]
                        }
                        """.formatted(count, cefr);

                userPrompt = String.format("""
                        Target CEFR Level: %s
                        Number of Speaking Questions: %d
                        Topic or Material:
                        "%s"
                        """, cefr, count, lessonContent);
            }

        } else if ("LISTENING".equals(effectiveSkill) || effectiveType.startsWith("LISTENING")) {
            // ================= KỸ NĂNG NGHE (LISTENING) THEO TỪNG DẠNG BÀI: NGHE CẢ ĐOẠN DÀI =================
            String wordCountGuideline = switch (cefr) {
                case "A1" -> "100-140 words. Basic everyday vocabulary, simple sentence structures, present tenses, clear familiar topics.";
                case "A2" -> "150-200 words. Past simple, future intentions, basic social interactions, directions, shopping, travel.";
                case "B1" -> "200-260 words. Announcements, travel anecdotes, work meetings, cause-and-effect connectors, varied tenses.";
                case "B2" -> "260-350 words. Engaging presentations, debates, campus discussions, natural idiomatic expressions, complex sentences.";
                default -> "350-450 words. Academic lectures, scientific discourse, subtle opinions, formal registers, higher-level vocabulary.";
            };

            if (effectiveType.contains("FILL") || effectiveType.contains("GAP") || effectiveType.contains("DICTATION")) {
                // Dạng 1: Nghe điền từ vào chỗ trống dựa trên cả đoạn nghe dài (Gap-filling / Dictation)
                systemInstruction = """
                    You are a Senior Cambridge Listening Specialist.
                    Create 1 complete, continuous authentic English listening passage (%s words) for CEFR level %s based on the topic.
                    The vocabulary and pacing must strictly match CEFR %s: %s

                    Then generate EXACTLY %d gap-filling / dictation questions testing key details heard throughout this continuous passage.
                    CRITICAL REQUIREMENTS:
                    1. "listeningPassage": The COMPLETE continuous audio passage / monologue / dialogue that the student will listen to from beginning to end. Put this ONCE at the root level of the JSON response. DO NOT repeat "listeningPassage" or transcript inside individual questions.
                    2. "questions": MUST contain EXACTLY %d questions. Under NO circumstances should you produce fewer questions.
                    3. For each question in "questions":
                       - "prompt": A sentence summarizing or quoting a specific sentence from the passage with ONE crucial keyword replaced by a blank '______' (e.g., "The guest must check in before ______.").
                       - "correctAnswer": The exact missing word or number heard in the listeningPassage.
                       - "explanation": Detailed Vietnamese explanation showing the sentence/context in the listeningPassage that confirms the answer.
                       - "questionType": "FILL_IN_BLANK".
                    Return strictly valid JSON conforming to the schema:
                    {
                      "listeningPassage": "Full continuous spoken audio passage...",
                      "questions": [
                        {
                          "questionType": "FILL_IN_BLANK",
                          "prompt": "Sentence with blank '______'",
                          "correctAnswer": "Exact word",
                          "explanation": "Giải thích chi tiết bằng tiếng Việt dẫn chứng từ bài nghe"
                        }
                      ]
                    }
                    """.formatted(wordCountGuideline.split("\\.")[0], cefr, cefr, wordCountGuideline, count, count);
            } else if (effectiveType.contains("DIALOGUE")) {
                // Dạng 2: Nghe cuộc hội thoại tình huống giao tiếp dài (2 người đối thoại)
                systemInstruction = """
                    You are a Cambridge Listening Author.
                    Create 1 complete, natural multi-turn dialogue between two people (e.g., Student & Advisor, Customer & Clerk, Two Colleagues) for CEFR level %s (%s).
                    The dialogue must have clear speaker turns (Speaker A / Speaker B) and flow continuously like a real IELTS / Cambridge Section 1 or 3 recording.

                    Then generate EXACTLY %d multiple choice comprehension questions based on this dialogue:
                    CRITICAL REQUIREMENTS:
                    1. "listeningPassage": The full multi-turn dialogue with speaker labels (ONLY defined ONCE at the root level). DO NOT repeat the dialogue inside individual questions.
                    2. "questions": MUST contain EXACTLY %d questions. Under NO circumstances should you produce fewer questions.
                    3. For each question in "questions":
                       - "prompt": Clear comprehension question about factual details, speaker intentions, or agreed decisions.
                       - "options": Exactly 4 plausible options (A, B, C, D) with realistic distractors.
                       - "correctAnswer": The exact text of the correct option matching one of the options.
                       - "explanation": Detailed Vietnamese explanation analyzing clues in the dialogue and eliminating traps.
                       - "questionType": "MULTIPLE_CHOICE".
                    Return strictly valid JSON conforming to the schema:
                    {
                      "listeningPassage": "Speaker A: ...\\nSpeaker B: ...\\nSpeaker A: ...",
                      "questions": [
                        {
                          "questionType": "MULTIPLE_CHOICE",
                          "prompt": "Question text",
                          "options": ["A", "B", "C", "D"],
                          "correctAnswer": "Exact correct choice",
                          "explanation": "Giải thích chi tiết bằng tiếng Việt"
                        }
                      ]
                    }
                    """.formatted(cefr, wordCountGuideline, count, count);
            } else {
                // Dạng 3: Nghe cả đoạn bài nghe dài - Trắc nghiệm hiểu ý chính & chi tiết (Multiple Choice)
                systemInstruction = """
                    You are an expert Cambridge and IELTS Listening Examiner.
                    Create 1 complete, coherent English listening audio passage / announcement / report (%s words) for CEFR level %s based on the topic.
                    Vocabulary and sentence complexity must strictly reflect CEFR %s: %s

                    Then generate EXACTLY %d Multiple Choice comprehension questions testing main ideas and specific details throughout the passage.
                    CRITICAL REQUIREMENTS:
                    1. "listeningPassage": The full continuous audio passage (ONLY defined ONCE at the root level). DO NOT repeat the passage inside individual questions.
                    2. "questions": MUST contain EXACTLY %d questions. Under NO circumstances should you produce fewer questions.
                    3. For each question in "questions":
                       - "prompt": Comprehension question regarding facts, timeline, causes, or speaker's view.
                       - "options": 4 plausible choices (A, B, C, D) with subtle listening traps.
                       - "correctAnswer": The exact text of the correct choice.
                       - "explanation": Detailed Vietnamese explanation showing why the answer is correct and why other options are distractors.
                       - "questionType": "MULTIPLE_CHOICE".
                    Return strictly valid JSON conforming to the schema:
                    {
                      "listeningPassage": "Full continuous spoken audio passage...",
                      "questions": [
                        {
                          "questionType": "MULTIPLE_CHOICE",
                          "prompt": "Comprehension question",
                          "options": ["Option A", "Option B", "Option C", "Option D"],
                          "correctAnswer": "Exact correct option",
                          "explanation": "Giải thích chi tiết bằng tiếng Việt dẫn chứng từ bài nghe"
                        }
                      ]
                    }
                    """.formatted(wordCountGuideline.split("\\.")[0], cefr, cefr, wordCountGuideline, count, count);
            }
            userPrompt = String.format("""
                    Listening Sub-Type: %s
                    Target CEFR Level: %s (Vocabulary & sentence complexity guidelines: %s)
                    MANDATORY REQUIREMENT: MUST generate EXACTLY %d questions in the "questions" array.
                    Listening Theme, Notes, or Raw Text:
                    \"\"\"
                    %s
                    \"\"\"
                    NOTE: If the input above contains an existing script or specific questions/test items, format and extract them faithfully. Otherwise, generate an authentic continuous listening passage and EXACTLY %d questions.
                    """, effectiveType, cefr, wordCountGuideline, count, lessonContent, count);

        } else if ("GRAMMAR".equals(effectiveSkill) || effectiveType.startsWith("GRAMMAR")) {
            // ================= NGỮ PHÁP (GRAMMAR) BÁM SÁT CHỦ ĐỀ - KHÔNG CỰC ĐOAN - SÁNG TẠO =================
            // 1. Phân tích và trích xuất chủ đề ngữ pháp trọng tâm được người dùng chỉ định
            String rawTopic = (lessonContent != null) ? lessonContent.trim() : "";
            String targetGrammarTopic = rawTopic;
            if (targetGrammarTopic.contains(":")) {
                String[] parts = targetGrammarTopic.split(":", 2);
                if (parts.length > 1 && !parts[1].trim().isBlank()) {
                    targetGrammarTopic = parts[1].trim();
                }
            }
            // Loại bỏ các tiền tố ký hiệu cấp độ nếu có (ví dụ: "(A1)", "(A2)", "(B1)")
            targetGrammarTopic = targetGrammarTopic.replaceAll("(?i)\\([A-C][1-2]\\)", "").trim();

            boolean hasSpecificTopic = !targetGrammarTopic.isBlank()
                    && !"General English Practice".equalsIgnoreCase(targetGrammarTopic)
                    && !"General Practice".equalsIgnoreCase(targetGrammarTopic);

            if (!hasSpecificTopic) {
                targetGrammarTopic = switch (cefr) {
                    case "A1" -> "Present Simple, Present Continuous, verb To Be, basic prepositions (in, on, at)";
                    case "A2" -> "Past Simple, Future with will / be going to, basic Present Perfect, Comparatives";
                    case "B1", "B2" -> "Conditionals (Type 1 & 2), Passive Voice, Relative Clauses, Modal Verbs";
                    default -> "Inversion, Cleft Sentences, Mixed Conditionals, Advanced Subjunctive";
                };
            }

            // Tạo mã ngẫu nhiên cho mỗi lần gọi để AI không lặp lại câu hỏi cũ
            long nonce = System.currentTimeMillis() % 1000000;
            String randomSeed = "GenSeed-" + nonce;

            if (effectiveType.contains("VERB_CONJUGATION")) {
                // Dạng 1: Chia động từ theo thì & ngữ cảnh (Verb Conjugation)
                systemInstruction = """
                    You are a Senior Cambridge English Grammar Author.
                    Generate %d Verb Conjugation questions strictly focused on the requested Target Grammar Topic: "%s".
                    Target Level: CEFR %s.

                    CORE PEDAGOGICAL REQUIREMENTS:
                    1. 100%% TOPIC ANCHORING: Every question MUST focus on testing the Target Grammar Topic ("%s"). Do NOT wander into unrelated tenses or topics.
                    2. NON-EXTREME & DIVERSE (Không theo hướng cực đoan):
                       - Do NOT use the same subject or rigid formula repeatedly.
                       - Explore various natural facets of this grammar topic (affirmative statements, negative forms with auxiliary verbs, interrogative questions, 3rd person singular -s/-es, irregular forms, stative vs dynamic verbs, habits vs general facts vs schedules).
                    3. HIGH CREATIVITY & ENGAGEMENT:
                       - Frame sentences around rich, diverse, modern scenarios (e.g. marine biology, robotics/AI, astronomy, photography, international cuisine, wildlife, everyday humorous anecdotes).
                       - Each question MUST have a distinct context so every generation run is fresh and unique.
                    4. QUESTION FORMAT:
                       - "prompt": A complete context sentence with a base verb in parentheses to conjugate and a blank '______'. (e.g., "The space telescope (transmit) ______ crystal-clear images of distant galaxies every night.")
                       - "correctAnswer": The exact grammatically correct conjugated verb form (e.g. "transmits").
                       - "explanation": Detailed Vietnamese explanation stating the grammatical formula, subject analysis, signal words, and why this verb form is required.
                       - "questionType": "FILL_IN_BLANK".
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(count, targetGrammarTopic, cefr, targetGrammarTopic);

            } else if (effectiveType.contains("WORD_ARRANGEMENT") || effectiveType.contains("UNSCRAMBLE")) {
                // Dạng 2: Sắp xếp từ thành câu hoàn chỉnh (Word Unscramble)
                systemInstruction = """
                    You are an expert Cambridge English Syntax Specialist.
                    Generate %d Word Arrangement exercises focused on the Target Grammar Topic: "%s".
                    Target Level: CEFR %s.

                    CORE PEDAGOGICAL REQUIREMENTS:
                    1. 100%% TOPIC ANCHORING: The sentences to be assembled MUST showcase the target grammar topic ("%s") and standard English word order.
                    2. NON-EXTREME & DIVERSE: Vary sentence lengths and structures (affirmative, negative, Wh- questions, sentences with frequency adverbs or time markers).
                    3. HIGH CREATIVITY: Interesting real-world contexts (wildlife, music, technology, sports, travel).
                    4. QUESTION FORMAT:
                       - "prompt": The words of the sentence scrambled in random order, separated by slashes '/': "Sắp xếp các từ sau thành câu hoàn chỉnh đúng cấu trúc: word1 / word2 / word3 / word4 / ."
                       - "correctAnswer": The exact, natural English sentence with correct capitalization and punctuation.
                       - "explanation": Clear Vietnamese analysis of the sentence structure (Subject + Adverb/Verb + Object + Time/Place).
                       - "questionType": "FILL_IN_BLANK".
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(count, targetGrammarTopic, cefr, targetGrammarTopic);

            } else if (effectiveType.contains("ERROR_CORRECTION")) {
                // Dạng 3: Tìm và sửa lỗi sai trong câu (Error Identification)
                systemInstruction = """
                    You are a Senior Cambridge Grammar Examiner.
                    Generate %d Error Correction exercises strictly targeting the Grammar Topic: "%s".
                    Target Level: CEFR %s.

                    CORE PEDAGOGICAL REQUIREMENTS:
                    1. 100%% TOPIC ANCHORING: The single grammatical error in each sentence MUST be directly related to the Target Grammar Topic ("%s") (e.g. wrong verb form, incorrect auxiliary verb, subject-verb disagreement, missing -s/-es).
                    2. NON-EXTREME & DIVERSE: Different error types within the topic.
                    3. HIGH CREATIVITY: Varied, lifelike communicative sentences.
                    4. QUESTION FORMAT:
                       - "prompt": "Tìm và sửa 1 lỗi sai ngữ pháp trong câu sau: [Sentence containing exactly ONE error]"
                       - "correctAnswer": The corrected word or phrase.
                       - "explanation": Detailed Vietnamese explanation pinpointing the mistake, explaining why it violates the rule, and providing the correct form.
                       - "questionType": "FILL_IN_BLANK".
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(count, targetGrammarTopic, cefr, targetGrammarTopic);

            } else if (effectiveType.contains("TRANSFORMATION")) {
                // Dạng 4: Viết lại câu giữ nguyên nghĩa (Sentence Transformation)
                systemInstruction = """
                    You are an expert Cambridge English Assessment Author.
                    Generate %d Sentence Transformation questions focused on the Target Grammar Topic: "%s".
                    Target Level: CEFR %s.

                    CORE PEDAGOGICAL REQUIREMENTS:
                    1. 100%% TOPIC ANCHORING: Transformations must test structures related to "%s".
                    2. QUESTION FORMAT:
                       - "prompt": "Viết lại câu sau giữ nguyên nghĩa:\\nOriginal: [Sentence]\\nRewrite: [Beginning of new sentence] ______ [end]."
                       - "correctAnswer": The exact missing phrase that completes the rewritten sentence.
                       - "explanation": Transformation formula and grammatical rule in Vietnamese.
                       - "questionType": "FILL_IN_BLANK".
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(count, targetGrammarTopic, cefr, targetGrammarTopic);

            } else if (effectiveType.contains("FILL") || effectiveType.contains("BLANK") || effectiveType.contains("PREPOSITION") || effectiveType.contains("PRONOUN")) {
                // Dạng 5: Điền vào chỗ trống (Giới từ, đại từ, trợ động từ theo chủ đề)
                systemInstruction = """
                    You are a Senior Cambridge English Author.
                    Generate %d Fill-in-the-Blank grammar questions strictly focusing on the Target Grammar Topic: "%s".
                    Target Level: CEFR %s.

                    CORE PEDAGOGICAL REQUIREMENTS:
                    1. 100%% TOPIC ANCHORING: Every blank '______' tests a key element of the Target Grammar Topic ("%s") (such as prepositions, pronouns, auxiliary verbs, or tense markers).
                    2. NON-EXTREME & DIVERSE: Vary the sentence contexts and grammatical positions tested.
                    3. HIGH CREATIVITY: Imaginative, modern contexts.
                    4. QUESTION FORMAT:
                       - "prompt": Context sentence with a blank '______'.
                       - "correctAnswer": The exact missing word or short phrase.
                       - "explanation": Detailed rule explanation in Vietnamese.
                       - "questionType": "FILL_IN_BLANK".
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(count, targetGrammarTopic, cefr, targetGrammarTopic);

            } else if (effectiveType.contains("MULTIPLE_CHOICE")) {
                // Dạng 6: Trắc nghiệm quy tắc & cấu trúc ngữ pháp
                systemInstruction = """
                    You are a Senior English Grammar Author.
                    Generate %d Multiple Choice grammar questions strictly testing the Target Grammar Topic: "%s".
                    Target Level: CEFR %s.

                    CORE PEDAGOGICAL REQUIREMENTS:
                    1. 100%% TOPIC ANCHORING: 100%% of questions MUST test rules and applications of the Target Grammar Topic ("%s"). Distractors must be realistic learner traps directly related to this topic.
                    2. NON-EXTREME & DIVERSE: Test varied angles: affirmative/negative/questions, regular vs irregular cases, signal adverbs, subject-verb agreement, common pitfalls.
                    3. HIGH CREATIVITY: Vivid real-world scenarios across science, hobbies, everyday life, and technology.
                    4. QUESTION FORMAT:
                       - "prompt": Sentence with a blank '______' testing the grammar point.
                       - "options": Exactly 4 plausible choices [A, B, C, D].
                       - "correctAnswer": The exact text of the correct choice.
                       - "explanation": Clear grammatical analysis in Vietnamese explaining why the correct choice fits and eliminating distractors.
                       - "questionType": "MULTIPLE_CHOICE".
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(count, targetGrammarTopic, cefr, targetGrammarTopic);

            } else {
                // Dạng tổng hợp / hỗn hợp ngữ pháp
                systemInstruction = """
                    You are a Senior English Grammar Author.
                    Generate %d diverse grammar questions for CEFR %s focusing on the Target Grammar Topic: "%s".
                    Ensure a lively variety of questions (Verb Conjugation, Word Arrangement, Fill-in-the-blank, and Multiple Choice).
                    All questions must strictly reflect "%s" in engaging, non-repetitive contexts.
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(count, cefr, targetGrammarTopic, targetGrammarTopic);
            }

            userPrompt = String.format("""
                    Grammar Sub-Format: %s
                    Target CEFR Level: %s
                    Number of Questions: %d
                    TARGET GRAMMAR TOPIC (MANDATORY FOCUS): "%s"
                    Original Input: "%s"
                    Random Variation Nonce: %s

                    SPECIAL INSTRUCTIONS:
                    - Ensure ALL %d questions strictly test "%s".
                    - Be creative with the situations, professions, settings, and subjects so that this generation run is distinct, fresh, and engaging without repeating common cliches.
                    - Cover the topic comprehensively from multiple angles (affirmative, negative, questions, regular/irregular forms, frequency adverbs, stative verbs, general facts vs habits).
                    """, effectiveType, cefr, count, targetGrammarTopic, rawTopic, randomSeed, count, targetGrammarTopic);

        } else if ("READING".equals(effectiveSkill) || effectiveType.startsWith("READING")) {
            // ================= KỸ NĂNG ĐỌC (READING) THEO TỪNG DẠNG BÀI =================
            if (effectiveType.contains("FILL_BLANK") || effectiveType.contains("SHORT_ANSWER")) {
                // Dạng 1: Đọc hiểu điền từ theo dữ kiện / Trả lời câu hỏi ngắn
                systemInstruction = """
                    You are a Cambridge CEFR Reading Examiner.
                    Create an appropriate Reading Passage (%s words) for level %s based on the topic.
                    Generate %d questions where students must extract direct factual information or complete short answers:
                    - "readingPassage": The full reading text.
                    - "prompt": Factual question or sentence completion (e.g. "Where does Anna work?" or "Anna moved to London in ______.").
                    - "correctAnswer": Exact factual answer from the text.
                    - "explanation": Vietnamese explanation citing the exact sentence from the text.
                    - "questionType": "FILL_IN_BLANK".
                    ALL %d questions MUST be Fill In Blank / Short Answer!
                    Return strictly valid JSON with "readingPassage" and "questions" array.
                    """.formatted("A1".equalsIgnoreCase(cefr) || "A2".equalsIgnoreCase(cefr) ? "120-180" : "350-500", cefr, count, count);

            } else if (effectiveType.contains("TRUE_FALSE")) {
                // Dạng 2: Đọc hiểu True / False / Not Given
                systemInstruction = """
                    You are an IELTS & Cambridge Reading Examiner.
                    Create a Reading Passage (%s words) for level %s based on the topic.
                    Generate %d statements for TRUE / FALSE / NOT GIVEN assessment:
                    - "readingPassage": The full reading text.
                    - "prompt": The statement to evaluate.
                    - "correctAnswer": Exactly "TRUE", "FALSE", or "NOT GIVEN".
                    - "explanation": Clear Vietnamese explanation contrasting statement against passage facts.
                    - "questionType": "TRUE_FALSE".
                    ALL %d questions MUST be True/False/Not Given!
                    Return strictly valid JSON with "readingPassage" and "questions" array.
                    """.formatted("A1".equalsIgnoreCase(cefr) || "A2".equalsIgnoreCase(cefr) ? "120-180" : "400-550", cefr, count, count);

            } else if (effectiveType.contains("PARAPHRASE")) {
                // Dạng 3: Nhận diện Paraphrasing & Suy luận học thuật
                systemInstruction = """
                    You are an expert IELTS Academic Reading Examiner.
                    Create an Academic Reading Passage (400-550 words) for level %s.
                    Generate %d Multiple Choice questions specifically testing PARAPHRASING and INFERENCE (do not copy raw sentences from passage).
                    - "readingPassage": Full academic text.
                    - "prompt": Question testing synonym matching or underlying inference.
                    - "options": 4 plausible choices with trap distractors.
                    - "correctAnswer": Correct choice.
                    - "explanation": Vietnamese explanation highlighting synonym pairs and trap elimination.
                    - "questionType": "MULTIPLE_CHOICE".
                    Return strictly valid JSON with "readingPassage" and "questions" array.
                    """.formatted(cefr, count);

            } else {
                // Dạng 4: Trắc nghiệm đọc hiểu chi tiết & ý chính (hoặc Tổng hợp)
                systemInstruction = """
                    You are an expert Cambridge and IELTS Reading Examiner.
                    Create an engaging Reading Passage (%s words) for level %s based on the topic.
                    Generate %d Multiple Choice comprehension questions testing main idea, specific details, and author attitude.
                    - "readingPassage": The reading text.
                    - "prompt": Comprehension question.
                    - "options": 4 plausible choices.
                    - "correctAnswer": Exact correct option.
                    - "explanation": Vietnamese explanation referencing the passage.
                    - "questionType": "MULTIPLE_CHOICE".
                    Return strictly valid JSON with "readingPassage" and "questions" array.
                    """.formatted("A1".equalsIgnoreCase(cefr) || "A2".equalsIgnoreCase(cefr) ? "120-180" : "400-550", cefr, count);
            }
            userPrompt = String.format("""
                    Reading Sub-Format: %s
                    Target CEFR Level: %s
                    Number of Reading Questions: %d
                    Passage Topic:
                    "%s"
                    """, effectiveType, cefr, count, lessonContent);

        } else if ("VOCABULARY".equals(effectiveSkill) || effectiveType.startsWith("VOCAB") || effectiveType.startsWith("VOCABULARY")) {
            // ================= TỪ VỰNG (VOCABULARY) THEO 8 DẠNG BÀI CHUẨN =================
            if (effectiveType.contains("LISTEN_CHOOSE") || (effectiveType.contains("LISTEN") && effectiveType.contains("WORD"))) {
                // Dạng 1: Nghe & Chọn từ (Listen & Choose Word)
                systemInstruction = """
                    You are a Cambridge Phonetics and Vocabulary Examiner.
                    Generate %d Listen & Choose Word exercises suitable for CEFR level %s.
                    CRITICAL REQUIREMENT:
                    Each item presents an audio listening test for a key English vocabulary word.
                    - "targetWord": The exact English vocabulary word to listen to (e.g. "environment").
                    - "ipa": Accurate IPA pronunciation with slashes (e.g. "/ɪnˈvaɪrənmənt/").
                    - "prompt": "[LISTEN_WORD] Nghe phát âm và chọn từ tiếng Anh chính xác bạn nghe được."
                    - "options": 4 phonetically distinct or common minimal-pair English words (e.g. ["environment", "entertainment", "development", "improvement"]).
                    - "correctAnswer": The exact spoken target word matching one of the options (e.g. "environment").
                    - "explanation": "Phiên âm IPA: /ɪnˈvaɪrənmənt/, nghĩa: môi trường. Giải thích ngữ nghĩa và trọng âm bằng tiếng Việt."
                    - "questionType": "MULTIPLE_CHOICE"
                    Return strictly valid JSON conforming to the schema:
                    {
                      "questions": [
                        {
                          "questionType": "MULTIPLE_CHOICE",
                          "targetWord": "environment",
                          "ipa": "/ɪnˈvaɪrənmənt/",
                          "prompt": "[LISTEN_WORD] Nghe phát âm và chọn từ tiếng Anh chính xác bạn nghe được.",
                          "options": ["environment", "entertainment", "development", "improvement"],
                          "correctAnswer": "environment",
                          "explanation": "Phiên âm IPA: /ɪnˈvaɪrənmənt/, nghĩa: môi trường."
                        }
                      ]
                    }
                    ALL %d questions MUST be purely Listen & Choose Word!
                    """.formatted(count, cefr, count);

            } else if (effectiveType.contains("DICTATION") || effectiveType.contains("SPELL")) {
                // Dạng 2: Nghe chính tả điền từ (Listen & Type Word / Dictation)
                systemInstruction = """
                    You are a Cambridge Phonetics and Spelling Specialist.
                    Generate %d Vocabulary Spelling and Dictation exercises for CEFR level %s.
                    CRITICAL REQUIREMENT:
                    Each item tests spelling of high-frequency target words with phonetic clue, definition, and context sentence with blank '______'.
                    - "targetWord": The exact English vocabulary word to be listened and spelled (e.g. "environment").
                    - "ipa": Accurate IPA pronunciation with slashes (e.g. "/ɪnˈvaɪrənmənt/").
                    - "prompt": "[LISTEN_SPELL] Nghe phát âm và nhập chính xác từ vào chỗ trống: /ɪnˈvaɪrənmənt/ (The natural world): We must protect our ______."
                    - "correctAnswer": Exact target word spelled correctly (e.g. "environment").
                    - "explanation": "Phiên âm IPA: /ɪnˈvaɪrənmənt/, nghĩa: môi trường, các lưu ý chính tả."
                    - "questionType": "FILL_IN_BLANK"
                    Return strictly valid JSON conforming to the schema:
                    {
                      "questions": [
                        {
                          "questionType": "FILL_IN_BLANK",
                          "targetWord": "environment",
                          "ipa": "/ɪnˈvaɪrənmənt/",
                          "prompt": "[LISTEN_SPELL] Nghe phát âm và nhập chính xác từ: /ɪnˈvaɪrənmənt/ (The natural world): We must protect our ______.",
                          "correctAnswer": "environment",
                          "explanation": "Phiên âm IPA: /ɪnˈvaɪrənmənt/, nghĩa: môi trường."
                        }
                      ]
                    }
                    ALL %d questions MUST be Spelling/Dictation!
                    """.formatted(count, cefr, count);

            } else if (effectiveType.contains("MEANING_TO_WORD") || effectiveType.contains("DEFINITION")) {
                // Dạng 3: Định nghĩa -> Từ (Definition / Meaning to Word)
                systemInstruction = """
                    You are a Cambridge Vocabulary Author.
                    Generate %d Definition-to-Word exercises for CEFR level %s.
                    CRITICAL REQUIREMENT:
                    Each item presents an English definition with context sentence and first-letter clue.
                    - "targetWord": Target English word (e.g. "psychology").
                    - "ipa": Accurate IPA pronunciation with slashes (e.g. "/saɪˈkɒlədʒi/").
                    - "prompt": "Đọc định nghĩa và nhập từ vựng tiếng Anh phù hợp (Gợi ý: p______):\\nThe scientific study of the human mind and behavior: ______"
                    - "correctAnswer": Target English word (e.g. "psychology").
                    - "explanation": "Từ vựng: psychology (noun) - tâm lý học."
                    - "questionType": "FILL_IN_BLANK"
                    Return strictly valid JSON conforming to the schema:
                    {
                      "questions": [
                        {
                          "questionType": "FILL_IN_BLANK",
                          "targetWord": "psychology",
                          "ipa": "/saɪˈkɒlədʒi/",
                          "prompt": "Đọc định nghĩa và nhập từ vựng tiếng Anh (Gợi ý: p______):\\nThe scientific study of the human mind and behavior: ______",
                          "correctAnswer": "psychology",
                          "explanation": "Từ vựng: psychology (noun) - tâm lý học."
                        }
                      ]
                    }
                    ALL %d questions MUST be Definition-to-Word!
                    """.formatted(count, cefr, count);

            } else if (effectiveType.contains("WORD_FORM") || effectiveType.contains("FORM_IN_CONTEXT")) {
                // Dạng 4: Dạng từ trong câu (Word Form in Context)
                systemInstruction = """
                    You are a Cambridge Lexicology Specialist.
                    Generate %d Word Form exercises for CEFR level %s.
                    CRITICAL REQUIREMENT:
                    Each item presents a context sentence with a base word in parentheses. The student writes the correct derived form (Noun/Verb/Adjective/Adverb) in the blank '______'.
                    - "targetWord": The derived answer word (e.g. "decision").
                    - "ipa": Accurate IPA pronunciation with slashes (e.g. "/dɪˈsɪʒn/").
                    - "prompt": "Cho dạng đúng của từ trong ngoặc để hoàn thành câu:\\nHer quick (decide) ______ saved the patient's life."
                    - "correctAnswer": "decision"
                    - "explanation": "Sau tính từ sở hữu 'Her' và tính từ 'quick' cần một Danh từ (decision - quyết định)."
                    - "questionType": "FILL_IN_BLANK"
                    Return strictly valid JSON conforming to the schema:
                    {
                      "questions": [
                        {
                          "questionType": "FILL_IN_BLANK",
                          "targetWord": "decision",
                          "ipa": "/dɪˈsɪʒn/",
                          "prompt": "Cho dạng đúng của từ trong ngoặc: Her quick (decide) ______ saved the patient's life.",
                          "correctAnswer": "decision",
                          "explanation": "Quy tắc ngữ pháp từ loại và nghĩa tiếng Việt"
                        }
                      ]
                    }
                    ALL %d questions MUST be purely Word Form!
                    """.formatted(count, cefr, count);

            } else if (effectiveType.contains("MATCHING") || effectiveType.contains("MATCH")) {
                // Dạng 5: Nối từ với nghĩa (Word-Definition Matching)
                systemInstruction = """
                    You are a Cambridge Lexicographer.
                    Generate %d Word-Definition Matching questions for CEFR level %s.
                    CRITICAL REQUIREMENT:
                    Each question provides a target vocabulary word and asks the student to choose the most accurate definition among 4 choices.
                    - "targetWord": The vocabulary word being tested (e.g. "resilient").
                    - "ipa": Accurate IPA pronunciation with slashes (e.g. "/rɪˈzɪliənt/").
                    - "prompt": "Nối từ với nghĩa phù hợp: Định nghĩa chính xác nhất của từ '[TARGET WORD]' là gì?"
                    - "options": 4 clear definitions in English.
                    - "correctAnswer": The exact correct definition matching one of the options.
                    - "explanation": "Giải thích chi tiết nghĩa, từ loại, ngữ cảnh sử dụng và ví dụ."
                    - "questionType": "MULTIPLE_CHOICE"
                    Return strictly valid JSON conforming to the schema:
                    {
                      "questions": [
                        {
                          "questionType": "MULTIPLE_CHOICE",
                          "targetWord": "resilient",
                          "ipa": "/rɪˈzɪliənt/",
                          "prompt": "Nối từ với nghĩa phù hợp: Định nghĩa chính xác nhất của từ 'resilient' là gì?",
                          "options": [
                            "Able to recover quickly from difficult conditions",
                            "Showing great fear or hesitation",
                            "Happening once every hundred years",
                            "Difficult to understand or explain"
                          ],
                          "correctAnswer": "Able to recover quickly from difficult conditions",
                          "explanation": "'resilient' (adj): có khả năng hồi phục nhanh, kiên cường."
                        }
                      ]
                    }
                    ALL %d questions MUST be Matching!
                    """.formatted(count, cefr, count);

            } else if (effectiveType.contains("SYNONYM_ANTONYM") || effectiveType.contains("SYNONYM") || effectiveType.contains("ANTONYM")) {
                // Dạng 6: Từ đồng nghĩa & Trái nghĩa (Synonyms / Antonyms)
                systemInstruction = """
                    You are an IELTS Vocabulary Specialist.
                    Generate %d Synonym / Antonym questions for CEFR level %s.
                    CRITICAL REQUIREMENT:
                    Each question tests identifying either CLOSEST in meaning or OPPOSITE in meaning to an underlined word in context.
                    - "targetWord": The underlined target word or the correct synonym (e.g. "hesitant" or "reluctant").
                    - "ipa": Accurate IPA pronunciation with slashes (e.g. "/ˈhezɪtənt/").
                    - "prompt": "Choose the word CLOSEST in meaning to the underlined word in: 'She was hesitant to accept the offer.'"
                    - "options": 4 choices
                    - "correctAnswer": Exact correct choice.
                    Return strictly valid JSON conforming to the schema:
                    {
                      "questions": [
                        {
                          "questionType": "MULTIPLE_CHOICE",
                          "targetWord": "hesitant",
                          "ipa": "/ˈhezɪtənt/",
                          "prompt": "Choose the word CLOSEST in meaning to the underlined word in: 'She was hesitant to accept the offer.'",
                          "options": ["reluctant", "enthusiastic", "confident", "curious"],
                          "correctAnswer": "reluctant",
                          "explanation": "'hesitant' và 'reluctant' đều mang nghĩa ngập ngừng, lưỡng lự."
                        }
                      ]
                    }
                    ALL %d questions MUST be Synonyms/Antonyms!
                    """.formatted(count, cefr, count);

            } else if (effectiveType.contains("COLLOCATION")) {
                // Dạng 7: Collocations (make/do/take/have...)
                systemInstruction = """
                    You are a Senior English Lexicographer.
                    Generate %d Collocation questions for CEFR level %s focusing on high-frequency natural word partnerships (e.g. make/do/take/have/pay/give).
                    CRITICAL REQUIREMENT:
                    Every question MUST have 4 plausible choices in "options" array.
                    - "targetWord": The key collocation partner (e.g. "favor" or "do").
                    - "ipa": Accurate IPA pronunciation with slashes (e.g. "/ˈfeɪvər/").
                    - "prompt": Incomplete sentence.
                    Return strictly valid JSON conforming to the schema:
                    {
                      "questions": [
                        {
                          "questionType": "MULTIPLE_CHOICE",
                          "targetWord": "favor",
                          "ipa": "/ˈfeɪvər/",
                          "prompt": "Could you ______ me a favor and carry this box?",
                          "options": ["do", "make", "take", "give"],
                          "correctAnswer": "do",
                          "explanation": "Cụm từ cố định: 'do someone a favor' có nghĩa là giúp đỡ ai một việc."
                        }
                      ]
                    }
                    ALL %d questions MUST be Collocations!
                    """.formatted(count, cefr, count);

            } else if (effectiveType.contains("WORD_FAMILY") || effectiveType.contains("FAMILY")) {
                // Dạng 8: Họ từ (Word Family Transformation)
                systemInstruction = """
                    You are a Cambridge Word Family Specialist.
                    Generate %d Word Family exercises for CEFR level %s.
                    CRITICAL REQUIREMENT:
                    Each item presents a root word and asks the student to derive the correct member of the word family (Noun, Verb, Adjective, or Adverb) in an authentic sentence.
                    - "targetWord": The derived answer word (e.g. "competition").
                    - "ipa": Accurate IPA pronunciation with slashes (e.g. "/ˌkɒmpəˈtɪʃn/").
                    - "prompt": "Họ từ của 'COMPETE': Điền từ loại phù hợp vào chỗ trống:\\nThere is intense ______ between the two technology companies."
                    - "correctAnswer": "competition"
                    - "explanation": "Bảng họ từ: compete (v), competition (n), competitive (adj), competitively (adv). Sau tính từ 'intense' cần Danh từ."
                    - "questionType": "FILL_IN_BLANK"
                    Return strictly valid JSON conforming to the schema:
                    {
                      "questions": [
                        {
                          "questionType": "FILL_IN_BLANK",
                          "targetWord": "competition",
                          "ipa": "/ˌkɒmpəˈtɪʃn/",
                          "prompt": "Họ từ của 'COMPETE': Điền từ loại phù hợp vào câu: There is intense ______ between the two companies.",
                          "correctAnswer": "competition",
                          "explanation": "Bảng họ từ: compete (v), competition (n), competitive (adj), competitively (adv)."
                        }
                      ]
                    }
                    ALL %d questions MUST be Word Family!
                    """.formatted(count, cefr, count);

            } else {
                // Dạng tổng hợp từ vựng
                systemInstruction = """
                    You are a Cambridge Vocabulary Specialist.
                    Generate %d comprehensive vocabulary questions for CEFR level %s covering Word Form, Collocations, Definitions, and Synonyms.
                    CRITICAL REQUIREMENT:
                    Return strictly valid JSON conforming to the schema.
                    For multiple choice questions, provide exactly 4 options in "options" array.
                    For word form or definition gap-fills, set "questionType" to "FILL_IN_BLANK".
                    Schema:
                    {
                      "questions": [
                        {
                          "questionType": "MULTIPLE_CHOICE",
                          "targetWord": "contribution",
                          "ipa": "/ˌkɒntrɪˈbjuːʃn/",
                          "prompt": "Choose the word that best completes the sentence: 'She made a major ______ to the research project.'",
                          "options": ["contribution", "contribute", "contributive", "contributor"],
                          "correctAnswer": "contribution",
                          "explanation": "Sau tính từ 'major' cần một danh từ. 'contribution' có nghĩa là sự đóng góp."
                        }
                      ]
                    }
                    """.formatted(count, cefr);
            }
            userPrompt = String.format("""
                    Vocabulary Sub-Format: %s
                    Target CEFR Level: %s
                    Number of Vocabulary Questions: %d
                    Vocabulary Theme:
                    "%s"
                    """, effectiveType, cefr, count, lessonContent);

        } else if ("WRITING".equals(effectiveSkill) || effectiveType.startsWith("WRITING")) {
            // ================= KỸ NĂNG VIẾT (WRITING) THEO TỪNG DẠNG BÀI =================
            if (effectiveType.contains("WORD_ARRANGEMENT") || effectiveType.contains("UNSCRAMBLE") || effectiveType.contains("WORD_ORDER")) {
                // Dạng 1: Sắp xếp từ thành câu hoàn chỉnh (Word Order)
                systemInstruction = """
                    You are a Cambridge Assessment English Specialist for CEFR level %s.
                    Generate %d word-order arrangement (scrambled sentence) exercises:
                    For each question:
                    - "prompt": The words of a natural English sentence scrambled in random order, separated by slashes ' / ' with clear instruction in Vietnamese.
                      Example: "Sắp xếp các từ sau thành câu hoàn chỉnh đúng ngữ pháp: always / to school / by bus / She / goes"
                    - "correctAnswer": The exact grammatically correct full sentence with proper capitalization and punctuation (e.g., "She always goes to school by bus.").
                    - "explanation": Clear grammar explanation in Vietnamese explaining standard English word order (Subject + Adverb + Verb + Object/Prepositional phrase).
                    - "questionType": "FILL_IN_BLANK".
                    - "options": []
                    CRITICAL RULES:
                    - Do NOT generate essay topics or long writing prompts.
                    - Each question tests assembling a single sentence.
                    - "questionType" MUST be strictly "FILL_IN_BLANK".
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(cefr, count);
            } else if (effectiveType.contains("KEYWORD")) {
                // Dạng 2: Viết câu từ từ khóa (Keyword-to-Sentence)
                systemInstruction = """
                    You are a Cambridge Writing Specialist for CEFR level %s.
                    Generate %d keyword-to-sentence writing exercises:
                    For each question:
                    - "prompt": A set of cue words in parentheses or slashes with clear instructions in Vietnamese.
                      Example: "Sử dụng các từ gợi ý sau để viết một câu hoàn chỉnh đúng ngữ pháp: (they / decide / travel / Japan / next month)"
                    - "correctAnswer": The natural, grammatically correct full sentence (e.g., "They decided to travel to Japan next month.").
                    - "explanation": Grammar explanation in Vietnamese explaining tense, auxiliary verbs, and prepositions used.
                    - "questionType": "FILL_IN_BLANK".
                    - "options": []
                    CRITICAL RULES:
                    - "questionType" MUST be strictly "FILL_IN_BLANK".
                    - Do NOT generate essay prompts.
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(cefr, count);
            } else if (effectiveType.contains("SENTENCE")) {
                // Dạng 3: Hoàn thành câu ngắn (Sentence Completion / Transformation)
                systemInstruction = """
                    You are a Cambridge Writing Specialist for CEFR level %s.
                    Generate %d sentence completion / transformation exercises:
                    For each question:
                    - "prompt": An incomplete sentence with a blank '______' or a prompt to complete/rewrite the sentence with clear instruction in Vietnamese.
                      Example: "Hoàn thành câu sau bằng cách điền mệnh đề thích hợp: Although it was raining heavily, ____________________."
                    - "correctAnswer": A natural, grammatically correct completed sentence or clause (e.g., "they continued their football match outdoors.").
                    - "explanation": Explanation in Vietnamese detailing the grammatical rule (e.g., concessive clauses with Although/Even though).
                    - "questionType": "FILL_IN_BLANK".
                    - "options": []
                    CRITICAL RULES:
                    - "questionType" MUST be strictly "FILL_IN_BLANK".
                    - Do NOT generate multi-paragraph essay prompts.
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(cefr, count);
            } else if (effectiveType.contains("TASK_1") || effectiveType.contains("TASK1")) {
                // Dạng 4: IELTS Writing Task 1 (150 từ - Báo cáo biểu đồ)
                systemInstruction = """
                    You are an official IELTS Academic Writing Task 1 Senior Examiner.
                    Generate %d authentic IELTS Writing Task 1 prompts based on visual data (Bar Chart, Line Graph, Pie Chart, Table, or Process Diagram):
                    - "prompt": Full authentic IELTS Academic Task 1 question. Include visual chart descriptions, data trends, figures, time periods, and the official instruction: "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words."
                    - "explanation": Recommended 4-paragraph structure (Introduction, Overview, Body 1, Body 2), key data-comparison vocabulary, and model grouping in Vietnamese.
                    - "correctAnswer": Band 8.5+ model response with clear Overview and detailed data paragraphs.
                    - "questionType": "ESSAY".
                    CRITICAL RULES:
                    - NEVER generate fill-in-the-blanks with '___' or single sentences!
                    - This is a full IELTS Academic Task 1 report requiring at least 150 words.
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(count);
            } else if (effectiveType.contains("TASK_2") || effectiveType.contains("TASK2")) {
                // Dạng 5: IELTS Writing Task 2 (250 từ - Nghị luận xã hội)
                systemInstruction = """
                    You are an official IELTS Writing Task 2 Senior Examiner.
                    Generate %d authentic IELTS Writing Task 2 essay prompts on academic or societal themes:
                    - "prompt": Full authentic IELTS Task 2 prompt with a controversial statement or opposing viewpoints, followed by the essay question (e.g. "To what extent do you agree or disagree?", "Discuss both views and give your opinion", or "What problems does this cause and what solutions can be taken?"). Conclude with: "Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words."
                    - "explanation": 5-step scaffolding guide in Vietnamese: 1. Phân tích đề bài, 2. Brainstorming 2 chiều, 3. Dàn ý 4 đoạn (Intro, Body 1, Body 2, Conclusion), 4. Từ vựng & Collocations học thuật C1, 5. Tiêu chuẩn 4 tiêu chí chấm (TR, CC, LR, GRA).
                    - "correctAnswer": Band 8.5+ model essay with thesis statement and well-developed arguments.
                    - "questionType": "ESSAY".
                    CRITICAL RULES:
                    - NEVER generate fill-in-the-blanks with '___' or single incomplete sentences!
                    - This is an authentic 250-word academic IELTS essay.
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(count);
            } else {
                // Dạng 6: Viết đoạn văn (Guided Paragraph / Opinion / Adv-Disadv / Cause-Effect / Problem-Solution)
                int minWords = "A1".equalsIgnoreCase(cefr) || "A2".equalsIgnoreCase(cefr) ? 40 : 100;
                int maxWords = "A1".equalsIgnoreCase(cefr) || "A2".equalsIgnoreCase(cefr) ? 80 : 150;
                String formatDesc = effectiveType.contains("OPINION") ? "Opinion Paragraph (Nêu quan điểm cá nhân)"
                        : effectiveType.contains("ADV_DISADV") ? "Advantages & Disadvantages Paragraph (Lợi ích và Bất lợi)"
                        : effectiveType.contains("CAUSE_EFFECT") ? "Cause & Effect Paragraph (Nguyên nhân và Hệ quả)"
                        : effectiveType.contains("PROBLEM_SOLUTION") ? "Problem & Solution Paragraph (Thực trạng và Giải pháp)"
                        : "Guided Paragraph (Viết một đoạn văn hoàn chỉnh theo gợi ý)";

                systemInstruction = """
                    You are an expert Cambridge Writing Instructor for CEFR %s.
                    Generate %d %s writing prompts:
                    - "prompt": A clear, engaging prompt asking the learner to write ONE single cohesive paragraph (%d–%d words). Provide 2-3 guiding questions or bullet points to help structure their ideas (1. Topic sentence, 2. Supporting details & examples, 3. Concluding sentence). Explicitly state: "Viết 01 đoạn văn hoàn chỉnh (%d–%d từ) về chủ đề trên."
                    - "explanation": Cohesion guidance in Vietnamese: Topic sentence formulation, 2-3 supporting arguments, concluding sentence, and a list of useful linking words (e.g. Firstly, In addition, However, For instance, Therefore, In conclusion).
                    - "correctAnswer": High-scoring model single paragraph (%d–%d words) demonstrating good cohesion and appropriate CEFR %s vocabulary.
                    - "questionType": "ESSAY".
                    CRITICAL RULES:
                    - The task is for a SINGLE PARAGRAPH (%d–%d words), NOT a multi-paragraph IELTS essay.
                    - NEVER generate fill-in-the-blanks '___' or single sentence tasks.
                    Return strictly valid JSON with an array 'questions'.
                    """.formatted(cefr, count, formatDesc, minWords, maxWords, minWords, maxWords, minWords, maxWords, cefr, minWords, maxWords);
            }
            userPrompt = String.format("""
                    Writing Sub-Format: %s
                    Target CEFR Level: %s
                    Number of Writing Topics: %d
                    Writing Theme:
                    "%s"
                    """, effectiveType, cefr, count, lessonContent);

        } else {
            // FALLBACK GENERAL MULTIPLE_CHOICE
            systemInstruction = """
                    You are an expert English Curriculum Specialist creating rigorous assessment materials based on CEFR benchmarks.
                    Generate multiple-choice questions suitable for CEFR level %s.
                    Each question must have exactly 4 plausible options (A, B, C, D) and exactly ONE correct answer.
                    Explanations must be pedagogical, clear, and in Vietnamese.
                    Return strictly valid JSON with an array of questions under key 'questions'.
                    """.formatted(cefr);

            userPrompt = String.format("""
                    Exercise Skill Type: %s
                    Target CEFR: %s
                    Number of Questions: %d
                    Lesson Material or Topic:
                    "%s"
                    """, effectiveType, cefr, count, lessonContent);
        }

        // Tiêm quy tắc bắt buộc để AI tuân thủ tuyệt đối kỹ năng và cấp độ CEFR
        String mandatorySkillGuard = String.format("""
            [QUY TẮC BẮT BUỘC VỀ KỸ NĂNG VÀ ĐỊNH DẠNG]:
            - Bạn PHẢI sinh nội dung bài tập 100%% hoàn toàn thuộc kỹ năng %s với định dạng %s ở cấp độ CEFR %s.
            - TUYỆT ĐỐI CẤM sinh bài tập thuộc kỹ năng khác (Ví dụ: Nếu kỹ năng là %s, CẤM sinh bài đọc hiểu READING PASSAGE hay kỹ năng khác).
            - Toàn bộ câu hỏi, phương án, đáp án và lời giải thích PHẢI phục vụ chuẩn xác cho kỹ năng %s.
            """, effectiveSkill, effectiveType, cefr, effectiveSkill, effectiveSkill);
        systemInstruction = mandatorySkillGuard + "\n" + systemInstruction;

        AiGeneratedExercise exercise = AiGeneratedExercise.builder()
                .lesson(lesson)
                .teacher(teacher)
                .targetCefr(cefr)
                .exerciseType(effectiveType)
                .questionCount(count)
                .rawResponseJson("{}")
                .status(GenerationStatus.PENDING_GENERATION)
                .build();
        aiGeneratedExerciseRepository.save(exercise);

        String rawJson = null;
        Exception lastError = null;

        // 1. Thử gọi Groq LLaMA 3.3 tốc độ cao (nhiệt độ 0.3 tuân thủ nghiêm ngặt kỹ năng và cấu trúc JSON)
        try {
            rawJson = groqClientService.chatCompletionJson(systemInstruction, userPrompt, 0.3, teacherId, true);
        } catch (Exception e) {
            log.warn("Groq quiz generation failed: {}, attempting Gemini fallback...", e.getMessage());
            lastError = e;
        }

        // 2. Dự phòng sang Gemini nếu Groq thất bại (nhiệt độ 0.3)
        if (rawJson == null || rawJson.isBlank() || rawJson.trim().equals("{}")) {
            try {
                rawJson = geminiClientService.generateWithSystemInstruction(systemInstruction, userPrompt, 0.3, teacherId, true);
            } catch (Exception e) {
                log.error("Gemini quiz generation also failed: {}", e.getMessage());
                if (lastError == null) {
                    lastError = e;
                } else {
                    lastError = new RuntimeException("Groq: " + lastError.getMessage() + " | Gemini: " + e.getMessage(), e);
                }
            }
        }

        // 3. Làm sạch chuỗi JSON nếu có markdown code fencing
        if (rawJson != null) {
            rawJson = rawJson.trim();
            if (rawJson.startsWith("```json")) {
                rawJson = rawJson.substring(7);
            } else if (rawJson.startsWith("```")) {
                rawJson = rawJson.substring(3);
            }
            if (rawJson.endsWith("```")) {
                rawJson = rawJson.substring(0, rawJson.length() - 3);
            }
            rawJson = rawJson.trim();
        }

        // 4. Kiểm tra cấu trúc JSON hợp lệ và có câu hỏi
        boolean isValid = false;
        if (rawJson != null && !rawJson.isBlank() && !rawJson.trim().equals("{}")) {
            try {
                JsonNode root = objectMapper.readTree(rawJson);
                if (root.has("questions") && root.get("questions").isArray() && root.get("questions").size() > 0) {
                    isValid = true;
                }
            } catch (Exception e) {
                log.error("Failed to parse AI JSON response: {}", e.getMessage());
                lastError = e;
            }
        }

        // 5. Nếu không hợp lệ: cập nhật trạng thái REJECTED và BÁO LỖI (KHÔNG MOCK)
        if (!isValid) {
            exercise.setStatus(GenerationStatus.REJECTED);
            aiGeneratedExerciseRepository.save(exercise);
            String reason = lastError != null ? lastError.getMessage() : "Mô hình AI không phản hồi danh sách câu hỏi hợp lệ.";
            throw new BadRequestException("Không thể tạo bài tập từ AI: " + reason);
        }

        // 5.1. Dọn dẹp dữ liệu chéo kỹ năng: Nếu là GRAMMAR hoặc VOCABULARY, loại bỏ triệt để readingPassage nếu AI lỡ sinh kèm
        if ("GRAMMAR".equals(effectiveSkill) || "VOCABULARY".equals(effectiveSkill)) {
            try {
                JsonNode root = objectMapper.readTree(rawJson);
                if (root.isObject()) {
                    com.fasterxml.jackson.databind.node.ObjectNode rootObj = (com.fasterxml.jackson.databind.node.ObjectNode) root;
                    if (rootObj.has("readingPassage")) {
                        rootObj.remove("readingPassage");
                        rawJson = objectMapper.writeValueAsString(rootObj);
                    }
                }
            } catch (Exception ignored) {}
        }

        // 6. Tự động xử lý Audio: CHỈ cho VOCABULARY (nghe từ vựng) và LISTENING (nghe cả đoạn/câu)
        if (effectiveType.startsWith("VOCAB") || effectiveType.startsWith("VOCABULARY")) {
            try {
                JsonNode root = objectMapper.readTree(rawJson);
                JsonNode questionsNode = root.get("questions");
                if (questionsNode != null && questionsNode.isArray()) {
                    boolean hasEnriched = false;
                    for (JsonNode qItem : questionsNode) {
                        if (qItem.isObject()) {
                            com.fasterxml.jackson.databind.node.ObjectNode qObj = (com.fasterxml.jackson.databind.node.ObjectNode) qItem;

                            // Tìm từ vựng mục tiêu (Target Word)
                            String targetWord = null;
                            if (qObj.hasNonNull("targetWord") && !qObj.get("targetWord").asText().isBlank()) {
                                targetWord = qObj.get("targetWord").asText();
                            } else if (qObj.hasNonNull("word") && !qObj.get("word").asText().isBlank()) {
                                targetWord = qObj.get("word").asText();
                            } else if (qObj.hasNonNull("correctAnswer")) {
                                String ans = qObj.get("correctAnswer").asText().trim();
                                if (!ans.isBlank() && ans.split("\\s+").length <= 2 && !ans.contains(".") && !ans.contains("!")) {
                                    targetWord = ans;
                                }
                            }

                            if ((targetWord == null || targetWord.isBlank()) && qObj.hasNonNull("prompt")) {
                                String promptText = qObj.get("prompt").asText();
                                java.util.regex.Matcher m = java.util.regex.Pattern.compile("['\"‘“]([a-zA-Z\\s-]+)['\"’”]|\\(([a-zA-Z\\s-]+)\\)").matcher(promptText);
                                if (m.find()) {
                                    String cand = m.group(1) != null ? m.group(1).trim() : (m.group(2) != null ? m.group(2).trim() : "");
                                    if (!cand.isBlank() && cand.split("\\s+").length <= 2) {
                                        targetWord = cand;
                                    }
                                }
                            }

                            if (targetWord != null && !targetWord.isBlank()) {
                                String cleanWord = targetWord.replaceAll("^[^a-zA-Z]+|[^a-zA-Z]+$", "").trim();
                                if (cleanWord.length() >= 2) {
                                    hasEnriched = true;
                                    qObj.put("targetWord", cleanWord);

                                    // Tạo audio phát âm từ vựng chuẩn US
                                    String audio = "https://dict.youdao.com/dictvoice?audio="
                                            + java.net.URLEncoder.encode(cleanWord, java.nio.charset.StandardCharsets.UTF_8)
                                            + "&type=2";
                                    qObj.put("audioUrl", audio);
                                    qObj.put("mediaUrl", audio);

                                    // Lấy IPA
                                    String ipa = null;
                                    if (qObj.hasNonNull("ipa") && !qObj.get("ipa").asText().isBlank()) {
                                        ipa = qObj.get("ipa").asText().trim();
                                        if (!ipa.startsWith("/")) ipa = "/" + ipa;
                                        if (!ipa.endsWith("/")) ipa = ipa + "/";
                                        qObj.put("ipa", ipa);
                                    } else {
                                        String text = qObj.path("explanation").asText("") + " " + qObj.path("prompt").asText("");
                                        java.util.regex.Matcher ipaMatcher = java.util.regex.Pattern.compile("/([^/\\s]{2,40})/").matcher(text);
                                        if (ipaMatcher.find()) {
                                            ipa = "/" + ipaMatcher.group(1) + "/";
                                            qObj.put("ipa", ipa);
                                        }
                                    }

                                    if (ipa == null || ipa.isBlank()) {
                                        try {
                                            DictionaryLookupService.DictionaryEntryDto dictEntry = dictionaryLookupService.lookup(cleanWord);
                                            if (dictEntry != null && dictEntry.getIpa() != null && !dictEntry.getIpa().isBlank()) {
                                                ipa = dictEntry.getIpa();
                                                qObj.put("ipa", ipa);
                                            }
                                        } catch (Exception ex) {
                                            log.debug("Dictionary fallback lookup skipped for {}: {}", cleanWord, ex.getMessage());
                                        }
                                    }

                                    if (ipa != null && !ipa.isBlank()) {
                                        String currentExpl = qObj.path("explanation").asText("");
                                        if (!currentExpl.contains(ipa)) {
                                            String enrichedExpl = "Phiên âm IPA: " + ipa + (currentExpl.isBlank() ? "" : " | " + currentExpl);
                                            qObj.put("explanation", enrichedExpl);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (hasEnriched) {
                        rawJson = objectMapper.writeValueAsString(root);
                    }
                }
            } catch (Exception ex) {
                log.warn("Không thể bổ sung audio/IPA cho Vocabulary: {}", ex.getMessage());
            }
        } else if (effectiveType.contains("SHADOWING")) {
            // Cho bài tập SPEAKING SHADOWING: Làm sạch câu mẫu (không phải câu hỏi Q&A) và tổng hợp sẵn audio Kokoro-82M
            try {
                JsonNode root = objectMapper.readTree(rawJson);
                if (root.isObject()) {
                    ((com.fasterxml.jackson.databind.node.ObjectNode) root).put("speakingMode", "SHADOWING");
                }
                JsonNode questionsNode = root.get("questions");
                if (questionsNode != null && questionsNode.isArray()) {
                    boolean hasEnriched = false;
                    for (JsonNode qItem : questionsNode) {
                        if (qItem.isObject()) {
                            com.fasterxml.jackson.databind.node.ObjectNode qObj = (com.fasterxml.jackson.databind.node.ObjectNode) qItem;
                            String rawSentence = qObj.path("correctAnswer").asText(qObj.path("prompt").asText(qObj.path("question").asText(""))).trim();
                            String cleanSentence = ExerciseAudioService.cleanShadowingSentence(rawSentence);
                            if (cleanSentence.endsWith("?")) {
                                cleanSentence = cleanSentence.substring(0, cleanSentence.length() - 1) + ".";
                            }
                            if (!cleanSentence.isBlank()) {
                                qObj.put("question", cleanSentence);
                                qObj.put("prompt", cleanSentence);
                                qObj.put("correctAnswer", cleanSentence);
                                qObj.put("questionType", "AUDIO_RESPONSE");
                                qObj.put("speakingMode", "SHADOWING");
                                hasEnriched = true;
                                try {
                                    String kokoroUrl = exerciseAudioService.synthesizeRawScriptToUrl(cleanSentence, "af_heart", 1.0);
                                    if (kokoroUrl != null && !kokoroUrl.isBlank()) {
                                        qObj.put("audioUrl", kokoroUrl);
                                        qObj.put("mediaUrl", kokoroUrl);
                                    }
                                } catch (Exception ttsEx) {
                                    log.warn("Không thể tạo trước Kokoro audio cho câu Shadowing '{}': {}", cleanSentence, ttsEx.getMessage());
                                }
                            }
                        }
                    }
                    if (hasEnriched) {
                        rawJson = objectMapper.writeValueAsString(root);
                    }
                }
            } catch (Exception ex) {
                log.warn("Không thể chuẩn hóa câu mẫu cho Speaking Shadowing: {}", ex.getMessage());
            }
        } else if (effectiveType.startsWith("LISTENING")) {
            // Cho bài tập LISTENING: Đảm bảo có kịch bản âm thanh một đoạn dài (listeningPassage) và tạo sẵn audio Kokoro-82M (Dialogue hoặc Monologue)
            try {
                JsonNode root = objectMapper.readTree(rawJson);
                String mainPassage = root.path("listeningPassage").asText("").trim();
                if (mainPassage.isBlank()) {
                    mainPassage = root.path("audioScript").asText("").trim();
                }
                JsonNode questionsNode = root.get("questions");
                if (questionsNode != null && questionsNode.isArray()) {
                    boolean hasEnriched = false;
                    if (mainPassage.isBlank() && questionsNode.size() > 0) {
                        mainPassage = questionsNode.get(0).path("transcript").asText("").trim();
                    }

                    String sharedKokoroAudioUrl = null;
                    if (!mainPassage.isBlank()) {
                        if (root.isObject()) {
                            ((com.fasterxml.jackson.databind.node.ObjectNode) root).put("listeningPassage", mainPassage);
                        }
                        try {
                            sharedKokoroAudioUrl = exerciseAudioService.synthesizeRawScriptToUrl(mainPassage, "af_heart", 1.0);
                            if (sharedKokoroAudioUrl != null && !sharedKokoroAudioUrl.isBlank() && root.isObject()) {
                                ((com.fasterxml.jackson.databind.node.ObjectNode) root).put("audioUrl", sharedKokoroAudioUrl);
                                ((com.fasterxml.jackson.databind.node.ObjectNode) root).put("mediaUrl", sharedKokoroAudioUrl);
                            }
                        } catch (Exception ttsEx) {
                            log.warn("Không thể tạo sẵn Kokoro audio cho listeningPassage: {}", ttsEx.getMessage());
                        }
                    }

                    // Đối với LISTENING: Quản lý tập trung ở cấp bài nghe (root level)
                    // Xóa hoàn toàn audioUrl, mediaUrl, transcript ở từng câu hỏi con để không nhân bản dữ liệu
                    for (JsonNode qItem : questionsNode) {
                        if (qItem.isObject()) {
                            com.fasterxml.jackson.databind.node.ObjectNode qObj = (com.fasterxml.jackson.databind.node.ObjectNode) qItem;
                            qObj.remove("transcript");
                            qObj.remove("audioUrl");
                            qObj.remove("mediaUrl");
                            hasEnriched = true;
                        }
                    }
                    if (hasEnriched) {
                        rawJson = objectMapper.writeValueAsString(root);
                    }
                }
            } catch (Exception ex) {
                log.warn("Không thể bổ sung audio transcript cho Listening: {}", ex.getMessage());
            }
        } else if (effectiveType.startsWith("WRITING")) {
            try {
                JsonNode root = objectMapper.readTree(rawJson);
                JsonNode questionsNode = root.get("questions");
                if (questionsNode != null && questionsNode.isArray()) {
                    boolean hasUpdated = false;
                    for (JsonNode qItem : questionsNode) {
                        if (qItem.isObject()) {
                            com.fasterxml.jackson.databind.node.ObjectNode qObj = (com.fasterxml.jackson.databind.node.ObjectNode) qItem;
                            String prompt = qObj.path("prompt").asText("");
                            boolean isSentenceLevel = effectiveType.contains("WORD_ARRANGEMENT") || effectiveType.contains("UNSCRAMBLE")
                                    || effectiveType.contains("WORD_ORDER") || effectiveType.contains("SENTENCE")
                                    || effectiveType.contains("KEYWORD") || prompt.contains("___") || prompt.contains(" / ")
                                    || prompt.toLowerCase().contains("sắp xếp") || prompt.toLowerCase().contains("hoàn thành câu")
                                    || prompt.toLowerCase().contains("từ gợi ý");
                            if (isSentenceLevel) {
                                qObj.put("questionType", "FILL_IN_BLANK");
                                hasUpdated = true;
                            } else {
                                qObj.put("questionType", "ESSAY");
                                hasUpdated = true;
                            }
                        }
                    }
                    if (hasUpdated) {
                        rawJson = objectMapper.writeValueAsString(root);
                    }
                }
            } catch (Exception ex) {
                log.warn("Lỗi chuẩn hoá câu hỏi Writing: {}", ex.getMessage());
            }
        }

        exercise.setRawResponseJson(rawJson);
        exercise.setStatus(GenerationStatus.READY_FOR_REVIEW);
        return aiGeneratedExerciseRepository.save(exercise);
    }

    @Transactional
    public Assignment publishExerciseToAssignment(UUID exerciseId, UUID classroomId) {
        AiGeneratedExercise exercise = aiGeneratedExerciseRepository.findById(exerciseId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bài tập AI"));

        try {
            JsonNode root = objectMapper.readTree(exercise.getRawResponseJson());
            JsonNode questionsNode = root.has("questions") ? root.get("questions") : root;

            String exType = exercise.getExerciseType() != null ? exercise.getExerciseType().toUpperCase() : "MULTIPLE_CHOICE";
            String skillType = "READING";
            String defaultQType = "MULTIPLE_CHOICE";

            if (exType.contains("SPEAKING") || exType.contains("SHADOWING")) {
                skillType = "SPEAKING";
                defaultQType = "AUDIO_RESPONSE";
            } else if (exType.contains("WRITING")) {
                skillType = "WRITING";
                defaultQType = "ESSAY";
            } else if (exType.contains("LISTENING")) {
                skillType = "LISTENING";
            } else if (exType.contains("VOCABULARY") || exType.contains("VOCAB")) {
                skillType = "VOCABULARY";
            } else if (exType.contains("GRAMMAR")) {
                skillType = "GRAMMAR";
            }

            String readingPassage = root.path("readingPassage").asText("");

            String titleSuffix = (exercise.getLesson() != null && exercise.getLesson().getTitle() != null)
                    ? exercise.getLesson().getTitle()
                    : (exType + " Exercise");
            UUID targetLessonId = (exercise.getLesson() != null) ? exercise.getLesson().getId() : null;

            com.englishlearning.assignment.dto.AssignmentRequest req = new com.englishlearning.assignment.dto.AssignmentRequest();
            req.setTitle("AI Generated: " + titleSuffix);
            req.setDescription("Tự động tạo bài tập hàng ngày bằng AI Lab (" + exType + " - " + exercise.getTargetCefr() + ").");
            req.setClassroomId(classroomId);
            req.setLessonId(targetLessonId);
            req.setSkillType(skillType);
            req.setTimeLimitMinutes(20);
            req.setMaxAttempts(3);
            req.setPassScore(5.0);

            // Gán audioUrl và listeningScript ở cấp bài tập (Assignment root level) cho bài LISTENING
            String listeningPassage = root.path("listeningPassage").asText(root.path("audioScript").asText(""));
            String audioUrl = root.path("audioUrl").asText(root.path("mediaUrl").asText(""));
            if (!audioUrl.isBlank()) {
                req.setAudioUrl(audioUrl);
            }
            if (!listeningPassage.isBlank()) {
                req.setListeningScript(listeningPassage);
            }

            java.util.List<com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest> qReqs = new java.util.ArrayList<>();
            if (questionsNode.isArray()) {
                for (JsonNode qNode : questionsNode) {
                    com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest qReq = new com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest();
                    String prompt = qNode.has("prompt") ? qNode.get("prompt").asText() : qNode.path("question").asText();
                    if (!readingPassage.isBlank() && !prompt.contains("[READING PASSAGE]")) {
                        prompt = "[READING PASSAGE]\n" + readingPassage + "\n\n" + prompt;
                    }
                    qReq.setPromptText(prompt);

                    String detectedQType = qNode.path("questionType").asText(qNode.path("type").asText(defaultQType)).toUpperCase();
                    boolean isSentencePrompt = prompt.contains("___") || prompt.contains(" / ")
                            || prompt.toLowerCase().contains("sắp xếp") || prompt.toLowerCase().contains("hoàn thành câu")
                            || prompt.toLowerCase().contains("từ gợi ý");
                    if (isSentencePrompt || detectedQType.contains("FILL") || detectedQType.contains("BLANK") || detectedQType.contains("WORD_ARRANGEMENT") || detectedQType.contains("SHORT_ANSWER") || detectedQType.contains("WORD_FORM") || detectedQType.contains("DICTATION") || detectedQType.contains("SPELL") || detectedQType.contains("CONJUGAT") || detectedQType.contains("TRANSFORM") || detectedQType.contains("CORRECTION") || detectedQType.contains("KEYWORD") || detectedQType.contains("UNSCRAMBLE")) {
                        detectedQType = "FILL_IN_BLANK";
                    } else if (detectedQType.contains("TRUE") || detectedQType.contains("FALSE")) {
                        detectedQType = "TRUE_FALSE";
                    } else if (detectedQType.contains("ESSAY") || detectedQType.contains("WRITING")) {
                        detectedQType = "ESSAY";
                    } else if (detectedQType.contains("AUDIO") || detectedQType.contains("SPEAKING")) {
                        detectedQType = "AUDIO_RESPONSE";
                    } else {
                        detectedQType = "MULTIPLE_CHOICE";
                    }
                    qReq.setQuestionType(detectedQType);

                    // Thiết lập mediaUrl và transcript cho VOCABULARY và SPEAKING (Shadowing câu rời rạc).
                    // Với LISTENING: Quản lý tập trung ở cấp bài tập, KHÔNG nhân bản vào từng câu hỏi con!
                    if ("VOCABULARY".equals(skillType) || "SPEAKING".equals(skillType)) {
                        String media = qNode.path("mediaUrl").asText(qNode.path("audioUrl").asText(null));
                        if (media != null && !media.isBlank()) {
                            qReq.setMediaUrl(media);
                        }
                        String transcript = qNode.path("transcript").asText(null);
                        if (transcript != null && !transcript.isBlank()) {
                            qReq.setTranscript(transcript);
                        }
                    }

                    qReq.setExplanation(qNode.path("explanation").asText(""));
                    qReq.setPoints(10.0 / Math.max(1, exercise.getQuestionCount()));

                    if ("AUDIO_RESPONSE".equals(detectedQType)) {
                        qReq.setCorrectAnswer(qNode.path("correctAnswer").asText(prompt));
                    } else if ("ESSAY".equals(detectedQType)) {
                        qReq.setCorrectAnswer(qNode.path("correctAnswer").asText(""));
                    } else if ("FILL_IN_BLANK".equals(detectedQType)) {
                        String fillAns = qNode.path("correctAnswer").asText(qNode.path("answer").asText(qNode.path("word").asText(""))).trim();
                        qReq.setCorrectAnswer(fillAns);
                    } else {
                        String rawAns = qNode.path("correctAnswer").asText(qNode.path("answer").asText(qNode.path("word").asText(""))).trim();
                        qReq.setCorrectAnswer(rawAns);
                        java.util.List<com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest> optReqs = new java.util.ArrayList<>();
                        if (qNode.has("options") || qNode.has("choices")) {
                            JsonNode optNode = qNode.has("options") ? qNode.get("options") : qNode.get("choices");
                            if (optNode.isArray() && optNode.size() > 0) {
                                for (JsonNode singleOpt : optNode) {
                                    com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest optReq = new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                                    String text = singleOpt.isTextual() ? singleOpt.asText() : singleOpt.path("text").asText(singleOpt.path("label").asText(""));
                                    boolean isCorrect = singleOpt.path("isCorrect").asBoolean(singleOpt.path("correct").asBoolean(false));
                                    if (!isCorrect && !rawAns.isBlank()) {
                                        isCorrect = text.equalsIgnoreCase(rawAns);
                                    }
                                    optReq.setOptionText(text);
                                    optReq.setCorrect(isCorrect);
                                    optReqs.add(optReq);
                                }
                            } else if (optNode.isObject()) {
                                optNode.fields().forEachRemaining(entry -> {
                                    com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest optReq = new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                                    String text = entry.getValue().asText();
                                    boolean isCorrect = entry.getKey().equalsIgnoreCase(rawAns) || text.equalsIgnoreCase(rawAns);
                                    optReq.setOptionText(text);
                                    optReq.setCorrect(isCorrect);
                                    optReqs.add(optReq);
                                });
                            }
                        } else if ("TRUE_FALSE".equals(detectedQType)) {
                            String correctAns = qNode.path("correctAnswer").asText(qNode.path("answer").asText("TRUE")).toUpperCase();
                            com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest optT = new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                            optT.setOptionText("TRUE");
                            optT.setCorrect("TRUE".equals(correctAns));
                            optReqs.add(optT);
                            com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest optF = new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                            optF.setOptionText("FALSE");
                            optF.setCorrect("FALSE".equals(correctAns));
                            optReqs.add(optF);
                        }

                        if (optReqs.size() < 2 && !rawAns.isBlank()) {
                            // Chuyển sang dạng điền đáp án nếu không có danh sách lựa chọn
                            qReq.setQuestionType("FILL_IN_BLANK");
                            qReq.setOptions(new java.util.ArrayList<>());
                        } else {
                            qReq.setOptions(optReqs);
                        }
                    }
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

    public JsonNode evaluateReadingShortAnswer(String passage, String question, String studentAnswer, String expectedAnswer) {
        try {
            String systemInstruction = """
                    You are an expert English Reading Assessor specializing in reading comprehension diagnostics.
                    Your goal is to evaluate the student's short answer response to a question based on a reading passage.
                    CRITICAL PEDAGOGICAL RULES:
                    1. Distinguish between content comprehension (did they understand the passage?) and grammatical correctness (minor syntax/preposition/spelling errors).
                    2. If the student clearly understands the fact/idea from the passage but makes a minor grammatical slip (e.g., "in café" instead of "in a café", or minor tense slip), mark "isContentCorrect": true, "isGrammarCorrect": false. Do not penalize heavily for minor slips.
                    3. If the student misunderstood the information or provides factually wrong details according to the passage, mark "isContentCorrect": false.
                    4. Accept natural synonymous expressions (e.g., "She works at a café" = "In a small café").
                    5. Provide detailed, friendly explanations in Vietnamese.

                    Return strictly valid JSON:
                    {
                      "isContentCorrect": true,
                      "isGrammarCorrect": true,
                      "scoreOutOf10": 10.0,
                      "contentFeedback": "Lời nhận xét chi tiết bằng tiếng Việt về mức độ hiểu bài của học viên",
                      "grammarFeedback": "Lời nhận xét chi tiết bằng tiếng Việt về ngữ pháp / chính tả (nếu có lỗi)",
                      "suggestedAnswer": "Câu trả lời mẫu hoàn chỉnh và tự nhiên nhất",
                      "passageQuote": "Trích dẫn chính xác từ đoạn văn chứng minh thông tin này"
                    }
                    """;

            String userPrompt = String.format("""
                    === READING PASSAGE ===
                    %s

                    === QUESTION ===
                    %s

                    === EXPECTED / REFERENCE ANSWER ===
                    %s

                    === STUDENT ANSWER ===
                    %s
                    """,
                    passage != null ? passage : "",
                    question != null ? question : "",
                    expectedAnswer != null ? expectedAnswer : "",
                    studentAnswer != null ? studentAnswer : "");

            String rawJson = groqClientService.chatCompletionJson(systemInstruction, userPrompt);
            return objectMapper.readTree(rawJson);
        } catch (Exception e) {
            log.error("Reading short answer evaluation error: ", e);
            throw new RuntimeException("Đánh giá Reading câu trả lời ngắn thất bại: " + e.getMessage(), e);
        }
    }
}