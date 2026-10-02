package com.englishlearning.curriculum.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LessonUpdateRequest {
    @NotBlank(message = "Tiêu đề không được để trống")
    private String title;
    private String objectives;
    private String content;
    private Integer orderIndex;
}