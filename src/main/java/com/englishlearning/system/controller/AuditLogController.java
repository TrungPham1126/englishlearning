package com.englishlearning.system.controller;

import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.system.dto.AuditLogDto;
import com.englishlearning.system.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AuditLogDto>>> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        // Sắp xếp log mới nhất lên đầu
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<AuditLogDto> dtoPage = auditLogRepository.findAll(pageable).map(log -> AuditLogDto.builder()
                .id(log.getId())
                .userId(log.getUser() != null ? log.getUser().getId() : null)
                .userName(log.getUser() != null ? log.getUser().getEmail() : "System")
                .action(log.getAction())
                .entityName(log.getEntityName())
                .entityId(log.getEntityId())
                .ipAddress(log.getIpAddress())
                .metadataJson(log.getMetadataJson())
                .createdAt(log.getCreatedAt())
                .build());

        return ResponseEntity.ok(ApiResponse.success("Tải lịch sử hệ thống thành công", PageResponse.from(dtoPage)));
    }
}