package com.englishlearning.curriculum.service;

import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;

import java.util.List;
import java.util.UUID;

public interface DailyStudyPlanService {

    DailyHomeworkOverviewResponse getStudentDailyOverview(UUID classroomId, UUID studentId, UUID selectedDayId);

    DailyStudyPlan createDailyPlan(CreateDailyPlanRequest request);

    DailyStudyPlan updateDailyPlan(UUID planId, UpdateDailyPlanRequest request);

    List<DailyStudyPlan> getPlansByClassroom(UUID classroomId);

    void deleteDailyPlan(UUID planId);

    DailyPlanItem addPlanItem(UUID planId, CreatePlanItemRequest request);

    void deletePlanItem(UUID itemId);

    void markDayAsCompleted(UUID studentId, UUID planId);

    List<DailyProgressStatResponse> getDailyProgressStatsMatrix(UUID classroomId);
}
