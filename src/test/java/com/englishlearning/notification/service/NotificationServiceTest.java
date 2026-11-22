package com.englishlearning.notification.service;

import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.common.exception.ForbiddenException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.notification.dto.NotificationClassroomDto;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.dto.NotificationRecipientDto;
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
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
    private ClassroomRepository classroomRepository;

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
    // TEST CASE 1: Giảng viên gửi thông báo tới Lớp học
    // =========================================================================
    @Test
    @DisplayName("TC1 - Giảng viên gửi thông báo lớp: Lưu cho học viên lớp và bắn WebSocket cá nhân + topic")
    void testCase1_TeacherClassAnnouncement_FanoutToActiveStudents() {
        UUID classroomId = UUID.randomUUID();

        UUID user1Id = UUID.randomUUID();
        User user1 = User.builder().id(user1Id).firstName("An").lastName("Nguyen").isActive(true).build();
        Student student1 = Student.builder().id(UUID.randomUUID()).user(user1).build();
        ClassStudent cs1 = ClassStudent.builder().student(student1).isActive(true).build();

        UUID user2Id = UUID.randomUUID();
        User user2 = User.builder().id(user2Id).firstName("Binh").lastName("Tran").isActive(true).build();
        Student student2 = Student.builder().id(UUID.randomUUID()).user(user2).build();
        ClassStudent cs2 = ClassStudent.builder().student(student2).isActive(true).build();

        UUID user3Id = UUID.randomUUID();
        User user3 = User.builder().id(user3Id).firstName("Cuong").lastName("Le").isActive(false).build();
        Student student3 = Student.builder().id(UUID.randomUUID()).user(user3).build();
        ClassStudent cs3 = ClassStudent.builder().student(student3).isActive(false).build();

        when(classStudentRepository.findByClassroomId(classroomId)).thenReturn(List.of(cs1, cs2, cs3));
        when(notificationRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationDto dto = NotificationDto.builder()
                .classroomId(classroomId)
                .title("[Test] Lịch học bù")
                .message("Nội dung học bù tuần này vào 19h thứ 6")
                .notificationType("ANNOUNCEMENT")
                .redirectUrl("/classroom/" + classroomId)
                .build();

        notificationService.processNotificationMessage(dto);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Notification>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(notificationRepository, times(1)).saveAll(listCaptor.capture());

        List<Notification> savedList = listCaptor.getValue();
        assertEquals(3, savedList.size());
        assertTrue(savedList.stream().anyMatch(n -> n.getRecipient().getId().equals(user1Id)));
        assertTrue(savedList.stream().anyMatch(n -> n.getRecipient().getId().equals(user2Id)));
        assertTrue(savedList.stream().anyMatch(n -> n.getRecipient().getId().equals(user3Id)));

        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(user1Id.toString()), eq("/queue/notifications"), any());
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(user2Id.toString()), eq("/queue/notifications"), any());
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/classroom." + classroomId), any(NotificationDto.class));
    }

    // =========================================================================
    // TEST CASE 2: Admin phát thông báo Toàn hệ thống
    // =========================================================================
    @Test
    @DisplayName("TC2 - Admin Broadcast toàn hệ thống: Lưu bản ghi và Fan-out tới tất cả user active")
    void testCase2_AdminSystemBroadcast_FanoutToAllActiveUsers() {
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

        notificationService.processNotificationMessage(dto);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Notification>> listCaptor = ArgumentCaptor.forClass(List.class);
        verify(notificationRepository, times(1)).saveAll(listCaptor.capture());

        List<Notification> savedList = listCaptor.getValue();
        assertEquals(3, savedList.size());

        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/system-announcements"), any(NotificationDto.class));
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/public"), any(NotificationDto.class));
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(admin.getId().toString()), eq("/queue/notifications"), any());
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(teacher.getId().toString()), eq("/queue/notifications"), any());
        verify(messagingTemplate, times(1)).convertAndSendToUser(eq(student.getId().toString()), eq("/queue/notifications"), any());
    }

    // =========================================================================
    // TEST CASE 3 & 4: Fallback & Broadcast History
    // =========================================================================
    @Test
    @DisplayName("TC3 - Broker Resilience: Lưu MySQL trực tiếp không crash request")
    void testCase3_BrokerResilience_RabbitMQDownFallback() {
        UUID classroomId = UUID.randomUUID();
        User studentUser = User.builder().id(UUID.randomUUID()).build();
        Student s = Student.builder().user(studentUser).build();
        ClassStudent cs = ClassStudent.builder().student(s).build();

        when(classStudentRepository.findByClassroomId(classroomId)).thenReturn(List.of(cs));
        when(notificationRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationDto dto = NotificationDto.builder()
                .classroomId(classroomId)
                .title("[Test Fallback] Thông báo khi broker tắt")
                .message("Kiểm tra cơ chế tự phục hồi đồng bộ")
                .notificationType("ANNOUNCEMENT")
                .build();

        assertDoesNotThrow(() -> notificationService.dispatchNotification(dto));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Notification>> captor = ArgumentCaptor.forClass(List.class);
        verify(notificationRepository, atLeastOnce()).saveAll(captor.capture());
        assertFalse(captor.getValue().isEmpty());
        assertEquals(classroomId, captor.getValue().get(0).getClassroomId());
    }

    @Test
    @DisplayName("TC4 - Truy vấn lịch sử broadcast cho Admin khi adminId null")
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

    // =========================================================================
    // BỔ SUNG ĐẦY ĐỦ TỪNG METHOD & EDGE CASES
    // =========================================================================

    @Test
    @DisplayName("processNotificationMessage: DTO null -> Thoát sớm an toàn không chạm DB hay WebSocket")
    void processNotificationMessage_whenNullDto_doesNothing() {
        notificationService.processNotificationMessage(null);
        verifyNoInteractions(notificationRepository, userRepository, classStudentRepository, messagingTemplate);
    }

    @Test
    @DisplayName("processNotificationMessage (Cá nhân): User tồn tại -> Lưu DB với fallback content/actionType và đẩy WebSocket")
    void processNotificationMessage_personalWhenUserExists_savesAndPushesWebSocket() {
        // Given
        UUID recipientId = UUID.randomUUID();
        User recipient = User.builder().id(recipientId).email("u@elp.edu.vn").build();
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(recipient));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        NotificationDto dto = NotificationDto.builder()
                .recipientUserId(recipientId)
                .title("   ") // Blank -> falls back to "Thông báo hệ thống"
                .message(null)
                .content("Chi tiết điểm bài thi mới") // Fallback from content
                .notificationType("NEW_GRADE")
                .actionType("") // Blank -> falls back to "TEXT_ANNOUNCEMENT"
                .redirectUrl("/grades/1")
                .referenceId("sub-123")
                .build();

        // When
        notificationService.processNotificationMessage(dto);

        // Then
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        Notification saved = captor.getValue();
        assertThat(saved.getTitle()).isEqualTo("Thông báo hệ thống");
        assertThat(saved.getMessage()).isEqualTo("Chi tiết điểm bài thi mới");
        assertThat(saved.getType()).isEqualTo(NotificationType.NEW_GRADE);
        assertThat(saved.getActionType()).isEqualTo("TEXT_ANNOUNCEMENT");
        assertThat(saved.getTargetUrl()).isEqualTo("/grades/1");
        assertThat(saved.getReferenceId()).isEqualTo("sub-123");
        assertThat(saved.getRecipient()).isSameAs(recipient);
        assertThat(saved.getIsRead()).isFalse();

        verify(messagingTemplate).convertAndSendToUser(eq(recipientId.toString()), eq("/queue/notifications"), eq(saved));
        verifyNoInteractions(entityManager);
    }

    @Test
    @DisplayName("processNotificationMessage (Cá nhân): User không tìm thấy trong findById -> Dùng entityManager.getReference và bắt lỗi WebSocket")
    void processNotificationMessage_personalWhenUserNotFoundAndWsFails_usesEntityRefAndCatchesWsError() {
        // Given
        UUID recipientId = UUID.randomUUID();
        User proxyUser = User.builder().id(recipientId).build();
        when(userRepository.findById(recipientId)).thenReturn(Optional.empty());
        when(entityManager.getReference(User.class, recipientId)).thenReturn(proxyUser);
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new MessagingException("WebSocket offline"))
                .when(messagingTemplate).convertAndSendToUser(anyString(), anyString(), any());

        NotificationDto dto = NotificationDto.builder()
                .recipientUserId(recipientId)
                .title("Nhắc nhở")
                .message(null)
                .content(null) // Falls back to safeTitle
                .notificationType("UNKNOWN_TYPE") // Falls back to SYSTEM_ALERT
                .build();

        // When & Then
        assertThatCode(() -> notificationService.processNotificationMessage(dto))
                .doesNotThrowAnyException();

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        assertThat(captor.getValue().getMessage()).isEqualTo("Nhắc nhở");
        assertThat(captor.getValue().getType()).isEqualTo(NotificationType.SYSTEM_ALERT);
        assertThat(captor.getValue().getRecipient()).isSameAs(proxyUser);
    }

    @Test
    @DisplayName("processNotificationMessage (Lớp học): Lớp trống hoặc type lạ -> Mặc định ANNOUNCEMENT và vẫn phát topic lớp dù WebSocket lỗi")
    void processNotificationMessage_classroomWhenEmptyAndWsFails_defaultsTypeAndCatchesTopicError() {
        // Given
        UUID classId = UUID.randomUUID();
        ClassStudent orphanStudent = ClassStudent.builder().student(null).build();
        when(classStudentRepository.findByClassroomId(classId)).thenReturn(List.of(orphanStudent));
        doThrow(new MessagingException("Topic broker down"))
                .when(messagingTemplate).convertAndSend(eq("/topic/classroom." + classId), any(Object.class));

        NotificationDto dto = NotificationDto.builder()
                .classroomId(classId)
                .title("Thông báo lớp")
                .message("Nội dung")
                .notificationType("   ")
                .build();

        // When & Then
        assertThatCode(() -> notificationService.processNotificationMessage(dto))
                .doesNotThrowAnyException();

        verify(notificationRepository, never()).saveAll(anyList());
        verify(messagingTemplate).convertAndSend(eq("/topic/classroom." + classId), eq(dto));
    }

    @Test
    @DisplayName("processNotificationMessage (Broadcast theo Role): Chỉ gửi cho TEACHER đang active khi targetAudience = TEACHER")
    void processNotificationMessage_broadcastWithTargetAudienceTeacher_filtersActiveTeachersOnly() {
        // Given
        Role teacherRole = Role.builder().name(RoleName.ROLE_TEACHER).build();
        Role studentRole = Role.builder().name(RoleName.ROLE_STUDENT).build();

        User activeTeacher = User.builder().id(UUID.randomUUID()).isActive(true).roles(Set.of(teacherRole)).build();
        User inactiveTeacher = User.builder().id(UUID.randomUUID()).isActive(false).roles(Set.of(teacherRole)).build();
        User activeStudent = User.builder().id(UUID.randomUUID()).isActive(true).roles(Set.of(studentRole)).build();

        when(userRepository.findAll()).thenReturn(List.of(activeTeacher, inactiveTeacher, activeStudent));
        when(notificationRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        NotificationDto dto = NotificationDto.builder()
                .title("Họp hội đồng giảng viên")
                .message("Lúc 14h chiều mai")
                .targetAudience("TEACHER")
                .notificationType(null)
                .build();

        // When
        notificationService.processNotificationMessage(dto);

        // Then
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Notification>> captor = ArgumentCaptor.forClass(List.class);
        verify(notificationRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        assertThat(captor.getValue().get(0).getRecipient()).isSameAs(activeTeacher);
        assertThat(captor.getValue().get(0).getType()).isEqualTo(NotificationType.SYSTEM_ALERT);
    }

    @Test
    @DisplayName("processNotificationMessage (Broadcast): Hệ thống chưa có user -> Thoát sớm không lưu hay gửi WebSocket")
    void processNotificationMessage_broadcastWhenNoUsers_returnsEarly() {
        when(userRepository.findAll()).thenReturn(Collections.emptyList());

        NotificationDto dto = NotificationDto.builder().title("Broadcast").message("Empty").build();
        notificationService.processNotificationMessage(dto);

        verify(notificationRepository, never()).saveAll(anyList());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("sendSystemNotification: Cả 4 overload đều tạo DTO chuẩn và lưu thông báo")
    void sendSystemNotification_allOverloads_saveExpectedNotifications() {
        UUID uid = UUID.randomUUID();
        User u = User.builder().id(uid).isActive(true).build();
        when(userRepository.findById(uid)).thenReturn(Optional.of(u));
        when(userRepository.findAll()).thenReturn(List.of(u));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));
        when(notificationRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // 1. Personal 5-arg
        notificationService.sendSystemNotification(uid, "Personal 1", "Msg 1", "VIDEO_APPROVED", "/videos/1");
        // 2. Global 4-arg
        notificationService.sendSystemNotification("Global 1", "Msg 2", "SYSTEM_ALERT", "/home");
        // 3. Personal 7-arg
        notificationService.sendSystemNotification(uid, "Personal 2", "Msg 3", "NEW_ASSIGNMENT", "OPEN_DETAIL", "/assign/9", 99L);
        // 4. Global 6-arg
        notificationService.sendSystemNotification("Global 2", "Msg 4", "ANNOUNCEMENT", "OPEN_MODAL", "/news", "ref-abc");

        verify(notificationRepository, times(2)).save(any(Notification.class));
        verify(notificationRepository, times(2)).saveAll(anyList());
    }

    @Test
    @DisplayName("searchRecipients: Lọc đúng theo query tên/email, role, bỏ qua user inactive và giới hạn tối đa 50")
    void searchRecipients_filtersByQueryRoleActiveStatusAndCapsAt50() {
        Role studentRole = Role.builder().name(RoleName.ROLE_STUDENT).build();
        Role teacherRole = Role.builder().name(RoleName.ROLE_TEACHER).build();

        User matchByName = User.builder()
                .id(UUID.randomUUID()).firstName("Minh").lastName("Nguyen").email("m@elp.edu.vn")
                .isActive(true).roles(Set.of(studentRole)).avatarUrl("/a.png").build();
        User matchByEmailNoName = User.builder()
                .id(UUID.randomUUID()).firstName(null).lastName(null).email("minh.le@elp.edu.vn")
                .isActive(true).roles(Set.of(studentRole)).build();
        User inactiveStudent = User.builder()
                .id(UUID.randomUUID()).firstName("Minh").lastName("Locked").email("locked@elp.edu.vn")
                .isActive(false).roles(Set.of(studentRole)).build();
        User activeTeacher = User.builder()
                .id(UUID.randomUUID()).firstName("Minh").lastName("Teacher").email("t@elp.edu.vn")
                .isActive(true).roles(Set.of(teacherRole)).build();

        List<User> manyUsers = new ArrayList<>(List.of(matchByName, matchByEmailNoName, inactiveStudent, activeTeacher));
        IntStream.range(0, 60).forEach(i -> manyUsers.add(User.builder()
                .id(UUID.randomUUID()).firstName("Minh").lastName("Student" + i).email("s" + i + "@elp.edu.vn")
                .isActive(true).roles(Set.of(studentRole)).build()));

        when(userRepository.findAll()).thenReturn(manyUsers);

        // When
        List<NotificationRecipientDto> results = notificationService.searchRecipients("  MINH ", "STUDENT");

        // Then
        assertThat(results).hasSize(50);
        assertThat(results).extracting(NotificationRecipientDto::getEmail)
                .doesNotContain("locked@elp.edu.vn", "t@elp.edu.vn");
        assertThat(results.get(0).getFullName()).isEqualTo("Nguyen Minh");
        assertThat(results.get(1).getFullName()).isEqualTo("minh.le@elp.edu.vn");
        assertThat(results.get(0).getRole()).isEqualTo("ROLE_STUDENT");
    }

    @Test
    @DisplayName("getAvailableClassrooms: ADMIN thấy tất cả lớp; TEACHER có lớp riêng chỉ thấy lớp mình; TEACHER chưa có lớp fallback lấy tất cả")
    void getAvailableClassrooms_handlesAdminTeacherAndFallbackCases() {
        UUID adminId = UUID.randomUUID();
        UUID teacherWithClassId = UUID.randomUUID();
        UUID teacherNoClassId = UUID.randomUUID();

        User adminUser = User.builder()
                .id(adminId)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_ADMIN).build()))
                .build();
        User teacherUser = User.builder()
                .id(teacherWithClassId).firstName("Hoa").lastName("Le")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();

        Classroom classA = Classroom.builder()
                .id(UUID.randomUUID())
                .name("IELTS 7.0")
                .joinCode("JOIN01")
                .teacher(Teacher.builder().user(teacherUser).build())
                .classStudents(Set.of(new ClassStudent(), new ClassStudent()))
                .build();
        Classroom classB = Classroom.builder()
                .id(UUID.randomUUID())
                .name("TOEIC Basic")
                .joinCode("JOIN02")
                .teacher(null)
                .classStudents(null)
                .build();

        when(userRepository.findById(adminId)).thenReturn(Optional.of(adminUser));
        when(userRepository.findById(teacherWithClassId)).thenReturn(Optional.of(teacherUser));
        when(userRepository.findById(teacherNoClassId)).thenReturn(Optional.empty());
        when(classroomRepository.findAll()).thenReturn(List.of(classA, classB));
        when(classroomRepository.findByTeacherId(teacherWithClassId)).thenReturn(List.of(classA));
        when(classroomRepository.findByTeacherId(teacherNoClassId)).thenReturn(Collections.emptyList());

        // Case 1: Admin
        List<NotificationClassroomDto> adminClasses = notificationService.getAvailableClassrooms(adminId);
        assertThat(adminClasses).hasSize(2);
        assertThat(adminClasses.get(0).getTeacherName()).isEqualTo("Le Hoa");
        assertThat(adminClasses.get(0).getStudentCount()).isEqualTo(2);
        assertThat(adminClasses.get(1).getTeacherName()).isEqualTo("Chưa phân công");
        assertThat(adminClasses.get(1).getStudentCount()).isEqualTo(0);

        // Case 2: Teacher with assigned classes
        List<NotificationClassroomDto> teacherClasses = notificationService.getAvailableClassrooms(teacherWithClassId);
        assertThat(teacherClasses).hasSize(1);
        assertThat(teacherClasses.get(0).getName()).isEqualTo("IELTS 7.0");

        // Case 3: Teacher with no assigned classes -> falls back to findAll()
        List<NotificationClassroomDto> fallbackClasses = notificationService.getAvailableClassrooms(teacherNoClassId);
        assertThat(fallbackClasses).hasSize(2);

        // Case 4: null userId
        List<NotificationClassroomDto> nullUserClasses = notificationService.getAvailableClassrooms(null);
        assertThat(nullUserClasses).hasSize(2);
    }

    @Test
    @DisplayName("getBroadcastHistory(adminId), getMyNotifications, getClassroomAnnouncements: Truy vấn đúng repository")
    void queryMethods_delegateCorrectlyToNotificationRepository() {
        UUID id = UUID.randomUUID();
        Page<Notification> page = new PageImpl<>(List.of(Notification.builder().id(UUID.randomUUID()).title("N1").build()));

        when(notificationRepository.findByRecipientIdOrderByCreatedAtDesc(eq(id), any(Pageable.class))).thenReturn(page);
        when(notificationRepository.findByClassroomIdOrderByCreatedAtDesc(eq(id), any(Pageable.class))).thenReturn(page);

        assertThat(notificationService.getBroadcastHistory(id, 0, 15).getTotalElements()).isEqualTo(1);
        assertThat(notificationService.getMyNotifications(id, 1, 20).getTotalElements()).isEqualTo(1);
        assertThat(notificationService.getClassroomAnnouncements(id, 2, 10).getTotalElements()).isEqualTo(1);
    }

    @Test
    @DisplayName("markAsRead: Chủ sở hữu đánh dấu đã đọc thành công -> isRead = true")
    void markAsRead_whenOwner_marksReadAndSaves() {
        UUID ownerId = UUID.randomUUID();
        UUID notifId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        Notification notification = Notification.builder().id(notifId).recipient(owner).isRead(false).build();

        when(notificationRepository.findById(notifId)).thenReturn(Optional.of(notification));

        notificationService.markAsRead(notifId, ownerId);

        assertThat(notification.getIsRead()).isTrue();
        verify(notificationRepository).save(notification);
    }

    @Test
    @DisplayName("markAsRead: Không tìm thấy thông báo -> Ném ResourceNotFoundException")
    void markAsRead_whenNotFound_throwsResourceNotFoundException() {
        UUID notifId = UUID.randomUUID();
        when(notificationRepository.findById(notifId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.markAsRead(notifId, UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy thông báo");
    }

    @Test
    @DisplayName("markAsRead: Người dùng khác cố đọc thông báo của người khác -> Ném ForbiddenException")
    void markAsRead_whenNotOwner_throwsForbiddenException() {
        UUID ownerId = UUID.randomUUID();
        UUID strangerId = UUID.randomUUID();
        UUID notifId = UUID.randomUUID();
        Notification notification = Notification.builder()
                .id(notifId)
                .recipient(User.builder().id(ownerId).build())
                .isRead(false)
                .build();

        when(notificationRepository.findById(notifId)).thenReturn(Optional.of(notification));

        assertThatThrownBy(() -> notificationService.markAsRead(notifId, strangerId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Không có quyền truy cập");

        verify(notificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("markAllAsRead: Gọi repository markAllAsReadByUserId")
    void markAllAsRead_whenCalled_updatesAllUserNotifications() {
        UUID userId = UUID.randomUUID();

        notificationService.markAllAsRead(userId);

        verify(notificationRepository).markAllAsReadByUserId(userId);
    }

    @Test
    @DisplayName("Broadcast theo targetAudience STUDENT/ADMIN, fallback khi toàn bộ user inactive và bắt lỗi WebSocket broadcast")
    void processNotificationMessage_handlesStudentAdminAudiencesInactiveFallbackAndWsErrors() {
        Role adminRole = Role.builder().name(RoleName.ROLE_ADMIN).build();
        Role studentRole = Role.builder().name(RoleName.ROLE_STUDENT).build();

        User adminUser = User.builder().id(UUID.randomUUID()).isActive(true).roles(Set.of(adminRole)).build();
        User studentUser = User.builder().id(UUID.randomUUID()).isActive(true).roles(Set.of(studentRole)).build();

        when(userRepository.findAll()).thenReturn(List.of(adminUser, studentUser));
        when(notificationRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new MessagingException("WS user offline"))
                .when(messagingTemplate).convertAndSendToUser(anyString(), anyString(), any());
        doThrow(new MessagingException("WS topic offline"))
                .when(messagingTemplate).convertAndSend(eq("/topic/system-announcements"), any(Object.class));

        // 1. targetAudience = ROLE_ADMIN
        notificationService.processNotificationMessage(NotificationDto.builder()
                .title("Admin Alert").targetAudience("ROLE_ADMIN").targetUrl("/admin").build());

        // 2. targetAudience = STUDENT
        notificationService.processNotificationMessage(NotificationDto.builder()
                .title("Student Alert").targetAudience("STUDENT").build());

        // 3. Toàn bộ user đều inactive và không lọc role -> fallback gửi cho toàn bộ allUsers
        User inactiveOnly = User.builder().id(UUID.randomUUID()).isActive(false).email("in@elp.edu.vn").build();
        when(userRepository.findAll()).thenReturn(List.of(inactiveOnly));
        notificationService.processNotificationMessage(NotificationDto.builder()
                .title("Fallback All").build());

        verify(notificationRepository, times(3)).saveAll(anyList());

        // 4. searchRecipients với query rỗng, role ADMIN và user không có role (mặc định ROLE_STUDENT)
        User noRoleUser = User.builder().id(UUID.randomUUID()).email("norole@elp.edu.vn").isActive(true).roles(Collections.emptySet()).build();
        when(userRepository.findAll()).thenReturn(List.of(adminUser, noRoleUser));
        assertThat(notificationService.searchRecipients(null, "ADMIN")).hasSize(1);
        List<NotificationRecipientDto> allRecips = notificationService.searchRecipients("", null);
        assertThat(allRecips).hasSize(2);
        assertThat(allRecips.get(1).getRole()).isEqualTo("ROLE_STUDENT");
    }
}
