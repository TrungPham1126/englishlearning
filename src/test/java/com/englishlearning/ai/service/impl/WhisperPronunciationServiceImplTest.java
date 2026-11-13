package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import com.englishlearning.common.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("WhisperPronunciationServiceImpl - Đối chiếu Levenshtein từng từ với Groq Whisper")
class WhisperPronunciationServiceImplTest {

    @Mock
    private RestTemplate restTemplate;

    private WhisperPronunciationServiceImpl service;

    @BeforeEach
    void setUp() {
        AppProperties appProperties = new AppProperties();
        appProperties.getGroq().setApiKey("gsk-test");
        service = new WhisperPronunciationServiceImpl(appProperties, new ObjectMapper(), restTemplate);
    }

    @Test
    @DisplayName("Chấm 100 điểm khi transcript khớp hoàn toàn với câu mẫu")
    void evaluatePronunciation_perfectMatch() {
        MockMultipartFile audio = new MockMultipartFile("audio", "speech.wav", "audio/wav", "bytes".getBytes());
        when(restTemplate.postForEntity(eq("https://api.groq.com/openai/v1/audio/transcriptions"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"text\": \"Good morning everyone!\"}"));

        PhoneticEvaluationResponse res = service.evaluatePronunciation(audio, "Good morning, everyone.");

        assertThat(res.getOverallScore()).isEqualTo(100);
        assertThat(res.getWordScores()).hasSize(3)
                .allMatch(w -> w.isAccurate() && w.getScore() == 100);
    }

    @Test
    @DisplayName("Phân biệt chính xác từ khớp tốt (>=0.72), từ lệch âm (0.45-0.71) và từ bỏ sót (<0.45)")
    void evaluatePronunciation_handlesNearMatchMispronouncedAndOmittedWords() {
        MockMultipartFile audio = new MockMultipartFile("audio", null, "audio/wav", "bytes".getBytes());
        // "helo" vs "hello" -> distance 1/5 = 0.80 (>=0.72 -> accurate!)
        // "wrold" -> test similarity: "world" vs "word" = 0.80, "world" vs "waldo" = 0.40;
        // dùng "important" vs "importat" (0.89), "education" vs "educat" (6/9=0.67 -> 0.45-0.71), "today" omitted
        when(restTemplate.postForEntity(eq("https://api.groq.com/openai/v1/audio/transcriptions"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"text\": \"noise helo educat\"}"));

        PhoneticEvaluationResponse res = service.evaluatePronunciation(audio, "hello education today");

        assertThat(res.getWordScores()).hasSize(3);
        assertThat(res.getWordScores().get(0).getWord()).isEqualTo("hello");
        assertThat(res.getWordScores().get(0).isAccurate()).isTrue();
        assertThat(res.getWordScores().get(1).getWord()).isEqualTo("education");
        assertThat(res.getWordScores().get(1).isAccurate()).isFalse();
        assertThat(res.getWordScores().get(1).getNote()).contains("nghe gần giống");
        assertThat(res.getWordScores().get(2).getWord()).isEqualTo("today");
        assertThat(res.getWordScores().get(2).getScore()).isZero();
        assertThat(res.getWordScores().get(2).getNote()).contains("Đọc thiếu");
    }

    @Test
    @DisplayName("Trả về 0 điểm khi đoạn văn tham chiếu rỗng và ném RuntimeException khi gọi API thất bại")
    void evaluatePronunciation_handlesEmptyReferenceAndApiFailure() {
        MockMultipartFile audio = new MockMultipartFile("audio", "a.wav", "audio/wav", "bytes".getBytes());
        when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"text\": \"hello\"}"))
                .thenThrow(new RuntimeException("Groq down"));

        PhoneticEvaluationResponse emptyRef = service.evaluatePronunciation(audio, "   ");
        assertThat(emptyRef.getOverallScore()).isZero();
        assertThat(emptyRef.getWordScores()).isEmpty();

        assertThatThrownBy(() -> service.evaluatePronunciation(audio, "Hello"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Whisper");
    }
}
