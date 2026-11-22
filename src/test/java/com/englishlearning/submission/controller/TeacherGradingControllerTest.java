package com.englishlearning.submission.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.dto.SubmissionSummaryResponse;
import com.englishlearning.submission.dto.TeacherGradeRequest;
import com.englishlearning.submission.dto.TeacherStudentSubmissionDto;
import com.englishlearning.submission.service.SubmissionService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = TeacherGradingController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("TeacherGradingController - Student Classroom Submissions & Security")
class TeacherGradingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SubmissionService submissionService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID classId = UUID.fromString("aaaaaaaa-1111-2222-3333-444444444444");
    private final UUID studentId = UUID.fromString("bbbbbbbb-1111-2222-3333-444444444444");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails createUserWithRole(RoleName roleName) {
        User user = User.builder()
                .id(UUID.randomUUID())
                .email(roleName.name().toLowerCase() + "@englishlearning.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(user);
    }

    @Test
    @DisplayName("GET /api/v1/teacher/classrooms/{classId}/students/{studentId}/submissions -> 200 OK cho TEACHER")
    void getStudentClassroomSubmissions_Teacher_ReturnsList() throws Exception {
        UUID attemptId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        TeacherStudentSubmissionDto dto = TeacherStudentSubmissionDto.builder()
                .attemptId(attemptId)
                .assignmentId(assignmentId)
                .assignmentTitle("IELTS Speaking Part 2")
                .skillType("SPEAKING")
                .questionTypes(List.of("AUDIO_RESPONSE"))
                .attemptNumber(1)
                .status("SUBMITTED")
                .score(7.0)
                .submittedAt(Instant.parse("2026-11-10T08:30:00Z"))
                .dayNumber(3)
                .dayTitle("Technology & Society")
                .scheduledDate(LocalDate.of(2026, 11, 10))
                .hasAiEvaluation(true)
                .aiScore(7.0)
                .aiCefr("B2")
                .aiEvalType("SPEAKING")
                .previewText("In my opinion, smartphones have transformed...")
                .hasAudio(true)
                .build();

        when(submissionService.getStudentClassroomSubmissions(classId, studentId))
                .thenReturn(List.of(dto));

        mockMvc.perform(get("/api/v1/teacher/classrooms/{classId}/students/{studentId}/submissions", classId, studentId)
                        .with(user(createUserWithRole(RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data[0].attemptId").value(attemptId.toString()))
                .andExpect(jsonPath("$.data[0].skillType").value("SPEAKING"))
                .andExpect(jsonPath("$.data[0].dayNumber").value(3))
                .andExpect(jsonPath("$.data[0].hasAiEvaluation").value(true))
                .andExpect(jsonPath("$.data[0].aiScore").value(7.0))
                .andExpect(jsonPath("$.data[0].aiCefr").value("B2"));
    }

    @Test
    @DisplayName("GET /api/v1/teacher/classrooms/{classId}/students/{studentId}/submissions -> 403 Forbidden cho STUDENT")
    void getStudentClassroomSubmissions_Student_Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/classrooms/{classId}/students/{studentId}/submissions", classId, studentId)
                        .with(user(createUserWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET submissions, GET detail & POST manual grade: 200, 400 validation, 401, 403, 404")
    void teacherGradingEndpoints_fullContractAndSecurity() throws Exception {
        UUID assignmentId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        CustomUserDetails teacher = createUserWithRole(RoleName.ROLE_TEACHER);

        // 401 unauthenticated
        mockMvc.perform(get("/api/v1/teacher/assignments/{assignmentId}/submissions", assignmentId))
                .andExpect(status().isUnauthorized());

        // 200 getSubmissions
        SubmissionSummaryResponse summary = SubmissionSummaryResponse.builder()
                .attemptId(attemptId)
                .studentId(studentId)
                .studentName("Nguyen Van A")
                .status("SUBMITTED")
                .score(7.5)
                .violationCount(0)
                .isCheatingFlagged(false)
                .build();
        when(submissionService.getTeacherSubmissions(assignmentId)).thenReturn(List.of(summary));

        mockMvc.perform(get("/api/v1/teacher/assignments/{assignmentId}/submissions", assignmentId)
                        .with(user(teacher)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].studentName").value("Nguyen Van A"))
                .andExpect(jsonPath("$.data[0].status").value("SUBMITTED"));

        // 200 getSubmissionDetail & 404 missing
        AttemptResponse detail = AttemptResponse.builder()
                .attemptId(attemptId)
                .assignmentId(assignmentId)
                .status("SUBMITTED")
                .score(7.5)
                .build();
        when(submissionService.getAttemptDetail(attemptId, null, true)).thenReturn(detail);
        mockMvc.perform(get("/api/v1/teacher/submissions/{attemptId}", attemptId)
                        .with(user(teacher)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId.toString()));

        UUID missingId = UUID.randomUUID();
        when(submissionService.getAttemptDetail(missingId, null, true))
                .thenThrow(new ResourceNotFoundException("Attempt not found"));
        mockMvc.perform(get("/api/v1/teacher/submissions/{attemptId}", missingId)
                        .with(user(teacher)))
                .andExpect(status().isNotFound());

        // 400 missing finalScore
        mockMvc.perform(post("/api/v1/teacher/submissions/{attemptId}/grade", attemptId)
                        .with(user(teacher))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"feedback\":\"Missing score\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.finalScore").exists());

        // 403 STUDENT trying to grade
        mockMvc.perform(post("/api/v1/teacher/submissions/{attemptId}/grade", attemptId)
                        .with(user(createUserWithRole(RoleName.ROLE_STUDENT)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"finalScore\":9.0,\"feedback\":\"Self grade\"}"))
                .andExpect(status().isForbidden());

        // 200 manual grade success
        AttemptResponse graded = AttemptResponse.builder()
                .attemptId(attemptId)
                .status("COMPLETED")
                .score(9.0)
                .teacherFeedback("Excellent reasoning")
                .build();
        when(submissionService.gradeSubmission(eq(attemptId), any(TeacherGradeRequest.class))).thenReturn(graded);

        mockMvc.perform(post("/api/v1/teacher/submissions/{attemptId}/grade", attemptId)
                        .with(user(teacher))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"finalScore\":9.0,\"feedback\":\"Excellent reasoning\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Graded successfully"))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.score").value(9.0));
    }

    @Test
    @DisplayName("POST grade từ chối finalScore ngoài khoảng [0.0, 10.0] với HTTP 400")
    void gradeSubmission_rejectsOutOfRangeFinalScore() throws Exception {
        CustomUserDetails teacher = createUserWithRole(RoleName.ROLE_TEACHER);
        UUID attemptId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/teacher/submissions/{attemptId}/grade", attemptId)
                        .with(user(teacher))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"finalScore\":85.0,\"feedback\":\"Legacy 0-100 scale\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.finalScore").exists());

        mockMvc.perform(post("/api/v1/teacher/submissions/{attemptId}/grade", attemptId)
                        .with(user(teacher))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"finalScore\":-1.0,\"feedback\":\"Negative score\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.finalScore").exists());
    }

    @Test
    @DisplayName("getSubmissions_whenStudentRole_returns403")
    void getSubmissions_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/assignments/{assignmentId}/submissions", UUID.randomUUID())
                        .with(user(createUserWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(submissionService);
    }

    @Test
    @DisplayName("getSubmissionDetail_whenStudentRole_returns403")
    void getSubmissionDetail_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/submissions/{attemptId}", UUID.randomUUID())
                        .with(user(createUserWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(submissionService);
    }

    @Test
    @DisplayName("getSubmissions_whenAdminRole_returns200")
    void getSubmissions_whenAdminRole_returns200() throws Exception {
        UUID assignmentId = UUID.randomUUID();
        SubmissionSummaryResponse item = SubmissionSummaryResponse.builder()
                .attemptId(UUID.randomUUID())
                .studentId(studentId)
                .studentName("Tran Minh")
                .status("COMPLETED")
                .score(8.5)
                .build();
        when(submissionService.getTeacherSubmissions(assignmentId)).thenReturn(List.of(item));

        mockMvc.perform(get("/api/v1/teacher/assignments/{assignmentId}/submissions", assignmentId)
                        .with(user(createUserWithRole(RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].studentName").value("Tran Minh"))
                .andExpect(jsonPath("$.data[0].score").value(8.5));
    }

    @Test
    @DisplayName("gradeSubmission_whenAdminRole_returns200")
    void gradeSubmission_whenAdminRole_returns200() throws Exception {
        UUID attemptId = UUID.randomUUID();
        AttemptResponse graded = AttemptResponse.builder()
                .attemptId(attemptId)
                .status("COMPLETED")
                .score(8.0)
                .teacherFeedback("Well structured")
                .build();
        when(submissionService.gradeSubmission(eq(attemptId), any(TeacherGradeRequest.class))).thenReturn(graded);

        mockMvc.perform(post("/api/v1/teacher/submissions/{attemptId}/grade", attemptId)
                        .with(user(createUserWithRole(RoleName.ROLE_ADMIN)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"finalScore\":8.0,\"feedback\":\"Well structured\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.score").value(8.0))
                .andExpect(jsonPath("$.data.teacherFeedback").value("Well structured"));
    }

    @Test
    @DisplayName("gradeSubmission_whenAttemptNotFound_returns404")
    void gradeSubmission_whenAttemptNotFound_returns404() throws Exception {
        UUID missingAttemptId = UUID.randomUUID();
        when(submissionService.gradeSubmission(eq(missingAttemptId), any(TeacherGradeRequest.class)))
                .thenThrow(new ResourceNotFoundException("Attempt not found"));

        mockMvc.perform(post("/api/v1/teacher/submissions/{attemptId}/grade", missingAttemptId)
                        .with(user(createUserWithRole(RoleName.ROLE_TEACHER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"finalScore\":7.5,\"feedback\":\"Review\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("getStudentClassroomSubmissions_whenUnauthenticated_returns401")
    void getStudentClassroomSubmissions_whenUnauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/teacher/classrooms/{classId}/students/{studentId}/submissions", classId, studentId))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(submissionService);
    }
}
