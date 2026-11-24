package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.dto.AiCoachingAdvice;
import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.service.GeminiClientService;
import com.englishlearning.ai.service.GroqClientService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SpeakingAiCoachingServiceImpl - Sinh lời khuyên AI từ dữ liệu chấm âm học Python & Whisper")
class SpeakingAiCoachingServiceImplTest {

    @Mock
    private GroqClientService groqClientService;

    @Mock
    private GeminiClientService geminiClientService;

    private SpeakingAiCoachingServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new SpeakingAiCoachingServiceImpl(groqClientService, geminiClientService, new ObjectMapper());
    }

    private ShadowingEvaluationResponse buildSampleAcousticResult() {
        return ShadowingEvaluationResponse.builder()
                .overallScore(68)
                .isPassed(false)
                .passScore(80)
                .statusMessage("Cần luyện thêm các âm cuối.")
                .evaluatedBy("PYTHON_ACOUSTIC_ENGINE")
                .kpi(ShadowingEvaluationResponse.KpiMetrics.builder()
                        .pronunciation(65)
                        .fluency(72)
                        .completeness(85)
                        .prosody(70)
                        .wordsPerMinute(115)
                        .build())
                .sentenceTokens(List.of(
                        ShadowingEvaluationResponse.SentenceToken.builder()
                                .word("Hello").color("GREEN").wordStatus("SPOKEN").hasLinkingAfter(true).build(),
                        ShadowingEvaluationResponse.SentenceToken.builder()
                                .word("world").color("RED").wordStatus("PARTIAL").hasPauseAfter(true).build(),
                        ShadowingEvaluationResponse.SentenceToken.builder()
                                .word("today").color("GRAY").wordStatus("MISSING").build()
                ))
                .wordRows(List.of(
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                .word("world").score(54).wordStatus("PARTIAL")
                                .phonemes(List.of(
                                        ShadowingEvaluationResponse.PhonemeItem.builder()
                                                .ipa("/ɜː/").score(48).note("Hạ lưỡi nhẹ hơn").build(),
                                        ShadowingEvaluationResponse.PhonemeItem.builder()
                                                .ipa("/d/").score(15).note("Bạn đã nuốt âm đuôi /d/").build()
                                )).build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                .word("today").score(0).wordStatus("MISSING")
                                .phonemes(List.of()).build()
                ))
                .build();
    }

    @Test
    @DisplayName("Groq thành công: truyền đủ dữ liệu âm học Python (từ yếu, IPA, WPM, từ bỏ sót) và gắn GROQ_AI_COACH")
    void generateShadowingCoaching_groqSuccess_includesAcousticDetails() {
        when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble()))
                .thenReturn("""
                        ```json
                        {
                          "summary": "Bạn nói nhịp ổn 115 WPM nhưng còn bỏ sót từ 'today' và nuốt âm đuôi từ 'world'.",
                          "actionTips": [
                            "Từ 'world' (54%): bật rõ âm đuôi /d/ và hạ lưỡi ở nguyên âm /ɜː/.",
                            "Đọc đủ từ 'today' ở cuối câu để nâng Completeness từ 85% lên 100%."
                          ],
                          "practiceDrill": "Đọc chậm cụm 'Hello world today' 5 lần, nhấn rõ âm /d/ cuối từ world."
                        }
                        ```
                        """);

        AiCoachingAdvice advice = service.generateShadowingCoaching(
                buildSampleAcousticResult(), "Hello world today", "SHADOWING");

        assertThat(advice).isNotNull();
        assertThat(advice.getGeneratedBy()).isEqualTo("GROQ_AI_COACH");
        assertThat(advice.getSummary()).contains("115 WPM");
        assertThat(advice.getActionTips()).hasSize(2);
        assertThat(advice.getPracticeDrill()).contains("Hello world today");

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(groqClientService).chatCompletionJson(anyString(), promptCaptor.capture(), anyDouble());
        String sentPrompt = promptCaptor.getValue();
        assertThat(sentPrompt).contains("68/100", "115 WPM", "world (54%)", "/d/ 15%", "today [BỎ SÓT]");
        verifyNoInteractions(geminiClientService);
    }

    @Test
    @DisplayName("Groq lỗi -> tự động fallback sang Gemini AI Coach")
    void generateShadowingCoaching_groqFails_fallsBackToGemini() {
        when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble()))
                .thenThrow(new RuntimeException("Groq 429 rate limit"));
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString(), anyDouble()))
                .thenReturn("""
                        {
                          "summary": "Cần đọc rõ âm đuôi /d/ của từ world.",
                          "actionTips": ["Chú ý đọc đủ từ today."],
                          "practiceDrill": "Lặp lại 'world - today' 3 lần."
                        }
                        """);

        AiCoachingAdvice advice = service.generateShadowingCoaching(
                buildSampleAcousticResult(), "Hello world today", "PART_2");

        assertThat(advice).isNotNull();
        assertThat(advice.getGeneratedBy()).isEqualTo("GEMINI_AI_COACH");
        assertThat(advice.getSummary()).contains("world");
    }

    @Test
    @DisplayName("Cả Groq và Gemini đều lỗi -> trả về null an toàn, không làm hỏng chấm điểm Python")
    void generateShadowingCoaching_bothFail_returnsNullGracefully() {
        when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble()))
                .thenThrow(new RuntimeException("Groq down"));
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString(), anyDouble()))
                .thenThrow(new RuntimeException("Gemini down"));

        AiCoachingAdvice advice = service.generateShadowingCoaching(
                buildSampleAcousticResult(), "Hello world today", "SHADOWING");

        assertThat(advice).isNull();
    }

    @Test
    @DisplayName("Luồng Whisper Pronunciation: tổng hợp từ sai/thiếu và sinh AiCoachingAdvice")
    void generatePronunciationCoaching_summarizesWeakAndMissedWords() {
        PhoneticEvaluationResponse resp = PhoneticEvaluationResponse.builder()
                .overallScore(72)
                .feedback("Đã phát âm đúng 2/3 từ.")
                .wordScores(List.of(
                        PhoneticEvaluationResponse.WordScore.builder()
                                .word("hello").score(100).isAccurate(true).note("Phát âm chuẩn xác").build(),
                        PhoneticEvaluationResponse.WordScore.builder()
                                .word("education").score(67).isAccurate(false).note("Cần tròn vành hơn").build(),
                        PhoneticEvaluationResponse.WordScore.builder()
                                .word("today").score(0).isAccurate(false).note("Đọc thiếu hoặc nuốt từ").build()
                ))
                .build();

        when(groqClientService.chatCompletionJson(anyString(), anyString(), anyDouble()))
                .thenReturn("""
                        {
                          "summary": "Bạn đọc tốt từ 'hello', cần cải thiện 'education' và tránh bỏ sót 'today'.",
                          "actionTips": ["Tách âm e-du-ca-tion rõ từng vần.", "Đọc trọn vẹn từ cuối 'today'."],
                          "practiceDrill": "Đọc chậm cụm 'education today' 3 lần."
                        }
                        """);

        AiCoachingAdvice advice = service.generatePronunciationCoaching(resp, "hello education today");

        assertThat(advice).isNotNull();
        assertThat(advice.getGeneratedBy()).isEqualTo("GROQ_AI_COACH");

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(groqClientService).chatCompletionJson(anyString(), promptCaptor.capture(), anyDouble());
        assertThat(promptCaptor.getValue()).contains("72/100", "education (67%", "today");
    }
}
