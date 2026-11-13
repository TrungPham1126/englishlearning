package com.englishlearning.classroom.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.classroom.dto.MyCourseResponse;
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

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = StudentClassroomController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("StudentClassroomController - Khóa học của tôi & Rời lớp học")
class StudentClassroomControllerTest {

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

    private final UUID studentId = UUID.fromString("11111111-aaaa-bbbb-cccc-111111111111");
    private final UUID teacherId = UUID.fromString("22222222-aaaa-bbbb-cccc-222222222222");
    private final UUID classId = UUID.fromString("33333333-aaaa-bbbb-cccc-333333333333");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User u = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@test.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("GET /api/student/classrooms/my-courses - STUDENT nhận danh sách khóa học kèm tiến độ")
    void getMyCourses_whenStudent_returnsCourses() throws Exception {
        MyCourseResponse course = MyCourseResponse.builder()
                .classId(classId)
                .className("TOEIC 750")
                .level(ClassLevel.TOEIC_PREP)
                .status(ClassStatus.IN_PROGRESS)
                .teacherName("Ms. Hoa")
                .enrolledAt(Instant.now())
                .progressPercentage(75.0)
                .completedLessons(3)
                .totalLessons(4)
                .completedTasks(6)
                .totalTasks(8)
                .build();

        when(classroomService.getStudentCourses(studentId)).thenReturn(List.of(course));

        mockMvc.perform(get("/api/student/classrooms/my-courses")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data[0].classId").value(classId.toString()))
                .andExpect(jsonPath("$.data[0].progressPercentage").value(75.0))
                .andExpect(jsonPath("$.data[0].completedTasks").value(6));
    }

    @Test
    @DisplayName("GET /api/student/classrooms/my-courses - TEACHER bị 403, chưa đăng nhập bị 401")
    void getMyCourses_whenForbiddenOrUnauthenticated_returns403And401() throws Exception {
        mockMvc.perform(get("/api/student/classrooms/my-courses")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/student/classrooms/my-courses"))
                .andExpect(status().isUnauthorized());

        // Non-CustomUserDetails principal -> @AuthenticationPrincipal CustomUserDetails == null -> 401
        mockMvc.perform(get("/api/student/classrooms/my-courses")
                        .with(user("plainUser").roles("STUDENT")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/student/classrooms/{id}/leave - Rời lớp thành công trả 200")
    void leaveClass_whenEnrolled_returnsOk() throws Exception {
        doNothing().when(classroomService).leaveClass(classId, studentId);

        mockMvc.perform(post("/api/student/classrooms/{id}/leave", classId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã rời lớp học"));

        verify(classroomService).leaveClass(classId, studentId);
    }

    @Test
    @DisplayName("POST /api/student/classrooms/{id}/leave - Chưa ghi danh trả 404, non-CustomUserDetails trả 401")
    void leaveClass_whenNotEnrolledOrMissingPrincipal_returns404And401() throws Exception {
        doThrow(new ResourceNotFoundException("Không tìm thấy thông tin ghi danh"))
                .when(classroomService).leaveClass(classId, studentId);

        mockMvc.perform(post("/api/student/classrooms/{id}/leave", classId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Không tìm thấy thông tin ghi danh"));

        mockMvc.perform(post("/api/student/classrooms/{id}/leave", classId)
                        .with(user("plainUser").roles("STUDENT"))
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }
}
