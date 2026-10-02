package com.englishlearning.curriculum.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DaySummaryDto {
    private UUID id;
    private Integer dayNumber; // 20
    private String title; // "DAY 20"
    private String dateLabel; // "Fri 02-10-2026"
    private LocalDate scheduledDate;
    private Integer estimatedMinutes; // 40
    private Boolean isCompleted; // true = chấm tròn xanh, false = chấm tròn đỏ
    private Boolean isCurrentDay; // true nếu là ngày hôm nay
    private Boolean isUnlocked; // true nếu đã đến hoặc qua ngày 00:00
}