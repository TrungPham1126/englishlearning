package com.englishlearning.curriculum.controller;

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
import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.service.CurriculumService;
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

import java.time.LocalDateTime;
import java.util.Collections;
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

@WebMvcTest(controllers = CurriculumController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("CurriculumController - CRUD Bài học, Tài liệu & Chủ điểm ngữ pháp")
class CurriculumControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CurriculumService curriculumService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID classId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID lessonId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID docId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID topicId = UUID.fromString("44444444-4444-4444-4444-444444444444");

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
    @DisplayName("POST /api/curriculum/lessons - TEACHER tạo bài học trả 201, STUDENT bị 403, thiếu fields trả 400")
    void createLesson_securityValidationAndCreated() throws Exception {
        LessonResponse created = LessonResponse.builder()
                .id(lessonId)
                .classId(classId)
                .title("Unit 1: Greetings")
                .orderIndex(1)
                .build();
        when(curriculumService.createLesson(any(LessonRequest.class))).thenReturn(created);

        String validBody = """
                {
                  "classId": "11111111-1111-1111-1111-111111111111",
                  "title": "Unit 1: Greetings",
                  "orderIndex": 1
                }
                """;

        mockMvc.perform(post("/api/curriculum/lessons")
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Lesson created successfully"))
                .andExpect(jsonPath("$.data.id").value(lessonId.toString()));

        mockMvc.perform(post("/api/curriculum/lessons")
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/curriculum/lessons")
                        .with(user(userWithRole(RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.classId").exists())
                .andExpect(jsonPath("$.validationErrors.title").exists());
    }

    @Test
    @DisplayName("GET /api/curriculum/classes/{classId}/lessons & /lessons/{id} - Trả 200 cho STUDENT hoặc 401/404")
    void getLessonsAndDetail_behavesCorrectly() throws Exception {
        LessonResponse lr = LessonResponse.builder()
                .id(lessonId)
                .classId(classId)
                .title("Unit 1")
                .completed(true)
                .progressPercentage(100)
                .build();
        when(curriculumService.getLessonsByClass(classId)).thenReturn(List.of(lr));

        mockMvc.perform(get("/api/curriculum/classes/{classId}/lessons", classId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].isCompleted").value(true));

        mockMvc.perform(get("/api/curriculum/classes/{classId}/lessons", classId))
                .andExpect(status().isUnauthorized());

        LessonDetailResponse detail = LessonDetailResponse.builder()
                .id(lessonId)
                .classId(classId)
                .title("Unit 1")
                .documents(Collections.emptyList())
                .vocabularies(Collections.emptyList())
                .grammarTopics(Collections.emptyList())
                .build();
        when(curriculumService.getLessonDetail(lessonId)).thenReturn(detail);

        mockMvc.perform(get("/api/curriculum/lessons/{id}", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Unit 1"));

        UUID missingId = UUID.randomUUID();
        when(curriculumService.getLessonDetail(missingId))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy bài học"));
        mockMvc.perform(get("/api/curriculum/lessons/{id}", missingId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PUT & DELETE /api/curriculum/lessons/{id} - TEACHER cập nhật và xóa bài học")
    void updateAndDeleteLesson_returnsOk() throws Exception {
        LessonResponse updated = LessonResponse.builder().id(lessonId).title("Unit 1 Updated").build();
        when(curriculumService.updateLesson(eq(lessonId), any(LessonUpdateRequest.class))).thenReturn(updated);

        mockMvc.perform(put("/api/curriculum/lessons/{id}", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "Unit 1 Updated", "orderIndex": 2 }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Unit 1 Updated"));

        doNothing().when(curriculumService).deleteLesson(lessonId);
        mockMvc.perform(delete("/api/curriculum/lessons/{id}", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_ADMIN)))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Lesson deleted successfully"));
    }

    @Test
    @DisplayName("POST/GET/DELETE documents & grammar topics - Multipart upload, invalid type 400, CRUD grammar")
    void documentsAndGrammar_allEndpoints() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "notes.pdf", "application/pdf", new byte[]{1, 2, 3});
        DocumentResponse docResp = DocumentResponse.builder()
                .id(docId)
                .lessonId(lessonId)
                .fileName("notes.pdf")
                .fileUrl("https://cdn.test/notes.pdf")
                .fileType("PDF")
                .fileSizeBytes(3L)
                .createdAt(LocalDateTime.now())
                .build();
        when(curriculumService.uploadLessonDocument(eq(lessonId), any(), eq("PDF"))).thenReturn(docResp);

        mockMvc.perform(multipart("/api/curriculum/lessons/{lessonId}/documents", lessonId)
                        .file(file)
                        .param("fileType", "PDF")
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.fileType").value("PDF"));

        when(curriculumService.uploadLessonDocument(eq(lessonId), any(), eq("INVALID")))
                .thenThrow(new BadRequestException("Loại tài liệu không hợp lệ: INVALID"));
        mockMvc.perform(multipart("/api/curriculum/lessons/{lessonId}/documents", lessonId)
                        .file(file)
                        .param("fileType", "INVALID")
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isBadRequest());

        when(curriculumService.getDocumentsByLesson(lessonId)).thenReturn(List.of(docResp));
        mockMvc.perform(get("/api/curriculum/lessons/{lessonId}/documents", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(docId.toString()));

        doNothing().when(curriculumService).deleteDocument(docId);
        mockMvc.perform(delete("/api/curriculum/documents/{documentId}", docId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isOk());

        DocumentResponse updatedDocResp = DocumentResponse.builder()
                .id(docId)
                .lessonId(lessonId)
                .fileName("notes-v2.docx")
                .fileUrl("https://cdn.test/notes-v2.docx")
                .fileType("DOCX")
                .build();
        when(curriculumService.updateDocument(eq(docId), any(DocumentUpdateRequest.class))).thenReturn(updatedDocResp);
        mockMvc.perform(put("/api/curriculum/documents/{documentId}", docId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "fileName": "notes-v2.docx", "fileType": "DOCX" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileName").value("notes-v2.docx"))
                .andExpect(jsonPath("$.data.fileType").value("DOCX"));

        // STUDENT bị chặn 403 và body rỗng trả 400
        mockMvc.perform(put("/api/curriculum/documents/{documentId}", docId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "fileName": "x.pdf" }
                                """))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/curriculum/documents/{documentId}", docId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        when(curriculumService.replaceDocumentFile(eq(docId), any(), eq("notes-v2.docx"), eq("DOCX")))
                .thenReturn(updatedDocResp);
        mockMvc.perform(multipart("/api/curriculum/documents/{documentId}/file", docId)
                        .file(file)
                        .param("fileName", "notes-v2.docx")
                        .param("fileType", "DOCX")
                        .with(request -> {
                            request.setMethod("PUT");
                            return request;
                        })
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileUrl").value("https://cdn.test/notes-v2.docx"));

        GrammarTopicResponse topicResp = GrammarTopicResponse.builder()
                .id(topicId)
                .lessonId(lessonId)
                .title("Past Simple")
                .ruleSummary("Completed past action")
                .build();
        when(curriculumService.addGrammarTopic(eq(lessonId), any(GrammarTopicRequest.class))).thenReturn(topicResp);
        when(curriculumService.getGrammarTopicsByLesson(lessonId)).thenReturn(List.of(topicResp));

        mockMvc.perform(post("/api/curriculum/lessons/{lessonId}/grammar", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "Past Simple", "ruleSummary": "Completed past action" }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.title").value("Past Simple"));

        mockMvc.perform(get("/api/curriculum/lessons/{lessonId}/grammar", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(topicId.toString()));

        GrammarTopicResponse updatedTopicResp = GrammarTopicResponse.builder()
                .id(topicId)
                .lessonId(lessonId)
                .title("Past Perfect")
                .ruleSummary("Action before another past action")
                .formula("S + had + V3")
                .build();
        when(curriculumService.updateGrammarTopic(eq(topicId), any(GrammarTopicRequest.class))).thenReturn(updatedTopicResp);
        mockMvc.perform(put("/api/curriculum/grammar/{topicId}", topicId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "Past Perfect", "ruleSummary": "Action before another past action", "formula": "S + had + V3" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Past Perfect"))
                .andExpect(jsonPath("$.data.formula").value("S + had + V3"));

        mockMvc.perform(put("/api/curriculum/grammar/{topicId}", topicId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "X", "ruleSummary": "Y" }
                                """))
                .andExpect(status().isForbidden());

        doNothing().when(curriculumService).deleteGrammarTopic(topicId);
        mockMvc.perform(delete("/api/curriculum/grammar/{topicId}", topicId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/curriculum/lessons - Lớp học không tồn tại trả về 404 Not Found")
    void createLesson_classroomNotFound_returns404() throws Exception {
        when(curriculumService.createLesson(any(LessonRequest.class)))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy lớp học"));

        mockMvc.perform(post("/api/curriculum/lessons")
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "classId": "11111111-1111-1111-1111-111111111111",
                                  "title": "Unit 1"
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("PUT /api/curriculum/lessons/{id} - STUDENT bị chặn 403 Forbidden")
    void updateLesson_asStudent_returns403() throws Exception {
        mockMvc.perform(put("/api/curriculum/lessons/{id}", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "Hacked" }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("PUT /api/curriculum/lessons/{id} - Thiếu title trả về 400 Bad Request")
    void updateLesson_blankTitle_returns400() throws Exception {
        mockMvc.perform(put("/api/curriculum/lessons/{id}", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "   " }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.title").exists());

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("PUT /api/curriculum/lessons/{id} - Bài học không tồn tại trả về 404 Not Found")
    void updateLesson_lessonNotFound_returns404() throws Exception {
        UUID missingId = UUID.randomUUID();
        when(curriculumService.updateLesson(eq(missingId), any(LessonUpdateRequest.class)))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy bài học"));

        mockMvc.perform(put("/api/curriculum/lessons/{id}", missingId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "Unit X" }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("DELETE /api/curriculum/lessons/{id} - STUDENT bị chặn 403 Forbidden")
    void deleteLesson_asStudent_returns403() throws Exception {
        mockMvc.perform(delete("/api/curriculum/lessons/{id}", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("DELETE /api/curriculum/lessons/{id} - Bài học không tồn tại trả về 404 Not Found")
    void deleteLesson_lessonNotFound_returns404() throws Exception {
        UUID missingId = UUID.randomUUID();
        doThrow(new ResourceNotFoundException("Không tìm thấy bài học"))
                .when(curriculumService).deleteLesson(missingId);

        mockMvc.perform(delete("/api/curriculum/lessons/{id}", missingId)
                        .with(user(userWithRole(RoleName.ROLE_ADMIN)))
                        .with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("POST /api/curriculum/lessons/{lessonId}/documents - STUDENT bị chặn 403 Forbidden")
    void uploadDocument_asStudent_returns403() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "notes.pdf", "application/pdf", new byte[]{1});

        mockMvc.perform(multipart("/api/curriculum/lessons/{lessonId}/documents", lessonId)
                        .file(file)
                        .param("fileType", "PDF")
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("POST /api/curriculum/lessons/{lessonId}/documents - Bài học không tồn tại trả về 404 Not Found")
    void uploadDocument_lessonNotFound_returns404() throws Exception {
        UUID missingLesson = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "notes.pdf", "application/pdf", new byte[]{1});
        when(curriculumService.uploadLessonDocument(eq(missingLesson), any(), eq("PDF")))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy bài học"));

        mockMvc.perform(multipart("/api/curriculum/lessons/{lessonId}/documents", missingLesson)
                        .file(file)
                        .param("fileType", "PDF")
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PUT /api/curriculum/documents/{documentId}/file - STUDENT bị chặn 403 Forbidden")
    void replaceDocumentFile_asStudent_returns403() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "notes.pdf", "application/pdf", new byte[]{1});

        mockMvc.perform(multipart("/api/curriculum/documents/{documentId}/file", docId)
                        .file(file)
                        .with(request -> {
                            request.setMethod("PUT");
                            return request;
                        })
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("DELETE /api/curriculum/documents/{documentId} - STUDENT bị chặn 403 Forbidden")
    void deleteDocument_asStudent_returns403() throws Exception {
        mockMvc.perform(delete("/api/curriculum/documents/{documentId}", docId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("DELETE /api/curriculum/documents/{documentId} - Tài liệu không tồn tại trả về 404 Not Found")
    void deleteDocument_documentNotFound_returns404() throws Exception {
        UUID missingDoc = UUID.randomUUID();
        doThrow(new ResourceNotFoundException("Không tìm thấy tài liệu"))
                .when(curriculumService).deleteDocument(missingDoc);

        mockMvc.perform(delete("/api/curriculum/documents/{documentId}", missingDoc)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("POST /api/curriculum/lessons/{lessonId}/grammar - Thiếu title/ruleSummary trả về 400 Bad Request")
    void addGrammarTopic_blankTitleOrSummary_returns400() throws Exception {
        mockMvc.perform(post("/api/curriculum/lessons/{lessonId}/grammar", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "", "ruleSummary": "" }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.title").exists())
                .andExpect(jsonPath("$.validationErrors.ruleSummary").exists());

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("POST /api/curriculum/lessons/{lessonId}/grammar - STUDENT bị chặn 403 Forbidden")
    void addGrammarTopic_asStudent_returns403() throws Exception {
        mockMvc.perform(post("/api/curriculum/lessons/{lessonId}/grammar", lessonId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "Past Simple", "ruleSummary": "Action in past" }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("DELETE /api/curriculum/grammar/{topicId} - STUDENT bị chặn 403 Forbidden")
    void deleteGrammarTopic_asStudent_returns403() throws Exception {
        mockMvc.perform(delete("/api/curriculum/grammar/{topicId}", topicId)
                        .with(user(userWithRole(RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(curriculumService);
    }

    @Test
    @DisplayName("DELETE /api/curriculum/grammar/{topicId} - Chủ điểm không tồn tại trả về 404 Not Found")
    void deleteGrammarTopic_topicNotFound_returns404() throws Exception {
        UUID missingTopic = UUID.randomUUID();
        doThrow(new ResourceNotFoundException("Không tìm thấy chủ điểm ngữ pháp"))
                .when(curriculumService).deleteGrammarTopic(missingTopic);

        mockMvc.perform(delete("/api/curriculum/grammar/{topicId}", missingTopic)
                        .with(user(userWithRole(RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isNotFound());
    }
}
