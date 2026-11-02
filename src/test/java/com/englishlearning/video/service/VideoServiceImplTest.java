package com.englishlearning.video.service;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import com.englishlearning.curriculum.service.UserStreakService;
import com.englishlearning.video.consumer.VideoTranscodeConsumer;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import com.englishlearning.video.service.impl.VideoServiceImpl;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
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
}
