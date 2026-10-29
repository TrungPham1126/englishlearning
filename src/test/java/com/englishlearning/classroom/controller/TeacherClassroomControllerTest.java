package com.englishlearning.classroom.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.classroom.dto.ClassroomResponse;
import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = TeacherClassroomController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("TeacherClassroomController - Kiểm thử Phân quyền PreAuthorize & HTTP Contract")
class TeacherClassroomControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ClassroomService classroomService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID teacherId = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private final UUID studentId = UUID.fromString("33333333-4444-5555-6666-777777777777");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails createTeacherUserDetails() {
        User user = User.builder()
                .id(teacherId)
                .email("teacher@englishlearning.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        return new CustomUserDetails(user);
    }

    private CustomUserDetails createStudentUserDetails() {
        User user = User.builder()
                .id(studentId)
                .email("student@englishlearning.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        return new CustomUserDetails(user);
    }

    @Test
    @DisplayName("Học sinh cố tình truy cập endpoint của Giảng viên -> Trả về HTTP 403 Forbidden do @PreAuthorize")
    void should_Return403Forbidden_when_StudentAccessesTeacherEndpoint() throws Exception {
        // When & Then: Học sinh chỉ có ROLE_STUDENT, không có ROLE_TEACHER hoặc ROLE_ADMIN
        mockMvc.perform(get("/api/teacher/classrooms")
                        .with(user(createStudentUserDetails())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Giảng viên truy cập đúng quyền -> Trả về HTTP 200 OK và danh sách lớp học")
    void should_Return200AndClassroomList_when_TeacherAccessesEndpoint() throws Exception {
        // Given
        UUID classId = UUID.fromString("88888888-8888-8888-8888-888888888888");
        ClassroomResponse response = ClassroomResponse.builder()
                .id(classId)
                .name("IELTS Speaking Mastery B2")
                .level(ClassLevel.B2)
                .status(ClassStatus.OPEN)
                .maxStudents(30)
                .joinCode("ENG-SPEB2")
                .build();

        when(classroomService.getTeacherClasses(any())).thenReturn(List.of(response));

        // When & Then
        mockMvc.perform(get("/api/teacher/classrooms")
                        .with(user(createTeacherUserDetails())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data[0].id").value(classId.toString()))
                .andExpect(jsonPath("$.data[0].name").value("IELTS Speaking Mastery B2"))
                .andExpect(jsonPath("$.data[0].joinCode").value("ENG-SPEB2"));
    }

    @Test
    @DisplayName("Truy cập endpoint khi chưa xác thực hoặc token không hợp lệ -> Trả về HTTP 401 Unauthorized")
    void should_Return401Unauthorized_when_TokenIsMissingOrInvalid() throws Exception {
        // When & Then: Không có SecurityContext / token
        mockMvc.perform(get("/api/teacher/classrooms"))
                .andExpect(status().isUnauthorized());
    }
}
