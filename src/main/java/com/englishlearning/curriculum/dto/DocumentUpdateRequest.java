package com.englishlearning.curriculum.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DocumentUpdateRequest {
    @NotBlank(message = "Tên tài liệu không được để trống")
    private String fileName;

    private String fileType;
}
