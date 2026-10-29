package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.*;

import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.service.TtsAudioService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExerciseGenerationServiceImpl implements ExerciseGenerationService {

    private final GeminiClientService geminiClientService;
    private final TtsAudioService ttsAudioService;
    private final AiGeneratedExerciseRepository aiGeneratedExerciseRepository;
    private final TeacherRepository teacherRepository;
    private final ObjectMapper objectMapper;

    private static final String EXERCISE_GEN_SYSTEM_INSTRUCTION = """
            You are an expert Cambridge English test author.
            Generate English exercise questions based on the teacher's prompt and CEFR level.
            Return strictly valid JSON with format:
            {
               "questions": [
                  {
                     "promptText": "Question prompt here",
                     "questionType": "MULTIPLE_CHOICE",
                     "options": ["A", "B", "C", "D"],
                     "correctAnswer": "A",
                     "explanation": "Explanation here"
                  }
               ]
            }
            """;

    @Override
    @Transactional
    public AiGeneratedExercise generateQuestionsFromPrompt(
            String prompt,
            String targetCefr,
            int questionCount,
            UUID teacherId,
            boolean generateAudio) {

        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin giảng viên với ID: " + teacherId));

        String userPrompt = String.format("""
                Topic/Prompt: "%s"
                Target CEFR: %s
                Question Count: %d
                Generate high quality questions with options and explanation.
                """, prompt, targetCefr != null ? targetCefr : "B1", questionCount);

        log.info("Gọi Gemini AI sinh {} câu hỏi CEFR {} cho giảng viên {}", questionCount, targetCefr, teacherId);
        String aiRawResponse = geminiClientService.generateWithSystemInstruction(
                EXERCISE_GEN_SYSTEM_INSTRUCTION, userPrompt);
        String cleanJson = GeminiClientService.stripMarkdown(aiRawResponse);

        String finalResponseJson = cleanJson;

        if (generateAudio) {
            try {
                JsonNode root = objectMapper.readTree(cleanJson);
                if (root.has("questions") && root.get("questions").isArray()) {
                    ArrayNode questionsArray = (ArrayNode) root.get("questions");
                    for (JsonNode qNode : questionsArray) {
                        if (qNode.isObject() && qNode.has("promptText")) {
                            String promptText = qNode.get("promptText").asText();
                            String audioUrl = ttsAudioService.synthesizeTtsAudio(promptText, "af_heart");
                            ((ObjectNode) qNode).put("mediaUrl", audioUrl);
                        }
                    }
                    finalResponseJson = objectMapper.writeValueAsString(root);
                }
            } catch (Exception ex) {
                log.warn("Không thể tổng hợp TTS cho một số câu hỏi: {}", ex.getMessage());
            }
        }

        AiGeneratedExercise exercise = AiGeneratedExercise.builder()
                .teacher(teacher)
                .targetCefr(targetCefr != null ? targetCefr : "B1")
                .exerciseType("SMART_GENERATION")
                .questionCount(questionCount)
                .rawResponseJson(finalResponseJson)
                .status(GenerationStatus.READY_FOR_REVIEW)
                .build();

        exercise = aiGeneratedExerciseRepository.save(exercise);
        log.info("Lưu thành công đề bài AI sinh: ID = {}", exercise.getId());
        return exercise;
    }
}
