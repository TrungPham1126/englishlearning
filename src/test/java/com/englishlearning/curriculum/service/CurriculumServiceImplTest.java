package com.englishlearning.curriculum.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.curriculum.dto.LessonDetailResponse;
import com.englishlearning.curriculum.dto.LessonResponse;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.repository.GrammarTopicRepository;
import com.englishlearning.curriculum.repository.LessonDocumentRepository;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.repository.VocabularyItemRepository;
import com.englishlearning.curriculum.service.impl.CurriculumServiceImpl;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("CurriculumServiceImpl - Bổ sung tiến độ thực tế vào LessonResponse & LessonDetailResponse")
class CurriculumServiceImplTest {

    @Mock
    private LessonRepository lessonRepository;

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private LessonDocumentRepository documentRepository;

    @Mock
    private GrammarTopicRepository grammarTopicRepository;

    @Mock
    private VocabularyItemRepository vocabularyRepository;

    @Mock
    private DocumentStorageService storageService;

    @Mock
    private VideoRepository videoRepository;

    @Mock
    private VideoWatchHistoryRepository watchHistoryRepository;

    @Mock
    private AssignmentRepository assignmentRepository;

    @Mock
    private AssignmentAttemptRepository attemptRepository;

    @InjectMocks
    private CurriculumServiceImpl curriculumService;

    private final UUID studentId = UUID.randomUUID();
    private final UUID classId = UUID.randomUUID();
    private final UUID lessonId = UUID.randomUUID();

    @BeforeEach
    void setUpSecurity() {
        User user = User.builder()
                .id(studentId)
                .email("student@test.com")
                .password("password")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void tearDownSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("getLessonsByClass() trả về đúng completed, progressPercentage, watchedSeconds cho học sinh đang đăng nhập")
    void should_ReturnLessonProgress_when_StudentFetchesClassLessons() {
        // Given
        Classroom classroom = Classroom.builder().id(classId).name("Test Class").build();
        Lesson lesson = Lesson.builder()
                .id(lessonId)
                .classroom(classroom)
                .title("Lesson 1: Greetings")
                .build();

        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId))
                .thenReturn(List.of(lesson));

        // Video: xem được 60 giây (60%), chưa xong video
        UUID videoId = UUID.randomUUID();
        Video video = Video.builder().id(videoId).durationSeconds(100).build();
        when(videoRepository.findByLessonId(lessonId)).thenReturn(Optional.of(video));

        VideoWatchHistory watchHistory = VideoWatchHistory.builder()
                .watchedSeconds(60)
                .completionPercentage(60.0f)
                .isCompleted(false)
                .build();
        when(watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId))
                .thenReturn(Optional.of(watchHistory));

        // Assignment: 1 assignment, đã hoàn thành
        UUID assignmentId = UUID.randomUUID();
        Assignment assignment = Assignment.builder().id(assignmentId).title("HW 1").build();
        when(assignmentRepository.findByLessonId(lessonId)).thenReturn(List.of(assignment));

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .status(AttemptStatus.COMPLETED)
                .build();
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assignmentId))
                .thenReturn(List.of(attempt));

        // When
        List<LessonResponse> responses = curriculumService.getLessonsByClass(classId);

        // Then
        assertThat(responses).hasSize(1);
        LessonResponse resp = responses.get(0);
        assertThat(resp.getWatchedSeconds()).isEqualTo(60);
        // Video 60% + Assignment 100% -> trung bình 80%
        assertThat(resp.getProgressPercentage()).isEqualTo(80);
        assertThat(resp.isCompleted()).isFalse();
    }

    @Test
    @DisplayName("getLessonDetail() trả về đầy đủ tiến độ và đánh dấu hoàn thành khi cả video và bài tập đã xong")
    void should_ReturnCompletedTrue_when_BothVideoAndAssignmentsAreCompleted() {
        // Given
        Classroom classroom = Classroom.builder().id(classId).name("Test Class").build();
        Lesson lesson = Lesson.builder()
                .id(lessonId)
                .classroom(classroom)
                .title("Lesson 2: Daily Routines")
                .build();

        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(lesson));
        when(documentRepository.findByLessonId(lessonId)).thenReturn(Collections.emptyList());
        when(vocabularyRepository.findByLessonId(lessonId)).thenReturn(Collections.emptyList());
        when(grammarTopicRepository.findByLessonId(lessonId)).thenReturn(Collections.emptyList());

        // Video đã hoàn thành 100%
        UUID videoId = UUID.randomUUID();
        Video video = Video.builder().id(videoId).durationSeconds(120).build();
        when(videoRepository.findByLessonId(lessonId)).thenReturn(Optional.of(video));

        VideoWatchHistory watchHistory = VideoWatchHistory.builder()
                .watchedSeconds(120)
                .completionPercentage(100.0f)
                .isCompleted(true)
                .build();
        when(watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId))
                .thenReturn(Optional.of(watchHistory));

        // 1 Assignment đã nộp
        UUID assignmentId = UUID.randomUUID();
        Assignment assignment = Assignment.builder().id(assignmentId).title("HW 2").build();
        when(assignmentRepository.findByLessonId(lessonId)).thenReturn(List.of(assignment));

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .status(AttemptStatus.SUBMITTED)
                .build();
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assignmentId))
                .thenReturn(List.of(attempt));

        // When
        LessonDetailResponse detail = curriculumService.getLessonDetail(lessonId);

        // Then
        assertThat(detail.isCompleted()).isTrue();
        assertThat(detail.getProgressPercentage()).isEqualTo(100);
        assertThat(detail.getWatchedSeconds()).isEqualTo(120);
    }
}
