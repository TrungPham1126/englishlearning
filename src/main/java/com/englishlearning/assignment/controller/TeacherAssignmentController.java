package com.englishlearning.assignment.controller;

import com.englishlearning.assignment.dto.AssignmentRequest;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.service.AssignmentService;
import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.englishlearning.ai.service.AiLabService;
import com.englishlearning.curriculum.service.DocumentStorageService;
import com.englishlearning.curriculum.service.TtsService;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/teacher")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class TeacherAssignmentController {

    private final AssignmentService assignmentService;
    private final DocumentStorageService documentStorageService;
    private final AiLabService aiLabService;
    private final TtsService ttsService;
    private final ExerciseAudioService exerciseAudioService;

    // 0. Tải lên file audio bài tập (cho kỹ năng Listening/Speaking)
    @PostMapping(value = "/assignments/upload-audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<String>> uploadAudio(@RequestParam("file") MultipartFile file) {
        String audioUrl = documentStorageService.uploadAudioFile(file);
        return ResponseEntity.ok(ApiResponse.success("Tải lên file audio thành công", audioUrl));
    }

    // 0B. Tổng hợp giọng nói Neural TTS offline/local chất lượng cao
    @PostMapping("/assignments/synthesize-audio")
    public ResponseEntity<ApiResponse<String>> synthesizeAudio(@RequestBody Map<String, String> payload) {
        String text = payload.get("text");
        String voice = payload.getOrDefault("voice", "af_heart");
        String speed = payload.getOrDefault("speed", "1.0x");

        String audioUrl = ttsService.synthesizeAudio(text, voice, speed);
        return ResponseEntity.ok(ApiResponse.success("Tổng hợp giọng nói thành công", audioUrl));
    }

    // 1. Lấy tất cả bài tập của lớp
    @GetMapping("/classrooms/{classroomId}/assignments")
    public ResponseEntity<ApiResponse<List<Assignment>>> getAssignmentsByClassroom(@PathVariable UUID classroomId) {
        List<Assignment> assignments = assignmentService.getAssignmentsByClassroom(classroomId);
        return ResponseEntity.ok(ApiResponse.success("Assignments retrieved successfully", assignments));
    }

    // 2. Tạo bài tập mới
    @PostMapping("/assignments")
    public ResponseEntity<ApiResponse<Assignment>> createAssignment(@Valid @RequestBody AssignmentRequest request) {
        Assignment assignment = assignmentService.createAssignment(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Assignment created successfully", assignment));
    }

    // 3. Xem chi tiết bài tập
    @GetMapping("/assignments/{id}")
    public ResponseEntity<ApiResponse<Assignment>> getAssignmentById(@PathVariable UUID id) {
        Assignment assignment = assignmentService.getAssignmentById(id);
        return ResponseEntity.ok(ApiResponse.success("Assignment retrieved successfully", assignment));
    }

    // 4. Cập nhật bài tập
    @PutMapping("/assignments/{id}")
    public ResponseEntity<ApiResponse<Assignment>> updateAssignment(
            @PathVariable UUID id,
            @Valid @RequestBody AssignmentRequest request) {
        Assignment updated = assignmentService.updateAssignment(id, request);
        return ResponseEntity.ok(ApiResponse.success("Assignment updated successfully", updated));
    }

    // 5. Xóa bài tập
    @DeleteMapping("/assignments/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteAssignment(@PathVariable UUID id) {
        assignmentService.deleteAssignment(id);
        return ResponseEntity.ok(ApiResponse.success("Assignment deleted successfully", null));
    }

    // 6. Kích hoạt sinh lại audio cho bài tập
    @PostMapping("/assignments/{id}/generate-audios")
    public ResponseEntity<ApiResponse<String>> generateAudiosForAssignment(@PathVariable UUID id) {
        exerciseAudioService.generateAudiosForAssignmentAsync(id, com.englishlearning.assignment.entity.AudioGeneratedBy.TEACHER);
        return ResponseEntity.ok(ApiResponse.success("Đã kích hoạt tiến trình sinh âm thanh bài học chạy ngầm", "PROCESSING"));
    }

    // 7. Backfill audio cho toàn bộ bài tập Speaking/Listening chưa có audio
    @PostMapping("/assignments/backfill-audios")
    public ResponseEntity<ApiResponse<String>> backfillAudios() {
        assignmentService.backfillAllAudios();
        return ResponseEntity.ok(ApiResponse.success("Đã kích hoạt cập nhật âm thanh cho toàn hệ thống", "PROCESSING"));
    }
}