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
        when(documentRepository.save(doc)).thenReturn(doc);

        // updateDocument
        DocumentUpdateRequest updateDocReq = new DocumentUpdateRequest();
        updateDocReq.setFileName("  slides-v2.pptx ");
        updateDocReq.setFileType("pptx");
        DocumentResponse updatedDoc = curriculumService.updateDocument(docId, updateDocReq);
        assertThat(updatedDoc.getFileName()).isEqualTo("slides-v2.pptx");
        assertThat(updatedDoc.getFileType()).isEqualTo("PPTX");

        // replaceDocumentFile uploads new file and deletes old URL
        MockMultipartFile newFile = new MockMultipartFile("file", "handout.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", new byte[]{9, 8, 7});
        when(storageService.uploadFile(newFile)).thenReturn("https://cdn.test/documents/handout.docx");
        DocumentResponse replacedDoc = curriculumService.replaceDocumentFile(docId, newFile, null, null);
        assertThat(replacedDoc.getFileName()).isEqualTo("handout.docx");
        assertThat(replacedDoc.getFileType()).isEqualTo("DOCX");
        assertThat(replacedDoc.getFileUrl()).isEqualTo("https://cdn.test/documents/handout.docx");
        verify(storageService).deleteFileByUrl("https://cdn.test/documents/slides.pdf");

        // deleteDocument removes entity and new stored file
        curriculumService.deleteDocument(docId);
        verify(documentRepository).delete(doc);
        verify(storageService).deleteFileByUrl("https://cdn.test/documents/handout.docx");

        MockMultipartFile emptyReplaceFile = new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]);
        assertThatThrownBy(() -> curriculumService.replaceDocumentFile(docId, emptyReplaceFile, null, null))
                .isInstanceOf(BadRequestException.class);

        UUID missingDoc = UUID.randomUUID();
        when(documentRepository.findById(missingDoc)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> curriculumService.updateDocument(missingDoc, updateDocReq))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> curriculumService.replaceDocumentFile(missingDoc, newFile, null, null))
                .isInstanceOf(ResourceNotFoundException.class);
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
        GrammarTopicRequest updateTopicReq = new GrammarTopicRequest();
        updateTopicReq.setTitle("  Present Perfect Continuous ");
        updateTopicReq.setRuleSummary("  Ongoing duration from past to present ");
        updateTopicReq.setFormula(" S + have/has + been + V-ing ");
        updateTopicReq.setExamples(" It has been raining. ");
        when(grammarTopicRepository.save(topic)).thenReturn(topic);
        GrammarTopicResponse updatedTopic = curriculumService.updateGrammarTopic(added.getId(), updateTopicReq);
        assertThat(updatedTopic.getTitle()).isEqualTo("Present Perfect Continuous");
        assertThat(updatedTopic.getFormula()).isEqualTo("S + have/has + been + V-ing");
        assertThat(updatedTopic.getExamples()).isEqualTo("It has been raining.");

        curriculumService.deleteGrammarTopic(added.getId());
        verify(grammarTopicRepository).delete(topic);

        UUID missingTopic = UUID.randomUUID();
        when(grammarTopicRepository.findById(missingTopic)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> curriculumService.updateGrammarTopic(missingTopic, updateTopicReq))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> curriculumService.deleteGrammarTopic(missingTopic))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getLessonDetail trả về audioUrl từ vựng & getLessonsByClass trả về videoId, videoStatus và đếm học liệu")
    void lessonResponses_includeVideoMetadataAudioAndCounts() {
        Classroom classroom = Classroom.builder().id(classId).build();
        Lesson lesson = Lesson.builder().id(lessonId).classroom(classroom).title("Unit 5").orderIndex(5).build();
        UUID videoId = UUID.randomUUID();
        Video rejectedVideo = Video.builder()
                .id(videoId)
                .lesson(lesson)
                .status(com.englishlearning.video.entity.VideoStatus.REJECTED)
                .rejectionReason("Âm thanh nhỏ")
                .build();

        VocabularyItem vocab = VocabularyItem.builder()
                .id(UUID.randomUUID())
                .lesson(lesson)
                .word("coherent")
                .meaning("mạch lạc")
                .ipa("/kəʊˈhɪə.rənt/")
                .audioUrl("https://audio.test/coherent.mp3")
                .build();
        GrammarTopic grammar = GrammarTopic.builder()
                .id(UUID.randomUUID())
                .lesson(lesson)
                .title("Conditionals")
                .ruleSummary("If clause")
                .build();

        SecurityContextHolder.clearContext();
        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId)).thenReturn(List.of(lesson));
        when(videoRepository.findByLessonId(lessonId)).thenReturn(Optional.of(rejectedVideo));
        when(documentRepository.findByLessonId(lessonId)).thenReturn(Collections.emptyList());
        when(vocabularyRepository.findByLessonId(lessonId)).thenReturn(List.of(vocab));
        when(grammarTopicRepository.findByLessonId(lessonId)).thenReturn(List.of(grammar));

        List<LessonResponse> list = curriculumService.getLessonsByClass(classId);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).isHasVideo()).isTrue();
        assertThat(list.get(0).getVideoId()).isEqualTo(videoId);
        assertThat(list.get(0).getVideoStatus()).isEqualTo("REJECTED");
        assertThat(list.get(0).getVideoRejectionReason()).isEqualTo("Âm thanh nhỏ");
        assertThat(list.get(0).getVocabulariesCount()).isEqualTo(1);
        assertThat(list.get(0).getGrammarTopicsCount()).isEqualTo(1);

        when(lessonRepository.findById(lessonId)).thenReturn(Optional.of(lesson));
        LessonDetailResponse detail = curriculumService.getLessonDetail(lessonId);
        assertThat(detail.getVocabularies()).hasSize(1);
        assertThat(detail.getVocabularies().get(0).getAudioUrl()).isEqualTo("https://audio.test/coherent.mp3");
    }

    @Test
    @DisplayName("uploadLessonDocument - File null hoặc rỗng ném BadRequestException và không gọi Storage")
    void uploadLessonDocument_nullOrEmptyFile_throwsBadRequestWithoutUploading() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]);

        assertThatThrownBy(() -> curriculumService.uploadLessonDocument(lessonId, null, "PDF"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("File tài liệu không được để trống");
        assertThatThrownBy(() -> curriculumService.uploadLessonDocument(lessonId, emptyFile, "PDF"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("File tài liệu không được để trống");

        verifyNoInteractions(storageService, documentRepository);
    }

    @Test
    @DisplayName("uploadLessonDocument - fileType không hợp lệ phải báo lỗi trước khi upload file lên Storage")
    void uploadLessonDocument_invalidFileType_throwsBadRequestWithoutUploadingFile() {
        MockMultipartFile file = new MockMultipartFile("file", "slides.pdf", "application/pdf", new byte[]{1, 2});

        assertThatThrownBy(() -> curriculumService.uploadLessonDocument(lessonId, file, "INVALID_TYPE"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Loại tài liệu không hợp lệ: INVALID_TYPE");

        verifyNoInteractions(storageService, documentRepository);
    }

    @Test
    @DisplayName("uploadLessonDocument - Không tìm thấy bài học báo 404 và không gọi Storage")
    void uploadLessonDocument_lessonNotFound_throwsResourceNotFoundWithoutUploading() {
        UUID missingLesson = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "slides.pdf", "application/pdf", new byte[]{1, 2});
        when(lessonRepository.findById(missingLesson)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> curriculumService.uploadLessonDocument(missingLesson, file, "PDF"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy bài học");

        verifyNoInteractions(storageService, documentRepository);
    }

    @Test
    @DisplayName("updateDocument - Request null hoặc fileName rỗng ném BadRequestException")
    void updateDocument_nullOrBlankFileName_throwsBadRequestException() {
        UUID docId = UUID.randomUUID();
        DocumentUpdateRequest blankName = new DocumentUpdateRequest();
        blankName.setFileName("   ");

        assertThatThrownBy(() -> curriculumService.updateDocument(docId, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Tên tài liệu không được để trống");
        assertThatThrownBy(() -> curriculumService.updateDocument(docId, blankName))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Tên tài liệu không được để trống");

        verifyNoInteractions(documentRepository);
    }

    @Test
    @DisplayName("updateDocument - Không truyền fileType thì giữ nguyên loại tài liệu cũ")
    void updateDocument_blankFileType_preservesExistingFileType() {
        UUID docId = UUID.randomUUID();
        Lesson lesson = Lesson.builder().id(lessonId).build();
        LessonDocument doc = LessonDocument.builder()
                .id(docId)
                .lesson(lesson)
                .fileName("old.pdf")
                .storageUrl("https://cdn.test/old.pdf")
                .fileType(DocumentType.PPTX)
                .build();
        DocumentUpdateRequest req = new DocumentUpdateRequest();
        req.setFileName("  renamed.pptx ");
        req.setFileType("  ");

        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepository.save(doc)).thenReturn(doc);

        DocumentResponse updated = curriculumService.updateDocument(docId, req);

        assertThat(updated.getFileName()).isEqualTo("renamed.pptx");
        assertThat(updated.getFileType()).isEqualTo("PPTX");
    }

    @Test
    @DisplayName("replaceDocumentFile - fileType không hợp lệ phải báo lỗi trước khi upload file mới")
    void replaceDocumentFile_invalidFileType_throwsBadRequestWithoutUploading() {
        UUID docId = UUID.randomUUID();
        Lesson lesson = Lesson.builder().id(lessonId).build();
        LessonDocument doc = LessonDocument.builder()
                .id(docId)
                .lesson(lesson)
                .fileName("old.pdf")
                .storageUrl("https://cdn.test/old.pdf")
                .fileType(DocumentType.PDF)
                .build();
        MockMultipartFile newFile = new MockMultipartFile("file", "new.pdf", "application/pdf", new byte[]{1, 2});
        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));

        assertThatThrownBy(() -> curriculumService.replaceDocumentFile(docId, newFile, null, "EXE"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Loại tài liệu không hợp lệ: EXE");

        verifyNoInteractions(storageService);
        verify(documentRepository, never()).save(any());
    }

    @Test
    @DisplayName("replaceDocumentFile - Tự suy đoán đúng DocumentType cho IMAGE, AUDIO, PPTX và fallback")
    void replaceDocumentFile_infersImageAudioPptxAndFallbackTypes() {
        UUID docId = UUID.randomUUID();
        Lesson lesson = Lesson.builder().id(lessonId).build();
        LessonDocument doc = LessonDocument.builder()
                .id(docId)
                .lesson(lesson)
                .fileName("old.pdf")
                .storageUrl("https://cdn.test/old.pdf")
                .fileType(DocumentType.PDF)
                .build();
        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));
        when(documentRepository.save(doc)).thenReturn(doc);

        MockMultipartFile imgFile = new MockMultipartFile("file", "diagram.webp", "image/webp", new byte[]{1});
        when(storageService.uploadFile(imgFile)).thenReturn("https://cdn.test/diagram.webp");
        assertThat(curriculumService.replaceDocumentFile(docId, imgFile, null, null).getFileType()).isEqualTo("IMAGE");

        MockMultipartFile audioFile = new MockMultipartFile("file", "track.mp3", "audio/mpeg", new byte[]{1});
        when(storageService.uploadFile(audioFile)).thenReturn("https://cdn.test/track.mp3");
        assertThat(curriculumService.replaceDocumentFile(docId, audioFile, null, null).getFileType()).isEqualTo("AUDIO");

        MockMultipartFile pptxFile = new MockMultipartFile("file", "slides.pptx", "application/vnd.ms-powerpoint", new byte[]{1});
        when(storageService.uploadFile(pptxFile)).thenReturn("https://cdn.test/slides.pptx");
        assertThat(curriculumService.replaceDocumentFile(docId, pptxFile, null, null).getFileType()).isEqualTo("PPTX");

        MockMultipartFile unknownExtFile = new MockMultipartFile("file", "archive.bin", "application/octet-stream", new byte[]{1});
        when(storageService.uploadFile(unknownExtFile)).thenReturn("https://cdn.test/archive.bin");
        assertThat(curriculumService.replaceDocumentFile(docId, unknownExtFile, null, null).getFileType()).isEqualTo("PPTX");
    }

    @Test
    @DisplayName("replaceDocumentFile - Xóa file cũ thất bại vẫn không làm hỏng transaction thay thế file")
    void replaceDocumentFile_deleteOldFileThrowsException_stillReturnsUpdatedDocument() {
        UUID docId = UUID.randomUUID();
        Lesson lesson = Lesson.builder().id(lessonId).build();
        LessonDocument doc = LessonDocument.builder()
                .id(docId)
                .lesson(lesson)
                .fileName("old.pdf")
                .storageUrl("https://cdn.test/old.pdf")
                .fileType(DocumentType.PDF)
                .build();
        MockMultipartFile newFile = new MockMultipartFile("file", "new.pdf", "application/pdf", new byte[]{1, 2});

        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));
        when(storageService.uploadFile(newFile)).thenReturn("https://cdn.test/new.pdf");
        when(documentRepository.save(doc)).thenReturn(doc);
        doThrow(new RuntimeException("S3 delete failed")).when(storageService).deleteFileByUrl("https://cdn.test/old.pdf");

        DocumentResponse result = curriculumService.replaceDocumentFile(docId, newFile, null, null);

        assertThat(result.getFileUrl()).isEqualTo("https://cdn.test/new.pdf");
    }

    @Test
    @DisplayName("deleteDocument - Lỗi khi xóa file trên storage vẫn hoàn tất xóa bản ghi trong DB")
    void deleteDocument_deleteStorageThrowsException_stillCompletesDeletion() {
        UUID docId = UUID.randomUUID();
        LessonDocument doc = LessonDocument.builder()
                .id(docId)
                .storageUrl("https://cdn.test/doc.pdf")
                .build();
        when(documentRepository.findById(docId)).thenReturn(Optional.of(doc));
        doThrow(new RuntimeException("Storage unavailable")).when(storageService).deleteFileByUrl("https://cdn.test/doc.pdf");

        curriculumService.deleteDocument(docId);

        verify(documentRepository).delete(doc);
    }

    @Test
    @DisplayName("addGrammarTopic - Bài học không tồn tại ném ResourceNotFoundException")
    void addGrammarTopic_lessonNotFound_throwsResourceNotFoundException() {
        UUID missingLesson = UUID.randomUUID();
        GrammarTopicRequest req = new GrammarTopicRequest();
        req.setTitle("Modal Verbs");
        req.setRuleSummary("Express necessity");
        when(lessonRepository.findById(missingLesson)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> curriculumService.addGrammarTopic(missingLesson, req))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy bài học");
    }

    @Test
    @DisplayName("updateGrammarTopic - Title hoặc ruleSummary rỗng ném BadRequestException")
    void updateGrammarTopic_blankTitleOrRuleSummary_throwsBadRequestException() {
        UUID topicId = UUID.randomUUID();
        GrammarTopicRequest blankTitle = new GrammarTopicRequest();
        blankTitle.setTitle("   ");
        blankTitle.setRuleSummary("Valid summary");

        GrammarTopicRequest blankSummary = new GrammarTopicRequest();
        blankSummary.setTitle("Valid title");
        blankSummary.setRuleSummary(" ");

        assertThatThrownBy(() -> curriculumService.updateGrammarTopic(topicId, blankTitle))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> curriculumService.updateGrammarTopic(topicId, blankSummary))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(grammarTopicRepository);
    }
}
