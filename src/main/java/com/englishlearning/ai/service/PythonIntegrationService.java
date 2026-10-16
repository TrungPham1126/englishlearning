package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class PythonIntegrationService {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final String evaluatePhoneticsUrl;

    public PythonIntegrationService(
            ObjectMapper objectMapper,
            @Value("${python.audio-service.evaluate-phonetics-url:http://localhost:8000/api/v1/audio/evaluate-phonetics}") String evaluatePhoneticsUrl,
            @Value("${python.audio-service.connect-timeout:5000}") int connectTimeout,
            @Value("${python.audio-service.read-timeout:60000}") int readTimeout) {
        this.objectMapper = objectMapper;
        this.evaluatePhoneticsUrl = evaluatePhoneticsUrl;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Gửi audio bytes và câu tham chiếu script tới FastAPI microservice
     * POST /api/v1/audio/evaluate-phonetics (multipart/form-data)
     */
    public ShadowingEvaluationResponse evaluatePhonetics(byte[] audioBytes, String filename, String script) {
        if (audioBytes == null || audioBytes.length == 0) {
            throw new IllegalArgumentException("Dữ liệu âm thanh không được để trống khi gửi tới Python microservice.");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            final String effectiveFilename = (filename != null && !filename.isBlank()) ? filename : "audio.wav";
            ByteArrayResource audioResource = new ByteArrayResource(audioBytes) {
                @Override
                public String getFilename() {
                    return effectiveFilename;
                }
            };

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("audio", audioResource);
            body.add("script", (script != null && !script.isBlank()) ? script : "Hello");

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            log.info("Gửi request POST tới Python phonetics service: {} (audio size: {} bytes, script: '{}')",
                    evaluatePhoneticsUrl, audioBytes.length, script);

            ResponseEntity<String> responseEntity = restTemplate.postForEntity(
                    evaluatePhoneticsUrl,
                    requestEntity,
                    String.class
            );

            if (!responseEntity.getStatusCode().is2xxSuccessful() || responseEntity.getBody() == null) {
                log.error("Python phonetic microservice trả về mã HTTP không hợp lệ: {}", responseEntity.getStatusCode());
                throw new RuntimeException("Python phonetic microservice trả về lỗi HTTP: " + responseEntity.getStatusCode());
            }

            String rawJson = responseEntity.getBody();
            log.info("Phản hồi từ Python phonetic microservice: {}", rawJson);

            JsonNode rootNode = objectMapper.readTree(rawJson);
            return mapToShadowingEvaluationResponse(rootNode);

        } catch (org.springframework.web.client.HttpStatusCodeException httpEx) {
            log.warn("Python phonetics microservice trả về HTTP status {}: {}",
                    httpEx.getStatusCode(), httpEx.getResponseBodyAsString());
            try {
                JsonNode errNode = objectMapper.readTree(httpEx.getResponseBodyAsString());
                JsonNode detailNode = errNode.path("detail");
                String msg = detailNode.path("message").asText("Chất lượng ghi âm chưa đạt chuẩn hoặc không khớp câu mẫu.");
                String sugg = detailNode.path("suggestion").asText("Vui lòng đọc to, rõ ràng và đúng theo câu mẫu.");
                return buildLowConfidenceResponse(script, msg + " " + sugg);
            } catch (Exception parseEx) {
                log.warn("Không thể parse error body từ Python service, rethrow để fallback: {}", parseEx.getMessage());
                throw new RuntimeException("Python phonetic service báo lỗi: " + httpEx.getMessage(), httpEx);
            }
        } catch (Exception e) {
            log.error("Lỗi khi kết nối tới Python phonetics microservice ({}): {}", evaluatePhoneticsUrl, e.getMessage());
            throw new RuntimeException("Lỗi giao tiếp với Python phonetics service: " + e.getMessage(), e);
        }
    }

    private ShadowingEvaluationResponse buildLowConfidenceResponse(String script, String message) {
        String effectiveScript = (script != null && !script.isBlank()) ? script : "Hello";
        String[] words = effectiveScript.trim().split("\\s+");

        List<ShadowingEvaluationResponse.SentenceToken> tokens = new ArrayList<>();
        List<ShadowingEvaluationResponse.WordPhonemeDetail> wordRows = new ArrayList<>();

        for (String w : words) {
            tokens.add(ShadowingEvaluationResponse.SentenceToken.builder()
                    .word(w)
                    .color("GRAY")
                    .wordStatus("MISSING")
                    .hasPauseAfter(false)
                    .hasLinkingAfter(false)
                    .build());

            wordRows.add(ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                    .word(w)
                    .score(0)
                    .wordStatus("MISSING")
                    .phonemes(List.of(ShadowingEvaluationResponse.PhonemeItem.builder()
                            .ipa("-")
                            .score(0)
                            .note("Chưa ghi nhận tín hiệu giọng nói cho từ này.")
                            .build()))
                    .build());
        }

        return ShadowingEvaluationResponse.builder()
                .overallScore(0)
                .isPassed(false)
                .passScore(80)
                .statusMessage(message)
                .evaluatedBy("PYTHON_ACOUSTIC_ENGINE")
                .kpi(ShadowingEvaluationResponse.KpiMetrics.builder()
                        .pronunciation(0)
                        .fluency(0)
                        .completeness(0)
                        .prosody(0)
                        .wordsPerMinute(0)
                        .build())
                .sentenceTokens(tokens)
                .wordRows(wordRows)
                .build();
    }

    /**
     * Chuyển đổi linh hoạt kết quả từ Python sang ShadowingEvaluationResponse
     * Tương thích 100% với cả schema mới lẫn schema UI frontend cũ.
     */
    public ShadowingEvaluationResponse mapToShadowingEvaluationResponse(JsonNode rootNode) {
        try {
            ShadowingEvaluationResponse res;
            try {
                res = objectMapper.treeToValue(rootNode, ShadowingEvaluationResponse.class);
            } catch (Exception treeEx) {
                log.warn("treeToValue gặp vấn đề ({}), tiến hành gán từng trường", treeEx.getMessage());
                res = new ShadowingEvaluationResponse();
            }
            if (res == null) {
                res = new ShadowingEvaluationResponse();
            }

            // 1. Overall Score
            if (res.getOverallScore() == null) {
                double raw = rootNode.has("overallScore")
                        ? rootNode.path("overallScore").asDouble(70.0)
                        : rootNode.path("overall_score").asDouble(70.0);
                res.setOverallScore((int) Math.round(raw));
            }

            // 2. Pass status & Pass Score
            if (res.getPassScore() == null) {
                res.setPassScore(rootNode.path("passScore").asInt(80));
            }
            if (res.getIsPassed() == null) {
                res.setIsPassed(res.getOverallScore() >= res.getPassScore());
            }

            // 3. Status Message
            if (res.getStatusMessage() == null || res.getStatusMessage().isBlank()) {
                if (rootNode.hasNonNull("statusMessage")) {
                    res.setStatusMessage(rootNode.path("statusMessage").asText());
                } else if (res.getIsPassed()) {
                    res.setStatusMessage("Bài nói xuất sắc! Khẩu hình F1/F2 và ngữ điệu đều đạt chuẩn.");
                } else {
                    res.setStatusMessage("Chưa đạt yêu cầu. Có từ phát âm chưa chuẩn hoặc khẩu hình F1/F2 bị lệch.");
                }
            }

            // 4. KPI Metrics
            if (res.getKpi() == null) {
                int pron = rootNode.path("pronunciationScore").asInt(
                        (int) Math.round(rootNode.path("pronunciation_score").asDouble((double) res.getOverallScore()))
                );
                int fluency = rootNode.path("fluencyScore").asInt(
                        (int) Math.round(rootNode.path("fluency_score").asDouble((double) res.getOverallScore()))
                );
                int speed = rootNode.path("speedScore").asInt(
                        (int) Math.round(rootNode.path("speed_score").asDouble(80.0))
                );
                double articulationRate = rootNode.path("articulationRate").asDouble(
                        rootNode.path("articulation_rate").asDouble(3.0)
                );
                int wpm = (int) Math.round(articulationRate * 60 / 1.5);

                ShadowingEvaluationResponse.KpiMetrics kpi = ShadowingEvaluationResponse.KpiMetrics.builder()
                        .pronunciation(pron)
                        .fluency(fluency)
                        .completeness(100)
                        .prosody(speed)
                        .wordsPerMinute(wpm > 0 ? wpm : 120)
                        .build();
                res.setKpi(kpi);
            }

            // 5. Word Rows
            if ((res.getWordRows() == null || res.getWordRows().isEmpty()) && rootNode.has("words")) {
                List<ShadowingEvaluationResponse.WordPhonemeDetail> wordRows = new ArrayList<>();
                for (JsonNode wNode : rootNode.path("words")) {
                    String wWord = wNode.path("word").asText("");
                    int wScore = wNode.path("score").asInt((int) Math.round(wNode.path("score").asDouble(70.0)));

                    List<ShadowingEvaluationResponse.PhonemeItem> phonemes = new ArrayList<>();
                    if (wNode.has("phonemes")) {
                        for (JsonNode pNode : wNode.path("phonemes")) {
                            String pSymbol = pNode.path("symbol").asText(pNode.path("ipa").asText(""));
                            int pScore = pNode.path("score").asInt((int) Math.round(pNode.path("score").asDouble(70.0)));
                            String pFeedback = pNode.path("feedback").asText(
                                    pNode.path("note").asText("Âm " + pSymbol + ": " + pScore + "/100")
                            );
                            phonemes.add(ShadowingEvaluationResponse.PhonemeItem.builder()
                                    .ipa(pSymbol)
                                    .score(pScore)
                                    .note(pFeedback)
                                    .build());
                        }
                    }

                    wordRows.add(ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                            .word(wWord)
                            .score(wScore)
                            .phonemes(phonemes)
                            .build());
                }
                res.setWordRows(wordRows);
            }

            // 6. Sentence Tokens
            if ((res.getSentenceTokens() == null || res.getSentenceTokens().isEmpty()) && res.getWordRows() != null) {
                List<ShadowingEvaluationResponse.SentenceToken> tokens = new ArrayList<>();
                for (ShadowingEvaluationResponse.WordPhonemeDetail wr : res.getWordRows()) {
                    int sc = wr.getScore() != null ? wr.getScore() : 70;
                    String color = sc >= 80 ? "GREEN" : (sc >= 60 ? "YELLOW" : "RED");
                    tokens.add(ShadowingEvaluationResponse.SentenceToken.builder()
                            .word(wr.getWord())
                            .color(color)
                            .hasPauseAfter(false)
                            .hasLinkingAfter(false)
                            .build());
                }
                res.setSentenceTokens(tokens);
            }

            return res;
        } catch (Exception e) {
            log.error("Lỗi parse kết quả từ JSON sang ShadowingEvaluationResponse: ", e);
            throw new RuntimeException("Lỗi chuyển đổi dữ liệu chấm điểm: " + e.getMessage(), e);
        }
    }
}
