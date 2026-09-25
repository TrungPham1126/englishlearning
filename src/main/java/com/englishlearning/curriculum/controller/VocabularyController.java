package com.englishlearning.curriculum.controller;

import com.englishlearning.curriculum.dto.VocabularyRequest;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.service.VocabularyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/curriculum/lessons/{lessonId}/vocabularies")
@RequiredArgsConstructor
@Tag(name = "Vocabulary Management", description = "Các API Quản lý Từ vựng trong Bài học")
public class VocabularyController {

    private final VocabularyService vocabularyService;

    @PostMapping
    @Operation(summary = "Thêm từ vựng mới vào bài học")
    public ResponseEntity<VocabularyResponse> addVocabulary(
            @PathVariable UUID lessonId,
            @Valid @RequestBody VocabularyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(vocabularyService.addVocabulary(lessonId, request));
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách từ vựng của một bài học")
    public ResponseEntity<List<VocabularyResponse>> getVocabularies(@PathVariable UUID lessonId) {
        return ResponseEntity.ok(vocabularyService.getVocabulariesByLesson(lessonId));
    }
}