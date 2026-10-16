package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.TtsRequest;
import com.englishlearning.ai.dto.TtsResponse;
import com.englishlearning.curriculum.service.DocumentStorageService;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

public class KokoroTtsClientServiceTest {

    private DocumentStorageService documentStorageService;
    private RedisTemplate<String, Object> redisTemplate;
    private ValueOperations<String, Object> valueOperations;
    private KokoroTtsClientService kokoroTtsClientService;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        documentStorageService = mock(DocumentStorageService.class);
        redisTemplate = mock(RedisTemplate.class);
        valueOperations = mock(ValueOperations.class);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        kokoroTtsClientService = new KokoroTtsClientService(
                documentStorageService,
                redisTemplate,
                "http://127.0.0.1:8000/tts",
                "af_heart",
                1.0,
                3000,
                10000
        );
    }

    @Test
    void testEmptyTextThrowsException() {
        TtsRequest emptyReq = TtsRequest.builder().text("   ").build();
        Assertions.assertThrows(IllegalArgumentException.class, () -> {
            kokoroTtsClientService.synthesizeSpeech(emptyReq);
        });

        Assertions.assertThrows(IllegalArgumentException.class, () -> {
            kokoroTtsClientService.synthesizeSpeech(null);
        });
    }

    @Test
    void testRedisCacheHitReturnsCachedResponse() {
        String text = "Consistent pronunciation practice and phonemic awareness enhance oral fluency.";
        TtsResponse cached = TtsResponse.builder()
                .audioUrl("https://storage.example.com/audio/sample_123.wav")
                .voice("af_heart")
                .speed(1.0)
                .durationSeconds(4.5)
                .cached(false)
                .build();

        when(valueOperations.get(anyString())).thenReturn(cached);

        TtsRequest request = TtsRequest.builder()
                .text(text)
                .voice("af_heart")
                .speed(1.0)
                .build();

        TtsResponse result = kokoroTtsClientService.synthesizeSpeech(request);

        Assertions.assertNotNull(result);
        Assertions.assertTrue(result.isCached(), "Response should indicate cached=true on cache hit");
        Assertions.assertEquals(cached.getAudioUrl(), result.getAudioUrl());
        Assertions.assertEquals("af_heart", result.getVoice());
        verify(documentStorageService, never()).storeAudioBytes(any(), anyString(), anyString());
    }
}

