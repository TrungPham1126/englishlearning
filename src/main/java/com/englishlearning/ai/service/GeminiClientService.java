package com.englishlearning.ai.service;

import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiClientService {

    @Value("${app.secrets.gemini.api-key}")
    private String geminiApiKey;

    @Value("${app.secrets.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String geminiBaseUrl;

    @Value("${app.secrets.gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    private final ObjectMapper objectMapper;
    private final AiMonitoringService aiMonitoringService;
    private final UserRepository userRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    public String generateWithSystemInstruction(String systemInstruction, String userPrompt) {
        return generateWithSystemInstruction(systemInstruction, userPrompt, 0.2);
    }

    public String generateWithSystemInstruction(String systemInstruction, String userPrompt, double temperature) {
        return generateWithSystemInstruction(systemInstruction, userPrompt, temperature, null, null);
    }

    public String generateWithSystemInstruction(String systemInstruction, String userPrompt, double temperature,
            UUID explicitUserId, Boolean explicitIsTeacher) {
        UUID studentId = (explicitUserId != null) ? explicitUserId : resolveCurrentStudentId();
        boolean isTeacher = (explicitIsTeacher != null) ? explicitIsTeacher : isCurrentTeacherOrAdmin();
        aiMonitoringService.checkRateLimitAndQuota(studentId, isTeacher);

        String url = geminiBaseUrl + "/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> sysInstructionMap = Map.of("parts", List.of(Map.of("text", systemInstruction)));
        Map<String, Object> userContentMap = Map.of("parts", List.of(Map.of("text", userPrompt)));

        Map<String, Object> body = Map.of(
                "systemInstruction", sysInstructionMap,
                "contents", List.of(userContentMap),
                "generationConfig", Map.of(
                        "temperature", Math.max(0.0, Math.min(1.5, temperature)),
                        "response_mime_type", "application/json",
                        "maxOutputTokens", 8192));

        int promptLength = (systemInstruction != null ? systemInstruction.length() : 0)
                + (userPrompt != null ? userPrompt.length() : 0);
        return executeRequest(url, new HttpEntity<>(body, headers), studentId, isTeacher, promptLength);
    }

    public String evaluateAudioWithInstruction(String systemInstruction, byte[] audioBytes, String mimeType,
            String userPrompt) {
        UUID studentId = resolveCurrentStudentId();
        boolean isTeacher = isCurrentTeacherOrAdmin();
        aiMonitoringService.checkRateLimitAndQuota(studentId, isTeacher);

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
                        "response_mime_type", "application/json",
                        "maxOutputTokens", 8192));

        int promptLength = (systemInstruction != null ? systemInstruction.length() : 0)
                + (userPrompt != null ? userPrompt.length() : 0)
                + (audioBytes != null ? audioBytes.length / 50 : 0);
        return executeRequest(url, new HttpEntity<>(body, headers), studentId, isTeacher, promptLength);
    }

    private String executeRequest(String url, HttpEntity<Map<String, Object>> entity, UUID studentId, boolean isTeacher, int promptLength) {
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            String text = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();

            // Bóc tách usageMetadata từ Gemini
            JsonNode usage = root.path("usageMetadata");
            long promptTokens = usage.path("promptTokenCount").asLong(0);
            long completionTokens = usage.path("candidatesTokenCount").asLong(0);

            // Fallback xấp xỉ 1 token ~ 4 ký tự nếu Gemini không trả metadata
            if (promptTokens <= 0) {
                promptTokens = Math.max(1L, promptLength / 4L);
            }
            if (completionTokens <= 0) {
                completionTokens = Math.max(1L, text.length() / 4L);
            }

            // Ghi nhận token tiêu thụ cho học viên/giáo viên
            aiMonitoringService.recordTokenUsage(studentId, isTeacher ? "TEACHER" : "STUDENT", promptTokens, completionTokens, "GEMINI");

            return stripMarkdown(text);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Gemini API Invocation Failure: ", e);
            log.info("Dang goi Gemini URL: {}", url.replaceAll("key=.*", "key=HIDDEN_KEY"));
            log.info("Do dai API Key doc duoc: {}", geminiApiKey != null ? geminiApiKey.length() : 0);
            throw new BadRequestException("Gemini AI API gặp sự cố phân tích: " + e.getMessage());
        }
    }

    private UUID resolveCurrentStudentId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
                return null;
            }
            if (auth.getPrincipal() instanceof com.englishlearning.auth.service.CustomUserDetails userDetails) {
                return userDetails.getId();
            }
            String email = auth.getName();
            return userRepository.findByEmail(email).map(User::getId).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isCurrentTeacherOrAdmin() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null) return false;
            return auth.getAuthorities().stream().anyMatch(a ->
                    a.getAuthority().equals("ROLE_TEACHER") ||
                    a.getAuthority().equals("ROLE_ADMIN") ||
                    a.getAuthority().equals("TEACHER") ||
                    a.getAuthority().equals("ADMIN"));
        } catch (Exception e) {
            return false;
        }
    }

    public static String stripMarkdown(String text) {
        if (text == null) return "{}";
        String s = text.trim();
        if (s.startsWith("```json")) {
            s = s.substring(7);
        } else if (s.startsWith("```")) {
            s = s.substring(3);
        }
        if (s.endsWith("```")) {
            s = s.substring(0, s.length() - 3);
        }
        return s.trim();
    }
}