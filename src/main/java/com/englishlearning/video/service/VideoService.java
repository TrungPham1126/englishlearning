package com.englishlearning.video.service;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.User;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.video.dto.VideoTranscodeMessage;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
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
public class VideoService {

    private final VideoRepository videoRepository;
    private final VideoWatchHistoryRepository watchHistoryRepository;
    private final RabbitTemplate rabbitTemplate;
    private final EntityManager entityManager;

    @Value("${app.storage.upload-dir:uploads/videos}")
    private String uploadBaseDir;

    @Value("${app.rabbitmq.queues.video-transcode:video.transcode.queue}")
    private String videoTranscodeQueue;

    @Transactional
    public VideoUploadResponse uploadOriginalVideo(UUID lessonId, MultipartFile file, UUID uploadedByUserId) {
        if (file.isEmpty()) {
            throw new BadRequestException("File upload không được trống");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : "";
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
            rabbitTemplate.convertAndSend(videoTranscodeQueue, message);
            log.info("Đã gửi message transcode cho video ID: {}", saved.getId());

            return VideoUploadResponse.builder()
                    .videoId(saved.getId())
                    .status(saved.getStatus())
                    .originalFileName(originalFilename)
                    .message("Upload thành công, video đang được xử lý HLS")
                    .build();

        } catch (IOException e) {
            throw new BadRequestException("Lỗi lưu file video: " + e.getMessage());
        }
    }

    public Video getVideoById(UUID videoId) {
        return videoRepository.findById(videoId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy video: " + videoId));
    }

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

        if (Boolean.TRUE.equals(request.getCompleted()) || percentage >= 80.0f) {
            history.setIsCompleted(true);
        }

        watchHistoryRepository.save(history);
    }

    public Video getVideoByLessonId(UUID lessonId) {
        return videoRepository.findByLessonId(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Bài giảng này chưa có video"));
    }

    public VideoWatchHistory getWatchProgress(UUID studentId, UUID videoId) {
        return watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId)
                .orElse(VideoWatchHistory.builder()
                        .watchedSeconds(0)
                        .completionPercentage(0.0f)
                        .isCompleted(false)
                        .build());
    }

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

    @Transactional
    public void deleteVideo(UUID videoId) {
        Video video = getVideoById(videoId);
        videoRepository.delete(video);
    }

    // THÊM MỚI: Lấy danh sách video (Có thể lọc theo trạng thái)
    public List<Video> getVideosByStatus(VideoStatus status) {
        if (status != null) {
            return videoRepository.findByStatus(status);
        }
        return videoRepository.findAll();
    }
}