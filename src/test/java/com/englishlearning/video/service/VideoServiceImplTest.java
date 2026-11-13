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
import com.englishlearning.curriculum.service.UserStreakService;
import com.englishlearning.video.consumer.VideoTranscodeConsumer;
import com.englishlearning.video.dto.VideoTranscodeMessage;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
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
    private UserStreakService userStreakService;

    @InjectMocks
    private VideoServiceImpl videoService;

    @TempDir
    Path tempDir;

    @BeforeEach
    void configurePaths() {
        ReflectionTestUtils.setField(videoService, "uploadBaseDir", tempDir.toString());
        ReflectionTestUtils.setField(videoService, "videoTranscodeQueue", "video.transcode.queue");
    }

    @Test
    @DisplayName("Tự động cập nhật StudentDailyProgress và Streak khi học sinh xem xong video bài học (>= 80%)")
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

        // 3. Kiểm tra gọi Streak
        verify(userStreakService).recordActivity(studentId);
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
        assertThat(hlsRes.getMessage()).contains("HLS");
        verify(videoTranscodeConsumer).processVideoTranscode(any(VideoTranscodeMessage.class));
    }

    @Test
    @DisplayName("getVideoById tự khôi phục lỗi FFmpeg, chuẩn hóa URL localhost:8080/rỗng và ném 404 khi thiếu video")
    void should_HealAndNormalizePlaybackUrls_and_ThrowWhenNotFound() {
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
        verifyNoInteractions(userStreakService, dailyPlanItemRepository);
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
}
