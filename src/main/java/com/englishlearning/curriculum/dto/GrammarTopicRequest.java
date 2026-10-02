package com.englishlearning.curriculum.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GrammarTopicRequest {
    @NotBlank(message = "Tiêu đề ngữ pháp không được để trống")
    private String title;

    @NotBlank(message = "Tóm tắt quy tắc ngữ pháp không được để trống")
    private String ruleSummary;

    private String formula;
    private String examples;
}