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

        // json-serialization.md: Dùng explicit JSON string literal
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
}
