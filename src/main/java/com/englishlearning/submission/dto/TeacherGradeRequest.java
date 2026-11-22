package com.englishlearning.submission.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;
import java.util.UUID;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class TeacherGradeRequest {
    @NotNull(message = "Điểm số không được để trống")
    @DecimalMin(value = "0.0", message = "Điểm số phải từ 0 đến 10")
    @DecimalMax(value = "10.0", message = "Điểm số phải từ 0 đến 10")
    @JsonAlias({"score", "totalScore"})
    private Double finalScore;

    private String feedback;

    private Map<UUID, Double> answerScores;
}