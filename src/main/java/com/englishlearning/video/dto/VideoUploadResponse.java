package com.englishlearning.video.dto;

import com.englishlearning.video.entity.VideoStatus;
import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class VideoUploadResponse {
    private UUID videoId;
    private VideoStatus status;
    private String originalFileName;
    private String message;
}