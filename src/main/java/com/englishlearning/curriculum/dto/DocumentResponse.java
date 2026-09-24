package com.englishlearning.curriculum.dto;

import lombok.*;
import java.util.UUID;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class DocumentResponse {
    private UUID id;
    private UUID lessonId;
    private String fileName;
    private String fileUrl;
    private Long fileSizeBytes;
    private String fileType;
    private LocalDateTime createdAt;
}