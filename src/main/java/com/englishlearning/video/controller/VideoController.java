package com.englishlearning.video.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.common.exception.BadRequestException;
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
            @RequestParam(value = "lessonId", required = false) UUID lessonId,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "video", required = false) MultipartFile videoFile,
            @RequestParam(value = "title", required = false) String title,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        MultipartFile targetFile = (file != null && !file.isEmpty()) ? file : videoFile;
        if (targetFile == null || targetFile.isEmpty()) {
            throw new BadRequestException("Vui lòng đính kèm file video bài giảng.");
        }
        if (lessonId == null) {
            throw new BadRequestException("Thiếu mã bài học (lessonId).");
        }
        VideoUploadResponse res = videoService.uploadOriginalVideo(lessonId, targetFile, userDetails.getId());
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Video>> getVideoDetails(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(videoService.getVideoById(id)));
    }

    @GetMapping("/{id}/raw")
    public ResponseEntity<Resource> serveRawVideo(@PathVariable UUID id) {
        Video video = videoService.getVideoById(id);
        if (video == null || video.getRawStorageUrl() == null) {
            return ResponseEntity.notFound().build();
        }
        File file = new File(video.getRawStorageUrl());
        if (!file.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                .contentType(MediaType.valueOf("video/mp4"))
                .body(new FileSystemResource(file));
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
        Video video = videoService.getVideoByLessonId(lessonId);
        if (video == null) {
            return ResponseEntity.ok(ApiResponse.success("Bài học chưa có video", null));
        }
        return ResponseEntity.ok(ApiResponse.success(video));
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
