package com.englishlearning.video.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class WatchProgressRequest {
    @NotNull(message = "watchedSeconds is required")
    @Min(0)
    private Integer watchedSeconds;

    private Boolean completed;
}