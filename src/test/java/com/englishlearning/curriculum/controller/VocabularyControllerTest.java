package com.englishlearning.curriculum.controller;

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
import com.englishlearning.curriculum.dto.VocabularyRequest;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.service.VocabularyService;
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

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = VocabularyController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("VocabularyController - CRUD Từ vựng & Phân quyền")
class VocabularyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VocabularyService vocabularyService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID lessonId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID vocabId = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(RoleName roleName) {
        User u = User.builder()
                .id(UUID.randomUUID())
                .email(roleName.name().toLowerCase() + "@test.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("GET /lessons/{lessonId}/vocabularies - Học viên lấy được danh sách từ vựng")
    void getVocabulariesByLesson_whenAuthenticated_returnsList() throws Exception {
        VocabularyResponse resp = VocabularyResponse.builder()
                .id(vocabId)
                .lessonId(lessonId)
                .word("eloquent")
                .meaning("hùng biện")
                .ipa("/ˈel.ə.kwənt/")
                .audioUrl("https://cdn.test/eloquent.mp3")
                .build();
        when(vocabularyService.getVocabulariesByLesson(lessonId)).thenReturn(List.of(resp));

        mockMvc.perform(get("/api/curriculum/lessons/{lessonId}/vocabularies", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].word").value("eloquent"))
                .andExpect(jsonPath("$.data[0].ipa").value("/ˈel.ə.kwənt/"));
    }

    @Test
    @DisplayName("POST /lessons/{lessonId}/vocabularies - TEACHER tạo từ vựng 201, STUDENT 403, thiếu field 400")
    void addVocabulary_allBranches() throws Exception {
        VocabularyResponse resp = VocabularyResponse.builder()
                .id(vocabId)
                .lessonId(lessonId)
                .word("fluent")
                .meaning("trôi chảy")
                .build();
        when(vocabularyService.addVocabulary(eq(lessonId), any(VocabularyRequest.class))).thenReturn(resp);

        String validBody = """
                { "word": "fluent", "meaning": "trôi chảy" }
                """;

        mockMvc.perform(post("/api/curriculum/lessons/{lessonId}/vocabularies", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(vocabId.toString()));

        mockMvc.perform(post("/api/curriculum/lessons/{lessonId}/vocabularies", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/curriculum/lessons/{lessonId}/vocabularies", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "word": "", "meaning": "" }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.word").exists())
                .andExpect(jsonPath("$.validationErrors.meaning").exists());
    }

    @Test
    @DisplayName("PUT & DELETE /vocabularies/{id} - Cập nhật & xóa trả 200 hoặc 404")
    void updateAndDeleteVocabulary_returnsOkOr404() throws Exception {
        VocabularyResponse updated = VocabularyResponse.builder()
                .id(vocabId)
                .word("vivid")
                .meaning("sinh động")
                .build();
        when(vocabularyService.updateVocabulary(eq(vocabId), any(VocabularyRequest.class))).thenReturn(updated);

        mockMvc.perform(put("/api/curriculum/vocabularies/{id}", vocabId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "word": "vivid", "meaning": "sinh động" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.word").value("vivid"));

        UUID missingId = UUID.randomUUID();
        doThrow(new ResourceNotFoundException("Không tìm thấy từ vựng"))
                .when(vocabularyService).deleteVocabulary(missingId);

        mockMvc.perform(delete("/api/curriculum/vocabularies/{id}", missingId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isNotFound());

        doNothing().when(vocabularyService).deleteVocabulary(vocabId);
        mockMvc.perform(delete("/api/curriculum/vocabularies/{id}", vocabId)
                        .with(user(userWithRole(RoleName.ROLE_ADMIN)))
                        .with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("getVocabulariesByLesson_whenUnauthenticated_returns401")
    void getVocabulariesByLesson_whenUnauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/curriculum/lessons/{lessonId}/vocabularies", lessonId))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(vocabularyService);
    }

    @Test
    @DisplayName("getVocabulariesByLesson_whenEmpty_returns200WithEmptyArray")
    void getVocabulariesByLesson_whenEmpty_returns200WithEmptyArray() throws Exception {
        when(vocabularyService.getVocabulariesByLesson(lessonId)).thenReturn(List.of());

        mockMvc.perform(get("/api/curriculum/lessons/{lessonId}/vocabularies", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @DisplayName("addVocabulary_whenLessonNotFound_returns404")
    void addVocabulary_whenLessonNotFound_returns404() throws Exception {
        when(vocabularyService.addVocabulary(eq(lessonId), any(VocabularyRequest.class)))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy bài học"));

        mockMvc.perform(post("/api/curriculum/lessons/{lessonId}/vocabularies", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "word": "resilient", "meaning": "kiên cường" }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("updateVocabulary_whenStudentRole_returns403")
    void updateVocabulary_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(put("/api/curriculum/vocabularies/{id}", vocabId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "word": "vivid", "meaning": "sinh động" }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(vocabularyService);
    }

    @Test
    @DisplayName("updateVocabulary_whenInvalidRequest_returns400")
    void updateVocabulary_whenInvalidRequest_returns400() throws Exception {
        mockMvc.perform(put("/api/curriculum/vocabularies/{id}", vocabId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "word": "  ", "meaning": "" }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.word").exists())
                .andExpect(jsonPath("$.validationErrors.meaning").exists());

        verifyNoInteractions(vocabularyService);
    }

    @Test
    @DisplayName("updateVocabulary_whenVocabularyNotFound_returns404")
    void updateVocabulary_whenVocabularyNotFound_returns404() throws Exception {
        UUID missingId = UUID.randomUUID();
        when(vocabularyService.updateVocabulary(eq(missingId), any(VocabularyRequest.class)))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy từ vựng"));

        mockMvc.perform(put("/api/curriculum/vocabularies/{id}", missingId)
                        .with(user(userWithRole(RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "word": "eloquent", "meaning": "hùng biện" }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("deleteVocabulary_whenStudentRole_returns403")
    void deleteVocabulary_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(delete("/api/curriculum/vocabularies/{id}", vocabId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(vocabularyService);
    }
}
