package com.englishlearning.curriculum.service.impl;

import com.englishlearning.curriculum.service.*;

import com.englishlearning.auth.entity.User;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.GlobalResourceResponse;
import com.englishlearning.curriculum.entity.GlobalResource;
import com.englishlearning.curriculum.repository.GlobalResourceRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GlobalResourceServiceImpl implements GlobalResourceService {
    private final GlobalResourceRepository repository;
    private final DocumentStorageService storageService;
    private final EntityManager entityManager;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")
            .withZone(ZoneId.systemDefault());

    @Transactional(readOnly = true)
    public List<GlobalResourceResponse> getResourcesByType(String type) {
        GlobalResource.ResourceType resourceType = parseResourceType(type, true);
        return repository.findByResourceTypeOrderByCreatedAtDesc(resourceType).stream()
                .map(res -> GlobalResourceResponse.builder()
                        .id(res.getId())
                        .name(res.getName())
                        .size(formatSize(res.getSizeBytes()))
                        .usedCount(res.getUsedCount())
                        .uploadedAt(res.getCreatedAt() != null ? FORMATTER.format(res.getCreatedAt()) : "")
                        .url(res.getStorageUrl())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void uploadResource(MultipartFile file, String type, UUID adminId) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File tài nguyên không được để trống");
        }
        GlobalResource.ResourceType resourceType = parseResourceType(type, false);
        String url = storageService.uploadFile(file);
        User admin = entityManager.getReference(User.class, adminId);

        GlobalResource resource = GlobalResource.builder()
                .name(file.getOriginalFilename())
                .storageUrl(url)
                .resourceType(resourceType)
                .sizeBytes(file.getSize())
                .uploadedBy(admin)
                .build();
        repository.save(resource);
    }

    private GlobalResource.ResourceType parseResourceType(String type, boolean defaultToDocOnNull) {
        if (type == null || type.isBlank()) {
            if (defaultToDocOnNull) {
                return GlobalResource.ResourceType.DOC;
            }
            throw new BadRequestException("Loại tài nguyên không được để trống");
        }
        String normalized = type.trim().toUpperCase();
        if ("DOCUMENT".equals(normalized)) {
            normalized = "DOC";
        }
        try {
            return GlobalResource.ResourceType.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Loại tài nguyên không hợp lệ: " + type);
        }
    }

    @Transactional
    public void deleteResource(UUID id) {
        GlobalResource resource = repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Not found"));
        String storageUrl = resource.getStorageUrl();
        repository.delete(resource);
        if (storageUrl != null && !storageUrl.isBlank()) {
            try {
                storageService.deleteFileByUrl(storageUrl);
            } catch (Exception ignored) {
            }
        }
    }

    private String formatSize(Long bytes) {
        if (bytes == null)
            return "0 MB";
        double mb = bytes / (1024.0 * 1024.0);
        return String.format(java.util.Locale.US, "%.2f MB", mb);
    }
}