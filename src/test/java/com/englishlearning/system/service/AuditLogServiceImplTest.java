package com.englishlearning.system.service;

import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.system.AuditLog;
import com.englishlearning.system.repository.AuditLogRepository;
import com.englishlearning.system.service.impl.AuditLogServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuditLogServiceImpl - Ghi vết kiểm toán hành vi quản trị hệ thống")
class AuditLogServiceImplTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private UserRepository userRepository;

    private AuditLogServiceImpl auditLogService;

    private final UUID adminUserId = UUID.fromString("99999999-9999-9999-9999-999999999999");

    @BeforeEach
    void setUp() {
        auditLogService = new AuditLogServiceImpl(auditLogRepository, userRepository);
    }

    @Test
    @DisplayName("Ghi log kiểm toán đầy đủ hành động, IP, đối tượng và user khi Admin thay đổi dữ liệu nhạy cảm")
    void should_RecordAuditLogEvent_when_AdminModifiesQuotaOrSensitiveData() {
        // Given
        User admin = User.builder()
                .id(adminUserId)
                .email("admin@englishlearning.com")
                .firstName("Super")
                .lastName("Admin")
                .build();

        String action = "UPDATE_QUOTA";
        String entityName = "StudentAiQuota";
        String entityId = "quota-uuid-12345";
        String ipAddress = "192.168.1.100";

        String metadataJson = """
                {
                   "previousLimit": 20,
                   "newLimit": 50,
                   "reason": "Upgrade account to VIP package"
                }
                """;

        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        AuditLog savedLog = auditLogService.recordAuditLog(
                admin,
                action,
                entityName,
                entityId,
                ipAddress,
                metadataJson
        );

        // Then
        assertThat(savedLog).isNotNull();
        assertThat(savedLog.getAction()).isEqualTo("UPDATE_QUOTA");
        assertThat(savedLog.getEntityName()).isEqualTo("StudentAiQuota");
        assertThat(savedLog.getEntityId()).isEqualTo("quota-uuid-12345");
        assertThat(savedLog.getIpAddress()).isEqualTo("192.168.1.100");
        assertThat(savedLog.getUser()).isEqualTo(admin);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository, times(1)).save(captor.capture());
        AuditLog captured = captor.getValue();
        assertThat(captured.getMetadataJson()).contains("\"newLimit\": 50");
        assertThat(captured.getMetadataJson()).contains("Upgrade account to VIP package");
    }

    @Test
    @DisplayName("recordAuditLog(User): Action null & ipAddress null -> Mặc định UNKNOWN_ACTION và 127.0.0.1")
    void recordAuditLog_withNullActionAndNullIp_usesDefaultActionAndLocalhost() {
        // Given
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        AuditLog saved = auditLogService.recordAuditLog(
                (User) null,
                null,
                "SystemConfig",
                "cfg-1",
                null,
                "{}"
        );

        // Then
        assertThat(saved.getUser()).isNull();
        assertThat(saved.getAction()).isEqualTo("UNKNOWN_ACTION");
        assertThat(saved.getIpAddress()).isEqualTo("127.0.0.1");
    }

    @Test
    @DisplayName("recordAuditLog(User): Tự động trim và chuyển hoa action chữ thường")
    void recordAuditLog_withLowercasePaddedAction_normalizesUppercase() {
        // Given
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        AuditLog saved = auditLogService.recordAuditLog(
                (User) null,
                "  create_user  ",
                "User",
                "u-1",
                "10.0.0.5",
                null
        );

        // Then
        assertThat(saved.getAction()).isEqualTo("CREATE_USER");
        assertThat(saved.getIpAddress()).isEqualTo("10.0.0.5");
    }

    @Test
    @DisplayName("recordAuditLog(UUID userId): Tìm thấy User trong DB -> Gắn user vào AuditLog")
    void recordAuditLog_byUserIdWhenFound_attachesLoadedUser() {
        // Given
        User actor = User.builder().id(adminUserId).email("actor@elp.edu.vn").build();
        when(userRepository.findById(adminUserId)).thenReturn(Optional.of(actor));
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        AuditLog saved = auditLogService.recordAuditLog(
                adminUserId,
                "lock_account",
                "User",
                "target-1",
                "10.0.0.8",
                "{\"locked\":true}"
        );

        // Then
        assertThat(saved.getUser()).isSameAs(actor);
        assertThat(saved.getAction()).isEqualTo("LOCK_ACCOUNT");
        verify(userRepository).findById(adminUserId);
    }

    @Test
    @DisplayName("recordAuditLog(UUID userId): User không tồn tại hoặc userId null -> Vẫn lưu log với user = null")
    void recordAuditLog_byUserIdWhenMissingOrNull_savesLogWithNullUser() {
        // Given
        UUID missingUserId = UUID.randomUUID();
        when(userRepository.findById(missingUserId)).thenReturn(Optional.empty());
        when(auditLogRepository.save(any(AuditLog.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        AuditLog missingUserLog = auditLogService.recordAuditLog(
                missingUserId, "delete_video", "Video", "v-1", null, null);
        AuditLog nullUserIdLog = auditLogService.recordAuditLog(
                (UUID) null, "cron_cleanup", "RefreshToken", "all", null, null);

        // Then
        assertThat(missingUserLog.getUser()).isNull();
        assertThat(missingUserLog.getAction()).isEqualTo("DELETE_VIDEO");
        assertThat(missingUserLog.getIpAddress()).isEqualTo("127.0.0.1");

        assertThat(nullUserIdLog.getUser()).isNull();
        assertThat(nullUserIdLog.getAction()).isEqualTo("CRON_CLEANUP");
        verify(userRepository, times(1)).findById(missingUserId);
        verify(auditLogRepository, times(2)).save(any(AuditLog.class));
    }
}
