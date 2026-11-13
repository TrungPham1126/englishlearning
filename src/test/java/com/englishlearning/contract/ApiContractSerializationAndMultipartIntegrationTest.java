package com.englishlearning.contract;

import com.englishlearning.ai.controller.AdminAiMonitoringController;
import com.englishlearning.ai.controller.AiLabController;
import com.englishlearning.ai.dto.AiStatsResponse;
import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.service.AiLabService;
import com.englishlearning.ai.service.AiMonitoringService;
import com.englishlearning.ai.service.ShadowingService;
import com.englishlearning.ai.service.WhisperPronunciationService;
import com.englishlearning.ai.service.impl.PythonIntegrationServiceImpl;
import com.englishlearning.analytics.controller.AnalyticsController;
import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.controller.TeacherAssignmentController;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.assignment.service.AssignmentService;
import com.englishlearning.assignment.service.ExcelImportService;
import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.controller.AuthController;
import com.englishlearning.auth.controller.UserController;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.AuthService;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.auth.service.UserService;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.common.config.JacksonConfig;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.curriculum.controller.AdminResourceController;
import com.englishlearning.curriculum.controller.CurriculumController;
import com.englishlearning.curriculum.dto.DocumentResponse;
import com.englishlearning.curriculum.dto.LessonResponse;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.service.CurriculumService;
import com.englishlearning.curriculum.service.DocumentStorageService;
import com.englishlearning.curriculum.service.GlobalResourceService;
import com.englishlearning.curriculum.service.TtsService;
import com.englishlearning.submission.controller.StudentSubmissionController;
import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.service.SubmissionService;
import com.englishlearning.video.controller.VideoController;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.service.VideoService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {
        AdminAiMonitoringController.class,
        AiLabController.class,
        VideoController.class,
        CurriculumController.class,
        AdminResourceController.class,
        StudentSubmissionController.class,
        TeacherAssignmentController.class,
        AuthController.class,
        UserController.class,
        AnalyticsController.class
})
@AutoConfigureMockMvc
@Import({
        SecurityConfig.class,
        JwtAuthenticationEntryPoint.class,
        GlobalExceptionHandler.class,
        JacksonConfig.class
})
@DisplayName("API Contract Integration: Jackson JSON Shapes, Credential Redaction, Multipart FormData & Python Schema")
class ApiContractSerializationAndMultipartIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AiMonitoringService aiMonitoringService;
    @MockBean private AiLabService aiLabService;
    @MockBean private ShadowingService shadowingService;
    @MockBean private WhisperPronunciationService whisperPronunciationService;
    @MockBean private VideoService videoService;
    @MockBean private CurriculumService curriculumService;
    @MockBean private GlobalResourceService globalResourceService;
    @MockBean private SubmissionService submissionService;
    @MockBean private AssignmentService assignmentService;
    @MockBean private DocumentStorageService documentStorageService;
    @MockBean private TtsService ttsService;
    @MockBean private ExerciseAudioService exerciseAudioService;
    @MockBean private ExcelImportService excelImportService;
    @MockBean private AuthService authService;
    @MockBean private UserService userService;
    @MockBean private AnalyticsService analyticsService;

    @MockBean private JwtService jwtService;
    @MockBean private UserDetailsService userDetailsService;
    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID adminId = UUID.fromString("aaaaaaaa-1111-1111-1111-111111111111");
    private final UUID teacherId = UUID.fromString("bbbbbbbb-2222-2222-2222-222222222222");
    private final UUID studentId = UUID.fromString("cccccccc-3333-3333-3333-333333333333");

    @BeforeEach
    void setUpFilterChain() throws Exception {
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User u = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@contract.test")
                .password("$2a$10$secretBcryptHashMustNeverSerialize")
                .firstName("Test")
                .lastName(roleName.name())
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("JSON Contract: boolean 'isHealthy' & 'isAccurate', 'completed'/'isCompleted' trên VideoWatchHistory, và 'hasVideo'/'documentsCount' trên LessonResponse")
    void jsonSerializationContracts_preserveExactBooleanAndMetadataKeys() throws Exception {
        // 1. AiStatsResponse -> isHealthy
        AiStatsResponse stats = AiStatsResponse.builder()
                .totalTokens(4200L)
                .systemKillSwitchActive(false)
                .geminiStats(AiStatsResponse.AiEngineStatsDto.builder()
                        .engineName("Gemini 2.5 Flash")
                        .isHealthy(true)
                        .build())
                .groqStats(AiStatsResponse.AiEngineStatsDto.builder()
                        .engineName("Groq Whisper")
                        .isHealthy(false)
                        .build())
                .build();
        when(aiMonitoringService.getStats()).thenReturn(stats);

        mockMvc.perform(get("/api/v1/admin/ai-monitoring/stats")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.geminiStats.isHealthy").value(true))
                .andExpect(jsonPath("$.data.groqStats.isHealthy").value(false))
                .andExpect(jsonPath("$.data.systemKillSwitchActive").value(false));

        // 2. PhoneticEvaluationResponse -> WordScore.isAccurate
        PhoneticEvaluationResponse phonetic = PhoneticEvaluationResponse.builder()
                .overallScore(86)
                .feedback("Rất tốt")
                .wordScores(List.of(
                        PhoneticEvaluationResponse.WordScore.builder().word("hello").score(95).isAccurate(true).build(),
                        PhoneticEvaluationResponse.WordScore.builder().word("world").score(55).isAccurate(false).note("Lỗi /r/").build()
                ))
                .build();
        when(whisperPronunciationService.evaluatePronunciation(any(), eq("hello world"))).thenReturn(phonetic);

        MockMultipartFile audio = new MockMultipartFile("audio", "voice.webm", "audio/webm", "audio".getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(multipart("/api/v1/ai/pronunciation/whisper-evaluate")
                        .file(audio)
                        .param("referenceText", "hello world")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.wordScores[0].isAccurate").value(true))
                .andExpect(jsonPath("$.data.wordScores[1].isAccurate").value(false));

        // 3. VideoWatchHistory -> exposes both 'completed' and 'isCompleted' without leaking Video/Student proxies
        UUID videoId = UUID.randomUUID();
        VideoWatchHistory watchHistory = VideoWatchHistory.builder()
                .id(UUID.randomUUID())
                .video(Video.builder().id(videoId).originalFileName("lecture.mp4").build())
                .student(Student.builder().id(studentId).user(User.builder().id(studentId).password("secret").build()).build())
                .watchedSeconds(120)
                .completionPercentage(95.0f)
                .isCompleted(true)
                .build();
        when(videoService.getWatchProgress(studentId, videoId)).thenReturn(watchHistory);

        mockMvc.perform(get("/api/v1/videos/{id}/progress", videoId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.completed").value(true))
                .andExpect(jsonPath("$.data.isCompleted").value(true))
                .andExpect(jsonPath("$.data.watchedSeconds").value(120))
                .andExpect(jsonPath("$.data.video").doesNotExist())
                .andExpect(jsonPath("$.data.student").doesNotExist());

        // 4. LessonResponse -> exposes hasVideo, documentsCount, completed, isCompleted
        UUID classId = UUID.randomUUID();
        LessonResponse lesson = LessonResponse.builder()
                .id(UUID.randomUUID())
                .classId(classId)
                .title("Lesson 1")
                .orderIndex(1)
                .completed(false)
                .progressPercentage(50)
                .watchedSeconds(120)
                .hasVideo(true)
                .documentsCount(2)
                .build();
        when(curriculumService.getLessonsByClass(classId)).thenReturn(List.of(lesson));

        mockMvc.perform(get("/api/curriculum/classes/{classId}/lessons", classId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].hasVideo").value(true))
                .andExpect(jsonPath("$.data[0].documentsCount").value(2))
                .andExpect(jsonPath("$.data[0].completed").value(false))
                .andExpect(jsonPath("$.data[0].isCompleted").value(false));
    }

    @Test
    @DisplayName("Entity Serialization & Redaction: Video Moderation trả đủ lesson.classroom & uploadedBy nhưng ẩn tuyệt đối password/roles & không vòng lặp")
    void entitySerializationContracts_exposeNeededRelationsAndRedactPasswords() throws Exception {
        UUID videoId = UUID.randomUUID();
        Classroom classroom = Classroom.builder()
                .id(UUID.randomUUID())
                .name("IELTS 7.0 Intensive")
                .build();
        Lesson lesson = Lesson.builder()
                .id(UUID.randomUUID())
                .title("Listening Section 1")
                .orderIndex(1)
                .classroom(classroom)
                .build();
        User uploader = User.builder()
                .id(teacherId)
                .email("teacher@english.test")
                .password("$2a$10$DO_NOT_LEAK_THIS_HASH")
                .firstName("Minh")
                .lastName("Nguyen")
                .build();
        Video pendingVideo = Video.builder()
                .id(videoId)
                .originalFileName("unit1.mp4")
                .hlsPlaylistUrl("/api/v1/videos/" + videoId + "/hls/master.m3u8")
                .status(VideoStatus.PENDING_REVIEW)
                .lesson(lesson)
                .uploadedBy(uploader)
                .build();
        lesson.setVideo(pendingVideo); // Cycle test: Lesson.video is @JsonIgnore

        when(videoService.getVideosByStatus(VideoStatus.PENDING_REVIEW)).thenReturn(List.of(pendingVideo));

        mockMvc.perform(get("/api/v1/videos")
                        .param("status", "PENDING_REVIEW")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].lesson.title").value("Listening Section 1"))
                .andExpect(jsonPath("$.data[0].lesson.classroom.name").value("IELTS 7.0 Intensive"))
                .andExpect(jsonPath("$.data[0].uploadedBy.firstName").value("Minh"))
                .andExpect(jsonPath("$.data[0].uploadedBy.email").value("teacher@english.test"))
                .andExpect(jsonPath("$.data[0].uploadedBy.password").doesNotExist())
                .andExpect(jsonPath("$.data[0].lesson.video").doesNotExist());

        // StudentSkillProfile ignores lazy student proxy
        StudentSkillProfile profile = StudentSkillProfile.builder()
                .id(studentId)
                .student(Student.builder().id(studentId).user(uploader).build())
                .speakingScore(7.5)
                .build();
        when(analyticsService.getMyProfile(studentId)).thenReturn(profile);

        mockMvc.perform(get("/api/v1/analytics/my-profile")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.speakingScore").value(7.5))
                .andExpect(jsonPath("$.data.student").doesNotExist());

        // Direct User serialization redacts password (WRITE_ONLY), AiGeneratedExercise ignores lazy relations
        String userJson = objectMapper.writeValueAsString(uploader);
        assertThat(userJson).doesNotContain("DO_NOT_LEAK_THIS_HASH");
        User parsedUser = objectMapper.readValue("{\"email\":\"a@b.com\",\"password\":\"rawPass123\"}", User.class);
        assertThat(parsedUser.getPassword()).isEqualTo("rawPass123");

        AiGeneratedExercise exercise = AiGeneratedExercise.builder()
                .id(UUID.randomUUID())
                .lesson(lesson)
                .teacher(Teacher.builder().id(teacherId).user(uploader).build())
                .targetCefr("B2")
                .exerciseType("MULTIPLE_CHOICE")
                .questionCount(5)
                .rawResponseJson("{}")
                .status(GenerationStatus.READY_FOR_REVIEW)
                .build();
        String exerciseJson = objectMapper.writeValueAsString(exercise);
        assertThat(exerciseJson).doesNotContain("DO_NOT_LEAK_THIS_HASH");
        assertThat(exerciseJson).doesNotContain("\"teacher\"");
    }

    @Test
    @DisplayName("Multipart FormData Matrix: kiểm khớp 100% tên part/param giữa Frontend và tất cả endpoint upload Backend")
    void multipartUploadContracts_matchFrontendFormDataFields() throws Exception {
        UUID lessonId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();

        // 1. Auth avatar: POST /api/v1/auth/me/avatar (part "file")
        MockMultipartFile imageFile = new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3});
        when(authService.updateAvatar(eq(studentId), any()))
                .thenReturn(UserSummaryDto.builder().id(studentId).avatarUrl("/uploads/avatars/a.png").build());
        mockMvc.perform(multipart("/api/v1/auth/me/avatar")
                        .file(imageFile)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avatarUrl").value("/uploads/avatars/a.png"));

        // 2. User avatar: POST /api/v1/users/avatar (part "file")
        when(userService.uploadAndSaveAvatar(eq(studentId), any())).thenReturn("/uploads/avatars/u.png");
        mockMvc.perform(multipart("/api/v1/users/avatar")
                        .file(imageFile)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("/uploads/avatars/u.png"));

        // 3. Lesson document upload: POST /api/curriculum/lessons/{lessonId}/documents (part "file", param "fileType")
        MockMultipartFile pdfFile = new MockMultipartFile("file", "guide.pdf", "application/pdf", new byte[]{1, 2, 3});
        when(curriculumService.uploadLessonDocument(eq(lessonId), any(), eq("PDF")))
                .thenReturn(DocumentResponse.builder().id(UUID.randomUUID()).fileName("guide.pdf").fileUrl("/uploads/documents/g.pdf").build());
        mockMvc.perform(multipart("/api/curriculum/lessons/{lessonId}/documents", lessonId)
                        .file(pdfFile)
                        .param("fileType", "PDF")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.fileName").value("guide.pdf"));

        // 4. Global resource upload: POST /api/v1/admin/resources/upload (part "file", param "type")
        doNothing().when(globalResourceService).uploadResource(any(), eq("DOC"), eq(adminId));
        mockMvc.perform(multipart("/api/v1/admin/resources/upload")
                        .file(pdfFile)
                        .param("type", "DOC")
                        .with(user(userWithRole(adminId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk());

        // 5. Teacher assignment audio & Excel import (part "file")
        MockMultipartFile mp3File = new MockMultipartFile("file", "track.mp3", "audio/mpeg", new byte[]{4, 5});
        when(documentStorageService.uploadAudioFile(any())).thenReturn("/uploads/audio/track.mp3");
        mockMvc.perform(multipart("/api/v1/teacher/assignments/upload-audio")
                        .file(mp3File)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("/uploads/audio/track.mp3"));

        MockMultipartFile xlsxFile = new MockMultipartFile("file", "questions.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new byte[]{1, 2});
        when(excelImportService.importQuestionsFromExcel(any(), eq(assignmentId)))
                .thenReturn(List.of(AssignmentQuestion.builder()
                        .id(UUID.randomUUID()).questionType(QuestionType.MULTIPLE_CHOICE).promptText("Q1").orderIndex(1).build()));
        mockMvc.perform(multipart("/api/v1/teacher/assignments/{id}/import-excel", assignmentId)
                        .file(xlsxFile)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].promptText").value("Q1"));

        // 6. Video upload: POST /api/v1/videos (part "file", param "lessonId")
        MockMultipartFile mp4File = new MockMultipartFile("file", "lesson.mp4", "video/mp4", new byte[]{9, 9});
        when(videoService.uploadOriginalVideo(eq(lessonId), any(), eq(teacherId)))
                .thenReturn(VideoUploadResponse.builder().videoId(UUID.randomUUID()).status(VideoStatus.PROCESSING).build());
        mockMvc.perform(multipart("/api/v1/videos")
                        .file(mp4File)
                        .param("lessonId", lessonId.toString())
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));

        // 7. Student submission speaking audio: POST /api/v1/student/assignments/attempts/{attemptId}/questions/{questionId}/audio (part "audio")
        MockMultipartFile studentAudio = new MockMultipartFile("audio", "recording.webm", "audio/webm", new byte[]{7, 8});
        when(submissionService.uploadAudioResponse(eq(studentId), eq(attemptId), eq(questionId), any()))
                .thenReturn(AttemptResponse.builder().attemptId(attemptId).status("IN_PROGRESS").build());
        mockMvc.perform(multipart("/api/v1/student/assignments/attempts/{attemptId}/questions/{questionId}/audio", attemptId, questionId)
                        .file(studentAudio)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId.toString()));

        // 8. AI speaking & shadowing multipart uploads with "audio", "topic", "studentAnswerId", "referenceSentence"
        JsonNode speakingNode = objectMapper.readTree("{\"overallBand\":7.0,\"correctedText\":\"Clean answer.\"}");
        when(aiLabService.evaluateSpeakingTopic(eq("Hometown"), any(), isNull())).thenReturn(speakingNode);
        mockMvc.perform(multipart("/api/v1/ai/speaking/evaluate")
                        .file(studentAudio)
                        .param("topic", "Hometown")
                        .param("studentAnswerId", "undefined")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallBand").value(7.0));

        UUID answerUuid = UUID.randomUUID();
        when(shadowingService.evaluateShadowing(any(), eq(answerUuid), eq("Practice makes perfect.")))
                .thenReturn(ShadowingEvaluationResponse.builder().overallScore(88).isPassed(true).passScore(80).build());
        mockMvc.perform(multipart("/api/v1/ai/speaking/shadowing-evaluate")
                        .file(studentAudio)
                        .param("studentAnswerId", answerUuid.toString())
                        .param("referenceSentence", "Practice makes perfect.")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallScore").value(88))
                .andExpect(jsonPath("$.data.isPassed").value(true));
        verify(shadowingService).evaluateShadowing(any(), eq(answerUuid), eq("Practice makes perfect."));
    }

    @Test
    @DisplayName("BE <-> Python AI Contract: giải mã chính xác payload CamelModel từ phonetics-service và xác nhận cấu hình base-url")
    void pythonPhoneticsSchemaAndConfig_matchBackendIntegrationContract() throws Exception {
        // Exact camelCase JSON produced by phonetics-service CamelModel (app/schemas.py)
        String pythonCamelJson = """
                {
                  "overallScore": 84.6,
                  "fluencyScore": 81.2,
                  "speedScore": 88.0,
                  "articulationRate": 4.2,
                  "evaluationStatus": "COMPLETED",
                  "overallConfidence": 0.91,
                  "audioQuality": {
                    "snrDb": 21.5,
                    "clippingRatio": 0.0
                  },
                  "isPassed": true,
                  "passScore": 80,
                  "statusMessage": "Phát âm tốt, tiếp tục phát huy.",
                  "evaluatedBy": "PYTHON_ACOUSTIC_ENGINE",
                  "kpi": {
                    "pronunciation": 85.4,
                    "fluency": 81.2,
                    "completeness": 100,
                    "prosody": 79.0,
                    "wordsPerMinute": 136
                  },
                  "sentenceTokens": [
                    {
                      "word": "Hello",
                      "color": "GREEN",
                      "wordStatus": "MATCH",
                      "hasPauseAfter": false,
                      "hasLinkingAfter": true
                    }
                  ],
                  "wordRows": [
                    {
                      "word": "Hello",
                      "score": 88,
                      "wordStatus": "MATCH",
                      "phonemes": [
                        {"ipa": "/h/", "score": 90, "note": "Good aspiration"}
                      ]
                    }
                  ]
                }
                """;

        PythonIntegrationServiceImpl pythonService = new PythonIntegrationServiceImpl(
                objectMapper,
                "http://localhost:8000/api/v1/audio/evaluate-phonetics",
                5000,
                60000
        );
        ShadowingEvaluationResponse mapped = pythonService.mapToShadowingEvaluationResponse(
                objectMapper.readTree(pythonCamelJson)
        );

        assertThat(mapped.getOverallScore()).isEqualTo(85);
        assertThat(mapped.getIsPassed()).isTrue();
        assertThat(mapped.getEvaluatedBy()).isEqualTo("PYTHON_ACOUSTIC_ENGINE");
        assertThat(mapped.getKpi().getWordsPerMinute()).isEqualTo(136);
        assertThat(mapped.getKpi().getPronunciation()).isEqualTo(85);
        assertThat(mapped.getSentenceTokens()).hasSize(1);
        assertThat(mapped.getWordRows()).hasSize(1);

        Properties appProps = new Properties();
        try (var in = new ClassPathResource("application.properties").getInputStream()) {
            appProps.load(in);
        }
        assertThat(appProps.getProperty("python.audio-service.base-url")).contains("PYTHON_AUDIO_SERVICE_BASE_URL");
        assertThat(appProps.getProperty("python.audio-service.evaluate-phonetics-url")).contains("evaluate-phonetics");
    }
}
