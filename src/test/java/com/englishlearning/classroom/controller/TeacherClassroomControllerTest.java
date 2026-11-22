package com.englishlearning.classroom.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.classroom.dto.ClassroomResponse;
import com.englishlearning.classroom.dto.StudentProgressResponse;
import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.ResourceNotFoundException;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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

    @Test
    @DisplayName("GET /api/teacher/classrooms - Principal không phải CustomUserDetails -> HTTP 401 Unauthorized")
    void getAssignedClasses_whenPrincipalNotCustomUserDetails_returns401() throws Exception {
        mockMvc.perform(get("/api/teacher/classrooms")
                        .with(user("plainTeacher").roles("TEACHER")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/teacher/classrooms/{id} - Trả chi tiết lớp hoặc 404 / 403")
    void getClassDetail_whenAuthorizedAndMissing_returns200Or404Or403() throws Exception {
        UUID classId = UUID.fromString("88888888-8888-8888-8888-888888888888");
        ClassroomResponse response = ClassroomResponse.builder()
                .id(classId)
                .name("IELTS Speaking Mastery B2")
                .level(ClassLevel.B2)
                .status(ClassStatus.OPEN)
                .maxStudents(30)
                .joinCode("ENG-SPEB2")
                .teacherId(teacherId)
                .teacherName("Nguyen Giang Vien")
                .build();

        when(classroomService.getClassroomById(classId)).thenReturn(response);

        mockMvc.perform(get("/api/teacher/classrooms/{id}", classId)
                        .with(user(createTeacherUserDetails())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(classId.toString()))
                .andExpect(jsonPath("$.data.teacherName").value("Nguyen Giang Vien"));

        UUID missingId = UUID.fromString("99999999-9999-9999-9999-999999999999");
        when(classroomService.getClassroomById(missingId))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy lớp học"));

        mockMvc.perform(get("/api/teacher/classrooms/{id}", missingId)
                        .with(user(createTeacherUserDetails())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Không tìm thấy lớp học"));

        mockMvc.perform(get("/api/teacher/classrooms/{id}", classId)
                        .with(user(createStudentUserDetails())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /api/teacher/classrooms/{id}/students - Trả ma trận tiến độ học viên")
    void getClassStudents_whenTeacherOrStudent_returns200Or403() throws Exception {
        UUID classId = UUID.fromString("88888888-8888-8888-8888-888888888888");
        StudentProgressResponse sp = StudentProgressResponse.builder()
                .studentId(studentId)
                .fullName("Le Minh")
                .email("minh@test.com")
                .completedTasks(3)
                .totalTasks(4)
                .completionRate(75)
                .attendanceRate(75)
                .averageScore(8.8)
                .totalStudyMinutes(90)
                .dailyProgressDetails(List.of(
                        StudentProgressResponse.DailyProgressDetail.builder()
                                .date("Day 1")
                                .completedTasks(3)
                                .studyMinutes(90)
                                .score(8.8)
                                .build()))
                .build();

        when(classroomService.getClassroomById(classId)).thenReturn(
                ClassroomResponse.builder().id(classId).teacherId(teacherId).build());
        when(classroomService.getClassStudentsProgress(classId)).thenReturn(List.of(sp));

        mockMvc.perform(get("/api/teacher/classrooms/{id}/students", classId)
                        .with(user(createTeacherUserDetails())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].fullName").value("Le Minh"))
                .andExpect(jsonPath("$.data[0].averageScore").value(8.8))
                .andExpect(jsonPath("$.data[0].dailyProgressDetails[0].date").value("Day 1"));

        mockMvc.perform(get("/api/teacher/classrooms/{id}/students", classId)
                        .with(user(createStudentUserDetails())))
                .andExpect(status().isForbidden());
    }

    private CustomUserDetails createAdminUserDetails() {
        User admin = User.builder()
                .id(UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"))
                .email("admin@englishlearning.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_ADMIN).build()))
                .build();
        return new CustomUserDetails(admin);
    }

    @Test
    @DisplayName("GET /api/teacher/classrooms/{id} - Giảng viên xem lớp của người khác -> Trả về 403 Forbidden")
    void getClassDetail_teacherDoesNotOwnClassroom_returns403() throws Exception {
        UUID classId = UUID.fromString("88888888-8888-8888-8888-888888888888");
        UUID otherTeacherId = UUID.fromString("99999999-8888-7777-6666-555555555555");
        ClassroomResponse otherClass = ClassroomResponse.builder()
                .id(classId)
                .name("Other Teacher Class")
                .teacherId(otherTeacherId)
                .build();
        when(classroomService.getClassroomById(classId)).thenReturn(otherClass);

        mockMvc.perform(get("/api/teacher/classrooms/{id}", classId)
                        .with(user(createTeacherUserDetails())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("GET /api/teacher/classrooms/{id} - ADMIN xem được bất kỳ lớp nào -> Trả về 200 OK")
    void getClassDetail_adminAccessesAnyClassroom_returns200() throws Exception {
        UUID classId = UUID.fromString("88888888-8888-8888-8888-888888888888");
        UUID otherTeacherId = UUID.fromString("99999999-8888-7777-6666-555555555555");
        ClassroomResponse otherClass = ClassroomResponse.builder()
                .id(classId)
                .name("Other Teacher Class")
                .teacherId(otherTeacherId)
                .build();
        when(classroomService.getClassroomById(classId)).thenReturn(otherClass);

        mockMvc.perform(get("/api/teacher/classrooms/{id}", classId)
                        .with(user(createAdminUserDetails())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Other Teacher Class"));
    }

    @Test
    @DisplayName("GET /api/teacher/classrooms/{id} - Principal không phải CustomUserDetails -> Trả về 401 Unauthorized")
    void getClassDetail_principalNotCustomUserDetails_returns401() throws Exception {
        UUID classId = UUID.fromString("88888888-8888-8888-8888-888888888888");

        mockMvc.perform(get("/api/teacher/classrooms/{id}", classId)
                        .with(user("plainTeacher").roles("TEACHER")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("GET /api/teacher/classrooms/{id}/students - Giảng viên xem tiến độ lớp không phải mình dạy -> Trả về 403 và không query tiến độ")
    void getClassStudents_teacherDoesNotOwnClassroom_returns403() throws Exception {
        UUID classId = UUID.fromString("88888888-8888-8888-8888-888888888888");
        UUID otherTeacherId = UUID.fromString("99999999-8888-7777-6666-555555555555");
        ClassroomResponse otherClass = ClassroomResponse.builder()
                .id(classId)
                .teacherId(otherTeacherId)
                .build();
        when(classroomService.getClassroomById(classId)).thenReturn(otherClass);

        mockMvc.perform(get("/api/teacher/classrooms/{id}/students", classId)
                        .with(user(createTeacherUserDetails())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        verify(classroomService, never()).getClassStudentsProgress(any());
    }

    @Test
    @DisplayName("GET /api/teacher/classrooms/{id}/students - ADMIN xem tiến độ học viên mọi lớp -> Trả về 200 OK")
    void getClassStudents_adminAccessesAnyClassroom_returns200() throws Exception {
        UUID classId = UUID.fromString("88888888-8888-8888-8888-888888888888");
        UUID otherTeacherId = UUID.fromString("99999999-8888-7777-6666-555555555555");
        when(classroomService.getClassroomById(classId))
                .thenReturn(ClassroomResponse.builder().id(classId).teacherId(otherTeacherId).build());
        when(classroomService.getClassStudentsProgress(classId)).thenReturn(List.of());

        mockMvc.perform(get("/api/teacher/classrooms/{id}/students", classId)
                        .with(user(createAdminUserDetails())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200));
    }

    @Test
    @DisplayName("GET /api/teacher/classrooms/{id}/students - Lớp không tồn tại -> Trả về 404 Not Found")
    void getClassStudents_classroomNotFound_returns404() throws Exception {
        UUID missingId = UUID.fromString("99999999-9999-9999-9999-999999999999");
        when(classroomService.getClassroomById(missingId))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy lớp học"));

        mockMvc.perform(get("/api/teacher/classrooms/{id}/students", missingId)
                        .with(user(createTeacherUserDetails())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));

        verify(classroomService, never()).getClassStudentsProgress(any());
    }

    @Test
    @DisplayName("GET /api/teacher/classrooms/{id}/students - Principal không phải CustomUserDetails -> Trả về 401 Unauthorized")
    void getClassStudents_principalNotCustomUserDetails_returns401() throws Exception {
        UUID classId = UUID.fromString("88888888-8888-8888-8888-888888888888");

        mockMvc.perform(get("/api/teacher/classrooms/{id}/students", classId)
                        .with(user("plainTeacher").roles("TEACHER")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }
}
