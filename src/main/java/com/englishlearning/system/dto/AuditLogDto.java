package com.englishlearning.system.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class AuditLogDto {
    private UUID id;
    private UUID userId;
    private String userName;
    private String action;
    private String entityName;
    private String entityId;
    private String ipAddress;
    private String metadataJson;
    private Instant createdAt;
}