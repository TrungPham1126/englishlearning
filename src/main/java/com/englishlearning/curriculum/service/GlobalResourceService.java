package com.englishlearning.curriculum.service;

import com.englishlearning.curriculum.dto.GlobalResourceResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface GlobalResourceService {

    List<GlobalResourceResponse> getResourcesByType(String type);

    void uploadResource(MultipartFile file, String type, UUID adminId);

    void deleteResource(UUID id);
}
