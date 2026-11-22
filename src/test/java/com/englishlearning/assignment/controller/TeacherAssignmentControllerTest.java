package com.englishlearning.assignment.controller;

import com.englishlearning.ai.service.AiLabService;
import com.englishlearning.assignment.dto.AssignmentRequest;
import com.englishlearning.assignment.dto.QuestionBankItemDto;
import com.englishlearning.assignment.entity.*;
import com.englishlearning.assignment.service.AssignmentService;
import com.englishlearning.assignment.service.ExcelImportService;
import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.InvalidFileFormatException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.service.DocumentStorageService;
import com.englishlearning.curriculum.service.TtsService;
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
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = TeacherAssignmentController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("TeacherAssignmentController - WebMvc & Security Tests")
class TeacherAssignmentControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AssignmentService assignmentService;
    @MockBean
    private DocumentStorageService documentStorageService;
    @MockBean
    private AiLabService aiLabService;
    @MockBean
    private TtsService ttsService;
    @MockBean
    private ExerciseAudioService exerciseAudioService;
    @MockBean
    private ExcelImportService excelImportService;
    @MockBean
    private JwtService jwtService;
    @MockBean
    private UserDetailsService userDetailsService;
    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID teacherId = UUID.randomUUID();
    private final UUID classroomId = UUID.randomUUID();
    private final UUID assignmentId = UUID.randomUUID();

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails createPrincipal(RoleName role) {
        User u = User.builder()
                .id(teacherId)
                .email(role.name().toLowerCase() + "@test.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(role).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("Bảo mật & Audio/Excel endpoints: 401 unauthenticated, 403 STUDENT, upload/TTS/sample-excel/import-excel")
    void audioAndExcelEndpoints_securityAndResponses() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/assignments/sample-excel"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/teacher/assignments/sample-excel")
                        .with(user(createPrincipal(RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        MockMultipartFile audio = new MockMultipartFile("file", "listen.wav", "audio/wav", new byte[]{1, 2, 3});
        when(documentStorageService.uploadAudioFile(any())).thenReturn("/api/v1/files/audio/listen.wav");

        mockMvc.perform(multipart("/api/v1/teacher/assignments/upload-audio").file(audio)
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("/api/v1/files/audio/listen.wav"));

        when(ttsService.synthesizeAudio("Hello class", "af_heart", "1.0x")).thenReturn("/api/v1/files/audio/tts.wav");
        mockMvc.perform(post("/api/v1/teacher/assignments/synthesize-audio")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Hello class\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("/api/v1/files/audio/tts.wav"));

        when(excelImportService.generateSampleTemplate(null)).thenReturn(new byte[]{10, 20});
        mockMvc.perform(get("/api/v1/teacher/assignments/sample-excel")
                        .with(user(createPrincipal(RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"Mau_Giao_Bai_Tap_Chuan.xlsx\""));

        when(excelImportService.generateSampleTemplate("listening")).thenReturn(new byte[]{30, 40});
        mockMvc.perform(get("/api/v1/teacher/assignments/sample-excel")
                        .param("skillType", "listening")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"Mau_Giao_Bai_Tap_LISTENING.xlsx\""));

        MockMultipartFile xlsx = new MockMultipartFile("file", "q.xlsx", "application/octet-stream", new byte[]{1, 2});
        AssignmentQuestion q = AssignmentQuestion.builder().id(UUID.randomUUID()).orderIndex(1)
                .questionType(QuestionType.FILL_IN_BLANK).promptText("Fill ___").build();
        when(excelImportService.importQuestionsFromExcel(any(), eq(assignmentId))).thenReturn(List.of(q));

        mockMvc.perform(multipart("/api/v1/teacher/assignments/" + assignmentId + "/import-excel").file(xlsx)
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].promptText").value("Fill ___"));

        when(excelImportService.importQuestionsFromExcel(any(), eq(assignmentId)))
                .thenThrow(new InvalidFileFormatException("Bad Excel"));
        mockMvc.perform(multipart("/api/v1/teacher/assignments/" + assignmentId + "/import-excel").file(xlsx)
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Bad Excel"));
    }

    @Test
    @DisplayName("CRUD Assignment, gradingOnly filter, validation 400, 404, exams, question bank & audio jobs")
    void assignmentCrudAndQueries_allEndpoints() throws Exception {
        Assignment mcqReading = Assignment.builder()
                .id(UUID.randomUUID())
                .title("Reading MCQ")
                .skillType(SkillType.READING)
                .isExam(false)
                .questions(List.of(AssignmentQuestion.builder().questionType(QuestionType.MULTIPLE_CHOICE).build()))
                .build();
        Assignment writingEssay = Assignment.builder()
                .id(assignmentId)
                .title("IELTS Task 2")
                .skillType(SkillType.WRITING)
                .isExam(false)
                .questions(List.of(AssignmentQuestion.builder().questionType(QuestionType.ESSAY).build()))
                .build();

        when(assignmentService.getAssignmentsByClassroom(classroomId)).thenReturn(List.of(mcqReading, writingEssay));

        // gradingOnly = false -> both
        mockMvc.perform(get("/api/v1/teacher/classrooms/" + classroomId + "/assignments")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));

        // gradingOnly = true -> only writingEssay
        mockMvc.perform(get("/api/v1/teacher/classrooms/" + classroomId + "/assignments")
                        .param("gradingOnly", "true")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].title").value("IELTS Task 2"));

        // Create validation failure 400
        mockMvc.perform(post("/api/v1/teacher/assignments")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.title").exists());

        // Create valid 201
        AssignmentRequest validReq = new AssignmentRequest();
        validReq.setTitle("Listening Test");
        validReq.setClassroomId(classroomId);
        validReq.setSkillType("LISTENING");
        when(assignmentService.createAssignment(any())).thenReturn(writingEssay);

        mockMvc.perform(post("/api/v1/teacher/assignments")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(assignmentId.toString()));

        // Get by ID 200 & 404
        when(assignmentService.getAssignmentById(assignmentId)).thenReturn(writingEssay);
        mockMvc.perform(get("/api/v1/teacher/assignments/" + assignmentId)
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk());

        UUID missingId = UUID.randomUUID();
        when(assignmentService.getAssignmentById(missingId)).thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(get("/api/v1/teacher/assignments/" + missingId)
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isNotFound());

        // Update & Delete
        when(assignmentService.updateAssignment(eq(assignmentId), any())).thenReturn(writingEssay);
        mockMvc.perform(put("/api/v1/teacher/assignments/" + assignmentId)
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validReq)))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/teacher/assignments/" + assignmentId)
                        .with(user(createPrincipal(RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk());
        verify(assignmentService).deleteAssignment(assignmentId);

        // Generate audios, exams, question bank, backfill
        mockMvc.perform(post("/api/v1/teacher/assignments/" + assignmentId + "/generate-audios")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("PROCESSING"));
        verify(exerciseAudioService).generateAudiosForAssignmentAsync(assignmentId, AudioGeneratedBy.TEACHER);

        when(assignmentService.getExamsByClassroom(classroomId)).thenReturn(List.of(writingEssay));
        mockMvc.perform(get("/api/v1/teacher/classrooms/" + classroomId + "/exams")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        QuestionBankItemDto item = QuestionBankItemDto.builder().id(UUID.randomUUID()).promptText("Sample Q").build();
        when(assignmentService.getClassroomQuestionBank(classroomId)).thenReturn(List.of(item));
        mockMvc.perform(get("/api/v1/teacher/classrooms/" + classroomId + "/question-bank")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].promptText").value("Sample Q"));

        mockMvc.perform(post("/api/v1/teacher/assignments/backfill-audios")
                        .with(user(createPrincipal(RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("PROCESSING"));
        verify(assignmentService).backfillAllAudios();
    }

    @Test
    @DisplayName("getAssignmentsByClassroom_whenGradingOnlyTrue_includesExamSpeakingWritingEssayAndAudioResponse")
    void getAssignmentsByClassroom_whenGradingOnlyTrue_includesExamSpeakingWritingEssayAndAudioResponse() throws Exception {
        Assignment plainGrammarMcq = Assignment.builder()
                .id(UUID.randomUUID())
                .title("Grammar MCQ")
                .skillType(SkillType.GRAMMAR)
                .isExam(false)
                .questions(List.of(AssignmentQuestion.builder().questionType(QuestionType.MULTIPLE_CHOICE).build()))
                .build();
        Assignment readingExam = Assignment.builder()
                .id(UUID.randomUUID())
                .title("Midterm Exam")
                .skillType(SkillType.READING)
                .isExam(true)
                .questions(null)
                .build();
        Assignment speakingPractice = Assignment.builder()
                .id(UUID.randomUUID())
                .title("Shadowing")
                .skillType(SkillType.SPEAKING)
                .isExam(false)
                .build();
        Assignment mixedAudioQuestion = Assignment.builder()
                .id(UUID.randomUUID())
                .title("Reading + Oral Check")
                .skillType(SkillType.READING)
                .isExam(false)
                .questions(List.of(AssignmentQuestion.builder().questionType(QuestionType.AUDIO_RESPONSE).build()))
                .build();

        when(assignmentService.getAssignmentsByClassroom(classroomId))
                .thenReturn(java.util.Arrays.asList(null, plainGrammarMcq, readingExam, speakingPractice, mixedAudioQuestion));

        mockMvc.perform(get("/api/v1/teacher/classrooms/{classroomId}/assignments", classroomId)
                        .param("gradingOnly", "true")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(3))
                .andExpect(jsonPath("$.data[0].title").value("Midterm Exam"))
                .andExpect(jsonPath("$.data[1].title").value("Shadowing"))
                .andExpect(jsonPath("$.data[2].title").value("Reading + Oral Check"));
    }

    @Test
    @DisplayName("createAssignment_whenStudentRole_returns403")
    void createAssignment_whenStudentRole_returns403() throws Exception {
        AssignmentRequest req = new AssignmentRequest();
        req.setTitle("Homework");
        req.setClassroomId(classroomId);
        req.setSkillType("READING");

        mockMvc.perform(post("/api/v1/teacher/assignments")
                        .with(user(createPrincipal(RoleName.ROLE_STUDENT)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        verifyNoInteractions(assignmentService);
    }

    @Test
    @DisplayName("createAssignment_whenBadRequestFromService_returns400")
    void createAssignment_whenBadRequestFromService_returns400() throws Exception {
        AssignmentRequest req = new AssignmentRequest();
        req.setTitle("Invalid Exam");
        req.setClassroomId(classroomId);
        req.setSkillType("WRONG_SKILL");
        when(assignmentService.createAssignment(any())).thenThrow(new BadRequestException("Invalid skillType: WRONG_SKILL"));

        mockMvc.perform(post("/api/v1/teacher/assignments")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid skillType: WRONG_SKILL"));
    }

    @Test
    @DisplayName("updateAssignment_whenStudentRole_returns403")
    void updateAssignment_whenStudentRole_returns403() throws Exception {
        AssignmentRequest req = new AssignmentRequest();
        req.setTitle("Edited");
        req.setClassroomId(classroomId);
        req.setSkillType("READING");

        mockMvc.perform(put("/api/v1/teacher/assignments/{id}", assignmentId)
                        .with(user(createPrincipal(RoleName.ROLE_STUDENT)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        verifyNoInteractions(assignmentService);
    }

    @Test
    @DisplayName("updateAssignment_whenInvalidRequest_returns400")
    void updateAssignment_whenInvalidRequest_returns400() throws Exception {
        mockMvc.perform(put("/api/v1/teacher/assignments/{id}", assignmentId)
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.title").exists())
                .andExpect(jsonPath("$.validationErrors.classroomId").exists())
                .andExpect(jsonPath("$.validationErrors.skillType").exists());

        verifyNoInteractions(assignmentService);
    }

    @Test
    @DisplayName("updateAssignment_whenAssignmentNotFound_returns404")
    void updateAssignment_whenAssignmentNotFound_returns404() throws Exception {
        UUID missingId = UUID.randomUUID();
        AssignmentRequest req = new AssignmentRequest();
        req.setTitle("Updated");
        req.setClassroomId(classroomId);
        req.setSkillType("WRITING");
        when(assignmentService.updateAssignment(eq(missingId), any()))
                .thenThrow(new ResourceNotFoundException("Assignment not found"));

        mockMvc.perform(put("/api/v1/teacher/assignments/{id}", missingId)
                        .with(user(createPrincipal(RoleName.ROLE_ADMIN)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("deleteAssignment_whenStudentRole_returns403")
    void deleteAssignment_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(delete("/api/v1/teacher/assignments/{id}", assignmentId)
                        .with(user(createPrincipal(RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(assignmentService);
    }

    @Test
    @DisplayName("deleteAssignment_whenAssignmentNotFound_returns404")
    void deleteAssignment_whenAssignmentNotFound_returns404() throws Exception {
        UUID missingId = UUID.randomUUID();
        doThrow(new ResourceNotFoundException("Assignment not found"))
                .when(assignmentService).deleteAssignment(missingId);

        mockMvc.perform(delete("/api/v1/teacher/assignments/{id}", missingId)
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("synthesizeAudio_whenTextBlank_returns400")
    void synthesizeAudio_whenTextBlank_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/teacher/assignments/synthesize-audio")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"   \"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(ttsService);
    }

    @Test
    @DisplayName("synthesizeAudio_whenVoiceAndSpeedExplicitNull_usesDefaults")
    void synthesizeAudio_whenVoiceAndSpeedExplicitNull_usesDefaults() throws Exception {
        when(ttsService.synthesizeAudio("Hello students", "af_heart", "1.0x"))
                .thenReturn("/api/v1/files/audio/default.wav");

        mockMvc.perform(post("/api/v1/teacher/assignments/synthesize-audio")
                        .with(user(createPrincipal(RoleName.ROLE_TEACHER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Hello students\",\"voice\":null,\"speed\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("/api/v1/files/audio/default.wav"));

        verify(ttsService).synthesizeAudio("Hello students", "af_heart", "1.0x");
    }

    @Test
    @DisplayName("getExamsByClassroom_whenStudentRole_returns403")
    void getExamsByClassroom_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/classrooms/{classroomId}/exams", classroomId)
                        .with(user(createPrincipal(RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(assignmentService);
    }

    @Test
    @DisplayName("getClassroomQuestionBank_whenStudentRole_returns403")
    void getClassroomQuestionBank_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/classrooms/{classroomId}/question-bank", classroomId)
                        .with(user(createPrincipal(RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(assignmentService);
    }
}
