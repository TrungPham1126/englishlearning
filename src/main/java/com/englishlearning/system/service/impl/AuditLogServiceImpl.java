package com.englishlearning.system.service.impl;

import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.system.AuditLog;
import com.englishlearning.system.repository.AuditLogRepository;
import com.englishlearning.system.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogServiceImpl implements AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public AuditLog recordAuditLog(
            User user,
            String action,
            String entityName,
            String entityId,
            String ipAddress,
            String metadataJson) {

        AuditLog auditLog = AuditLog.builder()
                .user(user)
                .action(action != null ? action.trim().toUpperCase() : "UNKNOWN_ACTION")
                .entityName(entityName)
                .entityId(entityId)
                .ipAddress(ipAddress != null ? ipAddress : "127.0.0.1")
                .metadataJson(metadataJson)
                .build();

        AuditLog savedLog = auditLogRepository.save(auditLog);
        log.info("[AUDIT_LOG] User {} thực hiện '{}' trên entity '{}:{}' từ IP: {}",
                user != null ? user.getEmail() : "SYSTEM",
                savedLog.getAction(),
                savedLog.getEntityName(),
                savedLog.getEntityId(),
                savedLog.getIpAddress()
        );
        return savedLog;
    }

    @Override
    @Transactional
    public AuditLog recordAuditLog(
            UUID userId,
            String action,
            String entityName,
            String entityId,
            String ipAddress,
            String metadataJson) {

        User user = (userId != null)
                ? userRepository.findById(userId).orElse(null)
                : null;

        return recordAuditLog(user, action, entityName, entityId, ipAddress, metadataJson);
    }
}
