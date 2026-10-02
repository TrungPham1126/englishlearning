package com.englishlearning.curriculum.controller;

import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.service.CurriculumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/curriculum")
@RequiredArgsConstructor
@Tag(name = "Curriculum Management", description = "Các API Quản lý giáo trình, bài học, tài liệu và ngữ pháp")
public class CurriculumController {

    private final CurriculumService curriculumService;

    // ==========================================
    // 1. QUẢN LÝ BÀI HỌC (LESSON)
    // ==========================================
    @PostMapping("/lessons")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Tạo bài học mới")
    public ResponseEntity<ApiResponse<LessonResponse>> createLesson(@Valid @RequestBody LessonRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Lesson created successfully", curriculumService.createLesson(request)));
    }

    @GetMapping("/classes/{classId}/lessons")
    @Operation(summary = "Lấy danh sách bài học của lớp")
    public ResponseEntity<ApiResponse<List<LessonResponse>>> getLessonsByClass(@PathVariable UUID classId) {
        return ResponseEntity.ok(
                ApiResponse.success("Lessons retrieved successfully", curriculumService.getLessonsByClass(classId)));
    }

    @GetMapping("/lessons/{id}")
    @Operation(summary = "Xem chi tiết bài học (kèm tài liệu, từ vựng, ngữ pháp)")
    public ResponseEntity<ApiResponse<LessonDetailResponse>> getLessonDetail(@PathVariable UUID id) {
        return ResponseEntity
                .ok(ApiResponse.success("Lesson detail retrieved successfully", curriculumService.getLessonDetail(id)));
    }

    @PutMapping("/lessons/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Cập nhật thông tin bài học")
    public ResponseEntity<ApiResponse<LessonResponse>> updateLesson(
            @PathVariable UUID id,
            @Valid @RequestBody LessonUpdateRequest request) {
        return ResponseEntity
                .ok(ApiResponse.success("Lesson updated successfully", curriculumService.updateLesson(id, request)));
    }

    @DeleteMapping("/lessons/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Xóa bài học")
    public ResponseEntity<ApiResponse<Void>> deleteLesson(@PathVariable UUID id) {
        curriculumService.deleteLesson(id);
        return ResponseEntity.ok(ApiResponse.success("Lesson deleted successfully", null));
    }

    // ==========================================
    // 2. QUẢN LÝ TÀI LIỆU BÀI HỌC (DOCUMENTS)
    // ==========================================
    @PostMapping(value = "/lessons/{lessonId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Tải tài liệu đính kèm (PDF, DOCX...)")
    public ResponseEntity<ApiResponse<DocumentResponse>> uploadDocument(
            @PathVariable UUID lessonId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("fileType") String fileType) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Document uploaded successfully",
                        curriculumService.uploadLessonDocument(lessonId, file, fileType)));
    }

    @GetMapping("/lessons/{lessonId}/documents")
    @Operation(summary = "Lấy danh sách tài liệu của bài học")
    public ResponseEntity<ApiResponse<List<DocumentResponse>>> getDocuments(@PathVariable UUID lessonId) {
        return ResponseEntity.ok(ApiResponse.success("Documents retrieved successfully",
                curriculumService.getDocumentsByLesson(lessonId)));
    }

    @DeleteMapping("/documents/{documentId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Xóa tài liệu bài học")
    public ResponseEntity<ApiResponse<Void>> deleteDocument(@PathVariable UUID documentId) {
        curriculumService.deleteDocument(documentId);
        return ResponseEntity.ok(ApiResponse.success("Document deleted successfully", null));
    }

    // ==========================================
    // 3. QUẢN LÝ NGỮ PHÁP (GRAMMAR TOPICS)
    // ==========================================
    @GetMapping("/lessons/{lessonId}/grammar")
    @Operation(summary = "Lấy danh sách chủ điểm ngữ pháp của bài học")
    public ResponseEntity<ApiResponse<List<GrammarTopicResponse>>> getGrammarTopics(@PathVariable UUID lessonId) {
        return ResponseEntity.ok(ApiResponse.success("Grammar topics retrieved successfully",
                curriculumService.getGrammarTopicsByLesson(lessonId)));
    }

    @PostMapping("/lessons/{lessonId}/grammar")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Thêm chủ điểm ngữ pháp vào bài học")
    public ResponseEntity<ApiResponse<GrammarTopicResponse>> addGrammarTopic(
            @PathVariable UUID lessonId,
            @Valid @RequestBody GrammarTopicRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Grammar topic added successfully",
                        curriculumService.addGrammarTopic(lessonId, request)));
    }

    @DeleteMapping("/grammar/{topicId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    @Operation(summary = "Xóa chủ điểm ngữ pháp")
    public ResponseEntity<ApiResponse<Void>> deleteGrammarTopic(@PathVariable UUID topicId) {
        curriculumService.deleteGrammarTopic(topicId);
        return ResponseEntity.ok(ApiResponse.success("Grammar topic deleted successfully", null));
    }
}