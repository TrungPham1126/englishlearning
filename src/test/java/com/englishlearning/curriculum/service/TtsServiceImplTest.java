package com.englishlearning.curriculum.service;

import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.curriculum.service.impl.TtsServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TtsServiceImpl - Chuyển đổi giọng Kokoro-82M & chuẩn hóa tốc độ đọc")
class TtsServiceImplTest {

    @Mock
    private ExerciseAudioService exerciseAudioService;

    @InjectMocks
    private TtsServiceImpl ttsService;

    @Test
    @DisplayName("synthesizeAudio - Legacy voice, parse speed '1.25x' và trả về URL audio")
    void synthesizeAudio_validTextAndLegacyVoiceAndSpeed_delegatesNormalized() {
        when(exerciseAudioService.synthesizeRawScriptToUrl("Hello class!", "bm_george", 1.25))
                .thenReturn("https://cdn.example.com/audio/hello.wav");

        String url = ttsService.synthesizeAudio("Hello class!", "en-GB-RyanNeural", "1.25x");

        assertThat(url).isEqualTo("https://cdn.example.com/audio/hello.wav");
        verify(exerciseAudioService).synthesizeRawScriptToUrl("Hello class!", "bm_george", 1.25);
    }

    @Test
    @DisplayName("synthesizeAudio - Clamp speed biên dưới 0.5, biên trên 2.0 và fallback 1.0 khi invalid/null")
    void synthesizeAudio_speedBoundaryAndFallbackValues_clampedCorrectly() {
        when(exerciseAudioService.synthesizeRawScriptToUrl("A", "af_heart", 0.5)).thenReturn("/a.wav");
        when(exerciseAudioService.synthesizeRawScriptToUrl("B", "af_heart", 2.0)).thenReturn("/b.wav");
        when(exerciseAudioService.synthesizeRawScriptToUrl("C", "af_heart", 1.0)).thenReturn("/c.wav");

        assertThat(ttsService.synthesizeAudio("A", null, "0.1X")).isEqualTo("/a.wav");
        assertThat(ttsService.synthesizeAudio("B", "unknown_voice", "3.5x")).isEqualTo("/b.wav");
        assertThat(ttsService.synthesizeAudio("C", "af_heart", "fast")).isEqualTo("/c.wav");
        assertThat(ttsService.synthesizeAudio("C", "af_heart", "   ")).isEqualTo("/c.wav");

        verify(exerciseAudioService, times(2)).synthesizeRawScriptToUrl("C", "af_heart", 1.0);
    }

    @Test
    @DisplayName("synthesizeAudio - Text null hoặc blank ném IllegalArgumentException")
    void synthesizeAudio_nullOrBlankText_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> ttsService.synthesizeAudio(null, "af_heart", "1.0x"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("không được để trống");

        assertThatThrownBy(() -> ttsService.synthesizeAudio("   ", "af_heart", "1.0x"))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(exerciseAudioService);
    }
}
