package com.englishlearning.e2e;

import com.englishlearning.ai.controller.AdminAiMonitoringController;
import com.englishlearning.ai.controller.AiLabController;
import com.englishlearning.ai.controller.AiTtsController;
import com.englishlearning.ai.dto.AiStatsResponse;
import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.dto.StudentQuotaResponse;
import com.englishlearning.ai.dto.TtsRequest;
import com.englishlearning.ai.dto.TtsResponse;
import com.englishlearning.ai.dto.UpdateQuotaRequest;
import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.service.AiLabService;
import com.englishlearning.ai.service.AiMonitoringService;
import com.englishlearning.ai.service.GeminiClientService;
import com.englishlearning.ai.service.GroqClientService;
import com.englishlearning.ai.service.KokoroTtsClientService;
import com.englishlearning.ai.service.PythonIntegrationService;
import com.englishlearning.ai.service.ShadowingService;
import com.englishlearning.ai.service.WhisperPronunciationService;
import com.englishlearning.ai.service.impl.AiEvaluationServiceImpl;
import com.englishlearning.analytics.controller.AdminDashboardController;
import com.englishlearning.analytics.controller.AdminDatabaseController;
import com.englishlearning.analytics.controller.AnalyticsController;
import com.englishlearning.analytics.dto.AdminDashboardStats;
import com.englishlearning.analytics.dto.AdminDatabaseOverviewDto;
import com.englishlearning.analytics.dto.ClassroomDetailedReportDto;
import com.englishlearning.analytics.dto.R2CostReportDto;
import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.service.AdminDashboardService;
import com.englishlearning.analytics.service.AdminDatabaseService;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.analytics.service.ClassroomReportExcelExporter;
import com.englishlearning.assignment.controller.TeacherAssignmentController;
import com.englishlearning.assignment.dto.AssignmentRequest;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionOption;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.service.AssignmentService;
import com.englishlearning.assignment.service.ExcelImportService;
import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.assignment.service.impl.ExcelImportServiceImpl;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.controller.AdminUserController;
import com.englishlearning.auth.controller.AuthController;
import com.englishlearning.auth.dto.AuthResponse;
import com.englishlearning.auth.dto.LoginRequest;
import com.englishlearning.auth.dto.UserCreateByAdminRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.AdminUserService;
import com.englishlearning.auth.service.AuthService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.classroom.controller.AdminClassroomController;
import com.englishlearning.classroom.controller.StudentClassroomController;
import com.englishlearning.classroom.controller.TeacherClassroomController;
import com.englishlearning.classroom.dto.AssignTeacherRequest;
import com.englishlearning.classroom.dto.ClassroomResponse;
import com.englishlearning.classroom.dto.CreateClassroomRequest;
import com.englishlearning.classroom.dto.EnrollStudentRequest;
import com.englishlearning.classroom.dto.MyCourseResponse;
import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.config.JacksonConfig;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.curriculum.controller.CurriculumController;
import com.englishlearning.curriculum.controller.DailyStudyPlanController;
import com.englishlearning.curriculum.controller.VocabularyController;
import com.englishlearning.curriculum.dto.CreateDailyPlanRequest;
import com.englishlearning.curriculum.dto.CreatePlanItemRequest;
import com.englishlearning.curriculum.dto.DailyHomeworkOverviewResponse;
import com.englishlearning.curriculum.dto.DayDetailDto;
import com.englishlearning.curriculum.dto.DaySummaryDto;
import com.englishlearning.curriculum.dto.LessonRequest;
import com.englishlearning.curriculum.dto.LessonResponse;
import com.englishlearning.curriculum.dto.SectionGroupDto;
import com.englishlearning.curriculum.dto.TaskItemDto;
import com.englishlearning.curriculum.dto.VocabularyRequest;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.SpacedRepetitionStage;
import com.englishlearning.curriculum.service.CurriculumService;
import com.englishlearning.curriculum.service.DailyStudyPlanService;
import com.englishlearning.curriculum.service.DocumentStorageService;
import com.englishlearning.curriculum.service.TtsService;
import com.englishlearning.curriculum.service.VocabularyService;
import com.englishlearning.notification.controller.NotificationController;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.entity.Notification;
import com.englishlearning.notification.entity.NotificationType;
import com.englishlearning.notification.service.NotificationService;
import com.englishlearning.submission.controller.StudentSubmissionController;
import com.englishlearning.submission.controller.TeacherGradingController;
import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.dto.GradingResult;
import com.englishlearning.submission.dto.StudentAssignmentSummaryResponse;
import com.englishlearning.submission.dto.SubmissionRequest;
import com.englishlearning.submission.dto.SubmissionSummaryResponse;
import com.englishlearning.submission.dto.TeacherGradeRequest;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.service.SubmissionService;
import com.englishlearning.submission.service.impl.GradingEngineServiceImpl;
import com.englishlearning.system.AuditLog;
import com.englishlearning.system.controller.AuditLogController;
import com.englishlearning.system.repository.AuditLogRepository;
import com.englishlearning.video.controller.VideoController;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.service.VideoService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Full-Stack Closed-Loop E2E Verification across Admin -> Teacher -> Student -> Teacher -> Admin
 * plus Acoustic/3-Tier AI Resilience.
 *
 * Uses stateful in-memory persistence paired with REAL domain engines:
 *  - ExcelImportServiceImpl (parsing Mau_Nhap_Bai_Tap_Chuan.xlsx)
 *  - GradingEngineServiceImpl (auto-grading objective CBT items)
 *  - AiEvaluationServiceImpl (Tier 1 Acoustic -> Tier 2 Cloud -> Tier 3 Rule-Based Offline Fallback)
 *  - ClassroomReportExcelExporter (Apache POI workbook export)
 */
@WebMvcTest(controllers = {
        AuthController.class,
        AdminUserController.class,
        AdminClassroomController.class,
        AdminAiMonitoringController.class,
        AdminDashboardController.class,
        AdminDatabaseController.class,
        AuditLogController.class,
        NotificationController.class,
        TeacherClassroomController.class,
        CurriculumController.class,
        VocabularyController.class,
        VideoController.class,
        TeacherAssignmentController.class,
        DailyStudyPlanController.class,
        AiLabController.class,
        AiTtsController.class,
        StudentClassroomController.class,
        StudentSubmissionController.class,
        TeacherGradingController.class,
        AnalyticsController.class
})
@AutoConfigureMockMvc
@Import({
        SecurityConfig.class,
        JwtAuthenticationEntryPoint.class,
        GlobalExceptionHandler.class,
        JacksonConfig.class
})
@DisplayName("E2E Closed-Loop Journeys (Admin -> Teacher -> Student -> Teacher -> Admin & 3-Tier AI Resilience)")
class FullStackClosedLoopJourneyE2ETest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AuthService authService;
    @MockBean private AdminUserService adminUserService;
    @MockBean private ClassroomService classroomService;
    @MockBean private AiMonitoringService aiMonitoringService;
    @MockBean private AdminDashboardService adminDashboardService;
    @MockBean private AdminDatabaseService adminDatabaseService;
    @MockBean private AuditLogRepository auditLogRepository;
    @MockBean private NotificationService notificationService;
    @MockBean private CurriculumService curriculumService;
    @MockBean private VocabularyService vocabularyService;
    @MockBean private VideoService videoService;
    @MockBean private AssignmentService assignmentService;
    @MockBean private DocumentStorageService documentStorageService;
    @MockBean private AiLabService aiLabService;
    @MockBean private TtsService ttsService;
    @MockBean private ExerciseAudioService exerciseAudioService;
    @MockBean private KokoroTtsClientService kokoroTtsClientService;
    @MockBean private ExcelImportService excelImportService;
    @MockBean private DailyStudyPlanService dailyStudyPlanService;
    @MockBean private ShadowingService shadowingService;
    @MockBean private WhisperPronunciationService whisperPronunciationService;
    @MockBean private SubmissionService submissionService;
    @MockBean private AnalyticsService analyticsService;

    @MockBean private JwtService jwtService;
    @MockBean private UserDetailsService userDetailsService;
    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;

    // Real stateless/domain engines exercised inside the closed-loop workflow
    private GradingEngineServiceImpl realGradingEngine;
    private ClassroomReportExcelExporter realExcelExporter;
    private PythonIntegrationService tierPythonClient;
    private GeminiClientService tierGeminiClient;
    private GroqClientService tierGroqClient;
    private AiEvaluationServiceImpl realAiEvaluator;

    private final UUID adminId = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private final UUID teacherId = UUID.fromString("20000000-0000-0000-0000-000000000002");
    private final UUID studentId = UUID.fromString("30000000-0000-0000-0000-000000000003");

    private InMemoryPlatformState state;

    @BeforeEach
    void setUpStateAndEngines() throws Exception {
        state = new InMemoryPlatformState();
        realGradingEngine = new GradingEngineServiceImpl();
        realExcelExporter = new ClassroomReportExcelExporter();
        tierPythonClient = mock(PythonIntegrationService.class);
        tierGeminiClient = mock(GeminiClientService.class);
        tierGroqClient = mock(GroqClientService.class);
        realAiEvaluator = new AiEvaluationServiceImpl(
                tierPythonClient, tierGeminiClient, tierGroqClient, objectMapper);

        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());

        wireStatefulServices();
    }

    private CustomUserDetails principalFor(UUID id, String email, RoleName roleName) {
        User u = User.builder()
                .id(id)
                .email(email)
                .password("$2a$10$hiddenHashForTestOnly")
                .firstName(roleName.name())
                .lastName("E2E")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    private void wireStatefulServices() {
        // --- Auth & Admin Users ---
        when(authService.login(any(LoginRequest.class))).thenAnswer(inv -> {
            LoginRequest req = inv.getArgument(0);
            UserSummaryDto summary = state.usersByEmail.get(req.getEmail());
            AuthResponse resp = AuthResponse.builder()
                    .accessToken("jwt-e2e-" + summary.getId())
                    .expiresIn(3600)
                    .user(summary)
                    .build();
            return new AuthService.AuthResult(resp, "refresh-e2e-" + summary.getId());
        });

        UserSummaryDto adminSummary = UserSummaryDto.builder()
                .id(adminId).email("admin@elp.test").firstName("System").lastName("Admin")
                .roles(List.of("ROLE_ADMIN")).isActive(true).build();
        state.usersById.put(adminId, adminSummary);
        state.usersByEmail.put("admin@elp.test", adminSummary);

        when(adminUserService.createUser(any(UserCreateByAdminRequest.class))).thenAnswer(inv -> {
            UserCreateByAdminRequest req = inv.getArgument(0);
            RoleName r = req.getRoles().iterator().next();
            UUID uid = (r == RoleName.ROLE_TEACHER) ? teacherId : studentId;
            UserSummaryDto created = UserSummaryDto.builder()
                    .id(uid).email(req.getEmail()).firstName(req.getFirstName()).lastName(req.getLastName())
                    .phone(req.getPhone()).roles(List.of(r.name())).isActive(true)
                    .targetCefr("B2").currentLevel("B1").build();
            state.usersById.put(uid, created);
            state.usersByEmail.put(req.getEmail(), created);
            if (r == RoleName.ROLE_STUDENT) {
                state.quotas.put(uid, StudentQuotaResponse.builder()
                        .studentId(uid).email(req.getEmail())
                        .studentName(req.getFirstName() + " " + req.getLastName())
                        .role("STUDENT").serviceEngine("GEMINI")
                        .dailyUsed(0).dailyLimit(10).isBlocked(false)
                        .promptTokensUsed(0L).completionTokensUsed(0L).totalTokensUsed(0L)
                        .estimatedCostUsd(0.0).build());
            }
            state.recordAudit(adminId, "admin@elp.test", "CREATE", "User", uid.toString(),
                    "{\"email\":\"" + req.getEmail() + "\"}");
            return created;
        });

        // --- Classrooms ---
        when(classroomService.createClassroom(any(CreateClassroomRequest.class))).thenAnswer(inv -> {
            CreateClassroomRequest req = inv.getArgument(0);
            UUID cid = UUID.randomUUID();
            ClassroomResponse c = ClassroomResponse.builder()
                    .id(cid).name(req.getName()).description(req.getDescription())
                    .level(req.getLevel()).status(ClassStatus.OPEN)
                    .startDate(req.getStartDate()).endDate(req.getEndDate())
                    .maxStudents(req.getMaxStudents()).joinCode("E2E-IELTS")
                    .currentStudentsCount(0).createdAt(Instant.now()).build();
            state.classrooms.put(cid, c);
            state.recordAudit(adminId, "admin@elp.test", "CREATE", "Classroom", cid.toString(), "{\"name\":\"" + req.getName() + "\"}");
            return c;
        });

        when(classroomService.assignTeacher(any(UUID.class), any(AssignTeacherRequest.class))).thenAnswer(inv -> {
            UUID cid = inv.getArgument(0);
            AssignTeacherRequest req = inv.getArgument(1);
            ClassroomResponse c = state.classrooms.get(cid);
            UserSummaryDto t = state.usersById.get(req.getTeacherId());
            c.setTeacherId(t.getId());
            c.setTeacherName(t.getFirstName() + " " + t.getLastName());
            state.recordAudit(adminId, "admin@elp.test", "ASSIGN", "Classroom", cid.toString(),
                    "{\"teacherId\":\"" + t.getId() + "\"}");
            return c;
        });

        doAnswer(inv -> {
            UUID cid = inv.getArgument(0);
            EnrollStudentRequest req = inv.getArgument(1);
            UserSummaryDto s = state.usersByEmail.get(req.getStudentIdentifier());
            state.enrolledStudentsByClass.computeIfAbsent(cid, k -> new ArrayList<>()).add(s);
            ClassroomResponse c = state.classrooms.get(cid);
            c.setCurrentStudentsCount(state.enrolledStudentsByClass.get(cid).size());
            state.recordAudit(adminId, "admin@elp.test", "ENROLL", "Classroom", cid.toString(),
                    "{\"student\":\"" + s.getEmail() + "\"}");
            return null;
        }).when(classroomService).enrollStudent(any(UUID.class), any(EnrollStudentRequest.class));

        when(classroomService.getStudentCourses(any(UUID.class))).thenAnswer(inv -> {
            UUID sid = inv.getArgument(0);
            List<MyCourseResponse> list = new ArrayList<>();
            state.classrooms.values().forEach(c -> {
                List<UserSummaryDto> members = state.enrolledStudentsByClass.getOrDefault(c.getId(), List.of());
                if (members.stream().anyMatch(m -> m.getId().equals(sid))) {
                    int totalTasks = state.dailyPlanItems.size();
                    int doneTasks = state.completedAssignmentIds.size();
                    double pct = totalTasks > 0 ? Math.min(100.0, (doneTasks * 100.0) / totalTasks) : 0.0;
                    list.add(MyCourseResponse.builder()
                            .classId(c.getId()).className(c.getName()).level(c.getLevel())
                            .status(c.getStatus()).teacherName(c.getTeacherName())
                            .enrolledAt(Instant.now()).completedLessons(state.completedVideoCount)
                            .totalLessons(state.lessons.size()).completedTasks(doneTasks)
                            .totalTasks(totalTasks).progressPercentage(pct).build());
                }
            });
            return list;
        });

        // --- Quotas & Notifications ---
        doAnswer(inv -> {
            UUID sid = inv.getArgument(0);
            UpdateQuotaRequest req = inv.getArgument(1);
            StudentQuotaResponse q = state.quotas.get(sid);
            if (req.getDailyLimit() != null) q.setDailyLimit(req.getDailyLimit());
            if (req.getIsBlocked() != null) q.setIsBlocked(req.getIsBlocked());
            state.recordAudit(adminId, "admin@elp.test", "UPDATE", "StudentAiQuota", sid.toString(),
                    "{\"dailyLimit\":" + req.getDailyLimit() + "}");
            return null;
        }).when(aiMonitoringService).updateQuota(any(UUID.class), any(UpdateQuotaRequest.class));

        doAnswer(inv -> {
            NotificationDto dto = inv.getArgument(0);
            List<UUID> targets = dto.getRecipientUserId() != null
                    ? List.of(dto.getRecipientUserId())
                    : List.of(teacherId, studentId);
            for (UUID uid : targets) {
                User recUser = User.builder().id(uid).build();
                Notification n = Notification.builder()
                        .id(UUID.randomUUID()).recipient(recUser).classroomId(dto.getClassroomId())
                        .title(dto.getTitle()).message(dto.getEffectiveMessage())
                        .type(NotificationType.valueOf(dto.getNotificationType()))
                        .actionType(dto.getActionType()).targetUrl(dto.getTargetUrl())
                        .referenceId(dto.getReferenceId()).isRead(false).createdAt(Instant.now())
                        .build();
                state.notifications.add(n);
            }
            return null;
        }).when(notificationService).dispatchNotification(any(NotificationDto.class));

        when(notificationService.getMyNotifications(any(UUID.class), anyInt(), anyInt())).thenAnswer(inv -> {
            UUID uid = inv.getArgument(0);
            List<Notification> mine = state.notifications.stream()
                    .filter(n -> uid.equals(n.getRecipientUserId())).toList();
            return new PageImpl<>(mine);
        });

        // --- Lessons, Videos & Vocabulary ---
        when(curriculumService.createLesson(any(LessonRequest.class))).thenAnswer(inv -> {
            LessonRequest req = inv.getArgument(0);
            UUID lid = UUID.randomUUID();
            LessonResponse l = LessonResponse.builder()
                    .id(lid).classId(req.getClassId()).title(req.getTitle())
                    .objectives(req.getObjectives()).content(req.getContent())
                    .orderIndex(req.getOrderIndex()).completed(false)
                    .hasVideo(false).documentsCount(0).build();
            state.lessons.put(lid, l);
            state.recordAudit(teacherId, "teacher@elp.test", "CREATE", "Lesson", lid.toString(), "{\"title\":\"" + req.getTitle() + "\"}");
            return l;
        });

        when(videoService.uploadOriginalVideo(any(UUID.class), any(), any(UUID.class))).thenAnswer(inv -> {
            UUID lid = inv.getArgument(0);
            UUID vid = UUID.randomUUID();
            LessonResponse l = state.lessons.get(lid);
            if (l != null) l.setHasVideo(true);
            state.videoIds.add(vid);
            return VideoUploadResponse.builder()
                    .videoId(vid).status(VideoStatus.READY)
                    .originalFileName("lesson-intro.mp4").message("Uploaded & Ready HLS").build();
        });

        doAnswer(inv -> {
            WatchProgressRequest req = inv.getArgument(2);
            if (Boolean.TRUE.equals(req.getCompleted()) || (req.getWatchedSeconds() != null && req.getWatchedSeconds() >= 90)) {
                state.completedVideoCount = Math.max(state.completedVideoCount, 1);
                state.studentStreak = Math.max(state.studentStreak, 1);
            }
            return null;
        }).when(videoService).updateWatchProgress(any(UUID.class), any(UUID.class), any(WatchProgressRequest.class));

        when(vocabularyService.addVocabulary(any(UUID.class), any(VocabularyRequest.class))).thenAnswer(inv -> {
            UUID lid = inv.getArgument(0);
            VocabularyRequest req = inv.getArgument(1);
            UUID vId = UUID.randomUUID();
            VocabularyResponse vr = VocabularyResponse.builder()
                    .id(vId).lessonId(lid).word(req.getWord()).meaning(req.getMeaning())
                    .ipa(req.getIpa()).exampleSentence(req.getExampleSentence())
                    .partOfSpeech(req.getPartOfSpeech())
                    .audioUrl("/api/v1/ai/tts?text=" + req.getWord()).build();
            state.vocabularies.add(vr);
            state.vocabSrsStages.put(vId, SpacedRepetitionStage.NEW);
            return vr;
        });

        // --- Assignments: Manual CBT Creation + REAL ExcelImportServiceImpl + AI Quiz & Kokoro TTS ---
        when(assignmentService.createAssignment(any(AssignmentRequest.class))).thenAnswer(inv -> {
            AssignmentRequest req = inv.getArgument(0);
            Assignment ass = buildAssignmentFromRequest(req);
            state.assignments.put(ass.getId(), ass);
            state.recordAudit(teacherId, "teacher@elp.test", "CREATE", "Assignment", ass.getId().toString(),
                    "{\"isExam\":" + Boolean.TRUE.equals(ass.getIsExam()) + "}");
            return ass;
        });

        AssignmentRepository assRepoMock = mock(AssignmentRepository.class);
        AssignmentQuestionRepository qRepoMock = mock(AssignmentQuestionRepository.class);
        when(assRepoMock.findById(any(UUID.class))).thenAnswer(inv -> Optional.ofNullable(state.assignments.get(inv.<UUID>getArgument(0))));
        when(qRepoMock.saveAll(anyList())).thenAnswer(inv -> {
            List<AssignmentQuestion> qs = inv.getArgument(0);
            for (AssignmentQuestion q : qs) {
                if (q.getId() == null) q.setId(UUID.randomUUID());
                if (q.getAssignment() != null && !q.getAssignment().getQuestions().contains(q)) {
                    q.getAssignment().getQuestions().add(q);
                }
            }
            return qs;
        });
        ExcelImportServiceImpl realExcelImporter = new ExcelImportServiceImpl(assRepoMock, qRepoMock);
        when(excelImportService.importQuestionsFromExcel(any(), any(UUID.class))).thenAnswer(inv ->
                realExcelImporter.importQuestionsFromExcel(inv.getArgument(0), inv.getArgument(1)));

        when(aiLabService.generateQuizFromContent(anyString(), anyString(), anyInt(), any(UUID.class), any(), anyString(), any()))
                .thenAnswer(inv -> {
                    state.aiPromptTokens += 320;
                    state.aiCompletionTokens += 480;
                    state.aiTotalRequests++;
                    return AiGeneratedExercise.builder()
                            .id(UUID.randomUUID()).targetCefr("B2").exerciseType("MULTIPLE_CHOICE")
                            .questionCount(2).status(GenerationStatus.READY_FOR_REVIEW)
                            .rawResponseJson("{\"questions\":[{\"promptText\":\"AI Quiz Q1\",\"correctAnswer\":\"A\"}]}")
                            .build();
                });

        when(kokoroTtsClientService.synthesizeSpeech(any(TtsRequest.class))).thenAnswer(inv -> {
            TtsRequest req = inv.getArgument(0);
            return TtsResponse.builder()
                    .audioUrl("/uploads/tts/" + Math.abs(req.getText().hashCode()) + ".wav")
                    .voice(req.getVoice()).speed(req.getSpeed()).durationSeconds(2.4).cached(false).build();
        });

        // --- DailyStudyPlan & Timeline ---
        when(dailyStudyPlanService.createDailyPlan(any(CreateDailyPlanRequest.class))).thenAnswer(inv -> {
            CreateDailyPlanRequest req = inv.getArgument(0);
            DailyStudyPlan plan = DailyStudyPlan.builder()
                    .id(UUID.randomUUID())
                    .classroom(Classroom.builder().id(req.getClassroomId()).name("E2E").build())
                    .dayNumber(req.getDayNumber()).scheduledDate(req.getScheduledDate())
                    .title(req.getTitle()).estimatedMinutes(req.getEstimatedMinutes())
                    .isUnlocked(true).items(new ArrayList<>()).build();
            state.dailyPlans.put(plan.getId(), plan);
            return plan;
        });

        when(dailyStudyPlanService.addPlanItem(any(UUID.class), any(CreatePlanItemRequest.class))).thenAnswer(inv -> {
            UUID planId = inv.getArgument(0);
            CreatePlanItemRequest req = inv.getArgument(1);
            DailyStudyPlan plan = state.dailyPlans.get(planId);
            Assignment linked = req.getAssignmentId() != null ? state.assignments.get(req.getAssignmentId()) : null;
            DailyPlanItem item = DailyPlanItem.builder()
                    .id(UUID.randomUUID()).dailyPlan(plan).sectionName(req.getSectionName())
                    .title(req.getTitle()).itemType(req.getItemType())
                    .orderIndex(req.getOrderIndex()).assignment(linked).build();
            plan.getItems().add(item);
            state.dailyPlanItems.add(item);
            return item;
        });

        when(dailyStudyPlanService.getStudentDailyOverview(any(UUID.class), any(UUID.class), any())).thenAnswer(inv -> {
            List<DaySummaryDto> summaries = new ArrayList<>();
            List<SectionGroupDto> sectionGroups = new ArrayList<>();
            for (DailyStudyPlan p : state.dailyPlans.values()) {
                boolean dayDone = !p.getItems().isEmpty() && p.getItems().stream()
                        .filter(i -> i.getAssignment() != null)
                        .allMatch(i -> state.completedAssignmentIds.contains(i.getAssignment().getId()));
                summaries.add(DaySummaryDto.builder()
                        .id(p.getId()).dayNumber(p.getDayNumber()).title(p.getTitle())
                        .scheduledDate(p.getScheduledDate()).estimatedMinutes(p.getEstimatedMinutes())
                        .isCompleted(dayDone).isCurrentDay(true).isUnlocked(true).build());
                Map<String, List<TaskItemDto>> grouped = new LinkedHashMap<>();
                for (DailyPlanItem it : p.getItems()) {
                    UUID aid = it.getAssignment() != null ? it.getAssignment().getId() : null;
                    grouped.computeIfAbsent(it.getSectionName(), k -> new ArrayList<>())
                            .add(TaskItemDto.builder()
                                    .id(it.getId()).title(it.getTitle()).itemType(it.getItemType())
                                    .orderIndex(it.getOrderIndex()).assignmentId(aid)
                                    .isDone(aid != null && state.completedAssignmentIds.contains(aid))
                                    .build());
                }
                grouped.forEach((sec, items) -> sectionGroups.add(
                        SectionGroupDto.builder().sectionName(sec).items(items).build()));
            }
            DaySummaryDto first = summaries.isEmpty() ? null : summaries.get(0);
            int totalDays = summaries.size();
            int doneDays = (int) summaries.stream().filter(d -> Boolean.TRUE.equals(d.getIsCompleted())).count();
            int pct = totalDays == 0 ? 0 : (doneDays * 100) / totalDays;
            return DailyHomeworkOverviewResponse.builder()
                    .completionPercentage(pct).totalDays(totalDays).completedDays(doneDays)
                    .days(summaries)
                    .currentSelectedDay(first == null ? null : DayDetailDto.builder()
                            .id(first.getId()).dayNumber(first.getDayNumber()).title(first.getTitle())
                            .scheduledDate(first.getScheduledDate()).estimatedMinutes(first.getEstimatedMinutes())
                            .isCompleted(first.getIsCompleted()).sections(sectionGroups).build())
                    .build();
        });

        // --- Acoustic AI Shadowing (uses REAL AiEvaluationServiceImpl + deducts quota) ---
        when(shadowingService.evaluateShadowing(any(), any(), anyString())).thenAnswer(inv -> {
            org.springframework.web.multipart.MultipartFile audio = inv.getArgument(0);
            String ref = inv.getArgument(2);
            ShadowingEvaluationResponse eval = realAiEvaluator.evaluateSpeech(
                    audio != null ? audio.getBytes() : new byte[0],
                    audio != null ? audio.getOriginalFilename() : "sample.wav",
                    ref);
            StudentQuotaResponse q = state.quotas.get(studentId);
            if (q != null) {
                q.setDailyUsed(q.getDailyUsed() + 1);
                q.setPromptTokensUsed(q.getPromptTokensUsed() + 250);
                q.setCompletionTokensUsed(q.getCompletionTokensUsed() + 300);
                q.setTotalTokensUsed(q.getPromptTokensUsed() + q.getCompletionTokensUsed());
                q.setEstimatedCostUsd(q.getEstimatedCostUsd() + 0.00011);
            }
            state.aiPromptTokens += 250;
            state.aiCompletionTokens += 300;
            state.aiTotalRequests++;
            if ("RULE_BASED_OFFLINE_FALLBACK".equals(eval.getEvaluatedBy())) {
                state.recordAudit(studentId, "student@elp.test", "AI_FALLBACK_LOCAL", "Shadowing",
                        ref, "{\"evaluatedBy\":\"RULE_BASED_OFFLINE_FALLBACK\",\"reason\":\"TIER_1_2_UNAVAILABLE\"}");
            }
            state.latestPronunciationScore = eval.getKpi() != null && eval.getKpi().getPronunciation() != null
                    ? eval.getKpi().getPronunciation().doubleValue() : 85.0;
            state.latestFluencyScore = eval.getKpi() != null && eval.getKpi().getFluency() != null
                    ? eval.getKpi().getFluency().doubleValue() : 82.0;
            return eval;
        });

        // --- Student Attempt Start / Upload Audio / Submit (using REAL GradingEngineServiceImpl) ---
        when(submissionService.getStudentClassAssignments(any(UUID.class), any(UUID.class))).thenAnswer(inv ->
                state.assignments.values().stream()
                        .map(a -> StudentAssignmentSummaryResponse.builder()
                                .id(a.getId()).title(a.getTitle()).description(a.getDescription())
                                .skillType(a.getSkillType().name()).timeLimitMinutes(a.getTimeLimitMinutes())
                                .maxAttempts(a.getMaxAttempts()).passScore(a.getPassScore())
                                .isExam(a.getIsExam()).strictFullscreen(a.getStrictFullscreen())
                                .maxViolations(a.getMaxViolations()).status("PENDING").build())
                        .toList());

        when(submissionService.startAttempt(any(UUID.class), any(UUID.class))).thenAnswer(inv -> {
            UUID aid = inv.getArgument(1);
            Assignment ass = state.assignments.get(aid);
            UUID attemptId = UUID.randomUUID();
            List<AttemptResponse.QuestionResultDetail> qDetails = ass.getQuestions().stream().map(q ->
                    AttemptResponse.QuestionResultDetail.builder()
                            .id(q.getId()).questionId(q.getId()).promptText(q.getPromptText())
                            .questionType(q.getQuestionType().name())
                            .skillType(q.getSkillType() != null ? q.getSkillType().name() : ass.getSkillType().name())
                            .maxPoints(q.getPoints()).transcript(q.getTranscript())
                            .options(q.getOptions().stream().map(o -> AttemptResponse.OptionDetail.builder()
                                    .id(o.getId()).optionLabel(o.getOptionLabel()).optionText(o.getOptionText())
                                    .matchText(o.getMatchText()).isCorrect(o.getIsCorrect()).build()).toList())
                            .build()).toList();
            AttemptResponse resp = AttemptResponse.builder()
                    .attemptId(attemptId).assignmentId(aid).assignmentTitle(ass.getTitle())
                    .skillType(ass.getSkillType().name()).attemptNumber(1)
                    .status(AttemptStatus.IN_PROGRESS.name()).startedAt(Instant.now())
                    .isExam(ass.getIsExam()).strictFullscreen(ass.getStrictFullscreen())
                    .maxViolations(ass.getMaxViolations()).questions(qDetails).build();
            state.attempts.put(attemptId, resp);
            return resp;
        });

        when(submissionService.uploadAudioResponse(any(UUID.class), any(UUID.class), any(UUID.class), any()))
                .thenAnswer(inv -> {
                    UUID attemptId = inv.getArgument(1);
                    UUID qId = inv.getArgument(2);
                    AttemptResponse att = state.attempts.get(attemptId);
                    att.getQuestions().stream().filter(q -> q.getQuestionId().equals(qId)).findFirst()
                            .ifPresent(q -> q.setAudioUrl("/uploads/audio/" + attemptId + "/" + qId + ".wav"));
                    return att;
                });

        when(submissionService.submitAttempt(any(UUID.class), any(UUID.class), any(SubmissionRequest.class)))
                .thenAnswer(inv -> {
                    UUID aid = inv.getArgument(0);
                    UUID attemptId = inv.getArgument(1);
                    SubmissionRequest req = inv.getArgument(2);
                    Assignment ass = state.assignments.get(req.getAssignmentId());
                    AttemptResponse att = state.attempts.get(attemptId);

                    GradingResult graded = realGradingEngine.evaluateSubmission(ass.getQuestions(), req.getAnswers());
                    boolean needsTeacher = graded.isRequiresAiGrading();
                    att.setSubmittedAt(Instant.now());
                    att.setScore(graded.getScaledScore());
                    att.setStatus(needsTeacher ? AttemptStatus.SUBMITTED.name() : AttemptStatus.COMPLETED.name());
                    att.setAnswersPersisted(true);
                    att.setIsCheatingFlagged(Boolean.TRUE.equals(req.getCheatingFlagged()));
                    att.setViolationCount(req.getViolationCount() != null ? req.getViolationCount() : 0);

                    Map<UUID, SubmissionRequest.AnswerDto> reqMap = new LinkedHashMap<>();
                    for (SubmissionRequest.AnswerDto ad : req.getAnswers()) reqMap.put(ad.getQuestionId(), ad);
                    for (AttemptResponse.QuestionResultDetail qd : att.getQuestions()) {
                        SubmissionRequest.AnswerDto ansDto = reqMap.get(qd.getQuestionId());
                        if (ansDto != null) {
                            qd.setSelectedOptionId(ansDto.getSelectedOptionId());
                            qd.setStudentAnswer(ansDto.getTextAnswer());
                        }
                        qd.setEarnedPoints(graded.getEarnedPointsPerQuestion().getOrDefault(qd.getQuestionId(), 0.0));
                        qd.setIsCorrect(graded.getCorrectnessPerQuestion().getOrDefault(qd.getQuestionId(), false));
                    }

                    state.completedAssignmentIds.add(ass.getId());
                    state.studentStreak = Math.max(state.studentStreak, 1);
                    if (!needsTeacher) {
                        state.skillScores.put(ass.getSkillType(), Math.round(graded.getScaledScore() * 10.0) * 1.0);
                    }
                    return att;
                });

        // --- Teacher Grading & Notifications & Analytics ---
        when(submissionService.getTeacherSubmissions(any(UUID.class))).thenAnswer(inv -> {
            UUID assignmentId = inv.getArgument(0);
            UserSummaryDto st = state.usersById.get(studentId);
            return state.attempts.values().stream()
                    .filter(a -> assignmentId.equals(a.getAssignmentId()))
                    .map(a -> SubmissionSummaryResponse.builder()
                            .attemptId(a.getAttemptId()).studentId(studentId)
                            .studentName(st.getFirstName() + " " + st.getLastName())
                            .studentEmail(st.getEmail()).attemptNumber(a.getAttemptNumber())
                            .score(a.getScore()).status(a.getStatus()).submittedAt(a.getSubmittedAt())
                            .isCheatingFlagged(Boolean.TRUE.equals(a.getIsCheatingFlagged()))
                            .violationCount(a.getViolationCount()).build())
                    .toList();
        });

        when(submissionService.gradeSubmission(any(UUID.class), any(TeacherGradeRequest.class))).thenAnswer(inv -> {
            UUID attemptId = inv.getArgument(0);
            TeacherGradeRequest req = inv.getArgument(1);
            AttemptResponse att = state.attempts.get(attemptId);
            att.setScore(req.getFinalScore());
            att.setTeacherFeedback(req.getFeedback());
            att.setStatus(AttemptStatus.COMPLETED.name());
            if (req.getAnswerScores() != null) {
                for (AttemptResponse.QuestionResultDetail qd : att.getQuestions()) {
                    if (req.getAnswerScores().containsKey(qd.getQuestionId())) {
                        qd.setEarnedPoints(req.getAnswerScores().get(qd.getQuestionId()));
                        qd.setIsCorrect(qd.getEarnedPoints() >= 5.0);
                    }
                }
            }
            Assignment ass = state.assignments.get(att.getAssignmentId());
            double normalized100 = Math.min(100.0, req.getFinalScore() * 10.0);
            state.skillScores.put(ass.getSkillType(), normalized100);
            state.skillScores.put(SkillType.WRITING, normalized100);

            User stu = User.builder().id(studentId).build();
            state.notifications.add(Notification.builder()
                    .id(UUID.randomUUID()).recipient(stu).classroomId(ass.getClassroom().getId())
                    .title("Bài tập đã được chấm điểm")
                    .message("Giảng viên đã chốt điểm " + req.getFinalScore() + "/10: " + req.getFeedback())
                    .type(NotificationType.NEW_GRADE).actionType("REVIEW_SUBMISSION")
                    .referenceId(attemptId.toString()).isRead(false).createdAt(Instant.now()).build());
            state.recordAudit(teacherId, "teacher@elp.test", "UPDATE", "AssignmentAttempt", attemptId.toString(),
                    "{\"finalScore\":" + req.getFinalScore() + "}");
            return att;
        });

        when(analyticsService.getMyProfile(any(UUID.class))).thenAnswer(inv -> StudentSkillProfile.builder()
                .id(studentId)
                .listeningScore(state.skillScores.getOrDefault(SkillType.LISTENING, 80.0))
                .speakingScore(state.skillScores.getOrDefault(SkillType.SPEAKING, 85.0))
                .readingScore(state.skillScores.getOrDefault(SkillType.READING, 90.0))
                .writingScore(state.skillScores.getOrDefault(SkillType.WRITING, 88.0))
                .grammarScore(state.skillScores.getOrDefault(SkillType.GRAMMAR, 85.0))
                .vocabularyScore(state.skillScores.getOrDefault(SkillType.VOCABULARY, 92.0))
                .pronunciationScore(state.latestPronunciationScore)
                .fluencyScore(state.latestFluencyScore)
                .aiRecommendedPath("Tiếp tục duy trì chuỗi luyện nói IPA và viết luận B2.")
                .build());

        // --- Admin Monitoring, Audit Logs, Reporting & Storage ---
        when(aiMonitoringService.getStats()).thenAnswer(inv -> AiStatsResponse.builder()
                .totalTokens(state.aiPromptTokens + state.aiCompletionTokens)
                .promptTokens(state.aiPromptTokens).completionTokens(state.aiCompletionTokens)
                .estimatedCostUsd(0.0012).monthlyCostUsd(0.0012)
                .activeUsers(1).blockedUsers(0).systemQuotaRemainingPercent(98.5)
                .systemKillSwitchActive(false)
                .geminiStats(AiStatsResponse.AiEngineStatsDto.builder()
                        .engineName("Gemini 2.5 Flash").totalTokens(state.aiPromptTokens + state.aiCompletionTokens)
                        .totalRequests(state.aiTotalRequests).isHealthy(true).build())
                .groqStats(AiStatsResponse.AiEngineStatsDto.builder()
                        .engineName("Groq Whisper + LLaMA").totalRequests(0).isHealthy(true).build())
                .studentQuotas(new ArrayList<>(state.quotas.values()))
                .build());

        when(auditLogRepository.findAll(any(Pageable.class))).thenAnswer(inv -> new PageImpl<>(state.auditLogs));

        when(adminDashboardService.getDashboardStats()).thenAnswer(inv -> AdminDashboardStats.builder()
                .totalUsers(state.usersById.size()).totalTeachers(1).totalStudents(1)
                .totalClasses(state.classrooms.size()).openClasses(state.classrooms.size())
                .totalLessons(state.lessons.size()).totalVideos(state.videoIds.size())
                .totalAssignments(state.assignments.size()).totalSubmissions(state.attempts.size())
                .completionRate(100.0).build());

        when(adminDatabaseService.getDatabaseOverview()).thenAnswer(inv -> AdminDatabaseOverviewDto.builder()
                .totalClassrooms(state.classrooms.size()).totalEnrolledStudents(1)
                .totalAssignments(state.assignments.size()).totalAttempts(state.attempts.size())
                .estimatedSubmissionDataKb(64).build());

        when(adminDatabaseService.getClassroomDetailedReport(any(UUID.class))).thenAnswer(inv -> {
            UUID cid = inv.getArgument(0);
            ClassroomResponse c = state.classrooms.get(cid);
            UserSummaryDto st = state.usersById.get(studentId);
            UserSummaryDto tc = state.usersById.get(teacherId);
            List<ClassroomDetailedReportDto.AttemptReportRowDto> attemptRows = state.attempts.values().stream()
                    .map(a -> ClassroomDetailedReportDto.AttemptReportRowDto.builder()
                            .attemptId(a.getAttemptId()).studentName(st.getFirstName() + " " + st.getLastName())
                            .studentEmail(st.getEmail()).assignmentTitle(a.getAssignmentTitle())
                            .skillType(a.getSkillType()).exam(Boolean.TRUE.equals(a.getIsExam()))
                            .attemptNumber(a.getAttemptNumber()).status(a.getStatus())
                            .submittedAt(Instant.now().toString()).durationSeconds(120)
                            .totalScore(a.getScore()).violationCount(a.getViolationCount() != null ? a.getViolationCount() : 0)
                            .cheatingFlagged(Boolean.TRUE.equals(a.getIsCheatingFlagged()))
                            .teacherFeedback(a.getTeacherFeedback()).build())
                    .toList();
            return ClassroomDetailedReportDto.builder()
                    .classroomId(cid).classroomName(c.getName()).description(c.getDescription())
                    .level(c.getLevel().name()).status(c.getStatus().name())
                    .teacherName(c.getTeacherName()).teacherEmail(tc.getEmail())
                    .startDate("2026-01-01").endDate("2026-06-30").generatedAt(Instant.now())
                    .totalStudents(1).totalLessons(state.lessons.size()).totalDailyPlans(state.dailyPlans.size())
                    .totalAssignments(state.assignments.size()).totalExams(1)
                    .totalAttempts(state.attempts.size()).completedAttempts(state.attempts.size())
                    .classAverageScore(9.0).averageCompletionRate(100.0)
                    .students(List.of(ClassroomDetailedReportDto.StudentReportRowDto.builder()
                            .studentId(studentId).fullName(st.getFirstName() + " " + st.getLastName())
                            .email(st.getEmail()).phone(st.getPhone()).enrolledAt("2026-01-05")
                            .completedTasks(state.completedAssignmentIds.size())
                            .totalTasks(state.dailyPlanItems.size()).completionRate(100)
                            .averageScore(9.0).totalAttempts(state.attempts.size())
                            .examAttempts(1).cheatingFlags(0).totalStudyMinutes(45)
                            .classification("Xuất sắc").build()))
                    .submissions(attemptRows)
                    .build();
        });

        when(adminDatabaseService.exportClassroomReportExcel(any(ClassroomDetailedReportDto.class)))
                .thenAnswer(inv -> realExcelExporter.export(inv.getArgument(0)));

        when(adminDatabaseService.getR2CostReport()).thenAnswer(inv -> R2CostReportDto.builder()
                .bucketName("elp-media-prod").liveConnected(false).dataSourceMode("ESTIMATED_LOCAL")
                .statusMessage("Đang dùng chế độ lưu trữ cục bộ / R2 Dummy fallback").totalObjects(3)
                .totalBytes(524288).totalStorageGb(0.0005).freeStorageGb(10.0)
                .freeTierUsagePercent(0.01).totalPayableUsd(0.0).monthlyBudgetUsd(5.0)
                .generatedAt(Instant.now()).build());
    }

    private Assignment buildAssignmentFromRequest(AssignmentRequest req) {
        UUID aid = UUID.randomUUID();
        Assignment ass = Assignment.builder()
                .id(aid)
                .classroom(Classroom.builder().id(req.getClassroomId()).name("E2E").build())
                .title(req.getTitle()).description(req.getDescription())
                .skillType(SkillType.valueOf(req.getSkillType().toUpperCase()))
                .timeLimitMinutes(req.getTimeLimitMinutes()).maxAttempts(req.getMaxAttempts())
                .passScore(req.getPassScore()).isExam(Boolean.TRUE.equals(req.getIsExam()))
                .strictFullscreen(Boolean.TRUE.equals(req.getStrictFullscreen()))
                .maxViolations(req.getMaxViolations() != null ? req.getMaxViolations() : 3)
                .questions(new ArrayList<>()).build();
        int idx = 1;
        if (req.getQuestions() != null) {
            for (AssignmentRequest.QuestionRequest qr : req.getQuestions()) {
                AssignmentQuestion q = AssignmentQuestion.builder()
                        .id(UUID.randomUUID()).assignment(ass).orderIndex(idx++)
                        .promptText(qr.getPromptText())
                        .questionType(QuestionType.valueOf(qr.getQuestionType().toUpperCase()))
                        .skillType(qr.getSkillType() != null ? SkillType.valueOf(qr.getSkillType().toUpperCase()) : ass.getSkillType())
                        .correctAnswer(qr.getCorrectAnswer()).explanation(qr.getExplanation())
                        .transcript(qr.getTranscript()).points(qr.getPoints() != null ? qr.getPoints() : 1.0)
                        .options(new ArrayList<>()).build();
                if (qr.getOptions() != null) {
                    char lbl = 'A';
                    for (AssignmentRequest.OptionRequest or : qr.getOptions()) {
                        q.getOptions().add(QuestionOption.builder()
                                .id(UUID.randomUUID()).question(q).optionLabel(String.valueOf(lbl++))
                                .optionText(or.getOptionText()).matchText(or.getMatchText())
                                .isCorrect(Boolean.TRUE.equals(or.getIsCorrect())).build());
                    }
                }
                ass.getQuestions().add(q);
            }
        }
        return ass;
    }

    // =========================================================================
    // FULL E2E TEST SUITE: ALL 4 CLOSED-LOOP JOURNEYS + RBAC + 3-TIER AI
    // =========================================================================

    @Test
    @DisplayName("Journeys 1-3 Closed-Loop E2E: Admin Setup -> Teacher Authoring (Manual, Mau_Nhap_Bai_Tap_Chuan.xlsx, AI+TTS, DailyPlan) -> Student Learning/Shadowing/Exam -> Teacher Grading -> Admin Reporting & R2")
    void closedLoopJourneys1To3_fullLifecycle_succeedsWithoutBottlenecks() throws Exception {
        CustomUserDetails adminUser = principalFor(adminId, "admin@elp.test", RoleName.ROLE_ADMIN);
        CustomUserDetails teacherUser = principalFor(teacherId, "teacher@elp.test", RoleName.ROLE_TEACHER);
        CustomUserDetails studentUser = principalFor(studentId, "student@elp.test", RoleName.ROLE_STUDENT);

        // =====================================================================
        // JOURNEY 1 - STEP 1: ADMIN CREATES TEACHER, STUDENT, CLASSROOM, QUOTA, BROADCAST
        // =====================================================================
        UserCreateByAdminRequest createTeacher = UserCreateByAdminRequest.builder()
                .email("teacher@elp.test").password("Teacher@123").firstName("Minh").lastName("Teacher")
                .phone("0901000111").roles(Set.of(RoleName.ROLE_TEACHER)).build();
        mockMvc.perform(post("/api/v1/admin/users").with(user(adminUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createTeacher)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(teacherId.toString()));

        UserCreateByAdminRequest createStudent = UserCreateByAdminRequest.builder()
                .email("student@elp.test").password("Student@123").firstName("Lan").lastName("Student")
                .phone("0902000222").roles(Set.of(RoleName.ROLE_STUDENT)).build();
        mockMvc.perform(post("/api/v1/admin/users").with(user(adminUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createStudent)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(studentId.toString()));

        // Login works with issued JWT + HttpOnly refreshToken cookie
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"teacher@elp.test\",\"password\":\"Teacher@123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("jwt-e2e-" + teacherId))
                .andExpect(header().exists("Set-Cookie"));

        CreateClassroomRequest classReq = CreateClassroomRequest.builder()
                .name("IELTS Intensive B2 - E2E").description("Lop hoc E2E toan dien 4 ky nang")
                .level(ClassLevel.B2).startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 6, 30))
                .maxStudents(25).build();
        MvcResult classRes = mockMvc.perform(post("/api/admin/classrooms").with(user(adminUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(classReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("OPEN"))
                .andReturn();
        UUID classroomId = UUID.fromString(objectMapper.readTree(classRes.getResponse().getContentAsString()).path("data").path("id").asText());

        AssignTeacherRequest assignReq = new AssignTeacherRequest();
        assignReq.setTeacherId(teacherId);
        mockMvc.perform(put("/api/admin/classrooms/{id}/assign-teacher", classroomId).with(user(adminUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(assignReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.teacherId").value(teacherId.toString()));

        EnrollStudentRequest enrollReq = new EnrollStudentRequest();
        enrollReq.setStudentIdentifier("student@elp.test");
        mockMvc.perform(post("/api/admin/classrooms/{id}/enroll", classroomId).with(user(adminUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(enrollReq)))
                .andExpect(status().isOk());

        UpdateQuotaRequest quotaReq = new UpdateQuotaRequest();
        quotaReq.setDailyLimit(25);
        quotaReq.setIsBlocked(false);
        mockMvc.perform(put("/api/v1/admin/ai-monitoring/quotas/{studentId}", studentId).with(user(adminUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(quotaReq)))
                .andExpect(status().isOk());

        NotificationDto broadcast = NotificationDto.builder()
                .classroomId(classroomId).title("Khai giảng khóa IELTS Intensive")
                .message("Chào mừng Giảng viên và Học viên tham gia lớp học.")
                .notificationType("ANNOUNCEMENT").actionType("TEXT_ANNOUNCEMENT").build();
        mockMvc.perform(post("/api/v1/notifications/broadcast").with(user(adminUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(broadcast)))
                .andExpect(status().isOk());

        // Security check: Student cannot call Admin Quota endpoint (RBAC 403)
        mockMvc.perform(put("/api/v1/admin/ai-monitoring/quotas/{studentId}", studentId).with(user(studentUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(quotaReq)))
                .andExpect(status().isForbidden());

        // =====================================================================
        // JOURNEY 1 - STEP 2: TEACHER LOGS IN, READS NOTIFICATION, CREATES LESSON + VIDEO + VOCAB + 3 ASSIGNMENT MODES + EXAM + DAILY PLAN
        // =====================================================================
        mockMvc.perform(get("/api/v1/notifications").with(user(teacherUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].title").value("Khai giảng khóa IELTS Intensive"));

        LessonRequest lessonReq = new LessonRequest();
        lessonReq.setClassId(classroomId);
        lessonReq.setTitle("Lesson 1: Academic Environment & Phonetics");
        lessonReq.setObjectives("Master key vocabulary and /θ/, /iː/ articulation");
        lessonReq.setOrderIndex(1);
        MvcResult lessonRes = mockMvc.perform(post("/api/curriculum/lessons").with(user(teacherUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(lessonReq)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID lessonId = UUID.fromString(objectMapper.readTree(lessonRes.getResponse().getContentAsString()).path("data").path("id").asText());

        MockMultipartFile mp4File = new MockMultipartFile("file", "lesson-intro.mp4", "video/mp4", new byte[]{0, 0, 0, 24, 102, 116, 121, 112});
        MvcResult videoRes = mockMvc.perform(multipart("/api/v1/videos")
                        .file(mp4File)
                        .param("lessonId", lessonId.toString())
                        .with(user(teacherUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READY"))
                .andReturn();
        UUID videoId = UUID.fromString(objectMapper.readTree(videoRes.getResponse().getContentAsString()).path("data").path("videoId").asText());

        VocabularyRequest vocabReq = new VocabularyRequest();
        vocabReq.setWord("resilient");
        vocabReq.setMeaning("kiên cường, phục hồi nhanh");
        vocabReq.setIpa("/rɪˈzɪl.jənt/");
        vocabReq.setPartOfSpeech("adjective");
        vocabReq.setExampleSentence("Resilient learners adapt quickly to challenges.");
        MvcResult vocabRes = mockMvc.perform(post("/api/curriculum/lessons/{lessonId}/vocabularies", lessonId).with(user(teacherUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(vocabReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.word").value("resilient"))
                .andReturn();
        UUID vocabId = UUID.fromString(objectMapper.readTree(vocabRes.getResponse().getContentAsString()).path("data").path("id").asText());

        // Mode A: Manual CBT Assignment covering ALL 6 QuestionTypes
        AssignmentRequest manualCbtReq = buildFull6TypesAssignmentRequest(classroomId, lessonId, false);
        MvcResult manualAssRes = mockMvc.perform(post("/api/v1/teacher/assignments").with(user(teacherUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(manualCbtReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.questions.length()").value(6))
                .andReturn();
        JsonNode manualAssJson = objectMapper.readTree(manualAssRes.getResponse().getContentAsString()).path("data");
        UUID manualAssId = UUID.fromString(manualAssJson.path("id").asText());

        // Mode B: Import questions directly from repository's REAL Mau_Nhap_Bai_Tap_Chuan.xlsx!
        byte[] templateXlsx = Files.readAllBytes(Path.of("Mau_Nhap_Bai_Tap_Chuan.xlsx"));
        MockMultipartFile xlsxUpload = new MockMultipartFile(
                "file", "Mau_Nhap_Bai_Tap_Chuan.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", templateXlsx);
        MvcResult importRes = mockMvc.perform(multipart("/api/v1/teacher/assignments/{id}/import-excel", manualAssId)
                        .file(xlsxUpload)
                        .with(user(teacherUser)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode importedQuestions = objectMapper.readTree(importRes.getResponse().getContentAsString()).path("data");
        assertThat(importedQuestions.size()).isEqualTo(11);
        Set<String> importedTypes = EnumSet.noneOf(QuestionType.class).stream().map(Enum::name).collect(java.util.stream.Collectors.toSet());
        importedQuestions.forEach(q -> importedTypes.add(q.path("questionType").asText()));
        assertThat(importedTypes).containsExactlyInAnyOrder(
                "MULTIPLE_CHOICE", "FILL_IN_BLANK", "MATCHING", "AUDIO_RESPONSE", "ESSAY", "TRUE_FALSE");

        // Mode C: AI Quiz Generation + Kokoro TTS audio synthesis
        mockMvc.perform(post("/api/v1/ai/exercise/generate-quiz")
                        .with(user(teacherUser))
                        .param("targetCefr", "B2")
                        .param("count", "2")
                        .param("lessonId", lessonId.toString())
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("Climate resilience and urban sustainability"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READY_FOR_REVIEW"));

        mockMvc.perform(post("/api/v1/ai/tts").with(user(teacherUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(TtsRequest.builder()
                                .text("Consistency is the key to mastering any new skill.")
                                .voice("af_heart").speed(1.0).build())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.audioUrl").isNotEmpty());

        // Exam Creation (isExam = true, strictFullscreen = true)
        AssignmentRequest examReq = buildFull6TypesAssignmentRequest(classroomId, lessonId, true);
        examReq.setTitle("Midterm Proctored CBT Exam");
        MvcResult examRes = mockMvc.perform(post("/api/v1/teacher/assignments").with(user(teacherUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(examReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.isExam").value(true))
                .andReturn();
        UUID examId = UUID.fromString(objectMapper.readTree(examRes.getResponse().getContentAsString()).path("data").path("id").asText());

        // DailyStudyPlan & Item Timeline
        CreateDailyPlanRequest planReq = new CreateDailyPlanRequest();
        planReq.setClassroomId(classroomId);
        planReq.setDayNumber(1);
        planReq.setScheduledDate(LocalDate.now());
        planReq.setTitle("DAY 1");
        planReq.setEstimatedMinutes(45);
        MvcResult planRes = mockMvc.perform(post("/api/v1/curriculum/daily-plans").with(user(teacherUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(planReq)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID planId = UUID.fromString(objectMapper.readTree(planRes.getResponse().getContentAsString()).path("data").path("id").asText());

        CreatePlanItemRequest item1 = new CreatePlanItemRequest();
        item1.setSectionName("A. CORE CBT PRACTICE");
        item1.setTitle("1. 6-Skill Comprehensive Practice");
        item1.setItemType("READING");
        item1.setOrderIndex(1);
        item1.setAssignmentId(manualAssId);
        mockMvc.perform(post("/api/v1/curriculum/daily-plans/{planId}/items", planId).with(user(teacherUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(item1)))
                .andExpect(status().isCreated());

        // =====================================================================
        // JOURNEY 2: STUDENT LEARNS VIDEO, SRS VOCAB, ACOUSTIC AI SHADOWING, SUBMITS 6-TYPE CBT EXAM
        // =====================================================================
        mockMvc.perform(get("/api/student/classrooms/my-courses").with(user(studentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].classId").value(classroomId.toString()))
                .andExpect(jsonPath("$.data[0].teacherName").value("Minh Teacher"));

        mockMvc.perform(get("/api/v1/curriculum/daily-plans/classrooms/{classroomId}/student-overview", classroomId)
                        .with(user(studentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDays").value(1))
                .andExpect(jsonPath("$.data.currentSelectedDay.sections[0].items[0].isDone").value(false));

        // Watch Video -> updates completion
        WatchProgressRequest watchReq = new WatchProgressRequest();
        watchReq.setWatchedSeconds(120);
        watchReq.setCompleted(true);
        mockMvc.perform(post("/api/v1/videos/{id}/progress", videoId).with(user(studentUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(watchReq)))
                .andExpect(status().isOk());

        // SRS progression tracking across all 4 enum stages NEW -> LEARNING -> REVIEWING -> MASTERED
        state.advanceVocabSrsStage(vocabId, SpacedRepetitionStage.LEARNING);
        state.advanceVocabSrsStage(vocabId, SpacedRepetitionStage.REVIEWING);
        state.advanceVocabSrsStage(vocabId, SpacedRepetitionStage.MASTERED);
        assertThat(state.vocabSrsStages.get(vocabId)).isEqualTo(SpacedRepetitionStage.MASTERED);

        // Acoustic Shadowing Tier 1: Mock Python acoustic engine response with GREEN/YELLOW tokens
        when(tierPythonClient.evaluatePhonetics(any(), anyString(), anyString())).thenReturn(
                ShadowingEvaluationResponse.builder()
                        .overallScore(82).isPassed(true).passScore(80).evaluatedBy("PYTHON_ACOUSTIC_ENGINE")
                        .statusMessage("Phân tích âm học F1/F2 hoàn tất.")
                        .kpi(ShadowingEvaluationResponse.KpiMetrics.builder()
                                .pronunciation(84).fluency(81).completeness(100).prosody(80).wordsPerMinute(118).build())
                        .sentenceTokens(List.of(
                                ShadowingEvaluationResponse.SentenceToken.builder()
                                        .word("sheep").color("GREEN").wordStatus("SPOKEN").build(),
                                ShadowingEvaluationResponse.SentenceToken.builder()
                                        .word("think").color("YELLOW").wordStatus("SPOKEN").build()))
                        .wordRows(List.of(
                                ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                        .word("sheep").score(94).wordStatus("SPOKEN")
                                        .phonemes(List.of(ShadowingEvaluationResponse.PhonemeItem.builder()
                                                .ipa("/iː/").score(96).note("F1=460Hz, F2=2570Hz khớp chuẩn").build()))
                                        .build(),
                                ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                        .word("think").score(72).wordStatus("PARTIAL")
                                        .phonemes(List.of(ShadowingEvaluationResponse.PhonemeItem.builder()
                                                .ipa("/θ/").score(70).note("Đặt nhẹ đầu lưỡi giữa hai hàm răng").build()))
                                        .build()))
                        .build());

        byte[] sheepWav = Files.readAllBytes(Path.of("phonetics-service/test_audio_cache/sheep.wav"));
        MockMultipartFile sheepFile = new MockMultipartFile("audio", "sheep.wav", "audio/wav", sheepWav);
        mockMvc.perform(multipart("/api/v1/ai/speaking/shadowing-evaluate")
                        .file(sheepFile)
                        .param("referenceSentence", "sheep think")
                        .with(user(studentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.evaluatedBy").value("PYTHON_ACOUSTIC_ENGINE"))
                .andExpect(jsonPath("$.data.sentenceTokens[0].color").value("GREEN"))
                .andExpect(jsonPath("$.data.sentenceTokens[1].color").value("YELLOW"))
                .andExpect(jsonPath("$.data.isPassed").value(true));

        // Start Proctored Exam -> Upload Audio for AUDIO_RESPONSE -> Submit all 6 CBT question types
        MvcResult startRes = mockMvc.perform(post("/api/v1/student/assignments/{assignmentId}/start", examId)
                        .with(user(studentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andReturn();
        JsonNode attemptData = objectMapper.readTree(startRes.getResponse().getContentAsString()).path("data");
        UUID attemptId = UUID.fromString(attemptData.path("attemptId").asText());

        // Map question answers using real IDs generated on startAttempt
        Assignment createdExam = state.assignments.get(examId);
        List<SubmissionRequest.AnswerDto> answers = new ArrayList<>();
        UUID speakingQId = null;
        UUID essayQId = null;
        for (AssignmentQuestion q : createdExam.getQuestions()) {
            switch (q.getQuestionType()) {
                case MULTIPLE_CHOICE, TRUE_FALSE -> {
                    UUID correctOptId = q.getOptions().stream().filter(o -> Boolean.TRUE.equals(o.getIsCorrect())).findFirst().orElseThrow().getId();
                    answers.add(SubmissionRequest.AnswerDto.builder().questionId(q.getId()).selectedOptionId(correctOptId).build());
                }
                case FILL_IN_BLANK -> answers.add(SubmissionRequest.AnswerDto.builder().questionId(q.getId()).textAnswer(q.getCorrectAnswer()).build());
                case MATCHING -> answers.add(SubmissionRequest.AnswerDto.builder().questionId(q.getId()).textAnswer(q.getCorrectAnswer()).build());
                case AUDIO_RESPONSE -> {
                    speakingQId = q.getId();
                    answers.add(SubmissionRequest.AnswerDto.builder().questionId(q.getId()).textAnswer("Spoken recording attached").build());
                }
                case ESSAY -> {
                    essayQId = q.getId();
                    answers.add(SubmissionRequest.AnswerDto.builder().questionId(q.getId())
                            .textAnswer("Education technology improves collaborative learning and accessibility.").build());
                }
            }
        }

        // Upload speaking answer audio using real dummy_audio.wav / sheep.wav
        mockMvc.perform(multipart("/api/v1/student/assignments/attempts/{attemptId}/questions/{questionId}/audio",
                        attemptId, speakingQId)
                        .file(new MockMultipartFile("audio", "dummy_audio.wav", "audio/wav", Files.readAllBytes(Path.of("dummy_audio.wav"))))
                        .with(user(studentUser)))
                .andExpect(status().isOk());

        SubmissionRequest submitReq = SubmissionRequest.builder()
                .assignmentId(examId).answers(answers).cheatingFlagged(false).violationCount(0).build();
        mockMvc.perform(post("/api/v1/student/assignments/{assignmentId}/attempts/{attemptId}/submit", examId, attemptId)
                        .with(user(studentUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submitReq)))
                .andExpect(status().isOk())
                // Objective questions auto-graded (MCQ 2 + TF 2 + Fill 2 + Matching 2 = 8 out of 18 total points -> 4.4/10), waiting on Teacher for Speaking+Essay!
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.answersPersisted").value(true));

        assertThat(state.studentStreak).isEqualTo(1);

        // =====================================================================
        // JOURNEY 3: TEACHER GRADES SUBJECTIVE ITEMS -> STUDENT RADAR + NOTIF -> ADMIN MONITORING / AUDIT / EXCEL EXPORT / R2
        // =====================================================================
        mockMvc.perform(get("/api/v1/teacher/assignments/{assignmentId}/submissions", examId).with(user(teacherUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].attemptId").value(attemptId.toString()))
                .andExpect(jsonPath("$.data[0].status").value("SUBMITTED"));

        TeacherGradeRequest gradeReq = new TeacherGradeRequest();
        gradeReq.setFinalScore(9.2);
        gradeReq.setFeedback("Excellent speaking articulation and structured essay argument.");
        gradeReq.setAnswerScores(Map.of(speakingQId, 4.5, essayQId, 4.5));
        mockMvc.perform(post("/api/v1/teacher/submissions/{attemptId}/grade", attemptId).with(user(teacherUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(gradeReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.score").value(9.2));

        // Student receives NEW_GRADE notification + updated 6-skill radar profile
        mockMvc.perform(get("/api/v1/notifications").with(user(studentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.type=='NEW_GRADE')]").isNotEmpty());

        mockMvc.perform(get("/api/v1/analytics/my-profile").with(user(studentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.writingScore").value(92.0))
                .andExpect(jsonPath("$.data.pronunciationScore").value(84.0))
                .andExpect(jsonPath("$.data.fluencyScore").value(81.0));

        // Admin checks AI Monitoring stats, Audit logs, Database Overview, R2 Storage & Classroom Excel Report
        mockMvc.perform(get("/api/v1/admin/ai-monitoring/stats").with(user(adminUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.geminiStats.isHealthy").value(true))
                .andExpect(jsonPath("$.data.totalTokens").isNumber())
                .andExpect(jsonPath("$.data.studentQuotas[0].dailyLimit").value(25))
                .andExpect(jsonPath("$.data.studentQuotas[0].dailyUsed").value(1));

        mockMvc.perform(get("/api/v1/admin/audit-logs").with(user(adminUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(5)));

        mockMvc.perform(get("/api/v1/admin/database/r2-report").with(user(adminUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bucketName").value("elp-media-prod"))
                .andExpect(jsonPath("$.data.dataSourceMode").value("ESTIMATED_LOCAL"));

        MvcResult excelRes = mockMvc.perform(get("/api/v1/admin/database/classrooms/{classroomId}/report", classroomId)
                        .with(user(adminUser)))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andReturn();

        byte[] reportBytes = excelRes.getResponse().getContentAsByteArray();
        try (Workbook wb = WorkbookFactory.create(new ByteArrayInputStream(reportBytes))) {
            assertThat(wb.getNumberOfSheets()).isEqualTo(3);
            assertThat(wb.getSheetAt(0).getSheetName()).isEqualTo("Tong_Quan_Lop");
            assertThat(wb.getSheetAt(1).getSheetName()).isEqualTo("Danh_Sach_Hoc_Vien");
            Sheet subSheet = wb.getSheetAt(2);
            assertThat(subSheet.getSheetName()).isEqualTo("Chi_Tiet_Bai_Nop_Thi");
            assertThat(subSheet.getRow(2).getCell(3).getStringCellValue()).isEqualTo("Midterm Proctored CBT Exam");
            assertThat(subSheet.getRow(2).getCell(14).getStringCellValue())
                    .contains("Excellent speaking articulation");
        }
    }

    @Test
    @DisplayName("Journey 4 - 3-Tier AI Resilience: Tier 1 Python & Tier 2 Gemini/Groq Outage degrades seamlessly to Tier 3 Offline Rule-Based Heuristics without HTTP 500")
    void journey4_threeTierAiResilience_recoversWithoutHttp500OnFullCloudAndMicroserviceOutage() throws Exception {
        CustomUserDetails studentUser = principalFor(studentId, "student@elp.test", RoleName.ROLE_STUDENT);
        state.quotas.put(studentId, StudentQuotaResponse.builder()
                .studentId(studentId).email("student@elp.test").studentName("Lan Student")
                .role("STUDENT").serviceEngine("GEMINI").dailyUsed(0).dailyLimit(10).isBlocked(false)
                .promptTokensUsed(0L).completionTokensUsed(0L).totalTokensUsed(0L).estimatedCostUsd(0.0).build());

        // Simulate Tier 1 (phonetics-service) connection refused + Tier 2 (Gemini + Groq) 503/timeout
        when(tierPythonClient.evaluatePhonetics(any(), anyString(), anyString()))
                .thenThrow(new RuntimeException("Connection refused: http://localhost:8000"));
        when(tierGeminiClient.evaluateAudioWithInstruction(anyString(), any(), anyString(), anyString()))
                .thenThrow(new RuntimeException("Gemini API 429 Quota Exceeded"));
        when(tierGeminiClient.generateWithSystemInstruction(anyString(), anyString()))
                .thenThrow(new RuntimeException("Gemini API 503 Service Unavailable"));
        when(tierGroqClient.transcribeAudioVerbose(any(), anyString()))
                .thenThrow(new RuntimeException("Groq Whisper timeout"));
        when(tierGroqClient.chatCompletionJson(anyString(), anyString()))
                .thenThrow(new RuntimeException("Groq LLM timeout"));

        MockMultipartFile realDummyWav = new MockMultipartFile(
                "audio", "dummy_audio.wav", "audio/wav", Files.readAllBytes(Path.of("dummy_audio.wav")));

        mockMvc.perform(multipart("/api/v1/ai/speaking/shadowing-evaluate")
                        .file(realDummyWav)
                        .param("referenceSentence", "Consistency is the key to mastering any new skill")
                        .with(user(studentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.evaluatedBy").value("RULE_BASED_OFFLINE_FALLBACK"))
                .andExpect(jsonPath("$.data.statusMessage").value("Đánh giá hoàn tất bằng cơ chế Fallback ngoại tuyến (Offline Heuristics)."))
                .andExpect(jsonPath("$.data.overallScore").value(75))
                .andExpect(jsonPath("$.data.sentenceTokens.length()").value(9))
                .andExpect(jsonPath("$.data.sentenceTokens[0].color").value("YELLOW"));

        // Verify Audit Trail captured AI_FALLBACK_LOCAL event automatically
        assertThat(state.auditLogs)
                .extracting(AuditLog::getAction)
                .contains("AI_FALLBACK_LOCAL");

        // Verify Tier 2 Cloud Fallback works mid-way when Tier 1 fails but Gemini succeeds
        doReturn("""
                        ```json
                        {
                          "overallScore": 86,
                          "isPassed": true,
                          "passScore": 80,
                          "statusMessage": "Chấm điểm thành công qua Gemini Fallback.",
                          "kpi": {"pronunciation": 86, "fluency": 85, "completeness": 100, "prosody": 84, "wordsPerMinute": 115},
                          "sentenceTokens": [{"word": "Consistency", "color": "GREEN", "wordStatus": "SPOKEN", "hasPauseAfter": false, "hasLinkingAfter": false}],
                          "wordRows": []
                        }
                        ```
                        """)
                .when(tierGeminiClient)
                .evaluateAudioWithInstruction(anyString(), any(), anyString(), anyString());

        mockMvc.perform(multipart("/api/v1/ai/speaking/shadowing-evaluate")
                        .file(realDummyWav)
                        .param("referenceSentence", "Consistency")
                        .with(user(studentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.evaluatedBy").value("GEMINI_AI_FALLBACK"))
                .andExpect(jsonPath("$.data.overallScore").value(86));
    }

    private AssignmentRequest buildFull6TypesAssignmentRequest(UUID classroomId, UUID lessonId, boolean isExam) {
        AssignmentRequest req = new AssignmentRequest();
        req.setClassroomId(classroomId);
        req.setLessonId(lessonId);
        req.setTitle("6-Skill Mixed Assignment");
        req.setDescription("Covers all 6 CBT question types");
        req.setSkillType("READING");
        req.setTimeLimitMinutes(45);
        req.setMaxAttempts(3);
        req.setPassScore(7.0);
        req.setIsExam(isExam);
        req.setStrictFullscreen(isExam);
        req.setMaxViolations(2);

        AssignmentRequest.OptionRequest o1 = new AssignmentRequest.OptionRequest();
        o1.setOptionText("Solar cost drop");
        o1.setIsCorrect(true);
        AssignmentRequest.OptionRequest o2 = new AssignmentRequest.OptionRequest();
        o2.setOptionText("Fossil subsidy");
        o2.setIsCorrect(false);
        AssignmentRequest.QuestionRequest qMcq = new AssignmentRequest.QuestionRequest();
        qMcq.setQuestionType("MULTIPLE_CHOICE");
        qMcq.setSkillType("READING");
        qMcq.setPromptText("What drives renewable adoption?");
        qMcq.setPoints(2.0);
        qMcq.setOptions(List.of(o1, o2));

        AssignmentRequest.OptionRequest tf1 = new AssignmentRequest.OptionRequest();
        tf1.setOptionText("TRUE");
        tf1.setIsCorrect(true);
        AssignmentRequest.OptionRequest tf2 = new AssignmentRequest.OptionRequest();
        tf2.setOptionText("FALSE");
        tf2.setIsCorrect(false);
        AssignmentRequest.QuestionRequest qTf = new AssignmentRequest.QuestionRequest();
        qTf.setQuestionType("TRUE_FALSE");
        qTf.setSkillType("LISTENING");
        qTf.setPromptText("She has worked since 2015.");
        qTf.setPoints(2.0);
        qTf.setOptions(List.of(tf1, tf2));

        AssignmentRequest.QuestionRequest qFill = new AssignmentRequest.QuestionRequest();
        qFill.setQuestionType("FILL_IN_BLANK");
        qFill.setSkillType("GRAMMAR");
        qFill.setPromptText("If she had checked earlier, she ___ not have missed the train.");
        qFill.setCorrectAnswer("would");
        qFill.setPoints(2.0);

        AssignmentRequest.QuestionRequest qMatch = new AssignmentRequest.QuestionRequest();
        qMatch.setQuestionType("MATCHING");
        qMatch.setSkillType("VOCABULARY");
        qMatch.setPromptText("Resilient");
        qMatch.setCorrectAnswer("Kien cuong");
        qMatch.setPoints(2.0);

        AssignmentRequest.QuestionRequest qAudio = new AssignmentRequest.QuestionRequest();
        qAudio.setQuestionType("AUDIO_RESPONSE");
        qAudio.setSkillType("SPEAKING");
        qAudio.setPromptText("Read aloud: sheep think");
        qAudio.setTranscript("sheep think");
        qAudio.setPoints(5.0);

        AssignmentRequest.QuestionRequest qEssay = new AssignmentRequest.QuestionRequest();
        qEssay.setQuestionType("ESSAY");
        qEssay.setSkillType("WRITING");
        qEssay.setPromptText("Discuss technology in classrooms.");
        qEssay.setPoints(5.0);

        req.setQuestions(List.of(qMcq, qTf, qFill, qMatch, qAudio, qEssay));
        return req;
    }

    private static class InMemoryPlatformState {
        final Map<UUID, UserSummaryDto> usersById = new LinkedHashMap<>();
        final Map<String, UserSummaryDto> usersByEmail = new LinkedHashMap<>();
        final Map<UUID, ClassroomResponse> classrooms = new LinkedHashMap<>();
        final Map<UUID, List<UserSummaryDto>> enrolledStudentsByClass = new LinkedHashMap<>();
        final Map<UUID, StudentQuotaResponse> quotas = new LinkedHashMap<>();
        final List<Notification> notifications = new ArrayList<>();
        final Map<UUID, LessonResponse> lessons = new LinkedHashMap<>();
        final List<UUID> videoIds = new ArrayList<>();
        final List<VocabularyResponse> vocabularies = new ArrayList<>();
        final Map<UUID, SpacedRepetitionStage> vocabSrsStages = new LinkedHashMap<>();
        final Map<UUID, Assignment> assignments = new LinkedHashMap<>();
        final Map<UUID, DailyStudyPlan> dailyPlans = new LinkedHashMap<>();
        final List<DailyPlanItem> dailyPlanItems = new ArrayList<>();
        final Set<UUID> completedAssignmentIds = new java.util.HashSet<>();
        final Map<UUID, AttemptResponse> attempts = new LinkedHashMap<>();
        final Map<SkillType, Double> skillScores = new LinkedHashMap<>();
        final List<AuditLog> auditLogs = new ArrayList<>();

        int completedVideoCount = 0;
        int studentStreak = 0;
        long aiPromptTokens = 0;
        long aiCompletionTokens = 0;
        long aiTotalRequests = 0;
        double latestPronunciationScore = 0.0;
        double latestFluencyScore = 0.0;

        void advanceVocabSrsStage(UUID vocabId, SpacedRepetitionStage nextStage) {
            vocabSrsStages.put(vocabId, nextStage);
        }

        void recordAudit(UUID actorId, String email, String action, String entity, String entityId, String json) {
            User actor = User.builder().id(actorId).email(email).build();
            auditLogs.add(AuditLog.builder()
                    .id(UUID.randomUUID()).user(actor).action(action)
                    .entityName(entity).entityId(entityId).ipAddress("127.0.0.1")
                    .metadataJson(json).createdAt(Instant.now()).build());
        }
    }
}
