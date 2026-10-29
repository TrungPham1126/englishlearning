package com.englishlearning.system.service;

import com.englishlearning.auth.entity.User;
import com.englishlearning.system.AuditLog;

import java.util.UUID;

public interface AuditLogService {

    /**
     * Ghi vết kiểm toán (Audit Log) cho các hành động thay đổi nhạy cảm trong hệ thống.
     */
    AuditLog recordAuditLog(
            User user,
            String action,
            String entityName,
            String entityId,
            String ipAddress,
            String metadataJson
    );

    AuditLog recordAuditLog(
            UUID userId,
            String action,
            String entityName,
            String entityId,
            String ipAddress,
            String metadataJson
    );
}
