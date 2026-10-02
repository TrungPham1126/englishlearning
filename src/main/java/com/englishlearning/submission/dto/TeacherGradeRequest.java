package com.englishlearning.submission.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TeacherGradeRequest {
    @NotNull
    private Double finalScore;
    private String feedback;
}