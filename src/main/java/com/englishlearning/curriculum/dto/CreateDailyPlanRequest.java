package com.englishlearning.curriculum.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
public class CreateDailyPlanRequest {
    @NotNull(message = "ID lớp học không được để trống")
    private UUID classroomId;

    @NotNull(message = "Số thứ tự ngày (dayNumber) không được để trống")
    private Integer dayNumber; // Ví dụ: 20

    @NotNull(message = "Ngày lên lịch mở bài không được để trống")
    private LocalDate scheduledDate;

    private String title; // Mặc định là "DAY {dayNumber}" nếu để trống
    private Integer estimatedMinutes = 30;
}