package com.englishlearning.classroom.controller;

import com.englishlearning.analytics.dto.ClassroomPurgeResultDto;
import com.englishlearning.analytics.service.AdminDatabaseService;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.classroom.dto.*;
import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.ResourceNotFoundException;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminClassroomController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AdminClassroomController - Quản lý lớp học Admin & Phân quyền")
class AdminClassroomControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ClassroomService classroomService;

    @MockBean
    private AdminDatabaseService adminDatabaseService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID adminId = UUID.fromString("aaaaaaaa-1111-2222-3333-444444444444");
    private final UUID classId = UUID.fromString("bbbbbbbb-1111-2222-3333-444444444444");
    private final UUID teacherId = UUID.fromString("cccccccc-1111-2222-3333-444444444444");
    private final UUID studentId = UUID.fromString("dddddddd-1111-2222-3333-444444444444");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, String email, RoleName roleName) {
        User u = User.builder()
                .id(id)
                .email(email)
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    private ClassroomResponse sampleClassroom() {
        return ClassroomResponse.builder()
                .id(classId)
                .name("IELTS Mastery")
                .description("Band 7.5")
                .level(ClassLevel.B2)
                .status(ClassStatus.PLANNING)
                .maxStudents(25)
                .joinCode("ENG-ABC123")
                .currentStudentsCount(3)
                .teacherId(teacherId)
                .teacherName("Nguyen Minh")
                .build();
    }

    @Test
    @DisplayName("POST /api/admin/classrooms - ADMIN tạo lớp thành công trả 200")
    void createClassroom_whenAdminAndValidRequest_returnsOk() throws Exception {
        when(classroomService.createClassroom(any(CreateClassroomRequest.class))).thenReturn(sampleClassroom());

        String body = """
                {
                  "name": "IELTS Mastery",
                  "description": "Band 7.5",
                  "level": "B2",
                  "maxStudents": 25,
                  "teacherId": "cccccccc-1111-2222-3333-444444444444"
                }
                """;

        mockMvc.perform(post("/api/admin/classrooms")
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Tạo lớp học thành công"))
                .andExpect(jsonPath("$.data.id").value(classId.toString()))
                .andExpect(jsonPath("$.data.joinCode").value("ENG-ABC123"));

        ArgumentCaptor<CreateClassroomRequest> captor = ArgumentCaptor.forClass(CreateClassroomRequest.class);
        verify(classroomService).createClassroom(captor.capture());
        assertThat(captor.getValue().getName()).isEqualTo("IELTS Mastery");
        assertThat(captor.getValue().getLevel()).isEqualTo(ClassLevel.B2);
        assertThat(captor.getValue().getTeacherId()).isEqualTo(teacherId);
    }

    @Test
    @DisplayName("POST /api/admin/classrooms - Validation lỗi khi thiếu name và level trả 400")
    void createClassroom_whenMissingNameOrLevel_returns400() throws Exception {
        String body = """
                {
                  "name": "",
                  "level": null
                }
                """;

        mockMvc.perform(post("/api/admin/classrooms")
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.name").exists())
                .andExpect(jsonPath("$.validationErrors.level").exists());

        verifyNoInteractions(classroomService);
    }

    @Test
    @DisplayName("POST /api/admin/classrooms - TEACHER hoặc STUDENT bị chặn 403 Forbidden")
    void createClassroom_whenTeacherOrStudent_returns403() throws Exception {
        String body = """
                {
                  "name": "IELTS Mastery",
                  "level": "B2"
                }
                """;

        mockMvc.perform(post("/api/admin/classrooms")
                        .with(user(userWithRole(teacherId, "teacher@test.com", RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/admin/classrooms")
                        .with(user(userWithRole(studentId, "student@test.com", RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());

        verifyNoInteractions(classroomService);
    }

    @Test
    @DisplayName("GET /api/admin/classrooms - Chưa đăng nhập trả 401")
    void getAllClassrooms_whenUnauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/admin/classrooms"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/admin/classrooms - Lọc theo status và phân trang trả PageResponse")
    void getAllClassrooms_withStatusFilter_returnsPagedClassrooms() throws Exception {
        PageResponse<ClassroomResponse> page = PageResponse.<ClassroomResponse>builder()
                .content(List.of(sampleClassroom()))
                .pageNumber(0)
                .pageSize(10)
                .totalElements(1)
                .totalPages(1)
                .last(true)
                .build();

        when(classroomService.getAllClassrooms(eq(ClassStatus.OPEN), any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/admin/classrooms")
                        .param("status", "OPEN")
                        .param("page", "0")
                        .param("size", "10")
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value(classId.toString()))
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    @DisplayName("GET /api/admin/classrooms/{id} - Trả chi tiết lớp học hoặc 404")
    void getClassDetail_returnsDetailOr404() throws Exception {
        when(classroomService.getClassroomById(classId)).thenReturn(sampleClassroom());

        mockMvc.perform(get("/api/admin/classrooms/{id}", classId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("IELTS Mastery"));

        UUID missingId = UUID.randomUUID();
        when(classroomService.getClassroomById(missingId))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy lớp học"));

        mockMvc.perform(get("/api/admin/classrooms/{id}", missingId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Không tìm thấy lớp học"));
    }

    @Test
    @DisplayName("GET /api/admin/classrooms/{id}/students - Trả danh sách tiến độ học viên")
    void getClassStudents_returnsProgressList() throws Exception {
        StudentProgressResponse sp = StudentProgressResponse.builder()
                .studentId(studentId)
                .fullName("Tran An")
                .email("an@test.com")
                .completedTasks(2)
                .totalTasks(4)
                .attendanceRate(50)
                .averageScore(8.5)
                .build();
        when(classroomService.getClassStudentsProgress(classId)).thenReturn(List.of(sp));

        mockMvc.perform(get("/api/admin/classrooms/{id}/students", classId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].studentId").value(studentId.toString()))
                .andExpect(jsonPath("$.data[0].averageScore").value(8.5));
    }

    @Test
    @DisplayName("DELETE /api/admin/classrooms/{id}/students/{studentId} - Xóa học viên khỏi lớp")
    void removeStudentFromClass_returnsOk() throws Exception {
        doNothing().when(classroomService).leaveClass(classId, studentId);

        mockMvc.perform(delete("/api/admin/classrooms/{id}/students/{studentId}", classId, studentId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã xóa học viên khỏi lớp học"));

        verify(classroomService).leaveClass(classId, studentId);
    }

    @Test
    @DisplayName("PUT /api/admin/classrooms/{id}/status - Cập nhật trạng thái lớp học")
    void updateStatus_whenValidAndInvalid_behavesCorrectly() throws Exception {
        ClassroomResponse updated = sampleClassroom();
        updated.setStatus(ClassStatus.OPEN);
        when(classroomService.updateClassStatus(eq(classId), any(UpdateClassStatusRequest.class)))
                .thenReturn(updated);

        mockMvc.perform(put("/api/admin/classrooms/{id}/status", classId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "status": "OPEN" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("OPEN"));

        mockMvc.perform(put("/api/admin/classrooms/{id}/status", classId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "status": null }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.status").exists());
    }

    @Test
    @DisplayName("PUT /api/admin/classrooms/{id}/assign-teacher - Gán giảng viên hợp lệ và validate null")
    void assignTeacher_whenValidAndNull_behavesCorrectly() throws Exception {
        when(classroomService.assignTeacher(eq(classId), any(AssignTeacherRequest.class)))
                .thenReturn(sampleClassroom());

        mockMvc.perform(put("/api/admin/classrooms/{id}/assign-teacher", classId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "teacherId": "cccccccc-1111-2222-3333-444444444444" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.teacherId").value(teacherId.toString()));

        mockMvc.perform(put("/api/admin/classrooms/{id}/assign-teacher", classId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.teacherId").exists());
    }

    @Test
    @DisplayName("POST /api/admin/classrooms/{id}/enroll - Ghi danh học viên và xử lý lỗi nghiệp vụ")
    void enrollStudent_whenValidAndDuplicate_behavesCorrectly() throws Exception {
        doNothing().when(classroomService).enrollStudent(eq(classId), any(EnrollStudentRequest.class));

        mockMvc.perform(post("/api/admin/classrooms/{id}/enroll", classId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "studentIdentifier": "an@test.com" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Ghi danh học viên vào lớp thành công"));

        doThrow(new BadRequestException("Học viên đã tham gia lớp học này rồi"))
                .when(classroomService).enrollStudent(eq(classId), any(EnrollStudentRequest.class));

        mockMvc.perform(post("/api/admin/classrooms/{id}/enroll", classId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "studentIdentifier": "an@test.com" }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Học viên đã tham gia lớp học này rồi"));
    }

    @Test
    @DisplayName("DELETE /api/admin/classrooms/{id} - ADMIN xóa vĩnh viễn lớp qua AdminDatabaseService")
    void deleteClassroom_whenAdmin_returnsPurgeResult() throws Exception {
        ClassroomPurgeResultDto result = ClassroomPurgeResultDto.builder()
                .classroomId(classId)
                .classroomName("IELTS Mastery")
                .entireClassroomDeleted(true)
                .deletedAttempts(4L)
                .message("Đã xóa hoàn toàn lớp học")
                .executedAt(Instant.now())
                .build();
        when(adminDatabaseService.deleteClassroom(eq(classId), eq(adminId), any())).thenReturn(result);

        mockMvc.perform(delete("/api/admin/classrooms/{id}", classId)
                        .with(user(userWithRole(adminId, "admin@test.com", RoleName.ROLE_ADMIN)))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã xóa hoàn toàn lớp học"))
                .andExpect(jsonPath("$.data.entireClassroomDeleted").value(true));
    }
}
