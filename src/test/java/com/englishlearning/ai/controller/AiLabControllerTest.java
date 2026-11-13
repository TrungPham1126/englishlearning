package com.englishlearning.ai.controller;

import com.englishlearning.ai.dto.AiExamDraftResponse;
import com.englishlearning.ai.dto.AiExamGenerateRequest;
import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.GenerationStatus;
import com.englishlearning.ai.service.AiLabService;
import com.englishlearning.ai.service.ShadowingService;
import com.englishlearning.ai.service.WhisperPronunciationService;
import com.englishlearning.assignment.entity.Assignment;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AiLabController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AiLabController - RBAC, UUID Sanitization & Endpoints AI Lab")
class AiLabControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AiLabService aiLabService;
    @MockBean private ShadowingService shadowingService;
    @MockBean private WhisperPronunciationService whisperPronunciationService;
    @MockBean private JwtService jwtService;
    @MockBean private UserDetailsService userDetailsService;
    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID teacherId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID studentId = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User u = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@english.test")
                .password("pwd")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("GET/POST chưa xác thực trả 401; STUDENT được chấm Speaking & TEACHER bị từ chối 403")
    void evaluateSpeaking_enforcesStudentRoleAndHandlesInvalidUuid() throws Exception {
        MockMultipartFile audio = new MockMultipartFile("audio", "speak.wav", "audio/wav", "bytes".getBytes());
        JsonNode okNode = objectMapper.readTree("{\"overallBand\":7.0}");
        when(aiLabService.evaluateSpeakingTopic(eq("Hobby"), any(), isNull())).thenReturn(okNode);

        mockMvc.perform(multipart("/api/v1/ai/speaking/evaluate")
                        .file(audio)
                        .param("topic", "Hobby")
                        .param("studentAnswerId", "undefined"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(multipart("/api/v1/ai/speaking/evaluate")
                        .file(audio)
                        .param("topic", "Hobby")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isForbidden());

        mockMvc.perform(multipart("/api/v1/ai/speaking/evaluate")
                        .file(audio)
                        .param("topic", "Hobby")
                        .param("studentAnswerId", "undefined")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.overallBand").value(7.0));
    }

    @Test
    @DisplayName("POST /writing/evaluate cho phép STUDENT/TEACHER với UUID hợp lệ; ADMIN bị 403")
    void evaluateWriting_parsesUuidAndEnforcesRbac() throws Exception {
        UUID ansId = UUID.randomUUID();
        when(aiLabService.evaluateWriting(eq("Environment"), eq("Solar energy matters."), eq(ansId)))
                .thenReturn(objectMapper.readTree("{\"overallBand\":6.5}"));

        mockMvc.perform(post("/api/v1/ai/writing/evaluate")
                        .param("topic", "Environment")
                        .param("studentAnswerId", ansId.toString())
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("Solar energy matters.")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallBand").value(6.5));

        mockMvc.perform(post("/api/v1/ai/writing/evaluate")
                        .param("topic", "Environment")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("Essay")
                        .with(user(userWithRole(UUID.randomUUID(), RoleName.ROLE_ADMIN))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /exercise/generate-quiz & /publish: chỉ TEACHER/ADMIN, ưu tiên numQuestions/assignmentType & trả 403 với STUDENT")
    void generateQuizAndPublish_resolvesParamsAndEnforcesTeacherAdminRole() throws Exception {
        UUID exerciseId = UUID.randomUUID();
        UUID classroomId = UUID.randomUUID();
        AiGeneratedExercise generated = AiGeneratedExercise.builder()
                .id(exerciseId)
                .status(GenerationStatus.READY_FOR_REVIEW)
                .exerciseType("GRAMMAR")
                .build();

        when(aiLabService.generateQuizFromContent(
                eq("General English Practice"), eq("B1"), eq(8), eq(teacherId), isNull(), eq("GRAMMAR"), eq("READING")))
                .thenReturn(generated);

        mockMvc.perform(post("/api/v1/ai/exercise/generate-quiz")
                        .param("targetCefr", "B1")
                        .param("numQuestions", "8")
                        .param("lessonId", "null")
                        .param("exerciseType", "GRAMMAR")
                        .param("assignmentType", "READING")
                        .content("   ")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(exerciseId.toString()));

        mockMvc.perform(post("/api/v1/ai/exercise/generate-quiz")
                        .param("targetCefr", "B1")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        Assignment published = Assignment.builder().id(UUID.randomUUID()).title("AI Assignment").build();
        when(aiLabService.publishExerciseToAssignment(exerciseId, classroomId)).thenReturn(published);

        mockMvc.perform(post("/api/v1/ai/exercise/{id}/publish", exerciseId)
                        .param("classroomId", classroomId.toString())
                        .with(user(userWithRole(teacherId, RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Xuất bản thành công"));
    }

    @Test
    @DisplayName("Shadowing, Whisper Pronunciation & Reading Short Answer trả về dữ liệu chuẩn")
    void shadowingWhisperAndReadingEndpoints_returnStructuredResponses() throws Exception {
        UUID ansId = UUID.randomUUID();
        ShadowingEvaluationResponse shadowRes = ShadowingEvaluationResponse.builder()
                .overallScore(92).isPassed(true).evaluatedBy("PYTHON_ACOUSTIC_ENGINE").build();
        when(shadowingService.evaluateShadowing(isNull(), eq(ansId), eq("Hello everyone.")))
                .thenReturn(shadowRes);

        mockMvc.perform(multipart("/api/v1/ai/speaking/shadowing-evaluate")
                        .param("studentAnswerId", ansId.toString())
                        .param("referenceSentence", "Hello everyone.")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallScore").value(92));

        MockMultipartFile audio = new MockMultipartFile("audio", "w.wav", "audio/wav", "abc".getBytes());
        PhoneticEvaluationResponse whisperRes = PhoneticEvaluationResponse.builder()
                .overallScore(88).feedback("Good").wordScores(List.of()).build();
        when(whisperPronunciationService.evaluatePronunciation(any(), eq("Good day"))).thenReturn(whisperRes);

        mockMvc.perform(multipart("/api/v1/ai/pronunciation/whisper-evaluate")
                        .file(audio)
                        .param("referenceText", "Good day")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallScore").value(88));

        AiLabController.ReadingEvaluationRequest readingReq = new AiLabController.ReadingEvaluationRequest();
        readingReq.setPassage("Passage");
        readingReq.setQuestion("Why?");
        readingReq.setStudentAnswer("Because");
        readingReq.setExpectedAnswer("Because");
        when(aiLabService.evaluateReadingShortAnswer("Passage", "Why?", "Because", "Because"))
                .thenReturn(objectMapper.readTree("{\"isContentCorrect\":true}"));

        mockMvc.perform(post("/api/v1/ai/reading/evaluate-short-answer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(readingReq))
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isContentCorrect").value(true));
    }

    @Test
    @DisplayName("POST /exam/generate-draft: TEACHER thành công 200 & BadRequestException ánh xạ 400")
    void generateExamDraft_returnsDraftAndMapsBadRequest() throws Exception {
        AiExamGenerateRequest req = AiExamGenerateRequest.builder()
                .title("Midterm")
                .sections(List.of(AiExamGenerateRequest.SkillSectionSpec.builder()
                        .skillType("READING").questionCount(2).build()))
                .build();
        AiExamDraftResponse draft = AiExamDraftResponse.builder()
                .title("Midterm").examSkills(List.of("READING")).questions(List.of()).build();

        when(aiLabService.generateExamDraft(any(AiExamGenerateRequest.class), eq(teacherId)))
                .thenReturn(draft)
                .thenThrow(new BadRequestException("Vui lòng chọn ít nhất một kỹ năng"));

        mockMvc.perform(post("/api/v1/ai/exam/generate-draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Midterm"));

        mockMvc.perform(post("/api/v1/ai/exam/generate-draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Vui lòng chọn ít nhất một kỹ năng"));

        verify(aiLabService, org.mockito.Mockito.times(2))
                .generateExamDraft(any(AiExamGenerateRequest.class), eq(teacherId));
    }
}
