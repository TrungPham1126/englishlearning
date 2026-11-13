package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.TtsRequest;
import com.englishlearning.ai.dto.TtsResponse;
import com.englishlearning.ai.service.impl.KokoroTtsClientServiceImpl;
import com.englishlearning.curriculum.service.DocumentStorageService;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@DisplayName("KokoroTtsClientServiceImpl - Two-tier Cache, X-Audio-Duration & PCM Fallback")
public class KokoroTtsClientServiceTest {

    private static final String TTS_URL = "http://127.0.0.1:8000/tts";

    private DocumentStorageService documentStorageService;
    private RedisTemplate<String, Object> redisTemplate;
    private ValueOperations<String, Object> valueOperations;
    private KokoroTtsClientService kokoroTtsClientService;
    private MockRestServiceServer mockServer;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        documentStorageService = mock(DocumentStorageService.class);
        redisTemplate = mock(RedisTemplate.class);
        valueOperations = mock(ValueOperations.class);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        kokoroTtsClientService = new KokoroTtsClientServiceImpl(
                documentStorageService,
                redisTemplate,
                TTS_URL,
                "af_heart",
                1.0,
                3000,
                10000
        );
        RestTemplate restTemplate = Objects.requireNonNull(
                (RestTemplate) ReflectionTestUtils.getField(kokoroTtsClientService, "restTemplate"));
        mockServer = MockRestServiceServer.createServer(restTemplate);
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

    @Test
    @DisplayName("Cache miss: đọc header X-Audio-Duration, dùng voice/speed mặc định và lưu trữ Redis")
    void synthesizeSpeech_cacheMissReadsAudioDurationHeaderAndStoresToRedis() {
        when(valueOperations.get(anyString())).thenReturn("unexpected-non-dto-value");
        when(documentStorageService.storeAudioBytes(any(), anyString(), eq("audio/wav")))
                .thenReturn("https://cdn.example.com/tts_header.wav");

        HttpHeaders responseHeaders = new HttpHeaders();
        responseHeaders.set("X-Audio-Duration", "3.456");

        mockServer.expect(requestTo(TTS_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.text").value("Hello world"))
                .andExpect(jsonPath("$.voice").value("af_heart"))
                .andExpect(jsonPath("$.speed").value(1.0))
                .andRespond(withSuccess(new byte[100], MediaType.valueOf("audio/wav")).headers(responseHeaders));

        TtsResponse result = kokoroTtsClientService.synthesizeSpeech(
                TtsRequest.builder().text("  Hello world  ").voice(" ").speed(-1.0).build());

        mockServer.verify();
        assertThat(result.isCached()).isFalse();
        assertThat(result.getAudioUrl()).isEqualTo("https://cdn.example.com/tts_header.wav");
        assertThat(result.getVoice()).isEqualTo("af_heart");
        assertThat(result.getSpeed()).isEqualTo(1.0);
        assertThat(result.getDurationSeconds()).isEqualTo(3.46);
        verify(valueOperations).set(anyString(), any(TtsResponse.class), eq(Duration.ofDays(30)));
    }

    @Test
    @DisplayName("Cache miss không có X-Audio-Duration: ước lượng thời lượng PCM 24kHz; Redis lỗi vẫn fallback sang memoryCache")
    void synthesizeSpeech_estimatesPcmDurationAndFallsBackToMemoryCacheWhenRedisFails() {
        when(valueOperations.get(anyString())).thenThrow(new RuntimeException("Redis connection refused"));
        doThrow(new RuntimeException("Redis write refused"))
                .when(valueOperations).set(anyString(), any(), any(Duration.class));
        when(documentStorageService.storeAudioBytes(any(), anyString(), eq("audio/wav")))
                .thenReturn("https://cdn.example.com/tts_pcm.wav");

        byte[] wavPayload = new byte[44 + 48_000]; // 1.00 giây ở 24kHz 16-bit mono
        HttpHeaders badHeader = new HttpHeaders();
        badHeader.set("X-Audio-Duration", "not-a-number");

        mockServer.expect(requestTo(TTS_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(wavPayload, MediaType.valueOf("audio/wav")).headers(badHeader));

        TtsRequest req = TtsRequest.builder().text("Practice makes perfect").voice("bm_george").speed(1.25).build();
        TtsResponse firstCall = kokoroTtsClientService.synthesizeSpeech(req);
        TtsResponse secondCall = kokoroTtsClientService.synthesizeSpeech(req);

        mockServer.verify();
        assertThat(firstCall.isCached()).isFalse();
        assertThat(firstCall.getDurationSeconds()).isEqualTo(1.0);
        assertThat(firstCall.getVoice()).isEqualTo("bm_george");

        // Lần gọi thứ hai phải hit in-memory fallback cache (không gọi HTTP thêm) dù Redis vẫn lỗi
        assertThat(secondCall.isCached()).isTrue();
        assertThat(secondCall.getAudioUrl()).isEqualTo("https://cdn.example.com/tts_pcm.wav");
        verify(documentStorageService, times(1)).storeAudioBytes(any(), anyString(), eq("audio/wav"));
    }

    @Test
    @DisplayName("Ném thông báo tiếng Việt thân thiện khi Kokoro timeout hoặc trả về HTTP 500")
    void synthesizeSpeech_handlesTimeoutAndServerErrors() {
        when(valueOperations.get(anyString())).thenReturn(null);

        mockServer.expect(requestTo(TTS_URL))
                .andRespond(withException(new java.net.SocketTimeoutException("Read timed out")));

        assertThatThrownBy(() -> kokoroTtsClientService.synthesizeSpeech(
                TtsRequest.builder().text("Timeout case").build()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Thời gian tạo âm thanh vượt quá giới hạn");

        mockServer.reset();
        mockServer.expect(requestTo(TTS_URL))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        assertThatThrownBy(() -> kokoroTtsClientService.synthesizeSpeech(
                TtsRequest.builder().text("Server 500 case").build()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Không thể tạo âm thanh bài học lúc này");

        mockServer.verify();
    }
}

