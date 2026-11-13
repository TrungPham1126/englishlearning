package com.englishlearning.system.aspect;

import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.system.AuditLog;
import com.englishlearning.system.repository.AuditLogRepository;
import jakarta.persistence.EntityManager;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.Signature;
import org.aspectj.lang.annotation.AfterReturning;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuditLogAspect - Kiểm thử AOP ghi vết kiểm toán hành vi Service")
class AuditLogAspectTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private AuditLogAspect auditLogAspect;

    private static class ClassroomService {
    }

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    @DisplayName("Khai báo @AfterReturning bao phủ đúng pointcut create/update/delete/assign/enroll")
    void annotation_definesAfterReturningPointcutsCorrectly() throws NoSuchMethodException {
        Method method = AuditLogAspect.class.getDeclaredMethod("logAuditActivity", JoinPoint.class, Object.class);
        AfterReturning afterReturning = method.getAnnotation(AfterReturning.class);

        assertThat(afterReturning).isNotNull();
        assertThat(afterReturning.returning()).isEqualTo("result");
        assertThat(afterReturning.pointcut())
                .contains("create*(..)", "update*(..)", "delete*(..)", "ClassroomService.assign*(..)", "ClassroomService.enroll*(..)");
    }

    @Test
    @DisplayName("User đã xác thực + X-Forwarded-For + create* -> Lưu AuditLog CREATE kèm IP và metadata")
    void logAuditActivity_whenAuthenticatedWithXForwardedForAndCreate_savesAuditLog() {
        // Given
        UUID adminId = UUID.randomUUID();
        User adminRef = User.builder().id(adminId).email("admin@elp.edu.vn").build();
        CustomUserDetails details = new CustomUserDetails(
                User.builder()
                        .id(adminId)
                        .email("admin@elp.edu.vn")
                        .password("hash")
                        .isActive(true)
                        .roles(Set.of(Role.builder().name(RoleName.ROLE_ADMIN).build()))
                        .build()
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities())
        );

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.55");
        request.setRemoteAddr("10.0.0.1");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        JoinPoint joinPoint = mockJoinPoint("createClassroom", new ClassroomService());
        when(entityManager.getReference(User.class, adminId)).thenReturn(adminRef);

        // When
        auditLogAspect.logAuditActivity(joinPoint, new Object());

        // Then
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());

        AuditLog saved = captor.getValue();
        assertThat(saved.getUser()).isSameAs(adminRef);
        assertThat(saved.getAction()).isEqualTo("CREATE");
        assertThat(saved.getEntityName()).isEqualTo("Classroom");
        assertThat(saved.getIpAddress()).isEqualTo("203.0.113.55");
        assertThat(saved.getMetadataJson()).isEqualTo("{\"method\": \"createClassroom\"}");
    }

    @Test
    @DisplayName("Không có X-Forwarded-For -> Lấy remoteAddr từ request; kiểm tra đủ nhánh update/delete/assign/enroll/other")
    void logAuditActivity_withoutXForwardedFor_fallsBackToRemoteAddrAndMapsAllActions() {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.168.10.25");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        // Principal không phải CustomUserDetails -> user giữ null
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "system-principal", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        String[][] methodActionPairs = {
                {"updateProfile", "UPDATE"},
                {"deleteUser", "DELETE"},
                {"assignTeacher", "ASSIGN"},
                {"enrollStudent", "ENROLL"},
                {"archiveData", "OTHER"}
        };

        for (String[] pair : methodActionPairs) {
            reset(auditLogRepository);
            JoinPoint jp = mockJoinPoint(pair[0], new ClassroomService());

            // When
            auditLogAspect.logAuditActivity(jp, null);

            // Then
            ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
            verify(auditLogRepository).save(captor.capture());
            assertThat(captor.getValue().getAction()).isEqualTo(pair[1]);
            assertThat(captor.getValue().getIpAddress()).isEqualTo("192.168.10.25");
            assertThat(captor.getValue().getUser()).isNull();
        }
    }

    @Test
    @DisplayName("Không có RequestContextHolder (async/scheduler thread) -> Đặt ipAddress = 'Unknown'")
    void logAuditActivity_whenNoRequestAttributes_usesUnknownIpAddress() {
        // Given
        UUID userId = UUID.randomUUID();
        User userRef = User.builder().id(userId).email("teacher@elp.edu.vn").build();
        CustomUserDetails details = new CustomUserDetails(
                User.builder().id(userId).email("teacher@elp.edu.vn").password("x").isActive(true).roles(Set.of()).build()
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities())
        );
        when(entityManager.getReference(User.class, userId)).thenReturn(userRef);

        // When
        auditLogAspect.logAuditActivity(mockJoinPoint("updateLesson", new ClassroomService()), null);

        // Then
        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        assertThat(captor.getValue().getIpAddress()).isEqualTo("Unknown");
    }

    @Test
    @DisplayName("Authentication null, chưa authenticated hoặc anonymousUser -> Không ghi AuditLog")
    void logAuditActivity_whenUnauthenticatedOrAnonymous_skipsRecording() {
        JoinPoint jp = mock(JoinPoint.class);

        // Case 1: null auth
        auditLogAspect.logAuditActivity(jp, null);

        // Case 2: unauthenticated token
        UsernamePasswordAuthenticationToken unauthenticated =
                new UsernamePasswordAuthenticationToken("user", "pass");
        SecurityContextHolder.getContext().setAuthentication(unauthenticated);
        auditLogAspect.logAuditActivity(jp, null);

        // Case 3: anonymousUser string principal
        AnonymousAuthenticationToken anonymousToken = new AnonymousAuthenticationToken(
                "key", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        SecurityContextHolder.getContext().setAuthentication(anonymousToken);
        auditLogAspect.logAuditActivity(jp, null);

        verifyNoInteractions(auditLogRepository, entityManager);
    }

    @Test
    @DisplayName("AuditLogRepository ném ngoại lệ khi lưu -> Aspect nuốt lỗi an toàn, không làm hỏng luồng nghiệp vụ")
    void logAuditActivity_whenRepositoryThrowsException_catchesGracefully() {
        // Given
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))
        );
        doThrow(new RuntimeException("DB write failed")).when(auditLogRepository).save(any(AuditLog.class));

        // When & Then
        assertThatCode(() -> auditLogAspect.logAuditActivity(mockJoinPoint("deleteRecord", new ClassroomService()), null))
                .doesNotThrowAnyException();
    }

    private JoinPoint mockJoinPoint(String methodName, Object target) {
        JoinPoint joinPoint = mock(JoinPoint.class);
        Signature signature = mock(Signature.class);
        when(signature.getName()).thenReturn(methodName);
        when(joinPoint.getSignature()).thenReturn(signature);
        when(joinPoint.getTarget()).thenReturn(target);
        return joinPoint;
    }
}
