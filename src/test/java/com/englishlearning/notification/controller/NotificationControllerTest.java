package com.englishlearning.notification.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.entity.Notification;
import com.englishlearning.notification.entity.NotificationType;
import com.englishlearning.notification.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(NotificationController.class)
@AutoConfigureMockMvc
public class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NotificationService notificationService;

    // Mock beans required by security filters if any
    @MockBean
    private com.englishlearning.auth.service.JwtService jwtService;

    @MockBean
    private org.springframework.security.core.userdetails.UserDetailsService userDetailsService;

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

    // =========================================================================
    // ENDPOINT TEST: GET /api/v1/notifications/classrooms/{classId}
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

    // =========================================================================
    // ENDPOINT TEST: GET /api/v1/notifications/broadcast-history
    // =========================================================================
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
}
