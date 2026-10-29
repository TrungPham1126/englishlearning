package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.AiMonitoringService;
import com.englishlearning.ai.service.GroqClientService;

import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.common.config.AppProperties;
import com.englishlearning.common.exception.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class GroqClientServiceImpl implements GroqClientService {

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final AiMonitoringService aiMonitoringService;
    private final UserRepository userRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Bóc băng âm thanh sang văn bản bằng Groq Whisper-large-v3
     */
    @Override
    public String transcribeAudio(MultipartFile audioFile) {
        try {
            String filename = audioFile.getOriginalFilename() != null ? audioFile.getOriginalFilename() : "audio.wav";
            return transcribeAudio(audioFile.getBytes(), filename);
        } catch (Exception e) {
            log.error("Groq Whisper Transcription Failed: ", e);
            throw new BadRequestException("Lỗi chuyển đổi giọng nói qua Groq Whisper: " + e.getMessage());
        }
    }

    @Override
    public String transcribeAudio(byte[] audioBytes, String filename) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            headers.setBearerAuth(appProperties.getGroq().getApiKey());

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(audioBytes) {
                @Override
                public String getFilename() {
                    return filename;
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

    @Override
    public String transcribeAudioVerbose(byte[] audioBytes, String filename) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            headers.setBearerAuth(appProperties.getGroq().getApiKey());

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(audioBytes) {
                @Override
                public String getFilename() {
                    return filename;
                }
            };

            body.add("file", fileResource);
            body.add("model", appProperties.getGroq().getWhisperModel());
            body.add("response_format", "verbose_json");
            body.add("timestamp_granularities[]", "word");
            body.add("language", "en");

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(
                    appProperties.getGroq().getAudioUrl(),
                    requestEntity,
                    String.class);

            return response.getBody();
        } catch (Exception e) {
            log.error("Groq Whisper Verbose Transcription Failed: ", e);
            throw new BadRequestException("Lỗi chuyển đổi giọng nói chi tiết qua Groq Whisper: " + e.getMessage());
        }
    }

    /**
     * Chấm điểm và phân tích văn bản bằng LLaMA 3.3 70B (xuất JSON chuẩn, nhiệt độ mặc định 0.1)
     */
    @Override
    public String chatCompletionJson(String systemInstruction, String userPrompt) {
        return chatCompletionJson(systemInstruction, userPrompt, 0.1);
    }

    /**
     * Gọi Groq LLaMA 3.3 70B với nhiệt độ tuỳ chỉnh (temperature: 0.0 - 1.5)
     * - temperature thấp (0.1 - 0.2): Chấm điểm, đánh giá chuẩn xác, khách quan
     * - temperature cao (0.6 - 0.8): Sáng tạo bài tập, đa dạng hóa ngữ cảnh, tránh lặp lại câu hỏi
     */
    @Override
    public String chatCompletionJson(String systemInstruction, String userPrompt, double temperature) {
        return chatCompletionJson(systemInstruction, userPrompt, temperature, null, null);
    }

    /**
     * Gọi Groq LLaMA 3.3 70B với thông tin định danh người gọi cụ thể
     */
    @Override
    public String chatCompletionJson(String systemInstruction, String userPrompt, double temperature,
            UUID explicitUserId, Boolean explicitIsTeacher) {
        UUID userId = (explicitUserId != null) ? explicitUserId : resolveCurrentUserId();
        boolean isTeacher = (explicitIsTeacher != null) ? explicitIsTeacher : isCurrentTeacherOrAdmin();
        aiMonitoringService.checkRateLimitAndQuota(userId, isTeacher);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(appProperties.getGroq().getApiKey());

            double safeTemp = Math.max(0.0, Math.min(1.5, temperature));
            Map<String, Object> body = Map.of(
                    "model", appProperties.getGroq().getChatModel(),
                    "messages", List.of(
                            Map.of("role", "system", "content", systemInstruction),
                            Map.of("role", "user", "content", userPrompt)),
                    "temperature", safeTemp,
                    "max_tokens", 8192,
                    "response_format", Map.of("type", "json_object"));

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(
                    appProperties.getGroq().getChatUrl(),
                    requestEntity,
                    String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            String text = root.path("choices").get(0).path("message").path("content").asText();

            // Bóc tách token usage thực tế từ Groq API
            JsonNode usage = root.path("usage");
            long promptTokens = usage.path("prompt_tokens").asLong(0);
            long completionTokens = usage.path("completion_tokens").asLong(0);

            int promptLen = (systemInstruction != null ? systemInstruction.length() : 0)
                    + (userPrompt != null ? userPrompt.length() : 0);
            if (promptTokens <= 0) {
                promptTokens = Math.max(1L, promptLen / 4L);
            }
            if (completionTokens <= 0) {
                completionTokens = Math.max(1L, text.length() / 4L);
            }

            // Ghi nhận token tiêu thụ cho Học sinh hoặc Giáo viên
            aiMonitoringService.recordTokenUsage(userId, isTeacher ? "TEACHER" : "STUDENT", promptTokens, completionTokens, "GROQ");

            return stripMarkdown(text);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Groq LLaMA Completion Failed: ", e);
            throw new BadRequestException("Lỗi xử lý mô hình ngôn ngữ Groq: " + e.getMessage());
        }
    }

    private UUID resolveCurrentUserId() {
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