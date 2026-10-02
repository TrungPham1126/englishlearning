package com.englishlearning.curriculum.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DayDetailDto {
    private UUID id;
    private Integer dayNumber;
    private String title; // "DAY 20"
    private String fullHeaderLabel; // "DAY 20 FRIDAY 2-10-2026"
    private LocalDate scheduledDate;
    private Integer estimatedMinutes;
    private Boolean isCompleted;
    private List<SectionGroupDto> sections;
}