package com.englishlearning.classroom.dto;

import com.englishlearning.classroom.entity.ClassLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
public class CreateClassroomRequest {
    @NotBlank(message = "Tên lớp học không được để trống")
    private String name;
    private String description;
    @NotNull(message = "Cấp độ lớp không được để trống")
    private ClassLevel level;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer maxStudents;
    private UUID teacherId;
}