package com.englishlearning.video.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.video.dto.R2ObjectStream;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.service.VideoService;
import com.englishlearning.video.service.impl.VideoServiceImpl;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpRange;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/videos")
@RequiredArgsConstructor
public class VideoController {

    private static final long CHUNK_SIZE = 1024 * 1024 * 8L; // 8MB Chunk - Tải đệm dồi dào liên tục

    private final VideoService videoService;

    @Value("${app.storage.upload-dir:uploads/videos}")
    private String uploadBaseDir;

    private File resolveRawVideoFile(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) {
            return null;
        }
        File direct = new File(rawPath);
        if (direct.exists() && direct.isFile()) {
            return direct;
        }
        try {
            Path p = Paths.get(rawPath);
            String fileName = p.getFileName().toString();
            Path inUploadDir = Paths.get(uploadBaseDir, "raw", fileName);
            if (Files.exists(inUploadDir) && Files.isRegularFile(inUploadDir)) {
                return inUploadDir.toFile();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

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
    public ResponseEntity<Resource> serveRawVideo(
            @PathVariable UUID id,
            @RequestHeader(required = false) HttpHeaders headers,
            HttpMethod httpMethod) {
        Video video = videoService.getVideoById(id);
        if (video == null || video.getRawStorageUrl() == null) {
            return ResponseEntity.notFound().build();
        }
        String rawUrl = video.getRawStorageUrl();
        boolean isHead = HttpMethod.HEAD.equals(httpMethod);
        File file = resolveRawVideoFile(rawUrl);
        if (file != null && file.exists()) {
            long contentLength = file.length();
            HttpRange range = (headers != null && !headers.getRange().isEmpty()) ? headers.getRange().get(0) : null;

            long start = 0;
            long end = Math.min(CHUNK_SIZE, contentLength) - 1;
            if (range != null && contentLength > 0) {
                try {
                    start = range.getRangeStart(contentLength);
                    end = Math.min(range.getRangeEnd(contentLength), start + CHUNK_SIZE - 1);
                } catch (IllegalArgumentException ex) {
                    return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                            .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                            .header(HttpHeaders.CONTENT_RANGE, "bytes */" + contentLength)
                            .build();
                }
            }
            if (contentLength == 0 || start < 0 || start >= contentLength || end < start) {
                return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                        .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                        .header(HttpHeaders.CONTENT_RANGE, "bytes */" + contentLength)
                        .build();
            }
            long length = end - start + 1;

            ResponseEntity.BodyBuilder builder = ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                    .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + contentLength)
                    .contentType(MediaType.valueOf("video/mp4"))
                    .contentLength(length);
            if (isHead) {
                return builder.build();
            }
            try {
                InputStream rawStream = Files.newInputStream(file.toPath());
                rawStream.skipNBytes(start);
                return builder.body(new SizedInputStreamResource(new BoundedInputStream(rawStream, length), length));
            } catch (IOException ex) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        }

        String rangeHeader = headers != null ? headers.getFirst(HttpHeaders.RANGE) : null;
        Optional<R2ObjectStream> r2Stream = videoService.openRawStream(video, rangeHeader, isHead);
        if (r2Stream.isPresent()) {
            return buildR2StreamResponse(
                    r2Stream.get(),
                    "video/mp4",
                    "public, max-age=86400",
                    "video-" + id + ".mp4",
                    isHead);
        }

        if ((rawUrl.startsWith("http://") || rawUrl.startsWith("https://"))
                && !rawUrl.contains("/api/v1/videos/" + id + "/raw")
                && !VideoServiceImpl.isPlaceholderStorageUrl(rawUrl)) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(rawUrl))
                    .build();
        }
        return ResponseEntity.notFound().build();
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
            @RequestHeader(required = false) HttpHeaders headers,
            HttpMethod httpMethod) {
        if (fileName == null || fileName.isBlank() || fileName.contains("..")
                || fileName.contains("/") || fileName.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }
        Path hlsDir = Paths.get(this.uploadBaseDir, "hls", id.toString()).toAbsolutePath().normalize();
        Path filePath = hlsDir.resolve(fileName).normalize();
        if (!filePath.startsWith(hlsDir)) {
            return ResponseEntity.badRequest().build();
        }

        String contentType = fileName.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/MP2T";
        String cacheControl = fileName.endsWith(".m3u8") ? "public, max-age=60" : "public, max-age=86400";
        boolean isHead = HttpMethod.HEAD.equals(httpMethod);
        String rangeHeader = headers != null ? headers.getFirst(HttpHeaders.RANGE) : null;

        File file = filePath.toFile();
        if (file.exists() && file.isFile()) {
            if (rangeHeader != null && !rangeHeader.isBlank()) {
                return buildLocalRangeResponse(file, rangeHeader, contentType, cacheControl, fileName, isHead);
            }
            ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(HttpHeaders.CACHE_CONTROL, cacheControl)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .contentLength(file.length());
            return isHead ? builder.build() : builder.body(new FileSystemResource(file));
        }

        return videoService.openHlsStream(id, fileName, rangeHeader, isHead)
                .map(stream -> buildR2StreamResponse(stream, contentType, cacheControl, fileName, isHead))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private ResponseEntity<Resource> buildR2StreamResponse(
            R2ObjectStream stream,
            String contentType,
            String cacheControl,
            String fileName,
            boolean isHead) {
        if (stream.rangeNotSatisfiable()) {
            stream.closeQuietly();
            ResponseEntity.BodyBuilder builder = ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes");
            if (stream.contentRange() != null && !stream.contentRange().isBlank()) {
                builder.header(HttpHeaders.CONTENT_RANGE, stream.contentRange());
            }
            return builder.build();
        }

        HttpStatus status = stream.partial() ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK;
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CACHE_CONTROL, cacheControl)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .contentType(MediaType.parseMediaType(contentType));
        if (stream.contentLength() >= 0) {
            builder.contentLength(stream.contentLength());
        }
        if (stream.partial() && stream.contentRange() != null && !stream.contentRange().isBlank()) {
            builder.header(HttpHeaders.CONTENT_RANGE, stream.contentRange());
        }
        if (isHead || stream.inputStream() == null) {
            stream.closeQuietly();
            return builder.build();
        }
        return builder.body(new SizedInputStreamResource(stream.inputStream(), stream.contentLength()));
    }

    private ResponseEntity<Resource> buildLocalRangeResponse(
            File file,
            String rangeHeader,
            String contentType,
            String cacheControl,
            String fileName,
            boolean isHead) {
        long fileLength = file.length();
        List<HttpRange> ranges;
        try {
            ranges = HttpRange.parseRanges(rangeHeader);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(HttpHeaders.CONTENT_RANGE, "bytes */" + fileLength)
                    .build();
        }
        if (ranges.isEmpty() || fileLength == 0) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(HttpHeaders.CONTENT_RANGE, "bytes */" + fileLength)
                    .build();
        }
        HttpRange range = ranges.get(0);
        long start;
        long end;
        try {
            start = range.getRangeStart(fileLength);
            end = range.getRangeEnd(fileLength);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(HttpHeaders.CONTENT_RANGE, "bytes */" + fileLength)
                    .build();
        }
        if (start >= fileLength || end < start) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(HttpHeaders.CONTENT_RANGE, "bytes */" + fileLength)
                    .build();
        }
        long length = end - start + 1;
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CACHE_CONTROL, cacheControl)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + fileLength)
                .contentType(MediaType.parseMediaType(contentType))
                .contentLength(length);
        if (isHead) {
            return builder.build();
        }
        try {
            InputStream rawStream = Files.newInputStream(file.toPath());
            rawStream.skipNBytes(start);
            return builder.body(new SizedInputStreamResource(new BoundedInputStream(rawStream, length), length));
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private static final class SizedInputStreamResource extends InputStreamResource {
        private final long contentLength;

        private SizedInputStreamResource(InputStream inputStream, long contentLength) {
            super(inputStream);
            this.contentLength = contentLength;
        }

        @Override
        public long contentLength() throws IOException {
            return contentLength >= 0 ? contentLength : super.contentLength();
        }
    }

    private static final class BoundedInputStream extends FilterInputStream {
        private long remaining;

        private BoundedInputStream(InputStream in, long limit) {
            super(in);
            this.remaining = limit;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int value = super.read();
            if (value >= 0) {
                remaining--;
            }
            return value;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) {
                return -1;
            }
            int toRead = (int) Math.min(len, remaining);
            int read = super.read(b, off, toRead);
            if (read > 0) {
                remaining -= read;
            }
            return read;
        }
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

    @GetMapping("/my-uploads")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<ApiResponse<List<Video>>> getMyUploadedVideos(
            @RequestParam(required = false) VideoStatus status,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách video đã tải lên thành công",
                videoService.getVideosByUploader(userDetails.getId(), status)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<ApiResponse<List<Video>>> getVideosByStatus(
            @RequestParam(required = false) VideoStatus status) {
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách video thành công",
                videoService.getVideosByStatus(status)));
    }
}
