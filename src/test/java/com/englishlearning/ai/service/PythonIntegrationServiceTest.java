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

import java.net.SocketTimeoutException;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
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

    @Test
    @DisplayName("evaluateWriting gửi JSON tới Python writing-scorer (port 8001) và parse đủ trường IELTS")
    void evaluateWriting_postsJsonPayloadAndParsesIeltsResponse() {
        PythonIntegrationServiceImpl writingClient = new PythonIntegrationServiceImpl(
                objectMapper,
                ENDPOINT,
                5000,
                60000,
                "http://localhost:8001",
                "",
                true,
                5000,
                30000
        );
        RestTemplate writingRt = Objects.requireNonNull(
                (RestTemplate) ReflectionTestUtils.getField(writingClient, "writingRestTemplate"));
        MockRestServiceServer writingMockServer = MockRestServiceServer.createServer(writingRt);

        String writingJson = """
                {
                  "wordCount": 265,
                  "isOffTopic": false,
                  "taskAchievement": {
                    "score": 6.5,
                    "addressedPoints": ["Đã đề cập các từ khóa trọng tâm."],
                    "missingPoints": []
                  },
                  "overallBand": 6.5,
                  "estimatedCefr": "B2",
                  "grammarScore": 6.0,
                  "vocabularyScore": 7.0,
                  "coherenceScore": 6.5,
                  "correctedText": "",
                  "generalFeedback": "Ước lượng điểm tổng thể: Band 6.5/9.0 (trình độ B2).",
                  "mistakes": [],
                  "suggestions": [{"area": "Ngữ pháp", "recommendation": "Dùng thêm câu phức."}],
                  "evaluatedBy": "PYTHON_WRITING_SCORER",
                  "modelType": "baseline"
                }
                """;

        writingMockServer.expect(requestTo("http://localhost:8001/api/v1/writing/evaluate"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.topic").value("Public transport"))
                .andExpect(jsonPath("$.essayText").value("Public transport reduces traffic jams."))
                .andExpect(jsonPath("$.assignmentTitle").value("IELTS Task 2"))
                .andExpect(jsonPath("$.writingTask").value("TASK_2"))
                .andRespond(withSuccess(writingJson, MediaType.APPLICATION_JSON));

        assertThat(writingClient.isWritingServiceEnabled()).isTrue();
        JsonNode result = writingClient.evaluateWriting(
                "Public transport",
                "Public transport reduces traffic jams.",
                "IELTS Task 2",
                "Include examples",
                "Check coherence"
        );

        writingMockServer.verify();
        assertThat(result.path("overallBand").asDouble()).isEqualTo(6.5);
        assertThat(result.path("wordCount").asInt()).isEqualTo(265);
        assertThat(result.path("estimatedCefr").asText()).isEqualTo("B2");
        assertThat(result.path("evaluatedBy").asText()).isEqualTo("PYTHON_WRITING_SCORER");

        writingMockServer.reset();
        writingMockServer.expect(requestTo("http://localhost:8001/api/v1/writing/evaluate"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.writingTask").value("TASK_2"))
                .andRespond(withSuccess(writingJson, MediaType.APPLICATION_JSON));

        JsonNode explicitTask2 = writingClient.evaluateWriting(
                "Public transport",
                "Public transport reduces traffic jams.",
                "IELTS Task 2",
                "Include examples",
                "Check coherence",
                "TASK_2"
        );
        writingMockServer.verify();
        assertThat(explicitTask2.path("overallBand").asDouble()).isEqualTo(6.5);
    }

    @Test
    @DisplayName("evaluateWriting truyền explicit writingTask và bọc HTTP 422 UNSUPPORTED_WRITING_TASK thành RuntimeException")
    void evaluateWriting_forwardsWritingTaskAndPropagatesHttp422() {
        RestTemplate writingRt = Objects.requireNonNull(
                (RestTemplate) ReflectionTestUtils.getField(pythonIntegrationService, "writingRestTemplate"));
        MockRestServiceServer writingMockServer = MockRestServiceServer.createServer(writingRt);

        writingMockServer.expect(requestTo("http://localhost:8001/api/v1/writing/evaluate"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.writingTask").value("TASK_1"))
                .andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"detail\":{\"error\":\"UNSUPPORTED_WRITING_TASK\",\"message\":\"Task 2 only\"}}"));

        assertThatThrownBy(() -> pythonIntegrationService.evaluateWriting(
                "Bar chart", "Chart description", "Task 1", null, null, "TASK_1"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Python writing service");
        writingMockServer.verify();
    }

    @Test
    @DisplayName("evaluateWriting trả null khi disabled, ném IllegalArgumentException khi essay rỗng & RuntimeException khi service lỗi")
    void evaluateWriting_handlesDisabledBlankEssayAndHttpErrors() {
        PythonIntegrationServiceImpl disabledClient = new PythonIntegrationServiceImpl(
                objectMapper, ENDPOINT, 5000, 60000, "http://localhost:8001", "", false, 5000, 30000
        );
        assertThat(disabledClient.isWritingServiceEnabled()).isFalse();
        assertThat(disabledClient.evaluateWriting("Topic", "Some essay text")).isNull();

        assertThatThrownBy(() -> pythonIntegrationService.evaluateWriting("Topic", "   "))
                .isInstanceOf(IllegalArgumentException.class);

        RestTemplate writingRt = Objects.requireNonNull(
                (RestTemplate) ReflectionTestUtils.getField(pythonIntegrationService, "writingRestTemplate"));
        MockRestServiceServer writingMockServer = MockRestServiceServer.createServer(writingRt);

        writingMockServer.expect(requestTo("http://localhost:8001/api/v1/writing/evaluate"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body("Model not loaded"));

        assertThatThrownBy(() -> pythonIntegrationService.evaluateWriting("Topic", "Essay content"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Python writing service");
        writingMockServer.verify();
    }

    @Test
    @DisplayName("evaluateWriting: giải quyết URL linh hoạt & chặn body rỗng, JSON thiếu overallBand, timeout")
    void evaluateWriting_urlResolutionMissingOverallBandBlankBodyAndTimeout() {
        // 1. Explicit writingEvaluateUrl
        PythonIntegrationServiceImpl explicitClient = new PythonIntegrationServiceImpl(
                objectMapper, ENDPOINT, 5000, 60000, "http://ignored:1234", "  http://custom-host:9001/v1/score  ", true, 5000, 30000);
        RestTemplate explicitRt = Objects.requireNonNull(
                (RestTemplate) ReflectionTestUtils.getField(explicitClient, "writingRestTemplate"));
        MockRestServiceServer explicitServer = MockRestServiceServer.createServer(explicitRt);
        explicitServer.expect(requestTo("http://custom-host:9001/v1/score"))
                .andRespond(withSuccess("{\"overallBand\":7.0}", MediaType.APPLICATION_JSON));
        assertThat(explicitClient.evaluateWriting("Topic", "Essay body").path("overallBand").asDouble()).isEqualTo(7.0);
        explicitServer.verify();

        // 2. Trailing slashes trên baseUrl
        PythonIntegrationServiceImpl trailingClient = new PythonIntegrationServiceImpl(
                objectMapper, ENDPOINT, 5000, 60000, "http://localhost:8001///", "", true, 5000, 30000);
        RestTemplate trailingRt = Objects.requireNonNull(
                (RestTemplate) ReflectionTestUtils.getField(trailingClient, "writingRestTemplate"));
        MockRestServiceServer trailingServer = MockRestServiceServer.createServer(trailingRt);
        trailingServer.expect(requestTo("http://localhost:8001/api/v1/writing/evaluate"))
                .andRespond(withSuccess("{\"overallBand\":6.5}", MediaType.APPLICATION_JSON));
        assertThat(trailingClient.evaluateWriting("Topic", "Essay body").path("overallBand").asDouble()).isEqualTo(6.5);
        trailingServer.verify();

        // 3. BaseUrl đã kết thúc bằng /api/v1/writing/evaluate/ -> không nhân đôi path
        PythonIntegrationServiceImpl fullBaseClient = new PythonIntegrationServiceImpl(
                objectMapper, ENDPOINT, 5000, 60000, "http://localhost:8001/api/v1/writing/evaluate/", "", true, 5000, 30000);
        RestTemplate fullBaseRt = Objects.requireNonNull(
                (RestTemplate) ReflectionTestUtils.getField(fullBaseClient, "writingRestTemplate"));
        MockRestServiceServer fullBaseServer = MockRestServiceServer.createServer(fullBaseRt);
        fullBaseServer.expect(requestTo("http://localhost:8001/api/v1/writing/evaluate"))
                .andRespond(withSuccess("{\"overallBand\":6.0}", MediaType.APPLICATION_JSON));
        assertThat(fullBaseClient.evaluateWriting("Topic", "Essay body").path("overallBand").asDouble()).isEqualTo(6.0);
        fullBaseServer.verify();

        // 4. Body rỗng 200, thiếu overallBand & SocketTimeoutException
        RestTemplate writingRt = Objects.requireNonNull(
                (RestTemplate) ReflectionTestUtils.getField(pythonIntegrationService, "writingRestTemplate"));
        MockRestServiceServer writingServer = MockRestServiceServer.createServer(writingRt);

        writingServer.expect(requestTo("http://localhost:8001/api/v1/writing/evaluate"))
                .andRespond(withSuccess("", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> pythonIntegrationService.evaluateWriting("Topic", "Essay"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("không hợp lệ");

        writingServer.reset();
        writingServer.expect(requestTo("http://localhost:8001/api/v1/writing/evaluate"))
                .andRespond(withSuccess("{\"wordCount\":120}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> pythonIntegrationService.evaluateWriting("Topic", "Essay"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("overallBand");

        writingServer.reset();
        writingServer.expect(requestTo("http://localhost:8001/api/v1/writing/evaluate"))
                .andRespond(withException(new SocketTimeoutException("Read timed out")));
        assertThatThrownBy(() -> pythonIntegrationService.evaluateWriting("Topic", "Essay"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Lỗi giao tiếp với Python writing service");
        writingServer.verify();
    }

    @Test
    @DisplayName("evaluatePhonetics: rethrow HTTP 500 JSON thiếu detail, xử lý timeout & map mặc định JSON rỗng")
    void evaluatePhonetics_rethrowsJson500WithoutDetailHandlesTimeoutAndMapsEmptyJson() throws Exception {
        mockServer.expect(requestTo(ENDPOINT))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"CUDA OOM\"}"));

        assertThatThrownBy(() -> pythonIntegrationService.evaluatePhonetics(new byte[]{1, 2}, "v.wav", "Hi"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Python phonetic service báo lỗi");

        mockServer.reset();
        mockServer.expect(requestTo(ENDPOINT))
                .andRespond(withException(new SocketTimeoutException("Connect timed out")));

        assertThatThrownBy(() -> pythonIntegrationService.evaluatePhonetics(new byte[]{1, 2}, "v.wav", "Hi"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Lỗi giao tiếp với Python phonetics service");
        mockServer.verify();

        ShadowingEvaluationResponse defaults = pythonIntegrationService.mapToShadowingEvaluationResponse(
                objectMapper.readTree("{}"));
        assertThat(defaults.getOverallScore()).isEqualTo(70);
        assertThat(defaults.getPassScore()).isEqualTo(80);
        assertThat(defaults.getIsPassed()).isFalse();
        assertThat(defaults.getStatusMessage()).contains("Chưa đạt yêu cầu");
        assertThat(defaults.getKpi().getCompleteness()).isEqualTo(100);
        assertThat(defaults.getKpi().getWordsPerMinute()).isEqualTo(120);
    }
}
