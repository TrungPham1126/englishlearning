package com.englishlearning.analytics.service.impl;

import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.analytics.dto.AdminDatabaseOverviewDto;
import com.englishlearning.analytics.dto.ClassroomPurgeResultDto;
import com.englishlearning.analytics.dto.R2CostReportDto;
import com.englishlearning.analytics.service.ClassroomReportExcelExporter;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.ExerciseAudio;
import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.repository.ExerciseAudioRepository;
import com.englishlearning.assignment.repository.QuestionOptionRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.classroom.dto.StudentProgressResponse;
import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.GlobalResource;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.LessonDocument;
import com.englishlearning.curriculum.repository.*;
import com.englishlearning.notification.repository.NotificationRepository;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.submission.repository.StudentAnswerRepository;
import com.englishlearning.system.service.AuditLogService;
import com.englishlearning.video.dto.R2BucketSnapshot;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import com.englishlearning.video.service.R2StorageService;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminDatabaseServiceImpl - Quản lý CSDL, Xóa lớp, Xuất Excel & Báo cáo Cloud R2")
class AdminDatabaseServiceImplTest {

    @Mock private ClassroomRepository classroomRepository;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private LessonRepository lessonRepository;
    @Mock private LessonDocumentRepository lessonDocumentRepository;
    @Mock private GrammarTopicRepository grammarTopicRepository;
    @Mock private VocabularyItemRepository vocabularyItemRepository;
    @Mock private StudentVocabularyProgressRepository studentVocabularyProgressRepository;
    @Mock private DailyStudyPlanRepository dailyStudyPlanRepository;
    @Mock private DailyPlanItemRepository dailyPlanItemRepository;
    @Mock private StudentDailyProgressRepository studentDailyProgressRepository;
    @Mock private AssignmentRepository assignmentRepository;
    @Mock private AssignmentQuestionRepository assignmentQuestionRepository;
    @Mock private QuestionOptionRepository questionOptionRepository;
    @Mock private ExerciseAudioRepository exerciseAudioRepository;
    @Mock private AssignmentAttemptRepository assignmentAttemptRepository;
    @Mock private StudentAnswerRepository studentAnswerRepository;
    @Mock private AiEvaluationRepository aiEvaluationRepository;
    @Mock private AiGeneratedExerciseRepository aiGeneratedExerciseRepository;
    @Mock private VideoRepository videoRepository;
    @Mock private VideoWatchHistoryRepository videoWatchHistoryRepository;
    @Mock private GlobalResourceRepository globalResourceRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private UserRepository userRepository;
    @Mock private ClassroomService classroomService;
    @Mock private R2StorageService r2StorageService;
    @Mock private AuditLogService auditLogService;

    private AdminDatabaseServiceImpl adminDatabaseService;

    @BeforeEach
    void setUp() {
        adminDatabaseService = new AdminDatabaseServiceImpl(
                classroomRepository,
                classStudentRepository,
                lessonRepository,
                lessonDocumentRepository,
                grammarTopicRepository,
                vocabularyItemRepository,
                studentVocabularyProgressRepository,
                dailyStudyPlanRepository,
                dailyPlanItemRepository,
                studentDailyProgressRepository,
                assignmentRepository,
                assignmentQuestionRepository,
                questionOptionRepository,
                exerciseAudioRepository,
                assignmentAttemptRepository,
                studentAnswerRepository,
                aiEvaluationRepository,
                aiGeneratedExerciseRepository,
                videoRepository,
                videoWatchHistoryRepository,
                globalResourceRepository,
                notificationRepository,
                userRepository,
                classroomService,
                new ClassroomReportExcelExporter(),
                r2StorageService,
                auditLogService
        );
    }

    private Classroom buildClassroom(UUID id, String name, ClassStatus status) {
        User teacherUser = User.builder().id(UUID.randomUUID()).email("gv@test.com").firstName("Lan").lastName("Nguyen").build();
        Teacher teacher = Teacher.builder().id(teacherUser.getId()).user(teacherUser).build();
        return Classroom.builder()
                .id(id)
                .name(name)
                .description("Khoa hoc luyen thi IELTS")
                .level(ClassLevel.B2)
                .status(status)
                .teacher(teacher)
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 6, 1))
                .createdAt(Instant.now())
                .build();
    }

    @Test
    @DisplayName("getDatabaseOverview tổng hợp chính xác dữ liệu DB và file audio theo từng lớp")
    void getDatabaseOverview_success() {
        UUID cid1 = UUID.randomUUID();
        Classroom c1 = buildClassroom(cid1, "IELTS K01", ClassStatus.COMPLETED);
        UUID stId = UUID.randomUUID();
        Student st = Student.builder().id(stId).user(User.builder().id(stId).email("hv@test.com").build()).build();

        Assignment practice = Assignment.builder().id(UUID.randomUUID()).classroom(c1).isExam(false).build();
        Assignment exam = Assignment.builder().id(UUID.randomUUID()).classroom(c1).isExam(true).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID()).assignment(exam).student(st).status(AttemptStatus.COMPLETED).totalScore(8.5).isCheatingFlagged(false).build();

        when(classroomRepository.findAll()).thenReturn(new java.util.ArrayList<>(List.of(c1)));
        when(classStudentRepository.findByClassroomId(cid1)).thenReturn(List.of(ClassStudent.builder().classroom(c1).student(st).build()));
        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(cid1)).thenReturn(Collections.emptyList());
        when(dailyStudyPlanRepository.findByClassroomId(cid1)).thenReturn(Collections.emptyList());
        when(assignmentRepository.findByClassroomId(cid1)).thenReturn(List.of(practice, exam));
        when(assignmentAttemptRepository.findAllByClassroomIdWithDetails(cid1)).thenReturn(List.of(attempt));
        when(studentAnswerRepository.countByClassroomId(cid1)).thenReturn(12L);
        when(aiEvaluationRepository.countByClassroomId(cid1)).thenReturn(3L);
        when(studentAnswerRepository.countAudioResponsesByClassroomId(cid1)).thenReturn(2L);

        AdminDatabaseOverviewDto overview = adminDatabaseService.getDatabaseOverview();

        assertThat(overview.getTotalClassrooms()).isEqualTo(1);
        assertThat(overview.getCompletedClassrooms()).isEqualTo(1);
        assertThat(overview.getTotalExams()).isEqualTo(1);
        assertThat(overview.getTotalAssignments()).isEqualTo(1);
        assertThat(overview.getTotalAttempts()).isEqualTo(1);
        assertThat(overview.getTotalStudentAnswers()).isEqualTo(12);
        assertThat(overview.getTotalAiEvaluations()).isEqualTo(3);
        assertThat(overview.getTotalSubmissionAudioFiles()).isEqualTo(2);
        assertThat(overview.getClassrooms().get(0).isEligibleForCleanPurge()).isTrue();
        assertThat(overview.getClassrooms().get(0).getAverageScore()).isEqualTo(8.5);
    }

    @Test
    @DisplayName("purgeClassroomSubmissions từ chối lớp đang học khi force=false")
    void purgeClassroomSubmissions_rejectsActiveWithoutForce() {
        UUID cid = UUID.randomUUID();
        when(classroomRepository.findById(cid)).thenReturn(Optional.of(buildClassroom(cid, "Active B1", ClassStatus.IN_PROGRESS)));

        assertThatThrownBy(() -> adminDatabaseService.purgeClassroomSubmissions(cid, false, UUID.randomUUID(), "127.0.0.1"))
                .isInstanceOf(BadRequestException.class);

        verify(assignmentAttemptRepository, never()).deleteByIdIn(any());
    }

    @Test
    @DisplayName("purgeClassroomSubmissions dọn sạch bài làm, AI eval, tiến độ và audio R2 của lớp đã hoàn thành")
    void purgeClassroomSubmissions_completedClass_success() {
        UUID cid = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID videoId = UUID.randomUUID();
        UUID vocabId = UUID.randomUUID();

        Classroom classroom = buildClassroom(cid, "IELTS K01", ClassStatus.COMPLETED);
        when(classroomRepository.findById(cid)).thenReturn(Optional.of(classroom));
        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(cid)).thenReturn(List.of(Lesson.builder().id(lessonId).build()));
        when(assignmentRepository.findByClassroomId(cid)).thenReturn(List.of(Assignment.builder().id(assId).build()));
        when(assignmentRepository.findByLessonIdIn(List.of(lessonId))).thenReturn(Collections.emptyList());

        when(assignmentAttemptRepository.findIdsByAssignmentIdIn(anyList())).thenReturn(List.of(attemptId));
        when(studentAnswerRepository.findAudioUrlsByAttemptIdIn(List.of(attemptId)))
                .thenReturn(List.of("https://cdn.r2.dev/speaking/a1.wav"));
        when(studentAnswerRepository.findIdsByAttemptIdIn(List.of(attemptId))).thenReturn(List.of(answerId));

        when(aiEvaluationRepository.deleteByStudentAnswerIdIn(List.of(answerId))).thenReturn(1);
        when(studentAnswerRepository.deleteByAttemptIdIn(List.of(attemptId))).thenReturn(5);
        when(assignmentAttemptRepository.deleteByIdIn(List.of(attemptId))).thenReturn(1);
        when(r2StorageService.deleteObjectsByUrlsOrKeys(List.of("https://cdn.r2.dev/speaking/a1.wav"))).thenReturn(1);

        when(dailyStudyPlanRepository.findByClassroomId(cid)).thenReturn(List.of(DailyStudyPlan.builder().id(planId).build()));
        when(studentDailyProgressRepository.deleteByDailyPlanIdIn(List.of(planId))).thenReturn(4);

        Student st = Student.builder().id(studentId).build();
        when(classStudentRepository.findByClassroomId(cid)).thenReturn(List.of(ClassStudent.builder().student(st).build()));
        when(videoRepository.findByLessonIdIn(List.of(lessonId))).thenReturn(List.of(Video.builder().id(videoId).build()));
        when(videoWatchHistoryRepository.deleteByVideoIdInAndStudentIdIn(List.of(videoId), List.of(studentId))).thenReturn(2);
        when(vocabularyItemRepository.findIdsByLessonIdIn(List.of(lessonId))).thenReturn(List.of(vocabId));
        when(studentVocabularyProgressRepository.deleteByVocabularyIdInAndStudentIdIn(List.of(vocabId), List.of(studentId))).thenReturn(3);

        UUID actorId = UUID.randomUUID();
        ClassroomPurgeResultDto res = adminDatabaseService.purgeClassroomSubmissions(cid, false, actorId, "10.0.0.1");

        assertThat(res.isEntireClassroomDeleted()).isFalse();
        assertThat(res.getDeletedAiEvaluations()).isEqualTo(1);
        assertThat(res.getDeletedStudentAnswers()).isEqualTo(5);
        assertThat(res.getDeletedAttempts()).isEqualTo(1);
        assertThat(res.getDeletedDailyProgress()).isEqualTo(4);
        assertThat(res.getDeletedVideoWatchHistory()).isEqualTo(2);
        assertThat(res.getDeletedVocabularyProgress()).isEqualTo(3);
        assertThat(res.getDeletedR2MediaFiles()).isEqualTo(1);

        verify(classroomRepository, never()).deleteClassroomRowById(any());
        verify(auditLogService).recordAuditLog(eq(actorId), eq("PURGE_CLASSROOM_SUBMISSIONS"), eq("Classroom"), eq(cid.toString()), eq("10.0.0.1"), anyString());
    }

    @Test
    @DisplayName("deleteClassroom xóa cascade an toàn lớp học nhưng bảo vệ file trong Kho học liệu chung")
    void deleteClassroom_cascadesAndProtectsGlobalResources() {
        UUID cid = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID videoId = UUID.randomUUID();
        String sharedDocUrl = "https://cdn.r2.dev/documents/shared.pdf";
        String classDocUrl = "https://cdn.r2.dev/documents/class-only.pdf";

        Classroom classroom = buildClassroom(cid, "Lop Can Xoa", ClassStatus.COMPLETED);
        when(classroomRepository.findById(cid)).thenReturn(Optional.of(classroom));
        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(cid)).thenReturn(List.of(Lesson.builder().id(lessonId).build()));
        when(assignmentRepository.findByClassroomId(cid)).thenReturn(List.of(Assignment.builder().id(assId).audioUrl("https://cdn.r2.dev/audio/ass.mp3").build()));
        when(assignmentRepository.findByLessonIdIn(List.of(lessonId))).thenReturn(Collections.emptyList());
        when(assignmentAttemptRepository.findIdsByAssignmentIdIn(anyList())).thenReturn(Collections.emptyList());
        when(dailyStudyPlanRepository.findByClassroomId(cid)).thenReturn(Collections.emptyList());
        when(classStudentRepository.findByClassroomId(cid)).thenReturn(Collections.emptyList());

        when(globalResourceRepository.findAll()).thenReturn(List.of(GlobalResource.builder().storageUrl(sharedDocUrl).build()));
        when(assignmentRepository.findAllById(anyList())).thenReturn(List.of(Assignment.builder().id(assId).audioUrl("https://cdn.r2.dev/audio/ass.mp3").build()));
        when(exerciseAudioRepository.findByAssignmentIdIn(anyList())).thenReturn(List.of(ExerciseAudio.builder().url("https://cdn.r2.dev/audio/tts.wav").build()));
        when(assignmentQuestionRepository.findIdsByAssignmentIdIn(anyList())).thenReturn(List.of(qId));

        Video video = Video.builder()
                .id(videoId)
                .rawStorageUrl("https://cdn.r2.dev/videos/raw.mp4")
                .hlsPlaylistUrl("https://cdn.r2.dev/hls/" + videoId + "/master.m3u8")
                .build();
        when(videoRepository.findByLessonIdIn(List.of(lessonId))).thenReturn(List.of(video));
        when(lessonDocumentRepository.findByLessonIdIn(List.of(lessonId))).thenReturn(List.of(
                LessonDocument.builder().storageUrl(sharedDocUrl).build(),
                LessonDocument.builder().storageUrl(classDocUrl).build()
        ));
        when(r2StorageService.deleteObjectsByUrlsOrKeys(anyCollection())).thenReturn(1);
        when(r2StorageService.deleteObjectByUrlOrKey("https://cdn.r2.dev/videos/raw.mp4")).thenReturn(true);
        when(r2StorageService.deleteObjectsByPrefix("hls/" + videoId + "/")).thenReturn(4);

        ClassroomPurgeResultDto res = adminDatabaseService.deleteClassroom(cid, UUID.randomUUID(), "127.0.0.1");

        assertThat(res.isEntireClassroomDeleted()).isTrue();
        assertThat(res.getDeletedR2MediaFiles()).isGreaterThanOrEqualTo(6);
        verify(notificationRepository).deleteByClassroomId(cid);
        verify(classStudentRepository).deleteByClassroomId(cid);
        verify(classroomRepository).deleteClassroomRowById(cid);
        // Đảm bảo file dùng chung KHÔNG bị đưa vào danh sách xóa R2 tài liệu lớp
        verify(r2StorageService).deleteObjectsByUrlsOrKeys(argThat(cols -> cols.contains(classDocUrl) && !cols.contains(sharedDocUrl)));
    }

    @Test
    @DisplayName("exportClassroomReportExcel tạo file .xlsx hợp lệ gồm 3 sheet với dữ liệu học viên & gian lận")
    void exportClassroomReportExcel_generatesValidWorkbook() throws Exception {
        UUID cid = UUID.randomUUID();
        UUID stId = UUID.randomUUID();
        Classroom classroom = buildClassroom(cid, "IELTS Intensive 02", ClassStatus.IN_PROGRESS);
        Student st = Student.builder()
                .id(stId)
                .user(User.builder().id(stId).firstName("Minh").lastName("Tran").email("minh@test.com").build())
                .build();
        Assignment exam = Assignment.builder().id(UUID.randomUUID()).title("Midterm Exam").isExam(true).skillType(SkillType.WRITING).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .assignment(exam)
                .student(st)
                .attemptNumber(1)
                .status(AttemptStatus.COMPLETED)
                .submittedAt(Instant.now())
                .durationSeconds(600)
                .totalScore(7.5)
                .violationCount(3)
                .isCheatingFlagged(true)
                .cheatingReason("Roi man hinh 3 lan")
                .build();

        when(classroomRepository.findById(cid)).thenReturn(Optional.of(classroom));
        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(cid)).thenReturn(Collections.emptyList());
        when(dailyStudyPlanRepository.findByClassroomId(cid)).thenReturn(Collections.emptyList());
        when(assignmentRepository.findByClassroomId(cid)).thenReturn(List.of(exam));
        when(assignmentAttemptRepository.findAllByClassroomIdWithDetails(cid)).thenReturn(List.of(attempt));
        when(classroomService.getClassStudentsProgress(cid)).thenReturn(List.of(
                StudentProgressResponse.builder()
                        .studentId(stId)
                        .fullName("Tran Minh")
                        .email("minh@test.com")
                        .completedTasks(1)
                        .totalTasks(2)
                        .completionRate(50)
                        .averageScore(7.5)
                        .totalStudyMinutes(45)
                        .build()
        ));

        byte[] xlsxBytes = adminDatabaseService.exportClassroomReportExcel(cid);
        assertThat(xlsxBytes).isNotEmpty();

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(xlsxBytes))) {
            assertThat(wb.getNumberOfSheets()).isEqualTo(3);
            assertThat(wb.getSheetAt(0).getSheetName()).isEqualTo("Tong_Quan_Lop");
            assertThat(wb.getSheetAt(1).getSheetName()).isEqualTo("Danh_Sach_Hoc_Vien");
            assertThat(wb.getSheetAt(2).getSheetName()).isEqualTo("Chi_Tiet_Bai_Nop_Thi");
            assertThat(wb.getSheetAt(1).getRow(2).getCell(1).getStringCellValue()).isEqualTo("Tran Minh");
            assertThat(wb.getSheetAt(2).getRow(2).getCell(12).getStringCellValue()).isEqualTo("GIAN LẬN");
        }
    }

    @Test
    @DisplayName("getR2CostReport tính đúng Free Tier và phần vượt hạn mức khi kết nối Live R2")
    void getR2CostReport_calculatesPricingCorrectly() {
        long twentyGbBytes = 20L * 1024L * 1024L * 1024L;
        R2BucketSnapshot liveSnapshot = R2BucketSnapshot.builder()
                .bucketName("elp-prod-bucket")
                .endpoint("https://acc.r2.cloudflarestorage.com")
                .publicUrl("https://cdn.elp.vn")
                .liveConnected(true)
                .statusNote("Live OK")
                .totalObjects(1500)
                .totalBytes(twentyGbBytes)
                .trackedPutOps(1_500_000L)
                .trackedListOps(500_000L) // Class A total = 2,000,000 => billable 1M = $4.50
                .trackedGetOps(12_000_000L) // Class B = 12M => billable 2M = $0.72
                .trackedDeleteOps(50L)
                .prefixStats(List.of(R2BucketSnapshot.R2PrefixStat.builder()
                        .categoryKey("videos")
                        .categoryLabel("Video HLS")
                        .prefix("videos/")
                        .objectCount(1500)
                        .totalBytes(twentyGbBytes)
                        .build()))
                .largestObjects(Collections.emptyList())
                .build();

        when(r2StorageService.inspectBucketSnapshot()).thenReturn(liveSnapshot);

        R2CostReportDto report = adminDatabaseService.getR2CostReport();

        assertThat(report.isLiveConnected()).isTrue();
        assertThat(report.getTotalStorageGb()).isEqualTo(20.0);
        assertThat(report.getBillableStorageGb()).isEqualTo(10.0);
        // 10 GB * $0.015 = $0.15; 1M Class A * $4.50 = $4.50; 2M Class B * $0.36 = $0.72 => Total = $5.37
        assertThat(report.getStorageCostUsd()).isEqualTo(0.15);
        assertThat(report.getClassACostUsd()).isEqualTo(4.50);
        assertThat(report.getClassBCostUsd()).isEqualTo(0.72);
        assertThat(report.getEgressCostUsd()).isEqualTo(0.0);
        assertThat(report.getTotalPayableUsd()).isEqualTo(5.37);
        assertThat(report.getTotalPayableVnd()).isEqualTo(Math.round(5.37 * 25400));
    }

    @Test
    @DisplayName("getR2CostReport chuyển sang ước tính từ Database khi R2 ở chế độ dummy/offline")
    void getR2CostReport_fallbackDatabaseEstimate() {
        when(r2StorageService.inspectBucketSnapshot()).thenReturn(R2BucketSnapshot.builder()
                .bucketName("dummy_bucket")
                .liveConnected(false)
                .statusNote("Dummy storage mode")
                .trackedPutOps(10)
                .build());
        when(videoRepository.findAll()).thenReturn(List.of(Video.builder().id(UUID.randomUUID()).originalFileName("intro.mp4").sizeBytes(50_000_000L).build()));
        when(studentAnswerRepository.countAllAudioResponses()).thenReturn(10L);
        when(exerciseAudioRepository.count()).thenReturn(5L);
        when(assignmentRepository.findAll()).thenReturn(Collections.emptyList());
        when(lessonDocumentRepository.findAll()).thenReturn(Collections.emptyList());
        when(globalResourceRepository.findAll()).thenReturn(Collections.emptyList());
        when(userRepository.findAll()).thenReturn(Collections.emptyList());

        R2CostReportDto report = adminDatabaseService.getR2CostReport();

        assertThat(report.isLiveConnected()).isFalse();
        assertThat(report.getDataSourceMode()).isEqualTo("DATABASE_ESTIMATE");
        assertThat(report.getTotalObjects()).isEqualTo(16L);
        assertThat(report.getTotalPayableUsd()).isEqualTo(0.0); // Trong Free Tier 10GB
        assertThat(report.getCategoryBreakdowns()).hasSize(5);
    }
}
