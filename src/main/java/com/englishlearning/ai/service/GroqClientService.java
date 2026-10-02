package com.englishlearning.ai.service;

import com.englishlearning.common.config.AppProperties;
import com.englishlearning.common.exception.BadRequestException;
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

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GroqClientService {

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Bóc băng âm thanh sang văn bản bằng Groq Whisper-large-v3
     */
    public String transcribeAudio(MultipartFile audioFile) {
        try {
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
            body.add("model", appProperties.getGroq().getWhisperModel());
            body.add("response_format", "json");
            body.add("language", "en");

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(
                    appProperties.getGroq().getAudioUrl(),
                    requestEntity,
                    String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            return root.path("text").asText();
        } catch (Exception e) {
            log.error("Groq Whisper Transcription Failed: ", e);
            throw new BadRequestException("Lỗi chuyển đổi giọng nói qua Groq Whisper: " + e.getMessage());
        }
    }

    /**
     * Chấm điểm và phân tích văn bản bằng LLaMA 3.3 70B (xuất JSON chuẩn)
     */
    public String chatCompletionJson(String systemInstruction, String userPrompt) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(appProperties.getGroq().getApiKey());

            Map<String, Object> body = Map.of(
                    "model", appProperties.getGroq().getChatModel(),
                    "messages", List.of(
                            Map.of("role", "system", "content", systemInstruction),
                            Map.of("role", "user", "content", userPrompt)),
                    "temperature", 0.1,
                    "response_format", Map.of("type", "json_object"));

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(
                    appProperties.getGroq().getChatUrl(),
                    requestEntity,
                    String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            return root.path("choices").get(0).path("message").path("content").asText();
        } catch (Exception e) {
            log.error("Groq LLaMA Completion Failed: ", e);
            throw new BadRequestException("Lỗi xử lý mô hình ngôn ngữ Groq: " + e.getMessage());
        }
    }
}