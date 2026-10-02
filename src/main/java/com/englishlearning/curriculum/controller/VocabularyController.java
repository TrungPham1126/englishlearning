package com.englishlearning.curriculum.controller;

import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.curriculum.dto.VocabularyRequest;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.service.VocabularyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/curriculum")
@RequiredArgsConstructor
@Tag(name = "Vocabulary", description = "Quản lý từ vựng của bài học")
public class VocabularyController {

    private final VocabularyService vocabularyService;

    @GetMapping("/lessons/{lessonId}/vocabularies")
    @Operation(summary = "Lấy danh sách từ vựng của bài học")
    public ResponseEntity<ApiResponse<List<VocabularyResponse>>> getVocabulariesByLesson(
            @PathVariable UUID lessonId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách từ vựng thành công",
                vocabularyService.getVocabulariesByLesson(lessonId)));
    }

    @PostMapping("/lessons/{lessonId}/vocabularies")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Thêm từ vựng mới vào bài học (Tự động crawl Audio/IPA)")
    public ResponseEntity<ApiResponse<VocabularyResponse>> addVocabulary(
            @PathVariable UUID lessonId,
            @Valid @RequestBody VocabularyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        "Thêm từ vựng thành công",
                        vocabularyService.addVocabulary(lessonId, request)));
    }

    @PutMapping("/vocabularies/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Cập nhật từ vựng")
    public ResponseEntity<ApiResponse<VocabularyResponse>> updateVocabulary(
            @PathVariable UUID id,
            @Valid @RequestBody VocabularyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật từ vựng thành công",
                vocabularyService.updateVocabulary(id, request)));
    }

    @DeleteMapping("/vocabularies/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Xóa từ vựng")
    public ResponseEntity<ApiResponse<Void>> deleteVocabulary(
            @PathVariable UUID id) {
        vocabularyService.deleteVocabulary(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa từ vựng thành công", null));
    }
}