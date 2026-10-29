package com.englishlearning.ai.service;

import com.englishlearning.ai.service.impl.ShadowingPracticeServiceImpl;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.submission.entity.StudentAnswer;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ShadowingPracticeService - Nghiệp vụ điều phối bài tập Shadowing & Lưu trữ kết quả")
class ShadowingPracticeServiceTest {

    @Mock
    private AiEvaluationService aiEvaluationService;

    @Mock
    private AiEvaluationRepository aiEvaluationRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private AnalyticsService analyticsService;

    private ObjectMapper objectMapper;
    private ShadowingPracticeServiceImpl shadowingPracticeService;

    private final UUID sampleAnswerId = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private final byte[] sampleAudio = new byte[]{1, 2, 3, 4};
    private final String sampleReference = "Consistent practice leads to fluency";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        shadowingPracticeService = new ShadowingPracticeServiceImpl(
                aiEvaluationService,
                aiEvaluationRepository,
                entityManager,
                analyticsService,
                objectMapper
        );
    }

    @Test
    @DisplayName("Đánh giá bài nói và lưu AiEvaluation + cập nhật điểm StudentAnswer khi nộp bài")
    void should_EvaluateAndPersistResult_when_StudentSubmitsShadowing() {
        // Given
        StudentAnswer studentAnswer = new StudentAnswer();
        studentAnswer.setId(sampleAnswerId);

        when(entityManager.find(StudentAnswer.class, sampleAnswerId)).thenReturn(studentAnswer);
        when(aiEvaluationRepository.findByStudentAnswerId(sampleAnswerId)).thenReturn(Optional.empty());

        ShadowingEvaluationResponse response = ShadowingEvaluationResponse.builder()
                .overallScore(85)
                .isPassed(true)
                .passScore(80)
                .evaluatedBy("PYTHON_ACOUSTIC_ENGINE")
                .kpi(ShadowingEvaluationResponse.KpiMetrics.builder()
                        .pronunciation(85)
                        .fluency(88)
                        .completeness(90)
                        .build())
                .build();

        when(aiEvaluationService.evaluateSpeech(eq(sampleAudio), eq("student_audio.wav"), eq(sampleReference)))
                .thenReturn(response);

        // When
        ShadowingEvaluationResponse result = shadowingPracticeService.practiceShadowing(
                sampleAnswerId,
                sampleAudio,
                "student_audio.wav",
                sampleReference
        );

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getOverallScore()).isEqualTo(85);
        assertThat(result.getIsPassed()).isTrue();

        // Verify lưu AiEvaluation vào database
        ArgumentCaptor<AiEvaluation> evalCaptor = ArgumentCaptor.forClass(AiEvaluation.class);
        verify(aiEvaluationRepository, times(1)).save(evalCaptor.capture());
        AiEvaluation savedEval = evalCaptor.getValue();
        assertThat(savedEval.getOverallScore()).isEqualTo(8.5);
        assertThat(savedEval.getEvaluationEngine()).isEqualTo("PYTHON_ACOUSTIC_ENGINE");

        // Verify cập nhật StudentAnswer
        verify(entityManager, times(1)).merge(studentAnswer);
        assertThat(studentAnswer.getEarnedPoints()).isEqualTo(8.5);
        assertThat(studentAnswer.getIsCorrect()).isTrue();
    }

    @Test
    @DisplayName("Ủy quyền chấm điểm audio chunk thời gian thực tới AiEvaluationService")
    void should_DelegateToAiEvaluationService_when_ProcessingAudioChunk() {
        // Given
        String sessionId = "ws-client-99";
        byte[] audioChunk = new byte[]{10, 20, 30};
        String expectedFilename = "chunk_ws-client-99.wav";

        ShadowingEvaluationResponse chunkResp = ShadowingEvaluationResponse.builder()
                .overallScore(78)
                .evaluatedBy("PYTHON_ACOUSTIC_ENGINE")
                .build();

        when(aiEvaluationService.evaluateSpeech(eq(audioChunk), eq(expectedFilename), eq(sampleReference)))
                .thenReturn(chunkResp);

        // When
        ShadowingEvaluationResponse result = shadowingPracticeService.processAudioChunk(
                sessionId,
                audioChunk,
                sampleReference
        );

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getOverallScore()).isEqualTo(78);
        verify(aiEvaluationService, times(1))
                .evaluateSpeech(eq(audioChunk), eq(expectedFilename), eq(sampleReference));
        verifyNoInteractions(aiEvaluationRepository);
    }

    @Test
    @DisplayName("Chấm điểm ở chế độ tự do (Free Lab) không ném lỗi khi studentAnswerId là null")
    void should_EvaluateWithoutPersistence_when_StudentAnswerIdIsNull() {
        // Given
        ShadowingEvaluationResponse response = ShadowingEvaluationResponse.builder()
                .overallScore(80)
                .isPassed(true)
                .evaluatedBy("GEMINI_AI_FALLBACK")
                .build();

        when(aiEvaluationService.evaluateSpeech(eq(sampleAudio), eq("audio.wav"), eq(sampleReference)))
                .thenReturn(response);

        // When
        ShadowingEvaluationResponse result = shadowingPracticeService.practiceShadowing(
                null,
                sampleAudio,
                "audio.wav",
                sampleReference
        );

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getOverallScore()).isEqualTo(80);
        verifyNoInteractions(entityManager);
        verifyNoInteractions(aiEvaluationRepository);
    }
}
