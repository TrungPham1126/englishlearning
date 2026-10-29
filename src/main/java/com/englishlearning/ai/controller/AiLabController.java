package com.englishlearning.ai.controller;

import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.service.AiLabService;
import com.englishlearning.ai.service.ShadowingService;
import com.englishlearning.ai.service.WhisperPronunciationService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiLabController {

        private final AiLabService aiLabService;

        @PostMapping(value = "/speaking/evaluate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @PreAuthorize("hasRole('STUDENT')")
        public ResponseEntity<ApiResponse<JsonNode>> evaluateSpeaking(
                        @RequestParam("topic") String topic,
                        @RequestParam(value = "audio", required = false) MultipartFile audio,
                        @RequestParam(value = "studentAnswerId", required = false) String studentAnswerIdStr) {
                UUID answerId = null;
                if (studentAnswerIdStr != null && !studentAnswerIdStr.isBlank()
                                && !"undefined".equalsIgnoreCase(studentAnswerIdStr)
                                && !"null".equalsIgnoreCase(studentAnswerIdStr)) {
                        try {
                                answerId = UUID.fromString(studentAnswerIdStr.trim());
                        } catch (IllegalArgumentException ignored) {
                        }
                }
                return ResponseEntity.ok(ApiResponse.success(
                                aiLabService.evaluateSpeakingTopic(topic, audio, answerId)));
        }

        @PostMapping("/writing/evaluate")
        @PreAuthorize("hasAnyRole('STUDENT', 'TEACHER')")
        public ResponseEntity<ApiResponse<JsonNode>> evaluateWriting(
                        @RequestParam("topic") String topic,
                        @RequestBody String essayText,
                        @RequestParam(value = "studentAnswerId", required = false) String studentAnswerIdStr) {
                UUID answerId = null;
                if (studentAnswerIdStr != null && !studentAnswerIdStr.isBlank()
                                && !"undefined".equalsIgnoreCase(studentAnswerIdStr)
                                && !"null".equalsIgnoreCase(studentAnswerIdStr)) {
                        try {
                                answerId = UUID.fromString(studentAnswerIdStr.trim());
                        } catch (IllegalArgumentException ignored) {
                        }
                }
                return ResponseEntity.ok(ApiResponse.success(
                                aiLabService.evaluateWriting(topic, essayText, answerId)));
        }

        @PostMapping("/exercise/generate-quiz")
        @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
        public ResponseEntity<ApiResponse<AiGeneratedExercise>> generateQuiz(
                        @RequestBody(required = false) String content,
                        @RequestParam(defaultValue = "B2") String targetCefr,
                        @RequestParam(defaultValue = "5") int count,
                        @RequestParam(value = "questionCount", required = false) Integer questionCount,
                        @RequestParam(value = "numQuestions", required = false) Integer numQuestions,
                        @RequestParam(value = "lessonId", required = false) String lessonIdStr,
                        @RequestParam(value = "exerciseType", defaultValue = "MULTIPLE_CHOICE") String exerciseType,
                        @RequestParam(value = "skillType", required = false) String skillType,
                        @RequestParam(value = "assignmentType", required = false) String assignmentType,
                        @AuthenticationPrincipal CustomUserDetails userDetails) {
                int effectiveCount = count;
                if (questionCount != null && questionCount > 0) {
                        effectiveCount = questionCount;
                } else if (numQuestions != null && numQuestions > 0) {
                        effectiveCount = numQuestions;
                }
                UUID lessonId = null;
                if (lessonIdStr != null && !lessonIdStr.isBlank()
                                && !"undefined".equalsIgnoreCase(lessonIdStr)
                                && !"null".equalsIgnoreCase(lessonIdStr)) {
                        try {
                                lessonId = UUID.fromString(lessonIdStr.trim());
                        } catch (IllegalArgumentException ignored) {
                        }
                }
                String safeContent = (content != null && !content.isBlank()) ? content.trim()
                                : "General English Practice";
                String targetSkill = (skillType != null && !skillType.isBlank()) ? skillType
                                : (assignmentType != null && !assignmentType.isBlank()) ? assignmentType : null;
                return ResponseEntity.ok(ApiResponse.success(
                                aiLabService.generateQuizFromContent(safeContent, targetCefr, effectiveCount,
                                                userDetails.getId(),
                                                lessonId, exerciseType, targetSkill)));
        }

        @PostMapping("/exercise/{id}/publish")
        @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
        public ResponseEntity<ApiResponse<com.englishlearning.assignment.entity.Assignment>> publishExercise(
                        @PathVariable UUID id, @RequestParam UUID classroomId) {
                return ResponseEntity.ok(ApiResponse.success("Xuất bản thành công",
                                aiLabService.publishExerciseToAssignment(id, classroomId)));
        }

        private final ShadowingService shadowingService;

        @PostMapping(value = "/speaking/shadowing-evaluate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @PreAuthorize("hasRole('STUDENT')")
        public ResponseEntity<ApiResponse<ShadowingEvaluationResponse>> evaluateShadowingSentence(
                        @RequestParam(value = "audio", required = false) MultipartFile audio,
                        @RequestParam(value = "studentAnswerId", required = false) String studentAnswerId,
                        @RequestParam(value = "referenceSentence", required = false) String referenceSentence) {

                UUID answerId = null;
                if (studentAnswerId != null && !studentAnswerId.isBlank()
                                && !"undefined".equalsIgnoreCase(studentAnswerId)
                                && !"null".equalsIgnoreCase(studentAnswerId)) {
                        try {
                                answerId = UUID.fromString(studentAnswerId.trim());
                        } catch (IllegalArgumentException ignored) {
                                // Bỏ qua nếu chuỗi truyền lên không phải UUID hợp lệ
                        }
                }

                ShadowingEvaluationResponse result = shadowingService.evaluateShadowing(audio, answerId,
                                referenceSentence);
                return ResponseEntity.ok(ApiResponse.success("Đánh giá bài Shadowing thành công", result));
        }

        private final WhisperPronunciationService whisperPronunciationService;

        @PostMapping(value = "/pronunciation/whisper-evaluate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @PreAuthorize("hasRole('STUDENT')")
        public ResponseEntity<ApiResponse<PhoneticEvaluationResponse>> evaluatePronunciation(
                        @RequestParam("audio") MultipartFile audio,
                        @RequestParam("referenceText") String referenceText) {

                PhoneticEvaluationResponse result = whisperPronunciationService.evaluatePronunciation(audio,
                                referenceText);
                return ResponseEntity.ok(ApiResponse.success("Đánh giá phát âm thành công", result));
        }

        /*
         * private final com.englishlearning.ai.service.PythonIntegrationService
         * pythonIntegrationService;
         * 
         * @PostMapping(value = "/python/shadowing-evaluate", consumes =
         * MediaType.MULTIPART_FORM_DATA_VALUE)
         * 
         * @PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
         * public ResponseEntity<ApiResponse<JsonNode>> evaluateAudioWithPython(
         * 
         * @RequestParam("audio") MultipartFile audio,
         * 
         * @RequestParam("referenceText") String referenceText) {
         * 
         * // Gọi tới hàm mình vừa tạo để chạy file Python
         * // JsonNode result = pythonIntegrationService.evaluateAudioViaPython(audio,
         * referenceText);
         * // return ResponseEntity.ok(ApiResponse.
         * success("Chấm điểm bằng mô hình Python Local thành công", result));
         * return null;
         * }
         */

        @lombok.Data
        public static class ReadingEvaluationRequest {
                private String passage;
                private String question;
                private String studentAnswer;
                private String expectedAnswer;
        }

        @PostMapping("/reading/evaluate-short-answer")
        @PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
        public ResponseEntity<ApiResponse<JsonNode>> evaluateReadingShortAnswer(
                        @RequestBody ReadingEvaluationRequest request) {
                return ResponseEntity.ok(ApiResponse.success(
                                "Đánh giá Reading câu trả lời ngắn thành công",
                                aiLabService.evaluateReadingShortAnswer(
                                                request.getPassage(),
                                                request.getQuestion(),
                                                request.getStudentAnswer(),
                                                request.getExpectedAnswer())));
        }
}
