package com.englishlearning.ai.service;

import com.englishlearning.ai.service.impl.AiEvaluationServiceImpl;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AiEvaluationService - Kiến trúc Fallback 3 tầng & Chấm điểm phát âm")
class AiEvaluationServiceTest {

    @Mock
    private PythonIntegrationService pythonIntegrationService;

    @Mock
    private GeminiClientService geminiClientService;

    @Mock
    private GroqClientService groqClientService;

    private ObjectMapper objectMapper;
    private AiEvaluationServiceImpl aiEvaluationService;

    private final byte[] sampleAudio = new byte[]{1, 2, 3, 4, 5};
    private final String sampleReference = "Good morning everyone";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        aiEvaluationService = new AiEvaluationServiceImpl(
                pythonIntegrationService,
                geminiClientService,
                groqClientService,
                objectMapper
        );
    }

    @Test
    @DisplayName("Tầng 1: Trả về kết quả từ Python acoustic microservice khi dịch vụ hoạt động bình thường")
    void should_ReturnPythonAcousticScore_when_MicroserviceIsHealthy() {
        // Given
        ShadowingEvaluationResponse pythonResp = ShadowingEvaluationResponse.builder()
                .overallScore(92)
                .isPassed(true)
                .passScore(80)
                .evaluatedBy("PYTHON_ACOUSTIC_ENGINE")
                .build();

        when(pythonIntegrationService.evaluatePhonetics(eq(sampleAudio), eq("audio.wav"), eq(sampleReference)))
                .thenReturn(pythonResp);

        // When
        ShadowingEvaluationResponse result = aiEvaluationService.evaluateSpeech(sampleAudio, "audio.wav", sampleReference);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getOverallScore()).isEqualTo(92);
        assertThat(result.getEvaluatedBy()).isEqualTo("PYTHON_ACOUSTIC_ENGINE");
        verify(pythonIntegrationService, times(1)).evaluatePhonetics(eq(sampleAudio), eq("audio.wav"), eq(sampleReference));
        verifyNoInteractions(geminiClientService);
        verifyNoInteractions(groqClientService);
    }

    @Test
    @DisplayName("Tầng 2: Fallback sang Secondary Cloud AI (Gemini) khi Primary Realtime Streaming bị timeout")
    void should_FallbackToSecondaryCloudAi_when_PrimaryRealtimeStreamingTimesOut() {
        // Given: Tầng 1 gặp timeout
        when(pythonIntegrationService.evaluatePhonetics(eq(sampleAudio), eq("audio.wav"), eq(sampleReference)))
                .thenThrow(new RuntimeException("Python microservice connection timed out after 5000ms"));

        // Tầng 2: Gemini phản hồi thành công JSON
        String geminiJsonLiteral = """
                {
                  "overallScore": 82,
                  "isPassed": true,
                  "passScore": 80,
                  "statusMessage": "Phát âm tốt, đạt chuẩn ngữ điệu.",
                  "evaluatedBy": "GEMINI_AI_FALLBACK"
                }
                """;
        when(geminiClientService.generateWithSystemInstruction(any(), any()))
                .thenReturn(geminiJsonLiteral);

        // When
        ShadowingEvaluationResponse result = aiEvaluationService.evaluateSpeech(sampleAudio, "audio.wav", sampleReference);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getOverallScore()).isEqualTo(82);
        assertThat(result.getIsPassed()).isTrue();
        assertThat(result.getEvaluatedBy()).isEqualTo("GEMINI_AI_FALLBACK");

        verify(pythonIntegrationService, times(1)).evaluatePhonetics(eq(sampleAudio), eq("audio.wav"), eq(sampleReference));
        verify(geminiClientService, times(1)).generateWithSystemInstruction(any(), any());
        verifyNoInteractions(groqClientService);
    }

    @Test
    @DisplayName("Tầng 3: Fallback sang Offline Rule-Based Heuristics khi tất cả các dịch vụ External AI đều thất bại")
    void should_FallbackToRuleBasedOfflineGrading_when_AllExternalAiServicesFail() {
        // Given: Tầng 1 (Python) và Tầng 2 (Gemini, Groq) đều fail
        when(pythonIntegrationService.evaluatePhonetics(eq(sampleAudio), eq("audio.wav"), eq(sampleReference)))
                .thenThrow(new RuntimeException("Python microservice is unreachable"));
        when(geminiClientService.generateWithSystemInstruction(any(), any()))
                .thenThrow(new RuntimeException("Gemini API rate limit exceeded (HTTP 429)"));
        when(groqClientService.chatCompletionJson(any(), any()))
                .thenThrow(new RuntimeException("Groq API 503 Service Unavailable"));

        // When
        ShadowingEvaluationResponse result = aiEvaluationService.evaluateSpeech(sampleAudio, "audio.wav", sampleReference);

        // Then: Không ném Exception ra ngoài, trả về kết quả ngoại tuyến hợp lệ
        assertThat(result).isNotNull();
        assertThat(result.getEvaluatedBy()).isEqualTo("RULE_BASED_OFFLINE_FALLBACK");
        assertThat(result.getStatusMessage()).contains("Fallback ngoại tuyến");
        assertThat(result.getSentenceTokens()).isNotEmpty();
        assertThat(result.getWordRows()).isNotEmpty();
        assertThat(result.getKpi()).isNotNull();

        verify(pythonIntegrationService, times(1)).evaluatePhonetics(eq(sampleAudio), eq("audio.wav"), eq(sampleReference));
        verify(geminiClientService, times(1)).generateWithSystemInstruction(any(), any());
        verify(groqClientService, times(1)).chatCompletionJson(any(), any());
    }

    @Test
    @DisplayName("Ánh xạ đúng mã màu âm vị: Xanh (Đạt >= 80), Vàng (Cần sửa 60-79), Đỏ (Sai < 60)")
    void should_ColorCodePhonemesCorrectly_when_EvaluatingPronunciation() {
        // When & Then
        assertThat(aiEvaluationService.determinePhonemeColor(95)).isEqualTo("GREEN");
        assertThat(aiEvaluationService.determinePhonemeColor(80)).isEqualTo("GREEN");
        assertThat(aiEvaluationService.determinePhonemeColor(79)).isEqualTo("YELLOW");
        assertThat(aiEvaluationService.determinePhonemeColor(60)).isEqualTo("YELLOW");
        assertThat(aiEvaluationService.determinePhonemeColor(59)).isEqualTo("RED");
        assertThat(aiEvaluationService.determinePhonemeColor(0)).isEqualTo("RED");
    }

    @Test
    @DisplayName("Tính toán chính xác các chỉ số KPI: Fluency, Accuracy (Pronunciation), Completeness")
    void should_CalculateFluencyAccuracyAndCompletenessMetrics_accurately() {
        // Given: Câu tham chiếu có 4 từ, học sinh đọc 3 từ, bỏ lỡ 1 từ
        List<ShadowingEvaluationResponse.SentenceToken> tokens = List.of(
                ShadowingEvaluationResponse.SentenceToken.builder().word("Good").wordStatus("SPOKEN").color("GREEN").build(),
                ShadowingEvaluationResponse.SentenceToken.builder().word("morning").wordStatus("SPOKEN").color("GREEN").build(),
                ShadowingEvaluationResponse.SentenceToken.builder().word("teacher").wordStatus("SPOKEN").color("YELLOW").build(),
                ShadowingEvaluationResponse.SentenceToken.builder().word("today").wordStatus("MISSING").color("GRAY").build()
        );

        List<ShadowingEvaluationResponse.WordPhonemeDetail> wordRows = List.of(
                ShadowingEvaluationResponse.WordPhonemeDetail.builder().word("Good").score(90).wordStatus("SPOKEN").build(),
                ShadowingEvaluationResponse.WordPhonemeDetail.builder().word("morning").score(80).wordStatus("SPOKEN").build(),
                ShadowingEvaluationResponse.WordPhonemeDetail.builder().word("teacher").score(70).wordStatus("SPOKEN").build()
        );

        int totalReferenceWords = 4;
        int wordsPerMinute = 120;

        // When
        ShadowingEvaluationResponse.KpiMetrics metrics = aiEvaluationService.calculateMetrics(
                tokens, wordRows, totalReferenceWords, wordsPerMinute
        );

        // Then
        // Completeness: (3 spoken / 4 total) * 100 = 75%
        assertThat(metrics.getCompleteness()).isEqualTo(75);
        // Pronunciation: avg(90, 80, 70) = 80
        assertThat(metrics.getPronunciation()).isEqualTo(80);
        // Words per minute giữ nguyên
        assertThat(metrics.getWordsPerMinute()).isEqualTo(120);
        // Fluency và Prosody tính theo công thức xác định
        assertThat(metrics.getFluency()).isGreaterThan(0);
        assertThat(metrics.getProsody()).isGreaterThan(0);
    }
}
