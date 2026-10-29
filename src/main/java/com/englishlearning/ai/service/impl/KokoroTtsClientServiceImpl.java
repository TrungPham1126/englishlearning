package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.KokoroTtsClientService;

import com.englishlearning.ai.dto.TtsRequest;
import com.englishlearning.ai.dto.TtsResponse;
import com.englishlearning.curriculum.service.DocumentStorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class KokoroTtsClientServiceImpl implements KokoroTtsClientService {

    private final DocumentStorageService documentStorageService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final RestTemplate restTemplate;

    private final String kokoroTtsUrl;
    private final String defaultVoice;
    private final double defaultSpeed;

    // In-memory fallback cache in case Redis is temporarily disconnected
    private final Map<String, TtsResponse> memoryCache = new ConcurrentHashMap<>();

    private static final String CACHE_KEY_PREFIX = "tts:cache:kokoro82m:";
    private static final Duration CACHE_TTL = Duration.ofDays(30);

    public KokoroTtsClientServiceImpl(
            DocumentStorageService documentStorageService,
            RedisTemplate<String, Object> redisTemplate,
            @Value("${tts.kokoro.url:http://localhost:8000/tts}") String kokoroTtsUrl,
            @Value("${tts.kokoro.default-voice:af_heart}") String defaultVoice,
            @Value("${tts.kokoro.default-speed:1.0}") double defaultSpeed,
            @Value("${tts.kokoro.connect-timeout:10000}") int connectTimeout,
            @Value("${tts.kokoro.read-timeout:120000}") int readTimeout) {
        this.documentStorageService = documentStorageService;
        this.redisTemplate = redisTemplate;
        this.kokoroTtsUrl = kokoroTtsUrl;
        this.defaultVoice = defaultVoice;
        this.defaultSpeed = defaultSpeed;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Synthesizes English text into natural native audio using self-hosted Kokoro-82M.
     * Implements two-tier caching (Redis + in-memory fallback) and Cloudflare R2 / local storage.
     *
     * @param request TtsRequest containing text, optional voice and speed
     * @return TtsResponse with playable audioUrl, voice, speed, duration and cached flag
     */
    @Override
    public TtsResponse synthesizeSpeech(TtsRequest request) {
        if (request == null || request.getText() == null || request.getText().isBlank()) {
            throw new IllegalArgumentException("Văn bản cần phát âm không được để trống.");
        }

        String rawText = request.getText().trim();
        String effectiveVoice = (request.getVoice() != null && !request.getVoice().isBlank())
                ? request.getVoice().trim()
                : defaultVoice;
        double effectiveSpeed = (request.getSpeed() != null && request.getSpeed() > 0)
                ? request.getSpeed()
                : defaultSpeed;

        // Generate deterministic cache key: SHA-256(text + "::" + voice + "::" + speed)
        String hashKey = computeHash(rawText + "::" + effectiveVoice.toLowerCase() + "::" + String.format("%.2f", effectiveSpeed));
        String redisKey = CACHE_KEY_PREFIX + hashKey;

        // 1. Check Redis Cache
        try {
            Object cachedObj = redisTemplate.opsForValue().get(redisKey);
            if (cachedObj instanceof TtsResponse cachedResponse) {
                log.info("Redis TTS Cache HIT: {} -> {}", redisKey, cachedResponse.getAudioUrl());
                return cloneWithCached(cachedResponse, true);
            }
        } catch (Exception redisEx) {
            log.warn("Lỗi đọc Redis cache TTS (tiếp tục kiểm tra in-memory fallback): {}", redisEx.getMessage());
        }

        // 2. Check In-Memory Fallback Cache
        TtsResponse memCached = memoryCache.get(hashKey);
        if (memCached != null) {
            log.info("In-Memory TTS Cache HIT: {} -> {}", hashKey, memCached.getAudioUrl());
            return cloneWithCached(memCached, true);
        }

        // 3. Cache Miss: Call Python Kokoro-82M Microservice
        log.info("TTS Cache MISS. Gửi yêu cầu sinh âm thanh tới Kokoro microservice: {} (voice='{}', speed={}, text='{}')",
                kokoroTtsUrl, effectiveVoice, effectiveSpeed,
                rawText.length() > 50 ? rawText.substring(0, 50) + "..." : rawText);

        byte[] audioBytes;
        Double durationSeconds = null;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.valueOf("audio/wav")));

            Map<String, Object> payload = Map.of(
                    "text", rawText,
                    "voice", effectiveVoice,
                    "speed", effectiveSpeed
            );

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(payload, headers);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    kokoroTtsUrl,
                    HttpMethod.POST,
                    requestEntity,
                    byte[].class
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null || response.getBody().length == 0) {
                throw new RuntimeException("Kokoro microservice trả về mã trạng thái không thành công: " + response.getStatusCode());
            }

            audioBytes = response.getBody();

            // Extract duration from custom header if present
            String durationHeader = response.getHeaders().getFirst("X-Audio-Duration");
            if (durationHeader != null && !durationHeader.isBlank()) {
                try {
                    durationSeconds = Double.parseDouble(durationHeader);
                } catch (NumberFormatException ignored) {}
            }

            // Approximate duration from 24kHz 16-bit mono PCM if header is missing
            if (durationSeconds == null) {
                long pcmBytes = Math.max(0, audioBytes.length - 44);
                durationSeconds = (double) pcmBytes / (24000.0 * 2.0);
            }

            log.info("Nhận audio thành công từ Kokoro TTS: {} bytes (~{:.2f}s)", audioBytes.length, durationSeconds);

        } catch (Exception ex) {
            log.error("Lỗi khi kết nối tới TTS Microservice: {}", ex.getMessage(), ex);
            String userMsg = (ex.getMessage() != null && ex.getMessage().toLowerCase().contains("timed out"))
                    ? "Thời gian tạo âm thanh vượt quá giới hạn cho phép. Vui lòng thử lại."
                    : "Không thể tạo âm thanh bài học lúc này. Vui lòng thử lại.";
            throw new RuntimeException(userMsg, ex);
        }

        // 4. Store synthesized audio file into Cloudflare R2 / Local uploads
        String filename = "tts_sample_" + hashKey.substring(0, 12) + ".wav";
        String audioUrl = documentStorageService.storeAudioBytes(audioBytes, filename, "audio/wav");
        log.info("Đã lưu trữ audio mẫu thành công: {}", audioUrl);

        TtsResponse ttsResponse = TtsResponse.builder()
                .audioUrl(audioUrl)
                .voice(effectiveVoice)
                .speed(effectiveSpeed)
                .durationSeconds(Math.round(durationSeconds * 100.0) / 100.0)
                .cached(false)
                .build();

        // 5. Populate Redis & In-Memory Caches
        try {
            redisTemplate.opsForValue().set(redisKey, ttsResponse, CACHE_TTL);
            log.info("Đã ghi nhớ TTS vào Redis: {}", redisKey);
        } catch (Exception redisEx) {
            log.warn("Không thể lưu cache vào Redis: {}", redisEx.getMessage());
        }
        memoryCache.put(hashKey, ttsResponse);

        return ttsResponse;
    }

    private TtsResponse cloneWithCached(TtsResponse src, boolean isCached) {
        return TtsResponse.builder()
                .audioUrl(src.getAudioUrl())
                .voice(src.getVoice())
                .speed(src.getSpeed())
                .durationSeconds(src.getDurationSeconds())
                .cached(isCached)
                .build();
    }

    private String computeHash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }
}

