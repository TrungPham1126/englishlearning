package com.englishlearning.video.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.service.VideoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<ApiResponse<VideoUploadResponse>> uploadVideo(
            @RequestParam("lessonId") UUID lessonId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        VideoUploadResponse res = videoService.uploadOriginalVideo(lessonId, file, userDetails.getId());
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Video>> getVideoDetails(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(videoService.getVideoById(id)));
    }

    @PostMapping("/{id}/progress")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<String>> updateProgress(
            @PathVariable UUID id,
            @RequestBody @Valid WatchProgressRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        videoService.updateWatchProgress(userDetails.getId(), id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật tiến độ xem thành công"));
    }

    @GetMapping("/{id}/hls/{fileName:.+}")
    public ResponseEntity<Resource> serveHlsFile(
            @PathVariable UUID id,
            @PathVariable String fileName,
            @RequestParam(value = "uploadDir", defaultValue = "uploads/videos") String uploadBaseDir) {
        Path filePath = Paths.get(uploadBaseDir, "hls", id.toString(), fileName);
        File file = filePath.toFile();
        if (!file.exists())
            return ResponseEntity.notFound().build();

        String contentType = fileName.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/MP2T";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(new FileSystemResource(file));
    }

    @GetMapping("/lesson/{lessonId}")
    public ResponseEntity<ApiResponse<Video>> getVideoByLesson(@PathVariable UUID lessonId) {
        return ResponseEntity.ok(ApiResponse.success(videoService.getVideoByLessonId(lessonId)));
    }

    @GetMapping("/{id}/progress")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<VideoWatchHistory>> getMyProgress(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success(videoService.getWatchProgress(userDetails.getId(), id)));
    }

    @PatchMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<ApiResponse<Video>> reviewVideo(
            @PathVariable UUID id,
            @RequestParam("approved") boolean approved,
            @RequestParam(value = "reason", required = false) String reason,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Video reviewed = videoService.reviewVideo(id, userDetails.getId(), approved, reason);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật trạng thái kiểm duyệt thành công", reviewed));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<ApiResponse<Void>> deleteVideo(@PathVariable UUID id) {
        videoService.deleteVideo(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa video thành công", null));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<ApiResponse<List<Video>>> getVideosByStatus(
            @RequestParam(required = false) VideoStatus status) {
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách video thành công",
                videoService.getVideosByStatus(status)));
    }
}