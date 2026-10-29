package com.englishlearning.ai.controller;

import com.englishlearning.ai.dto.TtsRequest;
import com.englishlearning.ai.dto.TtsResponse;
import com.englishlearning.ai.service.KokoroTtsClientService;
import com.englishlearning.assignment.dto.ExerciseAudioResponseDto;
import com.englishlearning.assignment.dto.KokoroVoiceDto;
import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai/tts")
@RequiredArgsConstructor
@Slf4j
public class AiTtsController {

    private final ExerciseAudioService exerciseAudioService;
    private final KokoroTtsClientService kokoroTtsClientService;

    /**
     * Tổng hợp giọng đọc tiếng Anh bản xứ trực tiếp từ nội dung văn bản (POST /api/v1/ai/tts).
     * Bắt buộc kiểm tra text khác rỗng, tuyệt đối không dùng câu mặc định cố định.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<TtsResponse>> synthesizeSpeech(
            @RequestBody(required = false) TtsRequest request) {
        if (request == null || request.getText() == null || request.getText().trim().isEmpty()) {
            throw new IllegalArgumentException("Nội dung câu mẫu cần tạo âm thanh (text) không được để trống.");
        }
        log.info("Generating TTS for text: {}", request.getText().trim());
        TtsResponse response = kokoroTtsClientService.synthesizeSpeech(request);
        return ResponseEntity.ok(ApiResponse.success("Tạo âm thanh mẫu thành công", response));
    }

    /**
     * Tự phục hồi âm thanh bài tập khi audio bị lỗi / 404 / hỏng
     * Học sinh hoặc giáo viên bấm tạo lại -> Backend sinh lại và thay thế nguyên tử.
     */
    @PostMapping("/questions/{questionId}/repair")
    @PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ExerciseAudioResponseDto>> repairQuestionAudio(
            @PathVariable UUID questionId,
            @RequestBody(required = false) TtsRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        if (currentUser == null) {
            throw new AccessDeniedException("Vui lòng đăng nhập để thực hiện chức năng này.");
        }

        boolean isStudent = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_STUDENT") || a.getAuthority().equalsIgnoreCase("STUDENT"));

        String customText = (request != null && request.getText() != null && !request.getText().trim().isEmpty())
                ? request.getText().trim()
                : null;
        String customVoice = (request != null && request.getText() != null && request.getVoice() != null && !request.getVoice().trim().isEmpty())
                ? request.getVoice().trim()
                : (request != null ? request.getVoice() : null);

        log.info("Generating TTS for text: {} (questionId: {}, user: {}, isStudent: {})",
                customText != null ? customText : "[resolved-from-question-db]",
                questionId, currentUser.getId(), isStudent);

        ExerciseAudioResponseDto result = exerciseAudioService.repairAudio(
                questionId,
                currentUser.getId(),
                isStudent,
                customText,
                customVoice
        );
        return ResponseEntity.ok(ApiResponse.success("Tạo lại và khôi phục âm thanh Kokoro-82M thành công", result));
    }

    /**
     * Tra cứu trạng thái âm thanh đã tạo sẵn (pre-generated) của câu hỏi
     */
    @GetMapping("/questions/{questionId}/status")
    @PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ExerciseAudioResponseDto>> getQuestionAudioStatus(
            @PathVariable UUID questionId) {
        ExerciseAudioResponseDto status = exerciseAudioService.getAudioStatus(questionId);
        return ResponseEntity.ok(ApiResponse.success("Lấy trạng thái audio thành công", status));
    }

    /**
     * Danh mục các giọng đọc Kokoro-82M được hỗ trợ (US/UK, Nam/Nữ)
     */
    @GetMapping("/voices")
    @PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<KokoroVoiceDto>>> getAvailableVoices() {
        List<KokoroVoiceDto> voices = exerciseAudioService.getKokoroVoices();
        return ResponseEntity.ok(ApiResponse.success("Lấy danh mục giọng đọc thành công", voices));
    }
}

