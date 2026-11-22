package com.englishlearning.video.service.impl;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.User;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.video.consumer.VideoTranscodeConsumer;
import com.englishlearning.video.dto.R2ObjectStream;
import com.englishlearning.video.dto.VideoTranscodeMessage;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import com.englishlearning.video.service.R2StorageService;
import com.englishlearning.video.service.VideoService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.Hibernate;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.FileSystemUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executor;

@Service
@RequiredArgsConstructor
@Slf4j
public class VideoServiceImpl implements VideoService {

    private final VideoRepository videoRepository;
    private final VideoWatchHistoryRepository watchHistoryRepository;
    private final RabbitTemplate rabbitTemplate;
    private final EntityManager entityManager;
    private final VideoTranscodeConsumer videoTranscodeConsumer;
    private final com.englishlearning.curriculum.repository.DailyPlanItemRepository dailyPlanItemRepository;
    private final com.englishlearning.curriculum.repository.StudentDailyProgressRepository studentDailyProgressRepository;

    @Autowired(required = false)
    @Qualifier("taskExecutor")
    private Executor taskExecutor;

    @Autowired(required = false)
    private R2StorageService r2StorageService;

    @Value("${app.storage.upload-dir:uploads/videos}")
    private String uploadBaseDir;

    @Value("${app.rabbitmq.queues.video-transcode:video.transcode.queue}")
    private String videoTranscodeQueue;

    @Override
    @Transactional
    public VideoUploadResponse uploadOriginalVideo(UUID lessonId, MultipartFile file, UUID uploadedByUserId) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File upload không được trống");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            originalFilename = "lesson_video.mp4";
        }
        String extension = originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : ".mp4";
        String storedFileName = UUID.randomUUID() + extension;
        Path targetDir = Paths.get(uploadBaseDir, "raw");

        try {
            Files.createDirectories(targetDir);
            Path targetPath = targetDir.resolve(storedFileName);
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }

            User uploader = entityManager.getReference(User.class, uploadedByUserId);
            Lesson lesson = entityManager.getReference(Lesson.class, lessonId);

            String previousRawUrl = null;
            String previousHlsUrl = null;
            Video video = videoRepository.findByLessonId(lessonId).orElse(null);
            if (video != null) {
                previousRawUrl = video.getRawStorageUrl();
                previousHlsUrl = video.getHlsPlaylistUrl();
                video.setOriginalFileName(originalFilename);
                video.setRawStorageUrl(targetPath.toAbsolutePath().toString());
                video.setSizeBytes(file.getSize());
                video.setStatus(VideoStatus.DRAFT);
                video.setUploadedBy(uploader);
                video.setHlsPlaylistUrl(null);
                video.setRejectionReason(null);
                video.setDurationSeconds(null);
            } else {
                video = Video.builder()
                        .originalFileName(originalFilename)
                        .rawStorageUrl(targetPath.toAbsolutePath().toString())
                        .sizeBytes(file.getSize())
                        .status(VideoStatus.DRAFT)
                        .uploadedBy(uploader)
                        .lesson(lesson)
                        .build();
            }

            Video saved = videoRepository.saveAndFlush(video);
            cleanupReplacedVideoArtifacts(saved.getId(), previousRawUrl, previousHlsUrl, saved.getRawStorageUrl());
            VideoTranscodeMessage message = VideoTranscodeMessage.builder()
                    .videoId(saved.getId())
                    .build();

            if (!videoTranscodeConsumer.isFfmpegAvailable()) {
                videoTranscodeConsumer.handleFallbackToRaw(saved);
                return VideoUploadResponse.builder()
                        .videoId(saved.getId())
                        .status(saved.getStatus())
                        .originalFileName(originalFilename)
                        .message("Upload thành công, phát trực tiếp video gốc (chế độ Fallback khi chưa cài FFmpeg)")
                        .build();
            }

            saved.setStatus(VideoStatus.PROCESSING);
            videoRepository.save(saved);

            try {
                rabbitTemplate.convertAndSend(videoTranscodeQueue, message);
                log.info("Đã gửi message transcode cho video ID: {}", saved.getId());
            } catch (Exception rabbitEx) {
                log.warn("[VIDEO_PIPELINE] Không thể gửi message qua RabbitMQ ({}). Chuyển sang xử lý nền bất đồng bộ cho video ID: {}",
                        rabbitEx.getMessage(), saved.getId());
                dispatchAsyncTranscode(message);
            }

            return VideoUploadResponse.builder()
                    .videoId(saved.getId())
                    .status(saved.getStatus())
                    .originalFileName(originalFilename)
                    .message("Upload thành công, video đang được xử lý HLS")
                    .build();

        } catch (IOException e) {
            log.error("Lỗi I/O khi lưu file video bài giảng: ", e);
            throw new BadRequestException("Lỗi lưu file video: " + e.getMessage());
        }
    }

    private void dispatchAsyncTranscode(VideoTranscodeMessage message) {
        Runnable task = () -> {
            try {
                videoTranscodeConsumer.processVideoTranscode(message);
            } catch (Exception ex) {
                log.error("[VIDEO_PIPELINE] Lỗi xử lý HLS nền cho video ID {}: {}",
                        message.getVideoId(), ex.getMessage(), ex);
            }
        };
        if (taskExecutor == null) {
            task.run();
            return;
        }
        // Only run background transcoding after DB commit so the async worker sees the persisted Video row.
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    taskExecutor.execute(task);
                }
            });
        } else {
            taskExecutor.execute(task);
        }
    }

    private void healIfFfmpegTechnicalError(Video video) {
        if (video == null) {
            return;
        }
        String reason = video.getRejectionReason();
        if (video.getStatus() == VideoStatus.REJECTED && reason != null) {
            String lower = reason.toLowerCase();
            if (lower.contains("ffmpeg") || lower.contains("createprocess error=2") || lower.contains("cannot run program")) {
                log.info("[VIDEO_PIPELINE] Tự động khôi phục video ID {} bị lỗi kỹ thuật FFmpeg trước đó ('{}')", video.getId(), reason);
                videoTranscodeConsumer.handleFallbackToRaw(video);
            }
        }
    }

    private void initializeVideoRelations(Video video) {
        if (video == null) {
            return;
        }
        if (video.getLesson() != null) {
            Hibernate.initialize(video.getLesson());
            if (video.getLesson().getClassroom() != null) {
                Hibernate.initialize(video.getLesson().getClassroom());
            }
        }
        if (video.getUploadedBy() != null) {
            Hibernate.initialize(video.getUploadedBy());
        }
    }

    private void normalizePlaybackUrl(Video video) {
        if (video == null) {
            return;
        }
        healIfFfmpegTechnicalError(video);

        String hls = video.getHlsPlaylistUrl();
        boolean updated = false;
        if (hls != null && !hls.isBlank()) {
            String normalizedLocalhost = stripLocalhostPrefix(hls);
            if (normalizedLocalhost != null) {
                String normalized = (normalizedLocalhost.contains("/api/v1/videos/") && normalizedLocalhost.contains("/hls/"))
                        ? normalizedLocalhost
                        : "/api/v1/videos/" + video.getId() + "/raw";
                log.info("[VIDEO_PIPELINE] Chuẩn hóa URL từ localhost sang relative URL cho video ID {}: {} -> {}",
                        video.getId(), hls, normalized);
                hls = normalized;
                video.setHlsPlaylistUrl(normalized);
                updated = true;
            } else if (isManagedR2Url(hls) && video.getId() != null) {
                String normalized = rewriteManagedR2PlaybackUrl(video.getId(), hls);
                if (!hls.equals(normalized)) {
                    log.info("[VIDEO_PIPELINE] Chuẩn hóa URL R2 sang proxy backend cho video ID {}: {} -> {}",
                            video.getId(), hls, normalized);
                    hls = normalized;
                    video.setHlsPlaylistUrl(normalized);
                    updated = true;
                }
            }
        } else if (video.getRawStorageUrl() != null
                && video.getStatus() != VideoStatus.PROCESSING
                && video.getStatus() != VideoStatus.DRAFT) {
            String fallback = "/api/v1/videos/" + video.getId() + "/raw";
            hls = fallback;
            video.setHlsPlaylistUrl(fallback);
            updated = true;
        }

        boolean r2Backed = isManagedR2Url(video.getRawStorageUrl());
        if (!r2Backed && hls != null && video.getId() != null && uploadBaseDir != null
                && hls.startsWith("/api/v1/videos/") && hls.endsWith("/hls/master.m3u8")) {
            Path hlsDir = Paths.get(uploadBaseDir, "hls", video.getId().toString());
            if (!Files.exists(hlsDir.resolve("master.m3u8"))) {
                String fallback = "/api/v1/videos/" + video.getId() + "/raw";
                log.warn("[VIDEO_PIPELINE] Thiếu file HLS local trong {} (không phải R2), chuyển sang {}", hlsDir, fallback);
                video.setHlsPlaylistUrl(fallback);
                updated = true;
            }
        }

        if (updated) {
            videoRepository.save(video);
        }
    }

    @Override
    public Optional<R2ObjectStream> openHlsStream(UUID videoId, String fileName, String rangeHeader, boolean headOnly) {
        if (videoId == null || fileName == null || fileName.isBlank()
                || r2StorageService == null || !r2StorageService.isConfigured()) {
            return Optional.empty();
        }
        String key = "hls/" + videoId + "/" + fileName;
        return r2StorageService.openObjectStream(key, rangeHeader, headOnly);
    }

    @Override
    public Optional<R2ObjectStream> openRawStream(Video video, String rangeHeader, boolean headOnly) {
        if (video == null || video.getRawStorageUrl() == null || video.getRawStorageUrl().isBlank()
                || r2StorageService == null || !r2StorageService.isConfigured()) {
            return Optional.empty();
        }
        String rawUrl = video.getRawStorageUrl().trim();
        if (!r2StorageService.isManagedPublicUrl(rawUrl)) {
            return Optional.empty();
        }
        String key = r2StorageService.extractObjectKey(rawUrl);
        if (key == null || key.isBlank()) {
            return Optional.empty();
        }
        return r2StorageService.openObjectStream(key, rangeHeader, headOnly);
    }

    private String stripLocalhostPrefix(String url) {
        if (url.startsWith("http://localhost:8080")) {
            return url.substring("http://localhost:8080".length());
        }
        if (url.startsWith("http://127.0.0.1:8080")) {
            return url.substring("http://127.0.0.1:8080".length());
        }
        return null;
    }

    private boolean isManagedR2Url(String url) {
        return url != null
                && !url.isBlank()
                && r2StorageService != null
                && r2StorageService.isManagedPublicUrl(url);
    }

    private String rewriteManagedR2PlaybackUrl(UUID videoId, String r2Url) {
        String key = r2StorageService != null ? r2StorageService.extractObjectKey(r2Url) : null;
        if (key != null && !key.isBlank()) {
            String hlsPrefix = "hls/" + videoId + "/";
            if (key.startsWith(hlsPrefix)) {
                String fileName = key.substring(hlsPrefix.length());
                if (!fileName.isBlank() && !fileName.contains("/")) {
                    return "/api/v1/videos/" + videoId + "/hls/" + fileName;
                }
            }
        }
        return "/api/v1/videos/" + videoId + "/raw";
    }

    private void cleanupReplacedVideoArtifacts(
            UUID videoId,
            String previousRawUrl,
            String previousHlsUrl,
            String newRawUrl) {
        try {
            if (videoId != null && uploadBaseDir != null) {
                Path oldHlsDir = Paths.get(uploadBaseDir, "hls", videoId.toString());
                if (Files.exists(oldHlsDir)) {
                    FileSystemUtils.deleteRecursively(oldHlsDir);
                }
            }
            if (previousRawUrl != null && !previousRawUrl.isBlank() && !previousRawUrl.equals(newRawUrl)) {
                if (r2StorageService != null && r2StorageService.isManagedPublicUrl(previousRawUrl)) {
                    r2StorageService.deleteObjectByUrlOrKey(previousRawUrl);
                } else if (!previousRawUrl.startsWith("http://") && !previousRawUrl.startsWith("https://")
                        && !previousRawUrl.startsWith("/api/")) {
                    Path oldRawPath = Paths.get(previousRawUrl);
                    Files.deleteIfExists(oldRawPath);
                }
            }
            if (videoId != null && previousHlsUrl != null && !previousHlsUrl.isBlank()
                    && r2StorageService != null && r2StorageService.isConfigured()
                    && (r2StorageService.isManagedPublicUrl(previousHlsUrl)
                    || previousHlsUrl.contains("/api/v1/videos/" + videoId + "/hls/"))) {
                r2StorageService.deleteObjectsByPrefix("hls/" + videoId + "/");
            }
        } catch (Exception ex) {
            log.warn("[VIDEO_PIPELINE] Không thể dọn tài nguyên video cũ cho video ID {}: {}", videoId, ex.getMessage());
        }
    }

    @Override
    @Transactional
    public Video getVideoById(UUID videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy video: " + videoId));
        normalizePlaybackUrl(video);
        initializeVideoRelations(video);
        return video;
    }

    @Override
    @Transactional
    public void updateWatchProgress(UUID studentId, UUID videoId, WatchProgressRequest request) {
        Video video = getVideoById(videoId);
        Student student = entityManager.getReference(Student.class, studentId);

        VideoWatchHistory history = watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId)
                .orElseGet(() -> VideoWatchHistory.builder()
                        .student(student)
                        .video(video)
                        .watchedSeconds(0)
                        .completionPercentage(0.0f)
                        .isCompleted(false)
                        .build());

        int currentWatched = history.getWatchedSeconds() != null ? history.getWatchedSeconds() : 0;
        int requestedWatched = (request != null && request.getWatchedSeconds() != null)
                ? Math.max(0, request.getWatchedSeconds())
                : 0;
        history.setWatchedSeconds(Math.max(currentWatched, requestedWatched));

        float percentage = (video.getDurationSeconds() != null && video.getDurationSeconds() > 0)
                ? Math.min(100.0f, Math.max(0.0f, ((float) history.getWatchedSeconds() / video.getDurationSeconds()) * 100.0f))
                : 0.0f;
        history.setCompletionPercentage(percentage);

        boolean isCompleted = (request != null && Boolean.TRUE.equals(request.getCompleted())) || percentage >= 80.0f;
        if (isCompleted) {
            history.setIsCompleted(true);
        }

        watchHistoryRepository.save(history);

        // Khi xem xong video (completed == true hoặc watchedSeconds >= video.duration * 0.8)
        if (isCompleted && video.getLesson() != null) {
            updateDailyProgressOnLessonCompletion(studentId, video.getLesson(), history.getWatchedSeconds());
        }
    }

    private void updateDailyProgressOnLessonCompletion(UUID studentId, Lesson lesson, Integer watchedSeconds) {
        try {
            List<com.englishlearning.curriculum.entity.DailyPlanItem> items = dailyPlanItemRepository
                    .findByLessonIdWithDailyPlan(lesson.getId());

            for (var item : items) {
                var plan = item.getDailyPlan();
                if (plan != null) {
                    var progress = studentDailyProgressRepository.findByStudentIdAndDailyPlanId(studentId, plan.getId())
                            .orElseGet(() -> com.englishlearning.curriculum.entity.StudentDailyProgress.builder()
                                    .student(entityManager.getReference(Student.class, studentId))
                                    .dailyPlan(plan)
                                    .totalItemsCount(plan.getItems() != null ? plan.getItems().size() : 1)
                                    .completedItemsCount(0)
                                    .isCompleted(false)
                                    .build());

                    int total = (plan.getItems() != null && !plan.getItems().isEmpty()) ? plan.getItems().size() : 1;
                    progress.setCompletedItemsCount(total);
                    progress.setTotalItemsCount(total);
                    progress.setIsCompleted(true);
                    progress.setCompletedAt(java.time.Instant.now());

                    int currentSpent = progress.getTimeSpentSeconds() != null ? progress.getTimeSpentSeconds() : 0;
                    if (watchedSeconds != null && watchedSeconds > 0) {
                        progress.setTimeSpentSeconds(currentSpent + watchedSeconds);
                    }

                    studentDailyProgressRepository.save(progress);
                    log.info("Cập nhật tiến độ ngày {} cho học sinh {}: đã hoàn thành qua video bài học {}",
                            plan.getDayNumber(), studentId, lesson.getId());
                }
            }
        } catch (Exception e) {
            log.warn("Không thể cập nhật tiến độ Daily Study Plan từ video xem bài học: {}", e.getMessage());
        }
    }

    @Override
    @Transactional
    public Video getVideoByLessonId(UUID lessonId) {
        Video video = videoRepository.findByLessonId(lessonId).orElse(null);
        normalizePlaybackUrl(video);
        initializeVideoRelations(video);
        return video;
    }

    @Override
    public VideoWatchHistory getWatchProgress(UUID studentId, UUID videoId) {
        return watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId)
                .orElse(VideoWatchHistory.builder()
                        .watchedSeconds(0)
                        .completionPercentage(0.0f)
                        .isCompleted(false)
                        .build());
    }

    @Override
    @Transactional
    public Video reviewVideo(UUID videoId, UUID reviewerId, boolean isApproved, String rejectionReason) {
        Video video = getVideoById(videoId);
        if (isApproved) {
            if (video.getStatus() == VideoStatus.PROCESSING) {
                throw new BadRequestException("Video đang được xử lý HLS, vui lòng chờ hoàn tất trước khi phê duyệt.");
            }
            if (video.getStatus() == VideoStatus.DRAFT
                    && (video.getHlsPlaylistUrl() == null || video.getHlsPlaylistUrl().isBlank())) {
                throw new BadRequestException("Video chưa sẵn sàng để phát, không thể phê duyệt.");
            }
        }
        User reviewer = entityManager.getReference(User.class, reviewerId);
        video.setReviewedBy(reviewer);

        if (isApproved) {
            video.setStatus(VideoStatus.APPROVED);
            video.setRejectionReason(null);
        } else {
            video.setStatus(VideoStatus.REJECTED);
            video.setRejectionReason(rejectionReason);
        }

        return videoRepository.save(video);
    }

    @Override
    @Transactional
    public void deleteVideo(UUID videoId) {
        Video video = getVideoById(videoId);
        videoRepository.delete(video);
    }

    @Override
    @Transactional
    public List<Video> getVideosByStatus(VideoStatus status) {
        List<Video> videos = (status != null)
                ? videoRepository.findByStatus(status)
                : videoRepository.findAll();
        for (Video v : videos) {
            normalizePlaybackUrl(v);
            initializeVideoRelations(v);
        }
        return videos;
    }

    @Override
    @Transactional
    public List<Video> getVideosByUploader(UUID uploaderId, VideoStatus status) {
        List<Video> videos = (status != null)
                ? videoRepository.findByUploadedByIdAndStatusOrderByCreatedAtDesc(uploaderId, status)
                : videoRepository.findByUploadedByIdOrderByCreatedAtDesc(uploaderId);
        for (Video v : videos) {
            normalizePlaybackUrl(v);
            initializeVideoRelations(v);
        }
        return videos;
    }
}
