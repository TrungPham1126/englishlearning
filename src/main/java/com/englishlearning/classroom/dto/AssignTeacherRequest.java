package com.englishlearning.classroom.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class AssignTeacherRequest {
    @NotNull(message = "ID Giảng viên không được để trống")
    private UUID teacherId;
}