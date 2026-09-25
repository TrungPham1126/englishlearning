package com.englishlearning.curriculum.dto;

import lombok.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@Data
public class LessonRequest {
    @NotNull(message = "ID Lớp học không được để trống")
    private UUID classId;

    @NotBlank(message = "Tiêu đề không được để trống")
    private String title;

    private String objectives;
    private String content;
    private Integer orderIndex;
}