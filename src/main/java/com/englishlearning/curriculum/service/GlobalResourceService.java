// src/main/java/com/englishlearning/curriculum/service/GlobalResourceService.java
package com.englishlearning.curriculum.service;

import com.englishlearning.auth.entity.User;
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
public class GlobalResourceService {
    private final GlobalResourceRepository repository;
    private final DocumentStorageService storageService; // Service có sẵn của bạn để gọi S3/R2
    private final EntityManager entityManager;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm")
            .withZone(ZoneId.systemDefault());

    @Transactional(readOnly = true)
    public List<GlobalResourceResponse> getResourcesByType(String type) {
        GlobalResource.ResourceType resourceType = GlobalResource.ResourceType.valueOf(type.toUpperCase());
        return repository.findByResourceTypeOrderByCreatedAtDesc(resourceType).stream()
                .map(res -> GlobalResourceResponse.builder()
                        .id(res.getId())
                        .name(res.getName())
                        .size(formatSize(res.getSizeBytes()))
                        .usedCount(res.getUsedCount())
                        .uploadedAt(FORMATTER.format(res.getCreatedAt()))
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void uploadResource(MultipartFile file, String type, UUID adminId) {
        String url = storageService.uploadFile(file); // Gọi R2
        User admin = entityManager.getReference(User.class, adminId);

        GlobalResource resource = GlobalResource.builder()
                .name(file.getOriginalFilename())
                .storageUrl(url)
                .resourceType(GlobalResource.ResourceType.valueOf(type.toUpperCase()))
                .sizeBytes(file.getSize())
                .uploadedBy(admin)
                .build();
        repository.save(resource);
    }

    @Transactional
    public void deleteResource(UUID id) {
        GlobalResource resource = repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Not found"));
        repository.delete(resource);
    }

    private String formatSize(Long bytes) {
        if (bytes == null)
            return "0 MB";
        double mb = bytes / (1024.0 * 1024.0);
        return String.format("%.2f MB", mb);
    }
}