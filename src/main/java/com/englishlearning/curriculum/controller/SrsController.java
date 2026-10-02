package com.englishlearning.curriculum.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.service.SrsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/student/vocabularies")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class SrsController {
    private final SrsService srsService;

    @GetMapping("/due")
    public ResponseEntity<ApiResponse<PageResponse<VocabularyResponse>>> getDueFlashcards(
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(srsService.getDueVocabularies(user.getId(), limit)));
    }

    @PostMapping("/{id}/review")
    public ResponseEntity<ApiResponse<Void>> reviewFlashcard(
            @PathVariable UUID id,
            @RequestBody Map<String, Integer> request,
            @AuthenticationPrincipal CustomUserDetails user) {
        // grade: 0=Again, 1=Hard, 2=Good, 3=Easy
        srsService.reviewVocabulary(user.getId(), id, request.getOrDefault("grade", 1));
        return ResponseEntity.ok(ApiResponse.success("Đã ghi nhận kết quả ôn tập", null));
    }
}