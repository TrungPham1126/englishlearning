package com.englishlearning.curriculum.service;

import com.englishlearning.curriculum.dto.DailyHomeworkOverviewResponse;

import java.time.LocalDate;
import java.util.UUID;

public interface DailyPlanService {
    DailyHomeworkOverviewResponse generateDailyRoadmapCheckpoints(UUID classroomId, UUID studentId, UUID selectedDayId, LocalDate accessDate);
    DailyHomeworkOverviewResponse getStudentDailyOverview(UUID classroomId, UUID studentId, UUID selectedDayId);
}
