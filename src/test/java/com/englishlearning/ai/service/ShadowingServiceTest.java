package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.ai.service.impl.ShadowingServiceImpl;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.submission.entity.StudentAnswer;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

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
}
