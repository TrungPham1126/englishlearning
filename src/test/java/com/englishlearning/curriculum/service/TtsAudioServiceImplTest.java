package com.englishlearning.curriculum.service;

import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.curriculum.service.impl.TtsAudioServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TtsAudioServiceImpl - Chuyển văn bản thành giọng nói (Text-to-Speech)")
class TtsAudioServiceImplTest {

    @Mock
    private ExerciseAudioService exerciseAudioService;

    private TtsAudioServiceImpl ttsAudioService;

    @BeforeEach
    void setUp() {
        ttsAudioService = new TtsAudioServiceImpl(exerciseAudioService);
    }

    @Test
    @DisplayName("Tổng hợp âm thanh TTS thành công khi văn bản và giọng đọc hợp lệ")
    void should_SynthesizeTtsAudio_when_TextAndVoiceAreValid() {
        // Given
        String text = "Please listen to the following conversation and answer questions 1 to 5.";
        String voice = "af_heart";
        String expectedUrl = "https://cdn.englishlearning.com/audio/exam_listening_01.wav";

        when(exerciseAudioService.synthesizeRawScriptToUrl(eq(text), eq("af_heart"), eq(1.0)))
                .thenReturn(expectedUrl);

        // When
        String resultUrl = ttsAudioService.synthesizeTtsAudio(text, voice);

        // Then
        assertThat(resultUrl).isEqualTo(expectedUrl);
        verify(exerciseAudioService, times(1))
                .synthesizeRawScriptToUrl(eq(text), eq("af_heart"), eq(1.0));
    }

    @Test
    @DisplayName("Ném IllegalArgumentException khi văn bản đầu vào trống hoặc null")
    void should_ThrowIllegalArgumentException_when_TextIsBlank() {
        // When & Then
        assertThatThrownBy(() -> ttsAudioService.synthesizeTtsAudio("   ", "af_heart"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("không được để trống");

        verifyNoInteractions(exerciseAudioService);
    }

    @Test
    @DisplayName("Chuẩn hóa giọng đọc rỗng về af_heart và ánh xạ legacy voice sang Kokoro")
    void synthesizeTtsAudio_blankAndLegacyVoices_normalizedCorrectly() {
        when(exerciseAudioService.synthesizeRawScriptToUrl("Hello", "af_heart", 1.0)).thenReturn("/default.wav");
        when(exerciseAudioService.synthesizeRawScriptToUrl("British", "bf_emma", 1.0)).thenReturn("/uk.wav");

        assertThat(ttsAudioService.synthesizeTtsAudio("Hello", null)).isEqualTo("/default.wav");
        assertThat(ttsAudioService.synthesizeTtsAudio("Hello", "   ")).isEqualTo("/default.wav");
        assertThat(ttsAudioService.synthesizeTtsAudio("British", "en-GB-SoniaNeural")).isEqualTo("/uk.wav");
    }

    @Test
    @DisplayName("synthesizeTtsAudioBytes - Trả UTF-8 bytes của URL hoặc mảng rỗng nếu URL null, và ném lỗi khi text rỗng")
    void synthesizeTtsAudioBytes_allBranches() {
        String url = "https://cdn.example.com/tts.wav";
        when(exerciseAudioService.synthesizeRawScriptToUrl("Read aloud", "af_heart", 1.0)).thenReturn(url);
        when(exerciseAudioService.synthesizeRawScriptToUrl("Silent", "af_heart", 1.0)).thenReturn(null);

        byte[] result = ttsAudioService.synthesizeTtsAudioBytes("Read aloud", null);
        assertThat(new String(result, StandardCharsets.UTF_8)).isEqualTo(url);

        assertThat(ttsAudioService.synthesizeTtsAudioBytes("Silent", "af_heart")).isEmpty();

        assertThatThrownBy(() -> ttsAudioService.synthesizeTtsAudioBytes(null, "af_heart"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
