package com.englishlearning.curriculum.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreatePlanItemRequest {
    @NotBlank(message = "Tên Section không được để trống")
    private String sectionName; // "A. LISTENING & READING (Bắt buộc)"

    @NotBlank(message = "Tiêu đề đầu việc không được để trống")
    private String title; // "1. TỪ VỰNG TRỌNG ĐIỂM 2"

    @NotBlank(message = "Loại task không được để trống")
    private String itemType; // VOCABULARY, LISTENING, READING, SHADOWING

    @NotNull(message = "Thứ tự sắp xếp không được để trống")
    private Integer orderIndex;

    private UUID assignmentId; // Có thể null nếu là bài đọc từ vựng thuần túy
}