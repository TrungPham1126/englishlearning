package com.englishlearning.notification.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.ForbiddenException;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.notification.dto.NotificationClassroomDto;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.dto.NotificationRecipientDto;
import com.englishlearning.notification.entity.Notification;
import com.englishlearning.notification.entity.NotificationType;
import com.englishlearning.notification.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(NotificationController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
public class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NotificationService notificationService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private UUID studentId;
    private CustomUserDetails customStudentDetails;
    private UUID adminId;
    private CustomUserDetails customAdminDetails;

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());

        studentId = UUID.fromString("11111111-2222-3333-4444-555555555555");
        customStudentDetails = new CustomUserDetails(User.builder()
                .id(studentId)
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build());

        adminId = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        customAdminDetails = new CustomUserDetails(User.builder()
                .id(adminId)
                .email("admin@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_ADMIN).build()))
                .build());
    }

    // =========================================================================
    // ENDPOINT TEST: GET /api/v1/notifications
    // =========================================================================
    @Test
    @DisplayName("GET /api/v1/notifications: Lấy thông báo cá nhân với CustomUserDetails -> Trả về 200 OK")
    void getNotifications_whenAuthenticatedWithCustomPrincipal_returnsMyNotifications() throws Exception {
        Notification myNotif = Notification.builder()
                .id(UUID.randomUUID())
                .title("Điểm mới")
                .message("Bạn đạt 9.0")
                .type(NotificationType.NEW_GRADE)
                .isRead(false)
                .build();
        when(notificationService.getMyNotifications(studentId, 0, 30))
                .thenReturn(new PageImpl<>(List.of(myNotif), PageRequest.of(0, 30), 1));

        mockMvc.perform(get("/api/v1/notifications")
                        .with(user(customStudentDetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.content[0].title").value("Điểm mới"));
    }

    @Test
    @DisplayName("GET /api/v1/notifications?classId=... -> Ủy quyền lấy thông báo lớp học")
    void getNotifications_withClassIdParam_returnsClassroomAnnouncements() throws Exception {
        UUID classId = UUID.randomUUID();
        Notification ann = Notification.builder()
                .id(UUID.randomUUID())
                .title("Thông báo lớp")
                .classroomId(classId)
                .type(NotificationType.ANNOUNCEMENT)
                .build();
        when(notificationService.getClassroomAnnouncements(classId, 1, 10))
                .thenReturn(new PageImpl<>(List.of(ann), PageRequest.of(1, 10), 1));

        mockMvc.perform(get("/api/v1/notifications")
                        .param("classId", classId.toString())
                        .param("page", "1")
                        .param("size", "10")
                        .with(user(customStudentDetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].classroomId").value(classId.toString()));
    }

    @Test
    @WithMockUser
    @DisplayName("GET /api/v1/notifications khi Principal không phải CustomUserDetails -> Trả về 401 thay vì NPE")
    void getNotifications_whenNullCustomUserDetails_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/notifications"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("GET /api/v1/notifications khi chưa đăng nhập -> Trả về 401")
    void getNotifications_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/notifications"))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // ENDPOINT TEST: POST /api/v1/notifications/broadcast
    // =========================================================================
    @Test
    @WithMockUser(roles = {"TEACHER"})
    @DisplayName("Teacher phát thông báo lớp -> Trả về 200 OK")
    void testTeacherBroadcastAnnouncement() throws Exception {
        UUID classId = UUID.randomUUID();
        NotificationDto dto = NotificationDto.builder()
                .classroomId(classId)
                .title("[Test] Lịch học bù")
                .message("Nội dung học bù tuần này...")
                .notificationType("ANNOUNCEMENT")
                .build();

        mockMvc.perform(post("/api/v1/notifications/broadcast")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Phát thông báo thành công"));

        verify(notificationService, times(1)).dispatchNotification(any(NotificationDto.class));
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("Admin phát thông báo toàn hệ thống -> Trả về 200 OK")
    void testAdminBroadcastSystemAlert() throws Exception {
        NotificationDto dto = NotificationDto.builder()
                .title("[Hệ thống] Bảo trì máy chủ")
                .message("Bảo trì nâng cấp lúc 23:00")
                .notificationType("SYSTEM_ALERT")
                .targetAudience("ALL")
                .targetUrl("/student/courses")
                .build();

        mockMvc.perform(post("/api/v1/notifications/broadcast")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Phát thông báo thành công"));

        verify(notificationService, times(1)).dispatchNotification(any(NotificationDto.class));
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("POST /broadcast khi actionType trống -> Tự động gán 'TEXT_ANNOUNCEMENT'")
    void broadcastNotification_whenActionTypeBlank_defaultsToTextAnnouncement() throws Exception {
        String bodyJson = """
                {
                  "title": "Bảo trì hệ thống",
                  "message": "Nội dung thông báo",
                  "actionType": "   "
                }
                """;

        mockMvc.perform(post("/api/v1/notifications/broadcast")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200));

        ArgumentCaptor<NotificationDto> captor = ArgumentCaptor.forClass(NotificationDto.class);
        verify(notificationService).dispatchNotification(captor.capture());
        assertThat(captor.getValue().getActionType()).isEqualTo("TEXT_ANNOUNCEMENT");
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("POST /broadcast khi service ném lỗi -> Controller bắt và trả HTTP 500 ApiResponse.error")
    void broadcastNotification_whenServiceThrowsException_returns500() throws Exception {
        doThrow(new RuntimeException("DB connection lost"))
                .when(notificationService).dispatchNotification(any(NotificationDto.class));

        String bodyJson = """
                {
                  "title": "Test",
                  "message": "Msg"
                }
                """;

        mockMvc.perform(post("/api/v1/notifications/broadcast")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.message").value("Lỗi khi phát thông báo: DB connection lost"));
    }

    @Test
    @WithMockUser(roles = {"STUDENT"})
    @DisplayName("POST /broadcast với vai trò STUDENT -> Trả về 403 Forbidden")
    void broadcastNotification_asStudent_returns403Forbidden() throws Exception {
        String bodyJson = """
                {
                  "title": "Unauthorized",
                  "message": "Blocked"
                }
                """;

        mockMvc.perform(post("/api/v1/notifications/broadcast")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyJson))
                .andExpect(status().isForbidden());

        verifyNoInteractions(notificationService);
    }

    // =========================================================================
    // ENDPOINT TEST: CLASSROOM ANNOUNCEMENTS, HISTORY, RECIPIENTS, CLASSROOMS
    // =========================================================================
    @Test
    @WithMockUser(roles = {"STUDENT"})
    @DisplayName("Lấy danh sách thông báo của lớp học -> Trả về 200 OK và danh sách")
    void testGetClassroomAnnouncements() throws Exception {
        UUID classId = UUID.randomUUID();
        Notification ann = Notification.builder()
                .id(UUID.randomUUID())
                .title("Lịch kiểm tra")
                .message("Thứ 4 tuần tới kiểm tra Listening")
                .classroomId(classId)
                .type(NotificationType.ANNOUNCEMENT)
                .build();

        when(notificationService.getClassroomAnnouncements(eq(classId), anyInt(), anyInt()))
                .thenReturn(new PageImpl<>(List.of(ann), PageRequest.of(0, 10), 1));

        mockMvc.perform(get("/api/v1/notifications/classrooms/" + classId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.content[0].title").value("Lịch kiểm tra"))
                .andExpect(jsonPath("$.data.content[0].classroomId").value(classId.toString()));
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("Admin lấy lịch sử broadcast -> Trả về 200 OK")
    void testGetBroadcastHistory() throws Exception {
        Notification sysNotif = Notification.builder()
                .id(UUID.randomUUID())
                .title("Thông báo bảo trì")
                .type(NotificationType.SYSTEM_ALERT)
                .build();

        when(notificationService.getBroadcastHistory(nullable(UUID.class), anyInt(), anyInt()))
                .thenReturn(new PageImpl<>(List.of(sysNotif), PageRequest.of(0, 10), 1));

        mockMvc.perform(get("/api/v1/notifications/broadcast-history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.content[0].title").value("Thông báo bảo trì"));
    }

    @Test
    @WithMockUser(roles = {"STUDENT"})
    @DisplayName("GET /broadcast-history với vai trò STUDENT -> Trả về 403 Forbidden")
    void getBroadcastHistory_asStudent_returns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/notifications/broadcast-history"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = {"TEACHER"})
    @DisplayName("GET /recipients: TEACHER tìm kiếm người nhận -> Trả về 200 OK")
    void searchRecipients_asTeacher_returns200() throws Exception {
        NotificationRecipientDto recipient = NotificationRecipientDto.builder()
                .id(studentId)
                .fullName("Nguyen Minh")
                .email("minh@elp.edu.vn")
                .role("ROLE_STUDENT")
                .build();
        when(notificationService.searchRecipients("minh", "STUDENT")).thenReturn(List.of(recipient));

        mockMvc.perform(get("/api/v1/notifications/recipients")
                        .param("query", "minh")
                        .param("role", "STUDENT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data[0].fullName").value("Nguyen Minh"));
    }

    @Test
    @DisplayName("GET /classrooms: ADMIN lấy danh sách lớp phát thông báo -> Trả về 200 OK")
    void getAvailableClassrooms_asAdmin_returns200() throws Exception {
        NotificationClassroomDto classroomDto = NotificationClassroomDto.builder()
                .id(UUID.randomUUID())
                .name("Speaking Master")
                .joinCode("SPK01")
                .teacherName("Le Hoa")
                .studentCount(25)
                .build();
        when(notificationService.getAvailableClassrooms(adminId)).thenReturn(List.of(classroomDto));

        mockMvc.perform(get("/api/v1/notifications/classrooms")
                        .with(user(customAdminDetails)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data[0].name").value("Speaking Master"))
                .andExpect(jsonPath("$.data[0].studentCount").value(25));
    }

    @Test
    @WithMockUser(roles = {"STUDENT"})
    @DisplayName("GET /recipients và /classrooms với vai trò STUDENT -> Trả về 403 Forbidden")
    void recipientsAndClassrooms_asStudent_return403() throws Exception {
        mockMvc.perform(get("/api/v1/notifications/recipients")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/notifications/classrooms")).andExpect(status().isForbidden());
    }

    // =========================================================================
    // ENDPOINT TEST: MARK AS READ & MARK ALL AS READ
    // =========================================================================
    @Test
    @DisplayName("PATCH/PUT /{id}/read: Đánh dấu đã đọc thành công -> Trả về 200 OK")
    void markAsRead_withPatchAndPut_returns200() throws Exception {
        UUID notifId = UUID.randomUUID();

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", notifId)
                        .with(user(customStudentDetails))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Đã đọc"));

        mockMvc.perform(put("/api/v1/notifications/{id}/read", notifId)
                        .with(user(customStudentDetails))
                        .with(csrf()))
                .andExpect(status().isOk());

        verify(notificationService, times(2)).markAsRead(notifId, studentId);
    }

    @Test
    @DisplayName("PATCH /{id}/read: Không tìm thấy hoặc không phải chủ sở hữu -> Trả về 404 và 403")
    void markAsRead_whenNotFoundOrForbidden_returns404And403() throws Exception {
        UUID missingId = UUID.randomUUID();
        UUID forbiddenId = UUID.randomUUID();

        doThrow(new ResourceNotFoundException("Không tìm thấy thông báo"))
                .when(notificationService).markAsRead(missingId, studentId);
        doThrow(new ForbiddenException("Không có quyền truy cập"))
                .when(notificationService).markAsRead(forbiddenId, studentId);

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", missingId)
                        .with(user(customStudentDetails))
                        .with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", forbiddenId)
                        .with(user(customStudentDetails))
                        .with(csrf()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("PATCH/PUT /read-all: Đánh dấu đọc tất cả thành công -> Trả về 200 OK")
    void markAllAsRead_withPatchAndPut_returns200() throws Exception {
        mockMvc.perform(patch("/api/v1/notifications/read-all")
                        .with(user(customStudentDetails))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Đã đọc tất cả"));

        mockMvc.perform(put("/api/v1/notifications/read-all")
                        .with(user(customStudentDetails))
                        .with(csrf()))
                .andExpect(status().isOk());

        verify(notificationService, times(2)).markAllAsRead(studentId);
    }

    @Test
    @DisplayName("POST /self: Tự gán recipientUserId theo user đang đăng nhập và dispatch thành công -> 200 OK")
    void sendSelfNotification_authenticatedUser_setsRecipientAndDispatches() throws Exception {
        String body = """
                {
                  "title": "Gán bài tập vào lộ trình thành công",
                  "message": "Đã gán Unit 1 vào Ngày 5.",
                  "notificationType": "ANNOUNCEMENT"
                }
                """;

        mockMvc.perform(post("/api/v1/notifications/self")
                        .with(user(customStudentDetails))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Đã tạo thông báo cá nhân"));

        verify(notificationService, times(1)).dispatchNotification(argThat(dto ->
                studentId.equals(dto.getRecipientUserId())
                        && "Gán bài tập vào lộ trình thành công".equals(dto.getTitle())
        ));
    }

    @Test
    @DisplayName("POST /self: Chưa đăng nhập -> Từ chối 401/403")
    void sendSelfNotification_unauthenticated_returnsUnauthorizedOrForbidden() throws Exception {
        mockMvc.perform(post("/api/v1/notifications/self")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Test\"}"))
                .andExpect(status().is4xxClientError());

        verifyNoInteractions(notificationService);
    }

    @Test
    @WithMockUser(roles = {"STUDENT"})
    @DisplayName("POST /self, PATCH /{id}/read, PATCH /read-all khi Principal không phải CustomUserDetails -> Trả về 401; POST /self lỗi service -> 500")
    void endpointsRequiringCustomUserDetails_handleNullPrincipalAndSelfServiceError() throws Exception {
        UUID notifId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/notifications/self")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Test\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", notifId).with(csrf()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(patch("/api/v1/notifications/read-all").with(csrf()))
                .andExpect(status().isUnauthorized());

        // POST /self với CustomUserDetails khi service ném lỗi -> trả về 500 ApiResponse.error
        doThrow(new RuntimeException("Queue write error"))
                .when(notificationService).dispatchNotification(any(NotificationDto.class));

        mockMvc.perform(post("/api/v1/notifications/self")
                        .with(user(customStudentDetails))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Self\",\"actionType\":\"CUSTOM_ACTION\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.message").value("Lỗi khi tạo thông báo cá nhân: Queue write error"));
    }
}
