package com.englishlearning.classroom.dto;

import com.englishlearning.classroom.entity.ClassStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateClassStatusRequest {
    @NotNull(message = "Trạng thái lớp không được để trống")
    private ClassStatus status;
}