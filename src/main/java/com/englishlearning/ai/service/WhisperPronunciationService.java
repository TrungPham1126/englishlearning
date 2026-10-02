package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import com.englishlearning.common.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class WhisperPronunciationService {

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    public PhoneticEvaluationResponse evaluatePronunciation(MultipartFile audioFile, String referenceText) {
        try {
            // 1. Gọi Groq Whisper API để lấy transcript chi tiết từng từ
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            headers.setBearerAuth(appProperties.getGroq().getApiKey());

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(audioFile.getBytes()) {
                @Override
                public String getFilename() {
                    return audioFile.getOriginalFilename() != null ? audioFile.getOriginalFilename() : "audio.wav";
                }
            };

            body.add("file", fileResource);
            body.add("model", "whisper-large-v3");
            body.add("response_format", "verbose_json");
            body.add("temperature", "0.0");
            body.add("language", "en");

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    requestEntity,
                    String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            String spokenText = root.path("text").asText();

            // 2. Tách từ đoạn văn mẫu và từ học sinh thực tế đã đọc
            List<String> expectedWords = cleanWords(referenceText);
            List<String> actualWords = cleanWords(spokenText);

            // 3. Đối chiếu từng từ để chấm điểm chi tiết
            List<PhoneticEvaluationResponse.WordScore> wordScores = new ArrayList<>();
            int totalWords = expectedWords.size();
            int matchedWords = 0;
            int actualIdx = 0;

            for (String expected : expectedWords) {
                boolean found = false;
                int searchWindow = Math.min(actualIdx + 3, actualWords.size()); // Quét lân cận 3 từ

                for (int i = actualIdx; i < searchWindow; i++) {
                    String actual = actualWords.get(i);
                    double similarity = calculateSimilarity(expected, actual);

                    if (similarity >= 0.8) { // Đọc chuẩn hoặc gần đúng
                        wordScores.add(PhoneticEvaluationResponse.WordScore.builder()
                                .word(expected)
                                .score((int) Math.round(similarity * 100))
                                .isAccurate(similarity >= 0.9)
                                .note(similarity >= 0.9 ? "Phát âm chuẩn xác"
                                        : "Phát âm chưa tròn vành: '" + actual + "'")
                                .build());
                        actualIdx = i + 1;
                        matchedWords++;
                        found = true;
                        break;
                    } else if (similarity >= 0.5) { // Đọc lệch âm
                        wordScores.add(PhoneticEvaluationResponse.WordScore.builder()
                                .word(expected)
                                .score((int) Math.round(similarity * 100))
                                .isAccurate(false)
                                .note("Phát âm sai hoặc nghe thành: '" + actual + "'")
                                .build());
                        actualIdx = i + 1;
                        found = true;
                        break;
                    }
                }

                if (!found) { // Bỏ sót từ
                    wordScores.add(PhoneticEvaluationResponse.WordScore.builder()
                            .word(expected)
                            .score(0)
                            .isAccurate(false)
                            .note("Đọc thiếu hoặc nuốt từ")
                            .build());
                }
            }

            int overallScore = totalWords > 0 ? (int) Math.round(((double) matchedWords / totalWords) * 100) : 0;
            String feedback = String.format("Đã phát âm đúng %d/%d từ. Độ chính xác tổng thể: %d%%.",
                    matchedWords, totalWords, overallScore);

            return PhoneticEvaluationResponse.builder()
                    .overallScore(overallScore)
                    .feedback(feedback)
                    .wordScores(wordScores)
                    .build();

        } catch (Exception e) {
            log.error("Lỗi chấm giọng đọc qua Whisper: ", e);
            throw new RuntimeException("Chấm phát âm bằng Whisper thất bại: " + e.getMessage(), e);
        }
    }

    private List<String> cleanWords(String text) {
        if (text == null || text.isBlank())
            return Collections.emptyList();
        return Arrays.stream(text.replaceAll("[^a-zA-Z0-9\\s]", "").toLowerCase().split("\\s+"))
                .filter(w -> !w.isBlank())
                .toList();
    }

    private double calculateSimilarity(String s1, String s2) {
        if (s1.equalsIgnoreCase(s2))
            return 1.0;
        int distance = computeLevenshteinDistance(s1, s2);
        int maxLen = Math.max(s1.length(), s2.length());
        return maxLen == 0 ? 1.0 : (1.0 - (double) distance / maxLen);
    }

    private int computeLevenshteinDistance(String lhs, String rhs) {
        int[][] distance = new int[lhs.length() + 1][rhs.length() + 1];
        for (int i = 0; i <= lhs.length(); i++)
            distance[i][0] = i;
        for (int j = 1; j <= rhs.length(); j++)
            distance[0][j] = j;

        for (int i = 1; i <= lhs.length(); i++) {
            for (int j = 1; j <= rhs.length(); j++) {
                int cost = (lhs.charAt(i - 1) == rhs.charAt(j - 1)) ? 0 : 1;
                distance[i][j] = Math.min(
                        Math.min(distance[i - 1][j] + 1, distance[i][j - 1] + 1),
                        distance[i - 1][j - 1] + cost);
            }
        }
        return distance[lhs.length()][rhs.length()];
    }
}