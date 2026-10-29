package com.englishlearning.ai.service;

import com.englishlearning.ai.service.impl.ExerciseGenerationServiceImpl;

import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.curriculum.service.TtsAudioService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ExerciseGenerationServiceImpl - Tạo đề bài thông minh bằng AI & Tự động sinh audio TTS")
class ExerciseGenerationServiceImplTest {

    @Mock
    private GeminiClientService geminiClientService;

    @Mock
    private TtsAudioService ttsAudioService;

    @Mock
    private AiGeneratedExerciseRepository aiGeneratedExerciseRepository;

    @Mock
    private TeacherRepository teacherRepository;

    private ObjectMapper objectMapper;
    private ExerciseGenerationServiceImpl exerciseGenerationService;

    private final UUID teacherId = UUID.fromString("55555555-5555-5555-5555-555555555555");

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        exerciseGenerationService = new ExerciseGenerationServiceImpl(
                geminiClientService,
                ttsAudioService,
                aiGeneratedExerciseRepository,
                teacherRepository,
                objectMapper
        );
    }

    @Test
    @DisplayName("Sinh câu hỏi bằng AI và tự động tổng hợp âm thanh TTS khi giáo viên yêu cầu tạo đề nghe")
    void should_GenerateQuestionsFromPrompt_and_SynthesizeTtsAudio_when_TeacherRequestsSmartGeneration() {
        // Given
        Teacher teacher = new Teacher();
        teacher.setId(teacherId);
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(teacher));

        // json-serialization.md: Dùng explicit JSON string literal
        String geminiGeneratedJson = """
                {
                   "questions": [
                      {
                         "promptText": "Listen to the conversation and choose the correct answer.",
                         "questionType": "LISTENING",
                         "options": ["At the airport", "In a restaurant", "At the library", "In a hospital"],
                         "correctAnswer": "At the airport",
                         "explanation": "The audio mentions boarding gates and passports."
                      }
                   ]
                }
                """;

        when(geminiClientService.generateWithSystemInstruction(any(), any()))
                .thenReturn(geminiGeneratedJson);

        when(ttsAudioService.synthesizeTtsAudio(
                eq("Listen to the conversation and choose the correct answer."),
                eq("af_heart"))
        ).thenReturn("https://cdn.englishlearning.com/tts/listening_q1.wav");

        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        AiGeneratedExercise result = exerciseGenerationService.generateQuestionsFromPrompt(
                "Create 1 listening exercise about travel",
                "B2",
                1,
                teacherId,
                true // Yêu cầu sinh âm thanh TTS
        );

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getTargetCefr()).isEqualTo("B2");
        assertThat(result.getQuestionCount()).isEqualTo(1);
        assertThat(result.getStatus()).isEqualTo(GenerationStatus.READY_FOR_REVIEW);

        // verify-relevant-arguments-only: Chỉ verify tham số prompt và voice
        verify(ttsAudioService, times(1)).synthesizeTtsAudio(
                eq("Listen to the conversation and choose the correct answer."),
                eq("af_heart")
        );

        ArgumentCaptor<AiGeneratedExercise> captor = ArgumentCaptor.forClass(AiGeneratedExercise.class);
        verify(aiGeneratedExerciseRepository, times(1)).save(captor.capture());
        AiGeneratedExercise savedExercise = captor.getValue();
        assertThat(savedExercise.getRawResponseJson()).contains("https://cdn.englishlearning.com/tts/listening_q1.wav");
        assertThat(savedExercise.getRawResponseJson()).contains("mediaUrl");
    }
}
