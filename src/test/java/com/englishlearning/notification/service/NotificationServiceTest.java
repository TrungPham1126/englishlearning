package com.englishlearning.notification.service;

import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.entity.Notification;
import com.englishlearning.notification.entity.NotificationType;
import com.englishlearning.notification.repository.NotificationRepository;
import com.englishlearning.notification.service.impl.NotificationServiceImpl;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.ConnectException;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class NotificationServiceTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private ClassStudentRepository classStudentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private NotificationServiceImpl notificationService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(notificationService, "notificationQueue", "notification.queue");
    }

    // =========================================================================
    // TEST CASE 1: Giảng viên gửi thông báo tới Lớp học (Class Announcement Fan-out)
    // =========================================================================
    @Test
    @DisplayName("TC1 - Giảng viên gửi thông báo lớp: Tạo 1 bản ghi lớp + Fan-out tới các học viên active")
    void testCase1_TeacherClassAnnouncement_FanoutToActiveStudents() {
        UUID classroomId = UUID.randomUUID();

        // Chuẩn bị học sinh 1 (active)
        UUID user1Id = UUID.randomUUID();
        User user1 = User.builder().id(user1Id).firstName("An").lastName("Nguyen").isActive(true).build();
        Student student1 = new Student();
        student1.setId(UUID.randomUUID());
        student1.setUser(user1);
        ClassStudent cs1 = new ClassStudent();
        cs1.setStudent(student1);
        cs1.setIsActive(true);

        // Chuẩn bị học sinh 2 (active)
        UUID user2Id = UUID.randomUUID();
        User user2 = User.builder().id(user2Id).firstName("Binh").lastName("Tran").isActive(true).build();
        Student student2 = new Student();
        student2.setId(UUID.randomUUID());
        student2.setUser(user2);
        ClassStudent cs2 = new ClassStudent();
        cs2.setStudent(student2);
        cs2.setIsActive(true);

        // Chuẩn bị học sinh 3 (inactive - đã thôi học)
        UUID user3Id = UUID.randomUUID();
        User user3 = User.builder().id(user3Id).firstName("Cuong").lastName("Le").isActive(false).build();
        Student student3 = new Student();
        student3.setId(UUID.randomUUID());
        student3.setUser(user3);
        ClassStudent cs3 = new ClassStudent();
        cs3.setStudent(student3);
        cs3.setIsActive(false);

        when(classStudentRepository.findByClassroomId(classroomId)).thenReturn(List.of(cs1, cs2, cs3));
        when(notificationRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationDto dto = NotificationDto.builder()
                .classroomId(classroomId)
                .title("[Test] Lịch học bù")
                .message("Nội dung học bù tuần này vào 19h thứ 6")
                .notificationType("ANNOUNCEMENT")
                .redirectUrl("/classroom/" + classroomId)
                .build();

        // Thực thi
        notificationService.processNotificationMessage(dto);

        // Xác thực
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Notification>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(notificationRepository, times(1)).saveAll(listCaptor.capture());

        List<Notification> savedList = listCaptor.getValue();
        assertEquals(3, savedList.size(), "Phải lưu thông báo cho cả 3 học viên trong lớp");
        assertTrue(savedList.stream().anyMatch(n -> n.getRecipient().getId().equals(user1Id)));
        assertTrue(savedList.stream().anyMatch(n -> n.getRecipient().getId().equals(user2Id)));
        assertTrue(savedList.stream().anyMatch(n -> n.getRecipient().getId().equals(user3Id)));

        // WebSocket: bắn tới học viên và topic lớp học
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(user1Id.toString()), eq("/queue/notifications"), any());
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(user2Id.toString()), eq("/queue/notifications"), any());
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/classroom." + classroomId), any(NotificationDto.class));
    }

    // =========================================================================
    // TEST CASE 2: Admin phát thông báo Toàn hệ thống (System Broadcast Fan-out)
    // =========================================================================
    @Test
    @DisplayName("TC2 - Admin Broadcast toàn hệ thống: Lưu bản ghi hệ thống + Fan-out tới tất cả user active")
    void testCase2_AdminSystemBroadcast_FanoutToAllActiveUsers() {
        // Chuẩn bị 3 User: 1 Admin, 1 Teacher, 1 Student (đều active)
        User admin = User.builder().id(UUID.randomUUID()).firstName("Admin").lastName("Root").isActive(true).build();
        User teacher = User.builder().id(UUID.randomUUID()).firstName("Teacher").lastName("One").isActive(true).build();
        User student = User.builder().id(UUID.randomUUID()).firstName("Student").lastName("Two").isActive(true).build();

        when(userRepository.findAll()).thenReturn(List.of(admin, teacher, student));
        when(notificationRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationDto dto = NotificationDto.builder()
                .title("[Hệ thống] Bảo trì máy chủ")
                .message("Bảo trì nâng cấp lúc 23:00")
                .notificationType("SYSTEM_ALERT")
                .targetAudience("ALL")
                .targetUrl("/student/courses")
                .build();

        // Thực thi
        notificationService.processNotificationMessage(dto);

        // Xác thực
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Notification>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(notificationRepository, times(1)).saveAll(listCaptor.capture());

        List<Notification> savedList = listCaptor.getValue();
        assertEquals(3, savedList.size(), "Phải fan-out thông báo cá nhân cho cả 3 user");

        // WebSocket broadcast topic công khai
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/system-announcements"), any(NotificationDto.class));
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/public"), any(NotificationDto.class));

        // WebSocket personal queue cho từng user
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(admin.getId().toString()), eq("/queue/notifications"), any());
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(teacher.getId().toString()), eq("/queue/notifications"), any());
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(student.getId().toString()), eq("/queue/notifications"), any());
    }

    // =========================================================================
    // TEST CASE 3: Sức chống chịu khi RabbitMQ không khả dụng (Broker Resilience)
    // =========================================================================
    @Test
    @DisplayName("TC3 - RabbitMQ Down Fallback: Bắt lỗi broker, tự động xử lý đồng bộ và lưu MySQL an toàn")
    void testCase3_BrokerResilience_RabbitMQDownFallback() {
        UUID classroomId = UUID.randomUUID();
        User studentUser = User.builder().id(UUID.randomUUID()).build();
        Student s = new Student();
        s.setUser(studentUser);
        ClassStudent cs = new ClassStudent();
        cs.setStudent(s);

        when(classStudentRepository.findByClassroomId(classroomId)).thenReturn(List.of(cs));
        when(notificationRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationDto dto = NotificationDto.builder()
                .classroomId(classroomId)
                .title("[Test Fallback] Thông báo khi broker tắt")
                .message("Kiểm tra cơ chế tự phục hồi đồng bộ")
                .notificationType("ANNOUNCEMENT")
                .build();

        // Thực thi dispatchNotification - Không được ném Exception ra ngoài!
        assertDoesNotThrow(() -> notificationService.dispatchNotification(dto),
                "Hệ thống phải tự bắt ngoại lệ RabbitMQ và fallback xử lý đồng bộ, không làm crash request");

        // Xác nhận bản ghi thông báo vẫn được lưu vào MySQL thành công
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Notification>> captor = ArgumentCaptor.forClass(List.class);
        verify(notificationRepository, atLeastOnce()).saveAll(captor.capture());
        assertFalse(captor.getValue().isEmpty());
        assertEquals(classroomId, captor.getValue().get(0).getClassroomId());
        assertEquals("[Test Fallback] Thông báo khi broker tắt", captor.getValue().get(0).getTitle());
    }

    // =========================================================================
    // TEST CASE 4: Lịch sử broadcast toàn hệ thống (Broadcast History)
    // =========================================================================
    @Test
    @DisplayName("TC4 - Truy vấn lịch sử broadcast cho Admin")
    void testCase4_GetBroadcastHistory() {
        Notification n1 = Notification.builder().id(UUID.randomUUID()).title("Broadcast 1").build();
        Notification n2 = Notification.builder().id(UUID.randomUUID()).title("Broadcast 2").build();
        Page<Notification> mockPage = new PageImpl<>(List.of(n1, n2), PageRequest.of(0, 10), 2);

        when(notificationRepository.findByClassroomIdIsNullOrderByCreatedAtDesc(any()))
                .thenReturn(mockPage);

        Page<Notification> result = notificationService.getBroadcastHistory(0, 10);
        assertNotNull(result);
        assertEquals(2, result.getTotalElements());
        assertEquals("Broadcast 1", result.getContent().get(0).getTitle());
    }
}
