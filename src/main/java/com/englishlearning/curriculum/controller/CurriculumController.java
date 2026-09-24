package com.englishlearning.curriculum.controller;

import com.englishlearning.curriculum.dto.DocumentResponse;
import com.englishlearning.curriculum.dto.LessonRequest;
import com.englishlearning.curriculum.dto.LessonResponse;
import com.englishlearning.curriculum.service.CurriculumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/curriculum")
@RequiredArgsConstructor
@Tag(name = "Curriculum Management", description = "Các API Quản lý giáo trình, bài học và tài liệu đính kèm")
public class CurriculumController {

    private final CurriculumService curriculumService;

    @PostMapping("/lessons")
    @Operation(summary = "Tạo bài học mới cho lớp học")
    public ResponseEntity<LessonResponse> createLesson(@Valid @RequestBody LessonRequest request) {
        LessonResponse response = curriculumService.createLesson(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/classes/{classId}/lessons")
    @Operation(summary = "Lấy toàn bộ danh sách bài học của một lớp (đã sắp xếp)")
    public ResponseEntity<List<LessonResponse>> getLessonsByClass(@PathVariable UUID classId) {
        List<LessonResponse> lessons = curriculumService.getLessonsByClass(classId);
        return ResponseEntity.ok(lessons);
    }

    @PostMapping(value = "/lessons/{lessonId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải lên tài liệu học tập (PDF, DOCX) đính kèm vào bài học")
    public ResponseEntity<DocumentResponse> uploadDocument(
            @PathVariable UUID lessonId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("fileType") String fileType) {
        DocumentResponse response = curriculumService.uploadLessonDocument(lessonId, file, fileType);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}