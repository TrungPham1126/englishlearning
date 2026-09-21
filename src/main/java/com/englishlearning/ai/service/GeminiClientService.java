package com.englishlearning.ai.service;

import com.englishlearning.common.exception.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiClientService {

    @Value("${app.secrets.gemini.api-key}")
    private String geminiApiKey;

    @Value("${app.secrets.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${app.secrets.gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    public String generateWithSystemInstruction(String systemInstruction, String userPrompt) {
        String url = geminiBaseUrl + "/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> sysInstructionMap = Map.of("parts", List.of(Map.of("text", systemInstruction)));
        Map<String, Object> userContentMap = Map.of("parts", List.of(Map.of("text", userPrompt)));

        Map<String, Object> body = Map.of(
                "systemInstruction", sysInstructionMap,
                "contents", List.of(userContentMap),
                "generationConfig", Map.of(
                        "temperature", 0.1,
                        "response_mime_type", "application/json"));

        return executeRequest(url, new HttpEntity<>(body, headers));
    }

    public String evaluateAudioWithInstruction(String systemInstruction, byte[] audioBytes, String mimeType,
            String userPrompt) {
        String url = geminiBaseUrl + "/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String base64Audio = Base64.getEncoder().encodeToString(audioBytes);
        Map<String, Object> sysInstructionMap = Map.of("parts", List.of(Map.of("text", systemInstruction)));

        Map<String, Object> audioPart = Map.of("inline_data", Map.of("mime_type", mimeType, "data", base64Audio));
        Map<String, Object> textPart = Map.of("text", userPrompt);

        Map<String, Object> userContentMap = Map.of("parts", List.of(textPart, audioPart));

        Map<String, Object> body = Map.of(
                "systemInstruction", sysInstructionMap,
                "contents", List.of(userContentMap),
                "generationConfig", Map.of(
                        "temperature", 0.1,
                        "response_mime_type", "application/json"));

        return executeRequest(url, new HttpEntity<>(body, headers));
    }

    private String executeRequest(String url, HttpEntity<Map<String, Object>> entity) {
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            return root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();
        } catch (Exception e) {
            log.error("Gemini API Invocation Failure: ", e);
            log.info("Dang goi Gemini URL: {}", url.replaceAll("key=.*", "key=HIDDEN_KEY"));
            log.info("Do dai API Key doc duoc: {}", geminiApiKey != null ? geminiApiKey.length() : 0);
            throw new BadRequestException("Gemini AI API gặp sự cố phân tích: " + e.getMessage());
        }

    }
}