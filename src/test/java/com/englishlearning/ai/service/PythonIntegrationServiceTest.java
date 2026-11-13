package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.service.impl.PythonIntegrationServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@DisplayName("PythonIntegrationServiceImpl - Giao tiếp HTTP Multipart & Mapping kết quả Acoustic")
class PythonIntegrationServiceTest {

    private static final String ENDPOINT = "http://localhost:8000/api/v1/audio/evaluate-phonetics";

    private ObjectMapper objectMapper;
    private PythonIntegrationServiceImpl pythonIntegrationService;
    private MockRestServiceServer mockServer;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        pythonIntegrationService = new PythonIntegrationServiceImpl(objectMapper, ENDPOINT, 5000, 60000);
        RestTemplate restTemplate = Objects.requireNonNull(
                (RestTemplate) ReflectionTestUtils.getField(pythonIntegrationService, "restTemplate"));
        mockServer = MockRestServiceServer.createServer(restTemplate);
    }

    @Test
    @DisplayName("Ném IllegalArgumentException khi audio bytes rỗng hoặc null")
    void evaluatePhonetics_throwsWhenAudioMissing() {
        assertThatThrownBy(() -> pythonIntegrationService.evaluatePhonetics(null, "a.wav", "Hello"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> pythonIntegrationService.evaluatePhonetics(new byte[0], "a.wav", "Hello"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Parse JSON chuẩn snake_case từ Python acoustic service và ánh xạ đủ KPI, wordRows, sentenceTokens")
    void evaluatePhonetics_mapsPythonSnakeCaseResponseAccurately() {
        String pythonJson = """
                {
                  "overall_score": 84.6,
                  "pronunciation_score": 86,
                  "fluency_score": 82,
                  "speed_score": 90,
                  "articulation_rate": 3.0,
                  "words": [
                    {
                      "word": "Technology",
                      "score": 88,
                      "phonemes": [
                        {"symbol": "t", "score": 92, "feedback": "Phát âm rõ nét"}
                      ]
                    },
                    {
                      "word": "helps",
                      "score": 65,
                      "phonemes": [
                        {"ipa": "ɛ", "score": 62}
                      ]
                    }
                  ]
                }
                """;

        mockServer.expect(requestTo(ENDPOINT))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(pythonJson, MediaType.APPLICATION_JSON));

        ShadowingEvaluationResponse res = pythonIntegrationService.evaluatePhonetics(
                new byte[]{1, 2, 3, 4}, null, "Technology helps");

        mockServer.verify();
        assertThat(res.getOverallScore()).isEqualTo(85);
        assertThat(res.getPassScore()).isEqualTo(80);
        assertThat(res.getIsPassed()).isTrue();
        assertThat(res.getStatusMessage()).contains("xuất sắc");
        assertThat(res.getKpi().getPronunciation()).isEqualTo(86);
        assertThat(res.getKpi().getFluency()).isEqualTo(82);
        assertThat(res.getKpi().getWordsPerMinute()).isEqualTo(120);
        assertThat(res.getWordRows()).hasSize(2);
        assertThat(res.getSentenceTokens()).hasSize(2);
        assertThat(res.getSentenceTokens().get(0).getColor()).isEqualTo("GREEN");
        assertThat(res.getSentenceTokens().get(1).getColor()).isEqualTo("YELLOW");
    }

    @Test
    @DisplayName("Trả về low-confidence response khi Python service báo lỗi 422 kèm detail.message & detail.suggestion")
    void evaluatePhonetics_returnsLowConfidenceResponseOnStructured422Error() {
        String errorJson = """
                {
                  "detail": {
                    "message": "Âm lượng quá nhỏ.",
                    "suggestion": "Hãy nói gần micro hơn."
                  }
                }
                """;

        mockServer.expect(requestTo(ENDPOINT))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(errorJson));

        ShadowingEvaluationResponse res = pythonIntegrationService.evaluatePhonetics(
                new byte[]{9, 8, 7}, "voice.webm", "Good morning");

        mockServer.verify();
        assertThat(res.getOverallScore()).isZero();
        assertThat(res.getIsPassed()).isFalse();
        assertThat(res.getEvaluatedBy()).isEqualTo("PYTHON_ACOUSTIC_ENGINE");
        assertThat(res.getStatusMessage()).contains("Âm lượng quá nhỏ.").contains("Hãy nói gần micro hơn.");
        assertThat(res.getSentenceTokens()).hasSize(2)
                .allMatch(t -> "MISSING".equals(t.getWordStatus()) && "GRAY".equals(t.getColor()));
    }

    @Test
    @DisplayName("Ném RuntimeException khi Python service trả về 500 không phải JSON hợp lệ")
    void evaluatePhonetics_throwsRuntimeExceptionOnNonJsonServerError() {
        mockServer.expect(requestTo(ENDPOINT))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).body("Internal Server Crash"));

        assertThatThrownBy(() -> pythonIntegrationService.evaluatePhonetics(
                new byte[]{1, 2}, "a.wav", "Hello"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Python phonetic service");
        mockServer.verify();
    }

    @Test
    @DisplayName("mapToShadowingEvaluationResponse ánh xạ trực tiếp DTO camelCase và mã màu RED cho điểm thấp")
    void mapToShadowingEvaluationResponse_handlesCamelCaseAndLowScores() throws Exception {
        JsonNode node = objectMapper.readTree("""
                {
                  "overallScore": 52,
                  "passScore": 80,
                  "words": [
                    {"word": "through", "score": 45, "phonemes": []}
                  ]
                }
                """);

        ShadowingEvaluationResponse res = pythonIntegrationService.mapToShadowingEvaluationResponse(node);

        assertThat(res.getOverallScore()).isEqualTo(52);
        assertThat(res.getIsPassed()).isFalse();
        assertThat(res.getStatusMessage()).contains("Chưa đạt yêu cầu");
        assertThat(res.getSentenceTokens()).singleElement()
                .satisfies(tok -> assertThat(tok.getColor()).isEqualTo("RED"));
    }
}
