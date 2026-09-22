package com.englishlearning.classroom.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EnrollStudentRequest {
    @NotBlank(message = "Email hoặc số điện thoại học viên không được để trống")
    private String studentIdentifier;
}