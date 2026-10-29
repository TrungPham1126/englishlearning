package com.englishlearning.curriculum.service.impl;

import com.englishlearning.curriculum.service.*;

import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.common.exception.ForbiddenException;
import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DailyPlanServiceImpl implements DailyPlanService {

    private final DailyStudyPlanRepository dailyStudyPlanRepository;
    private final DailyPlanItemRepository dailyPlanItemRepository;
    private final StudentDailyProgressRepository progressRepository;
    private final ClassStudentRepository classStudentRepository;

    private static final DateTimeFormatter DATE_SUMMARY_FORMATTER = DateTimeFormatter.ofPattern("EEE dd-MM-yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter DATE_FULL_FORMATTER = DateTimeFormatter.ofPattern("EEEE d-M-yyyy", Locale.ENGLISH);

    @Override
    @Transactional(readOnly = true)
    public DailyHomeworkOverviewResponse getStudentDailyOverview(UUID classroomId, UUID studentId, UUID selectedDayId) {
        return generateDailyRoadmapCheckpoints(classroomId, studentId, selectedDayId, LocalDate.now());
    }

    @Override
    @Transactional(readOnly = true)
    public DailyHomeworkOverviewResponse generateDailyRoadmapCheckpoints(UUID classroomId, UUID studentId, UUID selectedDayId, LocalDate accessDate) {
        if (studentId != null && !classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)) {
            throw new ForbiddenException("Học viên không thuộc lớp học này");
        }

        List<DailyStudyPlan> plans = dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId);

        if (plans.isEmpty()) {
            return DailyHomeworkOverviewResponse.builder()
                    .completionPercentage(100)
                    .totalDays(0)
                    .completedDays(0)
                    .days(Collections.emptyList())
                    .currentSelectedDay(null)
                    .build();
        }

        LocalDate effectiveDate = accessDate != null ? accessDate : LocalDate.now();
        List<DaySummaryDto> daySummaries = new ArrayList<>();
        int completedCount = 0;
        int unlockedCount = 0;

        DailyStudyPlan targetPlan = null;

        for (DailyStudyPlan plan : plans) {
            Optional<StudentDailyProgress> progressOpt = progressRepository.findByStudentIdAndDailyPlanId(studentId, plan.getId());
            boolean isCompleted = progressOpt.map(StudentDailyProgress::getIsCompleted).orElse(false);

            boolean isCurrentDay = effectiveDate.isEqual(plan.getScheduledDate());
            boolean isTodayOrPast = !plan.getScheduledDate().isAfter(effectiveDate);
            boolean isUnlocked = Boolean.TRUE.equals(plan.getIsUnlocked()) || isTodayOrPast;

            if (isUnlocked) {
                unlockedCount++;
                if (isCompleted) {
                    completedCount++;
                }
            }

            if (selectedDayId != null && plan.getId().equals(selectedDayId)) {
                targetPlan = plan;
            } else if (targetPlan == null && isCurrentDay) {
                targetPlan = plan;
            }

            daySummaries.add(DaySummaryDto.builder()
                    .id(plan.getId())
                    .dayNumber(plan.getDayNumber())
                    .title(plan.getTitle() != null ? plan.getTitle() : "DAY " + plan.getDayNumber())
                    .dateLabel(plan.getScheduledDate().format(DATE_SUMMARY_FORMATTER))
                    .scheduledDate(plan.getScheduledDate())
                    .estimatedMinutes(plan.getEstimatedMinutes())
                    .isCompleted(isCompleted)
                    .isCurrentDay(isCurrentDay)
                    .isUnlocked(isUnlocked)
                    .build());
        }

        if (targetPlan == null) {
            targetPlan = plans.stream()
                    .filter(p -> !p.getScheduledDate().isAfter(effectiveDate))
                    .findFirst()
                    .orElse(plans.get(0));
        }

        int percentage = unlockedCount > 0 ? Math.round(((float) completedCount / unlockedCount) * 100) : 100;
        DayDetailDto currentSelectedDay = buildDayDetailDto(targetPlan, studentId);

        return DailyHomeworkOverviewResponse.builder()
                .completionPercentage(percentage)
                .totalDays(unlockedCount)
                .completedDays(completedCount)
                .days(daySummaries)
                .currentSelectedDay(currentSelectedDay)
                .build();
    }

    private DayDetailDto buildDayDetailDto(DailyStudyPlan plan, UUID studentId) {
        boolean isPlanCompleted = progressRepository.findByStudentIdAndDailyPlanId(studentId, plan.getId())
                .map(StudentDailyProgress::getIsCompleted)
                .orElse(false);

        List<DailyPlanItem> items = dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(plan.getId());

        Map<String, List<TaskItemDto>> grouped = new LinkedHashMap<>();
        for (DailyPlanItem item : items) {
            TaskItemDto taskDto = TaskItemDto.builder()
                    .id(item.getId())
                    .title(item.getTitle())
                    .itemType(item.getItemType())
                    .orderIndex(item.getOrderIndex())
                    .assignmentId(item.getAssignment() != null ? item.getAssignment().getId() : null)
                    .isDone(isPlanCompleted)
                    .build();

            grouped.computeIfAbsent(item.getSectionName() != null ? item.getSectionName() : "CORE", k -> new ArrayList<>()).add(taskDto);
        }

        List<SectionGroupDto> sections = grouped.entrySet().stream()
                .map(entry -> SectionGroupDto.builder()
                        .sectionName(entry.getKey())
                        .items(entry.getValue())
                        .build())
                .collect(Collectors.toList());

        String dayTitle = plan.getTitle() != null ? plan.getTitle() : "DAY " + plan.getDayNumber();
        String fullHeaderLabel = String.format("%s %s", dayTitle, plan.getScheduledDate().format(DATE_FULL_FORMATTER).toUpperCase());

        return DayDetailDto.builder()
                .id(plan.getId())
                .dayNumber(plan.getDayNumber())
                .title(dayTitle)
                .fullHeaderLabel(fullHeaderLabel)
                .scheduledDate(plan.getScheduledDate())
                .estimatedMinutes(plan.getEstimatedMinutes())
                .isCompleted(isPlanCompleted)
                .sections(sections)
                .build();
    }
}
