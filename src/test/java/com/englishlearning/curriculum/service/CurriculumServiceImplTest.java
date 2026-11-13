package com.englishlearning.curriculum.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.entity.*;
import com.englishlearning.curriculum.repository.GrammarTopicRepository;
import com.englishlearning.curriculum.repository.LessonDocumentRepository;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.repository.VocabularyItemRepository;
import com.englishlearning.curriculum.service.impl.CurriculumServiceImpl;
import com.englishlearning.notification.service.NotificationService;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

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

    @Mock
    private NotificationService notificationService;

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

    @Test
    @DisplayName("createLesson, updateLesson & deleteLesson - Xử lý CRUD và mặc định orderIndex = 0")
    void lessonCrud_allBranches() {
        Classroom classroom = Classroom.builder().id(classId).build();
        LessonRequest req = new LessonRequest();
        req.setClassId(classId);
        req.setTitle("Lesson Zero");
        req.setObjectives("Obj");
        req.setContent("Content");
        req.setOrderIndex(null);

        when(classroomRepository.findById(classId)).thenReturn(Optional.of(classroom));
        when(lessonRepository.save(any(Lesson.class))).thenAnswer(inv -> {
            Lesson l = inv.getArgument(0);
            if (l.getId() == null) l.setId(lessonId);
            return l;
        });

        LessonResponse created = curriculumService.createLesson(req);
        assertThat(created.getOrderIndex()).isZero();
        assertThat(created.getTitle()).isEqualTo("Lesson Zero");

        UUID missingClass = UUID.randomUUID();
        req.setClassId(missingClass);
        when(classroomRepository.findById(missingClass)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> curriculumService.createLesson(req))
                .isInstanceOf(ResourceNotFoundException.class);

        // Update preserving null orderIndex then changing it
        Lesson existing = Lesson.builder()
                .id(lessonId)
                .classroom(classroom)
                .title("Old Title")
                .orderIndex(5)
                .updatedAt(Instant.now())
                .build();
        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(existing));

        LessonUpdateRequest updKeepOrder = new LessonUpdateRequest();
        updKeepOrder.setTitle("Updated Title");
        updKeepOrder.setObjectives("New Obj");
        updKeepOrder.setContent("New Content");
        updKeepOrder.setOrderIndex(null);

        LessonResponse updated = curriculumService.updateLesson(lessonId, updKeepOrder);
        assertThat(updated.getTitle()).isEqualTo("Updated Title");
        assertThat(updated.getOrderIndex()).isEqualTo(5);

        updKeepOrder.setOrderIndex(9);
        assertThat(curriculumService.updateLesson(lessonId, updKeepOrder).getOrderIndex()).isEqualTo(9);

        curriculumService.deleteLesson(lessonId);
        verify(lessonRepository).delete(existing);

        UUID missingLesson = UUID.randomUUID();
        when(lessonRepository.findById(missingLesson)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> curriculumService.updateLesson(missingLesson, updKeepOrder))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> curriculumService.deleteLesson(missingLesson))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> curriculumService.getLessonDetail(missingLesson))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getLessonsByClass - Teacher/Unauthenticated trả 0%, Video-only >= 80% tính completed, Assignment-only tính theo số bài xong")
    void lessonProgressVariants_allBranches() {
        Classroom classroom = Classroom.builder().id(classId).build();
        UUID videoOnlyLessonId = UUID.randomUUID();
        UUID assignOnlyLessonId = UUID.randomUUID();
        UUID emptyLessonId = UUID.randomUUID();

        Lesson lVideo = Lesson.builder().id(videoOnlyLessonId).classroom(classroom).title("Video Only").orderIndex(1).build();
        Lesson lAssign = Lesson.builder().id(assignOnlyLessonId).classroom(classroom).title("Assign Only").orderIndex(2).build();
        Lesson lEmpty = Lesson.builder().id(emptyLessonId).classroom(classroom).title("Empty").orderIndex(3).build();

        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId))
                .thenReturn(List.of(lVideo, lAssign, lEmpty));

        // 1. Video-only: 85/100s -> auto complete >= 80% -> progress = 100%, completed = true
        UUID videoId = UUID.randomUUID();
        Video v = Video.builder().id(videoId).durationSeconds(100).build();
        when(videoRepository.findByLessonId(videoOnlyLessonId)).thenReturn(Optional.of(v));
        when(watchHistoryRepository.findByStudentIdAndVideoId(studentId, videoId)).thenReturn(Optional.of(
                VideoWatchHistory.builder().watchedSeconds(85).completionPercentage(85.0f).isCompleted(false).build()));
        when(assignmentRepository.findByLessonId(videoOnlyLessonId)).thenReturn(Collections.emptyList());

        // 2. Assignment-only: 1 completed, 1 IN_PROGRESS -> 50%, completed = false
        UUID a1 = UUID.randomUUID();
        UUID a2 = UUID.randomUUID();
        when(videoRepository.findByLessonId(assignOnlyLessonId)).thenReturn(Optional.empty());
        when(assignmentRepository.findByLessonId(assignOnlyLessonId)).thenReturn(List.of(
                Assignment.builder().id(a1).build(), Assignment.builder().id(a2).build()));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, a1))
                .thenReturn(List.of(AssignmentAttempt.builder().status(AttemptStatus.COMPLETED).build()));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, a2))
                .thenReturn(List.of(AssignmentAttempt.builder().status(AttemptStatus.IN_PROGRESS).build()));

        // 3. Empty lesson
        when(videoRepository.findByLessonId(emptyLessonId)).thenReturn(Optional.empty());
        when(assignmentRepository.findByLessonId(emptyLessonId)).thenReturn(Collections.emptyList());

        List<LessonResponse> studentRes = curriculumService.getLessonsByClass(classId);
        assertThat(studentRes.get(0).isCompleted()).isTrue();
        assertThat(studentRes.get(0).getProgressPercentage()).isEqualTo(100);
        assertThat(studentRes.get(1).isCompleted()).isFalse();
        assertThat(studentRes.get(1).getProgressPercentage()).isEqualTo(50);
        assertThat(studentRes.get(2).isCompleted()).isFalse();
        assertThat(studentRes.get(2).getProgressPercentage()).isZero();

        // Teacher role -> bỏ qua tính tiến độ học viên (studentId = null)
        SecurityContextHolder.clearContext();
        List<LessonResponse> guestRes = curriculumService.getLessonsByClass(classId);
        assertThat(guestRes).allSatisfy(r -> {
            assertThat(r.isCompleted()).isFalse();
            assertThat(r.getProgressPercentage()).isZero();
        });
    }

    @Test
    @DisplayName("uploadLessonDocument, getDocumentsByLesson, deleteDocument - Xử lý fileType hợp lệ, không hợp lệ và 404")
    void documentOperations_allBranches() {
        Classroom classroom = Classroom.builder().id(classId).build();
        Lesson lesson = Lesson.builder().id(lessonId).classroom(classroom).build();
        MockMultipartFile file = new MockMultipartFile("file", "slides.pdf", "application/pdf", new byte[]{1, 2, 3, 4});

        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(lesson));
        when(storageService.uploadFile(file)).thenReturn("https://cdn.test/documents/slides.pdf");
        when(documentRepository.save(any(LessonDocument.class))).thenAnswer(inv -> {
            LessonDocument d = inv.getArgument(0);
            d.setId(UUID.randomUUID());
            d.setCreatedAt(Instant.now());
            return d;
        });

        DocumentResponse uploaded = curriculumService.uploadLessonDocument(lessonId, file, " pdf ");
        assertThat(uploaded.getFileType()).isEqualTo("PDF");
        assertThat(uploaded.getFileUrl()).isEqualTo("https://cdn.test/documents/slides.pdf");
        assertThat(uploaded.getFileSizeBytes()).isEqualTo(4L);

        assertThatThrownBy(() -> curriculumService.uploadLessonDocument(lessonId, file, "  "))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> curriculumService.uploadLessonDocument(lessonId, file, "EXECUTABLE"))
                .isInstanceOf(BadRequestException.class);

        UUID docId = UUID.randomUUID();
        LessonDocument doc = LessonDocument.builder()
                .id(docId)
                .lesson(lesson)
                .fileName("slides.pdf")
                .storageUrl("https://cdn.test/documents/slides.pdf")
                .fileType(DocumentType.PDF)
                .build();
        when(documentRepository.findByLessonId(lessonId)).thenReturn(List.of(doc));
        assertThat(curriculumService.getDocumentsByLesson(lessonId)).hasSize(1);

        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));
        curriculumService.deleteDocument(docId);
        verify(documentRepository).delete(doc);

        UUID missingDoc = UUID.randomUUID();
        when(documentRepository.findById(missingDoc)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> curriculumService.deleteDocument(missingDoc))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("addGrammarTopic, getGrammarTopicsByLesson, deleteGrammarTopic - CRUD đầy đủ & 404")
    void grammarTopicOperations_allBranches() {
        Lesson lesson = Lesson.builder().id(lessonId).build();
        GrammarTopicRequest req = new GrammarTopicRequest();
        req.setTitle("Present Perfect");
        req.setRuleSummary("Describes past actions with present relevance");
        req.setFormula("S + have/has + V3");
        req.setExamples("I have finished.");

        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(lesson));
        when(grammarTopicRepository.save(any(GrammarTopic.class))).thenAnswer(inv -> {
            GrammarTopic t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        GrammarTopicResponse added = curriculumService.addGrammarTopic(lessonId, req);
        assertThat(added.getTitle()).isEqualTo("Present Perfect");
        assertThat(added.getLessonId()).isEqualTo(lessonId);

        GrammarTopic topic = GrammarTopic.builder()
                .id(added.getId())
                .lesson(lesson)
                .title("Present Perfect")
                .ruleSummary(req.getRuleSummary())
                .build();
        when(grammarTopicRepository.findByLessonId(lessonId)).thenReturn(List.of(topic));
        assertThat(curriculumService.getGrammarTopicsByLesson(lessonId)).hasSize(1);

        when(grammarTopicRepository.findById(added.getId())).thenReturn(Optional.of(topic));
        curriculumService.deleteGrammarTopic(added.getId());
        verify(grammarTopicRepository).delete(topic);

        UUID missingTopic = UUID.randomUUID();
        when(grammarTopicRepository.findById(missingTopic)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> curriculumService.deleteGrammarTopic(missingTopic))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
