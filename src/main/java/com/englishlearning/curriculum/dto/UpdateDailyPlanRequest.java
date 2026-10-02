package com.englishlearning.curriculum.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateDailyPlanRequest {
    private String title;
    private Integer dayNumber;
    private LocalDate scheduledDate;
    private Integer estimatedMinutes;
    private Boolean isUnlocked;
}