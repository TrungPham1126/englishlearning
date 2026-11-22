package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.ai.service.impl.ShadowingServiceImpl;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.entity.StudentAnswer;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ShadowingServiceTest {

        @Mock
        private GroqClientService groqClientService;
        @Mock
        private GeminiClientService geminiClientService;
        @Mock
        private PythonIntegrationService pythonIntegrationService;
        @Mock
        private AiEvaluationRepository aiEvaluationRepository;
        @Mock
        private com.englishlearning.notification.service.NotificationService notificationService;
        @Mock
        private EntityManager entityManager;
        @Mock
        private AnalyticsService analyticsService;

        private ObjectMapper objectMapper;
        private ShadowingService shadowingService;

        @BeforeEach
        void setUp() {
                objectMapper = new ObjectMapper();
                shadowingService = new ShadowingServiceImpl(
                                groqClientService,
                                geminiClientService,
                                pythonIntegrationService,
                                aiEvaluationRepository,
                                notificationService,
                                entityManager,
                                objectMapper,
                                analyticsService);
        }

        @Test
        void testEvaluateShadowing_PythonSuccess_SetsPythonEngine() {
                MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav",
                                new byte[] { 1, 2, 3 });
                UUID answerId = UUID.randomUUID();
                StudentAnswer answer = new StudentAnswer();
                answer.setId(answerId);
                when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
                when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());

                ShadowingEvaluationResponse pythonResp = ShadowingEvaluationResponse.builder()
                                .overallScore(85)
                                .isPassed(true)
                                .build();
                when(pythonIntegrationService.evaluatePhonetics(any(), any(), any())).thenReturn(pythonResp);

                ShadowingEvaluationResponse result = shadowingService.evaluateShadowing(audio, answerId, "Hello world");

                Assertions.assertNotNull(result);
                Assertions.assertEquals("PYTHON_ACOUSTIC_ENGINE", result.getEvaluatedBy());

                ArgumentCaptor<AiEvaluation> captor = ArgumentCaptor.forClass(AiEvaluation.class);
                verify(aiEvaluationRepository).save(captor.capture());
                Assertions.assertEquals("PYTHON_ACOUSTIC_ENGINE", captor.getValue().getEvaluationEngine());
        }

        @Test
        void testEvaluateShadowing_PythonFails_GeminiSuccess_SetsGeminiEngine() {
                MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav",
                                new byte[] { 1, 2, 3 });
                UUID answerId = UUID.randomUUID();
                StudentAnswer answer = new StudentAnswer();
                answer.setId(answerId);
                when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
                when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());

                when(pythonIntegrationService.evaluatePhonetics(any(), any(), any()))
                                .thenThrow(new RuntimeException("Python service timeout"));

                String geminiJson = """
                                {
                                  "overallScore": 82,
                                  "isPassed": true,
                                  "passScore": 80,
                                  "statusMessage": "Gemini fallback feedback"
                                }
                                """;
                when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                                .thenReturn(geminiJson);

                ShadowingEvaluationResponse result = shadowingService.evaluateShadowing(audio, answerId, "Hello world");

                Assertions.assertNotNull(result);
                Assertions.assertEquals("GEMINI_AI_FALLBACK", result.getEvaluatedBy());

                ArgumentCaptor<AiEvaluation> captor = ArgumentCaptor.forClass(AiEvaluation.class);
                verify(aiEvaluationRepository).save(captor.capture());
                Assertions.assertEquals("GEMINI_AI_FALLBACK", captor.getValue().getEvaluationEngine());
        }

        @Test
        void testEvaluateShadowing_PythonFails_GeminiFails_GroqSuccess_SetsGroqEngine() {
                MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav",
                                new byte[] { 1, 2, 3 });
                UUID answerId = UUID.randomUUID();
                StudentAnswer answer = new StudentAnswer();
                answer.setId(answerId);
                when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
                when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());

                when(pythonIntegrationService.evaluatePhonetics(any(), any(), any()))
                                .thenThrow(new RuntimeException("Python service down"));
                when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                                .thenThrow(new RuntimeException("Gemini quota exceeded"));

                String groqJson = """
                                {
                                  "overallScore": 79,
                                  "isPassed": false,
                                  "passScore": 80,
                                  "statusMessage": "Groq fallback feedback"
                                }
                                """;
                when(groqClientService.chatCompletionJson(anyString(), anyString())).thenReturn(groqJson);

                ShadowingEvaluationResponse result = shadowingService.evaluateShadowing(audio, answerId, "Hello world");

                Assertions.assertNotNull(result);
                Assertions.assertEquals("GROQ_AI_FALLBACK", result.getEvaluatedBy());

                ArgumentCaptor<AiEvaluation> captor = ArgumentCaptor.forClass(AiEvaluation.class);
                verify(aiEvaluationRepository).save(captor.capture());
                Assertions.assertEquals("GROQ_AI_FALLBACK", captor.getValue().getEvaluationEngine());
        }

        @Test
        void testEvaluateShadowing_BlankSentenceThrowsBadRequest() {
                Assertions.assertThrows(com.englishlearning.common.exception.BadRequestException.class,
                                () -> shadowingService.evaluateShadowing(null, null, "   "));
        }

        @Test
        void testEvaluateShadowing_UpdatesExistingEvaluationAndAnalytics_andFallsBackWhenCleanedSentenceBlank() {
                MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav",
                                new byte[] { 1, 2, 3 });
                UUID studentId = UUID.randomUUID();
                UUID answerId = UUID.randomUUID();
                com.englishlearning.auth.entity.Student student = com.englishlearning.auth.entity.Student.builder()
                                .id(studentId).build();
                com.englishlearning.submission.entity.AssignmentAttempt attempt =
                                com.englishlearning.submission.entity.AssignmentAttempt.builder().student(student).build();
                StudentAnswer answer = new StudentAnswer();
                answer.setId(answerId);
                answer.setAttempt(attempt);

                AiEvaluation existingEval = AiEvaluation.builder().studentAnswer(answer).build();
                when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
                when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.of(existingEval));
                when(pythonIntegrationService.evaluatePhonetics(any(), any(), eq("Hello")))
                                .thenReturn(ShadowingEvaluationResponse.builder().overallScore(90).isPassed(true).build());

                // Câu không rỗng nhưng chỉ gồm dấu ngoặc/khoảng trắng -> cleanShadowingSentence rỗng -> fallback "Hello"
                ShadowingEvaluationResponse res = shadowingService.evaluateShadowing(
                                audio, answerId, "\"    \"");

                Assertions.assertEquals(90, res.getOverallScore());
                verify(aiEvaluationRepository).save(existingEval);
                verify(entityManager).merge(answer);
                verify(analyticsService).updateSkillScore(studentId, "SPEAKING", 0.9);
        }

        @Test
        void testEvaluateShadowing_AllThreeEnginesFail_ThrowsRuntimeException() {
                MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav",
                                new byte[] { 1, 2, 3 });
                when(pythonIntegrationService.evaluatePhonetics(any(), any(), any()))
                                .thenThrow(new RuntimeException("Python down"));
                when(groqClientService.transcribeAudioVerbose(any(), any())).thenReturn("{\"text\":\"hi\"}");
                when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                                .thenThrow(new RuntimeException("Gemini down"));
                when(groqClientService.chatCompletionJson(anyString(), anyString()))
                                .thenThrow(new RuntimeException("Groq down"));

                RuntimeException thrown = Assertions.assertThrows(RuntimeException.class,
                                () -> shadowingService.evaluateShadowing(audio, null, "Hi there"));
                Assertions.assertTrue(thrown.getMessage().contains("Chấm bài Shadowing thất bại"));
        }

        @Test
        @SuppressWarnings("unchecked")
        void testEvaluateShadowing_StudentAnswerNotFoundById_FallsBackToQuestionIdAndExtractsPrompt() {
                UUID questionId = UUID.randomUUID();
                UUID answerId = UUID.randomUUID();
                AssignmentQuestion question = AssignmentQuestion.builder()
                                .id(questionId)
                                .promptText("Read aloud: Practice makes perfect.")
                                .build();
                StudentAnswer answer = new StudentAnswer();
                answer.setId(answerId);
                answer.setQuestion(question);

                TypedQuery<StudentAnswer> query = mock(TypedQuery.class);
                when(entityManager.find(StudentAnswer.class, questionId)).thenReturn(null);
                when(entityManager.createQuery(anyString(), eq(StudentAnswer.class))).thenReturn(query);
                when(query.setParameter(eq("qId"), eq(questionId))).thenReturn(query);
                when(query.setParameter(eq("status"), eq(AttemptStatus.IN_PROGRESS))).thenReturn(query);
                when(query.getResultList()).thenReturn(List.of(answer));
                when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());

                MockMultipartFile audio = new MockMultipartFile("audio", "test.wav", "audio/wav",
                                new byte[] { 1, 2, 3 });
                when(pythonIntegrationService.evaluatePhonetics(any(), any(), eq("Practice makes perfect.")))
                                .thenReturn(ShadowingEvaluationResponse.builder().overallScore(80).isPassed(true).build());

                ShadowingEvaluationResponse res = shadowingService.evaluateShadowing(audio, questionId, null);

                Assertions.assertEquals(80, res.getOverallScore());
                Assertions.assertEquals(8.0, answer.getEarnedPoints());
                verify(pythonIntegrationService).evaluatePhonetics(any(), eq("test.wav"), eq("Practice makes perfect."));
                verify(aiEvaluationRepository).save(any(AiEvaluation.class));
        }

        @Test
        void testEvaluateShadowing_PythonReturnsNullOverallScore_TriggersWhisperAndGeminiFallback() {
                UUID answerId = UUID.randomUUID();
                StudentAnswer answer = new StudentAnswer();
                answer.setId(answerId);
                when(entityManager.find(StudentAnswer.class, answerId)).thenReturn(answer);
                when(aiEvaluationRepository.findByStudentAnswerId(answerId)).thenReturn(Optional.empty());

                when(pythonIntegrationService.evaluatePhonetics(any(), any(), any()))
                                .thenReturn(ShadowingEvaluationResponse.builder().overallScore(null).build());
                when(groqClientService.transcribeAudioVerbose(any(), any()))
                                .thenThrow(new RuntimeException("Verbose unsupported"));
                when(groqClientService.transcribeAudio(any(byte[].class), anyString()))
                                .thenReturn("Hello world");
                when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                                .thenReturn("{\"overallScore\":86,\"isPassed\":true,\"passScore\":80}");

                MockMultipartFile audio = new MockMultipartFile("audio", "voice.wav", "audio/wav",
                                new byte[] { 1, 2, 3 });
                ShadowingEvaluationResponse res = shadowingService.evaluateShadowing(audio, answerId, "Hello world");

                Assertions.assertEquals("GEMINI_AI_FALLBACK", res.getEvaluatedBy());
                verify(geminiClientService).generateWithSystemInstruction(anyString(),
                                argThat(p -> p != null && p.contains("Hello world")));

                ArgumentCaptor<AiEvaluation> captor = ArgumentCaptor.forClass(AiEvaluation.class);
                verify(aiEvaluationRepository).save(captor.capture());
                Assertions.assertEquals("Hello world", captor.getValue().getSttTranscript());
                Assertions.assertEquals("GEMINI_AI_FALLBACK", captor.getValue().getEvaluationEngine());
        }

        @Test
        void testEvaluateShadowing_NullAudioAndNoUrl_SkipsPythonAndCallsAiWithSilenceMarker() {
                when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                                .thenReturn("{\"overallScore\":0,\"isPassed\":false,\"passScore\":80}");

                ShadowingEvaluationResponse res = shadowingService.evaluateShadowing(null, null, "Good morning");

                Assertions.assertEquals(0, res.getOverallScore());
                Assertions.assertEquals("GEMINI_AI_FALLBACK", res.getEvaluatedBy());
                verifyNoInteractions(pythonIntegrationService);
                verifyNoInteractions(groqClientService);
                verify(geminiClientService).generateWithSystemInstruction(anyString(),
                                argThat(p -> p != null && p.contains("[SILENCE / NO SPEECH DETECTED]")));
        }
}
