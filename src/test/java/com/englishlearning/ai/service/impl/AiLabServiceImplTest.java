package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.dto.AiExamDraftResponse;
import com.englishlearning.ai.dto.AiExamGenerateRequest;
import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.ai.service.GeminiClientService;
import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.service.GroqClientService;
import com.englishlearning.ai.service.PythonIntegrationService;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.dto.AssignmentRequest;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.service.AssignmentService;
import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.service.DictionaryLookupService;
import com.englishlearning.notification.service.NotificationService;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.entity.StudentAnswer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AiLabServiceImpl - Speaking/Writing/Reading Eval, Quiz Gen, Enrichment & Exam Draft")
class AiLabServiceImplTest {

    @Mock private GroqClientService groqClientService;
    @Mock private GeminiClientService geminiClientService;
    @Mock private LessonRepository lessonRepository;
    @Mock private AiEvaluationRepository aiEvaluationRepository;
    @Mock private NotificationService notificationService;
    @Mock private AiGeneratedExerciseRepository aiGeneratedExerciseRepository;
    @Mock private TeacherRepository teacherRepository;
    @Mock private UserRepository userRepository;
    @Mock private EntityManager entityManager;
    @Mock private AssignmentService assignmentService;
    @Mock private ExerciseAudioService exerciseAudioService;
    @Mock private AnalyticsService analyticsService;
    @Mock private DictionaryLookupService dictionaryLookupService;
    @Mock private PythonIntegrationService pythonIntegrationService;

    private ObjectMapper objectMapper;
    private AiLabServiceImpl service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new AiLabServiceImpl(
                groqClientService,
                geminiClientService,
                lessonRepository,
                aiEvaluationRepository,
                notificationService,
                aiGeneratedExerciseRepository,
                teacherRepository,
                userRepository,
                entityManager,
                objectMapper,
                assignmentService,
                exerciseAudioService,
                analyticsService,
                dictionaryLookupService,
                pythonIntegrationService
        );
    }

    @Test
    @DisplayName("evaluateSpeakingTopic: bóc băng Whisper, chấm điểm Groq, lưu AiEvaluation & cập nhật skill SPEAKING")
    void evaluateSpeakingTopic_persistsEvaluationAndUpdatesAnalytics() {
        UUID studentId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();
        Student student = Student.builder().id(studentId).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder().student(student).build();
        Assignment assignment = Assignment.builder().title("IELTS Part 2").build();
        AssignmentQuestion question = AssignmentQuestion.builder()
                .assignment(assignment)
                .promptText("Describe a book you enjoyed")
                .correctAnswer("Mention plot and impact")
                .explanation("Lexical diversity")
                .build();
        StudentAnswer answer = StudentAnswer.builder()
                .id(answerId)
                .attempt(attempt)
                .question(question)
                .build();

        when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
        when(groqClientService.transcribeAudio(any(MultipartFile.class)))
                .thenReturn("I really enjoyed reading Atomic Habits by James Clear last year when I wanted to build more consistent study routines. "
                        + "First of all, the book clearly explains how tiny daily improvements compound into remarkable long-term results over several months. "
                        + "For example, I started reviewing academic vocabulary for fifteen minutes every single morning instead of cramming right before exams. "
                        + "Moreover, keeping a simple habit tracker kept me motivated whenever I felt tired or distracted after classes. "
                        + "Overall, applying those practical strategies had a genuinely transformative impact on my discipline and university performance.");
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "overallBand": 7.5,
                  "pronunciationScore": 7.5,
                  "fluencyScore": 7.0,
                  "grammarScore": 7.5,
                  "lexicalScore": 8.0,
                  "coherenceScore": 7.5,
                  "estimatedCefr": "C1",
                  "correctedText": "I really enjoyed reading Atomic Habits.",
                  "mistakes": [],
                  "suggestions": []
                }
                """);
        when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());

        MockMultipartFile audio = new MockMultipartFile("audio", "speech.webm", "audio/webm", "data".getBytes());
        JsonNode result = service.evaluateSpeakingTopic("Ignored topic", audio, answerId);

        assertThat(result.path("overallBand").asDouble()).isEqualTo(7.5);
        assertThat(answer.getEarnedPoints()).isEqualTo(7.5);
        assertThat(answer.getIsCorrect()).isTrue();

        ArgumentCaptor<AiEvaluation> evalCaptor = ArgumentCaptor.forClass(AiEvaluation.class);
        verify(aiEvaluationRepository).save(evalCaptor.capture());
        assertThat(evalCaptor.getValue().getEvalType()).isEqualTo(AiEvaluationType.SPEAKING);
        assertThat(evalCaptor.getValue().getVocabularyScore()).isEqualTo(8.0);
        verify(entityManager).merge(answer);
        verify(analyticsService).updateSkillScore(studentId, "SPEAKING", 3.75);
    }

    @Test
    @DisplayName("evaluateSpeakingTopic: không ghi DB khi studentAnswerId null và bọc lỗi Groq thành RuntimeException")
    void evaluateSpeakingTopic_handlesStandaloneModeAndGroqFailure() {
        when(groqClientService.chatCompletionJson(anyString(), anyString()))
                .thenThrow(new RuntimeException("Groq rate limited"));

        assertThatThrownBy(() -> service.evaluateSpeakingTopic("Daily Routine", null, null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Đánh giá Speaking bằng Groq thất bại");

        verifyNoInteractions(aiEvaluationRepository, analyticsService);
    }

    @Test
    @DisplayName("evaluateWriting: cập nhật AiEvaluation sẵn có, đánh dấu isCorrect=false khi < 5.0 và cập nhật WRITING analytics")
    void evaluateWriting_updatesExistingEvaluationAndAnalytics() {
        UUID studentId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();
        Student student = Student.builder().id(studentId).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder().student(student).build();
        StudentAnswer answer = StudentAnswer.builder().id(answerId).attempt(attempt).build();
        AiEvaluation existingEval = AiEvaluation.builder()
                .studentAnswer(answer)
                .evalType(AiEvaluationType.WRITING)
                .build();

        when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
        when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.of(existingEval));
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "overallBand": 4.5,
                  "grammarScore": 4.0,
                  "vocabularyScore": 5.0,
                  "coherenceScore": 4.5,
                  "estimatedCefr": "B1",
                  "correctedText": "Technology has changed our lives.",
                  "mistakes": [{"original":"have","correction":"has"}],
                  "suggestions": [{"area":"Ngữ pháp","recommendation":"Chú ý S-V agreement"}]
                }
                """);

        String essayText = "Technology has changed daily communication and learning opportunities across modern societies around the world. ".repeat(4);
        JsonNode result = service.evaluateWriting("Technology in life", essayText, answerId);

        assertThat(result.path("estimatedCefr").asText()).isEqualTo("B1");
        assertThat(result.path("writingTask").asText()).isEqualTo("TASK_2");
        assertThat(answer.getIsCorrect()).isFalse();
        assertThat(answer.getEarnedPoints()).isEqualTo(4.5);
        assertThat(answer.getEvalFeedback()).contains("\"writingTask\":\"TASK_2\"");
        verify(aiEvaluationRepository).save(existingEval);
        verify(entityManager).merge(answer);
        verify(analyticsService).updateSkillScore(studentId, "WRITING", 2.25);

        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenThrow(new RuntimeException("Down"));
        assertThatThrownBy(() -> service.evaluateWriting("Topic", "Essay", null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Chấm Writing bằng Groq thất bại");
    }

    @Test
    @DisplayName("generateQuizFromContent: bóc markdown code fence khi Groq thành công, fallback Gemini khi Groq lỗi")
    void generateQuizFromContent_stripsMarkdownAndFallsBackToGemini() throws Exception {
        UUID teacherId = UUID.randomUUID();
        Teacher teacher = Teacher.builder().id(teacherId).build();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(teacher));
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // Case 1: Groq trả về JSON bọc trong ```json ... ```
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("```json\n{\"questions\":[{\"prompt\":\"Choose past tense\",\"correctAnswer\":\"went\",\"options\":[\"go\",\"went\"]}]}\n```");

        AiGeneratedExercise ok = service.generateQuizFromContent("Past simple", "A2", 1, teacherId, null);
        assertThat(ok.getStatus()).isEqualTo(GenerationStatus.READY_FOR_REVIEW);
        JsonNode okNode = objectMapper.readTree(ok.getRawResponseJson());
        assertThat(okNode.path("questions")).hasSize(1);

        // Case 2: Groq lỗi -> fallback sang Gemini
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenThrow(new RuntimeException("Groq 503"));
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("```\n{\"questions\":[{\"prompt\":\"Fallback Q\",\"correctAnswer\":\"yes\"}]}\n```");

        AiGeneratedExercise fallback = service.generateQuizFromContent("Conditionals", "B1", 1, teacherId, null, "GRAMMAR_MIXED");
        assertThat(fallback.getStatus()).isEqualTo(GenerationStatus.READY_FOR_REVIEW);
        verify(geminiClientService).generateWithSystemInstruction(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true));
    }

    @Test
    @DisplayName("generateQuizFromContent: khi Groq & Gemini cùng lỗi hoặc JSON rỗng -> đánh dấu REJECTED và ném BadRequestException")
    void generateQuizFromContent_marksRejectedAndThrowsBadRequestWhenBothProvidersFail() {
        UUID teacherId = UUID.randomUUID();
        User teacherUser = User.builder().id(teacherId).firstName("Cô").lastName("Hoa").build();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.empty());
        when(userRepository.findById(teacherId)).thenReturn(Optional.of(teacherUser));
        when(teacherRepository.save(any(Teacher.class))).thenAnswer(inv -> inv.getArgument(0));
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenThrow(new RuntimeException("Groq timeout"));
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("{}");

        assertThatThrownBy(() -> service.generateQuizFromContent("Lesson", "B2", 3, teacherId, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Không thể tạo bài tập từ AI");

        ArgumentCaptor<AiGeneratedExercise> savedCaptor = ArgumentCaptor.forClass(AiGeneratedExercise.class);
        verify(aiGeneratedExerciseRepository, atLeast(2)).save(savedCaptor.capture());
        assertThat(savedCaptor.getValue().getStatus()).isEqualTo(GenerationStatus.REJECTED);
    }

    @Test
    @DisplayName("generateQuizFromContent: làm giàu dữ liệu VOCABULARY (IPA + Youdao), SHADOWING (Kokoro), LISTENING & MATCHING")
    void generateQuizFromContent_enrichesVocabShadowingListeningWritingAndMatching() throws Exception {
        UUID teacherId = UUID.randomUUID();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(Teacher.builder().id(teacherId).build()));
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. VOCABULARY: gọi DictionaryLookupService & sinh audioUrl Youdao
        when(dictionaryLookupService.lookup("resilient")).thenReturn(
                DictionaryLookupService.DictionaryEntryDto.builder().word("resilient").ipa("/rɪˈzɪl.jənt/").build());
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("""
                        {"questions":[{"prompt":"Means able to recover quickly","word":"resilient!","correctAnswer":"resilient","explanation":"Adj"}]}
                        """);

        AiGeneratedExercise vocab = service.generateQuizFromContent("Adjectives", "B2", 1, teacherId, null, "VOCAB_MEANING_TO_WORD");
        JsonNode vocabQ = objectMapper.readTree(vocab.getRawResponseJson()).path("questions").get(0);
        assertThat(vocabQ.path("targetWord").asText()).isEqualTo("resilient");
        assertThat(vocabQ.path("ipa").asText()).isEqualTo("/rɪˈzɪl.jənt/");
        assertThat(vocabQ.path("audioUrl").asText()).contains("dict.youdao.com/dictvoice?audio=resilient");
        assertThat(vocabQ.path("explanation").asText()).contains("Phiên âm IPA: /rɪˈzɪl.jənt/");

        // 2. SPEAKING_SHADOWING: chuyển '?' -> '.', set AUDIO_RESPONSE & gọi Kokoro TTS
        when(exerciseAudioService.synthesizeRawScriptToUrl(eq("Practice pronunciation daily."), eq("af_heart"), eq(1.0)))
                .thenReturn("https://cdn.test/shadow_1.wav");
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("""
                        {"questions":[{"prompt":"Say: \\"Practice pronunciation daily?\\""}]}
                        """);

        AiGeneratedExercise shadowing = service.generateQuizFromContent("Speech", "B1", 1, teacherId, null, "SPEAKING_SHADOWING");
        JsonNode shadowRoot = objectMapper.readTree(shadowing.getRawResponseJson());
        assertThat(shadowRoot.path("speakingMode").asText()).isEqualTo("SHADOWING");
        assertThat(shadowRoot.path("questions").get(0).path("audioUrl").asText()).isEqualTo("https://cdn.test/shadow_1.wav");
        assertThat(shadowRoot.path("questions").get(0).path("questionType").asText()).isEqualTo("AUDIO_RESPONSE");

        // 3. LISTENING_MC: đưa audio lên root và xóa audioUrl/transcript ở câu hỏi con
        when(exerciseAudioService.synthesizeRawScriptToUrl(eq("Alice went to Paris."), eq("af_heart"), eq(1.0)))
                .thenReturn("https://cdn.test/listen_passage.wav");
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("""
                        {"listeningPassage":"Alice went to Paris.","questions":[{"prompt":"Where did Alice go?","transcript":"Alice went to Paris.","audioUrl":"old","correctAnswer":"Paris"}]}
                        """);

        AiGeneratedExercise listening = service.generateQuizFromContent("Travel", "A2", 1, teacherId, null, "LISTENING_MC");
        JsonNode listenRoot = objectMapper.readTree(listening.getRawResponseJson());
        assertThat(listenRoot.path("audioUrl").asText()).isEqualTo("https://cdn.test/listen_passage.wav");
        assertThat(listenRoot.path("questions").get(0).has("audioUrl")).isFalse();
        assertThat(listenRoot.path("questions").get(0).has("transcript")).isFalse();

        // 4. WRITING_WORD_ARRANGEMENT & WRITING_PARAGRAPH
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("{\"questions\":[{\"prompt\":\"always / she / early / wakes\"}]}");
        AiGeneratedExercise wSentence = service.generateQuizFromContent("Order", "A2", 1, teacherId, null, "WRITING_WORD_ARRANGEMENT");
        assertThat(objectMapper.readTree(wSentence.getRawResponseJson()).path("questions").get(0).path("questionType").asText())
                .isEqualTo("FILL_IN_BLANK");

        // 5. MATCHING từ pairs -> chuẩn hóa hai chiều thành questions + type=MATCHING
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("{\"pairs\":[{\"word\":\"benevolent\",\"ipa\":\"/bəˈnev.ə.lənt/\",\"meaning\":\"nhân hậu\"}]}");
        AiGeneratedExercise matching = service.generateQuizFromContent("Vocab", "B2", 1, teacherId, null, "VOCAB_MATCHING");
        JsonNode matchRoot = objectMapper.readTree(matching.getRawResponseJson());
        assertThat(matchRoot.path("type").asText()).isEqualTo("MATCHING");
        assertThat(matchRoot.path("questions")).hasSize(1);
    }

    @Test
    @DisplayName("publishExerciseToAssignment: chuyển đổi JSON thành AssignmentRequest, gọi AssignmentService và PUBLISHED")
    void publishExerciseToAssignment_convertsQuestionsAndMarksPublished() {
        UUID exerciseId = UUID.randomUUID();
        UUID classroomId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        Lesson lesson = Lesson.builder().id(lessonId).title("Unit 5 Audio").build();

        AiGeneratedExercise exercise = AiGeneratedExercise.builder()
                .id(exerciseId)
                .lesson(lesson)
                .exerciseType("LISTENING_MC")
                .targetCefr("B1")
                .questionCount(2)
                .rawResponseJson("""
                        {
                          "listeningPassage": "The train leaves at nine.",
                          "audioUrl": "https://cdn.test/train.wav",
                          "questions": [
                            {"prompt": "What time does the train leave?", "correctAnswer": "Nine", "options": ["Eight", "Nine"]},
                            {"prompt": "The train arrives at ____.", "questionType": "FILL_IN_BLANK", "correctAnswer": "ten"}
                          ]
                        }
                        """)
                .build();

        when(aiGeneratedExerciseRepository.findById(exerciseId)).thenReturn(Optional.of(exercise));
        Assignment created = Assignment.builder().id(UUID.randomUUID()).title("AI Generated: Unit 5 Audio").build();
        when(assignmentService.createAssignment(any(AssignmentRequest.class))).thenReturn(created);

        Assignment res = service.publishExerciseToAssignment(exerciseId, classroomId);

        assertThat(res.getId()).isEqualTo(created.getId());
        assertThat(exercise.getStatus()).isEqualTo(GenerationStatus.PUBLISHED);
        verify(aiGeneratedExerciseRepository).save(exercise);

        ArgumentCaptor<AssignmentRequest> reqCaptor = ArgumentCaptor.forClass(AssignmentRequest.class);
        verify(assignmentService).createAssignment(reqCaptor.capture());
        AssignmentRequest captured = reqCaptor.getValue();
        assertThat(captured.getSkillType()).isEqualTo("LISTENING");
        assertThat(captured.getAudioUrl()).isEqualTo("https://cdn.test/train.wav");
        assertThat(captured.getListeningScript()).isEqualTo("The train leaves at nine.");
        assertThat(captured.getQuestions()).hasSize(2);
        assertThat(captured.getQuestions().get(0).getOptions()).hasSize(2);
        assertThat(captured.getQuestions().get(1).getQuestionType()).isEqualTo("FILL_IN_BLANK");

        UUID missingId = UUID.randomUUID();
        when(aiGeneratedExerciseRepository.findById(missingId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.publishExerciseToAssignment(missingId, classroomId))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Không tìm thấy bài tập AI");
    }

    @Test
    @DisplayName("evaluateReadingShortAnswer & generateExamDraft: kiểm tra validation và gộp đề đa kỹ năng")
    void evaluateReadingShortAnswer_andGenerateExamDraft() {
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {"isContentCorrect":true,"isGrammarCorrect":false,"scoreOutOf10":8.5}
                """);
        JsonNode readingRes = service.evaluateReadingShortAnswer("Anna works in a cafe.", "Where does she work?", "in cafe", "in a cafe");
        assertThat(readingRes.path("isContentCorrect").asBoolean()).isTrue();
        assertThat(readingRes.path("scoreOutOf10").asDouble()).isEqualTo(8.5);

        // generateExamDraft với sections null/empty -> BadRequestException
        assertThatThrownBy(() -> service.generateExamDraft(new AiExamGenerateRequest(), UUID.randomUUID()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ít nhất một kỹ năng");

        // generateExamDraft đa kỹ năng READING (TRUE_FALSE) + LISTENING (DIALOGUE)
        UUID teacherId = UUID.randomUUID();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(Teacher.builder().id(teacherId).build()));
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class))).thenAnswer(inv -> inv.getArgument(0));

        when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble(), eq(teacherId), eq(true)))
                .thenReturn("""
                        {"readingPassage":"Solar power is renewable.","questions":[{"prompt":"Solar power is clean.","correctAnswer":"TRUE"}]}
                        """)
                .thenReturn("""
                        {"listeningPassage":"A: Hi! B: Hello!","questions":[{"prompt":"Who spoke first?","correctAnswer":"A","options":["A","B"]}]}
                        """);

        AiExamGenerateRequest draftReq = AiExamGenerateRequest.builder()
                .topic("Green Energy")
                .targetCefr("B2")
                .sections(List.of(
                        AiExamGenerateRequest.SkillSectionSpec.builder()
                                .skillType("READING").questionFormat("TRUE_FALSE").questionCount(1).build(),
                        AiExamGenerateRequest.SkillSectionSpec.builder()
                                .skillType("LISTENING").questionFormat("DIALOGUE").questionCount(1).pointsPerQuestion(2.0).build()
                ))
                .build();

        AiExamDraftResponse draft = service.generateExamDraft(draftReq, teacherId);

        assertThat(draft.getTitle()).isEqualTo("Đề thi B2 - Green Energy");
        assertThat(draft.getExamSkills()).containsExactly("READING", "LISTENING");
        assertThat(draft.getListeningScript()).isEqualTo("A: Hi! B: Hello!");
        assertThat(draft.getQuestions()).hasSize(2);
        assertThat(draft.getQuestions().get(0).getPromptText()).contains("[READING PASSAGE]");
        assertThat(draft.getQuestions().get(0).getOptions()).hasSize(3);
        assertThat(draft.getQuestions().get(1).getTranscript()).isEqualTo("A: Hi! B: Hello!");
        assertThat(draft.getQuestions().get(1).getPoints()).isEqualTo(2.0);
    }

    @Test
    @DisplayName("Chuẩn hóa đáp án AI: TRUE/FALSE/NOT GIVEN đủ 3 option, bóc tiền tố A./B., và hậu kiểm ERROR_CORRECTION + sub-formats mới")
    void generateAndPublish_normalizesTrueFalseNotGivenMultipleChoicePrefixesAndNewFormats() throws Exception {
        UUID teacherId = UUID.randomUUID();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(Teacher.builder().id(teacherId).build()));
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. MULTIPLE_CHOICE với tiền tố "A. "/"B. " và ERROR_CORRECTION kèm wrongWord
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("""
                        {
                          "questions": [
                            {
                              "questionType": "MULTIPLE_CHOICE",
                              "prompt": "She ______ to Hanoi yesterday.",
                              "options": ["A. go", "B. went", "C. gone", "D. going"],
                              "correctAnswer": "B. went",
                              "explanation": "Thì quá khứ đơn dùng 'went'."
                            }
                          ]
                        }
                        """);
        AiGeneratedExercise mcEx = service.generateQuizFromContent("Past simple", "A2", 1, teacherId, null, "GRAMMAR_MULTIPLE_CHOICE", "GRAMMAR");
        JsonNode mcQ = objectMapper.readTree(mcEx.getRawResponseJson()).path("questions").get(0);
        assertThat(mcQ.path("correctAnswer").asText()).isEqualTo("went");
        assertThat(mcQ.path("options").get(0).asText()).isEqualTo("go");

        // 2. ERROR_CORRECTION tạo biến thể multi-answer với '|'
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("""
                        {
                          "questions": [
                            {
                              "questionType": "FILL_IN_BLANK",
                              "prompt": "Tìm và sửa lỗi sai: She go to school every day.",
                              "wrongWord": "go",
                              "correctAnswer": "goes",
                              "explanation": "Chủ ngữ số ít 'She' đi với động từ thêm -es: goes."
                            }
                          ]
                        }
                        """);
        AiGeneratedExercise errEx = service.generateQuizFromContent("S-V agreement", "A1", 1, teacherId, null, "GRAMMAR_ERROR_CORRECTION", "GRAMMAR");
        JsonNode errQ = objectMapper.readTree(errEx.getRawResponseJson()).path("questions").get(0);
        assertThat(errQ.path("correctAnswer").asText()).isEqualTo("goes | go -> goes");

        // 3. READING_YES_NO với đáp án "NOT GIVEN" phải tạo đủ 3 option khi publish
        UUID exId = UUID.randomUUID();
        UUID classroomId = UUID.randomUUID();
        AiGeneratedExercise tfExercise = AiGeneratedExercise.builder()
                .id(exId)
                .exerciseType("READING_YES_NO")
                .targetCefr("IELTS")
                .questionCount(1)
                .rawResponseJson("""
                        {
                          "readingPassage": "Passage 1: Cities are adapting to climate change.",
                          "questions": [
                            {
                              "questionType": "TRUE_FALSE",
                              "prompt": "All cities have already banned cars.",
                              "correctAnswer": "NOT GIVEN",
                              "explanation": "Bài đọc không đề cập việc cấm xe hơi."
                            }
                          ]
                        }
                        """)
                .build();
        when(aiGeneratedExerciseRepository.findById(exId)).thenReturn(Optional.of(tfExercise));
        when(assignmentService.createAssignment(any(AssignmentRequest.class)))
                .thenReturn(Assignment.builder().id(UUID.randomUUID()).title("IELTS TFNG").build());

        service.publishExerciseToAssignment(exId, classroomId);
        ArgumentCaptor<AssignmentRequest> reqCaptor = ArgumentCaptor.forClass(AssignmentRequest.class);
        verify(assignmentService).createAssignment(reqCaptor.capture());
        List<AssignmentRequest.OptionRequest> tfOpts = reqCaptor.getValue().getQuestions().get(0).getOptions();
        assertThat(tfOpts).hasSize(3);
        assertThat(tfOpts.stream().map(AssignmentRequest.OptionRequest::getOptionText))
                .containsExactly("TRUE", "FALSE", "NOT GIVEN");
        assertThat(tfOpts.stream().filter(o -> "NOT GIVEN".equals(o.getOptionText())).findFirst().orElseThrow().isCorrect())
                .isTrue();

        // 4. Các sub-format mới: GRAMMAR_INVERSION & READING_MATCHING không rơi nhầm về dạng sai
        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("""
                        {
                          "readingPassage": "[Paragraph A] Renewable power grew rapidly.",
                          "questions": [
                            {
                              "questionType": "MULTIPLE_CHOICE",
                              "prompt": "Choose heading for Paragraph A",
                              "options": ["Growth of clean energy", "Oil reserves", "Nuclear risk", "Coal history"],
                              "correctAnswer": "Growth of clean energy",
                              "explanation": "Đoạn A nói về sự tăng trưởng năng lượng tái tạo."
                            }
                          ]
                        }
                        """);
        AiGeneratedExercise matchRead = service.generateQuizFromContent("Passage 2: Clean Energy", "IELTS", 1, teacherId, null, "READING_MATCHING", "READING");
        assertThat(matchRead.getStatus()).isEqualTo(GenerationStatus.READY_FOR_REVIEW);
        ArgumentCaptor<String> sysPromptCaptor = ArgumentCaptor.forClass(String.class);
        verify(groqClientService, atLeastOnce()).chatCompletionJson(sysPromptCaptor.capture(), anyString(), eq(0.3), eq(teacherId), eq(true));
        assertThat(sysPromptCaptor.getValue()).contains("Paragraph A").contains("Passage 2");
    }

    @Test
    @DisplayName("generateQuizFromContent: SPEAKING_PART_2 & SPEAKING_PART_3 sinh đề tiếng Anh thuần và không gắn audio mẫu")
    void generateQuizFromContent_speakingPart2AndPart3KeepEnglishPromptsWithoutSampleAudio() throws Exception {
        UUID teacherId = UUID.randomUUID();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(Teacher.builder().id(teacherId).build()));
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class))).thenAnswer(inv -> inv.getArgument(0));

        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("""
                        {
                          "audioUrl": "https://stale.test/should_be_removed.wav",
                          "questions": [
                            {
                              "question": "Describe a skill you learned recently.\\nYou should say:\\n- what it is\\n- how you learned it",
                              "audioUrl": "https://stale.test/q1.wav",
                              "transcript": "old transcript",
                              "explanation": "Gợi ý cấu trúc Part 2.",
                              "correctAnswer": "Nêu kỹ năng và quá trình học"
                            }
                          ]
                        }
                        """);

        AiGeneratedExercise part2 = service.generateQuizFromContent("Skills", "B2", 1, teacherId, null, "SPEAKING_PART_2", "SPEAKING");
        JsonNode part2Root = objectMapper.readTree(part2.getRawResponseJson());
        assertThat(part2.getExerciseType()).isEqualTo("SPEAKING_PART_2");
        assertThat(part2Root.path("speakingMode").asText()).isEqualTo("PART_2");
        assertThat(part2Root.has("audioUrl")).isFalse();
        JsonNode p2Q = part2Root.path("questions").get(0);
        assertThat(p2Q.path("speakingMode").asText()).isEqualTo("PART_2");
        assertThat(p2Q.path("questionType").asText()).isEqualTo("AUDIO_RESPONSE");
        assertThat(p2Q.path("prompt").asText()).contains("You should say:");
        assertThat(p2Q.has("audioUrl")).isFalse();
        assertThat(p2Q.has("transcript")).isFalse();

        when(groqClientService.chatCompletionJson(anyString(), anyString(), eq(0.3), eq(teacherId), eq(true)))
                .thenReturn("""
                        {
                          "questions": [
                            {
                              "prompt": "Why do young adults prefer flexible careers nowadays?",
                              "explanation": "Áp dụng PEEL: Point - Explain - Example - Link.",
                              "correctAnswer": "So sánh ổn định và linh hoạt"
                            }
                          ]
                        }
                        """);

        AiGeneratedExercise part3 = service.generateQuizFromContent("Work", "C1", 1, teacherId, null, "SPEAKING_PART_3", "SPEAKING");
        JsonNode part3Root = objectMapper.readTree(part3.getRawResponseJson());
        assertThat(part3.getExerciseType()).isEqualTo("SPEAKING_PART_3");
        assertThat(part3Root.path("speakingMode").asText()).isEqualTo("PART_3");
        assertThat(part3Root.path("questions").get(0).path("prompt").asText()).endsWith("?");
        assertThat(part3Root.path("questions").get(0).has("audioUrl")).isFalse();
        verifyNoInteractions(exerciseAudioService);
    }

    @Test
    @DisplayName("evaluateSpeakingTopic: chặn im lặng/nhiễu Whisper, nói tiếng Việt, đọc vẹt đề bài và giới hạn band Part 2/Part 3 ngắn")
    void evaluateSpeakingTopic_enforcesStrictGuardrailsAndLengthCaps() {
        MockMultipartFile audio = new MockMultipartFile("audio", "speech.webm", "audio/webm", "data".getBytes());

        // 1. Im lặng / Whisper hallucination -> 0.0 band, không gọi Groq LLM
        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("Thank you.");
        JsonNode silenceRes = service.evaluateSpeakingTopic("Describe your hometown.", audio, null, "QA", null);
        assertThat(silenceRes.path("overallBand").asDouble()).isEqualTo(0.0);
        assertThat(silenceRes.path("overallScore").asInt()).isEqualTo(0);
        assertThat(silenceRes.path("isPassed").asBoolean()).isFalse();
        assertThat(silenceRes.path("isOffTopic").asBoolean()).isTrue();
        verify(groqClientService, never()).chatCompletionJson(anyString(), anyString());

        // 2. Nói tiếng Việt -> Band 1.5, off-topic, không gọi Groq LLM
        when(groqClientService.transcribeAudio(any(MultipartFile.class)))
                .thenReturn("Hôm nay tôi thích đi học cùng bạn bè rất vui.");
        JsonNode viRes = service.evaluateSpeakingTopic("Do you like going to school?", audio, null, "QA", null);
        assertThat(viRes.path("overallBand").asDouble()).isLessThanOrEqualTo(1.5);
        assertThat(viRes.path("isPassed").asBoolean()).isFalse();
        assertThat(viRes.path("isOffTopic").asBoolean()).isTrue();
        verify(groqClientService, never()).chatCompletionJson(anyString(), anyString());

        // 3. Đọc vẹt lại nguyên đề bài -> Band 2.0, off-topic, không gọi Groq LLM
        when(groqClientService.transcribeAudio(any(MultipartFile.class)))
                .thenReturn("How can cities integrate green spaces into urban areas?");
        JsonNode parrotRes = service.evaluateSpeakingTopic(
                "How can cities integrate green spaces into urban areas?", audio, null, "PART_3", null);
        assertThat(parrotRes.path("overallBand").asDouble()).isLessThanOrEqualTo(2.0);
        assertThat(parrotRes.path("isOffTopic").asBoolean()).isTrue();
        verify(groqClientService, never()).chatCompletionJson(anyString(), anyString());

        // 4. IELTS Part 2 trả lời quá ngắn (< 25 từ) dù LLM chấm cao vẫn bị kìm <= 3.5 và đồng bộ overallScore
        when(groqClientService.transcribeAudio(any(MultipartFile.class)))
                .thenReturn("I visited Da Nang last summer with my family and it was very fun and relaxing for everyone.");
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 7.5, "addressedPoints": ["place"], "missingPoints": ["feeling", "activities"]},
                  "overallBand": 7.5,
                  "pronunciationScore": 7.0,
                  "fluencyScore": 7.0,
                  "lexicalScore": 7.0,
                  "grammarScore": 7.0,
                  "coherenceScore": 7.0
                }
                """);
        JsonNode shortPart2 = service.evaluateSpeakingTopic("Describe a trip.\nYou should say:\n- where", audio, null, "PART_2", null);
        assertThat(shortPart2.path("speakingMode").asText()).isEqualTo("PART_2");
        assertThat(shortPart2.path("overallBand").asDouble()).isLessThanOrEqualTo(3.5);
        assertThat(shortPart2.path("isPassed").asBoolean()).isFalse();
        assertThat(shortPart2.path("overallScore").asInt()).isLessThanOrEqualTo(39);
    }

    @Test
    @DisplayName("evaluateSpeakingTopic: tích hợp điểm phát âm + IPA từ Python phonetics engine và vẫn chạy khi Python lỗi")
    void evaluateSpeakingTopic_fusesPythonPhoneticsAndDegradesGracefullyOnError() {
        MockMultipartFile audio = new MockMultipartFile("audio", "speech.webm", "audio/webm", "fake-audio-bytes".getBytes());

        when(groqClientService.transcribeAudio(any(MultipartFile.class)))
                .thenReturn("I usually read books in the evening because it helps me relax ummm after a long busy day at work.");
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 7.0, "addressedPoints": ["hobby", "reason"], "missingPoints": []},
                  "overallBand": 7.0,
                  "pronunciationScore": 7.5,
                  "fluencyScore": 7.0,
                  "lexicalScore": 7.0,
                  "grammarScore": 7.0,
                  "coherenceScore": 7.0,
                  "mistakes": []
                }
                """);

        ShadowingEvaluationResponse pyResp = ShadowingEvaluationResponse.builder()
                .overallScore(62)
                .isPassed(false)
                .evaluatedBy("PYTHON_ACOUSTIC_ENGINE")
                .kpi(ShadowingEvaluationResponse.KpiMetrics.builder()
                        .pronunciation(56)
                        .fluency(65)
                        .completeness(95)
                        .prosody(60)
                        .wordsPerMinute(132)
                        .build())
                .wordRows(java.util.List.of(
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                .word("books")
                                .score(48)
                                .wordStatus("PARTIAL")
                                .phonemes(java.util.List.of(
                                        ShadowingEvaluationResponse.PhonemeItem.builder()
                                                .ipa("/s/")
                                                .score(35)
                                                .note("Thiếu âm gió cuối /s/")
                                                .build()))
                                .build()))
                .build();

        when(pythonIntegrationService.evaluatePhonetics(any(), anyString(), anyString())).thenReturn(pyResp);

        JsonNode resWithPy = service.evaluateSpeakingTopic("Do you like reading books?", audio, null, "QA", null);

        // "ummm" phải được chuẩn hóa thành "umm" trước khi gửi qua Python validate_script
        verify(pythonIntegrationService).evaluatePhonetics(any(), eq("speech.webm"),
                org.mockito.ArgumentMatchers.contains("umm"));
        assertThat(resWithPy.path("sttEngine").asText()).isEqualTo("GROQ_WHISPER");
        assertThat(resWithPy.path("recognizedScript").asText()).contains("read books");
        assertThat(resWithPy.path("phoneticEvaluation").path("evaluatedBy").asText()).isEqualTo("PYTHON_ACOUSTIC_ENGINE");
        assertThat(resWithPy.path("wordsPerMinute").asInt()).isEqualTo(132);
        // Python pron 56/100 -> ~5.04 blended 75% với LLM 7.5 (25%) -> ~5.65 -> round half band 5.5
        assertThat(resWithPy.path("pronunciationScore").asDouble()).isLessThanOrEqualTo(6.0);
        assertThat(resWithPy.path("mistakes").toString()).contains("books", "pronunciation");

        // Graceful degradation nếu Python service timeout / exception -> không ném 500
        when(pythonIntegrationService.evaluatePhonetics(any(), anyString(), anyString()))
                .thenThrow(new RuntimeException("Connection refused"));

        JsonNode resFallback = service.evaluateSpeakingTopic("Do you like reading books?", audio, null, "QA", null);
        assertThat(resFallback.path("overallBand").asDouble()).isEqualTo(7.0);
        assertThat(resFallback.path("pronunciationScore").asDouble()).isEqualTo(7.5);
    }

    @Test
    @DisplayName("evaluateSpeakingTopic: khi Groq Whisper lỗi hoặc trả về rỗng, tự động dùng Gemini nhận diện script trước rồi chuyển sang Python chấm phát âm")
    void evaluateSpeakingTopic_fallsBackToGeminiSttWhenGroqFailsBeforePassingToPython() {
        MockMultipartFile audio = new MockMultipartFile(
                "audio", "part2.webm", "audio/webm", "fake-webm-bytes".getBytes());

        when(groqClientService.transcribeAudio(any(MultipartFile.class)))
                .thenThrow(new RuntimeException("Groq Whisper 429 Too Many Requests"));

        String geminiRecognizedText = "I would like to describe a peaceful beach trip I took with my family last summer in Da Nang. "
                + "First of all, we stayed near the coast for three days and woke up early every morning to watch the sunrise. "
                + "Moreover, we swam together, ate fresh seafood, and talked freely without worrying about schoolwork. "
                + "Overall, it was unforgettable because everyone felt relaxed and closer afterwards.";

        when(geminiClientService.evaluateAudioWithInstruction(anyString(), any(byte[].class), eq("audio/webm"), anyString()))
                .thenReturn("{\"transcript\": \"" + geminiRecognizedText + "\"}");

        ShadowingEvaluationResponse pyResp = ShadowingEvaluationResponse.builder()
                .overallScore(82)
                .isPassed(true)
                .evaluatedBy("PYTHON_ACOUSTIC_ENGINE")
                .kpi(ShadowingEvaluationResponse.KpiMetrics.builder()
                        .pronunciation(84)
                        .fluency(80)
                        .completeness(98)
                        .prosody(81)
                        .wordsPerMinute(125)
                        .build())
                .wordRows(java.util.List.of())
                .build();

        when(pythonIntegrationService.evaluatePhonetics(any(byte[].class), eq("part2.webm"), anyString()))
                .thenReturn(pyResp);
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 7.0, "addressedPoints": ["where", "activities", "reason"], "missingPoints": []},
                  "overallBand": 7.0,
                  "pronunciationScore": 7.0,
                  "fluencyScore": 7.0,
                  "lexicalScore": 7.0,
                  "grammarScore": 7.0,
                  "coherenceScore": 7.0,
                  "mistakes": []
                }
                """);

        JsonNode result = service.evaluateSpeakingTopic("Describe a memorable trip", audio, null, "PART_2", null);

        verify(geminiClientService).evaluateAudioWithInstruction(anyString(), any(byte[].class), eq("audio/webm"), anyString());
        verify(pythonIntegrationService).evaluatePhonetics(any(byte[].class), eq("part2.webm"),
                org.mockito.ArgumentMatchers.contains("peaceful beach trip"));

        assertThat(result.path("sttEngine").asText()).isEqualTo("GEMINI_AUDIO_STT");
        assertThat(result.path("recognizedScript").asText()).contains("peaceful beach trip");
        assertThat(result.path("wordsPerMinute").asInt()).isEqualTo(125);
        assertThat(result.path("phoneticEvaluation").path("evaluatedBy").asText()).isEqualTo("PYTHON_ACOUSTIC_ENGINE");
    }

    @Test
    @DisplayName("evaluateWriting Tier 1: ưu tiên Python writing-scorer cục bộ khi khả dụng, lưu AiEvaluation & không gọi Cloud LLM")
    void evaluateWriting_usesTier1LocalPythonScorerWithoutCloudCall() throws Exception {
        UUID studentId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();
        Student student = Student.builder().id(studentId).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder().student(student).build();
        Assignment assignment = Assignment.builder().title("IELTS Writing Task 2").build();
        AssignmentQuestion question = AssignmentQuestion.builder()
                .assignment(assignment)
                .promptText("Governments should invest in public transport.")
                .correctAnswer("Discuss benefits")
                .explanation("Task 2 rubric")
                .build();
        StudentAnswer answer = StudentAnswer.builder()
                .id(answerId)
                .attempt(attempt)
                .question(question)
                .build();

        JsonNode localResponse = objectMapper.readTree("""
                {
                  "wordCount": 272,
                  "isOffTopic": false,
                  "taskAchievement": {
                    "score": 6.5,
                    "addressedPoints": ["Đề cập lợi ích giao thông công cộng"],
                    "missingPoints": []
                  },
                  "overallBand": 6.5,
                  "estimatedCefr": "B2",
                  "grammarScore": 6.0,
                  "vocabularyScore": 7.0,
                  "coherenceScore": 6.5,
                  "correctedText": "Corrected text.",
                  "mistakes": [{"original": "enviroment", "correction": "environment", "type": "spelling", "explanation": "Lỗi chính tả."}],
                  "suggestions": [{"area": "Ngữ pháp", "recommendation": "Dùng thêm câu phức."}],
                  "generalFeedback": "Ước lượng điểm tổng thể: Band 6.5/9.0 (trình độ B2).",
                  "evaluatedBy": "PYTHON_WRITING_SCORER",
                  "modelType": "baseline"
                }
                """);

        when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
        when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(true);
        when(pythonIntegrationService.evaluateWriting(
                eq("Governments should invest in public transport."),
                eq("My 272-word essay."),
                eq("IELTS Writing Task 2"),
                eq("Discuss benefits"),
                eq("Task 2 rubric"),
                eq("TASK_2")))
                .thenReturn(localResponse);

        JsonNode result = service.evaluateWriting("Ignored topic", "My 272-word essay.", answerId);

        assertThat(result.path("overallBand").asDouble()).isEqualTo(6.5);
        assertThat(result.path("writingTask").asText()).isEqualTo("TASK_2");
        assertThat(result.path("evaluatedBy").asText()).isEqualTo("PYTHON_WRITING_SCORER");
        verifyNoInteractions(groqClientService, geminiClientService);

        ArgumentCaptor<AiEvaluation> evalCaptor = ArgumentCaptor.forClass(AiEvaluation.class);
        verify(aiEvaluationRepository).save(evalCaptor.capture());
        AiEvaluation savedEval = evalCaptor.getValue();
        assertThat(savedEval.getEvalType()).isEqualTo(AiEvaluationType.WRITING);
        assertThat(savedEval.getEvaluationEngine()).isEqualTo("PYTHON_WRITING_SCORER");
        assertThat(savedEval.getOverallScore()).isEqualTo(6.5);
        assertThat(savedEval.getGrammarScore()).isEqualTo(6.0);
        assertThat(savedEval.getVocabularyScore()).isEqualTo(7.0);
        assertThat(savedEval.getCoherenceScore()).isEqualTo(6.5);
        assertThat(savedEval.getEstimatedCefr()).isEqualTo("B2");

        assertThat(answer.getEarnedPoints()).isEqualTo(6.5);
        assertThat(answer.getIsCorrect()).isTrue();
        assertThat(answer.getEvalFeedback()).contains("PYTHON_WRITING_SCORER").contains("\"writingTask\":\"TASK_2\"");
        verify(entityManager).merge(answer);
        verify(analyticsService).updateSkillScore(studentId, "WRITING", 3.25);
    }

    @Test
    @DisplayName("evaluateWriting Tier 2/3 Fallback: chuyển sang Groq rồi Gemini khi Python writing-scorer lỗi hoặc không khả dụng")
    void evaluateWriting_fallsBackToGroqAndGeminiWhenLocalServiceFails() {
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(true);
        when(pythonIntegrationService.evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), eq("TASK_2")))
                .thenThrow(new RuntimeException("Connection refused: localhost:8001"));

        // Case 1: Python down -> Groq succeeds with Task 2 rubric
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "overallBand": 6.0,
                  "grammarScore": 6.0,
                  "vocabularyScore": 6.0,
                  "coherenceScore": 6.0,
                  "estimatedCefr": "B2",
                  "correctedText": "Sample",
                  "mistakes": [],
                  "suggestions": [],
                  "generalFeedback": "Fallback Groq ok"
                }
                """);

        String valid260WordEssay = ("Public transportation reduces urban congestion and carbon emissions across growing metropolitan regions. ".repeat(19));

        JsonNode groqFallback = service.evaluateWriting("Environment and public transportation", valid260WordEssay, null);
        assertThat(groqFallback.path("overallBand").asDouble()).isEqualTo(6.0);
        assertThat(groqFallback.path("writingTask").asText()).isEqualTo("TASK_2");
        assertThat(groqFallback.path("writingSubType").asText()).isEqualTo("TASK2_OPINION");
        assertThat(groqFallback.path("evaluatedBy").asText()).isEqualTo("GROQ_WRITING_TASK2_LLM");
        assertThat(groqFallback.path("generalFeedback").asText()).isEqualTo("Fallback Groq ok");

        ArgumentCaptor<String> sysPromptCaptor = ArgumentCaptor.forClass(String.class);
        verify(groqClientService).chatCompletionJson(sysPromptCaptor.capture(), anyString());
        assertThat(sysPromptCaptor.getValue()).contains("IELTS Writing Task 2").contains("250 words");

        // Case 2: Python down + Groq down -> Gemini fallback succeeds
        when(groqClientService.chatCompletionJson(anyString(), anyString()))
                .thenThrow(new RuntimeException("Groq 503"));
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString())).thenReturn("""
                ```json
                {
                  "overallBand": 5.5,
                  "grammarScore": 5.0,
                  "vocabularyScore": 6.0,
                  "coherenceScore": 6.0,
                  "estimatedCefr": "B2",
                  "correctedText": "",
                  "mistakes": [],
                  "suggestions": [],
                  "generalFeedback": "Fallback Gemini ok"
                }
                ```
                """);

        JsonNode geminiFallback = service.evaluateWriting("Environment", valid260WordEssay, null, "TASK_2");
        assertThat(geminiFallback.path("overallBand").asDouble()).isEqualTo(5.5);
        assertThat(geminiFallback.path("writingTask").asText()).isEqualTo("TASK_2");
        assertThat(geminiFallback.path("evaluatedBy").asText()).isEqualTo("GEMINI_WRITING_TASK2_LLM");
        assertThat(geminiFallback.path("generalFeedback").asText()).isEqualTo("Fallback Gemini ok");
    }

    @Test
    @DisplayName("evaluateWriting Hybrid Mode: giữ nguyên band score của Python local model khi enrich-feedback-with-llm=true")
    void evaluateWriting_keepsLocalScoresWhenHybridEnrichmentEnabled() throws Exception {
        ReflectionTestUtils.setField(service, "enrichLocalWritingWithLlm", true);

        JsonNode localResponse = objectMapper.readTree("""
                {
                  "wordCount": 260,
                  "isOffTopic": false,
                  "taskAchievement": {"score": 5.5, "addressedPoints": ["Local point"], "missingPoints": ["Local gap"]},
                  "overallBand": 5.5,
                  "estimatedCefr": "B2",
                  "grammarScore": 5.5,
                  "vocabularyScore": 5.5,
                  "coherenceScore": 5.5,
                  "correctedText": "",
                  "mistakes": [],
                  "suggestions": [],
                  "generalFeedback": "Local offline summary",
                  "evaluatedBy": "PYTHON_WRITING_SCORER",
                  "modelType": "baseline"
                }
                """);
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(true);
        when(pythonIntegrationService.evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), eq("TASK_2")))
                .thenReturn(localResponse);
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "overallBand": 8.5,
                  "grammarScore": 8.5,
                  "correctedText": "LLM upgraded essay.",
                  "mistakes": [{"original": "a", "correction": "an", "type": "grammar", "explanation": "LLM note"}],
                  "suggestions": [{"area": "Từ vựng", "recommendation": "LLM vocab tip"}],
                  "generalFeedback": "LLM detailed feedback"
                }
                """);

        JsonNode hybridResult = service.evaluateWriting("Education", "Essay text", null);

        assertThat(hybridResult.path("overallBand").asDouble()).isEqualTo(5.5);
        assertThat(hybridResult.path("grammarScore").asDouble()).isEqualTo(5.5);
        assertThat(hybridResult.path("writingTask").asText()).isEqualTo("TASK_2");
        assertThat(hybridResult.path("evaluatedBy").asText()).isEqualTo("PYTHON_WRITING_SCORER_HYBRID");
        assertThat(hybridResult.path("generalFeedback").asText()).isEqualTo("LLM detailed feedback");
        assertThat(hybridResult.path("correctedText").asText()).isEqualTo("LLM upgraded essay.");
    }

    @Test
    @DisplayName("evaluateWriting TASK_1: hỗ trợ Tier 1 Python writing-scorer & fallback sang Task 1 LLM kèm nhận diện DATA/PROCESS/MAP")
    void evaluateWriting_task1SupportsTier1AndSubtypeLlmFallback() throws Exception {
        UUID studentId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();
        Student student = Student.builder().id(studentId).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder().student(student).build();
        Assignment assignment = Assignment.builder()
                .title("Biểu đồ tiêu thụ năng lượng")
                .description("IELTS Task 1 report")
                .build();
        AssignmentQuestion question = AssignmentQuestion.builder()
                .assignment(assignment)
                .promptText("The bar chart illustrates electricity consumption in 5 countries.")
                .explanation("Recommended 4-paragraph structure (Introduction, Overview, Body 1, Body 2).")
                .mediaUrl("https://cdn.example.com/charts/bar-chart.png")
                .build();
        StudentAnswer answer = StudentAnswer.builder()
                .id(answerId)
                .attempt(attempt)
                .question(question)
                .build();

        String task1Report = ("The bar chart compares electricity consumption across five nations from 2010 to 2020. Overall, demand rose in three countries while declining modestly in two others over the surveyed period. ".repeat(6));

        when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
        when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(false);
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "overallBand": 7.0,
                  "grammarScore": 7.0,
                  "vocabularyScore": 7.0,
                  "coherenceScore": 7.0,
                  "estimatedCefr": "C1",
                  "correctedText": "Overall, consumption rose sharply.",
                  "mistakes": [],
                  "suggestions": [],
                  "generalFeedback": "Overview rõ ràng, mô tả đúng xu hướng."
                }
                """);

        // 1. Auto-detected Task 1 falling back to Groq Task 1 LLM when local scorer is disabled
        JsonNode autoTask1 = service.evaluateWriting("Ignored", task1Report, answerId, "AUTO");

        assertThat(autoTask1.path("writingTask").asText()).isEqualTo("TASK_1");
        assertThat(autoTask1.path("writingSubType").asText()).isEqualTo("TASK1_DATA");
        assertThat(autoTask1.path("evaluatedBy").asText()).isEqualTo("GROQ_WRITING_TASK1_LLM");
        assertThat(answer.getEvalFeedback()).contains("\"writingTask\":\"TASK_1\"");

        ArgumentCaptor<String> sysCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> userCaptor = ArgumentCaptor.forClass(String.class);
        verify(groqClientService).chatCompletionJson(sysCaptor.capture(), userCaptor.capture());
        assertThat(sysCaptor.getValue()).contains("Writing Task 1").contains("150 words").contains("Overview");
        assertThat(userCaptor.getValue()).contains("TASK_1").contains("TASK1_DATA");

        ArgumentCaptor<AiEvaluation> evalCaptor = ArgumentCaptor.forClass(AiEvaluation.class);
        verify(aiEvaluationRepository).save(evalCaptor.capture());
        assertThat(evalCaptor.getValue().getEvaluationEngine()).isEqualTo("GROQ_WRITING_TASK1_LLM");

        // 2. Task 1 Process routes to Python writing-scorer Tier 1 when enabled
        JsonNode pyTask1Process = objectMapper.readTree("""
                {
                  "writingTask": "TASK_1",
                  "writingSubType": "TASK1_PROCESS",
                  "wordCount": 165,
                  "overallBand": 6.5,
                  "grammarScore": 6.5,
                  "vocabularyScore": 6.5,
                  "coherenceScore": 6.5,
                  "estimatedCefr": "B2",
                  "evaluatedBy": "PYTHON_WRITING_SCORER"
                }
                """);
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(true);
        when(pythonIntegrationService.evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), eq("TASK1_PROCESS")))
                .thenReturn(pyTask1Process);

        JsonNode processResult = service.evaluateWriting(
                "The diagram below shows the manufacturing process of glass bottles.",
                task1Report,
                null,
                "TASK1_PROCESS");
        assertThat(processResult.path("writingTask").asText()).isEqualTo("TASK_1");
        assertThat(processResult.path("writingSubType").asText()).isEqualTo("TASK1_PROCESS");
        assertThat(processResult.path("evaluatedBy").asText()).isEqualTo("PYTHON_WRITING_SCORER");
        verify(pythonIntegrationService).evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), eq("TASK1_PROCESS"));
    }

    @Test
    @DisplayName("evaluateWriting PARAGRAPH: hỗ trợ Tier 1 Python writing-scorer (PARAGRAPH / SHORT_EMAIL) & fallback Paragraph LLM")
    void evaluateWriting_paragraphSupportsTier1AndSubtypeLlmFallback() throws Exception {
        String opinionParagraph = ("Reading books every day significantly enhances focus and critical thinking skills among young learners. "
                + "First, sustained reading trains the brain to process complex arguments patiently without digital distractions. "
                + "Moreover, exposure to diverse genres broadens vocabulary and empathy toward different cultures. "
                + "In conclusion, cultivating a daily reading habit brings enduring intellectual benefits.").repeat(2);

        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(false);
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "overallBand": 6.5,
                  "grammarScore": 6.5,
                  "vocabularyScore": 6.5,
                  "coherenceScore": 6.5,
                  "estimatedCefr": "B2",
                  "correctedText": "",
                  "mistakes": [],
                  "suggestions": [],
                  "generalFeedback": "Đoạn văn có topic sentence rõ ràng."
                }
                """);

        // 1. Auto-detected Paragraph even when prompt mentions "100–150 từ" (must NOT misclassify as Task 1)
        JsonNode autoParagraph = service.evaluateWriting(
                "Viết 01 đoạn văn hoàn chỉnh (100–150 từ) về lợi ích của việc đọc sách.",
                opinionParagraph,
                null);

        assertThat(autoParagraph.path("writingTask").asText()).isEqualTo("PARAGRAPH");
        assertThat(autoParagraph.path("evaluatedBy").asText()).isEqualTo("GROQ_WRITING_PARAGRAPH_LLM");

        ArgumentCaptor<String> sysCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> userCaptor = ArgumentCaptor.forClass(String.class);
        verify(groqClientService).chatCompletionJson(sysCaptor.capture(), userCaptor.capture());
        assertThat(sysCaptor.getValue()).contains("SINGLE PARAGRAPH").contains("Topic Sentence");
        assertThat(userCaptor.getValue()).contains("PARAGRAPH");

        // 2. Explicit WRITING_SHORT_EMAIL calls Tier 1 Python writing-scorer with PARAGRAPH_EMAIL when enabled
        JsonNode pyEmail = objectMapper.readTree("""
                {
                  "writingTask": "PARAGRAPH",
                  "writingSubType": "PARAGRAPH_EMAIL",
                  "wordCount": 62,
                  "overallBand": 6.0,
                  "grammarScore": 6.0,
                  "vocabularyScore": 6.0,
                  "coherenceScore": 6.0,
                  "estimatedCefr": "B2",
                  "evaluatedBy": "PYTHON_WRITING_SCORER"
                }
                """);
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(true);
        when(pythonIntegrationService.evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), eq("PARAGRAPH_EMAIL")))
                .thenReturn(pyEmail);

        String shortEmail = "Hi Nam, I'm organizing a weekend study club at the city library on Saturday morning from 9 a.m. We'll practice paragraph writing and vocabulary together. Please let me know if you can join us! Best regards, Minh";
        JsonNode emailResult = service.evaluateWriting(
                "Write a short email (40-80 words) inviting a friend.",
                shortEmail,
                null,
                "WRITING_SHORT_EMAIL");
        assertThat(emailResult.path("writingTask").asText()).isEqualTo("PARAGRAPH");
        assertThat(emailResult.path("writingSubType").asText()).isEqualTo("PARAGRAPH_EMAIL");
        assertThat(emailResult.path("evaluatedBy").asText()).isEqualTo("PYTHON_WRITING_SCORER");
        verify(pythonIntegrationService).evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), eq("PARAGRAPH_EMAIL"));
    }

    @Test
    @DisplayName("evaluateWriting Calibration: áp dụng cap band điểm cho bài quá ngắn/tiếng Việt trên Tier 2 LLM nhưng không phạt 250 từ lên Short Email")
    void evaluateWriting_calibratesTier2LlmScoresByTaskFormat() {
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(false);
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "overallBand": 8.0,
                  "taskAchievement": {"score": 7.0, "addressedPoints": [], "missingPoints": []},
                  "grammarScore": 8.0,
                  "vocabularyScore": 8.0,
                  "coherenceScore": 8.0,
                  "estimatedCefr": "C1",
                  "correctedText": "",
                  "mistakes": [],
                  "suggestions": [],
                  "generalFeedback": "LLM score."
                }
                """);

        // 1. Very short Task 2 (< 50 words) must be calibrated down <= 3.5 even if LLM hallucinated 7.5
        JsonNode tooShortTask2 = service.evaluateWriting(
                "Some people think governments should spend more on public transport. Discuss.",
                "Public transport is good for people in cities.",
                null,
                "TASK_2");
        assertThat(tooShortTask2.path("overallBand").asDouble()).isLessThanOrEqualTo(3.5);
        assertThat(tooShortTask2.path("isPassed").asBoolean()).isFalse();

        // 2. Predominantly Vietnamese essay must be flagged off-topic & capped <= 4.0
        JsonNode viTask2 = service.evaluateWriting(
                "Technology impacts modern education.",
                ("Công nghệ giúp học sinh học tập hiệu quả và tìm kiếm tài liệu nhanh chóng hơn mỗi ngày. ").repeat(6),
                null,
                "TASK_2");
        assertThat(viTask2.path("isOffTopic").asBoolean()).isTrue();
        assertThat(viTask2.path("overallBand").asDouble()).isLessThanOrEqualTo(4.0);

        // 3. Valid 52-word Short Email (40-80 words) must NOT receive Task 2 short-essay penalty
        String validEmail52w = "Hi Linh, I'm excited to invite you to my birthday picnic at Thong Nhat Park this Sunday at 10 a.m. We'll play board games, share sandwiches, and listen to music near the lake. Let me know if you can bring your guitar! Best wishes, An";
        JsonNode emailRes = service.evaluateWriting(
                "Write a short email (40-80 words) inviting a friend.",
                validEmail52w,
                null,
                "WRITING_SHORT_EMAIL");
        assertThat(emailRes.path("writingTask").asText()).isEqualTo("PARAGRAPH");
        assertThat(emailRes.path("writingSubType").asText()).isEqualTo("PARAGRAPH_EMAIL");
        assertThat(emailRes.path("overallBand").asDouble()).isEqualTo(7.5);
        assertThat(emailRes.path("isPassed").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("evaluateWriting Task 2 conservative inference: bài luận chứa từ 'process' trong ngữ cảnh xã hội vẫn đi vào TASK_2 local model")
    void evaluateWriting_conservativeInferenceKeepsTask2SocialTopicsOnLocalTier1() throws Exception {
        JsonNode localResponse = objectMapper.readTree("""
                {
                  "wordCount": 260,
                  "overallBand": 6.5,
                  "grammarScore": 6.5,
                  "vocabularyScore": 6.5,
                  "coherenceScore": 6.5,
                  "estimatedCefr": "B2",
                  "evaluatedBy": "PYTHON_WRITING_SCORER"
                }
                """);
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(true);
        when(pythonIntegrationService.evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), eq("TASK_2")))
                .thenReturn(localResponse);

        JsonNode res = service.evaluateWriting(
                "Education is a lifelong process that benefits society.",
                "Full essay discussing education...",
                null);

        assertThat(res.path("writingTask").asText()).isEqualTo("TASK_2");
        assertThat(res.path("evaluatedBy").asText()).isEqualTo("PYTHON_WRITING_SCORER");
        verify(pythonIntegrationService).evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), eq("TASK_2"));
        verifyNoInteractions(groqClientService, geminiClientService);
    }

    @Test
    @DisplayName("evaluateSpeakingTopic STT Fallback: Groq trả ảo giác Whisper -> fallback Gemini STT với mime audio/wav và khóa text")
    void evaluateSpeakingTopic_groqReturnsHallucination_fallsBackToGeminiSttWithWavMimeAndTextField() {
        MockMultipartFile wavAudio = new MockMultipartFile("audio", "answer.WAV", "audio/wav", "wav-bytes".getBytes());

        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("Thank you.");
        when(geminiClientService.evaluateAudioWithInstruction(
                anyString(), any(byte[].class), eq("audio/wav"), anyString()))
                .thenReturn("```json\n{\"text\": \"I usually travel by train because it is comfortable and allows me to enjoy the scenic countryside.\"}\n```");
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 7.0, "addressedPoints": ["transport"], "missingPoints": []},
                  "overallBand": 7.0,
                  "pronunciationScore": 7.0,
                  "fluencyScore": 7.0,
                  "lexicalScore": 7.0,
                  "grammarScore": 7.0,
                  "coherenceScore": 7.0
                }
                """);

        JsonNode result = service.evaluateSpeakingTopic("How do you travel?", wavAudio, null, "PART_1", null);

        verify(geminiClientService).evaluateAudioWithInstruction(
                anyString(), any(byte[].class), eq("audio/wav"), anyString());
        assertThat(result.path("sttEngine").asText()).isEqualTo("GEMINI_AUDIO_STT");
        assertThat(result.path("speakingMode").asText()).isEqualTo("QA");
        assertThat(result.path("recognizedScript").asText()).contains("travel by train");
        assertThat(result.path("overallBand").asDouble()).isEqualTo(7.0);
    }

    @Test
    @DisplayName("evaluateSpeakingTopic Guardrail biên: chặn tiếng Việt >= 25% kèm lưu AiEvaluation; không chặn ở 20% hoặc đọc vẹt >= 25 từ")
    void evaluateSpeakingTopic_vietnameseRatioBoundary_blocksAt25PercentAndPersistsGuardrail() {
        UUID studentId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();
        Student student = Student.builder().id(studentId).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder().student(student).build();
        StudentAnswer answer = StudentAnswer.builder().id(answerId).attempt(attempt).build();

        when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
        when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());
        MockMultipartFile audio = new MockMultipartFile("audio", "voice.webm", "audio/webm", "bytes".getBytes());

        // Case 1: Đúng 25% tiếng Việt (1/4 từ có dấu) -> Chặn ở band 1.5, lưu AiEvaluation & cập nhật StudentAnswer
        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("I like học English");
        JsonNode viBlocked = service.evaluateSpeakingTopic("Do you like English?", audio, answerId, "QA", null);

        assertThat(viBlocked.path("overallBand").asDouble()).isEqualTo(1.5);
        assertThat(viBlocked.path("isOffTopic").asBoolean()).isTrue();
        assertThat(viBlocked.path("isPassed").asBoolean()).isFalse();
        assertThat(answer.getIsCorrect()).isFalse();
        assertThat(answer.getEarnedPoints()).isEqualTo(1.5);
        verify(groqClientService, never()).chatCompletionJson(anyString(), anyString());

        ArgumentCaptor<AiEvaluation> evalCaptor = ArgumentCaptor.forClass(AiEvaluation.class);
        verify(aiEvaluationRepository).save(evalCaptor.capture());
        assertThat(evalCaptor.getValue().getEvalType()).isEqualTo(AiEvaluationType.SPEAKING);
        assertThat(evalCaptor.getValue().getOverallScore()).isEqualTo(1.5);
        verify(analyticsService).updateSkillScore(studentId, "SPEAKING", 0.75);

        // Case 2: 20% tiếng Việt (1/5 từ có dấu) -> Vượt guardrail tiếng Việt, gọi tới LLM
        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("I practice English with bạn");
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 4.0},
                  "pronunciationScore": 4.0,
                  "fluencyScore": 4.0,
                  "lexicalScore": 4.0,
                  "grammarScore": 4.0,
                  "coherenceScore": 4.0
                }
                """);
        JsonNode twentyPercent = service.evaluateSpeakingTopic("How do you practice?", audio, null, "QA", null);
        assertThat(twentyPercent.path("overallBand").asDouble()).isEqualTo(3.0); // QA < 6 từ bị cap <= 3.0
        verify(groqClientService, times(1)).chatCompletionJson(anyString(), anyString());

        // Case 3: Đọc lặp từ trong đề nhưng >= 25 từ -> Không bị guardrail đọc vẹt (<25 từ) chặn trước LLM
        String prompt = "Describe a memorable trip you took with your family last summer and explain why you enjoyed spending time together";
        String longTranscript = prompt + " Describe a memorable trip you took with your family last summer";
        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn(longTranscript);
        service.evaluateSpeakingTopic(prompt, audio, null, "QA", null);
        verify(groqClientService, times(2)).chatCompletionJson(anyString(), anyString());
    }

    @Test
    @DisplayName("sanitizeTranscriptForPythonPhonetics: chuẩn hóa dấu nháy/gạch, gộp chữ lặp, lọc token rác & giới hạn 350 từ")
    void sanitizeTranscriptForPythonPhonetics_normalizesPunctuationRepeatsAndFiltersInvalidTokens() {
        assertThat(service.sanitizeTranscriptForPythonPhonetics(null)).isEmpty();
        assertThat(service.sanitizeTranscriptForPythonPhonetics("   ")).isEmpty();

        String messy = "It\u2019s \u2018co-op\u2019 / day-to-day! I am soooo happy, hmm... bcdfg astrngth supercalifragilisticexpialidocious";
        assertThat(service.sanitizeTranscriptForPythonPhonetics(messy))
                .isEqualTo("It's co op day to day I am soo happy hmm");

        String fourHundredWords = "word ".repeat(400);
        String capped = service.sanitizeTranscriptForPythonPhonetics(fourHundredWords);
        assertThat(capped.split("\\s+")).hasSize(350);
    }

    @Test
    @DisplayName("evaluateSpeakingTopic Phonetics Blend: trộn 75% Python + 25% LLM, 100% Python khi LLM=0 & chống trùng tối đa 5 lỗi")
    void evaluateSpeakingTopic_pythonPronunciationBlendingAndMistakeDeduplication() {
        MockMultipartFile audio = new MockMultipartFile("audio", "speech.webm", "audio/webm", "audio-data".getBytes());
        when(groqClientService.transcribeAudio(any(MultipartFile.class)))
                .thenReturn("I prefer studying in a quiet library because it keeps me focused all afternoon every single day.");

        // 1. Blend 75% Python (80 -> 7.2) + 25% LLM (5.0) = 6.65 -> round half band 6.5; dedupe "Library" & cap 5 weak words
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 7.0, "addressedPoints": ["place"], "missingPoints": []},
                  "pronunciationScore": 5.0,
                  "fluencyScore": 7.0,
                  "lexicalScore": 7.0,
                  "grammarScore": 7.0,
                  "coherenceScore": 7.0,
                  "mistakes": [
                    {"original": "Library", "correction": "quiet library", "type": "vocabulary", "explanation": "Lặp từ"}
                  ]
                }
                """);

        ShadowingEvaluationResponse pyBlended = ShadowingEvaluationResponse.builder()
                .overallScore(75)
                .kpi(ShadowingEvaluationResponse.KpiMetrics.builder()
                        .pronunciation(80)
                        .wordsPerMinute(118)
                        .build())
                .wordRows(List.of(
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder().word("always").score(0).build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder().word("library").score(20).build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                .word("focus").score(30)
                                .phonemes(List.of(ShadowingEvaluationResponse.PhonemeItem.builder()
                                        .ipa("/s/").score(40).note("mất âm cuối").build()))
                                .build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder().word("quiet").score(35).build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder().word("keeps").score(45).build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder().word("study").score(55).build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder().word("afternoon").score(65).build()
                ))
                .build();
        when(pythonIntegrationService.evaluatePhonetics(any(), eq("speech.webm"), anyString()))
                .thenReturn(pyBlended);

        JsonNode blendedResult = service.evaluateSpeakingTopic("Where do you study?", audio, null, "QA", null);
        assertThat(blendedResult.path("pronunciationScore").asDouble()).isEqualTo(6.5);
        assertThat(blendedResult.path("wordsPerMinute").asInt()).isEqualTo(118);
        // Top 5 weak words (<70 & >0): library(20), focus(30), quiet(35), keeps(45), study(55); library bị loại trùng -> 1 LLM + 4 Python = 5
        assertThat(blendedResult.path("mistakes")).hasSize(5);
        assertThat(blendedResult.path("mistakes").toString()).doesNotContain("\"afternoon\"");
        assertThat(blendedResult.path("mistakes").toString()).contains("focus", "mất âm cuối");

        // 2. LLM pronunciation = 0.0 & KPI null -> fallback sang overallScore=80 -> 100% Python = 7.0
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 7.0},
                  "pronunciationScore": 0.0,
                  "fluencyScore": 7.0,
                  "lexicalScore": 7.0,
                  "grammarScore": 7.0,
                  "coherenceScore": 7.0
                }
                """);
        ShadowingEvaluationResponse pyOverallOnly = ShadowingEvaluationResponse.builder()
                .overallScore(80)
                .kpi(null)
                .wordRows(List.of())
                .build();
        when(pythonIntegrationService.evaluatePhonetics(any(), eq("speech.webm"), anyString()))
                .thenReturn(pyOverallOnly);

        JsonNode purePythonResult = service.evaluateSpeakingTopic("Where do you study?", audio, null, "QA", null);
        assertThat(purePythonResult.path("pronunciationScore").asDouble()).isEqualTo(7.0);
    }

    @Test
    @DisplayName("evaluateSpeakingTopic Calibration Caps: áp dụng trần điểm đúng ngưỡng từ vựng/thiếu ý cho PART_1/QA, PART_2, PART_3 & isOffTopic")
    void evaluateSpeakingTopic_enforcesModeLengthCapsAndOffTopicCap() {
        MockMultipartFile audio = new MockMultipartFile("audio", "clip.webm", "audio/webm", "bytes".getBytes());
        String highRubricJson = """
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 8.0, "addressedPoints": ["main"], "missingPoints": []},
                  "pronunciationScore": 8.0,
                  "fluencyScore": 8.0,
                  "lexicalScore": 8.0,
                  "grammarScore": 8.0,
                  "coherenceScore": 8.0
                }
                """;
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn(highRubricJson);

        // QA / PART_1: < 6 từ -> cap <= 3.0; 6..11 từ -> cap <= 5.0
        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("Yes I enjoy sports."); // 4 words
        JsonNode qaTiny = service.evaluateSpeakingTopic("Do you like sports?", audio, null, "PART_1", null);
        assertThat(qaTiny.path("speakingMode").asText()).isEqualTo("QA");
        assertThat(qaTiny.path("overallBand").asDouble()).isLessThanOrEqualTo(3.0);
        assertThat(qaTiny.path("isPassed").asBoolean()).isFalse();

        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("Yes I play football every Sunday with friends."); // 8 words
        JsonNode qaShort = service.evaluateSpeakingTopic("Do you like sports?", audio, null, "QA", null);
        assertThat(qaShort.path("overallBand").asDouble()).isLessThanOrEqualTo(5.0);

        // PART_2: 25..49 từ -> <= 4.5; 50..79 từ -> <= 5.5; >= 80 từ nhưng missingPoints >= 2 -> overall <= 5.5 & task <= 5.0
        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("practice ".repeat(30).trim());
        assertThat(service.evaluateSpeakingTopic("Cue card", audio, null, "PART_2", null)
                .path("overallBand").asDouble()).isLessThanOrEqualTo(4.5);

        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("practice ".repeat(60).trim());
        assertThat(service.evaluateSpeakingTopic("Cue card", audio, null, "PART_2", null)
                .path("overallBand").asDouble()).isLessThanOrEqualTo(5.5);

        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("practice ".repeat(85).trim());
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 8.0, "addressedPoints": ["what"], "missingPoints": ["who", "feeling"]},
                  "pronunciationScore": 8.0,
                  "fluencyScore": 8.0,
                  "lexicalScore": 8.0,
                  "grammarScore": 8.0,
                  "coherenceScore": 8.0
                }
                """);
        JsonNode part2Missing = service.evaluateSpeakingTopic("Cue card", audio, null, "PART_2", null);
        assertThat(part2Missing.path("overallBand").asDouble()).isLessThanOrEqualTo(5.5);
        assertThat(part2Missing.path("taskAchievement").path("score").asDouble()).isLessThanOrEqualTo(5.0);

        // PART_3: < 15 từ -> <= 3.5; 15..29 từ -> <= 5.0
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn(highRubricJson);
        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("Technology helps education grow very quickly nowadays everywhere."); // 8 words
        assertThat(service.evaluateSpeakingTopic("Discuss technology", audio, null, "PART_3", null)
                .path("overallBand").asDouble()).isLessThanOrEqualTo(3.5);

        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("opinion ".repeat(20).trim());
        assertThat(service.evaluateSpeakingTopic("Discuss technology", audio, null, "PART_3", null)
                .path("overallBand").asDouble()).isLessThanOrEqualTo(5.0);

        // isOffTopic = true với bài dài -> overall <= 3.5, taskAchievement.score <= 3.0, isPassed = false
        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn("unrelated ".repeat(90).trim());
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": true,
                  "taskAchievement": {"score": 7.5, "addressedPoints": [], "missingPoints": []},
                  "pronunciationScore": 7.5,
                  "fluencyScore": 7.5,
                  "lexicalScore": 7.5,
                  "grammarScore": 7.5,
                  "coherenceScore": 7.5
                }
                """);
        JsonNode offTopic = service.evaluateSpeakingTopic("Cue card", audio, null, "PART_2", null);
        assertThat(offTopic.path("overallBand").asDouble()).isLessThanOrEqualTo(3.5);
        assertThat(offTopic.path("taskAchievement").path("score").asDouble()).isLessThanOrEqualTo(3.0);
        assertThat(offTopic.path("isPassed").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("evaluateSpeakingTopic LLM Fallback: chuyển Groq -> Gemini khi Groq lỗi; ném RuntimeException nếu cả hai cùng thất bại")
    void evaluateSpeakingTopic_llmFallbackGroqToGeminiAndBothFail() {
        MockMultipartFile audio = new MockMultipartFile("audio", "speech.webm", "audio/webm", "bytes".getBytes());
        when(groqClientService.transcribeAudio(any(MultipartFile.class)))
                .thenReturn("Reading books before sleeping improves focus and reduces stress after long classes.");

        when(groqClientService.chatCompletionJson(anyString(), anyString()))
                .thenThrow(new RuntimeException("Groq 503 Unavailable"));
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                .thenReturn("""
                        ```json
                        {
                          "isOffTopic": false,
                          "taskAchievement": {"score": 6.5},
                          "pronunciationScore": 6.5,
                          "fluencyScore": 6.5,
                          "lexicalScore": 6.5,
                          "grammarScore": 6.5,
                          "coherenceScore": 6.5,
                          "generalFeedback": "Gemini fallback ok"
                        }
                        ```
                        """);

        JsonNode fallbackResult = service.evaluateSpeakingTopic("Do you like reading?", audio, null, "QA", null);
        verify(geminiClientService).generateWithSystemInstruction(anyString(), anyString());
        assertThat(fallbackResult.path("overallBand").asDouble()).isEqualTo(6.5);
        assertThat(fallbackResult.path("isPassed").asBoolean()).isTrue();
        assertThat(fallbackResult.path("generalFeedback").asText()).isEqualTo("Gemini fallback ok");

        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                .thenThrow(new RuntimeException("Gemini 500"));
        assertThatThrownBy(() -> service.evaluateSpeakingTopic("Do you like reading?", audio, null, "QA", null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Đánh giá Speaking bằng Groq thất bại");
    }

    @Test
    @DisplayName("evaluateSpeakingTopic Persistence: tra cứu fallback theo Question ID, tạo mới và cập nhật AiEvaluation sẵn có")
    @SuppressWarnings("unchecked")
    void evaluateSpeakingTopic_persistsNewAndUpdatesExistingAiEvaluation() {
        UUID studentId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();
        Student student = Student.builder().id(studentId).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder().student(student).build();
        StudentAnswer answer = StudentAnswer.builder().id(answerId).attempt(attempt).build();

        MockMultipartFile audio = new MockMultipartFile("audio", "speech.webm", "audio/webm", "bytes".getBytes());
        String transcript = "I strongly believe public parks improve mental health for city residents every single day.";
        when(groqClientService.transcribeAudio(any(MultipartFile.class))).thenReturn(transcript);
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 6.5},
                  "pronunciationScore": 6.5,
                  "fluencyScore": 6.5,
                  "lexicalScore": 6.5,
                  "grammarScore": 6.5,
                  "coherenceScore": 6.5,
                  "estimatedCefr": "B2",
                  "correctedText": "Sample corrected",
                  "mistakes": [],
                  "suggestions": []
                }
                """);

        // 1. Truyền questionId thay vì studentAnswerId -> find() trả null -> JPQL tìm StudentAnswer IN_PROGRESS -> lưu mới AiEvaluation
        TypedQuery<StudentAnswer> typedQuery = mock(TypedQuery.class);
        when(entityManager.find(StudentAnswer.class, questionId)).thenReturn(null);
        when(entityManager.createQuery(anyString(), eq(StudentAnswer.class))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("qId"), eq(questionId))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("status"), eq(AttemptStatus.IN_PROGRESS))).thenReturn(typedQuery);
        when(typedQuery.getResultList()).thenReturn(List.of(answer));
        when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());

        service.evaluateSpeakingTopic("Benefits of parks", audio, questionId, "QA", null);

        ArgumentCaptor<AiEvaluation> createdCaptor = ArgumentCaptor.forClass(AiEvaluation.class);
        verify(aiEvaluationRepository).save(createdCaptor.capture());
        AiEvaluation created = createdCaptor.getValue();
        assertThat(created.getEvalType()).isEqualTo(AiEvaluationType.SPEAKING);
        assertThat(created.getOverallScore()).isEqualTo(6.5);
        assertThat(created.getPronunciationScore()).isEqualTo(6.5);
        assertThat(created.getFluencyScore()).isEqualTo(6.5);
        assertThat(created.getGrammarScore()).isEqualTo(6.5);
        assertThat(created.getVocabularyScore()).isEqualTo(6.5);
        assertThat(created.getCoherenceScore()).isEqualTo(6.5);
        assertThat(created.getEstimatedCefr()).isEqualTo("B2");
        assertThat(created.getSttTranscript()).isEqualTo(transcript);
        assertThat(created.getCorrectedText()).isEqualTo("Sample corrected");
        assertThat(answer.getEarnedPoints()).isEqualTo(6.5);
        assertThat(answer.getIsCorrect()).isTrue();
        assertThat(answer.getEvalFeedback()).contains("6.5");
        verify(entityManager).merge(answer);
        verify(analyticsService).updateSkillScore(studentId, "SPEAKING", 3.25);

        // 2. AiEvaluation đã tồn tại -> cập nhật lại đúng thực thể đó
        AiEvaluation existingEval = AiEvaluation.builder()
                .id(UUID.randomUUID())
                .studentAnswer(answer)
                .evalType(AiEvaluationType.SPEAKING)
                .build();
        when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
        when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.of(existingEval));

        service.evaluateSpeakingTopic("Benefits of parks", audio, answerId, "QA", null);

        verify(aiEvaluationRepository).save(same(existingEval));
        assertThat(existingEval.getOverallScore()).isEqualTo(6.5);
    }

    @Test
    @DisplayName("evaluateWriting Routing & Subtype: nhận diện đủ Map, Discursive, Discussion, Adv/Disadv, Problem/Solution, Two-Part, Descriptive, Cause/Effect & bỏ qua mediaUrl audio")
    void evaluateWriting_resolvesSubtypesAcrossTask1Task2ParagraphAndMediaUrl() {
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(true);
        when(pythonIntegrationService.evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(inv -> objectMapper.readTree("{\"overallBand\": 6.5}"));

        String sampleBody = "Academic writing response with sufficient details and clear examples.";

        JsonNode mapRes = service.evaluateWriting(
                "The two maps below illustrate the redevelopment of a coastal town.", sampleBody, null);
        assertThat(mapRes.path("writingTask").asText()).isEqualTo("TASK_1");
        assertThat(mapRes.path("writingSubType").asText()).isEqualTo("TASK1_MAP");

        JsonNode discursiveRes = service.evaluateWriting(
                "Modern urban planning policies", sampleBody, null, "WRITING_DISCURSIVE_ESSAY");
        assertThat(discursiveRes.path("writingTask").asText()).isEqualTo("TASK_2");
        assertThat(discursiveRes.path("writingSubType").asText()).isEqualTo("TASK2_DISCURSIVE_C1");
        verify(pythonIntegrationService).evaluateWriting(
                anyString(), anyString(), anyString(), anyString(), anyString(), eq("TASK2_DISCURSIVE_C1"));

        assertThat(service.evaluateWriting("Some people say taxes should rise. Discuss both views.", sampleBody, null)
                .path("writingSubType").asText()).isEqualTo("TASK2_DISCUSSION");

        assertThat(service.evaluateWriting("Do the advantages of remote work outweigh the disadvantages?", sampleBody, null)
                .path("writingSubType").asText()).isEqualTo("TASK2_ADV_DISADV");

        assertThat(service.evaluateWriting("What causes urban congestion and what solutions exist?", sampleBody, null)
                .path("writingSubType").asText()).isEqualTo("TASK2_PROBLEM_SOLUTION");

        assertThat(service.evaluateWriting("Many young adults delay marriage. Why does this happen? Is it positive?", sampleBody, null)
                .path("writingSubType").asText()).isEqualTo("TASK2_TWO_PART");

        JsonNode descPara = service.evaluateWriting("Write a paragraph describing your daily routine.", sampleBody, null);
        assertThat(descPara.path("writingTask").asText()).isEqualTo("PARAGRAPH");
        assertThat(descPara.path("writingSubType").asText()).isEqualTo("PARAGRAPH_DESCRIPTIVE");

        assertThat(service.evaluateWriting("Write a single paragraph on the cause and effect of stress.", sampleBody, null)
                .path("writingSubType").asText()).isEqualTo("PARAGRAPH_CAUSE_EFFECT");

        assertThat(service.evaluateWriting("Write a single paragraph on the problem of noise and one solution.", sampleBody, null)
                .path("writingSubType").asText()).isEqualTo("PARAGRAPH_PROBLEM_SOLUTION");

        // Audio .mp3 mediaUrl must NOT misclassify a Task 2 prompt as Task 1 visual chart
        UUID audioAnsId = UUID.randomUUID();
        AssignmentQuestion audioQ = AssignmentQuestion.builder()
                .promptText("Technology changes how people communicate.")
                .mediaUrl("https://cdn.example.com/audio/writing-prompt.mp3")
                .build();
        StudentAnswer audioAns = StudentAnswer.builder().id(audioAnsId).question(audioQ).build();
        when(entityManager.find(StudentAnswer.class, audioAnsId)).thenReturn(audioAns);
        when(aiEvaluationRepository.findByStudentAnswerId(audioAnsId)).thenReturn(Optional.empty());

        JsonNode audioMediaRes = service.evaluateWriting("Ignored", sampleBody, audioAnsId);
        assertThat(audioMediaRes.path("writingTask").asText()).isEqualTo("TASK_2");
        assertThat(audioMediaRes.path("writingSubType").asText()).isEqualTo("TASK2_OPINION");
    }

    @Test
    @DisplayName("evaluateWriting Calibration: làm tròn xuống 0.5 band (7.75->7.5, 6.25->6.0), tự tính CEFR, overallScore & correctedWordCount")
    void evaluateWriting_floorsOverallBandToHalfBandAndComputesDerivedFields() {
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(false);
        String essay256w = "Modern metropolitan transit networks reduce carbon emissions while supporting sustainable economic growth across densely populated cities. "
                .repeat(16);

        // Mean = (7 + 8 + 8 + 8) / 4 = 7.75 -> floorToHalfBand = 7.5
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "taskAchievement": {"score": 7.0},
                  "coherenceScore": 8.0,
                  "vocabularyScore": 8.0,
                  "grammarScore": 8.0,
                  "overallBand": 8.0,
                  "correctedText": "Improved academic sentence one. Improved academic sentence two.",
                  "mistakes": [],
                  "suggestions": []
                }
                """);

        JsonNode res75 = service.evaluateWriting("Public transport funding", essay256w, null, "TASK_2");
        assertThat(res75.path("overallBand").asDouble()).isEqualTo(7.5);
        assertThat(res75.path("overallScore").asInt()).isEqualTo(83);
        assertThat(res75.path("isPassed").asBoolean()).isTrue();
        assertThat(res75.path("estimatedCefr").asText()).isEqualTo("C1");
        assertThat(res75.path("correctedWordCount").asInt()).isEqualTo(8);

        // Mean = (6 + 6 + 7 + 6) / 4 = 6.25 -> floorToHalfBand = 6.0
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "taskAchievement": {"score": 6.0},
                  "coherenceScore": 6.0,
                  "vocabularyScore": 7.0,
                  "grammarScore": 6.0,
                  "overallBand": 6.5,
                  "correctedText": ""
                }
                """);

        JsonNode res60 = service.evaluateWriting("Public transport funding", essay256w, null, "TASK_2");
        assertThat(res60.path("overallBand").asDouble()).isEqualTo(6.0);
        assertThat(res60.path("overallScore").asInt()).isEqualTo(67);
        assertThat(res60.path("estimatedCefr").asText()).isEqualTo("B2");
    }

    @Test
    @DisplayName("evaluateWriting Trần điểm: áp dụng trần chép đề (<65 từ) và đủ ngưỡng thiếu từ của TASK_1, TASK_2 & PARAGRAPH")
    void evaluateWriting_enforcesParrotingAndWordCountCapsForTask1Task2AndParagraph() {
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(false);
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "isOffTopic": false,
                  "taskAchievement": {"score": 8.0},
                  "coherenceScore": 8.0,
                  "vocabularyScore": 8.0,
                  "grammarScore": 8.0,
                  "overallBand": 8.0
                }
                """);

        // 1. Parroting prompt with 50 distinct words -> drops from Task 2 <120 cap (4.5) down to off-topic cap (4.0 & TA <= 3.0)
        StringBuilder uniquePrompt = new StringBuilder();
        for (int i = 1; i <= 50; i++) {
            uniquePrompt.append("concept").append(i).append(' ');
        }
        String prompt50w = uniquePrompt.toString().trim();
        JsonNode parroted = service.evaluateWriting(prompt50w, prompt50w, null, "TASK_2");
        assertThat(parroted.path("isOffTopic").asBoolean()).isTrue();
        assertThat(parroted.path("overallBand").asDouble()).isLessThanOrEqualTo(4.0);
        assertThat(parroted.path("taskAchievement").path("score").asDouble()).isLessThanOrEqualTo(3.0);
        assertThat(parroted.path("isPassed").asBoolean()).isFalse();

        // 2. TASK_1 length caps: <40 -> <=3.5; 40..89 -> <=4.5; 90..134 -> <=5.5
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= 150; i++) {
            sb.append("chartword").append(i).append(' ');
        }
        String[] chartWords = sb.toString().trim().split(" ");

        JsonNode t1Severe = service.evaluateWriting("Bar chart data", String.join(" ", java.util.Arrays.copyOf(chartWords, 20)), null, "TASK_1");
        assertThat(t1Severe.path("overallBand").asDouble()).isLessThanOrEqualTo(3.5);
        assertThat(t1Severe.path("taskAchievement").path("score").asDouble()).isLessThanOrEqualTo(3.0);

        JsonNode t1Short = service.evaluateWriting("Bar chart data", String.join(" ", java.util.Arrays.copyOf(chartWords, 55)), null, "TASK_1");
        assertThat(t1Short.path("overallBand").asDouble()).isLessThanOrEqualTo(4.5);
        assertThat(t1Short.path("taskAchievement").path("score").asDouble()).isLessThanOrEqualTo(4.0);

        JsonNode t1Mid = service.evaluateWriting("Bar chart data", String.join(" ", java.util.Arrays.copyOf(chartWords, 105)), null, "TASK_1");
        assertThat(t1Mid.path("overallBand").asDouble()).isLessThanOrEqualTo(5.5);
        assertThat(t1Mid.path("taskAchievement").path("score").asDouble()).isLessThanOrEqualTo(5.0);

        // 3. TASK_2 intermediate caps: 50..119 -> <=4.5; 120..219 -> <=5.5
        JsonNode t2Short = service.evaluateWriting("Education funding", String.join(" ", java.util.Arrays.copyOf(chartWords, 70)), null, "TASK_2");
        assertThat(t2Short.path("overallBand").asDouble()).isLessThanOrEqualTo(4.5);
        assertThat(t2Short.path("taskAchievement").path("score").asDouble()).isLessThanOrEqualTo(4.0);

        JsonNode t2Mid = service.evaluateWriting("Education funding", String.join(" ", java.util.Arrays.copyOf(chartWords, 150)), null, "TASK_2");
        assertThat(t2Mid.path("overallBand").asDouble()).isLessThanOrEqualTo(5.5);
        assertThat(t2Mid.path("taskAchievement").path("score").asDouble()).isLessThanOrEqualTo(5.0);

        // 4. PARAGRAPH (min=100 -> severe<45, under<80): 30 words -> <=3.5; 55 words -> <=5.0
        JsonNode paraSevere = service.evaluateWriting("Opinion paragraph topic", String.join(" ", java.util.Arrays.copyOf(chartWords, 30)), null, "WRITING_OPINION");
        assertThat(paraSevere.path("overallBand").asDouble()).isLessThanOrEqualTo(3.5);

        JsonNode paraUnder = service.evaluateWriting("Opinion paragraph topic", String.join(" ", java.util.Arrays.copyOf(chartWords, 55)), null, "WRITING_OPINION");
        assertThat(paraUnder.path("overallBand").asDouble()).isLessThanOrEqualTo(5.0);
        assertThat(paraUnder.path("taskAchievement").path("score").asDouble()).isLessThanOrEqualTo(4.0);
    }

    @Test
    @DisplayName("evaluateWriting Hybrid Enrichment: gộp criteriaDetails/suggestedVocabulary/taskAchievement từ LLM mà vẫn giữ band local, và degrade an toàn khi LLM lỗi")
    void evaluateWriting_hybridEnrichmentMergesRichFieldsAndDegradesGracefullyOnLlmError() {
        ReflectionTestUtils.setField(service, "enrichLocalWritingWithLlm", true);
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(true);
        when(pythonIntegrationService.evaluateWriting(anyString(), anyString(), anyString(), anyString(), anyString(), eq("TASK_2")))
                .thenAnswer(inv -> objectMapper.readTree("""
                        {
                          "wordCount": 260,
                          "overallBand": 6.0,
                          "taskAchievement": {"score": 6.0, "addressedPoints": ["Local point"], "missingPoints": ["Local gap"]},
                          "grammarScore": 6.0,
                          "vocabularyScore": 6.0,
                          "coherenceScore": 6.0,
                          "evaluatedBy": "PYTHON_WRITING_SCORER"
                        }
                        """));

        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("""
                {
                  "overallBand": 8.5,
                  "taskAchievement": {"score": 8.5, "addressedPoints": ["Clear thesis", "Good examples"], "missingPoints": ["Counter-argument"]},
                  "correctedText": "Governments should fund renewable energy transition projects nationwide.",
                  "criteriaDetails": {"TR": {"band": 7}},
                  "suggestedVocabulary": [{"word": "mitigate", "ipa": "/ˈmɪt.ɪ.ɡeɪt/"}],
                  "mistakes": [{"original": "a", "correction": "the", "type": "grammar"}],
                  "suggestions": [{"area": "Lexis", "recommendation": "Use collocations"}],
                  "generalFeedback": "Enriched feedback"
                }
                """);

        JsonNode merged = service.evaluateWriting("Energy policy", "Essay text...", null, "TASK_2");
        assertThat(merged.path("evaluatedBy").asText()).isEqualTo("PYTHON_WRITING_SCORER_HYBRID");
        assertThat(merged.path("overallBand").asDouble()).isEqualTo(6.0);
        assertThat(merged.path("taskAchievement").path("score").asDouble()).isEqualTo(6.0);
        assertThat(merged.path("correctedWordCount").asInt()).isEqualTo(8);
        assertThat(merged.path("criteriaDetails").path("TR").path("band").asInt()).isEqualTo(7);
        assertThat(merged.path("suggestedVocabulary").get(0).path("word").asText()).isEqualTo("mitigate");
        assertThat(merged.path("taskAchievement").path("addressedPoints").toString()).contains("Clear thesis");
        assertThat(merged.path("taskAchievement").path("missingPoints").toString()).contains("Counter-argument");

        // Graceful degradation when both Groq and Gemini fail during enrichment
        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenThrow(new RuntimeException("Groq down"));
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                .thenThrow(new RuntimeException("Gemini down"));

        JsonNode degraded = service.evaluateWriting("Energy policy", "Essay text...", null, "TASK_2");
        assertThat(degraded.path("evaluatedBy").asText()).isEqualTo("PYTHON_WRITING_SCORER");
        assertThat(degraded.path("overallBand").asDouble()).isEqualTo(6.0);
    }

    @Test
    @DisplayName("evaluateWriting Persistence & Fallback: tra cứu fallback Question ID + Groq trả '{}' lùi về Gemini và lưu AiEvaluation")
    @SuppressWarnings("unchecked")
    void evaluateWriting_fallbackLookupByQuestionIdAndGroqBlankJsonFallsBackToGemini() {
        UUID studentId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();
        Student student = Student.builder().id(studentId).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder().student(student).build();
        AssignmentQuestion question = AssignmentQuestion.builder()
                .id(questionId)
                .promptText("Write an email to invite your friend to an English club (40-80 words).")
                .build();
        StudentAnswer answer = StudentAnswer.builder()
                .id(answerId)
                .attempt(attempt)
                .question(question)
                .build();

        TypedQuery<StudentAnswer> typedQuery = mock(TypedQuery.class);
        when(entityManager.find(StudentAnswer.class, questionId)).thenReturn(null);
        when(entityManager.createQuery(anyString(), eq(StudentAnswer.class))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("qId"), eq(questionId))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("status"), eq(AttemptStatus.IN_PROGRESS))).thenReturn(typedQuery);
        when(typedQuery.getResultList()).thenReturn(List.of(answer));
        when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());
        when(pythonIntegrationService.isWritingServiceEnabled()).thenReturn(false);

        when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn("{}");
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString())).thenReturn("""
                {
                  "taskAchievement": {"score": 6.0},
                  "grammarScore": 6.0,
                  "vocabularyScore": 6.0,
                  "coherenceScore": 6.0,
                  "estimatedCefr": "B2",
                  "correctedText": "Hi Lan, please join our English club this Saturday morning at nine."
                }
                """);

        String emailEssay = "Hi Lan, I am organizing a friendly English speaking club every Saturday morning at nine near the city library. "
                + "We will practice short dialogues, learn useful everyday vocabulary, and play fun quiz games together. "
                + "Please let me know if you can join us! Best wishes, Minh";
        JsonNode result = service.evaluateWriting("Ignored", emailEssay, questionId);

        assertThat(result.path("evaluatedBy").asText()).isEqualTo("GEMINI_WRITING_PARAGRAPH_LLM");
        assertThat(result.path("writingTask").asText()).isEqualTo("PARAGRAPH");
        assertThat(result.path("writingSubType").asText()).isEqualTo("PARAGRAPH_EMAIL");
        assertThat(answer.getTextResponse()).isEqualTo(emailEssay);
        assertThat(answer.getEarnedPoints()).isEqualTo(6.0);
        assertThat(answer.getIsCorrect()).isTrue();

        ArgumentCaptor<AiEvaluation> evalCaptor = ArgumentCaptor.forClass(AiEvaluation.class);
        verify(aiEvaluationRepository).save(evalCaptor.capture());
        assertThat(evalCaptor.getValue().getEvalType()).isEqualTo(AiEvaluationType.WRITING);
        assertThat(evalCaptor.getValue().getEvaluationEngine()).isEqualTo("GEMINI_WRITING_PARAGRAPH_LLM");
        assertThat(evalCaptor.getValue().getOverallScore()).isEqualTo(6.0);
        verify(entityManager).merge(answer);
        verify(analyticsService).updateSkillScore(studentId, "WRITING", 3.0);
    }

    @Test
    @DisplayName("publishExerciseToAssignment: giữ nguyên MULTIPLE_CHOICE có ô trống khi đủ options, ánh xạ object options, MATCHING, ESSAY, AUDIO_RESPONSE & bọc lỗi JSON")
    void publishExerciseToAssignment_preservesGapFillMultipleChoiceAndMapsVocabWritingSpeakingAndObjectOptions() {
        UUID classroomId = UUID.randomUUID();

        // 1. GRAMMAR_MULTIPLE_CHOICE có "______" nhưng đủ 4 options + object options {"A","B"} -> KHÔNG bị hạ xuống FILL_IN_BLANK
        UUID grammarExId = UUID.randomUUID();
        AiGeneratedExercise grammarEx = AiGeneratedExercise.builder()
                .id(grammarExId)
                .exerciseType("GRAMMAR_MULTIPLE_CHOICE")
                .targetCefr("B1")
                .questionCount(2)
                .rawResponseJson("""
                        {
                          "questions": [
                            {
                              "questionType": "MULTIPLE_CHOICE",
                              "prompt": "She ______ to Hanoi yesterday.",
                              "options": ["go", "went", "gone", "going"],
                              "correctAnswer": "went",
                              "explanation": "Quá khứ đơn"
                            },
                            {
                              "prompt": "Choose the verb",
                              "options": {"A": "go", "B": "went"},
                              "correctAnswer": "B"
                            }
                          ]
                        }
                        """)
                .build();
        when(aiGeneratedExerciseRepository.findById(grammarExId)).thenReturn(Optional.of(grammarEx));
        when(assignmentService.createAssignment(any(AssignmentRequest.class)))
                .thenAnswer(inv -> Assignment.builder().id(UUID.randomUUID()).title("Created").build());

        service.publishExerciseToAssignment(grammarExId, classroomId);

        ArgumentCaptor<AssignmentRequest> reqCaptor = ArgumentCaptor.forClass(AssignmentRequest.class);
        verify(assignmentService).createAssignment(reqCaptor.capture());
        AssignmentRequest grammarReq = reqCaptor.getValue();
        assertThat(grammarReq.getSkillType()).isEqualTo("GRAMMAR");
        assertThat(grammarReq.getQuestions()).hasSize(2);
        assertThat(grammarReq.getQuestions().get(0).getQuestionType()).isEqualTo("MULTIPLE_CHOICE");
        assertThat(grammarReq.getQuestions().get(0).getOptions()).hasSize(4);
        assertThat(grammarReq.getQuestions().get(1).getCorrectAnswer()).isEqualTo("went");
        assertThat(grammarReq.getQuestions().get(1).getOptions())
                .anySatisfy(opt -> {
                    assertThat(opt.getOptionText()).isEqualTo("went");
                    assertThat(opt.isCorrect()).isTrue();
                });

        // 2. VOCAB_MATCHING -> VOCABULARY + MATCHING với matchText & IPA explanation
        UUID vocabId = UUID.randomUUID();
        AiGeneratedExercise vocabEx = AiGeneratedExercise.builder()
                .id(vocabId)
                .exerciseType("VOCAB_MATCHING")
                .targetCefr("B2")
                .questionCount(1)
                .rawResponseJson("""
                        {
                          "questions": [
                            {
                              "questionType": "MATCHING",
                              "word": "resilient",
                              "ipa": "/rɪˈzɪl.jənt/",
                              "meaning": "kiên cường"
                            }
                          ]
                        }
                        """)
                .build();
        when(aiGeneratedExerciseRepository.findById(vocabId)).thenReturn(Optional.of(vocabEx));
        service.publishExerciseToAssignment(vocabId, classroomId);
        verify(assignmentService, times(2)).createAssignment(reqCaptor.capture());
        AssignmentRequest vocabReq = reqCaptor.getValue();
        assertThat(vocabReq.getSkillType()).isEqualTo("VOCABULARY");
        assertThat(vocabReq.getQuestions().get(0).getQuestionType()).isEqualTo("MATCHING");
        assertThat(vocabReq.getQuestions().get(0).getOptions().get(0).getMatchText()).isEqualTo("kiên cường");
        assertThat(vocabReq.getQuestions().get(0).getExplanation()).contains("/rɪˈzɪl.jənt/");

        // 3. WRITING_IELTS_TASK2 -> ESSAY & SPEAKING_PART_2 -> AUDIO_RESPONSE
        UUID writingId = UUID.randomUUID();
        AiGeneratedExercise writingEx = AiGeneratedExercise.builder()
                .id(writingId)
                .exerciseType("WRITING_IELTS_TASK2")
                .targetCefr("B2")
                .questionCount(1)
                .rawResponseJson("{\"questions\":[{\"prompt\":\"Discuss urban growth.\"}]}")
                .build();
        when(aiGeneratedExerciseRepository.findById(writingId)).thenReturn(Optional.of(writingEx));
        service.publishExerciseToAssignment(writingId, classroomId);
        verify(assignmentService, times(3)).createAssignment(reqCaptor.capture());
        assertThat(reqCaptor.getValue().getSkillType()).isEqualTo("WRITING");
        assertThat(reqCaptor.getValue().getQuestions().get(0).getQuestionType()).isEqualTo("ESSAY");

        UUID speakingId = UUID.randomUUID();
        AiGeneratedExercise speakingEx = AiGeneratedExercise.builder()
                .id(speakingId)
                .exerciseType("SPEAKING_PART_2")
                .targetCefr("B2")
                .questionCount(1)
                .rawResponseJson("{\"questions\":[{\"prompt\":\"Describe a hobby.\",\"audioUrl\":\"https://cdn.test/s.wav\"}]}")
                .build();
        when(aiGeneratedExerciseRepository.findById(speakingId)).thenReturn(Optional.of(speakingEx));
        service.publishExerciseToAssignment(speakingId, classroomId);
        verify(assignmentService, times(4)).createAssignment(reqCaptor.capture());
        assertThat(reqCaptor.getValue().getSkillType()).isEqualTo("SPEAKING");
        assertThat(reqCaptor.getValue().getQuestions().get(0).getQuestionType()).isEqualTo("AUDIO_RESPONSE");
        assertThat(reqCaptor.getValue().getQuestions().get(0).getMediaUrl()).isEqualTo("https://cdn.test/s.wav");

        // 4. JSON lỗi -> ném RuntimeException bọc thông điệp parse
        UUID brokenId = UUID.randomUUID();
        AiGeneratedExercise brokenEx = AiGeneratedExercise.builder()
                .id(brokenId)
                .exerciseType("GRAMMAR")
                .targetCefr("B1")
                .questionCount(1)
                .rawResponseJson("{not-json")
                .build();
        when(aiGeneratedExerciseRepository.findById(brokenId)).thenReturn(Optional.of(brokenEx));
        assertThatThrownBy(() -> service.publishExerciseToAssignment(brokenId, classroomId))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Lỗi parse JSON để tạo Assignment");
    }

    @Test
    @DisplayName("generateExamDraft: hỗ trợ custom title/instructions, kẹp count [3..20], bỏ qua section rỗng & tính điểm mặc định theo kỹ năng")
    void generateExamDraft_coversAllSkillsFormatNormalizationCountClampingDefaultPointsAndCustomTitle() {
        UUID teacherId = UUID.randomUUID();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(Teacher.builder().id(teacherId).build()));
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble(), eq(teacherId), eq(true)))
                .thenReturn("{\"questions\":[{\"prompt\":\"He go home.\",\"questionType\":\"FILL_IN_BLANK\",\"wrongWord\":\"go\",\"correctAnswer\":\"goes\"}]}")
                .thenReturn("{\"pairs\":[{\"word\":\"diligent\",\"ipa\":\"/ˈdɪl.ɪ.dʒənt/\",\"meaning\":\"chăm chỉ\"}]}")
                .thenReturn("{\"questions\":[{\"prompt\":\"Discuss remote work.\",\"questionType\":\"ESSAY\",\"correctAnswer\":\"Essay rubric\"}]}")
                .thenReturn("{\"questions\":[{\"prompt\":\"Describe a mentor.\",\"questionType\":\"AUDIO_RESPONSE\",\"correctAnswer\":\"Cue card rubric\"}]}");

        AiExamGenerateRequest req = AiExamGenerateRequest.builder()
                .title("  Final Exam 2026  ")
                .topic("Workplace & Skills")
                .targetCefr("c1")
                .customInstructions("Focus on academic register")
                .sections(java.util.Arrays.asList(
                        null,
                        AiExamGenerateRequest.SkillSectionSpec.builder().skillType("   ").questionCount(2).build(),
                        AiExamGenerateRequest.SkillSectionSpec.builder()
                                .skillType("GRAMMAR").questionFormat("ERROR").questionCount(25).pointsPerQuestion(null).build(),
                        AiExamGenerateRequest.SkillSectionSpec.builder()
                                .skillType("VOCABULARY").questionFormat("MATCHING").questionCount(0).pointsPerQuestion(1.5).build(),
                        AiExamGenerateRequest.SkillSectionSpec.builder()
                                .skillType("WRITING").questionFormat("TASK2").questionCount(1).pointsPerQuestion(null).build(),
                        AiExamGenerateRequest.SkillSectionSpec.builder()
                                .skillType("SPEAKING").questionFormat("PART2").questionCount(1).pointsPerQuestion(null).build()
                ))
                .build();

        AiExamDraftResponse draft = service.generateExamDraft(req, teacherId);

        assertThat(draft.getTitle()).isEqualTo("Final Exam 2026");
        assertThat(draft.getExamSkills()).containsExactly("GRAMMAR", "VOCABULARY", "WRITING", "SPEAKING");
        assertThat(draft.getListeningScript()).isNull();
        assertThat(draft.getQuestions()).hasSize(4);

        assertThat(draft.getQuestions().get(0).getQuestionType()).isEqualTo("FILL_IN_BLANK");
        assertThat(draft.getQuestions().get(0).getPoints()).isEqualTo(1.0);
        assertThat(draft.getQuestions().get(1).getQuestionType()).isEqualTo("MATCHING");
        assertThat(draft.getQuestions().get(1).getPoints()).isEqualTo(1.5);
        assertThat(draft.getQuestions().get(2).getQuestionType()).isEqualTo("ESSAY");
        assertThat(draft.getQuestions().get(2).getPoints()).isEqualTo(10.0);
        assertThat(draft.getQuestions().get(3).getQuestionType()).isEqualTo("AUDIO_RESPONSE");
        assertThat(draft.getQuestions().get(3).getPoints()).isEqualTo(10.0);

        ArgumentCaptor<AiGeneratedExercise> exCaptor = ArgumentCaptor.forClass(AiGeneratedExercise.class);
        verify(aiGeneratedExerciseRepository, times(8)).save(exCaptor.capture());
        assertThat(exCaptor.getAllValues().get(1).getQuestionCount()).isEqualTo(20);
        assertThat(exCaptor.getAllValues().get(1).getExerciseType()).isEqualTo("GRAMMAR_ERROR_CORRECTION");
        assertThat(exCaptor.getAllValues().get(3).getQuestionCount()).isEqualTo(3);
        assertThat(exCaptor.getAllValues().get(3).getExerciseType()).isEqualTo("VOCAB_MATCHING");

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(groqClientService, times(4))
                .chatCompletionJson(anyString(), promptCaptor.capture(), anyDouble(), eq(teacherId), eq(true));
        assertThat(promptCaptor.getAllValues().get(0)).contains("Focus on academic register");
    }

    @Test
    @DisplayName("evaluateReadingShortAnswer: bóc markdown code fence, an toàn với tham số null & bọc lỗi Groq")
    void evaluateReadingShortAnswer_stripsMarkdownHandlesNullInputsAndWrapsErrors() {
        when(groqClientService.chatCompletionJson(anyString(), anyString()))
                .thenReturn("""
                        ```json
                        {"isContentCorrect":false,"isGrammarCorrect":true,"scoreOutOf10":3.0,"contentFeedback":"Chưa đúng ý"}
                        ```
                        """)
                .thenThrow(new RuntimeException("Groq timeout"));

        JsonNode res = service.evaluateReadingShortAnswer(null, null, null, null);
        assertThat(res.path("isContentCorrect").asBoolean()).isFalse();
        assertThat(res.path("scoreOutOf10").asDouble()).isEqualTo(3.0);

        assertThatThrownBy(() -> service.evaluateReadingShortAnswer("Passage", "Q?", "Ans", "Exp"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Đánh giá Reading câu trả lời ngắn thất bại");
    }

    @Test
    @DisplayName("generateQuizFromContent: Groq HTTP 200 nhưng JSON thiếu questions/pairs -> tự động fallback sang Gemini")
    void generateQuizFromContent_fallsBackToGeminiWhenGroqReturnsUnusableJson() {
        java.util.UUID teacherId = java.util.UUID.randomUUID();
        org.mockito.Mockito.lenient()
                .when(aiGeneratedExerciseRepository.save(any()))
                .thenAnswer(inv -> inv.getArgument(0));

        String unusableGroq = "{\"note\":\"no questions generated\"}";
        String validGemini = "{\"questions\":[{\"id\":\"1\",\"question\":\"Fallback question?\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correctAnswer\":\"A\",\"explanation\":\"Ok\"}]}";

        org.mockito.Mockito.lenient()
                .when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble()))
                .thenReturn(unusableGroq);
        org.mockito.Mockito.lenient()
                .when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble(), any(), any()))
                .thenReturn(unusableGroq);

        org.mockito.Mockito.lenient()
                .when(geminiClientService.generateWithSystemInstruction(anyString(), anyString(), anyDouble()))
                .thenReturn(validGemini);
        org.mockito.Mockito.lenient()
                .when(geminiClientService.generateWithSystemInstruction(anyString(), anyString(), anyDouble(), any(), any()))
                .thenReturn(validGemini);

        com.englishlearning.ai.entity.AiGeneratedExercise result = service.generateQuizFromContent(
                "Renewable Energy", "B2", 1, teacherId, null, "GRAMMAR_MCQ", "GRAMMAR");

        assertThat(result.getRawResponseJson()).contains("Fallback question?");
    }

    @Test
    @DisplayName("extractAndNormalizeQuizJson: phục hồi JSON có text thừa, key alias 'exercises' và mảng bị cắt cụt")
    void extractAndNormalizeQuizJson_recoversWrapperAliasesAndTruncatedArrays() throws Exception {
        String withAliasAndProse = "Here is your quiz:\n```json\n{\"exercises\":[{\"id\":\"1\",\"question\":\"Q1\"}]}\n```\nHope this helps!";
        String normalizedAlias = service.extractAndNormalizeQuizJson(withAliasAndProse);
        assertThat(normalizedAlias).isNotNull();
        JsonNode aliasRoot = new ObjectMapper().readTree(normalizedAlias);
        assertThat(aliasRoot.path("questions").size()).isEqualTo(1);
        assertThat(aliasRoot.path("questions").get(0).path("question").asText()).isEqualTo("Q1");

        String truncated = "{\"readingPassage\":\"Climate passage.\",\"questions\":[{\"id\":\"1\",\"question\":\"Complete item\"},{\"id\":\"2\",\"question\":\"Cut off halfw";
        String salvaged = service.extractAndNormalizeQuizJson(truncated);
        assertThat(salvaged).isNotNull();
        JsonNode salvagedRoot = new ObjectMapper().readTree(salvaged);
        assertThat(salvagedRoot.path("readingPassage").asText()).isEqualTo("Climate passage.");
        assertThat(salvagedRoot.path("questions").size()).isEqualTo(1);
        assertThat(salvagedRoot.path("questions").get(0).path("question").asText()).isEqualTo("Complete item");

        assertThat(service.extractAndNormalizeQuizJson("{\"questions\":[]}")).isNull();
    }

    @Test
    @DisplayName("generateQuizFromContent: WRITING_DISCURSIVE_ESSAY count=5 dùng hướng dẫn súc tích để tránh timeout")
    void generateQuizFromContent_writingDiscursiveEssayCount5_usesConcisePromptAndSucceeds() {
        java.util.UUID teacherId = java.util.UUID.randomUUID();
        org.mockito.Mockito.lenient()
                .when(aiGeneratedExerciseRepository.save(any()))
                .thenAnswer(inv -> inv.getArgument(0));

        java.util.concurrent.atomic.AtomicReference<String> capturedUserPrompt = new java.util.concurrent.atomic.AtomicReference<>();
        String fivePromptsJson = "{\"questions\":["
                + "{\"id\":\"1\",\"prompt\":\"Discuss urban transport.\",\"correctAnswer\":\"Intro & stance\",\"explanation\":\"Topic + outline\"},"
                + "{\"id\":\"2\",\"prompt\":\"Discuss remote work.\",\"correctAnswer\":\"Intro & stance\",\"explanation\":\"Topic + outline\"},"
                + "{\"id\":\"3\",\"prompt\":\"Discuss AI regulation.\",\"correctAnswer\":\"Intro & stance\",\"explanation\":\"Topic + outline\"},"
                + "{\"id\":\"4\",\"prompt\":\"Discuss green tax.\",\"correctAnswer\":\"Intro & stance\",\"explanation\":\"Topic + outline\"},"
                + "{\"id\":\"5\",\"prompt\":\"Discuss aging population.\",\"correctAnswer\":\"Intro & stance\",\"explanation\":\"Topic + outline\"}"
                + "]}";

        org.mockito.Mockito.lenient()
                .when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble()))
                .thenAnswer(inv -> {
                    capturedUserPrompt.set(inv.getArgument(1));
                    return fivePromptsJson;
                });
        org.mockito.Mockito.lenient()
                .when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble(), any(), any()))
                .thenAnswer(inv -> {
                    capturedUserPrompt.set(inv.getArgument(1));
                    return fivePromptsJson;
                });

        com.englishlearning.ai.entity.AiGeneratedExercise result = service.generateQuizFromContent(
                "Technology and Society", "C1", 5, teacherId, null, "WRITING_DISCURSIVE_ESSAY", "WRITING");

        assertThat(result.getRawResponseJson()).contains("Discuss urban transport.");
        assertThat(capturedUserPrompt.get()).isNotNull();
        assertThat(capturedUserPrompt.get()).contains("5");
    }

    @Test
    @DisplayName("generateQuizFromContent: ResponseStatusException 429 được ném thẳng ra ngoài, không fallback sang Gemini")
    void generateQuizFromContent_propagates429ResponseStatusExceptionWithoutGeminiFallback() {
        java.util.UUID teacherId = java.util.UUID.randomUUID();
        org.springframework.web.server.ResponseStatusException rateLimitEx =
                new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
                        "Bạn đã vượt quá giới hạn tạo bài tập AI (tối đa 5 lần/phút). Vui lòng thử lại sau.");

        org.mockito.Mockito.lenient()
                .when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble()))
                .thenThrow(rateLimitEx);
        org.mockito.Mockito.lenient()
                .when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble(), any(), any()))
                .thenThrow(rateLimitEx);

        assertThatThrownBy(() -> service.generateQuizFromContent(
                "Topic", "B2", 3, teacherId, null, "GRAMMAR_MCQ", "GRAMMAR"))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("tối đa 5 lần/phút");

        org.mockito.Mockito.verifyNoInteractions(geminiClientService);
    }

    @Test
    @DisplayName("generateQuizFromContent: SPEAKING_SHADOWING ngắt mạch Kokoro TTS ngay sau lỗi đầu tiên")
    void generateQuizFromContent_speakingShadowingCircuitBreaksKokoroTtsOnFirstFailure() {
        java.util.UUID teacherId = java.util.UUID.randomUUID();
        org.mockito.Mockito.lenient()
                .when(aiGeneratedExerciseRepository.save(any()))
                .thenAnswer(inv -> inv.getArgument(0));

        String shadowingJson = "{\"questions\":["
                + "{\"id\":\"1\",\"prompt\":\"First sentence to shadow.\",\"correctAnswer\":\"First sentence to shadow.\"},"
                + "{\"id\":\"2\",\"prompt\":\"Second sentence to shadow.\",\"correctAnswer\":\"Second sentence to shadow.\"},"
                + "{\"id\":\"3\",\"prompt\":\"Third sentence to shadow.\",\"correctAnswer\":\"Third sentence to shadow.\"}"
                + "]}";

        org.mockito.Mockito.lenient()
                .when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble()))
                .thenReturn(shadowingJson);
        org.mockito.Mockito.lenient()
                .when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble(), any(), any()))
                .thenReturn(shadowingJson);

        org.mockito.Mockito.lenient()
                .when(exerciseAudioService.synthesizeRawScriptToUrl(anyString(), anyString(), anyDouble()))
                .thenThrow(new RuntimeException("Kokoro TTS unavailable"));

        com.englishlearning.ai.entity.AiGeneratedExercise result = service.generateQuizFromContent(
                "Travel", "B1", 3, teacherId, null, "SPEAKING_SHADOWING", "SPEAKING");

        assertThat(result.getRawResponseJson()).contains("First sentence to shadow.");
        org.mockito.Mockito.verify(exerciseAudioService, org.mockito.Mockito.times(1))
                .synthesizeRawScriptToUrl(anyString(), anyString(), anyDouble());
    }
}
