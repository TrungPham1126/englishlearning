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
import com.englishlearning.submission.dto.AttemptResponse;
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

import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = StudentSubmissionController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("StudentSubmissionController - Kiểm thử Hợp đồng HTTP CBT Exam & Request Validation")
class StudentSubmissionControllerTest {

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

    private final UUID studentId = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private final UUID teacherId = UUID.fromString("22222222-3333-4444-5555-666666666666");
    private final UUID assignmentId = UUID.fromString("66666666-6666-6666-6666-666666666666");
    private final UUID attemptId = UUID.fromString("77777777-7777-7777-7777-777777777777");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails createStudentUserDetails() {
        User user = User.builder()
                .id(studentId)
                .email("student@test.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        return new CustomUserDetails(user);
    }

    private CustomUserDetails createTeacherUserDetails() {
        User user = User.builder()
                .id(teacherId)
                .email("teacher@test.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        return new CustomUserDetails(user);
    }

    @Test
    @DisplayName("Học sinh bắt đầu làm bài thi CBT -> Trả về HTTP 200 OK và AttemptResponse")
    void should_Return200AndAttemptResponse_when_ValidStartExamRequest() throws Exception {
        // Given
        CustomUserDetails principal = createStudentUserDetails();

        AttemptResponse mockAttempt = AttemptResponse.builder()
                .attemptId(attemptId)
                .assignmentId(assignmentId)
                .assignmentTitle("IELTS Listening Mock Test 1")
                .status("IN_PROGRESS")
                .attemptNumber(1)
                .build();

        when(submissionService.startAttempt(eq(studentId), eq(assignmentId)))
                .thenReturn(mockAttempt);

        // When & Then
        mockMvc.perform(post("/api/v1/student/assignments/" + assignmentId + "/start")
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Attempt started"))
                .andExpect(jsonPath("$.data.attemptId").value(attemptId.toString()))
                .andExpect(jsonPath("$.data.assignmentTitle").value("IELTS Listening Mock Test 1"))
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));
    }

    @Test
    @DisplayName("Nộp bài thi thiếu trường bắt buộc -> Trả về HTTP 400 Bad Request do @Valid validation")
    void should_Return400BadRequest_when_RequestBodyFailsValidation() throws Exception {
        // Given: Request body thiếu assignmentId và answers (đều có @NotNull)
        CustomUserDetails principal = createStudentUserDetails();

        String invalidSubmissionJson = """
                {
                   "assignmentId": null,
                   "answers": null
                }
                """;

        // When & Then
        mockMvc.perform(post("/api/v1/student/assignments/" + assignmentId + "/attempts/" + attemptId + "/submit")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidSubmissionJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.validationErrors.assignmentId").exists())
                .andExpect(jsonPath("$.validationErrors.answers").exists());
    }

    @Test
    @DisplayName("Giảng viên cố tình gọi API bắt đầu thi của học sinh -> Trả về HTTP 403 Forbidden do @PreAuthorize")
    void should_Return403Forbidden_when_TeacherAccessesStudentEndpoint() throws Exception {
        // When & Then: User có role TEACHER gọi API của STUDENT
        mockMvc.perform(post("/api/v1/student/assignments/" + assignmentId + "/start")
                        .with(user(createTeacherUserDetails()))
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }
}
