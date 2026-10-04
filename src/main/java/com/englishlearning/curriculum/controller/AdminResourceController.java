// src/main/java/com/englishlearning/curriculum/controller/AdminResourceController.java
package com.englishlearning.curriculum.controller;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.curriculum.dto.GlobalResourceResponse;
import com.englishlearning.curriculum.service.GlobalResourceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/resources")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
public class AdminResourceController {
    private final GlobalResourceService resourceService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<GlobalResourceResponse>>> getResources(@RequestParam String type) {
        return ResponseEntity.ok(ApiResponse.success(resourceService.getResourcesByType(type)));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Void>> uploadResource(
            @RequestParam("file") MultipartFile file,
            @RequestParam("type") String type,
            @AuthenticationPrincipal CustomUserDetails user) {
        resourceService.uploadResource(file, type, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Upload thành công", null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteResource(@PathVariable UUID id) {
        resourceService.deleteResource(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa thành công", null));
    }
}