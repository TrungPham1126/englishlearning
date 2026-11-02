package com.englishlearning.video.service.impl;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.User;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.video.consumer.VideoTranscodeConsumer;
import com.englishlearning.video.dto.VideoTranscodeMessage;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import com.englishlearning.video.service.VideoService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

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
    private final com.englishlearning.curriculum.service.UserStreakService userStreakService;

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
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            User uploader = entityManager.getReference(User.class, uploadedByUserId);
            Lesson lesson = entityManager.getReference(Lesson.class, lessonId);

            Video video = videoRepository.findByLessonId(lessonId).orElse(null);
            if (video != null) {
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

            try {
                rabbitTemplate.convertAndSend(videoTranscodeQueue, message);
                log.info("Đã gửi message transcode cho video ID: {}", saved.getId());
            } catch (Exception rabbitEx) {
                log.warn("[VIDEO_PIPELINE] Không thể gửi message qua RabbitMQ ({}). Chuyển sang xử lý trực tiếp cho video ID: {}",
                        rabbitEx.getMessage(), saved.getId());
                videoTranscodeConsumer.processVideoTranscode(message);
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

    private void normalizePlaybackUrl(Video video) {
        if (video == null) {
            return;
        }
        healIfFfmpegTechnicalError(video);

        String hls = video.getHlsPlaylistUrl();
        if (hls != null && hls.contains("http://localhost:8080")) {
            String normalized = "/api/v1/videos/" + video.getId() + "/raw";
            log.info("[VIDEO_PIPELINE] Chuẩn hóa URL từ localhost:8080 sang relative URL cho video ID {}: {} -> {}",
                    video.getId(), hls, normalized);
            video.setHlsPlaylistUrl(normalized);
            videoRepository.save(video);
        } else if ((hls == null || hls.isBlank()) && video.getRawStorageUrl() != null && video.getStatus() == VideoStatus.APPROVED) {
            String fallback = "/api/v1/videos/" + video.getId() + "/raw";
            video.setHlsPlaylistUrl(fallback);
            videoRepository.save(video);
        }
    }

    @Override
    @Transactional
    public Video getVideoById(UUID videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy video: " + videoId));
        normalizePlaybackUrl(video);
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

        history.setWatchedSeconds(Math.max(history.getWatchedSeconds(), request.getWatchedSeconds()));

        float percentage = (video.getDurationSeconds() != null && video.getDurationSeconds() > 0)
                ? ((float) history.getWatchedSeconds() / video.getDurationSeconds()) * 100
                : 0.0f;
        history.setCompletionPercentage(percentage);

        boolean isCompleted = Boolean.TRUE.equals(request.getCompleted()) || percentage >= 80.0f;
        if (isCompleted) {
            history.setIsCompleted(true);
        }

        watchHistoryRepository.save(history);

        // Khi xem xong video (completed == true hoặc watchedSeconds >= video.duration * 0.8)
        if (isCompleted && video.getLesson() != null) {
            updateDailyProgressOnLessonCompletion(studentId, video.getLesson(), history.getWatchedSeconds());
            try {
                userStreakService.recordActivity(studentId);
            } catch (Exception streakEx) {
                log.warn("Không thể cập nhật streak cho học sinh {}: {}", studentId, streakEx.getMessage());
            }
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
        List<Video> allVideos = videoRepository.findAll();
        for (Video v : allVideos) {
            normalizePlaybackUrl(v);
        }
        if (status != null) {
            return videoRepository.findByStatus(status);
        }
        return videoRepository.findAll();
    }
}
