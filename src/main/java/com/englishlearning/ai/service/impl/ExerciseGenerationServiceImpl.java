package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.*;
import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.assignment.entity.QuestionType;
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

    private static final String MATCHING_SYSTEM_INSTRUCTION = """
            Bạn là chuyên gia giáo dục tiếng Anh Cambridge/IELTS. Nhiệm vụ của bạn là tạo một bài tập nối từ vựng (Vocabulary Matching Exercise).
            Yêu cầu:
            - Từ vựng và định nghĩa PHẢI phù hợp 100% với trình độ CEFR được yêu cầu (A1/A2 dùng từ vựng cơ bản kèm nghĩa tiếng Việt ngắn gọn; B1/B2/C1 dùng từ học thuật/ngữ cảnh phù hợp kèm nghĩa tiếng Việt + định nghĩa tiếng Anh súc tích).
            - Tạo đúng từ 5 đến 8 cặp từ vựng - nghĩa đối ứng 1-1 duy nhất theo chủ đề được yêu cầu.
            - Mỗi cặp gồm: word (từ vựng), ipa (phiên âm chuẩn quốc tế), meaning (nghĩa ngắn gọn rõ ràng, không chứa từ khóa gốc), explanation (giải thích từ loại, IPA và 1 câu ví dụ chuẩn ngữ pháp bằng tiếng Việt/Anh).
            - Tuyệt đối KHÔNG sinh các phương án lựa chọn gây nhiễu A, B, C, D cho từng từ.
            - Định dạng trả về BẮT BUỘC là JSON hợp lệ theo schema sau (không thêm markdown ngoài khối JSON):
            {
              "title": "Tên bài tập",
              "type": "MATCHING",
              "pairs": [
                {
                  "id": "1",
                  "word": "library",
                  "ipa": "/ˈlaɪ.brər.i/",
                  "meaning": "(n) Thư viện - nơi đọc và mượn sách",
                  "explanation": "/ˈlaɪ.brər.i/ (n): Thư viện. Ví dụ: Students borrow books from the library."
                },
                {
                  "id": "2",
                  "word": "schedule",
                  "ipa": "/ˈskedʒ.uːl/",
                  "meaning": "(n) Lịch trình, thời khóa biểu",
                  "explanation": "/ˈskedʒ.uːl/ (n): Lịch trình. Ví dụ: She checks her work schedule every morning."
                }
              ]
            }
            """;

    private static final String EXERCISE_GEN_SYSTEM_INSTRUCTION = """
            You are an expert Cambridge English test author.
            Generate English exercise questions strictly calibrated to the requested CEFR level (A1, A2, B1, B2, C1, or IELTS).
            CRITICAL RULES:
            - Every sentence, option, and answer MUST be 100% grammatically accurate with zero ambiguities.
            - All 4 options in "options" MUST be distinct and MUST NOT include "A. ", "B. ", "C. ", "D. " prefixes.
            - "correctAnswer" MUST be an exact character-for-character match with one element in "options".
            - "explanation" MUST be written in clear Vietnamese explaining the correct answer, grammar/vocabulary rule, and why the other distractors are wrong.
            Return strictly valid JSON with format:
            {
               "questions": [
                  {
                     "promptText": "Question prompt here (include '______' if sentence gap-fill)",
                     "questionType": "MULTIPLE_CHOICE",
                     "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                     "correctAnswer": "Option 1",
                     "explanation": "Giải thích chi tiết bằng tiếng Việt"
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

        boolean isMatching = prompt != null && (
                prompt.toUpperCase().contains("MATCHING") ||
                prompt.toLowerCase().contains("nối từ") ||
                prompt.toLowerCase().contains("ghép cặp") ||
                prompt.toLowerCase().contains("match words")
        );

        QuestionType qType = isMatching ? QuestionType.MATCHING : QuestionType.MULTIPLE_CHOICE;
        return generateQuestionsFromPrompt(prompt, targetCefr, questionCount, teacherId, generateAudio, qType);
    }

    @Override
    @Transactional
    public AiGeneratedExercise generateQuestionsFromPrompt(
            String prompt,
            String targetCefr,
            int questionCount,
            UUID teacherId,
            boolean generateAudio,
            QuestionType questionType) {

        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin giảng viên với ID: " + teacherId));

        boolean isMatching = (questionType == QuestionType.MATCHING) ||
                (prompt != null && (
                        prompt.toUpperCase().contains("MATCHING") ||
                        prompt.toLowerCase().contains("nối từ") ||
                        prompt.toLowerCase().contains("ghép cặp") ||
                        prompt.toLowerCase().contains("match words")
                ));

        if (isMatching) {
            int pairCount = Math.max(5, Math.min(8, questionCount > 0 ? questionCount : 6));
            String userPrompt = String.format("""
                    Chủ đề yêu cầu: "%s"
                    Trình độ CEFR: %s
                    Số lượng cặp từ vựng: %d
                    Hãy tạo bài tập nối từ vựng đối ứng 1-1 chính xác, không tạo các lựa chọn trắc nghiệm A, B, C, D.
                    """, prompt, targetCefr != null ? targetCefr : "B1", pairCount);

            log.info("Gọi Gemini AI sinh bài tập MATCHING {} cặp, CEFR {} cho giảng viên {}", pairCount, targetCefr, teacherId);
            String aiRawResponse = geminiClientService.generateWithSystemInstruction(MATCHING_SYSTEM_INSTRUCTION, userPrompt);
            String cleanJson = GeminiClientService.stripMarkdown(aiRawResponse);

            String finalResponseJson = cleanJson;
            try {
                JsonNode root = objectMapper.readTree(cleanJson);
                if (root.isObject()) {
                    ObjectNode rootObj = (ObjectNode) root;
                    rootObj.put("type", "MATCHING");

                    JsonNode pairsNode = rootObj.path("pairs");
                    if (pairsNode.isArray() && pairsNode.size() > 0) {
                        ArrayNode questionsArray = objectMapper.createArrayNode();
                        int idx = 1;
                        for (JsonNode pairNode : pairsNode) {
                            String word = pairNode.path("word").asText("");
                            String ipa = pairNode.path("ipa").asText("");
                            String meaning = pairNode.path("meaning").asText("");
                            String pId = pairNode.path("id").asText(String.valueOf(idx));

                            if (generateAudio && !word.isBlank() && pairNode.isObject()) {
                                try {
                                    String audioUrl = ttsAudioService.synthesizeTtsAudio(word, "af_heart");
                                    ((ObjectNode) pairNode).put("mediaUrl", audioUrl);
                                } catch (Exception ex) {
                                    log.warn("Lỗi sinh audio TTS cho từ {}: {}", word, ex.getMessage());
                                }
                            }

                            ObjectNode qNode = objectMapper.createObjectNode();
                            qNode.put("id", pId);
                            qNode.put("orderIndex", idx);
                            qNode.put("questionType", "MATCHING");
                            qNode.put("prompt", word);
                            qNode.put("promptText", word);
                            qNode.put("word", word);
                            qNode.put("targetWord", word);
                            qNode.put("ipa", ipa);
                            qNode.put("correctAnswer", meaning);
                            qNode.put("matchText", meaning);
                            qNode.put("meaning", meaning);
                            String expl = pairNode.path("explanation").asText("").trim();
                            String defaultExpl = !ipa.isBlank() ? (ipa + " - " + meaning) : meaning;
                            qNode.put("explanation", expl.isBlank() ? defaultExpl : (!ipa.isBlank() && !expl.contains(ipa) ? ipa + " | " + expl : expl));

                            ArrayNode optArr = qNode.putArray("options");
                            ObjectNode optObj = optArr.addObject();
                            optObj.put("id", pId);
                            optObj.put("optionLabel", "A");
                            optObj.put("optionText", word);
                            optObj.put("matchText", meaning);
                            optObj.put("isCorrect", true);
                            if (pairNode.hasNonNull("mediaUrl")) {
                                qNode.put("mediaUrl", pairNode.get("mediaUrl").asText());
                            }
                            questionsArray.add(qNode);
                            idx++;
                        }
                        rootObj.set("questions", questionsArray);
                        finalResponseJson = objectMapper.writeValueAsString(rootObj);
                    }
                }
            } catch (Exception ex) {
                log.warn("Lỗi chuẩn hóa cấu trúc JSON bài tập MATCHING: {}", ex.getMessage());
            }

            AiGeneratedExercise exercise = AiGeneratedExercise.builder()
                    .teacher(teacher)
                    .targetCefr(targetCefr != null ? targetCefr : "B1")
                    .exerciseType("MATCHING")
                    .questionCount(pairCount)
                    .rawResponseJson(finalResponseJson)
                    .status(GenerationStatus.READY_FOR_REVIEW)
                    .build();

            exercise = aiGeneratedExerciseRepository.save(exercise);
            log.info("Lưu thành công bài tập MATCHING AI sinh: ID = {}", exercise.getId());
            return exercise;
        }

        // Luồng mặc định (Trắc nghiệm MULTIPLE_CHOICE)
        String userPrompt = String.format("""
                Topic/Prompt: "%s"
                Target CEFR: %s
                Question Count: %d
                Generate high quality questions with options and explanation.
                """, prompt, targetCefr != null ? targetCefr : "B1", questionCount);

        log.info("Gọi Gemini AI sinh {} câu hỏi trắc nghiệm CEFR {} cho giảng viên {}", questionCount, targetCefr, teacherId);
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
                            String audioUrl = null;
                            try {
                                audioUrl = ttsAudioService.synthesizeTtsAudio(promptText, "af_heart");
                            } catch (Exception ttsEx) {
                                log.warn("Lỗi sinh TTS cho câu hỏi '{}': {}", promptText, ttsEx.getMessage());
                            }
                            if (audioUrl != null && !audioUrl.isBlank()) {
                                ((ObjectNode) qNode).put("mediaUrl", audioUrl);
                            }
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
