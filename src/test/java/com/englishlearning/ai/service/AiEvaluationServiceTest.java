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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
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

    @Test
    @DisplayName("Fallback Gemini sends real audio payload >= 44 bytes via multimodal API")
    void should_UseMultimodalAudioWithGemini_when_RealWavPayloadProvided() {
        byte[] wavHeaderPayload = new byte[64];
        wavHeaderPayload[0] = 'R';
        wavHeaderPayload[1] = 'I';
        wavHeaderPayload[2] = 'F';
        wavHeaderPayload[3] = 'F';

        when(pythonIntegrationService.evaluatePhonetics(any(), any(), any()))
                .thenThrow(new RuntimeException("Python offline"));
        when(geminiClientService.evaluateAudioWithInstruction(any(), eq(wavHeaderPayload), eq("audio/wav"), any()))
                .thenReturn("{\"overallScore\":78,\"isPassed\":false,\"passScore\":80,\"statusMessage\":\"OK\"}");

        ShadowingEvaluationResponse result = aiEvaluationService.evaluateSpeech(wavHeaderPayload, "speech.wav", sampleReference);

        assertThat(result).isNotNull();
        assertThat(result.getOverallScore()).isEqualTo(78);
        assertThat(result.getEvaluatedBy()).isEqualTo("GEMINI_AI_FALLBACK");
        verify(geminiClientService, times(1)).evaluateAudioWithInstruction(any(), eq(wavHeaderPayload), eq("audio/wav"), any());
        verify(geminiClientService, never()).generateWithSystemInstruction(any(), any());
        verifyNoInteractions(groqClientService);
    }

    @Test
    @DisplayName("Fallback Groq transcribes real audio via Whisper before JSON scoring")
    void should_TranscribeWithGroqWhisperBeforeScoring_when_GeminiFailsOnRealAudio() {
        byte[] webmPayload = new byte[64];
        webmPayload[0] = 0x1A;
        webmPayload[1] = 0x45;
        webmPayload[2] = (byte) 0xDF;
        webmPayload[3] = (byte) 0xA3;

        when(pythonIntegrationService.evaluatePhonetics(any(), any(), any()))
                .thenThrow(new RuntimeException("Python timeout"));
        when(geminiClientService.evaluateAudioWithInstruction(any(), any(), any(), any()))
                .thenThrow(new RuntimeException("Gemini unavailable"));
        when(groqClientService.transcribeAudioVerbose(eq(webmPayload), eq("rec.webm")))
                .thenReturn("{\"text\":\"Good morning\"}");
        when(groqClientService.chatCompletionJson(any(), argThat(p -> p != null && p.contains("Good morning"))))
                .thenReturn("{\"overallScore\":70,\"isPassed\":false,\"passScore\":80,\"statusMessage\":\"Missing word\"}");

        ShadowingEvaluationResponse result = aiEvaluationService.evaluateSpeech(webmPayload, "rec.webm", sampleReference);

        assertThat(result).isNotNull();
        assertThat(result.getOverallScore()).isEqualTo(70);
        assertThat(result.getEvaluatedBy()).isEqualTo("GROQ_AI_FALLBACK");
        verify(groqClientService, times(1)).transcribeAudioVerbose(eq(webmPayload), eq("rec.webm"));
        verify(groqClientService, times(1)).chatCompletionJson(any(), any());
    }

    @Test
    @DisplayName("Nhận diện đúng MIME type qua magic header (ID3, OggS, fLaC) và đuôi file (.m4a), chuẩn hóa câu mẫu rỗng")
    void should_DetectAudioMimeTypesAndDefaultBlankReferenceSentence() {
        when(pythonIntegrationService.evaluatePhonetics(any(), any(), any()))
                .thenThrow(new RuntimeException("Python down"));
        when(geminiClientService.evaluateAudioWithInstruction(any(), any(), anyString(), any()))
                .thenReturn("{\"overallScore\":85,\"isPassed\":true,\"passScore\":80}");

        byte[] id3Mp3 = new byte[48];
        id3Mp3[0] = 'I'; id3Mp3[1] = 'D'; id3Mp3[2] = '3';
        aiEvaluationService.evaluateSpeech(id3Mp3, "track.unknown", "Hello");
        verify(geminiClientService).evaluateAudioWithInstruction(any(), eq(id3Mp3), eq("audio/mp3"), any());

        byte[] ogg = new byte[48];
        ogg[0] = 'O'; ogg[1] = 'g'; ogg[2] = 'g'; ogg[3] = 'S';
        aiEvaluationService.evaluateSpeech(ogg, "voice.bin", "Hello");
        verify(geminiClientService).evaluateAudioWithInstruction(any(), eq(ogg), eq("audio/ogg"), any());

        byte[] flac = new byte[48];
        flac[0] = 'f'; flac[1] = 'L'; flac[2] = 'a'; flac[3] = 'C';
        aiEvaluationService.evaluateSpeech(flac, "raw.bin", "Hello");
        verify(geminiClientService).evaluateAudioWithInstruction(any(), eq(flac), eq("audio/flac"), any());

        byte[] m4a = new byte[48];
        aiEvaluationService.evaluateSpeech(m4a, "recording.M4A", "   ");
        verify(geminiClientService).evaluateAudioWithInstruction(
                any(), eq(m4a), eq("audio/mp4"), argThat(prompt -> prompt != null && prompt.contains("\"Hello world\"")));

        // Null audio bỏ qua Tầng 1 và gọi text fallback
        reset(pythonIntegrationService, geminiClientService);
        when(geminiClientService.generateWithSystemInstruction(any(), any()))
                .thenReturn("{\"overallScore\":80,\"isPassed\":true,\"passScore\":80}");
        ShadowingEvaluationResponse noAudio = aiEvaluationService.evaluateSpeech(null, null, null);
        assertThat(noAudio.getEvaluatedBy()).isEqualTo("GEMINI_AI_FALLBACK");
        verifyNoInteractions(pythonIntegrationService);
    }
}
