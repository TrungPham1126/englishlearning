package com.englishlearning.ai.service;

import com.englishlearning.ai.service.impl.ExerciseGenerationServiceImpl;

import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.curriculum.service.TtsAudioService;
import com.fasterxml.jackson.databind.JsonNode;
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
                true
        );

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getTargetCefr()).isEqualTo("B2");
        assertThat(result.getQuestionCount()).isEqualTo(1);
        assertThat(result.getStatus()).isEqualTo(GenerationStatus.READY_FOR_REVIEW);

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

    @Test
    @DisplayName("Sinh bài tập nối từ MATCHING chuyên biệt - trả về các cặp 1-1, không sinh đáp án gây nhiễu A, B, C, D")
    void should_GenerateMatchingExercise_WithCleanPairsAndZeroDistractors_when_MatchingTypeRequested() {
        // Given
        Teacher teacher = new Teacher();
        teacher.setId(teacherId);
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(teacher));

        String geminiMatchingJson = """
                {
                   "title": "Family Vocabulary Matching",
                   "type": "MATCHING",
                   "pairs": [
                      {
                         "id": "1",
                         "word": "father",
                         "ipa": "/ˈfɑːðər/",
                         "meaning": "A male parent of a child"
                      },
                      {
                         "id": "2",
                         "word": "mother",
                         "ipa": "/ˈmʌðər/",
                         "meaning": "A female parent of a child"
                      }
                   ]
                }
                """;

        ArgumentCaptor<String> sysInstructionCaptor = ArgumentCaptor.forClass(String.class);
        when(geminiClientService.generateWithSystemInstruction(sysInstructionCaptor.capture(), any()))
                .thenReturn(geminiMatchingJson);

        when(ttsAudioService.synthesizeTtsAudio(eq("father"), eq("af_heart")))
                .thenReturn("https://cdn.englishlearning.com/tts/father.mp3");
        when(ttsAudioService.synthesizeTtsAudio(eq("mother"), eq("af_heart")))
                .thenReturn("https://cdn.englishlearning.com/tts/mother.mp3");

        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        AiGeneratedExercise result = exerciseGenerationService.generateQuestionsFromPrompt(
                "Create matching exercise for family members",
                "A1",
                2,
                teacherId,
                true,
                QuestionType.MATCHING
        );

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getTargetCefr()).isEqualTo("A1");
        assertThat(result.getStatus()).isEqualTo(GenerationStatus.READY_FOR_REVIEW);

        // System prompt phải là prompt chuyên biệt cho MATCHING
        String systemInstructionUsed = sysInstructionCaptor.getValue();
        assertThat(systemInstructionUsed).contains("Vocabulary Matching Exercise");
        assertThat(systemInstructionUsed).contains("Tuyệt đối KHÔNG sinh các phương án lựa chọn gây nhiễu A, B, C, D");

        // Verify JSON kết quả chứa cả pairs và questions đồng bộ
        String rawJson = result.getRawResponseJson();
        assertThat(rawJson).contains("\"type\":\"MATCHING\"");
        assertThat(rawJson).contains("\"pairs\":");
        assertThat(rawJson).contains("\"questions\":");
        assertThat(rawJson).contains("father");
        assertThat(rawJson).contains("A male parent of a child");

        // Option chứa đúng từ và định nghĩa matchText, không có đáp án gây nhiễu
        assertThat(rawJson).contains("\"matchText\":\"A male parent of a child\"");
        assertThat(rawJson).contains("\"optionText\":\"father\"");

        // TTS audio được sinh cho từng từ
        verify(ttsAudioService, times(1)).synthesizeTtsAudio(eq("father"), eq("af_heart"));
        verify(ttsAudioService, times(1)).synthesizeTtsAudio(eq("mother"), eq("af_heart"));
    }

    @Test
    @DisplayName("Ném ResourceNotFoundException khi thiếu giảng viên; overload 5 tham số tự nhận diện 'nối từ' & chịu lỗi TTS")
    void should_Throw404WhenTeacherMissing_detectVietnameseMatchingAndTolerateTtsErrors() {
        UUID unknownTeacher = UUID.randomUUID();
        when(teacherRepository.findById(unknownTeacher)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                exerciseGenerationService.generateQuestionsFromPrompt("Grammar", "B1", 3, unknownTeacher, false))
                .isInstanceOf(com.englishlearning.common.exception.ResourceNotFoundException.class)
                .hasMessageContaining("Không tìm thấy thông tin giảng viên");

        // Overload 5 tham số: tự nhận diện prompt có "nối từ" & generateAudio=false
        Teacher teacher = Teacher.builder().id(teacherId).build();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(teacher));
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                .thenReturn("{\"pairs\":[{\"word\":\"book\",\"meaning\":\"A set of pages\"}]}");
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        AiGeneratedExercise vnMatching = exerciseGenerationService.generateQuestionsFromPrompt(
                "Tạo bài tập nối từ chủ đề trường học", "A1", 0, teacherId, false);
        assertThat(vnMatching.getRawResponseJson()).contains("\"type\":\"MATCHING\"");
        verifyNoInteractions(ttsAudioService);

        // MULTIPLE_CHOICE với TTS bị lỗi vẫn hoàn tất lưu bài tập
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                .thenReturn("{\"questions\":[{\"promptText\":\"Listen closely\",\"questionType\":\"LISTENING\"}]}");
        when(ttsAudioService.synthesizeTtsAudio(anyString(), anyString()))
                .thenThrow(new RuntimeException("TTS offline"));

        AiGeneratedExercise mcRes = exerciseGenerationService.generateQuestionsFromPrompt(
                "Listening unit 2", "B1", 1, teacherId, true, QuestionType.MULTIPLE_CHOICE);
        assertThat(mcRes.getStatus()).isEqualTo(GenerationStatus.READY_FOR_REVIEW);
    }

    @Test
    @DisplayName("MATCHING: kẹp số cặp [5..8], mặc định CEFR='B1', chuẩn hóa explanation theo IPA & giữ audio cặp khác khi TTS lỗi một phần")
    void generateQuestionsFromPrompt_matchingClampsCountDefaultsCefrFormatsExplanationAndToleratesPartialTtsError() throws Exception {
        Teacher teacher = Teacher.builder().id(teacherId).build();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(teacher));
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // 1. questionCount=2 -> clamp lên 5, targetCefr=null -> mặc định B1, TTS pair 1 lỗi vẫn sinh TTS pair 2 & đủ 3 nhánh explanation
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                .thenReturn("""
                        {
                          "pairs": [
                            {"id": "1", "word": "focus", "ipa": "/ˈfəʊ.kəs/", "meaning": "tập trung", "explanation": ""},
                            {"id": "2", "word": "effort", "ipa": "/ˈef.ət/", "meaning": "nỗ lực", "explanation": "Cố gắng hết sức"},
                            {"id": "3", "word": "goal", "ipa": "/ɡəʊl/", "meaning": "mục tiêu", "explanation": "/ɡəʊl/ (n): Mục tiêu học tập"}
                          ]
                        }
                        """);
        when(ttsAudioService.synthesizeTtsAudio(eq("focus"), eq("af_heart")))
                .thenThrow(new RuntimeException("TTS pair 1 failed"));
        when(ttsAudioService.synthesizeTtsAudio(eq("effort"), eq("af_heart")))
                .thenReturn("https://cdn.test/effort.wav");
        when(ttsAudioService.synthesizeTtsAudio(eq("goal"), eq("af_heart")))
                .thenReturn("https://cdn.test/goal.wav");

        AiGeneratedExercise lowClamp = exerciseGenerationService.generateQuestionsFromPrompt(
                "Vocabulary pairs", null, 2, teacherId, true, QuestionType.MATCHING);

        assertThat(lowClamp.getTargetCefr()).isEqualTo("B1");
        assertThat(lowClamp.getQuestionCount()).isEqualTo(5);
        assertThat(lowClamp.getExerciseType()).isEqualTo("MATCHING");

        JsonNode questions = objectMapper.readTree(lowClamp.getRawResponseJson()).path("questions");
        assertThat(questions).hasSize(3);
        assertThat(questions.get(0).path("explanation").asText()).isEqualTo("/ˈfəʊ.kəs/ - tập trung");
        assertThat(questions.get(0).has("mediaUrl")).isFalse();
        assertThat(questions.get(1).path("explanation").asText()).isEqualTo("/ˈef.ət/ | Cố gắng hết sức");
        assertThat(questions.get(1).path("mediaUrl").asText()).isEqualTo("https://cdn.test/effort.wav");
        assertThat(questions.get(2).path("explanation").asText()).isEqualTo("/ɡəʊl/ (n): Mục tiêu học tập");

        // 2. questionCount=12 -> clamp xuống 8
        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                .thenReturn("{\"pairs\":[{\"word\":\"study\",\"meaning\":\"học\"}]}");
        AiGeneratedExercise highClamp = exerciseGenerationService.generateQuestionsFromPrompt(
                "Education", "C1", 12, teacherId, false, QuestionType.MATCHING);
        assertThat(highClamp.getQuestionCount()).isEqualTo(8);
        assertThat(highClamp.getTargetCefr()).isEqualTo("C1");
    }

    @Test
    @DisplayName("MULTIPLE_CHOICE: bóc markdown code fence, vẫn gắn mediaUrl câu sau khi câu trước lỗi TTS & không gọi TTS khi generateAudio=false")
    void generateQuestionsFromPrompt_multipleChoiceStripsMarkdownAndPreservesOtherAudioOnPartialTtsError() throws Exception {
        Teacher teacher = Teacher.builder().id(teacherId).build();
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(teacher));
        when(aiGeneratedExerciseRepository.save(any(AiGeneratedExercise.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        when(geminiClientService.generateWithSystemInstruction(anyString(), anyString()))
                .thenReturn("""
                        ```json
                        {
                          "questions": [
                            {"promptText": "First sentence", "questionType": "MULTIPLE_CHOICE", "options": ["A", "B"], "correctAnswer": "A"},
                            {"promptText": "Second sentence", "questionType": "MULTIPLE_CHOICE", "options": ["C", "D"], "correctAnswer": "D"}
                          ]
                        }
                        ```
                        """);
        when(ttsAudioService.synthesizeTtsAudio(eq("First sentence"), eq("af_heart")))
                .thenThrow(new RuntimeException("TTS timeout on Q1"));
        when(ttsAudioService.synthesizeTtsAudio(eq("Second sentence"), eq("af_heart")))
                .thenReturn("https://cdn.test/q2.wav");

        AiGeneratedExercise partialTts = exerciseGenerationService.generateQuestionsFromPrompt(
                "Grammar practice", "B1", 2, teacherId, true, QuestionType.MULTIPLE_CHOICE);

        assertThat(partialTts.getExerciseType()).isEqualTo("SMART_GENERATION");
        JsonNode qArr = objectMapper.readTree(partialTts.getRawResponseJson()).path("questions");
        assertThat(qArr).hasSize(2);
        assertThat(qArr.get(0).has("mediaUrl")).isFalse();
        assertThat(qArr.get(1).path("mediaUrl").asText()).isEqualTo("https://cdn.test/q2.wav");

        // generateAudio=false -> không gọi TTS & giữ nguyên exerciseType=SMART_GENERATION
        reset(ttsAudioService);
        AiGeneratedExercise noAudio = exerciseGenerationService.generateQuestionsFromPrompt(
                "Grammar practice", "A2", 1, teacherId, false, QuestionType.MULTIPLE_CHOICE);
        assertThat(noAudio.getExerciseType()).isEqualTo("SMART_GENERATION");
        assertThat(noAudio.getTargetCefr()).isEqualTo("A2");
        verifyNoInteractions(ttsAudioService);
    }
}
