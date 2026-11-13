package com.englishlearning.submission.controller;

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
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.dto.ExamViolationRequest;
import com.englishlearning.submission.dto.StudentAssignmentSummaryResponse;
import com.englishlearning.submission.dto.SubmissionRequest;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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

    @Test
    @DisplayName("Học sinh ghi nhận vi phạm màn hình phòng thi -> Trả về HTTP 200 OK và violationCount")
    void should_Return200_when_StudentRecordsExamViolation() throws Exception {
        AttemptResponse mockResponse = AttemptResponse.builder()
                .attemptId(attemptId)
                .assignmentId(assignmentId)
                .isExam(true)
                .violationCount(1)
                .maxViolations(3)
                .isCheatingFlagged(false)
                .status("IN_PROGRESS")
                .build();

        when(submissionService.recordAttemptViolation(eq(studentId), eq(attemptId), any(ExamViolationRequest.class)))
                .thenReturn(mockResponse);

        String body = """
                {
                  "eventType": "FULLSCREEN_EXIT",
                  "reason": "Thoát toàn màn hình",
                  "currentAnswers": []
                }
                """;

        mockMvc.perform(post("/api/v1/student/assignments/attempts/" + attemptId + "/violation")
                        .with(user(createStudentUserDetails()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.violationCount").value(1))
                .andExpect(jsonPath("$.data.isCheatingFlagged").value(false));
    }

    @Test
    @DisplayName("Giảng viên gọi API ghi nhận vi phạm thi -> Trả về HTTP 403 Forbidden")
    void should_Return403_when_TeacherRecordsExamViolation() throws Exception {
        mockMvc.perform(post("/api/v1/student/assignments/attempts/" + attemptId + "/violation")
                        .with(user(createTeacherUserDetails()))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"eventType\":\"TAB_SWITCH\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Kiểm thử đầy đủ các endpoint học viên: assignments, submit mismatch 400, history, detail 404, upload audio & 401")
    void studentSubmissionEndpoints_fullContractAndSecurity() throws Exception {
        UUID classId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        CustomUserDetails student = createStudentUserDetails();

        // 1. Unauthenticated -> 401
        mockMvc.perform(get("/api/v1/student/classrooms/" + classId + "/assignments"))
                .andExpect(status().isUnauthorized());

        // 2. GET assignments by class -> 200
        StudentAssignmentSummaryResponse summary = StudentAssignmentSummaryResponse.builder()
                .id(assignmentId).title("Unit 1 Quiz").status("NOT_STARTED").attemptsCount(0).build();
        when(submissionService.getStudentClassAssignments(classId, studentId)).thenReturn(List.of(summary));

        mockMvc.perform(get("/api/v1/student/classrooms/" + classId + "/assignments")
                        .with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].title").value("Unit 1 Quiz"));

        // 3. Submit valid -> 200 & Assignment ID mismatch -> 400
        AttemptResponse submitted = AttemptResponse.builder()
                .attemptId(attemptId).assignmentId(assignmentId).status("COMPLETED").score(9.5).build();
        when(submissionService.submitAttempt(eq(studentId), eq(attemptId), any(SubmissionRequest.class)))
                .thenReturn(submitted);

        mockMvc.perform(post("/api/v1/student/assignments/" + assignmentId + "/attempts/" + attemptId + "/submit")
                        .with(user(student))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assignmentId\":\"" + assignmentId + "\",\"answers\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.score").value(9.5));

        UUID otherAssId = UUID.randomUUID();
        mockMvc.perform(post("/api/v1/student/assignments/" + assignmentId + "/attempts/" + attemptId + "/submit")
                        .with(user(student))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assignmentId\":\"" + otherAssId + "\",\"answers\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Assignment ID mismatch"));

        // 4. Max attempts exceeded on start -> 400
        when(submissionService.startAttempt(studentId, assignmentId))
                .thenThrow(new BadRequestException("Đã hết lượt làm bài"));
        mockMvc.perform(post("/api/v1/student/assignments/" + assignmentId + "/start")
                        .with(user(student))
                        .with(csrf()))
                .andExpect(status().isBadRequest());

        // 5. History & detail (200 and 404)
        when(submissionService.getStudentAttemptsHistory(assignmentId, studentId)).thenReturn(List.of(submitted));
        mockMvc.perform(get("/api/v1/student/assignments/" + assignmentId + "/attempts")
                        .with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        when(submissionService.getAttemptDetail(attemptId, studentId, false)).thenReturn(submitted);
        mockMvc.perform(get("/api/v1/student/assignments/attempts/" + attemptId)
                        .with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attemptId").value(attemptId.toString()));

        UUID missingAttempt = UUID.randomUUID();
        when(submissionService.getAttemptDetail(missingAttempt, studentId, false))
                .thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(get("/api/v1/student/assignments/attempts/" + missingAttempt)
                        .with(user(student)))
                .andExpect(status().isNotFound());

        // 6. Upload speaking audio -> 200
        MockMultipartFile audio = new MockMultipartFile("audio", "speech.wav", "audio/wav", new byte[]{1, 2, 3, 4});
        when(submissionService.uploadAudioResponse(eq(studentId), eq(attemptId), eq(questionId), any()))
                .thenReturn(submitted);
        mockMvc.perform(multipart("/api/v1/student/assignments/attempts/" + attemptId + "/questions/" + questionId + "/audio")
                        .file(audio)
                        .with(user(student))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Upload thành công"));
    }
}
