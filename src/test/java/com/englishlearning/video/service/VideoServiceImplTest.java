package com.englishlearning.video.service;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.User;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
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
import com.englishlearning.video.service.impl.VideoServiceImpl;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("VideoServiceImpl - Cập nhật tiến độ xem video & Daily Study Plan")
class VideoServiceImplTest {

    @Mock
    private VideoRepository videoRepository;

    @Mock
    private VideoWatchHistoryRepository watchHistoryRepository;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @Mock
    private EntityManager entityManager;

    @Mock
    private VideoTranscodeConsumer videoTranscodeConsumer;

    @Mock
    private DailyPlanItemRepository dailyPlanItemRepository;

    @Mock
    private StudentDailyProgressRepository studentDailyProgressRepository;

    @Mock
    private R2StorageService r2StorageService;

    @InjectMocks
    private VideoServiceImpl videoService;

    @TempDir
    Path tempDir;

    @BeforeEach
    void configurePaths() {
        ReflectionTestUtils.setField(videoService, "uploadBaseDir", tempDir.toString());
        ReflectionTestUtils.setField(videoService, "videoTranscodeQueue", "video.transcode.queue");
        ReflectionTestUtils.setField(videoService, "r2StorageService", r2StorageService);
    }

    @Test
    @DisplayName("Tự động cập nhật StudentDailyProgress khi học sinh xem xong video bài học (>= 80%) mà không cộng streak bài tập ngày")
    void should_UpdateDailyProgressAndRecordStreak_when_VideoWatchCompleted() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID videoId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();

        Lesson lesson = Lesson.builder()
                .id(lessonId)
                .title("Unit 1 - Introduction to IELTS")
                .build();

        Video video = Video.builder()
                .id(videoId)
                .lesson(lesson)
                .durationSeconds(100) // 100 seconds
                .build();

        Student student = Student.builder().id(studentId).build();

        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));
        when(entityManager.getReference(Student.class, studentId)).thenReturn(student);
        when(watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId)).thenReturn(Optional.empty());

        // DailyPlanItem gắn với lesson
        UUID planId = UUID.randomUUID();
        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(1)
                .build();
        DailyPlanItem item = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .dailyPlan(plan)
                .title("Watch Video Unit 1")
                .build();

        when(dailyPlanItemRepository.findByLessonIdWithDailyPlan(lessonId)).thenReturn(List.of(item));
        when(studentDailyProgressRepository.findByStudentIdAndDailyPlanId(studentId, planId)).thenReturn(Optional.empty());

        WatchProgressRequest request = new WatchProgressRequest();
        request.setWatchedSeconds(85); // 85% >= 80%
        request.setCompleted(false);

        // When
        videoService.updateWatchProgress(studentId, videoId, request);

        // Then
        // 1. Kiểm tra lưu VideoWatchHistory completed
        ArgumentCaptor<VideoWatchHistory> historyCaptor = ArgumentCaptor.forClass(VideoWatchHistory.class);
        verify(watchHistoryRepository).save(historyCaptor.capture());
        VideoWatchHistory savedHistory = historyCaptor.getValue();
        assertThat(savedHistory.getIsCompleted()).isTrue();
        assertThat(savedHistory.getWatchedSeconds()).isEqualTo(85);

        // 2. Kiểm tra cập nhật StudentDailyProgress completed = true
        ArgumentCaptor<StudentDailyProgress> progressCaptor = ArgumentCaptor.forClass(StudentDailyProgress.class);
        verify(studentDailyProgressRepository).save(progressCaptor.capture());
        StudentDailyProgress savedProgress = progressCaptor.getValue();
        assertThat(savedProgress.getIsCompleted()).isTrue();
        assertThat(savedProgress.getCompletedAt()).isNotNull();
        assertThat(savedProgress.getTimeSpentSeconds()).isEqualTo(85);
    }

    @Test
    @DisplayName("uploadOriginalVideo báo BadRequestException khi file null hoặc rỗng")
    void should_ThrowBadRequestException_when_UploadedVideoEmpty() {
        UUID lessonId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.mp4", "video/mp4", new byte[0]);

        assertThatThrownBy(() -> videoService.uploadOriginalVideo(lessonId, null, userId))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> videoService.uploadOriginalVideo(lessonId, emptyFile, userId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("uploadOriginalVideo kích hoạt fallback khi thiếu FFmpeg và fallback chạy trực tiếp nếu RabbitMQ lỗi")
    void should_HandleFfmpegMissingFallbackAndRabbitMqFailureOnUpload() {
        UUID lessonId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        User uploader = User.builder().id(userId).email("t@english.com").password("h").build();
        Lesson lesson = Lesson.builder().id(lessonId).title("Unit 1").build();
        MockMultipartFile mp4 = new MockMultipartFile("file", "intro.mp4", "video/mp4", "bytes".getBytes());

        when(entityManager.getReference(User.class, userId)).thenReturn(uploader);
        when(entityManager.getReference(Lesson.class, lessonId)).thenReturn(lesson);
        when(videoRepository.findByLessonId(lessonId)).thenReturn(Optional.empty());
        when(videoRepository.saveAndFlush(any(Video.class))).thenAnswer(inv -> {
            Video v = inv.getArgument(0);
            v.setId(UUID.randomUUID());
            return v;
        });

        // Case 1: Thiếu FFmpeg -> fallback trực tiếp
        when(videoTranscodeConsumer.isFfmpegAvailable()).thenReturn(false);
        VideoUploadResponse fallbackRes = videoService.uploadOriginalVideo(lessonId, mp4, userId);
        assertThat(fallbackRes.getMessage()).contains("Fallback");
        verify(videoTranscodeConsumer).handleFallbackToRaw(any(Video.class));
        verifyNoInteractions(rabbitTemplate);

        // Case 2: Có FFmpeg, RabbitMQ gửi thất bại -> chuyển sang processVideoTranscode trực tiếp
        reset(videoTranscodeConsumer);
        when(videoTranscodeConsumer.isFfmpegAvailable()).thenReturn(true);
        doThrow(new RuntimeException("Broker down")).when(rabbitTemplate).convertAndSend(eq("video.transcode.queue"), any(VideoTranscodeMessage.class));

        Video existing = Video.builder().id(UUID.randomUUID()).lesson(lesson).status(VideoStatus.APPROVED).build();
        when(videoRepository.findByLessonId(lessonId)).thenReturn(Optional.of(existing));

        VideoUploadResponse hlsRes = videoService.uploadOriginalVideo(lessonId, mp4, userId);
        assertThat(hlsRes.getStatus()).isEqualTo(VideoStatus.PROCESSING);
        assertThat(hlsRes.getMessage()).contains("HLS");
        verify(videoTranscodeConsumer).processVideoTranscode(any(VideoTranscodeMessage.class));

        // Case 3: Khi có taskExecutor, lỗi RabbitMQ không block HTTP thread mà đẩy sang executor nền
        reset(videoTranscodeConsumer);
        when(videoTranscodeConsumer.isFfmpegAvailable()).thenReturn(true);
        java.util.List<Runnable> scheduledTasks = new java.util.ArrayList<>();
        ReflectionTestUtils.setField(videoService, "taskExecutor", (java.util.concurrent.Executor) scheduledTasks::add);

        VideoUploadResponse asyncRes = videoService.uploadOriginalVideo(lessonId, mp4, userId);
        assertThat(asyncRes.getStatus()).isEqualTo(VideoStatus.PROCESSING);
        verify(videoTranscodeConsumer, never()).processVideoTranscode(any(VideoTranscodeMessage.class));
        assertThat(scheduledTasks).hasSize(1);
        scheduledTasks.get(0).run();
        verify(videoTranscodeConsumer).processVideoTranscode(any(VideoTranscodeMessage.class));
    }

    @Test
    @DisplayName("getVideoById tự khôi phục lỗi FFmpeg, chuẩn hóa URL localhost:8080/rỗng và ném 404 khi thiếu video")
    void should_HealAndNormalizePlaybackUrls_and_ThrowWhenNotFound() throws java.io.IOException {
        UUID missingId = UUID.randomUUID();
        when(videoRepository.findById(missingId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> videoService.getVideoById(missingId))
                .isInstanceOf(ResourceNotFoundException.class);

        UUID v1Id = UUID.randomUUID();
        Video rejectedByFfmpeg = Video.builder()
                .id(v1Id)
                .status(VideoStatus.REJECTED)
                .rejectionReason("Cannot run program \"ffmpeg\": CreateProcess error=2")
                .hlsPlaylistUrl("http://localhost:8080/uploads/v1.m3u8")
                .build();
        when(videoRepository.findById(v1Id)).thenReturn(Optional.of(rejectedByFfmpeg));

        Video healed = videoService.getVideoById(v1Id);
        verify(videoTranscodeConsumer).handleFallbackToRaw(rejectedByFfmpeg);
        assertThat(healed.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + v1Id + "/raw");
        verify(videoRepository).save(rejectedByFfmpeg);

        UUID v2Id = UUID.randomUUID();
        Video approvedNoHls = Video.builder()
                .id(v2Id)
                .status(VideoStatus.APPROVED)
                .rawStorageUrl("/raw/v2.mp4")
                .hlsPlaylistUrl(" ")
                .build();
        when(videoRepository.findById(v2Id)).thenReturn(Optional.of(approvedNoHls));

        Video normalized = videoService.getVideoById(v2Id);
        assertThat(normalized.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + v2Id + "/raw");

        UUID v3Id = UUID.randomUUID();
        java.nio.file.Files.createDirectories(tempDir.resolve("hls").resolve(v3Id.toString()));
        Video brokenHlsDirVideo = Video.builder()
                .id(v3Id)
                .status(VideoStatus.APPROVED)
                .rawStorageUrl("/raw/v3.mp4")
                .hlsPlaylistUrl("/api/v1/videos/" + v3Id + "/hls/master.m3u8")
                .build();
        when(videoRepository.findById(v3Id)).thenReturn(Optional.of(brokenHlsDirVideo));

        Video healedBrokenHls = videoService.getVideoById(v3Id);
        assertThat(healedBrokenHls.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + v3Id + "/raw");
    }

    @Test
    @DisplayName("updateWatchProgress không đánh dấu hoàn thành nếu xem dưới 80% và completed=false")
    void should_NotCompleteOrTriggerStreak_when_WatchedBelow80Percent() {
        UUID studentId = UUID.randomUUID();
        UUID videoId = UUID.randomUUID();
        Video video = Video.builder().id(videoId).durationSeconds(100).build();
        Student student = Student.builder().id(studentId).build();

        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));
        when(entityManager.getReference(Student.class, studentId)).thenReturn(student);
        when(watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId)).thenReturn(Optional.empty());

        WatchProgressRequest req = new WatchProgressRequest();
        req.setWatchedSeconds(40);
        req.setCompleted(false);

        videoService.updateWatchProgress(studentId, videoId, req);

        ArgumentCaptor<VideoWatchHistory> captor = ArgumentCaptor.forClass(VideoWatchHistory.class);
        verify(watchHistoryRepository).save(captor.capture());
        assertThat(captor.getValue().getIsCompleted()).isFalse();
        assertThat(captor.getValue().getCompletionPercentage()).isEqualTo(40.0f);
        verifyNoInteractions(dailyPlanItemRepository);
    }

    @Test
    @DisplayName("Kiểm duyệt, lấy theo lessonId, tiến độ mặc định, lọc theo status và xóa video")
    void should_HandleModerationLookupAndDeleteOperations() {
        UUID lessonId = UUID.randomUUID();
        UUID videoId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        User reviewer = User.builder().id(reviewerId).email("admin@english.com").password("h").build();
        Video video = Video.builder().id(videoId).status(VideoStatus.PENDING_REVIEW).build();

        when(videoRepository.findByLessonId(lessonId)).thenReturn(Optional.of(video)).thenReturn(Optional.empty());
        assertThat(videoService.getVideoByLessonId(lessonId)).isEqualTo(video);
        assertThat(videoService.getVideoByLessonId(lessonId)).isNull();

        when(watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId)).thenReturn(Optional.empty());
        VideoWatchHistory defaultProgress = videoService.getWatchProgress(studentId, videoId);
        assertThat(defaultProgress.getWatchedSeconds()).isZero();
        assertThat(defaultProgress.getIsCompleted()).isFalse();

        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));
        when(entityManager.getReference(User.class, reviewerId)).thenReturn(reviewer);
        when(videoRepository.save(any(Video.class))).thenAnswer(inv -> inv.getArgument(0));

        Video rejected = videoService.reviewVideo(videoId, reviewerId, false, "Âm thanh bị rè");
        assertThat(rejected.getStatus()).isEqualTo(VideoStatus.REJECTED);
        assertThat(rejected.getRejectionReason()).isEqualTo("Âm thanh bị rè");

        Video approved = videoService.reviewVideo(videoId, reviewerId, true, null);
        assertThat(approved.getStatus()).isEqualTo(VideoStatus.APPROVED);
        assertThat(approved.getRejectionReason()).isNull();

        when(videoRepository.findAll()).thenReturn(List.of(approved));
        when(videoRepository.findByStatus(VideoStatus.APPROVED)).thenReturn(List.of(approved));
        assertThat(videoService.getVideosByStatus(VideoStatus.APPROVED)).containsExactly(approved);
        assertThat(videoService.getVideosByStatus(null)).containsExactly(approved);

        videoService.deleteVideo(videoId);
        verify(videoRepository).delete(video);
    }

    @Test
    @DisplayName("Chuẩn hóa URL R2 về proxy backend, giữ URL ngoài và không hạ cấp video R2 khi vắng thư mục local")
    void should_NormalizeManagedR2UrlsToBackendProxyAndPreserveExternalUrls() {
        UUID r2HlsId = UUID.randomUUID();
        String r2MasterUrl = "https://pub-test.r2.dev/hls/" + r2HlsId + "/master.m3u8";
        String r2RawUrl = "https://pub-test.r2.dev/raw/" + r2HlsId + "/lecture.mp4";
        Video r2HlsVideo = Video.builder()
                .id(r2HlsId)
                .status(VideoStatus.APPROVED)
                .hlsPlaylistUrl(r2MasterUrl)
                .rawStorageUrl(r2RawUrl)
                .build();
        when(r2StorageService.isManagedPublicUrl(r2MasterUrl)).thenReturn(true);
        when(r2StorageService.isManagedPublicUrl(r2RawUrl)).thenReturn(true);
        when(r2StorageService.extractObjectKey(r2MasterUrl)).thenReturn("hls/" + r2HlsId + "/master.m3u8");
        when(videoRepository.findById(r2HlsId)).thenReturn(Optional.of(r2HlsVideo));

        Video normalizedR2 = videoService.getVideoById(r2HlsId);
        assertThat(normalizedR2.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + r2HlsId + "/hls/master.m3u8");
        verify(videoRepository).save(r2HlsVideo);

        // Nếu hlsPlaylistUrl trỏ tới raw MP4 trên R2 -> chuẩn hóa về /raw
        UUID r2RawOnlyId = UUID.randomUUID();
        String r2FallbackUrl = "https://pub-test.r2.dev/raw/" + r2RawOnlyId + "/clip.mp4";
        Video r2RawVideo = Video.builder()
                .id(r2RawOnlyId)
                .status(VideoStatus.PENDING_REVIEW)
                .hlsPlaylistUrl(r2FallbackUrl)
                .rawStorageUrl(r2FallbackUrl)
                .build();
        when(r2StorageService.isManagedPublicUrl(r2FallbackUrl)).thenReturn(true);
        when(r2StorageService.extractObjectKey(r2FallbackUrl)).thenReturn("raw/" + r2RawOnlyId + "/clip.mp4");
        when(videoRepository.findById(r2RawOnlyId)).thenReturn(Optional.of(r2RawVideo));

        assertThat(videoService.getVideoById(r2RawOnlyId).getHlsPlaylistUrl())
                .isEqualTo("/api/v1/videos/" + r2RawOnlyId + "/raw");

        // 127.0.0.1:8080 được chuẩn hóa sang relative URL
        UUID loopbackId = UUID.randomUUID();
        Video loopbackVideo = Video.builder()
                .id(loopbackId)
                .status(VideoStatus.APPROVED)
                .hlsPlaylistUrl("http://127.0.0.1:8080/api/v1/videos/" + loopbackId + "/hls/master.m3u8")
                .build();
        java.nio.file.Path localMaster = tempDir.resolve("hls").resolve(loopbackId.toString()).resolve("master.m3u8");
        try {
            java.nio.file.Files.createDirectories(localMaster.getParent());
            java.nio.file.Files.writeString(localMaster, "#EXTM3U");
        } catch (java.io.IOException ignored) {
        }
        when(videoRepository.findById(loopbackId)).thenReturn(Optional.of(loopbackVideo));
        assertThat(videoService.getVideoById(loopbackId).getHlsPlaylistUrl())
                .isEqualTo("/api/v1/videos/" + loopbackId + "/hls/master.m3u8");

        // External CDN URL (như test-streams.mux.dev) giữ nguyên hoàn toàn
        UUID externalId = UUID.randomUUID();
        String externalUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
        Video externalVideo = Video.builder()
                .id(externalId)
                .status(VideoStatus.APPROVED)
                .hlsPlaylistUrl(externalUrl)
                .rawStorageUrl(externalUrl)
                .build();
        when(r2StorageService.isManagedPublicUrl(externalUrl)).thenReturn(false);
        when(videoRepository.findById(externalId)).thenReturn(Optional.of(externalVideo));

        assertThat(videoService.getVideoById(externalId).getHlsPlaylistUrl()).isEqualTo(externalUrl);
        verify(videoRepository, never()).save(externalVideo);
    }

    @Test
    @DisplayName("openHlsStream & openRawStream chỉ stream qua R2 với asset do backend quản lý")
    void should_OpenHlsAndRawStreamsOnlyForManagedR2Urls() {
        UUID videoId = UUID.randomUUID();
        when(r2StorageService.isConfigured()).thenReturn(true);
        R2ObjectStream hlsStream = new R2ObjectStream(
                new ByteArrayInputStream("#EXTM3U".getBytes(StandardCharsets.UTF_8)),
                7L,
                7L,
                null,
                "application/vnd.apple.mpegurl",
                false,
                false
        );
        when(r2StorageService.openObjectStream("hls/" + videoId + "/master.m3u8", null, false))
                .thenReturn(Optional.of(hlsStream));

        assertThat(videoService.openHlsStream(videoId, "master.m3u8", null, false)).contains(hlsStream);

        String managedRawUrl = "https://pub-test.r2.dev/raw/" + videoId + "/v.mp4";
        Video managedVideo = Video.builder().id(videoId).rawStorageUrl(managedRawUrl).build();
        R2ObjectStream rawStream = new R2ObjectStream(
                new ByteArrayInputStream("1234".getBytes(StandardCharsets.UTF_8)),
                4L,
                10L,
                "bytes 0-3/10",
                "video/mp4",
                true,
                false
        );
        when(r2StorageService.isManagedPublicUrl(managedRawUrl)).thenReturn(true);
        when(r2StorageService.extractObjectKey(managedRawUrl)).thenReturn("raw/" + videoId + "/v.mp4");
        when(r2StorageService.openObjectStream("raw/" + videoId + "/v.mp4", "bytes=0-3", false))
                .thenReturn(Optional.of(rawStream));

        assertThat(videoService.openRawStream(managedVideo, "bytes=0-3", false)).contains(rawStream);

        Video externalVideo = Video.builder().id(videoId).rawStorageUrl("https://cdn.example.com/raw/v.mp4").build();
        when(r2StorageService.isManagedPublicUrl("https://cdn.example.com/raw/v.mp4")).thenReturn(false);
        assertThat(videoService.openRawStream(externalVideo, null, false)).isEmpty();
    }

    @Test
    @DisplayName("reviewVideo chặn phê duyệt video đang PROCESSING hoặc DRAFT chưa sẵn sàng phát")
    void should_RejectApprovingProcessingOrUnreadyDraftVideo() {
        UUID reviewerId = UUID.randomUUID();

        UUID processingId = UUID.randomUUID();
        Video processingVideo = Video.builder().id(processingId).status(VideoStatus.PROCESSING).build();
        when(videoRepository.findById(processingId)).thenReturn(Optional.of(processingVideo));

        assertThatThrownBy(() -> videoService.reviewVideo(processingId, reviewerId, true, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("xử lý");

        UUID draftId = UUID.randomUUID();
        Video draftVideo = Video.builder().id(draftId).status(VideoStatus.DRAFT).hlsPlaylistUrl(" ").build();
        when(videoRepository.findById(draftId)).thenReturn(Optional.of(draftVideo));

        assertThatThrownBy(() -> videoService.reviewVideo(draftId, reviewerId, true, null))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("getVideosByUploader lọc theo người tải lên, trạng thái và chuẩn hóa URL fallback cho video PENDING_REVIEW")
    void should_FilterByUploaderAndStatusAndNormalizePendingPlaybackUrl() {
        UUID uploaderId = UUID.randomUUID();
        UUID pendingId = UUID.randomUUID();
        UUID rejectedId = UUID.randomUUID();

        Video pendingWithoutHls = Video.builder()
                .id(pendingId)
                .status(VideoStatus.PENDING_REVIEW)
                .rawStorageUrl("/raw/pending.mp4")
                .hlsPlaylistUrl(" ")
                .build();
        Video rejectedWithHls = Video.builder()
                .id(rejectedId)
                .status(VideoStatus.REJECTED)
                .rawStorageUrl("/raw/rejected.mp4")
                .hlsPlaylistUrl("/api/v1/videos/" + rejectedId + "/raw")
                .rejectionReason("Cần cắt đoạn đầu")
                .build();

        when(videoRepository.findByUploadedByIdOrderByCreatedAtDesc(uploaderId))
                .thenReturn(List.of(pendingWithoutHls, rejectedWithHls));
        when(videoRepository.findByUploadedByIdAndStatusOrderByCreatedAtDesc(uploaderId, VideoStatus.PENDING_REVIEW))
                .thenReturn(List.of(pendingWithoutHls));

        List<Video> allUploads = videoService.getVideosByUploader(uploaderId, null);
        assertThat(allUploads).hasSize(2);
        assertThat(allUploads.get(0).getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + pendingId + "/raw");
        verify(videoRepository).save(pendingWithoutHls);

        List<Video> pendingOnly = videoService.getVideosByUploader(uploaderId, VideoStatus.PENDING_REVIEW);
        assertThat(pendingOnly).containsExactly(pendingWithoutHls);
        verify(videoRepository).findByUploadedByIdAndStatusOrderByCreatedAtDesc(uploaderId, VideoStatus.PENDING_REVIEW);
    }

    @Test
    @DisplayName("uploadOriginalVideo: dọn dẹp file local/R2 cũ khi ghi đè video bài học, chuẩn hóa tên file & chạy afterCommit khi có transaction")
    void uploadOriginalVideo_cleansUpReplacedArtifactsAndDispatchesAfterCommit() throws Exception {
        UUID lessonId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID existingVideoId = UUID.randomUUID();
        User uploader = User.builder().id(userId).build();
        Lesson lesson = Lesson.builder().id(lessonId).build();

        Path oldHlsDir = tempDir.resolve("hls").resolve(existingVideoId.toString());
        java.nio.file.Files.createDirectories(oldHlsDir);
        java.nio.file.Files.writeString(oldHlsDir.resolve("master.m3u8"), "#EXTM3U");

        String oldR2Raw = "https://pub-test.r2.dev/raw/" + existingVideoId + "/old.mp4";
        String oldR2Hls = "https://pub-test.r2.dev/hls/" + existingVideoId + "/master.m3u8";
        Video existingVideo = Video.builder()
                .id(existingVideoId)
                .lesson(lesson)
                .rawStorageUrl(oldR2Raw)
                .hlsPlaylistUrl(oldR2Hls)
                .status(VideoStatus.APPROVED)
                .build();

        when(entityManager.getReference(User.class, userId)).thenReturn(uploader);
        when(entityManager.getReference(Lesson.class, lessonId)).thenReturn(lesson);
        when(videoRepository.findByLessonId(lessonId)).thenReturn(Optional.of(existingVideo));
        when(videoRepository.saveAndFlush(any(Video.class))).thenAnswer(inv -> inv.getArgument(0));
        when(r2StorageService.isConfigured()).thenReturn(true);
        when(r2StorageService.isManagedPublicUrl(oldR2Raw)).thenReturn(true);
        when(r2StorageService.isManagedPublicUrl(oldR2Hls)).thenReturn(true);
        when(videoTranscodeConsumer.isFfmpegAvailable()).thenReturn(true);
        doThrow(new RuntimeException("RabbitMQ down"))
                .when(rabbitTemplate).convertAndSend(eq("video.transcode.queue"), any(VideoTranscodeMessage.class));

        java.util.List<Runnable> executedTasks = new java.util.ArrayList<>();
        ReflectionTestUtils.setField(videoService, "taskExecutor", (java.util.concurrent.Executor) executedTasks::add);

        MockMultipartFile noExtFile = new MockMultipartFile("file", "   ", "video/mp4", "video-bytes".getBytes());

        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            VideoUploadResponse res = videoService.uploadOriginalVideo(lessonId, noExtFile, userId);
            assertThat(res.getOriginalFileName()).isEqualTo("lesson_video.mp4");
            assertThat(java.nio.file.Files.exists(oldHlsDir)).isFalse();
            verify(r2StorageService).deleteObjectByUrlOrKey(oldR2Raw);
            verify(r2StorageService).deleteObjectsByPrefix("hls/" + existingVideoId + "/");

            // Chưa commit -> task chưa được đẩy vào taskExecutor
            assertThat(executedTasks).isEmpty();
            for (var sync : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
            assertThat(executedTasks).hasSize(1);
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("updateWatchProgress: giữ mốc watchedSeconds cao nhất, kẹp completionPercentage <= 100% và cộng dồn timeSpentSeconds khi completed=true")
    void updateWatchProgress_preservesMaxWatchedClampsPercentageAndAccumulatesDailyTime() {
        UUID studentId = UUID.randomUUID();
        UUID videoId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();

        Lesson lesson = Lesson.builder().id(lessonId).title("Unit 2").build();
        Video video = Video.builder().id(videoId).lesson(lesson).durationSeconds(100).build();
        Student student = Student.builder().id(studentId).build();
        VideoWatchHistory existingHistory = VideoWatchHistory.builder()
                .student(student)
                .video(video)
                .watchedSeconds(70)
                .completionPercentage(70.0f)
                .isCompleted(false)
                .build();

        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));
        when(entityManager.getReference(Student.class, studentId)).thenReturn(student);
        when(watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId))
                .thenReturn(Optional.of(existingHistory));

        DailyStudyPlan plan = DailyStudyPlan.builder().id(planId).dayNumber(2).build();
        DailyPlanItem item = DailyPlanItem.builder().id(UUID.randomUUID()).dailyPlan(plan).build();
        StudentDailyProgress existingDaily = StudentDailyProgress.builder()
                .student(student)
                .dailyPlan(plan)
                .timeSpentSeconds(30)
                .completedItemsCount(0)
                .totalItemsCount(1)
                .isCompleted(false)
                .build();

        when(dailyPlanItemRepository.findByLessonIdWithDailyPlan(lessonId)).thenReturn(List.of(item));
        when(studentDailyProgressRepository.findByStudentIdAndDailyPlanId(studentId, planId))
                .thenReturn(Optional.of(existingDaily));

        // Gửi watchedSeconds=30 (< 70 hiện có) nhưng completed=true -> giữ 70s, vẫn đánh dấu hoàn thành & cộng dồn 30 + 70 = 100s
        WatchProgressRequest rewindCompletedReq = new WatchProgressRequest();
        rewindCompletedReq.setWatchedSeconds(30);
        rewindCompletedReq.setCompleted(true);

        videoService.updateWatchProgress(studentId, videoId, rewindCompletedReq);

        assertThat(existingHistory.getWatchedSeconds()).isEqualTo(70);
        assertThat(existingHistory.getCompletionPercentage()).isEqualTo(70.0f);
        assertThat(existingHistory.getIsCompleted()).isTrue();
        assertThat(existingDaily.getIsCompleted()).isTrue();
        assertThat(existingDaily.getTimeSpentSeconds()).isEqualTo(100);

        // Gửi watchedSeconds=150 (> duration 100) -> kẹp completionPercentage = 100.0f
        WatchProgressRequest overWatchedReq = new WatchProgressRequest();
        overWatchedReq.setWatchedSeconds(150);
        overWatchedReq.setCompleted(false);

        videoService.updateWatchProgress(studentId, videoId, overWatchedReq);
        assertThat(existingHistory.getWatchedSeconds()).isEqualTo(150);
        assertThat(existingHistory.getCompletionPercentage()).isEqualTo(100.0f);
    }
}
