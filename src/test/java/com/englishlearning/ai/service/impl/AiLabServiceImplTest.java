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
import com.englishlearning.ai.service.GroqClientService;
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
import com.englishlearning.submission.entity.StudentAnswer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
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
                dictionaryLookupService
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
                .thenReturn("I really enjoyed reading Atomic Habits last year.");
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

        JsonNode result = service.evaluateWriting("Technology in life", "Technology have change our life.", answerId);

        assertThat(result.path("estimatedCefr").asText()).isEqualTo("B1");
        assertThat(answer.getIsCorrect()).isFalse();
        assertThat(answer.getEarnedPoints()).isEqualTo(4.5);
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
        assertThat(draft.getQuestions().get(0).getOptions()).hasSize(2);
        assertThat(draft.getQuestions().get(1).getTranscript()).isEqualTo("A: Hi! B: Hello!");
        assertThat(draft.getQuestions().get(1).getPoints()).isEqualTo(2.0);
    }
}
