package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import com.englishlearning.common.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
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

    @Test
    @DisplayName("Kiểm tra đủ 3 ngưỡng Levenshtein, giới hạn cửa sổ 4 từ, header Bearer & tên file mặc định")
    @SuppressWarnings("unchecked")
    void evaluatePronunciation_verifiesThresholdsNotesWindowAndRequestHeaders() {
        MockMultipartFile audio = new MockMultipartFile("audio", null, "audio/wav", "bytes".getBytes());
        // "apple" vs "apple" -> 1.0 (>=0.85 -> chuẩn xác)
        // "hello" vs "helo" -> 0.80 (0.72..0.84 -> khá rõ, score=82)
        // "education" vs "educat" -> 0.67 (0.45..0.71 -> tròn vành hơn)
        // "banana" cách "educat" 3 từ đệm (w1 w2 w3) -> vẫn trong cửa sổ 4 từ -> khớp
        // "orange" cách "banana" 4 từ đệm (z1 z2 z3 z4) -> ngoài cửa sổ -> bị tính thiếu từ (0đ)
        when(restTemplate.postForEntity(
                eq("https://api.groq.com/openai/v1/audio/transcriptions"),
                any(HttpEntity.class),
                eq(String.class)))
                .thenReturn(ResponseEntity.ok(
                        "{\"text\": \"apple helo educat w1 w2 w3 banana z1 z2 z3 z4 orange\"}"));

        PhoneticEvaluationResponse res = service.evaluatePronunciation(audio, "apple hello education banana orange");

        assertThat(res.getWordScores()).hasSize(5);
        assertThat(res.getWordScores().get(0).getNote()).isEqualTo("Phát âm chuẩn xác");
        assertThat(res.getWordScores().get(1).getScore()).isEqualTo(90);
        assertThat(res.getWordScores().get(1).getNote()).isEqualTo("Phát âm khá rõ: 'helo'");
        assertThat(res.getWordScores().get(2).isAccurate()).isFalse();
        assertThat(res.getWordScores().get(2).getNote()).contains("Cần phát âm tròn vành hơn");
        assertThat(res.getWordScores().get(3).isAccurate()).isTrue();
        assertThat(res.getWordScores().get(3).getWord()).isEqualTo("banana");
        assertThat(res.getWordScores().get(4).getScore()).isZero();
        assertThat(res.getWordScores().get(4).getNote()).isEqualTo("Đọc thiếu hoặc nuốt từ");

        ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(
                eq("https://api.groq.com/openai/v1/audio/transcriptions"),
                entityCaptor.capture(),
                eq(String.class));
        assertThat(entityCaptor.getValue().getHeaders().getFirst("Authorization")).isEqualTo("Bearer gsk-test");
        ByteArrayResource uploadedResource = (ByteArrayResource) entityCaptor.getValue().getBody().getFirst("file");
        assertThat(uploadedResource.getFilename()).isEqualTo("audio.wav");
    }

    @Test
    @DisplayName("Trả 0% và đánh dấu thiếu toàn bộ từ khi Whisper trả transcript rỗng")
    void evaluatePronunciation_blankSpokenTranscript_marksAllWordsOmitted() {
        MockMultipartFile audio = new MockMultipartFile("audio", "clip.wav", "audio/wav", "bytes".getBytes());
        when(restTemplate.postForEntity(
                eq("https://api.groq.com/openai/v1/audio/transcriptions"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"text\": \"\"}"));

        PhoneticEvaluationResponse res = service.evaluatePronunciation(audio, "Good morning");

        assertThat(res.getOverallScore()).isZero();
        assertThat(res.getFeedback()).isEqualTo("Đã phát âm đúng 0/2 từ. Độ chính xác tổng thể: 0%.");
        assertThat(res.getWordScores()).hasSize(2)
                .allMatch(w -> !w.isAccurate() && w.getScore() == 0);
    }

    @Test
    @DisplayName("Gắn AiCoachingAdvice sau khi Whisper chấm điểm từng từ khi SpeakingAiCoachingService khả dụng")
    void evaluatePronunciation_attachesAiCoachingAdvice() {
        MockMultipartFile audio = new MockMultipartFile("audio", "clip.wav", "audio/wav", "bytes".getBytes());
        when(restTemplate.postForEntity(
                eq("https://api.groq.com/openai/v1/audio/transcriptions"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"text\": \"helo morning\"}"));

        com.englishlearning.ai.service.SpeakingAiCoachingService coachingMock =
                org.mockito.Mockito.mock(com.englishlearning.ai.service.SpeakingAiCoachingService.class);
        service.setSpeakingAiCoachingService(coachingMock);
        when(coachingMock.generatePronunciationCoaching(any(PhoneticEvaluationResponse.class), eq("hello morning")))
                .thenReturn(com.englishlearning.ai.dto.AiCoachingAdvice.builder()
                        .summary("Phát âm tốt từ morning, cần làm rõ âm /h/ ở hello.")
                        .actionTips(java.util.List.of("Luyện lại từ hello."))
                        .generatedBy("GROQ_AI_COACH")
                        .build());

        PhoneticEvaluationResponse res = service.evaluatePronunciation(audio, "hello morning");

        assertThat(res.getAiCoaching()).isNotNull();
        assertThat(res.getAiCoaching().getGeneratedBy()).isEqualTo("GROQ_AI_COACH");
        assertThat(res.getAiCoaching().getSummary()).contains("morning");
    }
}
