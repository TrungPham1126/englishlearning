package com.englishlearning.ai.controller;

import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.service.AiLabService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
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
            @RequestParam("audio") MultipartFile audio,
            @RequestParam("studentAnswerId") UUID studentAnswerId) {
        return ResponseEntity.ok(ApiResponse.success(
                aiLabService.evaluateSpeakingTopic(topic, audio, studentAnswerId)
        ));
    }

    @PostMapping("/writing/evaluate")
    @PreAuthorize("hasAnyRole('STUDENT', 'TEACHER')")
    public ResponseEntity<ApiResponse<JsonNode>> evaluateWriting(
            @RequestParam("topic") String topic,
            @RequestBody String essayText,
            @RequestParam("studentAnswerId") UUID studentAnswerId) {
        return ResponseEntity.ok(ApiResponse.success(
                aiLabService.evaluateWriting(topic, essayText, studentAnswerId)
        ));
    }

    @PostMapping("/exercise/generate-quiz")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<AiGeneratedExercise>> generateQuiz(
            @RequestBody String content,
            @RequestParam(defaultValue = "B2") String targetCefr,
            @RequestParam(defaultValue = "5") int count,
            @RequestParam("lessonId") UUID lessonId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success(
                aiLabService.generateQuizFromContent(content, targetCefr, count, userDetails.getId(), lessonId)
        ));
    }
}