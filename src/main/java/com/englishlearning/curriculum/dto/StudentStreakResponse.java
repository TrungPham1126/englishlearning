package com.englishlearning.curriculum.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentStreakResponse {
    private Integer currentStreak;
    private LocalDate lastActiveDate;
    private Boolean hasHomeworkToday;
    private Boolean completedToday;
    private Integer todayCompletedTasks;
    private Integer todayTotalTasks;
}
