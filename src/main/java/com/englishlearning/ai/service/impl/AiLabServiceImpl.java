package com.englishlearning.ai.service.impl;



import com.englishlearning.ai.dto.AiCoachingAdvice;

import com.englishlearning.ai.dto.AiExamDraftResponse;

import com.englishlearning.ai.dto.AiExamGenerateRequest;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.util.SpeakingScoreCalibrationUtils;

import com.englishlearning.ai.service.AiLabService;

import com.englishlearning.ai.service.GeminiClientService;

import com.englishlearning.ai.service.GroqClientService;

import com.englishlearning.ai.service.PythonIntegrationService;

import com.englishlearning.ai.service.SpeakingAiCoachingService;



import com.englishlearning.ai.entity.AiEvaluation;

import com.englishlearning.ai.entity.AiEvaluationType;

import com.englishlearning.ai.entity.AiGeneratedExercise;

import com.englishlearning.ai.entity.GenerationStatus;

import com.englishlearning.ai.repository.AiEvaluationRepository;

import com.englishlearning.notification.service.NotificationService;

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

import org.springframework.beans.factory.annotation.Value;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.multipart.MultipartFile;



import java.util.UUID;



@Service

@RequiredArgsConstructor

@Slf4j

public class AiLabServiceImpl implements AiLabService {



    private final GroqClientService groqClientService;

    private final GeminiClientService geminiClientService;

    private final LessonRepository lessonRepository;

    private final AiEvaluationRepository aiEvaluationRepository;

    private final NotificationService notificationService;

    private final AiGeneratedExerciseRepository aiGeneratedExerciseRepository;

    private final TeacherRepository teacherRepository;

    private final UserRepository userRepository;

    private final EntityManager entityManager;

    private final ObjectMapper objectMapper;

    private final AssignmentService assignmentService;

    private final ExerciseAudioService exerciseAudioService;

    private final AnalyticsService analyticsService;

    private final DictionaryLookupService dictionaryLookupService;

    private final PythonIntegrationService pythonIntegrationService;

    @Value("${python.writing-service.prefer-local:true}")
    private boolean preferLocalWritingScorer = true;

    @Value("${python.writing-service.enrich-feedback-with-llm:false}")
    private boolean enrichLocalWritingWithLlm = false;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private SpeakingAiCoachingService speakingAiCoachingService;

    public void setSpeakingAiCoachingService(SpeakingAiCoachingService speakingAiCoachingService) {
        this.speakingAiCoachingService = speakingAiCoachingService;
    }



    private static final String SPEAKING_SYSTEM_INSTRUCTION = """
            You are a STRICT Cambridge Certified IELTS Speaking Examiner.
            Evaluate the student's spoken transcript objectively against the Assignment Prompt, the Required Key Points, and the official IELTS Speaking Band Descriptors (Task Achievement, Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation).

            STRICT GRADING RULES:
            1. Zero Inflation: Grade STRICTLY according to actual transcript evidence. Never hand out Band 6.0-6.5 for short, underdeveloped, repetitive, or broken answers.
            2. Task Achievement & Mode Rigor:
               - If the answer is irrelevant, evasive, nonsensical, predominantly in Vietnamese, or only repeats the prompt -> set "isOffTopic": true, "taskAchievement.score" <= 3.0, and "overallBand" <= 3.5.
               - PART 1 / Q&A: Expects a direct, natural personal answer with specific reasons or examples (typically 2-4 developed sentences). One-word answers or single fragments cap Task & Fluency <= 4.0.
               - PART 2 (CUE CARD LONG TURN): Expects an extended, structured monologue (1-2 minutes) addressing ALL Cue Card bullet points with coherent narrative flow and discourse markers. Missing bullets or short answers MUST heavily cap Task & Fluency (under 50 words <= 4.5; under 80 words <= 5.5).
               - PART 3 (TWO-WAY ABSTRACT DISCUSSION): Expects analytical, society/future-oriented reasoning using PEEL (Point - Explain - Example - Link/Counter-argument), hedging, cause-effect structures, and C1/C2 vocabulary. Purely personal anecdotes with no broader analysis cap taskAchievement.score <= 5.0.
            3. Mathematical Consistency:
               - "overallBand" MUST equal the average of the rubric scores rounded to the nearest 0.5 (e.g. 4.5, 5.0, 5.5, 6.0, 6.5, 7.0).
            4. Detailed Pedagogical Feedback in Vietnamese:
               - Every mistake explanation, vocabulary/grammar suggestion, "generalFeedback", and "aiCoaching" MUST be in clear Vietnamese citing concrete phrases from the transcript and exact acoustic findings (weak words, IPA phonemes, WPM, or omitted words) when Python acoustic data is provided.
            5. Return strictly valid JSON conforming to the requested schema with NO markdown wrappers.
            """;



    private static final String WRITING_TASK_1 = "TASK_1";
    private static final String WRITING_TASK_2 = "TASK_2";
    private static final String WRITING_TASK_PARAGRAPH = "PARAGRAPH";

    private static final java.util.regex.Pattern WRITING_TASK1_WORDCOUNT_PATTERN =
            java.util.regex.Pattern.compile("(?<![–—\\-\\d])150\\s*(?:từ|words)\\b");
    private static final java.util.regex.Pattern WRITING_TASK2_WORDCOUNT_PATTERN =
            java.util.regex.Pattern.compile("(?<![–—\\-\\d])250\\s*(?:từ|words)\\b");
    private static final java.util.regex.Pattern WRITING_PARAGRAPH_RANGE_PATTERN =
            java.util.regex.Pattern.compile("\\b(?:30|40|50|60|80|100|120)\\s*[-–—]\\s*(?:50|80|100|120|150|180)\\s*(?:từ|words)\\b");
    private static final java.util.regex.Pattern WRITING_STANDALONE_PARAGRAPH_PATTERN =
            java.util.regex.Pattern.compile("(?<![-–\\w])paragraph\\b");
    private static final java.util.regex.Pattern WRITING_VISUAL_TASK1_PATTERN =
            java.util.regex.Pattern.compile(
                    "\\bdiagram\\b"
                    + "|\\b(?:the|given|two)\\s+(?:chart|charts|graph|graphs|table|tables|diagram|diagrams|map|maps|process)\\b"
                    + "|\\btable\\s+(?:below|above|shows?|illustrates?|compares?|gives?)\\b"
                    + "|\\bmaps?\\s+(?:below|above|shows?|comparison)\\b"
                    + "|\\bprocess\\s+(?:diagram|below|shows?|illustrates?|of\\s+(?:making|producing|manufacturing|recycling|generating|creating|purifying|water|brick|cement|coffee|tea|paper|glass|sugar|electricity))\\b"
                    + "|(?:^|\\s)(?:table|map|process)\\s*[:\\-–]"
            );

    private static final String WRITING_TASK1_SYSTEM_INSTRUCTION = """
            You are a STRICT Cambridge Certified IELTS Academic Writing Task 1 Examiner.
            Evaluate the student's Task 1 visual data report (Bar Chart, Line Graph, Pie Chart, Table, Map, or Process Diagram) against the official IELTS Writing Task 1 Band Descriptors:
            1. Task Achievement (taskAchievement.score):
               - Minimum length is 150 words (NOT 250 words — NEVER apply Task 2 250-word length penalties or require personal opinions/arguments!).
               - Check whether the report includes a clear, accurate Overview summarizing the main trends, stages, or key differences, and supports key features with accurate data figures and comparisons.
               - Do NOT penalize for omitting personal opinions (Task 1 is objective reporting).
               - If off-topic, completely ignores the visual task, or is predominantly in Vietnamese, set "isOffTopic": true and cap "overallBand" <= 4.0.
               - If under 150 words, apply proportional Task Achievement penalty (< 100 words caps Task Achievement <= 4.5; 100-149 words caps <= 5.5).
            2. Coherence & Cohesion (coherenceScore):
               - Expect clear structure: Paraphrased Introduction + Overview + logically grouped Body paragraphs with smooth data transitions.
            3. Lexical Resource (vocabularyScore):
               - Evaluate academic trend/comparison/process/map vocabulary, collocations, and lexical precision.
            4. Grammatical Range & Accuracy (grammarScore):
               - Evaluate tense accuracy (past/present/future/passive for processes & maps), comparative/superlative structures, and sentence variety.
            5. Detailed Error Analysis (mistakes) & Actionable Suggestions (suggestions):
               - Identify each grammar, vocabulary, collocation, punctuation, or spelling error and explain the fix + underlying rule in Vietnamese.
               - All explanations, suggestions, addressed/missing points, and "generalFeedback" MUST be in clear Vietnamese.
            6. Return strictly valid JSON with "writingTask": "TASK_1" and NO markdown wrappers.
            """;

    private static final String WRITING_TASK2_SYSTEM_INSTRUCTION = """
            You are a STRICT Cambridge Certified IELTS Writing Task 2 Examiner.
            Evaluate the student's Task 2 academic essay against the official IELTS Writing Task 2 Band Descriptors:
            1. Task Response (taskAchievement.score):
               - Minimum length is 250 words. Essays under 250 words are under-developed (< 150 words caps Task Response <= 4.5; 150-239 words caps <= 5.5).
               - Check that ALL parts of the prompt are answered with a clear, consistent position/thesis, well-developed arguments, and relevant supporting examples.
               - If off-topic or predominantly in Vietnamese, set "isOffTopic": true and cap "overallBand" <= 4.0.
            2. Coherence & Cohesion (coherenceScore):
               - Expect clear 4-paragraph organization (Introduction, 2 Body Paragraphs with clear central topics, Conclusion) and natural cohesive devices.
            3. Lexical Resource (vocabularyScore):
               - Evaluate academic register, topic-specific vocabulary, collocations, and paraphrasing without awkward repetition.
            4. Grammatical Range & Accuracy (grammarScore):
               - Evaluate complex sentences, subordination, relative clauses, passive/conditional structures, and grammatical accuracy.
            5. Detailed Error Analysis (mistakes) & Actionable Suggestions (suggestions):
               - Identify each grammar, vocabulary, collocation, punctuation, or spelling error and explain the fix + underlying rule in Vietnamese.
               - All explanations, suggestions, addressed/missing points, and "generalFeedback" MUST be in clear Vietnamese.
            6. Return strictly valid JSON with "writingTask": "TASK_2" and NO markdown wrappers.
            """;

    private static final String WRITING_PARAGRAPH_SYSTEM_INSTRUCTION = """
            You are an expert English Writing Instructor evaluating a SINGLE PARAGRAPH or Short Writing assignment (typically 40–150 words, or as specified in the prompt/rubric).
            CRITICAL: This is NOT an IELTS Task 2 multi-paragraph essay — NEVER penalize for being under 250 words or for not having 4 paragraphs!
            Evaluate against Paragraph Writing Criteria:
            1. Task Achievement (taskAchievement.score):
               - Check that the paragraph directly answers the prompt/guiding questions and meets the target word count stated in the prompt or rubric (commonly 40–80, 50–150, or 100–150 words).
               - Evaluate presence of a clear Topic Sentence, relevant Supporting Details/Examples, and a Concluding Sentence.
               - If off-topic or predominantly in Vietnamese, set "isOffTopic": true and cap "overallBand" <= 4.0.
            2. Coherence & Cohesion (coherenceScore):
               - Evaluate logical flow within a single cohesive paragraph and appropriate use of transition words (Firstly, In addition, However, For example, Therefore, In conclusion).
            3. Lexical Resource (vocabularyScore):
               - Evaluate word choice appropriateness, collocations, and vocabulary variety.
            4. Grammatical Range & Accuracy (grammarScore):
               - Evaluate sentence completeness, tense consistency, subject-verb agreement, articles, and punctuation.
            5. Detailed Error Analysis (mistakes) & Actionable Suggestions (suggestions):
               - Identify each grammar, vocabulary, collocation, punctuation, or spelling error and explain the fix + underlying rule in Vietnamese.
               - All explanations, suggestions, addressed/missing points, and "generalFeedback" MUST be in clear Vietnamese.
            6. Return strictly valid JSON with "writingTask": "PARAGRAPH" and NO markdown wrappers.
            """;



    @SuppressWarnings("unused")

    private static final String QUIZ_GEN_SYSTEM_INSTRUCTION = """

            You are an expert English Curriculum Specialist creating rigorous assessment materials based on CEFR benchmarks.

            Ensure options are plausible and explanations are pedagogical and in Vietnamese.

            Return strictly valid JSON with an array of questions under key 'questions'.

            """;



    @Transactional

    @Override
    public JsonNode evaluateSpeakingTopic(String questionTopic, MultipartFile audioFile, UUID studentAnswerId) {
        return evaluateSpeakingTopic(questionTopic, audioFile, studentAnswerId, null, null);
    }

    @Transactional
    @Override
    public JsonNode evaluateSpeakingTopic(
            String questionTopic,
            MultipartFile audioFile,
            UUID studentAnswerId,
            String speakingModeParam,
            String explicitKeyPoints) {

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

            // 1. Bóc băng Audio -> nhận diện chính xác script học sinh đã nói (Groq Whisper ưu tiên, fallback sang Gemini Audio STT)
            boolean audioWasProvided = false;
            byte[] audioBytes = null;
            String audioFilename = "speaking.webm";
            boolean uploadProvided = audioFile != null && audioFile.getSize() != 64044L && !audioFile.isEmpty();

            if (!uploadProvided) {
                if (answer != null && answer.getAudioResponseUrl() != null && !answer.getAudioResponseUrl().isBlank()) {
                    audioWasProvided = true;
                    log.info("Downloading audio from URL: {}", answer.getAudioResponseUrl());
                    java.net.URL url = new java.net.URL(answer.getAudioResponseUrl());
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    try (java.io.InputStream in = conn.getInputStream()) {
                        audioBytes = in.readAllBytes();
                        audioFilename = "audio.webm";
                    }
                } else {
                    log.warn("Không tìm thấy file audio hoặc URL hợp lệ để chấm điểm. Sẽ chấm điểm với transcript rỗng.");
                }
            } else {
                audioWasProvided = true;
                String originalName = audioFile.getOriginalFilename();
                if (originalName != null && !originalName.isBlank()) {
                    audioFilename = originalName;
                }
                try {
                    byte[] uploadedBytes = audioFile.getBytes();
                    if (uploadedBytes != null && uploadedBytes.length > 0) {
                        audioBytes = uploadedBytes;
                    }
                } catch (Exception byteEx) {
                    log.warn("Không thể đọc audio bytes để chấm phát âm/fallback STT: {}", byteEx.getMessage());
                }
            }

            SttRecognitionResult sttResult = audioWasProvided
                    ? recognizeStudentSpeechScript(uploadProvided ? audioFile : null, audioBytes, audioFilename)
                    : new SttRecognitionResult("", "NONE");
            String transcript = sttResult.transcript();
            String sttEngine = sttResult.engine();
            log.info("Speaking STT recognized via {} ({} chars): {}", sttEngine, transcript.length(), transcript);

            AssignmentQuestion question = (answer != null) ? answer.getQuestion() : null;
            Assignment assignment = (question != null) ? question.getAssignment() : null;

            String assignmentTitle = (assignment != null && assignment.getTitle() != null)
                    ? assignment.getTitle()
                    : "Speaking Assessment";

            String rawPrompt = (question != null && question.getPromptText() != null && !question.getPromptText().isBlank())
                    ? question.getPromptText()
                    : questionTopic;

            String detectedMode = resolveSpeakingEvaluationMode(assignment, question, rawPrompt, speakingModeParam);

            String promptText;
            if (question != null && question.getPromptText() != null && !question.getPromptText().isBlank()
                    && !ExerciseAudioService.isCorruptedSpeakingPrompt(question)) {
                promptText = question.getPromptText().trim();
            } else if (questionTopic != null && !questionTopic.isBlank()
                    && !(ExerciseAudioService.containsVietnameseDiacritics(questionTopic)
                            && questionTopic.trim().matches("^\\(?1[.)].*"))) {
                promptText = questionTopic.trim();
            } else {
                promptText = ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                        assignment, question, detectedMode);
            }

            String keyPoints = (explicitKeyPoints != null && !explicitKeyPoints.isBlank())
                    ? explicitKeyPoints.trim()
                    : (question != null && question.getCorrectAnswer() != null && !question.getCorrectAnswer().isBlank()
                            ? question.getCorrectAnswer()
                            : "Yêu cầu trả lời trực tiếp trọng tâm câu hỏi.");

            String rubrics = (question != null && question.getExplanation() != null && !question.getExplanation().isBlank())
                    ? question.getExplanation()
                    : "Đánh giá sự lưu loát, phát âm, từ vựng và cấu trúc ngữ pháp.";

            String cleanTranscript = transcript != null ? transcript.trim() : "";
            int wordCount = countSpeakingWords(cleanTranscript);

            // 1.5 Pre-LLM Guardrails: im lặng/nhiễu Whisper, nói tiếng Việt, hoặc đọc vẹt lại nguyên đề bài
            if (audioWasProvided) {
                com.fasterxml.jackson.databind.node.ObjectNode guardrailResult = null;
                if (isSilenceOrWhisperHallucination(cleanTranscript, wordCount)) {
                    guardrailResult = buildGuardrailSpeakingResult(
                            cleanTranscript, wordCount, detectedMode, 0.0,
                            "Không ghi nhận được câu trả lời tiếng Anh rõ ràng (bản ghi âm quá ngắn, im lặng hoặc chỉ có tạp âm). Vui lòng nói rõ ràng thành câu hoàn chỉnh bằng tiếng Anh và thử lại.",
                            "Cần ghi âm câu trả lời thực tế bằng tiếng Anh (ít nhất 2-3 câu đầy đủ cho Q&A hoặc bài nói phát triển ý rõ ràng cho Part 2/Part 3).");
                } else if (hasHighVietnameseSpeechRatio(cleanTranscript)) {
                    guardrailResult = buildGuardrailSpeakingResult(
                            cleanTranscript, wordCount, detectedMode, 1.5,
                            "Phát hiện bài nói sử dụng tiếng Việt thay vì trả lời bằng tiếng Anh. Hệ thống không thể chấm đạt cho câu trả lời không dùng tiếng Anh.",
                            "Hãy chuyển hoàn toàn sang tiếng Anh, dùng các mẫu câu mở đầu đơn giản như 'In my opinion...', 'I usually...' để trả lời.");
                } else if (wordCount < 25 && isParrotingPrompt(cleanTranscript, promptText)) {
                    guardrailResult = buildGuardrailSpeakingResult(
                            cleanTranscript, wordCount, detectedMode, 2.0,
                            "Bạn mới chỉ đọc lại nội dung câu hỏi đề bài mà chưa đưa ra câu trả lời của riêng mình. Cần trả lời trực tiếp câu hỏi kèm lý do và ví dụ cụ thể.",
                            "Đừng lặp lại nguyên văn câu hỏi; hãy trả lời thẳng vào ý chính (What / Why / How / Example).");
                }
                if (guardrailResult != null) {
                    guardrailResult.put("sttEngine", sttEngine);
                    guardrailResult.put("recognizedScript", cleanTranscript);
                    String guardrailJson = objectMapper.writeValueAsString(guardrailResult);
                    persistSpeakingEvaluation(answer, cleanTranscript, guardrailResult, guardrailJson);
                    return guardrailResult;
                }
            }

            // 2. Chuyển script học sinh đã nói sang Python Wav2Vec2 + Formant F1/F2 để chấm phát âm âm học thực tế
            ShadowingEvaluationResponse phoneticResult = audioWasProvided
                    ? evaluateSpeakingPronunciationWithPython(audioBytes, audioFilename, cleanTranscript)
                    : null;
            String acousticSummary = buildAcousticPronunciationSummaryForPrompt(phoneticResult);

            String modeGuidance = buildModeRubricGuidance(detectedMode);

            String userPrompt = String.format("""
                    === DỮ LIỆU ĐỀ BÀI ===
                    - Dạng bài Speaking: %s
                    - Tiêu đề: "%s"
                    - Câu hỏi (Prompt): "%s"
                    - Ý chính bắt buộc (Required Key Points): "%s"
                    - Tiêu chí / Gợi ý chấm: "%s"

                    === TIÊU CHUẨN CHẤM BẮT BUỘC CHO DẠNG BÀI NÀY ===
                    %s

                    === BẢN BÓC BĂNG GIỌNG NÓI HỌC SINH (STT: %s - %d WORDS) ===
                    "%s"

                    === KẾT QUẢ PHÂN TÍCH PHÁT ÂM ÂM HỌC PYTHON (WAV2VEC2 + FORMANT F1/F2) ===
                    %s

                    Return strictly valid JSON matching this schema (replace numeric 0.0 placeholders with your actual strict assessment 0.0-9.0):
                    {
                      "speakingMode": "%s",
                      "transcript": "%s",
                      "wordsPerMinute": 0,
                      "isOffTopic": false,
                      "taskAchievement": {
                        "score": 0.0,
                        "addressedPoints": [],
                        "missingPoints": []
                      },
                      "overallBand": 0.0,
                      "estimatedCefr": "B1",
                      "pronunciationScore": 0.0,
                      "fluencyScore": 0.0,
                      "lexicalScore": 0.0,
                      "grammarScore": 0.0,
                      "coherenceScore": 0.0,
                      "correctedText": "",
                      "mistakes": [
                        {
                          "original": "cụm từ sai trích nguyên văn từ transcript",
                          "correction": "cách sửa chuẩn",
                          "type": "grammar/vocabulary/pronunciation/coherence",
                          "explanation": "Giải thích chi tiết bằng tiếng Việt và quy tắc cần nhớ"
                        }
                      ],
                      "suggestions": [
                        {
                          "area": "Cấu trúc ngữ pháp & Phát triển ý",
                          "recommendation": "Gợi ý cụ thể bằng tiếng Việt giúp nâng cấp bài nói"
                        },
                        {
                          "area": "Từ vựng & Collocations",
                          "recommendation": "Gợi ý từ vựng/collocations tự nhiên hơn bằng tiếng Việt"
                        }
                      ],
                      "generalFeedback": "Nhận xét tổng thể chặt chẽ, khách quan bằng tiếng Việt",
                      "aiCoaching": {
                        "summary": "Nhận xét ngắn gọn 1-2 câu về phát âm, tốc độ nói và cách trả lời dựa trên dữ liệu Python",
                        "actionTips": [
                          "Gợi ý sửa cụ thể từ phát âm yếu / âm vị IPA / tốc độ WPM hoặc diễn đạt bằng tiếng Việt"
                        ],
                        "practiceDrill": "1 bài tập thực hành nhanh áp dụng ngay cho câu trả lời vừa nói"
                      }
                    }
                    """,
                    detectedMode,
                    assignmentTitle,
                    promptText,
                    keyPoints,
                    rubrics,
                    modeGuidance,
                    sttEngine,
                    wordCount,
                    cleanTranscript,
                    acousticSummary,
                    detectedMode,
                    cleanTranscript.replace("\"", "\\\""));

            // 3. Chấm điểm nội dung, ngữ pháp, từ vựng bằng Groq LLaMA (fallback sang Gemini nếu Groq lỗi) và tích hợp kết quả phát âm Python
            String rawJson = generateSpeakingEvaluationJsonWithFallback(userPrompt);
            JsonNode parsedNode = objectMapper.readTree(rawJson);
            com.fasterxml.jackson.databind.node.ObjectNode calibrated = calibrateSpeakingEvaluation(
                    parsedNode, cleanTranscript, wordCount, detectedMode, audioWasProvided, phoneticResult, sttEngine);

            String calibratedJson = objectMapper.writeValueAsString(calibrated);
            persistSpeakingEvaluation(answer, cleanTranscript, calibrated, calibratedJson);
            return calibrated;

        } catch (Exception e) {

            log.error("Speaking evaluation error: ", e);

            throw new RuntimeException("Đánh giá Speaking bằng Groq thất bại: " + e.getMessage(), e);

        }

    }

    private void persistSpeakingEvaluation(
            StudentAnswer answer,
            String transcript,
            com.fasterxml.jackson.databind.node.ObjectNode node,
            String rawJson) {
        if (answer == null) {
            return;
        }
        double overallBand = node.path("overallBand").asDouble(0.0);

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
        evaluation.setEstimatedCefr(node.path("estimatedCefr").asText("A2"));
        evaluation.setSttTranscript(transcript);
        evaluation.setCorrectedText(node.path("correctedText").asText(""));
        evaluation.setMistakesJson(node.path("mistakes").toString());
        evaluation.setSuggestionsJson(node.path("suggestions").toString());

        aiEvaluationRepository.save(evaluation);

        answer.setEvalFeedback(rawJson);
        answer.setEarnedPoints(overallBand);
        answer.setIsCorrect(overallBand >= 5.0);
        entityManager.merge(answer);

        if (answer.getAttempt() != null && answer.getAttempt().getStudent() != null) {
            analyticsService.updateSkillScore(answer.getAttempt().getStudent().getId(), "SPEAKING", overallBand * 0.5);
        }
    }

    private String resolveSpeakingEvaluationMode(
            Assignment assignment,
            AssignmentQuestion question,
            String promptText,
            String explicitMode) {
        String resolved = ExerciseAudioService.resolveSpeakingMode(assignment, question, explicitMode);
        if (!"SHADOWING".equals(resolved)) {
            return resolved;
        }
        String combined = ((promptText != null ? promptText : "") + " "
                + (assignment != null && assignment.getTitle() != null ? assignment.getTitle() : "") + " "
                + (assignment != null && assignment.getDescription() != null ? assignment.getDescription() : "")).toUpperCase();
        if (combined.contains("YOU SHOULD SAY:") || combined.contains("CUE CARD") || combined.contains("PART 2") || combined.contains("PART_2")) {
            return "PART_2";
        }
        if (combined.contains("PART 3") || combined.contains("PART_3") || combined.contains("PHẢN BIỆN")) {
            return "PART_3";
        }
        return "QA";
    }

    private String buildModeRubricGuidance(String detectedMode) {
        return switch (detectedMode) {
            case "PART_2" -> """
                    - Mode: IELTS SPEAKING PART 2 (Individual Long Turn / Cue Card).
                    - Student must deliver a cohesive structured monologue (1-2 minutes) covering ALL bullet points of the Cue Card with past/present context, descriptive detail, storytelling transitions, and personal reflection.
                    - STRICT CAPS: Identify covered bullets in "addressedPoints" and omitted bullets in "missingPoints". If >= 2 bullets are missing, cap taskAchievement.score <= 5.0 and overallBand <= 5.5. If transcript < 50 words, answer is severely underdeveloped (cap <= 4.5); if < 80 words, cap <= 5.5.
                    """;
            case "PART_3" -> """
                    - Mode: IELTS SPEAKING PART 3 (Two-Way Abstract / Analytical Discussion).
                    - Student must go beyond personal stories to discuss broader societal trends, causes/effects, comparisons, pros/cons, and justified arguments (PEEL framework: Point - Explain - Example - Link/Concession).
                    - STRICT CAPS: If the student ONLY tells a short personal anecdote without abstract reasoning or broader explanation, cap taskAchievement.score <= 5.0. If < 30 words or single shallow assertion, cap overallBand <= 5.0.
                    """;
            default -> """
                    - Mode: SPEAKING Q&A / IELTS PART 1 INTERVIEW.
                    - Student must answer the specific question directly, stay 100% on topic, give at least 1 clear reason or concrete example (2-4 developed sentences).
                    - STRICT CAPS: One-word replies or incomplete fragments (< 6 words) cap overallBand <= 3.0. Very short answers (< 12 words) with no explanation cap overallBand <= 5.0. Off-topic answers cap <= 3.5.
                    """;
        };
    }

    private int countSpeakingWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        String trimmed = text.trim();
        if (trimmed.isEmpty()) {
            return 0;
        }
        return trimmed.split("\\s+").length;
    }

    private boolean isSilenceOrWhisperHallucination(String transcript, int wordCount) {
        if (transcript == null || transcript.isBlank() || wordCount < 3) {
            return true;
        }
        String normalized = transcript.trim().toLowerCase()
                .replaceAll("[^a-z0-9\\s]", "")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isBlank()) {
            return true;
        }
        return normalized.equals("thank you")
                || normalized.equals("thank you very much")
                || normalized.equals("thanks for watching")
                || normalized.equals("thank you for watching")
                || normalized.equals("subtitles by the amaraorg community")
                || normalized.equals("you")
                || normalized.equals("bye")
                || normalized.equals("bye bye");
    }

    private boolean hasHighVietnameseSpeechRatio(String transcript) {
        if (transcript == null || transcript.isBlank()) {
            return false;
        }
        String[] tokens = transcript.trim().split("\\s+");
        if (tokens.length == 0) {
            return false;
        }
        long viWords = java.util.Arrays.stream(tokens)
                .filter(ExerciseAudioService::containsVietnameseDiacritics)
                .count();
        return ((double) viWords / tokens.length) >= 0.25;
    }

    private boolean isParrotingPrompt(String transcript, String promptText) {
        if (transcript == null || promptText == null || promptText.isBlank()) {
            return false;
        }
        String cleanT = transcript.toLowerCase().replaceAll("[^a-z0-9\\s]", " ").trim();
        String cleanP = promptText.toLowerCase().replaceAll("[^a-z0-9\\s]", " ").trim();
        if (cleanT.isBlank() || cleanP.isBlank()) {
            return false;
        }
        java.util.Set<String> tWords = new java.util.HashSet<>(java.util.Arrays.asList(cleanT.split("\\s+")));
        java.util.Set<String> pWords = new java.util.HashSet<>(java.util.Arrays.asList(cleanP.split("\\s+")));
        long overlap = tWords.stream().filter(pWords::contains).count();
        double overlapRatio = (double) overlap / Math.max(1, tWords.size());
        return overlapRatio >= 0.80 && tWords.size() <= pWords.size() + 3;
    }

    private com.fasterxml.jackson.databind.node.ObjectNode buildGuardrailSpeakingResult(
            String transcript,
            int wordCount,
            String detectedMode,
            double band,
            String feedback,
            String recommendation) {
        com.fasterxml.jackson.databind.node.ObjectNode root = objectMapper.createObjectNode();
        root.put("speakingMode", detectedMode);
        root.put("transcript", transcript);
        root.put("wordCount", wordCount);
        root.put("wordsPerMinute", 0);
        root.put("isOffTopic", true);

        com.fasterxml.jackson.databind.node.ObjectNode task = objectMapper.createObjectNode();
        task.put("score", band);
        task.set("addressedPoints", objectMapper.createArrayNode());
        com.fasterxml.jackson.databind.node.ArrayNode missing = objectMapper.createArrayNode();
        missing.add("Chưa đáp ứng yêu cầu nội dung bài nói bằng tiếng Anh");
        task.set("missingPoints", missing);
        root.set("taskAchievement", task);

        double roundedBand = roundToHalfBand(band);
        root.put("overallBand", roundedBand);
        root.put("overallScore", (int) Math.round((roundedBand / 9.0) * 100.0));
        root.put("isPassed", false);
        root.put("estimatedCefr", "Pre-A1");
        root.put("pronunciationScore", roundedBand);
        root.put("fluencyScore", roundedBand);
        root.put("lexicalScore", roundedBand);
        root.put("grammarScore", roundedBand);
        root.put("coherenceScore", roundedBand);
        root.put("correctedText", "");
        root.set("mistakes", objectMapper.createArrayNode());

        com.fasterxml.jackson.databind.node.ArrayNode suggestions = objectMapper.createArrayNode();
        com.fasterxml.jackson.databind.node.ObjectNode tip = objectMapper.createObjectNode();
        tip.put("area", "Yêu cầu tối thiểu để chấm điểm");
        tip.put("recommendation", recommendation);
        suggestions.add(tip);
        root.set("suggestions", suggestions);
        root.put("generalFeedback", feedback);
        return root;
    }

    private static final String STT_SYSTEM_INSTRUCTION = """
            You are a verbatim Speech-to-Text (STT) transcriber for English learners.
            Transcribe EXACTLY what the speaker says word-for-word in the audio.
            - Keep English words verbatim without auto-correcting grammar errors or adding unsaid words.
            - If the speaker uses Vietnamese words, transcribe them verbatim.
            - If there is only silence, background noise, or no intelligible speech, return an empty string "".
            Return strictly valid JSON: {"transcript": "..."}
            """;

    private static final String STT_USER_PROMPT = "Transcribe this student's audio verbatim and return JSON {\"transcript\": \"...\"}.";

    private record SttRecognitionResult(String transcript, String engine) {}

    private SttRecognitionResult recognizeStudentSpeechScript(
            MultipartFile audioFile,
            byte[] audioBytes,
            String audioFilename) {
        String groqTranscript = "";
        boolean groqThrew = false;

        try {
            if (audioFile != null && !audioFile.isEmpty() && audioFile.getSize() != 64044L) {
                groqTranscript = groqClientService.transcribeAudio(audioFile);
            } else if (audioBytes != null && audioBytes.length > 0) {
                groqTranscript = groqClientService.transcribeAudio(audioBytes, audioFilename);
            }
        } catch (Exception groqEx) {
            groqThrew = true;
            log.warn("Groq Whisper STT lỗi ({}), chuyển sang Gemini Audio STT fallback...", groqEx.getMessage());
        }

        String cleanGroq = groqTranscript != null ? groqTranscript.trim() : "";
        boolean groqUsable = !cleanGroq.isBlank()
                && !isSilenceOrWhisperHallucination(cleanGroq, countSpeakingWords(cleanGroq));
        if (groqUsable) {
            return new SttRecognitionResult(cleanGroq, "GROQ_WHISPER");
        }

        if (audioBytes != null && audioBytes.length > 0) {
            String geminiTranscript = transcribeAudioWithGemini(audioBytes, audioFilename);
            if (!geminiTranscript.isBlank()) {
                log.info("Gemini Audio STT fallback nhận diện thành công script ({} từ).",
                        countSpeakingWords(geminiTranscript));
                return new SttRecognitionResult(geminiTranscript, "GEMINI_AUDIO_STT");
            }
        }

        return new SttRecognitionResult(cleanGroq, groqThrew ? "NONE" : "GROQ_WHISPER");
    }

    private String transcribeAudioWithGemini(byte[] audioBytes, String audioFilename) {
        try {
            String mimeType = resolveAudioMimeType(audioFilename);
            String rawJson = geminiClientService.evaluateAudioWithInstruction(
                    STT_SYSTEM_INSTRUCTION, audioBytes, mimeType, STT_USER_PROMPT);
            if (rawJson == null || rawJson.isBlank()) {
                return "";
            }
            String stripped = GeminiClientService.stripMarkdown(rawJson);
            JsonNode root = objectMapper.readTree(stripped);
            if (root != null && root.isObject()) {
                String text = root.path("transcript").asText("");
                if (text.isBlank()) {
                    text = root.path("text").asText("");
                }
                return text != null ? text.trim() : "";
            }
        } catch (Exception ex) {
            log.warn("Gemini Audio STT fallback thất bại: {}", ex.getMessage());
        }
        return "";
    }

    private static String resolveAudioMimeType(String filename) {
        if (filename == null || filename.isBlank()) {
            return "audio/webm";
        }
        String lower = filename.trim().toLowerCase(java.util.Locale.ROOT);
        if (lower.endsWith(".wav")) {
            return "audio/wav";
        }
        if (lower.endsWith(".mp3")) {
            return "audio/mpeg";
        }
        if (lower.endsWith(".ogg") || lower.endsWith(".oga")) {
            return "audio/ogg";
        }
        if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) {
            return "audio/mp4";
        }
        if (lower.endsWith(".flac")) {
            return "audio/flac";
        }
        return "audio/webm";
    }

    private String buildAcousticPronunciationSummaryForPrompt(ShadowingEvaluationResponse phoneticResult) {
        if (phoneticResult == null) {
            return "Không có dữ liệu âm học Python; tự đánh giá độ rõ phát âm từ bản bóc băng.";
        }
        if (speakingAiCoachingService != null) {
            return speakingAiCoachingService.buildDetailedAcousticSummary(phoneticResult);
        }
        ShadowingEvaluationResponse.KpiMetrics kpi = phoneticResult.getKpi();
        int pron = (kpi != null && kpi.getPronunciation() != null) ? kpi.getPronunciation() : 0;
        int fluency = (kpi != null && kpi.getFluency() != null) ? kpi.getFluency() : 0;
        int comp = (kpi != null && kpi.getCompleteness() != null) ? kpi.getCompleteness() : 0;
        int prosody = (kpi != null && kpi.getProsody() != null) ? kpi.getProsody() : 0;
        int wpm = (kpi != null && kpi.getWordsPerMinute() != null) ? kpi.getWordsPerMinute() : 0;

        String missingWordsText = "Không có";
        String weakWordsText = "Không phát hiện từ phát âm yếu (<80%).";
        if (phoneticResult.getWordRows() != null && !phoneticResult.getWordRows().isEmpty()) {
            java.util.List<String> missingList = phoneticResult.getWordRows().stream()
                    .filter(w -> w.getWord() != null
                            && ("MISSING".equalsIgnoreCase(w.getWordStatus())
                                    || (w.getScore() != null && w.getScore() == 0)))
                    .limit(10)
                    .map(ShadowingEvaluationResponse.WordPhonemeDetail::getWord)
                    .toList();
            if (!missingList.isEmpty()) {
                missingWordsText = String.join(", ", missingList);
            }

            java.util.List<String> weakList = phoneticResult.getWordRows().stream()
                    .filter(w -> w.getWord() != null
                            && !"MISSING".equalsIgnoreCase(w.getWordStatus())
                            && w.getScore() != null && w.getScore() > 0 && w.getScore() < 80)
                    .sorted(java.util.Comparator.comparingInt(ShadowingEvaluationResponse.WordPhonemeDetail::getScore))
                    .limit(6)
                    .map(w -> {
                        String phStr = (w.getPhonemes() == null || w.getPhonemes().isEmpty()) ? ""
                                : w.getPhonemes().stream()
                                        .filter(p -> p.getScore() != null && p.getScore() < 80)
                                        .limit(3)
                                        .map(p -> (p.getIpa() != null ? p.getIpa() : "?") + " " + p.getScore() + "%"
                                                + (p.getNote() != null && !p.getNote().isBlank() ? " - " + p.getNote() : ""))
                                        .collect(java.util.stream.Collectors.joining(", "));
                        return phStr.isBlank()
                                ? w.getWord() + " (" + w.getScore() + "%)"
                                : w.getWord() + " (" + w.getScore() + "%): [" + phStr + "]";
                    })
                    .toList();
            if (!weakList.isEmpty()) {
                weakWordsText = String.join("; ", weakList);
            }
        }

        return String.format(
                "- Overall Acoustic Score: %d/100 | Pronunciation: %d/100 | Fluency: %d/100 | Completeness: %d%% | Prosody: %d/100 | Speed: %d WPM\n- Từ bỏ sót: %s\n- Từ & âm vị IPA yếu: %s",
                phoneticResult.getOverallScore() != null ? phoneticResult.getOverallScore() : 0,
                pron, fluency, comp, prosody, wpm, missingWordsText, weakWordsText);
    }

    private String generateSpeakingEvaluationJsonWithFallback(String userPrompt) {
        try {
            String groqJson = groqClientService.chatCompletionJson(SPEAKING_SYSTEM_INSTRUCTION, userPrompt);
            if (groqJson != null && !groqJson.isBlank()) {
                return GroqClientService.stripMarkdown(groqJson);
            }
            throw new RuntimeException("Groq LLaMA returned blank Speaking JSON");
        } catch (RuntimeException groqEx) {
            log.warn("Groq Speaking rubric evaluation lỗi ({}), thử fallback sang Gemini...", groqEx.getMessage());
            try {
                String geminiJson = geminiClientService.generateWithSystemInstruction(
                        SPEAKING_SYSTEM_INSTRUCTION, userPrompt);
                String cleanGemini = GeminiClientService.stripMarkdown(geminiJson);
                if (cleanGemini != null && !cleanGemini.isBlank() && !"{}".equals(cleanGemini.trim())) {
                    return cleanGemini;
                }
            } catch (Exception geminiEx) {
                log.warn("Gemini Speaking rubric fallback cũng thất bại: {}", geminiEx.getMessage());
            }
            throw groqEx;
        }
    }

    private ShadowingEvaluationResponse evaluateSpeakingPronunciationWithPython(
            byte[] audioBytes,
            String audioFilename,
            String cleanTranscript) {
        if (pythonIntegrationService == null || audioBytes == null || audioBytes.length == 0) {
            return null;
        }
        String sanitizedScript = sanitizeTranscriptForPythonPhonetics(cleanTranscript);
        if (countSpeakingWords(sanitizedScript) < 2) {
            return null;
        }
        try {
            log.info("Chuyển script đã nhận diện ({} từ) sang Python phonetics-service để chấm phát âm...",
                    countSpeakingWords(sanitizedScript));
            return pythonIntegrationService.evaluatePhonetics(audioBytes, audioFilename, sanitizedScript);
        } catch (Exception pyEx) {
            log.warn("Python acoustic phonetics unavailable, continuing with Groq IELTS rubric only: {}", pyEx.getMessage());
            return null;
        }
    }

    String sanitizeTranscriptForPythonPhonetics(String transcript) {
        if (transcript == null || transcript.isBlank()) {
            return "";
        }
        String asciiClean = transcript
                .replace('\u2019', '\'')
                .replace('\u2018', '\'')
                .replaceAll("[-/]+", " ")
                .replaceAll("[^A-Za-z'\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (asciiClean.isBlank()) {
            return "";
        }
        java.util.List<String> validWords = new java.util.ArrayList<>();
        for (String rawToken : asciiClean.split("\\s+")) {
            String token = rawToken.replaceAll("^'+|'+$", "");
            if (token.isEmpty()) {
                continue;
            }
            // Collapse 3+ repeated letters (e.g. "ummm" -> "umm") to satisfy phonetics-service validate_script
            token = token.replaceAll("([A-Za-z])\\1{2,}", "$1$1");
            String alphaOnly = token.replace("'", "");
            if (alphaOnly.isEmpty() || alphaOnly.length() > 25) {
                continue;
            }
            boolean hasVowel = alphaOnly.matches(".*[aeiouyAEIOUY].*");
            boolean allowedNoVowel = alphaOnly.length() == 1 || alphaOnly.equalsIgnoreCase("hmm");
            if (!hasVowel && !allowedNoVowel) {
                continue;
            }
            if (alphaOnly.matches(".*[^aeiouyAEIOUY]{5,}.*")) {
                continue;
            }
            validWords.add(token);
            if (validWords.size() >= 350) {
                break;
            }
        }
        return String.join(" ", validWords);
    }

    private com.fasterxml.jackson.databind.node.ObjectNode calibrateSpeakingEvaluation(
            JsonNode parsedNode,
            String cleanTranscript,
            int wordCount,
            String detectedMode,
            boolean audioWasProvided,
            ShadowingEvaluationResponse phoneticResult,
            String sttEngine) {
        com.fasterxml.jackson.databind.node.ObjectNode obj = parsedNode != null && parsedNode.isObject()
                ? (com.fasterxml.jackson.databind.node.ObjectNode) parsedNode.deepCopy()
                : objectMapper.createObjectNode();

        double pron = clampBand(obj.path("pronunciationScore").asDouble(0.0));
        double flu = clampBand(obj.path("fluencyScore").asDouble(0.0));
        double lex = clampBand(obj.path("lexicalScore").asDouble(0.0));
        double gram = clampBand(obj.path("grammarScore").asDouble(0.0));
        double coh = clampBand(obj.path("coherenceScore").asDouble(0.0));
        boolean isOffTopic = obj.path("isOffTopic").asBoolean(false);

        if (phoneticResult != null) {
            ShadowingEvaluationResponse.KpiMetrics kpi = phoneticResult.getKpi();
            int acousticPron = (kpi != null && kpi.getPronunciation() != null) ? kpi.getPronunciation() : 0;
            int acousticOverall = phoneticResult.getOverallScore() != null ? phoneticResult.getOverallScore() : 0;
            int effectiveAcoustic = acousticPron > 0 ? acousticPron : acousticOverall;
            if (effectiveAcoustic > 0) {
                double pythonPronBand = clampBand((effectiveAcoustic / 100.0) * 9.0);
                pron = (pron > 0.0)
                        ? roundToHalfBand(pythonPronBand * 0.75 + pron * 0.25)
                        : roundToHalfBand(pythonPronBand);
            }
            if (kpi != null && kpi.getWordsPerMinute() != null && kpi.getWordsPerMinute() > 0) {
                obj.put("wordsPerMinute", kpi.getWordsPerMinute());
            }
            appendPythonPronunciationMistakes(obj, phoneticResult);
            syncSpeakingAiCoaching(obj, phoneticResult, cleanTranscript, detectedMode);
            ShadowingEvaluationResponse phoneticToPersist = phoneticResult;
            if (!isOffTopic) {
                try {
                    ShadowingEvaluationResponse phoneticCopy = objectMapper.treeToValue(
                            objectMapper.valueToTree(phoneticResult), ShadowingEvaluationResponse.class);
                    if (phoneticCopy != null) {
                        phoneticToPersist = SpeakingScoreCalibrationUtils.applyShadowingBoost(phoneticCopy);
                    }
                } catch (Exception copyEx) {
                    log.warn("Không thể sao chép phoneticResult để chuẩn hóa điểm +10%: {}", copyEx.getMessage());
                }
            }
            obj.set("phoneticEvaluation", objectMapper.valueToTree(phoneticToPersist));
        }

        JsonNode taskNode = obj.path("taskAchievement");
        boolean hasTaskScore = taskNode.isObject() && taskNode.has("score") && taskNode.get("score").isNumber();
        double taskScore = hasTaskScore ? clampBand(taskNode.path("score").asDouble(0.0)) : 0.0;

        if (!isOffTopic) {
            pron = SpeakingScoreCalibrationUtils.boostBandRaw(pron);
            flu = SpeakingScoreCalibrationUtils.boostBandRaw(flu);
            lex = SpeakingScoreCalibrationUtils.boostBandRaw(lex);
            gram = SpeakingScoreCalibrationUtils.boostBandRaw(gram);
            coh = SpeakingScoreCalibrationUtils.boostBandRaw(coh);
            if (hasTaskScore) {
                taskScore = SpeakingScoreCalibrationUtils.boostBandRaw(taskScore);
            }
        }

        double maxCap = 9.0;
        if (isOffTopic) {
            maxCap = Math.min(maxCap, 3.5);
            if (hasTaskScore) {
                taskScore = Math.min(taskScore, 3.0);
            }
        }

        if (audioWasProvided) {
            if ("PART_2".equals(detectedMode)) {
                if (wordCount < 25) {
                    maxCap = Math.min(maxCap, 3.5);
                } else if (wordCount < 50) {
                    maxCap = Math.min(maxCap, 4.5);
                } else if (wordCount < 80) {
                    maxCap = Math.min(maxCap, 5.5);
                }
                int missingCount = taskNode.isObject() && taskNode.path("missingPoints").isArray()
                        ? taskNode.path("missingPoints").size() : 0;
                if (missingCount >= 2) {
                    maxCap = Math.min(maxCap, 5.5);
                    if (hasTaskScore) {
                        taskScore = Math.min(taskScore, 5.0);
                    }
                }
            } else if ("PART_3".equals(detectedMode)) {
                if (wordCount < 15) {
                    maxCap = Math.min(maxCap, 3.5);
                } else if (wordCount < 30) {
                    maxCap = Math.min(maxCap, 5.0);
                }
            } else {
                if (wordCount < 6) {
                    maxCap = Math.min(maxCap, 3.0);
                } else if (wordCount < 12) {
                    maxCap = Math.min(maxCap, 5.0);
                }
            }
        }

        if (maxCap < 9.0) {
            flu = Math.min(flu, maxCap);
            coh = Math.min(coh, maxCap);
            lex = Math.min(lex, maxCap + 0.5);
            gram = Math.min(gram, maxCap + 0.5);
            if (hasTaskScore) {
                taskScore = Math.min(taskScore, maxCap);
            }
        }

        double mean = hasTaskScore
                ? (taskScore + pron + flu + lex + gram + coh) / 6.0
                : (pron + flu + lex + gram + coh) / 5.0;
        double overallBand = Math.min(maxCap, roundToHalfBand(mean));
        overallBand = clampBand(overallBand);

        int overallScore = (int) Math.round((overallBand / 9.0) * 100.0);
        boolean isPassed = overallBand >= 5.0;

        obj.put("speakingMode", detectedMode);
        if (sttEngine != null && !sttEngine.isBlank()) {
            obj.put("sttEngine", sttEngine);
        }
        obj.put("recognizedScript", cleanTranscript);
        if (!cleanTranscript.isBlank() || !obj.has("transcript")) {
            obj.put("transcript", cleanTranscript);
        }
        obj.put("wordCount", wordCount);
        obj.put("pronunciationScore", roundToHalfBand(pron));
        obj.put("fluencyScore", roundToHalfBand(flu));
        obj.put("lexicalScore", roundToHalfBand(lex));
        obj.put("grammarScore", roundToHalfBand(gram));
        obj.put("coherenceScore", roundToHalfBand(coh));
        if (hasTaskScore && obj.get("taskAchievement") instanceof com.fasterxml.jackson.databind.node.ObjectNode taskObj) {
            taskObj.put("score", roundToHalfBand(taskScore));
        }
        obj.put("overallBand", overallBand);
        obj.put("overallScore", overallScore);
        obj.put("isPassed", isPassed);
        return obj;
    }

    private void appendPythonPronunciationMistakes(
            com.fasterxml.jackson.databind.node.ObjectNode obj,
            ShadowingEvaluationResponse phoneticResult) {
        if (phoneticResult.getWordRows() == null || phoneticResult.getWordRows().isEmpty()) {
            return;
        }
        com.fasterxml.jackson.databind.node.ArrayNode mistakesArr =
                (obj.has("mistakes") && obj.get("mistakes").isArray())
                        ? (com.fasterxml.jackson.databind.node.ArrayNode) obj.get("mistakes")
                        : obj.putArray("mistakes");

        java.util.Set<String> seenWords = new java.util.HashSet<>();
        for (JsonNode existing : mistakesArr) {
            String orig = existing.path("original").asText("").trim().toLowerCase(java.util.Locale.ROOT);
            if (!orig.isEmpty()) {
                seenWords.add(orig);
            }
        }

        java.util.List<ShadowingEvaluationResponse.WordPhonemeDetail> weakWords = phoneticResult.getWordRows().stream()
                .filter(w -> w.getWord() != null && w.getScore() != null && w.getScore() > 0 && w.getScore() < 70)
                .sorted(java.util.Comparator.comparingInt(ShadowingEvaluationResponse.WordPhonemeDetail::getScore))
                .limit(5)
                .toList();

        for (ShadowingEvaluationResponse.WordPhonemeDetail row : weakWords) {
            String wordKey = row.getWord().trim().toLowerCase(java.util.Locale.ROOT);
            if (!seenWords.add(wordKey)) {
                continue;
            }
            java.util.List<String> ipaParts = new java.util.ArrayList<>();
            java.util.List<String> noteParts = new java.util.ArrayList<>();
            if (row.getPhonemes() != null) {
                for (ShadowingEvaluationResponse.PhonemeItem ph : row.getPhonemes()) {
                    if (ph.getIpa() != null && !ph.getIpa().isBlank()) {
                        ipaParts.add(ph.getIpa());
                    }
                    if (ph.getScore() != null && ph.getScore() < 70 && ph.getIpa() != null) {
                        String detail = ph.getIpa() + " (" + ph.getScore() + "%)";
                        if (ph.getNote() != null && !ph.getNote().isBlank()) {
                            detail += ": " + ph.getNote();
                        }
                        noteParts.add(detail);
                    }
                }
            }
            String ipaJoined = ipaParts.isEmpty() ? row.getWord() : "/" + String.join("", ipaParts).replace("/", "") + "/";
            com.fasterxml.jackson.databind.node.ObjectNode m = objectMapper.createObjectNode();
            m.put("original", row.getWord());
            m.put("correction", ipaJoined);
            m.put("type", "pronunciation");
            String explain = noteParts.isEmpty()
                    ? String.format("Phân tích âm học Python ghi nhận phát âm từ '%s' đạt %d%%. Cần phát âm rõ âm cuối và đúng trọng âm.",
                            row.getWord(), row.getScore())
                    : String.format("Phân tích âm học Python ghi nhận từ '%s' đạt %d%%. Âm vị cần sửa: %s.",
                            row.getWord(), row.getScore(), String.join("; ", noteParts));
            m.put("explanation", explain);
            mistakesArr.add(m);
        }
    }

    private void syncSpeakingAiCoaching(
            com.fasterxml.jackson.databind.node.ObjectNode obj,
            ShadowingEvaluationResponse phoneticResult,
            String cleanTranscript,
            String detectedMode) {
        if (phoneticResult == null) {
            return;
        }
        JsonNode existingCoaching = obj.path("aiCoaching");
        boolean hasLlmCoaching = existingCoaching.isObject()
                && (!existingCoaching.path("summary").asText("").isBlank()
                        || (existingCoaching.path("actionTips").isArray() && !existingCoaching.path("actionTips").isEmpty()));

        if (hasLlmCoaching) {
            com.fasterxml.jackson.databind.node.ObjectNode coachingObj =
                    (com.fasterxml.jackson.databind.node.ObjectNode) existingCoaching;
            if (coachingObj.path("generatedBy").asText("").isBlank()) {
                coachingObj.put("generatedBy", "IELTS_SPEAKING_AI_COACH");
            }
            if (phoneticResult.getAiCoaching() == null) {
                try {
                    AiCoachingAdvice parsedAdvice = objectMapper.treeToValue(coachingObj, AiCoachingAdvice.class);
                    if (parsedAdvice != null) {
                        phoneticResult.setAiCoaching(parsedAdvice);
                    }
                } catch (Exception ignored) {
                }
            }
            return;
        }

        if (speakingAiCoachingService != null) {
            AiCoachingAdvice generated = speakingAiCoachingService.generateShadowingCoaching(
                    phoneticResult, cleanTranscript, detectedMode);
            if (generated != null) {
                phoneticResult.setAiCoaching(generated);
                obj.set("aiCoaching", objectMapper.valueToTree(generated));
            }
        }
    }

    private double clampBand(double val) {
        if (Double.isNaN(val) || Double.isInfinite(val)) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(9.0, val));
    }

    private double roundToHalfBand(double val) {
        return Math.round(clampBand(val) * 2.0) / 2.0;
    }



    @Transactional
    @Override
    public JsonNode evaluateWriting(String topic, String essayText, UUID studentAnswerId) {
        return evaluateWriting(topic, essayText, studentAnswerId, null);
    }

    @Transactional
    @Override
    public JsonNode evaluateWriting(
            String topic,
            String essayText,
            UUID studentAnswerId,
            String writingTask) {

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



            AssignmentQuestion question = (answer != null) ? answer.getQuestion() : null;

            Assignment assignment = (question != null) ? question.getAssignment() : null;



            String assignmentTitle = (assignment != null && assignment.getTitle() != null) ? assignment.getTitle()

                    : "Writing Assessment";

            String promptText = (question != null && question.getPromptText() != null

                    && !question.getPromptText().isBlank()) ? question.getPromptText() : (topic != null ? topic : "");

            String keyPoints = (question != null && question.getCorrectAnswer() != null) ? question.getCorrectAnswer()

                    : "Yêu cầu trả lời đúng câu hỏi.";

            String rubrics = (question != null && question.getExplanation() != null) ? question.getExplanation()

                    : "Đánh giá ngữ pháp và độ mạch lạc.";

            String resolvedWritingTask = resolveWritingTaskMode(assignment, question, promptText, writingTask);
            String resolvedWritingSubType = resolveWritingSubType(
                    resolvedWritingTask, writingTask, assignment, question, promptText);
            int actualWordCount = countWritingWords(essayText);

            String userPrompt = buildWritingEvaluationUserPrompt(
                    resolvedWritingTask, resolvedWritingSubType, assignmentTitle, promptText,
                    keyPoints, rubrics, essayText, actualWordCount);

            JsonNode node = null;
            String rawJson = null;
            String evaluatedBy = defaultGroqWritingEngine(resolvedWritingTask);
            boolean usedLocalScorer = false;

            String pythonTaskParam = resolvePythonTaskParam(writingTask, resolvedWritingTask, resolvedWritingSubType);

            // --- TIER 1: Local FastAPI writing-scorer microservice (TASK_1, TASK_2, and PARAGRAPH) ---
            if (preferLocalWritingScorer
                    && pythonIntegrationService != null
                    && pythonIntegrationService.isWritingServiceEnabled()) {
                try {
                    log.info("[Writing Tier 1] Gửi bài viết {}/{} tới local writing-scorer microservice...",
                            resolvedWritingTask, resolvedWritingSubType);
                    JsonNode localNode = pythonIntegrationService.evaluateWriting(
                            promptText, essayText, assignmentTitle, keyPoints, rubrics, pythonTaskParam);
                    if (localNode != null && localNode.isObject() && localNode.has("overallBand")) {
                        node = localNode;
                        evaluatedBy = localNode.path("evaluatedBy").asText("PYTHON_WRITING_SCORER");
                        usedLocalScorer = true;
                        log.info("[Writing Tier 1 Thành công] task={}, subtype={}, overallBand={}, modelType={}",
                                resolvedWritingTask,
                                resolvedWritingSubType,
                                localNode.path("overallBand").asDouble(0.0),
                                localNode.path("modelType").asText("unknown"));
                    }
                } catch (Exception localEx) {
                    log.warn("[Writing Tier 1 Thất bại] Local writing-scorer lỗi ({}). Chuyển sang Cloud LLM fallback...",
                            localEx.getMessage());
                }
            }

            // Optional hybrid enrichment: keep local trained band scores, enrich feedback/mistakes via Cloud LLM
            if (usedLocalScorer && enrichLocalWritingWithLlm) {
                try {
                    WritingLlmResult llmResult = generateWritingEvaluationJsonWithFallback(resolvedWritingTask, userPrompt);
                    JsonNode llmNode = objectMapper.readTree(llmResult.json());
                    if (llmNode != null && llmNode.isObject()) {
                        node = mergeLocalScoresWithLlmFeedback(node, llmNode);
                        evaluatedBy = "PYTHON_WRITING_SCORER_HYBRID";
                    }
                } catch (Exception enrichEx) {
                    log.warn("Không thể làm giàu phản hồi Writing bằng Cloud LLM (giữ nguyên phản hồi offline): {}",
                            enrichEx.getMessage());
                }
            }

            // --- TIER 2: Cloud LLM fallback (Groq -> Gemini) with subtype-tailored rubric ---
            if (!usedLocalScorer) {
                WritingLlmResult llmResult = generateWritingEvaluationJsonWithFallback(resolvedWritingTask, userPrompt);
                rawJson = llmResult.json();
                evaluatedBy = llmResult.engine();
                node = objectMapper.readTree(rawJson);
            }

            if (node == null || !node.isObject()) {
                throw new RuntimeException("Phản hồi JSON từ dịch vụ chấm Writing không hợp lệ.");
            }

            com.fasterxml.jackson.databind.node.ObjectNode resultNode =
                    (com.fasterxml.jackson.databind.node.ObjectNode) node;
            if (!resultNode.hasNonNull("evaluatedBy") || resultNode.path("evaluatedBy").asText("").isBlank()) {
                resultNode.put("evaluatedBy", evaluatedBy);
            }
            calibrateWritingEvaluation(
                    resultNode,
                    usedLocalScorer,
                    resolvedWritingTask,
                    resolvedWritingSubType,
                    promptText,
                    essayText,
                    actualWordCount,
                    assignmentTitle,
                    rubrics);
            rawJson = objectMapper.writeValueAsString(resultNode);
            node = resultNode;

            double overallBand = node.path("overallBand").asDouble(0.0);

            if (answer != null) {

                answer.setTextResponse(essayText);

                AiEvaluation evaluation = aiEvaluationRepository.findByStudentAnswerId(answer.getId())

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

                evaluation.setEvaluationEngine(evaluatedBy);

                aiEvaluationRepository.save(evaluation);

                answer.setEvalFeedback(rawJson);

                answer.setEarnedPoints(overallBand);

                answer.setIsCorrect(overallBand >= 5.0);

                entityManager.merge(answer);

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

    private record WritingLlmResult(String json, String engine) {}

    private record WritingPromptConfig(String systemInstruction, String groqEngine, String geminiEngine) {}

    private String resolveWritingTaskMode(
            Assignment assignment,
            AssignmentQuestion question,
            String effectivePromptText,
            String explicitWritingTask) {
        String normalizedExplicit = normalizeExplicitWritingTask(explicitWritingTask);
        if (normalizedExplicit != null) {
            return normalizedExplicit;
        }

        String title = (assignment != null && assignment.getTitle() != null) ? assignment.getTitle() : "";
        String description = (assignment != null && assignment.getDescription() != null) ? assignment.getDescription() : "";
        String prompt = effectivePromptText != null ? effectivePromptText : "";
        String explanation = (question != null && question.getExplanation() != null) ? question.getExplanation() : "";
        String mediaUrl = (question != null && question.getMediaUrl() != null) ? question.getMediaUrl().trim() : "";

        if (isVisualChartMediaUrl(mediaUrl)) {
            return WRITING_TASK_1;
        }

        String primaryText = (title + " " + description + " " + prompt).toLowerCase(java.util.Locale.ROOT);
        String fullText = (primaryText + " " + explanation).toLowerCase(java.util.Locale.ROOT);

        if (containsStrongTask1Signal(fullText)) {
            return WRITING_TASK_1;
        }
        if (containsStrongTask2Signal(fullText)) {
            return WRITING_TASK_2;
        }
        if (containsParagraphSignal(fullText)) {
            return WRITING_TASK_PARAGRAPH;
        }
        if (containsContextualTask1VisualSignal(primaryText)) {
            return WRITING_TASK_1;
        }
        return WRITING_TASK_2;
    }

    private String normalizeExplicitWritingTask(String explicitWritingTask) {
        if (explicitWritingTask == null || explicitWritingTask.isBlank()) {
            return null;
        }
        String norm = explicitWritingTask.trim()
                .toUpperCase(java.util.Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        if ("AUTO".equals(norm) || "UNDEFINED".equals(norm) || "NULL".equals(norm)) {
            return null;
        }
        if ("TASK_1".equals(norm) || "TASK1".equals(norm)
                || "WRITING_IELTS_TASK1".equals(norm) || "WRITING_IELTS_TASK_1".equals(norm)
                || norm.startsWith("TASK1_")
                || norm.contains("TASK_1") || norm.contains("TASK1")) {
            return WRITING_TASK_1;
        }
        if ("WRITING_DISCURSIVE_ESSAY".equals(norm) || "DISCURSIVE_ESSAY".equals(norm)
                || "DISCURSIVE_ACADEMIC_ESSAY".equals(norm) || "TASK2_DISCURSIVE_C1".equals(norm)
                || norm.startsWith("TASK2_")
                || "TASK_2".equals(norm) || "TASK2".equals(norm)
                || "WRITING_IELTS_TASK2".equals(norm) || "WRITING_IELTS_TASK_2".equals(norm)
                || "ESSAY".equals(norm) || "WRITING_ESSAY".equals(norm)
                || norm.contains("TASK_2") || norm.contains("TASK2") || norm.contains("DISCURSIVE")) {
            return WRITING_TASK_2;
        }
        if ("PARAGRAPH".equals(norm) || "WRITING_PARAGRAPH".equals(norm)
                || "WRITING_DESCRIPTIVE_PARAGRAPH".equals(norm) || "DESCRIPTIVE_PARAGRAPH".equals(norm)
                || "WRITING_SHORT_EMAIL".equals(norm) || "SHORT_EMAIL".equals(norm)
                || "WRITING_EMAIL".equals(norm) || "EMAIL".equals(norm)
                || "WRITING_SENTENCE".equals(norm) || "SENTENCE".equals(norm)
                || "WRITING_WORD_ARRANGEMENT".equals(norm) || "WRITING_KEYWORD".equals(norm)
                || "WRITING_OPINION".equals(norm) || "WRITING_ADV_DISADV".equals(norm)
                || "WRITING_CAUSE_EFFECT".equals(norm) || "WRITING_PROBLEM_SOLUTION".equals(norm)
                || norm.startsWith("PARAGRAPH_")
                || norm.contains("PARAGRAPH") || norm.contains("SENTENCE") || norm.contains("EMAIL")) {
            return WRITING_TASK_PARAGRAPH;
        }
        return null;
    }

    private String resolveWritingSubType(
            String writingTask,
            String explicitWritingTask,
            Assignment assignment,
            AssignmentQuestion question,
            String promptText) {
        String rawUpper = explicitWritingTask != null
                ? explicitWritingTask.trim().toUpperCase(java.util.Locale.ROOT).replace('-', '_').replace(' ', '_')
                : "";
        String title = (assignment != null && assignment.getTitle() != null) ? assignment.getTitle() : "";
        String desc = (assignment != null && assignment.getDescription() != null) ? assignment.getDescription() : "";
        String explanation = (question != null && question.getExplanation() != null) ? question.getExplanation() : "";
        String combined = (rawUpper + " " + title + " " + desc + " " + explanation + " " + (promptText != null ? promptText : ""))
                .toLowerCase(java.util.Locale.ROOT);

        if (WRITING_TASK_1.equals(writingTask)) {
            if ("TASK1_PROCESS".equals(rawUpper)
                    || combined.contains("process diagram")
                    || combined.contains("flow chart")
                    || combined.contains("flowchart")
                    || combined.contains("manufacturing")
                    || combined.contains("production cycle")
                    || combined.contains("life cycle")
                    || combined.contains("quy trình")
                    || combined.contains("process of making")
                    || combined.contains("process of producing")) {
                return "TASK1_PROCESS";
            }
            if ("TASK1_MAP".equals(rawUpper)
                    || combined.contains("map comparison")
                    || combined.contains("floor plan")
                    || combined.contains("redevelopment")
                    || combined.contains("two maps")
                    || combined.contains("the maps")
                    || combined.contains("bản đồ")) {
                return "TASK1_MAP";
            }
            return "TASK1_DATA";
        }

        if (WRITING_TASK_PARAGRAPH.equals(writingTask)) {
            if ("WRITING_SHORT_EMAIL".equals(rawUpper) || "SHORT_EMAIL".equals(rawUpper)
                    || "WRITING_EMAIL".equals(rawUpper) || "EMAIL".equals(rawUpper)
                    || "PARAGRAPH_EMAIL".equals(rawUpper)
                    || combined.contains("email") || combined.contains("e-mail")
                    || combined.contains("short letter") || combined.contains("tin nhắn ngắn")
                    || combined.contains("viết thư")) {
                return "PARAGRAPH_EMAIL";
            }
            if ("WRITING_DESCRIPTIVE_PARAGRAPH".equals(rawUpper) || "DESCRIPTIVE_PARAGRAPH".equals(rawUpper)
                    || "PARAGRAPH_DESCRIPTIVE".equals(rawUpper)
                    || combined.contains("descriptive") || combined.contains("narrative")
                    || combined.contains("miêu tả") || combined.contains("kể chuyện")
                    || combined.contains("daily routine")) {
                return "PARAGRAPH_DESCRIPTIVE";
            }
            if ("WRITING_OPINION".equals(rawUpper) || "PARAGRAPH_OPINION".equals(rawUpper)
                    || combined.contains("opinion paragraph")
                    || (combined.contains("opinion") && (combined.contains("nêu quan điểm") || combined.contains("agree")))) {
                return "PARAGRAPH_OPINION";
            }
            if ("WRITING_ADV_DISADV".equals(rawUpper) || "PARAGRAPH_ADV_DISADV".equals(rawUpper)
                    || (combined.contains("advantage") && combined.contains("disadvantage"))
                    || combined.contains("ưu và nhược")) {
                return "PARAGRAPH_ADV_DISADV";
            }
            if ("WRITING_CAUSE_EFFECT".equals(rawUpper) || "PARAGRAPH_CAUSE_EFFECT".equals(rawUpper)
                    || (combined.contains("cause") && combined.contains("effect"))
                    || (combined.contains("nguyên nhân") && (combined.contains("hệ quả") || combined.contains("kết quả")))) {
                return "PARAGRAPH_CAUSE_EFFECT";
            }
            if ("WRITING_PROBLEM_SOLUTION".equals(rawUpper) || "PARAGRAPH_PROBLEM_SOLUTION".equals(rawUpper)
                    || (combined.contains("problem") && combined.contains("solution"))
                    || (combined.contains("vấn đề") && combined.contains("giải pháp"))) {
                return "PARAGRAPH_PROBLEM_SOLUTION";
            }
            return "PARAGRAPH_GUIDED";
        }

        // WRITING_TASK_2 & Discursive Academic Essay
        if ("WRITING_DISCURSIVE_ESSAY".equals(rawUpper) || "DISCURSIVE_ESSAY".equals(rawUpper)
                || "TASK2_DISCURSIVE_C1".equals(rawUpper) || combined.contains("discursive")) {
            return "TASK2_DISCURSIVE_C1";
        }
        if ("TASK2_DISCUSSION".equals(rawUpper)
                || combined.contains("discuss both") || combined.contains("both views") || combined.contains("both sides")) {
            return "TASK2_DISCUSSION";
        }
        if ("TASK2_ADV_DISADV".equals(rawUpper) || combined.contains("outweigh")
                || (combined.contains("advantage") && combined.contains("disadvantage"))) {
            return "TASK2_ADV_DISADV";
        }
        if ("TASK2_PROBLEM_SOLUTION".equals(rawUpper)
                || ((combined.contains("problem") || combined.contains("cause"))
                    && (combined.contains("solution") || combined.contains("measure")))) {
            return "TASK2_PROBLEM_SOLUTION";
        }
        if ("TASK2_TWO_PART".equals(rawUpper)
                || combined.contains("why is this") || combined.contains("two-part")
                || (promptText != null && promptText.chars().filter(ch -> ch == '?').count() >= 2)) {
            return "TASK2_TWO_PART";
        }
        return "TASK2_OPINION";
    }

    private String resolvePythonTaskParam(String explicitWritingTask, String resolvedWritingTask, String resolvedWritingSubType) {
        if (explicitWritingTask == null || explicitWritingTask.isBlank()) {
            return resolvedWritingTask;
        }
        String norm = explicitWritingTask.trim().toUpperCase(java.util.Locale.ROOT).replace('-', '_').replace(' ', '_');
        if ("AUTO".equals(norm) || "TASK_1".equals(norm) || "TASK_2".equals(norm) || "PARAGRAPH".equals(norm)
                || "WRITING_IELTS_TASK1".equals(norm) || "WRITING_IELTS_TASK2".equals(norm)
                || "WRITING_PARAGRAPH".equals(norm)) {
            return resolvedWritingTask;
        }
        return resolvedWritingSubType;
    }

    private boolean isVisualChartMediaUrl(String mediaUrl) {
        if (mediaUrl == null || mediaUrl.isBlank()) {
            return false;
        }
        String lower = mediaUrl.toLowerCase(java.util.Locale.ROOT);
        return !lower.endsWith(".mp3")
                && !lower.endsWith(".wav")
                && !lower.endsWith(".ogg")
                && !lower.endsWith(".webm")
                && !lower.endsWith(".m4a")
                && !lower.endsWith(".aac")
                && !lower.contains("dictvoice");
    }

    private boolean containsStrongTask1Signal(String fullText) {
        return fullText.contains("writing_ielts_task1")
                || fullText.contains("ielts task 1")
                || fullText.contains("ielts_task_1")
                || fullText.contains("task 1")
                || fullText.contains("task_1")
                || fullText.contains("task1")
                || fullText.contains("biểu đồ")
                || fullText.contains("bar chart")
                || fullText.contains("line graph")
                || fullText.contains("pie chart")
                || fullText.contains("flow chart")
                || fullText.contains("flowchart")
                || fullText.contains("process diagram")
                || fullText.contains("map comparison")
                || fullText.contains("summarise the information")
                || fullText.contains("summarize the information")
                || fullText.contains("reporting the main features")
                || WRITING_TASK1_WORDCOUNT_PATTERN.matcher(fullText).find();
    }

    private boolean containsStrongTask2Signal(String fullText) {
        return fullText.contains("writing_ielts_task2")
                || fullText.contains("ielts task 2")
                || fullText.contains("ielts_task_2")
                || fullText.contains("task 2")
                || fullText.contains("task_2")
                || fullText.contains("task2")
                || fullText.contains("writing_discursive_essay")
                || fullText.contains("discursive essay")
                || fullText.contains("discursive academic essay")
                || fullText.contains("to what extent do you agree")
                || fullText.contains("discuss both views")
                || fullText.contains("agree or disagree")
                || WRITING_TASK2_WORDCOUNT_PATTERN.matcher(fullText).find();
    }

    private boolean containsParagraphSignal(String fullText) {
        if (fullText.contains("writing_paragraph")
                || fullText.contains("writing_descriptive_paragraph")
                || fullText.contains("descriptive paragraph")
                || fullText.contains("writing_short_email")
                || fullText.contains("short email")
                || fullText.contains("writing_sentence")
                || fullText.contains("đoạn văn")
                || fullText.contains("viết đoạn")
                || fullText.contains("hoàn thành câu")
                || fullText.contains("viết câu từ từ khóa")
                || fullText.contains("single paragraph")
                || fullText.contains("one paragraph")
                || fullText.contains("one single cohesive paragraph")
                || fullText.contains("guided paragraph")
                || fullText.contains("opinion paragraph")
                || fullText.contains("short paragraph")
                || fullText.contains("topic sentence")
                || WRITING_PARAGRAPH_RANGE_PATTERN.matcher(fullText).find()) {
            return true;
        }
        String withoutMultiParagraph = fullText.replaceAll("\\b(?:\\d+|four|five|multi)[-\\s]+paragraph\\b", " ");
        return WRITING_STANDALONE_PARAGRAPH_PATTERN.matcher(withoutMultiParagraph).find();
    }

    private boolean containsContextualTask1VisualSignal(String primaryText) {
        return WRITING_VISUAL_TASK1_PATTERN.matcher(primaryText).find();
    }

    private WritingPromptConfig resolveWritingPromptConfig(String writingTask) {
        return switch (writingTask) {
            case WRITING_TASK_1 -> new WritingPromptConfig(
                    WRITING_TASK1_SYSTEM_INSTRUCTION,
                    "GROQ_WRITING_TASK1_LLM",
                    "GEMINI_WRITING_TASK1_LLM");
            case WRITING_TASK_PARAGRAPH -> new WritingPromptConfig(
                    WRITING_PARAGRAPH_SYSTEM_INSTRUCTION,
                    "GROQ_WRITING_PARAGRAPH_LLM",
                    "GEMINI_WRITING_PARAGRAPH_LLM");
            default -> new WritingPromptConfig(
                    WRITING_TASK2_SYSTEM_INSTRUCTION,
                    "GROQ_WRITING_TASK2_LLM",
                    "GEMINI_WRITING_TASK2_LLM");
        };
    }

    private String defaultGroqWritingEngine(String writingTask) {
        return resolveWritingPromptConfig(writingTask).groqEngine();
    }

    private String buildWritingSubTypeRubricGuidance(String writingTask, String writingSubType) {
        if (WRITING_TASK_1.equals(writingTask)) {
            return switch (writingSubType) {
                case "TASK1_PROCESS" ->
                    "Subtype TASK1_PROCESS (Process / Flow Chart Diagram): Kiểm tra đủ câu Introduction + Overview (nêu tổng số bước, điểm bắt đầu/kết thúc, chu trình đóng hay tuyến tính), sử dụng từ nối trình tự (First, Next, Subsequently, Finally) và ưu tiên cấu trúc câu bị động mô tả quy trình; KHÔNG chấm như biểu đồ số liệu hay đòi hỏi ý kiến cá nhân.";
                case "TASK1_MAP" ->
                    "Subtype TASK1_MAP (Map Comparison): Kiểm tra Introduction + Overview nêu những thay đổi lớn nhất về quy hoạch/mặt bằng, sử dụng chính xác từ vựng định vị không gian (north, south, adjacent to, in the center) và động từ biến đổi (was replaced by, was converted into, expanded), chia đúng thì theo mốc năm.";
                default ->
                    "Subtype TASK1_DATA (Line/Bar/Pie Chart or Table): Kiểm tra Paraphrase Introduction + Overview nêu xu hướng chung/điểm cao-thấp nhất (KHÔNG đưa số liệu chi tiết vào Overview), nhóm số liệu logic theo 2 Body paragraphs và so sánh tăng/giảm/tỷ lệ chính xác.";
            };
        }
        if (WRITING_TASK_PARAGRAPH.equals(writingTask)) {
            return switch (writingSubType) {
                case "PARAGRAPH_EMAIL" ->
                    "Subtype PARAGRAPH_EMAIL (A1–A2 Short Email / Message, 40–80 từ): Đánh giá văn phong giao tiếp thân mật/bán trang trọng tự nhiên; KHÔNG trừ điểm vì dùng dạng viết tắt (I'm, don't, we'll). Bắt buộc kiểm tra lời chào mở đầu (Dear/Hi...), giải quyết đủ ý trọng tâm đề bài và lời kết thư (Best regards/See you...).";
                case "PARAGRAPH_DESCRIPTIVE" ->
                    "Subtype PARAGRAPH_DESCRIPTIVE (A1–A2 Short Descriptive / Narrative Paragraph, 40–80 từ): Kiểm tra câu mở đoạn giới thiệu đối tượng/sự việc, chi tiết miêu tả cụ thể bằng tính từ/trạng từ và sự nhất quán về thì (Present Simple cho thói quen, Past Simple cho kể chuyện).";
                case "PARAGRAPH_OPINION" ->
                    "Subtype PARAGRAPH_OPINION (B1–B2 Opinion Paragraph, 100–150 từ): Bắt buộc có Topic Sentence nêu rõ quan điểm ngay câu đầu, ít nhất 2 luận điểm + ví dụ hỗ trợ trong 1 đoạn thống nhất, và Concluding Sentence khẳng định lại lập trường.";
                case "PARAGRAPH_ADV_DISADV" ->
                    "Subtype PARAGRAPH_ADV_DISADV (B1–B2 Advantages & Disadvantages Paragraph, 100–150 từ): Kiểm tra trình bày cân bằng cả mặt lợi (on the one hand / advantage) lẫn mặt hại (on the other hand / drawback) trong cùng một đoạn mạch lạc.";
                case "PARAGRAPH_CAUSE_EFFECT" ->
                    "Subtype PARAGRAPH_CAUSE_EFFECT (B1–B2 Cause & Effect Paragraph, 100–150 từ): Kiểm tra liên kết nhân–quả logic bằng các cấu trúc như because, lead to, result in, consequently, as a result.";
                case "PARAGRAPH_PROBLEM_SOLUTION" ->
                    "Subtype PARAGRAPH_PROBLEM_SOLUTION (B1–B2 Problem & Solution Paragraph, 100–150 từ): Kiểm tra việc nêu rõ thực trạng/vấn đề trước khi đề xuất giải pháp khả thi tương ứng.";
                default ->
                    "Subtype PARAGRAPH_GUIDED (Guided Single Paragraph, 40–180 từ theo đề): Đánh giá độ hoàn thành các câu hỏi gợi ý, Topic Sentence -> Supporting Sentences -> Concluding Sentence trong 01 đoạn duy nhất.";
            };
        }
        return switch (writingSubType) {
            case "TASK2_DISCUSSION" ->
                "Subtype TASK2_DISCUSSION (Discuss Both Views + Own Opinion, >= 250 từ): Bắt buộc phân tích công bằng cả 2 luồng quan điểm đối lập ở 2 Body paragraphs và thể hiện rõ quan điểm cá nhân (trong Mở bài/Kết bài hoặc Body).";
            case "TASK2_ADV_DISADV" ->
                "Subtype TASK2_ADV_DISADV (Advantages & Disadvantages Essay, >= 250 từ): Kiểm tra phân tích cả lợi ích lẫn bất lợi; nếu đề hỏi 'outweigh', bài viết phải kết luận rõ bên nào vượt trội hơn.";
            case "TASK2_PROBLEM_SOLUTION" ->
                "Subtype TASK2_PROBLEM_SOLUTION (Causes/Problems & Solutions Essay, >= 250 từ): Thân bài 1 làm rõ nguyên nhân/vấn đề, Thân bài 2 đề xuất giải pháp cụ thể tương xứng với vấn đề đã nêu.";
            case "TASK2_TWO_PART" ->
                "Subtype TASK2_TWO_PART (Two-Part / Direct Questions Essay, >= 250 từ): Bắt buộc trả lời trọn vẹn cả hai câu hỏi trong đề bài, mỗi câu hỏi trọng tâm triển khai thành một đoạn Thân bài riêng.";
            case "TASK2_DISCURSIVE_C1" ->
                "Subtype TASK2_DISCURSIVE_C1 (C1 Discursive Academic Essay, >= 250 từ): Đánh giá cao tư duy phản biện đa chiều, lập luận học thuật sâu (nominalization, nhượng bộ/phản đề), dẫn chứng xác đáng và ngôn ngữ C1–C2.";
            default ->
                "Subtype TASK2_OPINION (Agree / Disagree Essay, >= 250 từ): Kiểm tra Thesis Statement rõ ràng, lập trường nhất quán xuyên suốt từ Mở bài đến Kết luận và phát triển ý sâu kèm ví dụ.";
        };
    }

    private String buildWritingEvaluationUserPrompt(
            String writingTask,
            String writingSubType,
            String assignmentTitle,
            String promptText,
            String keyPoints,
            String rubrics,
            String essayText,
            int actualWordCount) {
        String taskModeLabel = switch (writingTask) {
            case WRITING_TASK_1 -> "TASK_1 (IELTS Academic Writing Task 1 — Báo cáo biểu đồ/bảng số liệu/quy trình/bản đồ, tối thiểu 150 từ, cần Overview & số liệu/bước mô tả, KHÔNG chấm theo chuẩn bài luận 250 từ)";
            case WRITING_TASK_PARAGRAPH -> "PARAGRAPH (Viết 01 đoạn văn ngắn hoặc Email theo giới hạn từ của đề bài, thường 40–150 từ; KHÔNG áp dụng mức phạt 250 từ hay yêu cầu 4 đoạn)";
            default -> "TASK_2 (IELTS Writing Task 2 / Discursive Essay — Bài luận nghị luận học thuật, tối thiểu 250 từ, bố cục 4 đoạn)";
        };
        String subTypeGuidance = buildWritingSubTypeRubricGuidance(writingTask, writingSubType);
        return String.format("""

                === DỮ LIỆU ĐỀ BÀI ===

                - Dạng bài Writing: %s

                - Phân loại chi tiết (Sub-type): %s

                - Tiêu chí riêng cho phân loại này: %s

                - Tiêu đề: "%s"

                - Đề bài: "%s"

                - Ý chính: "%s"

                - Tiêu chí: "%s"



                === BÀI VIẾT HỌC SINH (%d WORDS) ===

                "%s"



                YÊU CẦU CHẤM ĐIỂM CHUẨN IELTS:
                - 4 tiêu chí thành phần (taskAchievement.score, coherenceScore, vocabularyScore, grammarScore) chấm theo số NGUYÊN (1, 2, 3, 4, 5, 6, 7, 8, 9).
                - "overallBand" là trung bình cộng 4 tiêu chí, LÀM TRÒN XUỐNG đến nửa band gần nhất (ví dụ: (7+8+8+8)/4 = 7.75 -> 7.5).
                - Phân tích từng tiêu chí trong "criteriaDetails" (TR/TA, CC, LR, GRA) kèm "highlights" trích câu trong bài cần nâng cấp + câu viết lại mẫu, và gợi ý "Để lên band X".
                - Bổ sung bảng "suggestedVocabulary" gồm 10–14 collocations học thuật sát chủ đề kèm IPA, nghĩa tiếng Việt, ví dụ và ngữ cảnh dùng.
                - "correctedText" phải là BÀI VIẾT LẠI ĐẦY ĐỦ sau khi sửa lỗi/nâng cấp câu yếu.

                Return strictly JSON matching this schema:

                {

                  "writingTask": "%s",

                  "writingSubType": "%s",

                  "wordCount": %d,

                  "correctedWordCount": %d,

                  "isOffTopic": false,

                  "taskAchievement": {

                    "score": 6.0,

                    "addressedPoints": ["..."],

                    "missingPoints": ["..."]

                  },

                  "overallBand": 6.0,

                  "estimatedCefr": "B2",

                  "grammarScore": 6.0,

                  "vocabularyScore": 7.0,

                  "coherenceScore": 6.0,

                  "correctedText": "Toàn bộ bài viết đã sửa và nâng cấp...",

                  "mistakes": [
                    {
                      "original": "đoạn lỗi trong bài viết",
                      "correction": "cách sửa chuẩn",
                      "type": "grammar hoặc vocabulary hoặc punctuation hoặc spelling",
                      "explanation": "Hướng dẫn sửa chi tiết và nêu rõ cấu trúc ngữ pháp/quy tắc từ vựng"
                    }
                  ],
                  "suggestions": [
                    {
                      "area": "Cấu trúc ngữ pháp",
                      "recommendation": "Hướng dẫn cấu trúc ngữ pháp nâng cao nên áp dụng cho dạng bài này"
                    },
                    {
                      "area": "Từ vựng nâng cấp",
                      "recommendation": "Gợi ý các từ vựng C1/C2 hoặc collocations tự nhiên cho chủ đề này"
                    }
                  ],
                  "criteriaDetails": {
                    "TR": {
                      "code": "TR",
                      "name": "Task Response",
                      "band": 7.0,
                      "summary": "Nhận xét chi tiết bằng tiếng Việt cho tiêu chí này",
                      "nextBand": 8,
                      "nextBandAdvice": "Lời khuyên cụ thể để nâng lên band tiếp theo",
                      "highlights": [
                        {
                          "inEssay": "Câu gốc trích nguyên văn từ bài học sinh",
                          "rewritten": "Câu viết lại hoàn chỉnh chuẩn học thuật hơn",
                          "critique": "Giải thích điểm yếu của câu gốc bằng tiếng Việt",
                          "howToFix": "Hướng dẫn cách sửa cụ thể bằng tiếng Việt"
                        }
                      ]
                    }
                  },
                  "suggestedVocabulary": [
                    {
                      "word": "sustainable development",
                      "ipa": "/səˈsteɪ.nə.bəl dɪˈvel.əp.mənt/",
                      "meaning": "sự phát triển bền vững",
                      "example": "Sustainable development balances growth with environmental protection.",
                      "usageContext": "Dùng trong phần thân bài hoặc kết bài"
                    }
                  ],
                  "generalFeedback": "Nhận xét tổng quan 2–3 câu bằng tiếng Việt"

                }

                """, taskModeLabel, writingSubType, subTypeGuidance, assignmentTitle, promptText, keyPoints, rubrics,
                actualWordCount, essayText, writingTask, writingSubType, actualWordCount, actualWordCount);
    }

    private int countWritingWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        int count = 0;
        for (String tok : text.trim().split("\\s+")) {
            if (!tok.isEmpty() && tok.chars().anyMatch(Character::isLetterOrDigit)) {
                count++;
            }
        }
        return count;
    }

    private double roundToWholeBand(double val) {
        double clipped = clampBand(val);
        return Math.min(9.0, Math.max(1.0, (double) Math.round(clipped)));
    }

    private double floorToHalfBand(double val) {
        double clipped = clampBand(val);
        double floored = Math.floor(clipped * 2.0 + 1e-9) / 2.0;
        return Math.min(9.0, Math.max(1.0, floored));
    }

    private int resolveParagraphMinWords(
            String writingSubType,
            String promptText,
            String assignmentTitle,
            String rubrics) {
        String meta = ((rubrics != null ? rubrics : "") + " "
                + (assignmentTitle != null ? assignmentTitle : "") + " "
                + (promptText != null ? promptText : ""));
        java.util.regex.Matcher mRange = java.util.regex.Pattern
                .compile("(\\d{2,3})\\s*[-–~to]{1,4}\\s*(\\d{2,3})\\s*(?:từ|words)\\b", java.util.regex.Pattern.CASE_INSENSITIVE)
                .matcher(meta);
        if (mRange.find()) {
            int low = Integer.parseInt(mRange.group(1));
            if (low >= 20 && low <= 220) {
                return low;
            }
        }
        if ("PARAGRAPH_EMAIL".equals(writingSubType) || "PARAGRAPH_DESCRIPTIVE".equals(writingSubType)) {
            return 40;
        }
        String upper = meta.toUpperCase(java.util.Locale.ROOT);
        if (upper.contains("A1") || upper.contains("A2") || upper.contains("BEGINNER")) {
            return 40;
        }
        if ("PARAGRAPH_GUIDED".equals(writingSubType) && (meta.contains("120") || meta.contains("180") || upper.contains("B2"))) {
            return 120;
        }
        return 100;
    }

    private void calibrateWritingEvaluation(
            com.fasterxml.jackson.databind.node.ObjectNode resultNode,
            boolean usedLocalScorer,
            String resolvedWritingTask,
            String resolvedWritingSubType,
            String promptText,
            String essayText,
            int actualWordCount,
            String assignmentTitle,
            String rubrics) {
        resultNode.put("writingTask", resolvedWritingTask);
        if (!resultNode.hasNonNull("writingSubType") || resultNode.path("writingSubType").asText("").isBlank()) {
            resultNode.put("writingSubType", resolvedWritingSubType);
        }
        if (!resultNode.has("wordCount") || resultNode.path("wordCount").asInt(0) <= 0) {
            resultNode.put("wordCount", actualWordCount);
        }

        double overallBand = clampBand(resultNode.path("overallBand").asDouble(5.0));

        if (!usedLocalScorer) {
            overallBand = floorToHalfBand(overallBand);
            double graScore = roundToWholeBand(clampBand(resultNode.path("grammarScore").asDouble(overallBand)));
            double lrScore = roundToWholeBand(clampBand(resultNode.path("vocabularyScore").asDouble(overallBand)));
            double ccScore = roundToWholeBand(clampBand(resultNode.path("coherenceScore").asDouble(overallBand)));

            if (resultNode.has("grammarScore")) {
                resultNode.put("grammarScore", graScore);
            }
            if (resultNode.has("vocabularyScore")) {
                resultNode.put("vocabularyScore", lrScore);
            }
            if (resultNode.has("coherenceScore")) {
                resultNode.put("coherenceScore", ccScore);
            }

            double taScore = roundToWholeBand(overallBand);
            if (resultNode.path("taskAchievement").isObject()) {
                taScore = roundToWholeBand(clampBand(resultNode.path("taskAchievement").path("score").asDouble(overallBand)));
                ((com.fasterxml.jackson.databind.node.ObjectNode) resultNode.get("taskAchievement")).put("score", taScore);
            }

            boolean hasAnySubcriterion = resultNode.has("grammarScore")
                    || resultNode.has("vocabularyScore")
                    || resultNode.has("coherenceScore")
                    || resultNode.path("taskAchievement").isObject();
            if (hasAnySubcriterion) {
                overallBand = floorToHalfBand((taScore + ccScore + lrScore + graScore) / 4.0);
            }

            boolean viHeavy = hasHighVietnameseSpeechRatio(essayText);
            boolean parroting = actualWordCount < 65 && isParrotingPrompt(essayText, promptText);
            boolean offTopic = resultNode.path("isOffTopic").asBoolean(false) || viHeavy || parroting;
            if (offTopic) {
                resultNode.put("isOffTopic", true);
                overallBand = Math.min(overallBand, 4.0);
                taScore = Math.min(taScore, 3.0);
            }

            if (WRITING_TASK_2.equals(resolvedWritingTask)) {
                if (actualWordCount < 50) {
                    overallBand = Math.min(overallBand, 3.5);
                    taScore = Math.min(taScore, 3.0);
                } else if (actualWordCount < 120) {
                    overallBand = Math.min(overallBand, 4.5);
                    taScore = Math.min(taScore, 4.0);
                } else if (actualWordCount < 220) {
                    overallBand = Math.min(overallBand, 5.5);
                    taScore = Math.min(taScore, 5.0);
                }
            } else if (WRITING_TASK_1.equals(resolvedWritingTask)) {
                if (actualWordCount < 40) {
                    overallBand = Math.min(overallBand, 3.5);
                    taScore = Math.min(taScore, 3.0);
                } else if (actualWordCount < 90) {
                    overallBand = Math.min(overallBand, 4.5);
                    taScore = Math.min(taScore, 4.0);
                } else if (actualWordCount < 135) {
                    overallBand = Math.min(overallBand, 5.5);
                    taScore = Math.min(taScore, 5.0);
                }
            } else {
                int minParagraphWords = resolveParagraphMinWords(resolvedWritingSubType, promptText, assignmentTitle, rubrics);
                int severeFloor = Math.max(12, (int) Math.round(minParagraphWords * 0.45));
                int underFloor = Math.max(25, (int) Math.round(minParagraphWords * 0.80));
                if (actualWordCount < severeFloor) {
                    overallBand = Math.min(overallBand, 3.5);
                    taScore = Math.min(taScore, 3.0);
                } else if (actualWordCount < underFloor) {
                    overallBand = Math.min(overallBand, 5.0);
                    taScore = Math.min(taScore, 4.0);
                }
            }

            overallBand = floorToHalfBand(overallBand);
            taScore = roundToWholeBand(taScore);
            if (resultNode.path("taskAchievement").isObject()) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) resultNode.get("taskAchievement")).put("score", taScore);
            }
        } else {
            overallBand = roundToHalfBand(overallBand);
        }

        resultNode.put("overallBand", overallBand);
        if (!resultNode.has("correctedWordCount") && resultNode.hasNonNull("correctedText")) {
            String corr = resultNode.path("correctedText").asText("");
            if (!corr.isBlank()) {
                resultNode.put("correctedWordCount", countWritingWords(corr));
            }
        }
        if (!resultNode.has("overallScore") || !usedLocalScorer) {
            resultNode.put("overallScore", (int) Math.round((overallBand / 9.0) * 100.0));
        }
        if (!resultNode.has("isPassed") || !usedLocalScorer) {
            resultNode.put("isPassed", overallBand >= 5.0);
        }
        if (!resultNode.hasNonNull("estimatedCefr") || resultNode.path("estimatedCefr").asText("").isBlank()) {
            resultNode.put("estimatedCefr", mapBandToCefr(overallBand));
        }
    }

    private String mapBandToCefr(double band) {
        if (band >= 8.5) return "C2";
        if (band >= 7.0) return "C1";
        if (band >= 5.5) return "B2";
        if (band >= 4.0) return "B1";
        return "A2";
    }

    private WritingLlmResult generateWritingEvaluationJsonWithFallback(String writingTask, String userPrompt) {
        WritingPromptConfig config = resolveWritingPromptConfig(writingTask);
        try {
            String groqJson = groqClientService.chatCompletionJson(config.systemInstruction(), userPrompt);
            String cleanGroq = GroqClientService.stripMarkdown(groqJson);
            if (cleanGroq != null && !cleanGroq.isBlank() && !"{}".equals(cleanGroq.trim())) {
                return new WritingLlmResult(cleanGroq, config.groqEngine());
            }
            throw new RuntimeException("Groq LLaMA returned blank Writing JSON");
        } catch (RuntimeException groqEx) {
            log.warn("Groq Writing evaluation lỗi ({}), thử fallback sang Gemini...", groqEx.getMessage());
            try {
                String geminiJson = geminiClientService.generateWithSystemInstruction(
                        config.systemInstruction(), userPrompt);
                String cleanGemini = GeminiClientService.stripMarkdown(geminiJson);
                if (cleanGemini != null && !cleanGemini.isBlank() && !"{}".equals(cleanGemini.trim())) {
                    return new WritingLlmResult(cleanGemini, config.geminiEngine());
                }
            } catch (Exception geminiEx) {
                log.warn("Gemini Writing fallback cũng thất bại: {}", geminiEx.getMessage());
            }
            throw groqEx;
        }
    }

    private com.fasterxml.jackson.databind.node.ObjectNode mergeLocalScoresWithLlmFeedback(
            JsonNode localNode,
            JsonNode llmNode) {
        com.fasterxml.jackson.databind.node.ObjectNode merged = (com.fasterxml.jackson.databind.node.ObjectNode) localNode.deepCopy();
        if (llmNode.hasNonNull("correctedText") && !llmNode.path("correctedText").asText("").isBlank()) {
            merged.set("correctedText", llmNode.get("correctedText"));
            merged.put("correctedWordCount", countWritingWords(llmNode.path("correctedText").asText("")));
        }
        if (llmNode.has("mistakes") && llmNode.get("mistakes").isArray() && !llmNode.get("mistakes").isEmpty()) {
            merged.set("mistakes", llmNode.get("mistakes"));
        }
        if (llmNode.has("suggestions") && llmNode.get("suggestions").isArray() && !llmNode.get("suggestions").isEmpty()) {
            merged.set("suggestions", llmNode.get("suggestions"));
        }
        if (llmNode.path("criteriaDetails").isObject() && !llmNode.path("criteriaDetails").isEmpty()) {
            merged.set("criteriaDetails", llmNode.get("criteriaDetails"));
        }
        if (llmNode.path("suggestedVocabulary").isArray() && !llmNode.path("suggestedVocabulary").isEmpty()) {
            merged.set("suggestedVocabulary", llmNode.get("suggestedVocabulary"));
        }
        if (llmNode.hasNonNull("generalFeedback") && !llmNode.path("generalFeedback").asText("").isBlank()) {
            merged.set("generalFeedback", llmNode.get("generalFeedback"));
        }
        if (llmNode.path("taskAchievement").isObject() && merged.path("taskAchievement").isObject()) {
            com.fasterxml.jackson.databind.node.ObjectNode localTa =
                    (com.fasterxml.jackson.databind.node.ObjectNode) merged.get("taskAchievement");
            JsonNode llmTa = llmNode.get("taskAchievement");
            if (llmTa.path("addressedPoints").isArray() && !llmTa.path("addressedPoints").isEmpty()) {
                localTa.set("addressedPoints", llmTa.get("addressedPoints"));
            }
            if (llmTa.path("missingPoints").isArray() && !llmTa.path("missingPoints").isEmpty()) {
                localTa.set("missingPoints", llmTa.get("missingPoints"));
            }
        }
        merged.put("evaluatedBy", "PYTHON_WRITING_SCORER_HYBRID");
        return merged;
    }



    @Transactional

    @Override

    public AiGeneratedExercise generateQuizFromContent(String lessonContent, String targetCefr, int questionCount,

            UUID teacherId, UUID lessonId) {

        return generateQuizFromContent(lessonContent, targetCefr, questionCount, teacherId, lessonId, "MULTIPLE_CHOICE", null);

    }



    @Transactional

    @Override

    public AiGeneratedExercise generateQuizFromContent(String lessonContent, String targetCefr, int questionCount,

            UUID teacherId, UUID lessonId, String exerciseType) {

        return generateQuizFromContent(lessonContent, targetCefr, questionCount, teacherId, lessonId, exerciseType, null);

    }



    @Transactional

    @Override

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

            } else if (effectiveType.startsWith("SPEAKING")
                    || effectiveType.contains("SHADOWING")
                    || effectiveType.contains("QA")
                    || effectiveType.contains("PART_2")
                    || effectiveType.contains("PART2")
                    || effectiveType.contains("CUE")
                    || effectiveType.contains("PART_3")
                    || effectiveType.contains("PART3")) {

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

                } else if (effectiveType.contains("INVERSION")) {

                    effectiveType = "GRAMMAR_INVERSION";

                } else if (effectiveType.contains("NOMINAL")) {

                    effectiveType = "GRAMMAR_NOMINALISATION";

                } else if (effectiveType.contains("FILL") || effectiveType.contains("BLANK")) {

                    effectiveType = "GRAMMAR_FILL_IN_BLANK";

                } else if (effectiveType.contains("MIX")) {

                    effectiveType = "GRAMMAR_MIXED";

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

            if (effectiveType.contains("SHADOW")) {
                effectiveType = "SPEAKING_SHADOWING";
            } else if (effectiveType.contains("PART_2") || effectiveType.contains("PART2") || effectiveType.contains("CUE")) {
                effectiveType = "SPEAKING_PART_2";
            } else if (effectiveType.contains("PART_3") || effectiveType.contains("PART3") || effectiveType.contains("DISCUSS")) {
                effectiveType = "SPEAKING_PART_3";
            } else {
                effectiveType = "SPEAKING_QA";
            }

        }



        int rawCount = questionCount > 0 ? questionCount : 5;

        boolean isEssayWriting = "WRITING".equals(effectiveSkill)
                && !effectiveType.contains("WORD_ARRANGEMENT")
                && !effectiveType.contains("UNSCRAMBLE")
                && !effectiveType.contains("WORD_ORDER")
                && !effectiveType.contains("KEYWORD")
                && !effectiveType.contains("SENTENCE");

        int count = Math.min(rawCount, isEssayWriting ? 10 : 20);

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



            } else if (effectiveType.contains("PART_2") || effectiveType.contains("PART2") || effectiveType.contains("CUE")) {

                // IELTS Speaking Part 2 (Cue Card / Individual Long Turn 1-2 minutes):

                systemInstruction = """

                        You are an expert Cambridge and IELTS Speaking Examiner.

                        Generate %d authentic IELTS Speaking Part 2 Cue Cards suitable for CEFR level %s based on the topic or material.

                        CRITICAL RULES FOR SPEAKING PART 2 (CUE CARD):

                        1. "question" and "prompt" MUST be written 100%% in English (ZERO Vietnamese in "question" or "prompt") and formatted cleanly as an IELTS Cue Card:
                           Describe [specific topic/person/place/event/object].
                           You should say:
                           - [bullet point 1 in English]
                           - [bullet point 2 in English]
                           - [bullet point 3 in English]
                           and explain [analytical/reflective final bullet in English].

                        2. NEVER write Vietnamese translations, explanations, or numbering like (1), (2) inside "question" or "prompt".

                        3. "explanation": Brainstorming tips, structured outline (Intro -> Past/Detail -> Reflection), C1/C2 vocabulary & linking expressions in Vietnamese + English examples.

                        4. "correctAnswer": Required key ideas / rubric checkpoints (in Vietnamese or concise English) corresponding strictly to the Cue Card bullets so the AI evaluator checks completeness.

                        5. Set "questionType": "AUDIO_RESPONSE" and "speakingMode": "PART_2".

                        Return strictly valid JSON conforming to the schema:

                        {

                          "speakingMode": "PART_2",

                          "questions": [

                            {

                              "questionType": "AUDIO_RESPONSE",

                              "speakingMode": "PART_2",

                              "question": "Describe a useful skill you learned recently.\\nYou should say:\\n- what the skill is\\n- how you learned it\\n- why you decided to learn it\\nand explain how this skill helps you in daily life.",

                              "prompt": "Describe a useful skill you learned recently.\\nYou should say:\\n- what the skill is\\n- how you learned it\\n- why you decided to learn it\\nand explain how this skill helps you in daily life.",

                              "explanation": "Gợi ý dàn ý 2 phút (Bối cảnh -> Quá trình học -> Kết quả) và từ vựng nâng cấp bằng tiếng Việt",

                              "correctAnswer": "Phải nêu rõ: (1) kỹ năng là gì, (2) học bằng cách nào/ở đâu, (3) lý do chọn học, (4) lợi ích cụ thể trong cuộc sống"

                            }

                          ]

                        }

                        """.formatted(count, cefr);



                userPrompt = String.format("""

                        Exercise Mode: IELTS SPEAKING PART 2 (CUE CARD / INDIVIDUAL LONG TURN - 1 TO 2 MINUTES)

                        Target CEFR Level: %s

                        Number of Cue Cards: %d

                        Topic or Material:

                        "%s"

                        """, cefr, count, lessonContent);

            } else if (effectiveType.contains("PART_3") || effectiveType.contains("PART3") || effectiveType.contains("DISCUSS")) {

                // IELTS Speaking Part 3 (Two-Way Abstract / Analytical Discussion):

                systemInstruction = """

                        You are an expert Cambridge and IELTS Speaking Examiner.

                        Generate %d authentic IELTS Speaking Part 3 abstract discussion questions suitable for CEFR level %s based on the topic or material.

                        CRITICAL RULES FOR SPEAKING PART 3 (ABSTRACT DISCUSSION):

                        1. Questions MUST be abstract, analytical, society/future-oriented (comparing trends, causes & effects, pros & cons, policy/generation shifts), NOT simple personal Yes/No questions.

                        2. EVERY "question" and "prompt" MUST be written 100%% in English ending with '?'. NEVER translate the question into Vietnamese inside "question" or "prompt".

                        3. "explanation": Detailed guidance in Vietnamese on how to structure a Band 7.5+ PEEL response (Point -> Explain -> Example -> Link/Counter-argument), plus C1/C2 vocabulary & hedging phrases.

                        4. "correctAnswer": Core analytical points & reasoning directions the student should cover (tiêu chí ý chính cho AI chấm Task Achievement).

                        5. Set "questionType": "AUDIO_RESPONSE" and "speakingMode": "PART_3".

                        Return strictly valid JSON conforming to the schema:

                        {

                          "speakingMode": "PART_3",

                          "questions": [

                            {

                              "questionType": "AUDIO_RESPONSE",

                              "speakingMode": "PART_3",

                              "question": "To what extent do you think urban green spaces influence residents' mental well-being compared to entertainment facilities?",

                              "prompt": "To what extent do you think urban green spaces influence residents' mental well-being compared to entertainment facilities?",

                              "explanation": "Hướng dẫn trả lời theo cấu trúc PEEL (Luận điểm - Giải thích - Ví dụ - So sánh/Nhượng bộ) và từ vựng C1/C2 bằng tiếng Việt",

                              "correctAnswer": "Cần phân tích so sánh tác động sức khỏe tinh thần, nêu dẫn chứng cụ thể và cân nhắc hai mặt vấn đề."

                            }

                          ]

                        }

                        """.formatted(count, cefr);



                userPrompt = String.format("""

                        Exercise Mode: IELTS SPEAKING PART 3 (TWO-WAY ABSTRACT DISCUSSION)

                        Target CEFR Level: %s

                        Number of Discussion Questions: %d

                        Topic or Material:

                        "%s"

                        """, cefr, count, lessonContent);

            } else {

                // Luyện nói Hỏi - Đáp (Speaking Q&A / IELTS Part 1 Interview):

                systemInstruction = """

                        You are an expert Cambridge and IELTS Speaking Examiner.

                        Generate %d engaging speaking questions for an interactive Speaking Q&A / IELTS Part 1 Interview practice suitable for CEFR level %s based on the topic or material.

                        CRITICAL RULES FOR SPEAKING Q&A:

                        1. EVERY "question" and "prompt" MUST be 100%% in natural English and end with '?' — NEVER translate the question into Vietnamese and NEVER put Vietnamese rubrics or numbered checklists inside "question" or "prompt".

                        2. "explanation": Guidelines in Vietnamese: key vocabulary suggestions, recommended phrases, and sample answering structure.

                        3. "correctAnswer": Core key points / required ideas to address in Vietnamese or concise bullet points (Ý chính cần trả lời đúng trọng tâm câu hỏi để AI đối chiếu chấm Task Response xem học sinh trả lời đúng trọng tâm hay lạc đề).

                        4. Set "questionType": "AUDIO_RESPONSE" and "speakingMode": "QA".

                        Return strictly valid JSON conforming to the schema:

                        {

                          "speakingMode": "QA",

                          "questions": [

                            {

                              "questionType": "AUDIO_RESPONSE",

                              "speakingMode": "QA",

                              "question": "How do you usually relax after a busy day at school or work?",

                              "prompt": "How do you usually relax after a busy day at school or work?",

                              "explanation": "Hướng dẫn trả lời, từ vựng trọng tâm và cấu trúc câu mẫu bằng tiếng Việt",

                              "correctAnswer": "Nêu hoạt động thư giãn cụ thể, tần suất và lý do vì sao hoạt động đó giúp giảm căng thẳng."

                            }

                          ]

                        }

                        """.formatted(count, cefr);



                userPrompt = String.format("""

                        Exercise Mode: SPEAKING Q&A / PART 1 INTERVIEW (ENGLISH QUESTIONS ONLY)

                        Target CEFR Level: %s

                        Number of Speaking Questions: %d

                        Topic or Material:

                        "%s"

                        """, cefr, count, lessonContent);

            }



        } else if ("LISTENING".equals(effectiveSkill) || effectiveType.startsWith("LISTENING")) {

            // ================= KỸ NĂNG NGHE (LISTENING) THEO TỪNG DẠNG BÀI: NGHE CẢ ĐOẠN DÀI =================

            String wordCountGuideline = switch (cefr) {

                case "A1" -> "80-110 words. Basic everyday vocabulary, simple sentence structures, present tenses, clear familiar topics.";

                case "A2" -> "110-150 words. Past simple, future intentions, basic social interactions, directions, shopping, travel.";

                case "B1" -> "140-180 words. Concise announcements, travel anecdotes, work meetings, or 6-8 crisp dialogue turns with cause-and-effect connectors.";

                case "B2" -> "170-220 words. Focused presentations, campus discussions, natural idiomatic expressions, complex sentences.";

                default -> "200-260 words. Academic lectures, scientific discourse, subtle opinions, formal registers, higher-level vocabulary.";

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

            } else if (effectiveType.contains("MIX")) {

                // Dạng 4: Nghe tổng hợp (Kết hợp Trắc nghiệm hiểu ý & Nghe điền từ vào chỗ trống)

                systemInstruction = """

                    You are an expert Cambridge and IELTS Listening Examiner.

                    Create 1 complete, coherent English listening passage (%s words) for CEFR level %s based on the topic.

                    Vocabulary and sentence complexity must strictly reflect CEFR %s: %s



                    Then generate EXACTLY %d mixed Listening comprehension questions combining MULTIPLE_CHOICE (with 4 plausible choices, no 'A. ' prefix) and FILL_IN_BLANK (a concise note/sentence containing ONE blank '______' to fill with 1-2 exact words/numbers heard in the audio).

                    CRITICAL REQUIREMENTS:

                    1. "listeningPassage": The COMPLETE continuous audio passage (defined ONCE at root level).

                    2. "questions": MUST contain EXACTLY %d questions (roughly half MULTIPLE_CHOICE and half FILL_IN_BLANK).

                    3. Every "MULTIPLE_CHOICE" question MUST have 4 distinct "options" and "correctAnswer" MUST match one of them verbatim.

                    4. Every "FILL_IN_BLANK" question MUST have '______' in "prompt" and "correctAnswer" taken verbatim from the audio.

                    5. "explanation": Detailed Vietnamese explanation citing the sentence/clue in the listeningPassage and eliminating distractors.

                    Return strictly valid JSON with "listeningPassage" and "questions" array.

                    """.formatted(wordCountGuideline.split("\\.")[0], cefr, cefr, wordCountGuideline, count, count);

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

                    2. NATURAL SEMANTICS: Every sentence must be 100%% semantically logical and natural (never use inanimate nouns as agents of human/animate verbs).

                    3. EXACT WORD PARITY: Every single word in "correctAnswer" (including auxiliaries like do/does/did/not and exact inflections) MUST appear verbatim as a slash-separated token in "prompt", with zero missing, extra, or altered words.

                    4. DIVERSE STRUCTURES: Vary sentence lengths and structures (affirmative, negative, Wh- questions, frequency adverbs or time markers).

                    5. QUESTION FORMAT:

                       - "prompt": The exact words of "correctAnswer" scrambled in random order, separated by slashes '/': "Sắp xếp các từ sau thành câu hoàn chỉnh đúng cấu trúc: word1 / word2 / word3 / word4 / ."

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

                    Target Level: CEFR %s (%s).



                    CORE PEDAGOGICAL REQUIREMENTS:

                    1. 100%% TOPIC ANCHORING: The single grammatical error in each sentence MUST be directly related to the Target Grammar Topic ("%s") (e.g. wrong verb form, incorrect auxiliary verb, subject-verb disagreement, missing -s/-es).

                    2. NON-EXTREME & DIVERSE: Different error types within the topic. All OTHER parts of the sentence outside the single intentional error MUST be 100%% grammatically and lexically natural.

                    3. HIGH CREATIVITY: Varied, lifelike communicative sentences.

                    4. QUESTION FORMAT:

                       - "prompt": "Tìm và sửa 1 lỗi sai ngữ pháp trong câu sau (chỉ nhập từ đúng hoặc 'từ sai -> từ đúng'): [Sentence containing exactly ONE error]"

                       - "wrongWord": The exact erroneous word or short phrase appearing in the sentence.

                       - "correctAnswer": The exact corrected word or short phrase (the student grader will automatically accept either this word or 'wrongWord -> correctAnswer').

                       - "explanation": Detailed Vietnamese explanation pinpointing the mistake ('wrongWord'), explaining the exact grammar rule violated, and showing how 'correctAnswer' fixes it.

                       - "questionType": "FILL_IN_BLANK".

                    Return strictly valid JSON with an array 'questions'.

                    """.formatted(count, targetGrammarTopic, cefr, resolveCefrLinguisticGuideline(cefr), targetGrammarTopic);



            } else if (effectiveType.contains("INVERSION")) {

                // Dạng 4A: Đảo ngữ với phó từ phủ định / giới hạn (C1 / IELTS)

                systemInstruction = """

                    You are a Senior IELTS & Cambridge C1 Grammar Examiner.

                    Generate %d Inversion exercises (Negative / Limiting Adverbial Inversion: Not only... but also, Hardly... when, No sooner... than, Seldom, Never, Little, Under no circumstances, Only after/when...) focusing on "%s".

                    Target Level: CEFR %s (%s).



                    Mix transformation/gap-fill ("FILL_IN_BLANK" with '______') and 4-option "MULTIPLE_CHOICE" questions:

                    - For "FILL_IN_BLANK": "prompt" MUST provide the original or inverted sentence with '______' (e.g. "Rewrite using inversion: She rarely arrives late. -> Seldom ______ late.") and "correctAnswer" MUST be the exact inverted clause/words ("does she arrive").

                    - For "MULTIPLE_CHOICE": 4 distinct options without 'A. ' prefix; "correctAnswer" matches one option verbatim.

                    - "explanation": Clear Vietnamese analysis of the inversion rule (Auxiliary + Subject + Main Verb) and why distractors fail.

                    Return strictly valid JSON with an array 'questions'.

                    """.formatted(count, targetGrammarTopic, cefr, resolveCefrLinguisticGuideline(cefr));



            } else if (effectiveType.contains("NOMINAL")) {

                // Dạng 4B: Danh từ hóa học thuật (Academic Nominalisation C1 / IELTS)

                systemInstruction = """

                    You are a Senior IELTS Academic Writing & Grammar Specialist.

                    Generate %d Academic Nominalisation exercises transforming verbs/adjectives into formal noun phrases focusing on "%s".

                    Target Level: CEFR %s (%s).



                    Mix "FILL_IN_BLANK" (sentence transformation with '______', e.g. "Because the urban population grew rapidly, housing became scarce. -> Due to the rapid ______ of the urban population, housing became scarce.") and 4-option "MULTIPLE_CHOICE".

                    - Ensure every "FILL_IN_BLANK" has '______' and an unambiguous nominalised phrase in "correctAnswer".

                    - Ensure every "MULTIPLE_CHOICE" has 4 distinct options (no 'A. ' prefix) and "correctAnswer" matches one option verbatim.

                    - "explanation": Detailed Vietnamese explanation showing how the verb/adjective transforms into a formal noun phrase and why it elevates academic register.

                    Return strictly valid JSON with an array 'questions'.

                    """.formatted(count, targetGrammarTopic, cefr, resolveCefrLinguisticGuideline(cefr));



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

            // ================= KỸ NĂNG ĐỌC (READING) THEO TỪNG DẠNG BÀI & TRÌNH ĐỘ CEFR =================

            String readingWordRange = resolveReadingWordCountRange(cefr, lessonContent);
            String cefrReadingGuide = resolveCefrLinguisticGuideline(cefr);

            if (effectiveType.contains("FILL_BLANK") || effectiveType.contains("SHORT_ANSWER")) {

                // Dạng 1: Đọc hiểu điền từ theo dữ kiện / Trả lời câu hỏi ngắn

                systemInstruction = """

                    You are a Cambridge CEFR Reading Examiner.

                    Create an appropriate Reading Passage (%s words) for level %s (%s) based on the topic.

                    Generate %d questions where students must extract direct factual information or complete short answers:

                    - "readingPassage": The full reading text.

                    - "prompt": Factual question or sentence completion containing '______' (e.g. "Where does Anna work?" or "Anna moved to London in ______.").

                    - "correctAnswer": Exact concise factual answer (1-3 words) directly supported by the text.

                    - "explanation": Vietnamese explanation citing the exact sentence from the text.

                    - "questionType": "FILL_IN_BLANK".

                    ALL %d questions MUST be Fill In Blank / Short Answer!

                    Return strictly valid JSON with "readingPassage" and "questions" array.

                    """.formatted(readingWordRange, cefr, cefrReadingGuide, count, count);



            } else if (effectiveType.contains("TRUE_FALSE") || effectiveType.contains("YES_NO")) {

                // Dạng 2: Đọc hiểu True / False / Not Given hoặc Yes / No / Not Given (IELTS)

                boolean isYesNo = effectiveType.contains("YES_NO");
                String assessmentFocus = isYesNo
                        ? "YES / NO / NOT GIVEN assessing whether each statement agrees with the claims/opinions of the writer. (Note: output canonical correctAnswer as \"TRUE\" if it agrees/YES, \"FALSE\" if it contradicts/NO, or \"NOT GIVEN\" if impossible to know from the text)."
                        : "TRUE / FALSE / NOT GIVEN assessing factual information against the passage.";

                systemInstruction = """

                    You are an IELTS & Cambridge Reading Examiner.

                    Create a Reading Passage (%s words) for level %s (%s) based on the topic.

                    Generate %d statements for %s

                    Include at least one "TRUE", one "FALSE", and one "NOT GIVEN" (when %d >= 3) balanced across the set:

                    - "readingPassage": The full reading text.

                    - "prompt": %s

                    - "correctAnswer": Strictly "TRUE", "FALSE", or "NOT GIVEN".

                    - "explanation": Clear Vietnamese explanation quoting the exact evidence sentence from the passage (or explaining why the detail is absent for NOT GIVEN).

                    - "questionType": "TRUE_FALSE".

                    ALL %d questions MUST be TRUE_FALSE!

                    Return strictly valid JSON with "readingPassage" and "questions" array.

                    """.formatted(
                        readingWordRange, cefr, cefrReadingGuide, count, assessmentFocus, count,
                        isYesNo ? "Claim/opinion statement about the writer's view." : "Factual statement to evaluate.",
                        count
                    );



            } else if (effectiveType.contains("MATCH")) {

                // Dạng 3: Ghép nối tiêu đề / thông tin đoạn văn (Matching Headings & Features)

                systemInstruction = """

                    You are an IELTS Academic Reading Examiner.

                    Create a structured Reading Passage (%s words) for level %s (%s) clearly divided into labeled paragraphs: [Paragraph A], [Paragraph B], [Paragraph C], [Paragraph D] (or more if needed).

                    Generate %d Matching Headings / Feature-Matching questions (1 question per paragraph or key feature) in canonical MULTIPLE_CHOICE format so students select the single best matching heading/statement:

                    - "readingPassage": The full passage with [Paragraph A], [Paragraph B], [Paragraph C], [Paragraph D] labels.

                    - "prompt": Clear matching prompt (e.g., "Choose the most suitable heading for Paragraph A:" or "Which paragraph contains the following information: ...").

                    - "options": Exactly 4 distinct headings/statements (do NOT include 'i.', 'A.' prefixes inside option strings).

                    - "correctAnswer": Exact verbatim match with one of the 4 options.

                    - "explanation": Vietnamese explanation summarizing the paragraph's topic sentence and explaining why the 3 distractor headings are too narrow, too broad, or inaccurate.

                    - "questionType": "MULTIPLE_CHOICE".

                    Return strictly valid JSON with "readingPassage" and "questions" array.

                    """.formatted(readingWordRange, cefr, cefrReadingGuide, count);



            } else if (effectiveType.contains("PARAPHRASE")) {

                // Dạng 4: Nhận diện Paraphrasing & Suy luận học thuật

                systemInstruction = """

                    You are an expert IELTS Academic Reading Examiner.

                    Create an Academic Reading Passage (%s words) for level %s (%s).

                    Generate %d Multiple Choice questions specifically testing PARAPHRASING and INFERENCE (do not copy raw sentences from passage).

                    - "readingPassage": Full academic text.

                    - "prompt": Question testing synonym matching or underlying inference.

                    - "options": 4 distinct plausible choices (no 'A. ' prefix) with trap distractors.

                    - "correctAnswer": Exact verbatim match with one of the 4 options.

                    - "explanation": Vietnamese explanation highlighting synonym/paraphrase pairs between passage and answer, and why the 3 distractors are traps.

                    - "questionType": "MULTIPLE_CHOICE".

                    Return strictly valid JSON with "readingPassage" and "questions" array.

                    """.formatted(readingWordRange, cefr, cefrReadingGuide, count);



            } else if (effectiveType.contains("MIX")) {

                // Dạng 5: Tổng hợp Đọc hiểu (Kết hợp Trắc nghiệm, True/False/Not Given và Điền từ)

                systemInstruction = """

                    You are an expert Cambridge and IELTS Reading Examiner.

                    Create a cohesive Reading Passage (%s words) for level %s (%s) based on the topic.

                    Generate EXACTLY %d mixed comprehension questions combining:

                    1. MULTIPLE_CHOICE (main idea / inference, 4 distinct options without 'A. ' prefix, exact correctAnswer).

                    2. TRUE_FALSE (statements evaluated as strictly "TRUE", "FALSE", or "NOT GIVEN").

                    3. FILL_IN_BLANK (factual sentence completion containing '______' with 1-3 word answer taken from the text).

                    For EVERY question, include "explanation" in clear Vietnamese quoting evidence from the readingPassage.

                    Return strictly valid JSON with "readingPassage" and "questions" array.

                    """.formatted(readingWordRange, cefr, cefrReadingGuide, count);



            } else {

                // Dạng 6: Trắc nghiệm đọc hiểu chi tiết & ý chính

                systemInstruction = """

                    You are an expert Cambridge and IELTS Reading Examiner.

                    Create an engaging Reading Passage (%s words) for level %s (%s) based on the topic.

                    Generate %d Multiple Choice comprehension questions testing main idea, specific details, and author attitude.

                    - "readingPassage": The reading text.

                    - "prompt": Comprehension question.

                    - "options": 4 distinct plausible choices (no 'A. ' prefix).

                    - "correctAnswer": Exact verbatim match with one of the 4 options.

                    - "explanation": Detailed Vietnamese explanation citing the passage and explaining why the distractors are incorrect.

                    - "questionType": "MULTIPLE_CHOICE".

                    Return strictly valid JSON with "readingPassage" and "questions" array.

                    """.formatted(readingWordRange, cefr, cefrReadingGuide, count);

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

                // Dạng 5: Nối từ với nghĩa (Word-Definition Matching) chuẩn theo CEFR

                int pairCount = Math.max(5, Math.min(8, count > 0 ? count : 6));
                boolean isElementary = "A1".equalsIgnoreCase(cefr) || "A2".equalsIgnoreCase(cefr);
                String matchingRule = isElementary
                        ? "- Từ vựng PHẢI thuộc nhóm từ cốt lõi CEFR %s dễ gặp hàng ngày. KHÔNG dùng từ học thuật C1/C2 như resilient, meticulous.\n- Mỗi cặp gồm: word (từ vựng), ipa (phiên âm IPA chuẩn), meaning (nghĩa tiếng Việt ngắn gọn, rõ ràng kèm loại từ, ví dụ: \"(n) Nhà bếp - phòng nấu ăn\"), explanation (giải thích nghĩa tiếng Việt + 1 câu ví dụ đơn giản kèm dịch)."
                        : "- Từ vựng PHẢI chuẩn trình độ CEFR %s (%s).\n- Mỗi cặp gồm: word (từ vựng), ipa (phiên âm IPA chuẩn), meaning (nghĩa tiếng Việt ngắn gọn kèm sắc thái hoặc định nghĩa súc tích không lặp lại từ gốc, ví dụ: \"Kiên cường, có khả năng phục hồi nhanh (able to recover quickly)\"), explanation (từ loại, ví dụ ngữ cảnh chuẩn ngữ pháp và giải thích chi tiết bằng tiếng Việt).";
                String formattedMatchingRule = isElementary
                        ? String.format(matchingRule, cefr)
                        : String.format(matchingRule, cefr, resolveCefrLinguisticGuideline(cefr));
                String exampleJson = isElementary
                        ? """
                    {
                      "title": "Vocabulary Matching Exercise",
                      "type": "MATCHING",
                      "pairs": [
                        {
                          "id": "1",
                          "word": "kitchen",
                          "ipa": "/ˈkɪtʃ.ɪn/",
                          "meaning": "(n) Nhà bếp - phòng để nấu ăn",
                          "explanation": "/ˈkɪtʃ.ɪn/ (n): Nhà bếp. Ví dụ: My mother is cooking dinner in the kitchen. (Mẹ tôi đang nấu bữa tối trong bếp.)"
                        },
                        {
                          "id": "2",
                          "word": "library",
                          "ipa": "/ˈlaɪ.brər.i/",
                          "meaning": "(n) Thư viện - nơi đọc và mượn sách",
                          "explanation": "/ˈlaɪ.brər.i/ (n): Thư viện. Ví dụ: Students often study quietly in the school library. (Học sinh thường học bài yên tĩnh trong thư viện trường.)"
                        }
                      ]
                    }"""
                        : """
                    {
                      "title": "Vocabulary Matching Exercise",
                      "type": "MATCHING",
                      "pairs": [
                        {
                          "id": "1",
                          "word": "sustainable",
                          "ipa": "/səˈsteɪ.nə.bəl/",
                          "meaning": "Bền vững, không gây hại môi trường (able to continue over time)",
                          "explanation": "/səˈsteɪ.nə.bəl/ (adj): Bền vững. Collocation: sustainable development. Ví dụ: Solar power offers a sustainable alternative to fossil fuels."
                        },
                        {
                          "id": "2",
                          "word": "innovative",
                          "ipa": "/ˈɪn.ə.veɪ.tɪv/",
                          "meaning": "Đổi mới, sáng tạo (introducing new ideas or methods)",
                          "explanation": "/ˈɪn.ə.veɪ.tɪv/ (adj): Có tính đổi mới. Ví dụ: The company launched an innovative recycling program."
                        }
                      ]
                    }""";

                systemInstruction = """

                    Bạn là chuyên gia giáo dục tiếng Anh Cambridge/IELTS. Nhiệm vụ của bạn là tạo một bài tập nối từ vựng (Vocabulary Matching Exercise).

                    Yêu cầu:

                    - Trình độ CEFR mục tiêu: %s.

                    - Tạo đúng %d cặp từ vựng - nghĩa đối ứng 1-1 duy nhất theo chủ đề được yêu cầu (không để hai từ dùng nghĩa giống nhau gây mơ hồ).

                    %s

                    - Tuyệt đối KHÔNG sinh các phương án lựa chọn gây nhiễu A, B, C, D cho từng từ.

                    - Định dạng trả về BẮT BUỘC là JSON hợp lệ theo schema sau (không thêm markdown ngoài khối JSON):

                    %s

                    Tất cả các cặp từ phải đối ứng 1-1 chính xác, tuyệt đối không tạo các lựa chọn trắc nghiệm A, B, C, D.

                    """.formatted(cefr, pairCount, formattedMatchingRule, exampleJson);



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

                // Dạng 4: IELTS Writing Task 1 (150 từ - Data Chart / Process Diagram / Map Comparison)

                String task1Focus = effectiveType.contains("PROCESS")
                        ? "Focus strictly on Process / Flow Chart diagrams (manufacturing stages or natural cycles)."
                        : effectiveType.contains("MAP")
                        ? "Focus strictly on Map Comparison / Floor Plan redevelopment across two time periods."
                        : "Vary across Data Charts (Bar Chart, Line Graph, Pie Chart, Table), Process Diagrams, and Map Comparisons.";
                String task1ExplanationSpec = (count > 1)
                        ? "4 concise bullet points in Vietnamese (Introduction, Overview, Body 1, Body 2 + key vocabulary)."
                        : "Recommended 4-paragraph structure (Introduction, Overview, Body 1, Body 2), key vocabulary (trend/data comparison, process sequencing/passive, or spatial map verbs), and grouping advice in Vietnamese.";
                String task1AnswerSpec = (count > 1)
                        ? "Clear Overview + 1 concise Body paragraph highlighting key data/stages (approx 80-110 words)."
                        : "Band 8.5+ model response with clear Overview and accurate comparisons/stages.";

                systemInstruction = """

                    You are an official IELTS Academic Writing Task 1 Senior Examiner.

                    Generate %d authentic IELTS Writing Task 1 prompts (%s):

                    - "prompt": Full authentic IELTS Academic Task 1 question. Include explicit visual/chart/process/map data points, categories, stages, or spatial layout details plus time periods, and end with: "Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words."

                    - "explanation": %s

                    - "correctAnswer": %s

                    - "questionType": "ESSAY".

                    CRITICAL RULES:

                    - NEVER generate fill-in-the-blanks with '___' or single sentences!

                    - This is a full IELTS Academic Task 1 report requiring at least 150 words.

                    Return strictly valid JSON with an array 'questions'.

                    """.formatted(count, task1Focus, task1ExplanationSpec, task1AnswerSpec);

            } else if (effectiveType.contains("DISCURSIVE") || effectiveType.contains("TASK_2") || effectiveType.contains("TASK2")) {

                // Dạng 5: IELTS Writing Task 2 / C1 Discursive Academic Essay (250+ từ)

                String essayStyleDesc = effectiveType.contains("DISCURSIVE")
                        ? "C1 Discursive Academic Essay exploring multi-dimensional societal, scientific, or ethical perspectives using formal academic argumentation"
                        : "authentic IELTS Writing Task 2 essay (Opinion, Discussion Both Views, Advantages/Disadvantages Outweigh, Problem/Solution, or Two-Part Question)";
                String essayExplanationSpec = (count > 1)
                        ? "5 concise Vietnamese bullet points: 1. Dạng đề & luận điểm, 2. Ý hai chiều ngắn gọn, 3. Dàn ý 4 đoạn, 4. Collocations C1 tiêu biểu, 5. Tiêu chí chấm (TR, CC, LR, GRA)."
                        : "5-step scaffolding guide in Vietnamese: 1. Phân tích đề bài & dạng câu hỏi, 2. Brainstorming 2 chiều, 3. Dàn ý 4 đoạn (Intro, Body 1, Body 2, Conclusion), 4. Từ vựng & Collocations học thuật C1, 5. Tiêu chuẩn 4 tiêu chí chấm (TR, CC, LR, GRA).";
                String essayAnswerSpec = (count > 1)
                        ? "Clear Thesis Statement + 1 concise Band 8.5+ Body paragraph demonstrating C1 argumentation (approx 90-120 words)."
                        : "Band 8.5+ model essay with clear thesis statement, nuanced analysis, and well-developed arguments.";

                systemInstruction = """

                    You are an official IELTS & C1 Academic Writing Senior Examiner.

                    Generate %d %s prompts:

                    - "prompt": Full authentic academic essay prompt with a controversial statement or multi-dimensional issue, followed by a clear question (e.g. "To what extent do you agree or disagree?", "Discuss both views and give your opinion", or a C1 discursive evaluation prompt). Conclude with: "Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words."

                    - "explanation": %s

                    - "correctAnswer": %s

                    - "questionType": "ESSAY".

                    CRITICAL RULES:

                    - NEVER generate fill-in-the-blanks with '___' or single incomplete sentences!

                    - This is an authentic 250+ word academic essay.

                    Return strictly valid JSON with an array 'questions'.

                    """.formatted(count, essayStyleDesc, essayExplanationSpec, essayAnswerSpec);

            } else if (effectiveType.contains("SHORT_EMAIL") || effectiveType.contains("EMAIL")) {

                // Dạng 6: Viết Email / Tin nhắn ngắn (A1-A2, 40-80 từ)

                int minWords = 40;

                int maxWords = ("B1".equalsIgnoreCase(cefr) || "B2".equalsIgnoreCase(cefr)) ? 100 : 80;
                String emailExplanationSpec = (count > 1)
                        ? "3 concise Vietnamese points: 1. Lời chào mở đầu, 2. Trả lời đủ 3 ý gợi ý, 3. Kết thư & mẫu câu hữu ích."
                        : "Practical email structure guide in Vietnamese: 1. Lời chào mở đầu (Hi/Dear...), 2. Thân bài trả lời đủ 3 ý gợi ý, 3. Kết thư & ký tên (Best regards/See you...), kèm mẫu câu giao tiếp hữu ích.";

                systemInstruction = """

                    You are an expert Cambridge Practical Writing Instructor for CEFR %s.

                    Generate %d realistic Short Email / Message writing tasks (%d–%d words):

                    - "prompt": Clear communicative context telling the learner who to write to and 3 specific bullet points they must cover (e.g. greeting/reason, details such as time/place/activity, closing question/suggestion). Explicitly end with: "Write an email/message of %d–%d words."

                    - "explanation": %s

                    - "correctAnswer": %s

                    - "questionType": "ESSAY".

                    CRITICAL RULES:

                    - This is a communicative SHORT EMAIL (%d–%d words), NOT an academic essay.

                    - NEVER generate fill-in-the-blanks '___'.

                    Return strictly valid JSON with an array 'questions'.

                    """.formatted(cefr, count, minWords, maxWords, minWords, maxWords, emailExplanationSpec,
                            (count > 1 ? "Concise natural model email" : "Natural model email") + String.format(" (%d–%d words) covering all bullet points at CEFR %s level.", minWords, maxWords, cefr),
                            minWords, maxWords);

            } else {

                // Dạng 7: Viết đoạn văn (Descriptive A1-A2 40-80w, B1-B2 Opinion/Adv-Disadv/Cause-Effect/Problem-Solution 100-150w, Guided Paragraph 40-180w)

                boolean isLowLevel = "A1".equalsIgnoreCase(cefr) || "A2".equalsIgnoreCase(cefr) || effectiveType.contains("DESCRIPTIVE");

                int minWords = isLowLevel ? 40 : ("B2".equalsIgnoreCase(cefr) && !effectiveType.contains("OPINION") && !effectiveType.contains("ADV_DISADV") && !effectiveType.contains("CAUSE_EFFECT") && !effectiveType.contains("PROBLEM_SOLUTION") ? 120 : 100);

                int maxWords = isLowLevel ? 80 : (minWords == 120 ? 180 : 150);

                String formatDesc = effectiveType.contains("DESCRIPTIVE") ? "Descriptive / Narrative Short Paragraph (Miêu tả / Kể chuyện ngắn)"

                        : effectiveType.contains("OPINION") ? "Opinion Paragraph (Nêu quan điểm cá nhân)"

                        : effectiveType.contains("ADV_DISADV") ? "Advantages & Disadvantages Paragraph (Lợi ích và Bất lợi)"

                        : effectiveType.contains("CAUSE_EFFECT") ? "Cause & Effect Paragraph (Nguyên nhân và Hệ quả)"

                        : effectiveType.contains("PROBLEM_SOLUTION") ? "Problem & Solution Paragraph (Thực trạng và Giải pháp)"

                        : "Guided Academic Paragraph (Viết một đoạn văn hoàn chỉnh theo gợi ý)";
                String paragraphExplanationSpec = (count > 1)
                        ? "Concise cohesion tips in Vietnamese (Topic sentence, 2-3 supporting points, Concluding sentence + key linking words)."
                        : "Cohesion guidance in Vietnamese: Topic sentence formulation, 2-3 supporting arguments, concluding sentence, and a list of useful linking words (e.g. Firstly, In addition, However, For instance, Therefore, In conclusion).";

                systemInstruction = """

                    You are an expert Cambridge Writing Instructor for CEFR %s.

                    Generate %d %s writing prompts:

                    - "prompt": A clear, engaging prompt asking the learner to write ONE single cohesive paragraph (%d–%d words). Provide 2-3 guiding questions or bullet points to help structure their ideas (1. Topic sentence, 2. Supporting details & examples, 3. Concluding sentence). Explicitly state: "Viết 01 đoạn văn hoàn chỉnh (%d–%d từ) về chủ đề trên."

                    - "explanation": %s

                    - "correctAnswer": %s

                    - "questionType": "ESSAY".

                    CRITICAL RULES:

                    - The task is for a SINGLE PARAGRAPH (%d–%d words), NOT a multi-paragraph IELTS essay.

                    - NEVER generate fill-in-the-blanks '___' or single sentence tasks.

                    Return strictly valid JSON with an array 'questions'.

                    """.formatted(cefr, count, formatDesc, minWords, maxWords, minWords, maxWords, paragraphExplanationSpec,
                            (count > 1 ? "Concise high-scoring model single paragraph" : "High-scoring model single paragraph") + String.format(" (%d–%d words) demonstrating good cohesion and appropriate CEFR %s vocabulary.", minWords, maxWords, cefr),
                            minWords, maxWords);

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



        // Tiêm quy tắc bắt buộc để AI tuân thủ tuyệt đối kỹ năng, cấp độ CEFR và kiểm soát chất lượng

        String mandatorySkillGuard = String.format("""

            [QUY TẮC BẮT BUỘC VỀ KỸ NĂNG, TRÌNH ĐỘ VÀ CHẤT LƯỢNG]:

            - Bạn PHẢI sinh nội dung bài tập 100%% hoàn toàn thuộc kỹ năng %s với định dạng %s ở cấp độ CEFR %s (%s).

            - TUYỆT ĐỐI CẤM sinh bài tập thuộc kỹ năng khác (Ví dụ: Nếu kỹ năng là %s, CẤM sinh bài đọc hiểu READING PASSAGE hay kỹ năng khác).

            - CHẤT LƯỢNG NGỮ PHÁP & TỪ VỰNG: Mọi câu tiếng Anh, đoạn văn và phương án nhiễu PHẢI hoàn toàn tự nhiên, đúng ngữ pháp và chính tả 100%% (ngoại trừ đúng 1 lỗi cố ý trong dạng bài ERROR_CORRECTION). Từ vựng và cấu trúc ngữ pháp phải đúng chuẩn CEFR %s.

            - CHÍNH XÁC ĐÁP ÁN: Với MULTIPLE_CHOICE, 4 phương án trong "options" PHẢI khác nhau hoàn toàn, chỉ có DUY NHẤT 1 phương án đúng, KHÔNG ghi tiền tố "A. ", "B. ", "C. ", "D. " vào đầu chuỗi trong "options", và "correctAnswer" PHẢI khớp chính xác từng ký tự với một phần tử trong "options" (tuyệt đối không chỉ ghi "A" hoặc "B").

            - Ô TRỐNG CHUẨN: Mọi câu điền từ FILL_IN_BLANK dạng hoàn thành câu PHẢI chứa đúng ký hiệu '______' (6 dấu gạch dưới) tại vị trí cần điền.

            - LỜI GIẢI THÍCH SƯ PHẠM ("explanation"): PHẢI viết bằng tiếng Việt rõ ràng, chính xác, nêu rõ: (1) Đáp án đúng là gì, (2) Quy tắc ngữ pháp / nghĩa từ vựng / trích dẫn dẫn chứng trong bài đọc-nghe, (3) Lý do các phương án nhiễu còn lại không phù hợp.

            """, effectiveSkill, effectiveType, cefr, resolveCefrLinguisticGuideline(cefr), effectiveSkill, cefr);

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



        // 1. Thử gọi Groq tốc độ cao (nhiệt độ 0.3 tuân thủ nghiêm ngặt kỹ năng và cấu trúc JSON)

        try {

            rawJson = groqClientService.chatCompletionJson(systemInstruction, userPrompt, 0.3, teacherId, true);

        } catch (org.springframework.web.server.ResponseStatusException rse) {

            throw rse;

        } catch (Exception e) {

            log.warn("Groq quiz generation failed: {}, attempting Gemini fallback...", e.getMessage());

            lastError = e;

        }



        // 2. Xác thực & phục hồi JSON; nếu Groq lỗi HOẶC trả JSON rỗng/hỏng/thiếu câu hỏi -> fallback sang Gemini

        String normalizedJson = extractAndNormalizeQuizJson(rawJson);

        if (normalizedJson == null) {

            if (rawJson != null && !rawJson.isBlank() && lastError == null) {

                log.warn("Groq trả về cấu trúc JSON bài tập chưa hợp lệ (len={}), thử fallback sang Gemini...", rawJson.length());

                lastError = new IllegalStateException("Groq trả về cấu trúc JSON chưa có câu hỏi hợp lệ.");

            }

            try {

                String geminiRaw = geminiClientService.generateWithSystemInstruction(systemInstruction, userPrompt, 0.3, teacherId, true);

                normalizedJson = extractAndNormalizeQuizJson(geminiRaw);

                if (normalizedJson == null && geminiRaw != null && !geminiRaw.isBlank()) {

                    lastError = new IllegalStateException("Gemini trả về cấu trúc JSON chưa có câu hỏi hợp lệ.");

                }

            } catch (org.springframework.web.server.ResponseStatusException rse) {

                throw rse;

            } catch (Exception e) {

                log.error("Gemini quiz generation also failed: {}", e.getMessage());

                if (lastError == null) {

                    lastError = e;

                } else {

                    lastError = new RuntimeException("Groq: " + lastError.getMessage() + " | Gemini: " + e.getMessage(), e);

                }

            }

        }



        // 3. Nếu không hợp lệ: cập nhật trạng thái REJECTED và BÁO LỖI (KHÔNG MOCK)

        if (normalizedJson == null) {

            exercise.setStatus(GenerationStatus.REJECTED);

            aiGeneratedExerciseRepository.save(exercise);

            String reason = lastError != null ? lastError.getMessage() : "Mô hình AI không phản hồi danh sách câu hỏi hợp lệ.";

            throw new BadRequestException("Không thể tạo bài tập từ AI: " + reason);

        }

        rawJson = normalizedJson;



        // 5.0. Chuẩn hóa cấu trúc hai chiều cho bài tập MATCHING (đảm bảo đồng thời có pairs và questions)

        try {

            JsonNode rootNode = objectMapper.readTree(rawJson);

            if (rootNode.isObject()) {

                com.fasterxml.jackson.databind.node.ObjectNode rootObj = (com.fasterxml.jackson.databind.node.ObjectNode) rootNode;

                boolean hasQuestions = rootObj.has("questions") && rootObj.get("questions").isArray() && rootObj.get("questions").size() > 0;

                boolean hasPairs = rootObj.has("pairs") && rootObj.get("pairs").isArray() && rootObj.get("pairs").size() > 0;



                if (hasPairs && !hasQuestions) {

                    rootObj.put("type", "MATCHING");

                    com.fasterxml.jackson.databind.node.ArrayNode questionsNode = objectMapper.createArrayNode();

                    JsonNode pairsNode = rootObj.get("pairs");

                    int idx = 1;

                    for (JsonNode pairNode : pairsNode) {

                        com.fasterxml.jackson.databind.node.ObjectNode qObj = objectMapper.createObjectNode();

                        String word = pairNode.path("word").asText(pairNode.path("leftText").asText("Word " + idx));

                        String ipa = pairNode.path("ipa").asText("");

                        String meaning = pairNode.path("meaning").asText(pairNode.path("rightText").asText(""));

                        String pId = pairNode.path("id").asText(String.valueOf(idx));



                        qObj.put("id", pId);

                        qObj.put("orderIndex", idx);

                        qObj.put("questionType", "MATCHING");

                        qObj.put("targetWord", word);

                        qObj.put("word", word);

                        qObj.put("ipa", ipa);

                        qObj.put("prompt", word);

                        qObj.put("promptText", word);

                        qObj.put("correctAnswer", meaning);

                        qObj.put("meaning", meaning);

                        String pairExpl = pairNode.path("explanation").asText("").trim();
                        String defaultPairExpl = !ipa.isBlank() ? (ipa + " - " + meaning) : meaning;
                        if (pairExpl.isBlank()) {
                            qObj.put("explanation", defaultPairExpl);
                        } else {
                            qObj.put("explanation", pairExpl);
                        }

                        qObj.putArray("options");

                        questionsNode.add(qObj);

                        idx++;

                    }

                    rootObj.set("questions", questionsNode);

                    rawJson = objectMapper.writeValueAsString(rootObj);

                } else if (hasQuestions && !hasPairs && ("MATCHING".equalsIgnoreCase(rootObj.path("type").asText()) || effectiveType.contains("MATCH"))) {

                    com.fasterxml.jackson.databind.node.ArrayNode pairsNode = objectMapper.createArrayNode();

                    JsonNode questionsNode = rootObj.get("questions");

                    int idx = 1;

                    for (JsonNode qItem : questionsNode) {

                        com.fasterxml.jackson.databind.node.ObjectNode pairObj = objectMapper.createObjectNode();

                        String word = qItem.path("word").asText(qItem.path("targetWord").asText(qItem.path("prompt").asText(qItem.path("promptText").asText("Word " + idx))));

                        String ipa = qItem.path("ipa").asText("");

                        String meaning = qItem.path("correctAnswer").asText(qItem.path("meaning").asText(""));

                        String pId = qItem.path("id").asText(String.valueOf(idx));



                        pairObj.put("id", pId);

                        pairObj.put("wordId", pId);

                        pairObj.put("meaningId", pId);

                        pairObj.put("word", word);

                        pairObj.put("leftText", word);

                        pairObj.put("ipa", ipa);

                        pairObj.put("meaning", meaning);

                        pairObj.put("rightText", meaning);

                        pairsNode.add(pairObj);

                        idx++;

                    }

                    rootObj.set("pairs", pairsNode);

                    rootObj.put("type", "MATCHING");

                    rawJson = objectMapper.writeValueAsString(rootObj);

                }

            }

        } catch (Exception e) {

            log.warn("Lỗi khi chuẩn hóa cấu trúc pairs/questions cho MATCHING: {}", e.getMessage());

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



        // 5.2. Hậu kiểm & chuẩn hóa dữ liệu sinh bởi AI (đáp án, options, TRUE/FALSE/NOT GIVEN, Error Correction, explanation)

        rawJson = sanitizeAndValidateQuestionsJson(rawJson, effectiveSkill, effectiveType, cefr);



        // 6. Tự động xử lý Audio: CHỈ cho VOCABULARY (nghe từ vựng) và LISTENING (nghe cả đoạn/câu)

        if (effectiveType.startsWith("VOCAB") || effectiveType.startsWith("VOCABULARY")) {

            try {

                JsonNode root = objectMapper.readTree(rawJson);

                JsonNode questionsNode = root.get("questions");

                if (questionsNode != null && questionsNode.isArray()) {

                    boolean hasEnriched = false;

                    long dictDeadlineMs = System.currentTimeMillis() + 10_000L;

                    int dictFailureCount = 0;

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



                                    if ((ipa == null || ipa.isBlank()) && dictFailureCount < 2 && System.currentTimeMillis() < dictDeadlineMs) {

                                        try {

                                            DictionaryLookupService.DictionaryEntryDto dictEntry = dictionaryLookupService.lookup(cleanWord);

                                            if (dictEntry != null && dictEntry.getIpa() != null && !dictEntry.getIpa().isBlank()) {

                                                ipa = dictEntry.getIpa();

                                                qObj.put("ipa", ipa);

                                            }

                                        } catch (Exception ex) {

                                            dictFailureCount++;

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

                    long ttsDeadlineMs = System.currentTimeMillis() + 20_000L;

                    boolean ttsAvailable = true;

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

                                if (ttsAvailable && System.currentTimeMillis() < ttsDeadlineMs) {

                                    try {

                                        String kokoroUrl = exerciseAudioService.synthesizeRawScriptToUrl(cleanSentence, "af_heart", 1.0);

                                        if (kokoroUrl != null && !kokoroUrl.isBlank()) {

                                            qObj.put("audioUrl", kokoroUrl);

                                            qObj.put("mediaUrl", kokoroUrl);

                                        }

                                    } catch (Exception ttsEx) {

                                        ttsAvailable = false;

                                        log.warn("Không thể tạo trước Kokoro audio cho câu Shadowing '{}': {}", cleanSentence, ttsEx.getMessage());

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

                log.warn("Không thể chuẩn hóa câu mẫu cho Speaking Shadowing: {}", ex.getMessage());

            }

        } else if ("SPEAKING".equals(effectiveSkill)) {

            // Cho SPEAKING Q&A, PART_2 và PART_3: tuyệt đối không gắn audio mẫu hoặc transcript rubric tiếng Việt

            try {

                String nonShadowMode = effectiveType.contains("PART_2") ? "PART_2"
                        : (effectiveType.contains("PART_3") ? "PART_3" : "QA");

                JsonNode root = objectMapper.readTree(rawJson);

                if (root.isObject()) {

                    ((com.fasterxml.jackson.databind.node.ObjectNode) root).put("speakingMode", nonShadowMode);

                    ((com.fasterxml.jackson.databind.node.ObjectNode) root).remove("audioUrl");

                    ((com.fasterxml.jackson.databind.node.ObjectNode) root).remove("mediaUrl");

                }

                JsonNode questionsNode = root.get("questions");

                if (questionsNode != null && questionsNode.isArray()) {

                    for (JsonNode qItem : questionsNode) {

                        if (qItem.isObject()) {

                            com.fasterxml.jackson.databind.node.ObjectNode qObj = (com.fasterxml.jackson.databind.node.ObjectNode) qItem;

                            String p = qObj.path("prompt").asText("").trim();

                            String qText = qObj.path("question").asText("").trim();

                            String resolvedPrompt = !p.isBlank() ? p : qText;

                            if (!resolvedPrompt.isBlank()) {

                                qObj.put("question", resolvedPrompt);

                                qObj.put("prompt", resolvedPrompt);

                            }

                            qObj.put("questionType", "AUDIO_RESPONSE");

                            qObj.put("speakingMode", nonShadowMode);

                            qObj.remove("audioUrl");

                            qObj.remove("mediaUrl");

                            qObj.remove("transcript");

                        }

                    }

                    rawJson = objectMapper.writeValueAsString(root);

                }

            } catch (Exception ex) {

                log.warn("Không thể chuẩn hóa JSON cho Speaking Q&A/Part 2/Part 3: {}", ex.getMessage());

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

                        final String scriptToSynthesize = mainPassage;

                        java.util.concurrent.CompletableFuture<String> ttsFuture = null;

                        try {

                            ttsFuture = java.util.concurrent.CompletableFuture.supplyAsync(
                                    () -> exerciseAudioService.synthesizeRawScriptToUrl(scriptToSynthesize, "af_heart", 1.0));

                            sharedKokoroAudioUrl = ttsFuture.get(45, java.util.concurrent.TimeUnit.SECONDS);

                            if (sharedKokoroAudioUrl != null && !sharedKokoroAudioUrl.isBlank() && root.isObject()) {

                                ((com.fasterxml.jackson.databind.node.ObjectNode) root).put("audioUrl", sharedKokoroAudioUrl);

                                ((com.fasterxml.jackson.databind.node.ObjectNode) root).put("mediaUrl", sharedKokoroAudioUrl);

                            }

                        } catch (java.util.concurrent.TimeoutException timeoutEx) {

                            if (ttsFuture != null) {
                                ttsFuture.cancel(true);
                            }

                            log.warn("Quá thời gian 45s khi tạo trước Kokoro audio cho listeningPassage; vẫn trả về bài tập kèm kịch bản nghe để tránh timeout.");

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

    @Override

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

                boolean isSentenceWriting = exType.contains("SENTENCE") || exType.contains("ARRANGEMENT")
                        || exType.contains("UNSCRAMBLE") || exType.contains("WORD_ORDER")
                        || exType.contains("KEYWORD");
                defaultQType = isSentenceWriting ? "FILL_IN_BLANK" : "ESSAY";

            } else if (exType.contains("LISTENING")) {

                skillType = "LISTENING";

            } else if (exType.contains("MATCHING") || exType.contains("MATCH")) {

                skillType = "VOCABULARY";

                defaultQType = "MATCHING";

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

            req.setDescription("[" + exType + "] Tự động tạo bài tập hàng ngày bằng AI Lab (" + exType + " - " + exercise.getTargetCefr() + ").");

            req.setClassroomId(classroomId);

            req.setLessonId(targetLessonId);

            req.setSkillType(skillType);

            req.setTimeLimitMinutes(20);

            req.setMaxAttempts(3);

            req.setPassScore(5.0);



            if (readingPassage == null || readingPassage.isBlank()) {

                readingPassage = root.path("passage").asText("");

            }

            String listeningPassage = root.path("listeningPassage").asText(root.path("audioScript").asText(""));

            String audioUrl = root.path("audioUrl").asText(root.path("mediaUrl").asText(""));

            if (!audioUrl.isBlank()) {

                req.setAudioUrl(audioUrl);

            }

            if (!listeningPassage.isBlank()) {

                req.setListeningScript(listeningPassage);

            }

            double perQuestionPoint = 10.0 / Math.max(1, exercise.getQuestionCount());

            java.util.List<com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest> qReqs =

                    convertRawJsonToQuestionRequests(root, defaultQType, skillType, readingPassage, perQuestionPoint);

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

            return objectMapper.readTree(GroqClientService.stripMarkdown(rawJson));

        } catch (Exception e) {

            log.error("Reading short answer evaluation error: ", e);

            throw new RuntimeException("Đánh giá Reading câu trả lời ngắn thất bại: " + e.getMessage(), e);

        }

    }

    @Override
    public AiExamDraftResponse generateExamDraft(AiExamGenerateRequest request, UUID teacherId) {
        if (request == null || request.getSections() == null || request.getSections().isEmpty()) {
            throw new BadRequestException("Vui lòng chọn ít nhất một kỹ năng để AI sinh đề thi.");
        }

        String cefr = (request.getTargetCefr() != null && !request.getTargetCefr().isBlank())
                ? request.getTargetCefr().trim().toUpperCase()
                : "B2";
        String topic = (request.getTopic() != null && !request.getTopic().isBlank())
                ? request.getTopic().trim()
                : "Comprehensive English Assessment";
        String extra = (request.getCustomInstructions() != null && !request.getCustomInstructions().isBlank())
                ? ("\nHướng dẫn bổ sung của giáo viên: " + request.getCustomInstructions().trim())
                : "";
        String content = topic + extra;

        java.util.List<AiExamDraftResponse.GeneratedExamQuestionDto> allQuestions = new java.util.ArrayList<>();
        java.util.Set<String> examSkills = new java.util.LinkedHashSet<>();
        java.util.List<String> listeningScripts = new java.util.ArrayList<>();

        for (AiExamGenerateRequest.SkillSectionSpec spec : request.getSections()) {
            if (spec == null || spec.getSkillType() == null || spec.getSkillType().isBlank()) {
                continue;
            }
            String skill = spec.getSkillType().trim().toUpperCase();
            int count = (spec.getQuestionCount() != null && spec.getQuestionCount() > 0)
                    ? Math.min(spec.getQuestionCount(), 20)
                    : 3;
            double points = (spec.getPointsPerQuestion() != null && spec.getPointsPerQuestion() > 0)
                    ? spec.getPointsPerQuestion()
                    : ("ESSAY".equalsIgnoreCase(spec.getQuestionFormat()) || "WRITING".equals(skill) || "SPEAKING".equals(skill) ? 10.0 : 1.0);

            String formatCode = normalizeExamSectionFormat(skill, spec.getQuestionFormat());
            examSkills.add(skill);

            AiGeneratedExercise generated = generateQuizFromContent(
                    content,
                    cefr,
                    count,
                    teacherId,
                    null,
                    formatCode,
                    skill
            );

            try {
                JsonNode root = objectMapper.readTree(generated.getRawResponseJson());
                String readingPassage = root.path("readingPassage").asText(root.path("passage").asText(""));
                String listeningPassage = root.path("listeningPassage").asText(root.path("audioScript").asText(""));
                if (!listeningPassage.isBlank()) {
                    listeningScripts.add(listeningPassage);
                }

                String defaultQType = inferDefaultQuestionType(skill, formatCode);
                java.util.List<com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest> converted =
                        convertRawJsonToQuestionRequests(root, defaultQType, skill, readingPassage, points);

                for (com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest qReq : converted) {
                    java.util.List<AiExamDraftResponse.GeneratedExamOptionDto> optDtos = qReq.getOptions() == null
                            ? java.util.Collections.emptyList()
                            : qReq.getOptions().stream()
                                    .map(opt -> AiExamDraftResponse.GeneratedExamOptionDto.builder()
                                            .optionText(opt.getOptionText())
                                            .matchText(opt.getMatchText())
                                            .isCorrect(opt.isCorrect())
                                            .build())
                                    .collect(java.util.stream.Collectors.toList());

                    String effectiveTranscript = (qReq.getTranscript() != null && !qReq.getTranscript().isBlank())
                            ? qReq.getTranscript()
                            : ("LISTENING".equals(skill) && !listeningPassage.isBlank() ? listeningPassage : null);

                    allQuestions.add(AiExamDraftResponse.GeneratedExamQuestionDto.builder()
                            .skillType(skill)
                            .questionType(qReq.getQuestionType())
                            .promptText(qReq.getPromptText())
                            .transcript(effectiveTranscript)
                            .correctAnswer(qReq.getCorrectAnswer())
                            .explanation(qReq.getExplanation())
                            .points(qReq.getPoints())
                            .options(optDtos)
                            .build());
                }
            } catch (Exception e) {
                log.warn("Lỗi chuyển đổi phần {} trong AI Exam Draft: {}", skill, e.getMessage());
                throw new BadRequestException("AI chưa tạo đúng định dạng cho phần " + skill + ": " + e.getMessage());
            }
        }

        String title = (request.getTitle() != null && !request.getTitle().isBlank())
                ? request.getTitle().trim()
                : ("Đề thi " + cefr + " - " + topic);

        return AiExamDraftResponse.builder()
                .title(title)
                .description("Đề thi tổng hợp kỹ năng (" + String.join(", ", examSkills) + ") - Trình độ " + cefr)
                .listeningScript(listeningScripts.isEmpty() ? null : String.join("\n\n---\n\n", listeningScripts))
                .examSkills(new java.util.ArrayList<>(examSkills))
                .questions(allQuestions)
                .build();
    }

    private String normalizeExamSectionFormat(String skill, String rawFormat) {
        String fmt = (rawFormat != null && !rawFormat.isBlank()) ? rawFormat.trim().toUpperCase() : "MULTIPLE_CHOICE";
        if (fmt.startsWith(skill + "_") || fmt.startsWith("VOCAB_") || fmt.startsWith("GRAMMAR_")
                || fmt.startsWith("READING_") || fmt.startsWith("LISTENING_")
                || fmt.startsWith("WRITING_") || fmt.startsWith("SPEAKING_")) {
            return fmt;
        }
        return switch (skill) {
            case "READING" -> {
                if (fmt.contains("YES_NO") || fmt.contains("YES/NO")) yield "READING_YES_NO";
                if (fmt.contains("TRUE")) yield "READING_TRUE_FALSE";
                if (fmt.contains("MATCH")) yield "READING_MATCHING";
                if (fmt.contains("PARAPHRASE")) yield "READING_PARAPHRASE";
                if (fmt.contains("SHORT_ANSWER")) yield "READING_SHORT_ANSWER";
                if (fmt.contains("FILL") || fmt.contains("BLANK")) yield "READING_FILL_BLANK";
                if (fmt.contains("MIX")) yield "READING_MIXED";
                yield "READING_MULTIPLE_CHOICE";
            }
            case "LISTENING" -> {
                if (fmt.contains("FILL") || fmt.contains("BLANK") || fmt.contains("DICTATION")) yield "LISTENING_FILL";
                if (fmt.contains("DIALOGUE")) yield "LISTENING_DIALOGUE";
                if (fmt.contains("MIX")) yield "LISTENING_MIXED";
                yield "LISTENING_MC";
            }
            case "GRAMMAR" -> {
                if (fmt.contains("CONJUGAT")) yield "GRAMMAR_VERB_CONJUGATION";
                if (fmt.contains("ERROR")) yield "GRAMMAR_ERROR_CORRECTION";
                if (fmt.contains("TRANSFORM")) yield "GRAMMAR_TRANSFORMATION";
                if (fmt.contains("INVERSION")) yield "GRAMMAR_INVERSION";
                if (fmt.contains("NOMINAL")) yield "GRAMMAR_NOMINALISATION";
                if (fmt.contains("ARRANG") || fmt.contains("UNSCRAMBLE")) yield "GRAMMAR_WORD_ARRANGEMENT";
                if (fmt.contains("FILL") || fmt.contains("BLANK")) yield "GRAMMAR_FILL_IN_BLANK";
                if (fmt.contains("MIX")) yield "GRAMMAR_MIXED";
                yield "GRAMMAR_MULTIPLE_CHOICE";
            }
            case "VOCABULARY" -> {
                if (fmt.contains("MATCH")) yield "VOCAB_MATCHING";
                if (fmt.contains("FILL") || fmt.contains("BLANK")) yield "VOCAB_MEANING_TO_WORD";
                if (fmt.contains("COLLOCATION")) yield "VOCAB_COLLOCATION";
                if (fmt.contains("MIX")) yield "VOCAB_MIXED";
                yield "VOCAB_SYNONYM_ANTONYM";
            }
            case "WRITING" -> {
                if (fmt.contains("TASK1")) yield "WRITING_IELTS_TASK1";
                if (fmt.contains("TASK2")) yield "WRITING_IELTS_TASK2";
                if (fmt.contains("DISCURSIVE")) yield "WRITING_DISCURSIVE_ESSAY";
                if (fmt.contains("EMAIL")) yield "WRITING_SHORT_EMAIL";
                if (fmt.contains("DESCRIPTIVE")) yield "WRITING_DESCRIPTIVE_PARAGRAPH";
                if (fmt.contains("OPINION")) yield "WRITING_OPINION";
                if (fmt.contains("ADV")) yield "WRITING_ADV_DISADV";
                if (fmt.contains("CAUSE")) yield "WRITING_CAUSE_EFFECT";
                if (fmt.contains("PROBLEM")) yield "WRITING_PROBLEM_SOLUTION";
                if (fmt.contains("ARRANG") || fmt.contains("UNSCRAMBLE")) yield "WRITING_WORD_ARRANGEMENT";
                if (fmt.contains("KEYWORD")) yield "WRITING_KEYWORD";
                if (fmt.contains("SENTENCE") || fmt.contains("FILL")) yield "WRITING_SENTENCE";
                yield "WRITING_PARAGRAPH";
            }
            case "SPEAKING" -> {
                if (fmt.contains("SHADOW")) yield "SPEAKING_SHADOWING";
                if (fmt.contains("PART_2") || fmt.contains("PART2") || fmt.contains("CUE")) yield "SPEAKING_PART_2";
                if (fmt.contains("PART_3") || fmt.contains("PART3") || fmt.contains("DISCUSS")) yield "SPEAKING_PART_3";
                yield "SPEAKING_QA";
            }
            default -> "MULTIPLE_CHOICE";
        };
    }

    private String inferDefaultQuestionType(String skill, String formatCode) {
        if ("SPEAKING".equals(skill) || formatCode.contains("SPEAKING")) return "AUDIO_RESPONSE";
        if ("WRITING".equals(skill) && !formatCode.contains("SENTENCE")
                && !formatCode.contains("ARRANGEMENT") && !formatCode.contains("UNSCRAMBLE")
                && !formatCode.contains("WORD_ORDER") && !formatCode.contains("KEYWORD")) {
            return "ESSAY";
        }
        if (formatCode.contains("MATCH") && !"READING".equals(skill)) return "MATCHING";
        if (formatCode.contains("TRUE_FALSE") || formatCode.contains("YES_NO")) return "TRUE_FALSE";
        if (formatCode.contains("FILL") || formatCode.contains("DICTATION") || formatCode.contains("CONJUGAT")
                || formatCode.contains("ERROR") || formatCode.contains("TRANSFORM")
                || formatCode.contains("MEANING_TO_WORD") || formatCode.contains("SENTENCE")
                || formatCode.contains("KEYWORD") || formatCode.contains("ARRANGEMENT")) {
            return "FILL_IN_BLANK";
        }
        return "MULTIPLE_CHOICE";
    }

    private java.util.List<com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest> convertRawJsonToQuestionRequests(
            JsonNode root, String defaultQType, String skillType, String readingPassage, double perQuestionPoint) {
        JsonNode questionsNode = root.has("questions") ? root.get("questions") : objectMapper.createArrayNode();
        java.util.List<com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest> qReqs = new java.util.ArrayList<>();
        if (!questionsNode.isArray()) {
            return qReqs;
        }
        for (JsonNode qNode : questionsNode) {
            com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest qReq =
                    new com.englishlearning.assignment.dto.AssignmentRequest.QuestionRequest();
            String prompt = qNode.has("prompt") ? qNode.get("prompt").asText() : qNode.path("question").asText();
            if (readingPassage != null && !readingPassage.isBlank() && !prompt.contains("[READING PASSAGE]")) {
                prompt = "[READING PASSAGE]\n" + readingPassage + "\n\n" + prompt;
            }
            qReq.setPromptText(prompt);
            qReq.setSkillType(skillType);

            String detectedQType = qNode.path("questionType").asText(qNode.path("type").asText(defaultQType)).toUpperCase();
            boolean hasMultipleOptions = (qNode.path("options").isArray() && qNode.path("options").size() >= 2)
                    || (qNode.path("choices").isArray() && qNode.path("choices").size() >= 2)
                    || (qNode.path("options").isObject() && qNode.path("options").size() >= 2);
            boolean isSentencePrompt = prompt.contains("___") || prompt.contains(" / ")
                    || prompt.toLowerCase().contains("sắp xếp") || prompt.toLowerCase().contains("hoàn thành câu")
                    || prompt.toLowerCase().contains("từ gợi ý");
            if (detectedQType.contains("MATCH")) {
                detectedQType = "MATCHING";
            } else if ((!hasMultipleOptions && isSentencePrompt) || detectedQType.contains("FILL") || detectedQType.contains("BLANK")
                    || detectedQType.contains("WORD_ARRANGEMENT") || detectedQType.contains("SHORT_ANSWER")
                    || detectedQType.contains("WORD_FORM") || detectedQType.contains("DICTATION")
                    || detectedQType.contains("SPELL") || detectedQType.contains("CONJUGAT")
                    || detectedQType.contains("TRANSFORM") || detectedQType.contains("CORRECTION")
                    || detectedQType.contains("KEYWORD") || detectedQType.contains("UNSCRAMBLE")) {
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
            qReq.setPoints(perQuestionPoint);

            if ("MATCHING".equals(detectedQType)) {
                String matchWord = qNode.path("word").asText(qNode.path("targetWord").asText(qNode.path("prompt").asText(prompt))).trim();
                String matchMeaning = qNode.path("meaning").asText(qNode.path("correctAnswer").asText(qNode.path("matchText").asText(""))).trim();
                qReq.setPromptText(matchWord);
                qReq.setCorrectAnswer(matchMeaning);
                String ipaStr = qNode.path("ipa").asText("").trim();
                String existingExpl = qNode.path("explanation").asText("").trim();
                String prefixExpl = !ipaStr.isBlank() ? (ipaStr + " - " + matchMeaning) : matchMeaning;
                if (existingExpl.isBlank()) {
                    qReq.setExplanation(prefixExpl);
                } else if (!ipaStr.isBlank() && !existingExpl.contains(ipaStr)) {
                    qReq.setExplanation(ipaStr + " | " + existingExpl);
                } else {
                    qReq.setExplanation(existingExpl);
                }
                com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest opt =
                        new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                opt.setOptionText(matchWord);
                opt.setMatchText(matchMeaning);
                opt.setIsCorrect(true);
                qReq.setOptions(java.util.List.of(opt));
            } else if ("AUDIO_RESPONSE".equals(detectedQType)) {
                qReq.setCorrectAnswer(qNode.path("correctAnswer").asText(prompt));
            } else if ("ESSAY".equals(detectedQType)) {
                qReq.setCorrectAnswer(qNode.path("correctAnswer").asText(""));
            } else if ("FILL_IN_BLANK".equals(detectedQType)) {
                String fillAns = qNode.path("correctAnswer").asText(qNode.path("answer").asText(qNode.path("word").asText(""))).trim();
                qReq.setCorrectAnswer(fillAns);
            } else {
                String rawAns = stripOptionPrefix(qNode.path("correctAnswer").asText(qNode.path("answer").asText(qNode.path("word").asText(""))).trim());
                if ("TRUE_FALSE".equals(detectedQType)) {
                    rawAns = normalizeTrueFalseValue(rawAns);
                }
                qReq.setCorrectAnswer(rawAns);
                java.util.List<com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest> optReqs = new java.util.ArrayList<>();
                if (qNode.has("options") || qNode.has("choices")) {
                    JsonNode optNode = qNode.has("options") ? qNode.get("options") : qNode.get("choices");
                    if (optNode.isArray() && optNode.size() > 0) {
                        int optIdx = 0;
                        for (JsonNode singleOpt : optNode) {
                            com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest optReq =
                                    new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                            String rawText = singleOpt.isTextual() ? singleOpt.asText() : singleOpt.path("text").asText(singleOpt.path("label").asText(""));
                            String text = "TRUE_FALSE".equals(detectedQType) ? normalizeTrueFalseValue(rawText) : stripOptionPrefix(rawText);
                            boolean isCorrect = singleOpt.path("isCorrect").asBoolean(singleOpt.path("correct").asBoolean(false));
                            if (!isCorrect && !rawAns.isBlank()) {
                                String letterLabel = String.valueOf((char) ('A' + optIdx));
                                isCorrect = text.equalsIgnoreCase(rawAns) || letterLabel.equalsIgnoreCase(rawAns);
                            }
                            optReq.setOptionText(text);
                            optReq.setCorrect(isCorrect);
                            optReqs.add(optReq);
                            optIdx++;
                        }
                    } else if (optNode.isObject()) {
                        final String finalRawAns = rawAns;
                        optNode.fields().forEachRemaining(entry -> {
                            com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest optReq =
                                    new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                            String text = stripOptionPrefix(entry.getValue().asText());
                            boolean isCorrect = entry.getKey().equalsIgnoreCase(finalRawAns) || text.equalsIgnoreCase(finalRawAns);
                            optReq.setOptionText(text);
                            optReq.setCorrect(isCorrect);
                            optReqs.add(optReq);
                        });
                    }
                    if ("TRUE_FALSE".equals(detectedQType)) {
                        java.util.Set<String> existingTf = optReqs.stream()
                                .map(o -> normalizeTrueFalseValue(o.getOptionText()))
                                .collect(java.util.stream.Collectors.toSet());
                        if (!existingTf.contains("NOT GIVEN")) {
                            com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest optNg =
                                    new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                            optNg.setOptionText("NOT GIVEN");
                            optNg.setCorrect("NOT GIVEN".equals(rawAns));
                            optReqs.add(optNg);
                        }
                    } else if (!optReqs.isEmpty()) {
                        com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest matchedOpt = optReqs.stream()
                                .filter(com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest::isCorrect)
                                .findFirst()
                                .orElse(null);
                        if (matchedOpt != null) {
                            qReq.setCorrectAnswer(matchedOpt.getOptionText());
                        } else if (!rawAns.isBlank()) {
                            optReqs.get(optReqs.size() - 1).setOptionText(rawAns);
                            optReqs.get(optReqs.size() - 1).setCorrect(true);
                        } else {
                            optReqs.get(0).setCorrect(true);
                            qReq.setCorrectAnswer(optReqs.get(0).getOptionText());
                        }
                    }
                } else if ("TRUE_FALSE".equals(detectedQType)) {
                    String correctAns = normalizeTrueFalseValue(
                            qNode.path("correctAnswer").asText(qNode.path("answer").asText("TRUE")));
                    qReq.setCorrectAnswer(correctAns);
                    for (String tfLabel : java.util.List.of("TRUE", "FALSE", "NOT GIVEN")) {
                        com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest optTf =
                                new com.englishlearning.assignment.dto.AssignmentRequest.OptionRequest();
                        optTf.setOptionText(tfLabel);
                        optTf.setCorrect(tfLabel.equals(correctAns));
                        optReqs.add(optTf);
                    }
                }

                if (optReqs.size() < 2 && !rawAns.isBlank()) {
                    qReq.setQuestionType("FILL_IN_BLANK");
                    qReq.setOptions(new java.util.ArrayList<>());
                } else {
                    qReq.setOptions(optReqs);
                }
            }
            qReqs.add(qReq);
        }
        return qReqs;
    }

    private String resolveReadingWordCountRange(String cefr, String rawTopic) {
        String level = cefr != null ? cefr.trim().toUpperCase() : "B2";
        if ("A1".equals(level)) return "100-150";
        if ("A2".equals(level)) return "150-220";
        if ("B1".equals(level)) return "220-300";
        if ("B2".equals(level)) return "320-420";
        if ("C1".equals(level)) return "450-580";
        String topicLower = rawTopic != null ? rawTopic.toLowerCase() : "";
        if (topicLower.contains("passage 1")) {
            return "400-500 (IELTS Passage 1: descriptive/factual)";
        }
        if (topicLower.contains("passage 2")) {
            return "450-550 (IELTS Passage 2: analytical/discursive)";
        }
        if (topicLower.contains("passage 3")) {
            return "500-650 (IELTS Passage 3: abstract/academic argument)";
        }
        return "450-600";
    }

    private String resolveCefrLinguisticGuideline(String cefr) {
        String level = cefr != null ? cefr.trim().toUpperCase() : "B2";
        return switch (level) {
            case "A1" -> "Core concrete words (top 600), simple present/past, short simple clauses (8-12 words/sentence); NO complex academic idioms.";
            case "A2" -> "Everyday high-frequency vocabulary, simple compound sentences (and/but/because), present/past/future basics.";
            case "B1" -> "Clear standard connected discourse, workplace/travel/society topics, conditionals type 1-2, relative clauses.";
            case "B2" -> "Abstract and technical topics, cohesive connectors, passive voice, nuanced distractors, natural collocations.";
            case "C1" -> "Sophisticated academic register, complex syntactic variety (inversion, nominalisation, subjunctive), subtle shades of meaning.";
            default -> "Academic IELTS Band 7.0-8.5 register, authentic paraphrasing traps, formal discourse markers, zero informal filler.";
        };
    }

    private String stripOptionPrefix(String raw) {
        if (raw == null) return "";
        return raw.trim().replaceFirst("^(?:[A-Da-d][.)\\-:]\\s+|\\([A-Da-d]\\)\\s+)", "").trim();
    }

    private String normalizeTrueFalseValue(String raw) {
        if (raw == null || raw.isBlank()) return "TRUE";
        String up = raw.trim().toUpperCase().replace("_", " ").replaceAll("\\s+", " ");
        if ("YES".equals(up) || "T".equals(up) || "ĐÚNG".equals(up) || "TRUE".equals(up)) return "TRUE";
        if ("NO".equals(up) || "F".equals(up) || "SAI".equals(up) || "FALSE".equals(up)) return "FALSE";
        if (up.contains("NOT GIVEN") || "NG".equals(up) || up.contains("KHÔNG CÓ")) return "NOT GIVEN";
        return up;
    }

    private String sanitizeAndValidateQuestionsJson(String rawJson, String effectiveSkill, String effectiveType, String cefr) {
        if (rawJson == null || rawJson.isBlank()) return rawJson;
        try {
            JsonNode root = objectMapper.readTree(rawJson);
            if (!root.isObject()) return rawJson;
            com.fasterxml.jackson.databind.node.ObjectNode rootObj = (com.fasterxml.jackson.databind.node.ObjectNode) root;
            JsonNode qNode = rootObj.get("questions");
            if (qNode == null || !qNode.isArray()) return rawJson;

            String upperType = effectiveType != null ? effectiveType.toUpperCase() : "";
            boolean changed = false;

            for (JsonNode item : qNode) {
                if (!item.isObject()) continue;
                com.fasterxml.jackson.databind.node.ObjectNode qObj = (com.fasterxml.jackson.databind.node.ObjectNode) item;

                String qType = qObj.path("questionType").asText(qObj.path("type").asText("")).toUpperCase();
                String prompt = qObj.path("prompt").asText(qObj.path("question").asText("")).trim();
                String rawCorrect = qObj.path("correctAnswer").asText(qObj.path("answer").asText("")).trim();

                // 1. TRUE_FALSE / READING_YES_NO normalization
                boolean isTfQuestion = qType.contains("TRUE") || qType.contains("FALSE")
                        || ((upperType.contains("TRUE_FALSE") || upperType.contains("YES_NO"))
                        && !upperType.contains("MIX") && qType.isBlank());
                if (isTfQuestion) {
                    String normTf = normalizeTrueFalseValue(rawCorrect);
                    qObj.put("questionType", "TRUE_FALSE");
                    qObj.put("correctAnswer", normTf);
                    com.fasterxml.jackson.databind.node.ArrayNode tfOpts = objectMapper.createArrayNode();
                    tfOpts.add("TRUE").add("FALSE").add("NOT GIVEN");
                    qObj.set("options", tfOpts);
                    rawCorrect = normTf;
                    changed = true;
                }

                // 2. ERROR_CORRECTION: preserve multi-variant grading (correctWord | wrongWord -> correctWord)
                if (upperType.contains("ERROR_CORRECTION") && qObj.hasNonNull("wrongWord")) {
                    String wrong = qObj.get("wrongWord").asText("").trim();
                    String cleanCorr = stripOptionPrefix(rawCorrect);
                    if (!wrong.isBlank() && !cleanCorr.isBlank() && !cleanCorr.contains("|")
                            && !cleanCorr.contains("->") && !wrong.equalsIgnoreCase(cleanCorr)) {
                        rawCorrect = cleanCorr + " | " + wrong + " -> " + cleanCorr;
                        qObj.put("correctAnswer", rawCorrect);
                        changed = true;
                    }
                }

                // 3. MULTIPLE_CHOICE options & correctAnswer exact synchronization
                JsonNode optsNode = qObj.has("options") ? qObj.get("options") : qObj.get("choices");
                if (optsNode != null && optsNode.isArray() && optsNode.size() > 0 && !isTfQuestion && !"MATCHING".equalsIgnoreCase(qType)) {
                    java.util.List<String> cleanedTextOpts = new java.util.ArrayList<>();
                    boolean allTextual = true;
                    for (JsonNode optItem : optsNode) {
                        if (optItem.isTextual()) {
                            cleanedTextOpts.add(stripOptionPrefix(optItem.asText()));
                        } else {
                            allTextual = false;
                            break;
                        }
                    }

                    if (allTextual && !cleanedTextOpts.isEmpty()) {
                        String cleanCorrect = stripOptionPrefix(rawCorrect);
                        int letterIdx = "A".equalsIgnoreCase(cleanCorrect) ? 0
                                : "B".equalsIgnoreCase(cleanCorrect) ? 1
                                : "C".equalsIgnoreCase(cleanCorrect) ? 2
                                : "D".equalsIgnoreCase(cleanCorrect) ? 3 : -1;
                        if (letterIdx >= 0 && letterIdx < cleanedTextOpts.size()) {
                            cleanCorrect = cleanedTextOpts.get(letterIdx);
                        } else if (!cleanCorrect.isBlank()) {
                            int foundIdx = -1;
                            for (int i = 0; i < cleanedTextOpts.size(); i++) {
                                if (cleanedTextOpts.get(i).equalsIgnoreCase(cleanCorrect)) {
                                    foundIdx = i;
                                    break;
                                }
                            }
                            if (foundIdx >= 0) {
                                cleanCorrect = cleanedTextOpts.get(foundIdx);
                            } else if (cleanedTextOpts.size() >= 2) {
                                // Prevent losing the AI's real answer by putting it into options instead of corrupting correctAnswer to opts[0]
                                if (cleanedTextOpts.size() < 4) {
                                    cleanedTextOpts.add(cleanCorrect);
                                } else {
                                    cleanedTextOpts.set(cleanedTextOpts.size() - 1, cleanCorrect);
                                }
                            }
                        } else {
                            cleanCorrect = cleanedTextOpts.get(0);
                        }

                        com.fasterxml.jackson.databind.node.ArrayNode newOpts = objectMapper.createArrayNode();
                        cleanedTextOpts.forEach(newOpts::add);
                        qObj.set("options", newOpts);
                        qObj.put("correctAnswer", cleanCorrect);
                        rawCorrect = cleanCorrect;
                        changed = true;
                    }
                }

                // 4. Sentence-gap FILL_IN_BLANK blank marker safeguard (only for declarative gap-fill prompts missing ___)
                boolean isGapFillType = "FILL_IN_BLANK".equalsIgnoreCase(qType)
                        && (upperType.contains("VERB_CONJUGAT") || upperType.contains("GRAMMAR_FILL")
                                || upperType.contains("LISTENING_FILL") || upperType.contains("READING_FILL")
                                || upperType.contains("WORD_FORM") || upperType.contains("WORD_FAMILY"));
                if (isGapFillType && !prompt.isBlank() && !prompt.contains("___")
                        && !prompt.contains("/") && !prompt.endsWith("?")) {
                    String updatedPrompt = prompt.matches(".*\\([a-zA-Z\\s]+\\).*")
                            ? prompt.replaceFirst("(\\([a-zA-Z\\s]+\\))", "$1 ______")
                            : (prompt + " ______");
                    qObj.put("prompt", updatedPrompt);
                    changed = true;
                }

                // 4b. Deterministic Word Arrangement token-parity guard: ensure every word of correctAnswer exists in scrambled tokens
                boolean isWordArrangement = "FILL_IN_BLANK".equalsIgnoreCase(qType)
                        && (upperType.contains("WORD_ARRANGEMENT") || upperType.contains("UNSCRAMBLE")
                                || prompt.toLowerCase().contains("sắp xếp các từ"));
                if (isWordArrangement && !rawCorrect.isBlank()) {
                    java.util.List<String> expectedTokens = tokenizeSentenceForArrangement(rawCorrect);
                    if (expectedTokens.size() >= 2) {
                        int colonIdx = prompt.lastIndexOf(':');
                        String prefix = colonIdx >= 0
                                ? prompt.substring(0, colonIdx + 1).trim() + " "
                                : "Sắp xếp các từ sau thành câu hoàn chỉnh đúng cấu trúc: ";
                        String body = colonIdx >= 0 ? prompt.substring(colonIdx + 1).trim() : prompt;
                        java.util.List<String> actualTokens = new java.util.ArrayList<>();
                        for (String rawTok : body.split("\\s*/\\s*")) {
                            String trimmed = rawTok.trim();
                            if (!trimmed.isEmpty()) {
                                actualTokens.add(trimmed);
                            }
                        }
                        if (!hasSameNormalizedWordMultiset(actualTokens, expectedTokens)) {
                            java.util.List<String> scrambled = deterministicScrambleTokens(expectedTokens);
                            qObj.put("prompt", prefix + String.join(" / ", scrambled));
                            changed = true;
                        }
                    }
                }

                // 5. Explanation non-blank fallback
                String expl = qObj.path("explanation").asText("").trim();
                if (expl.isBlank() && !rawCorrect.isBlank()) {
                    qObj.put("explanation", "Đáp án đúng (" + cefr + "): " + rawCorrect);
                    changed = true;
                }
            }

            return changed ? objectMapper.writeValueAsString(rootObj) : rawJson;
        } catch (Exception ex) {
            log.warn("Lỗi hậu kiểm JSON bài tập AI ({}): {}", effectiveType, ex.getMessage());
            return rawJson;
        }
    }

    /**
     * Làm sạch, phục hồi JSON bị bọc markdown / văn bản thừa / cắt cụt giữa chừng,
     * đồng thời chuẩn hóa các key alias ("items", "exercises", "tasks", ...) về "questions" hoặc "pairs".
     * Trả về {@code null} nếu không trích xuất được câu hỏi hoặc cặp ghép hợp lệ nào.
     */
    String extractAndNormalizeQuizJson(String rawResponse) {
        if (rawResponse == null || rawResponse.isBlank()) {
            return null;
        }
        String cleaned = rawResponse.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7).trim();
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3).trim();
        }
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3).trim();
        } else {
            int fenceIdx = cleaned.lastIndexOf("```");
            if (fenceIdx > 0 && fenceIdx > cleaned.length() - 10) {
                cleaned = cleaned.substring(0, fenceIdx).trim();
            }
        }

        JsonNode parsed = tryParseJsonNode(cleaned);
        if (parsed == null) {
            int firstBrace = cleaned.indexOf('{');
            int lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                parsed = tryParseJsonNode(cleaned.substring(firstBrace, lastBrace + 1));
            }
        }
        if (parsed == null) {
            int firstBracket = cleaned.indexOf('[');
            int lastBracket = cleaned.lastIndexOf(']');
            if (firstBracket >= 0 && lastBracket > firstBracket) {
                parsed = tryParseJsonNode(cleaned.substring(firstBracket, lastBracket + 1));
            }
        }
        if (parsed == null) {
            parsed = salvageTruncatedQuestionsJson(cleaned);
        }
        if (parsed == null) {
            return null;
        }

        try {
            com.fasterxml.jackson.databind.node.ObjectNode normalized;
            if (parsed.isArray()) {
                normalized = objectMapper.createObjectNode();
                boolean looksLikePairs = !parsed.isEmpty()
                        && parsed.get(0).isObject()
                        && parsed.get(0).has("left")
                        && parsed.get(0).has("right");
                normalized.set(looksLikePairs ? "pairs" : "questions", parsed);
            } else if (parsed.isObject()) {
                normalized = (com.fasterxml.jackson.databind.node.ObjectNode) parsed.deepCopy();
                boolean hasQuestions = normalized.has("questions") && normalized.get("questions").isArray()
                        && !normalized.get("questions").isEmpty();
                boolean hasPairs = normalized.has("pairs") && normalized.get("pairs").isArray()
                        && !normalized.get("pairs").isEmpty();

                if (!hasQuestions && !hasPairs) {
                    String[] aliases = {"items", "exercises", "tasks", "prompts", "quiz", "data"};
                    for (String alias : aliases) {
                        JsonNode aliasNode = normalized.get(alias);
                        if (aliasNode == null || aliasNode.isNull()) {
                            continue;
                        }
                        if (aliasNode.isArray() && !aliasNode.isEmpty()) {
                            normalized.set("questions", aliasNode);
                            hasQuestions = true;
                            break;
                        }
                        if ("data".equals(alias) && aliasNode.isObject()) {
                            if (aliasNode.has("questions") && aliasNode.get("questions").isArray()
                                    && !aliasNode.get("questions").isEmpty()) {
                                normalized.set("questions", aliasNode.get("questions"));
                                hasQuestions = true;
                                break;
                            }
                            if (aliasNode.has("pairs") && aliasNode.get("pairs").isArray()
                                    && !aliasNode.get("pairs").isEmpty()) {
                                normalized.set("pairs", aliasNode.get("pairs"));
                                hasPairs = true;
                                break;
                            }
                        }
                    }
                }

                if (!hasQuestions && !hasPairs
                        && (normalized.has("question") || normalized.has("prompt") || normalized.has("word"))) {
                    com.fasterxml.jackson.databind.node.ArrayNode singleArr = objectMapper.createArrayNode();
                    singleArr.add(normalized.deepCopy());
                    normalized = objectMapper.createObjectNode();
                    normalized.set("questions", singleArr);
                }
            } else {
                return null;
            }

            boolean validQuestions = normalized.has("questions") && normalized.get("questions").isArray()
                    && !normalized.get("questions").isEmpty();
            boolean validPairs = normalized.has("pairs") && normalized.get("pairs").isArray()
                    && !normalized.get("pairs").isEmpty();
            if (!validQuestions && !validPairs) {
                return null;
            }
            return objectMapper.writeValueAsString(normalized);
        } catch (Exception ex) {
            log.warn("Không thể chuẩn hóa JSON bài tập AI: {}", ex.getMessage());
            return null;
        }
    }

    private JsonNode tryParseJsonNode(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(candidate);
        } catch (Exception ignored) {
            return null;
        }
    }

    private JsonNode salvageTruncatedQuestionsJson(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return null;
        }
        String targetKey = "questions";
        int keyIdx = candidate.indexOf("\"questions\"");
        if (keyIdx < 0) {
            keyIdx = candidate.indexOf("\"pairs\"");
            if (keyIdx >= 0) {
                targetKey = "pairs";
            }
        }
        int arrayStart = keyIdx >= 0 ? candidate.indexOf('[', keyIdx) : candidate.indexOf('[');
        if (arrayStart < 0) {
            return null;
        }

        com.fasterxml.jackson.databind.node.ArrayNode recovered = objectMapper.createArrayNode();
        boolean inString = false;
        boolean escaped = false;
        int depth = 0;
        int objStart = -1;

        for (int i = arrayStart + 1; i < candidate.length(); i++) {
            char c = candidate.charAt(i);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (inString) {
                if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    inString = false;
                }
                continue;
            }
            if (c == '"') {
                inString = true;
            } else if (c == '{') {
                if (depth == 0) {
                    objStart = i;
                }
                depth++;
            } else if (c == '}') {
                if (depth > 0) {
                    depth--;
                    if (depth == 0 && objStart >= 0) {
                        JsonNode itemNode = tryParseJsonNode(candidate.substring(objStart, i + 1));
                        if (itemNode != null && itemNode.isObject()) {
                            recovered.add(itemNode);
                        }
                        objStart = -1;
                    }
                }
            } else if (c == ']' && depth == 0) {
                break;
            }
        }

        if (recovered.isEmpty()) {
            return null;
        }

        com.fasterxml.jackson.databind.node.ObjectNode root = objectMapper.createObjectNode();
        root.set(targetKey, recovered);

        String prefix = candidate.substring(0, arrayStart);
        for (String passageKey : new String[]{"readingPassage", "listeningPassage"}) {
            java.util.regex.Matcher matcher = java.util.regex.Pattern
                    .compile("\"" + passageKey + "\"\\s*:\\s*(\"(?:[^\"\\\\]|\\\\.)*\")")
                    .matcher(prefix);
            if (matcher.find()) {
                JsonNode textNode = tryParseJsonNode(matcher.group(1));
                if (textNode != null && textNode.isTextual()) {
                    root.put(passageKey, textNode.asText());
                }
            }
        }
        return root;
    }

    private java.util.List<String> tokenizeSentenceForArrangement(String sentence) {
        java.util.List<String> tokens = new java.util.ArrayList<>();
        if (sentence == null || sentence.isBlank()) {
            return tokens;
        }
        String[] parts = sentence.trim().split("\\s+");
        for (int i = 0; i < parts.length; i++) {
            String part = parts[i].trim();
            if (part.isEmpty()) continue;
            if (i == parts.length - 1 && part.length() > 1 && part.matches(".*[A-Za-z0-9][.?!]+$")) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(.+?)([.?!]+)$").matcher(part);
                if (m.find()) {
                    tokens.add(m.group(1));
                    tokens.add(m.group(2));
                    continue;
                }
            }
            tokens.add(part);
        }
        return tokens;
    }

    private boolean hasSameNormalizedWordMultiset(java.util.List<String> actualTokens, java.util.List<String> expectedTokens) {
        java.util.List<String> actualWords = new java.util.ArrayList<>();
        for (String t : actualTokens) {
            String w = t.toLowerCase(java.util.Locale.ROOT).replaceAll("^[\\p{Punct}\\s]+|[\\p{Punct}\\s]+$", "");
            if (!w.isEmpty()) {
                actualWords.add(w);
            }
        }
        java.util.List<String> expectedWords = new java.util.ArrayList<>();
        for (String t : expectedTokens) {
            String w = t.toLowerCase(java.util.Locale.ROOT).replaceAll("^[\\p{Punct}\\s]+|[\\p{Punct}\\s]+$", "");
            if (!w.isEmpty()) {
                expectedWords.add(w);
            }
        }
        if (expectedWords.isEmpty()) {
            return true;
        }
        java.util.Collections.sort(actualWords);
        java.util.Collections.sort(expectedWords);
        return actualWords.equals(expectedWords);
    }

    private java.util.List<String> deterministicScrambleTokens(java.util.List<String> expectedTokens) {
        java.util.List<String> words = new java.util.ArrayList<>(expectedTokens);
        String trailingPunct = null;
        if (!words.isEmpty() && words.get(words.size() - 1).matches("^[.?!]+$")) {
            trailingPunct = words.remove(words.size() - 1);
        }
        java.util.List<String> scrambled = new java.util.ArrayList<>();
        if (words.size() >= 2) {
            for (int i = 1; i < words.size(); i += 2) {
                scrambled.add(words.get(i));
            }
            int lastEven = (words.size() - 1) % 2 == 0 ? words.size() - 1 : words.size() - 2;
            for (int i = lastEven; i >= 0; i -= 2) {
                scrambled.add(words.get(i));
            }
            if (scrambled.equals(words)) {
                java.util.Collections.rotate(scrambled, 1);
            }
        } else {
            scrambled.addAll(words);
        }
        if (trailingPunct != null) {
            scrambled.add(trailingPunct);
        }
        return scrambled;
    }

}