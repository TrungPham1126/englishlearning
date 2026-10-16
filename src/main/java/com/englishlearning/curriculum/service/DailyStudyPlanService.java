package com.englishlearning.curriculum.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.classroom.entity.Classroom;
// hoặc:

import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DailyStudyPlanService {

    private final DailyStudyPlanRepository dailyStudyPlanRepository;
    private final DailyPlanItemRepository dailyPlanItemRepository;
    private final StudentDailyProgressRepository progressRepository;
    private final EntityManager entityManager;
    private final com.englishlearning.classroom.repository.ClassStudentRepository classStudentRepository;

    private static final DateTimeFormatter DATE_SUMMARY_FORMATTER = DateTimeFormatter.ofPattern("EEE dd-MM-yyyy",
            Locale.ENGLISH);
    private static final DateTimeFormatter DATE_FULL_FORMATTER = DateTimeFormatter.ofPattern("EEEE d-M-yyyy",
            Locale.ENGLISH);

    /**
     * Dành cho Học viên: Lấy tổng quan bài tập hàng ngày, tỷ lệ % và chi tiết ngày
     * đang chọn
     */
    @Transactional(readOnly = true)
    public DailyHomeworkOverviewResponse getStudentDailyOverview(UUID classroomId, UUID studentId, UUID selectedDayId) {
        if (studentId != null && !classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)) {
            throw new com.englishlearning.common.exception.ForbiddenException("Học viên không thuộc lớp học này");
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

        LocalDate today = LocalDate.now();
        List<DaySummaryDto> daySummaries = new ArrayList<>();
        int completedCount = 0;
        int unlockedCount = 0;

        DailyStudyPlan targetPlan = null;

        for (DailyStudyPlan plan : plans) {
            Optional<StudentDailyProgress> progressOpt = progressRepository.findByStudentIdAndDailyPlanId(studentId,
                    plan.getId());
            boolean isCompleted = progressOpt.map(StudentDailyProgress::getIsCompleted).orElse(false);

            boolean isCurrentDay = today.isEqual(plan.getScheduledDate());
            boolean isTodayOrPast = !plan.getScheduledDate().isAfter(today);
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

        // Nếu chưa chọn được DAY cụ thể, ưu tiên DAY hôm nay, hoặc DAY mới nhất đã unlock
        if (targetPlan == null) {
            targetPlan = plans.stream().filter(p -> !p.getScheduledDate().isAfter(today)).findFirst().orElse(plans.get(0));
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

        // Gom nhóm các items theo sectionName
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

            grouped.computeIfAbsent(item.getSectionName(), k -> new ArrayList<>()).add(taskDto);
        }

        List<SectionGroupDto> sections = grouped.entrySet().stream()
                .map(entry -> SectionGroupDto.builder()
                        .sectionName(entry.getKey())
                        .items(entry.getValue())
                        .build())
                .collect(Collectors.toList());

        String dayTitle = plan.getTitle() != null ? plan.getTitle() : "DAY " + plan.getDayNumber();
        String fullHeaderLabel = String.format("%s %s", dayTitle,
                plan.getScheduledDate().format(DATE_FULL_FORMATTER).toUpperCase());

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

    /**
     * Dành cho Giáo viên: Tạo mới kế hoạch cho một DAY
     */
    @Transactional
    public DailyStudyPlan createDailyPlan(CreateDailyPlanRequest request) {
        Classroom classroom = entityManager.find(Classroom.class, request.getClassroomId());
        if (classroom == null) {
            throw new ResourceNotFoundException("Không tìm thấy lớp học với ID: " + request.getClassroomId());
        }

        String title = request.getTitle();
        if (title == null || title.isBlank()) {
            title = "DAY " + request.getDayNumber();
        }

        boolean isTodayOrPast = !request.getScheduledDate().isAfter(LocalDate.now());

        DailyStudyPlan plan = DailyStudyPlan.builder()
                .classroom(classroom)
                .dayNumber(request.getDayNumber())
                .title(title)
                .scheduledDate(request.getScheduledDate())
                .estimatedMinutes(request.getEstimatedMinutes())
                .isUnlocked(isTodayOrPast)
                .build();

        return dailyStudyPlanRepository.save(plan);
    }

    /**
     * Dành cho Giáo viên: Cập nhật thông tin DAY
     */
    @Transactional
    public DailyStudyPlan updateDailyPlan(UUID planId, UpdateDailyPlanRequest request) {
        DailyStudyPlan plan = dailyStudyPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy kế hoạch học tập: " + planId));

        if (request.getTitle() != null)
            plan.setTitle(request.getTitle());
        if (request.getDayNumber() != null)
            plan.setDayNumber(request.getDayNumber());
        if (request.getScheduledDate() != null)
            plan.setScheduledDate(request.getScheduledDate());
        if (request.getEstimatedMinutes() != null)
            plan.setEstimatedMinutes(request.getEstimatedMinutes());
        if (request.getIsUnlocked() != null)
            plan.setIsUnlocked(request.getIsUnlocked());

        return dailyStudyPlanRepository.save(plan);
    }

    /**
     * Dành cho Giáo viên: Lấy tất cả các DAY của lớp học
     */
    @Transactional(readOnly = true)
    public List<DailyStudyPlan> getPlansByClassroom(UUID classroomId) {
        List<DailyStudyPlan> plans = dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId);
        plans.sort(Comparator.comparing(DailyStudyPlan::getDayNumber));
        return plans;
    }

    /**
     * Dành cho Giáo viên: Xóa kế hoạch DAY
     */
    @Transactional
    public void deleteDailyPlan(UUID planId) {
        if (!dailyStudyPlanRepository.existsById(planId)) {
            throw new ResourceNotFoundException("Không tìm thấy ngày học: " + planId);
        }
        dailyStudyPlanRepository.deleteById(planId);
    }

    /**
     * Dành cho Giáo viên: Thêm đầu mục công việc/bài tập vào DAY
     */
    @Transactional
    public DailyPlanItem addPlanItem(UUID planId, CreatePlanItemRequest request) {
        DailyStudyPlan plan = dailyStudyPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ngày học: " + planId));

        Assignment assignment = null;
        if (request.getAssignmentId() != null) {
            assignment = entityManager.find(Assignment.class, request.getAssignmentId());
        }

        DailyPlanItem item = DailyPlanItem.builder()
                .dailyPlan(plan)
                .sectionName(request.getSectionName())
                .title(request.getTitle())
                .itemType(request.getItemType())
                .orderIndex(request.getOrderIndex())
                .assignment(assignment)
                .build();

        return dailyPlanItemRepository.save(item);
    }

    /**
     * Dành cho Giáo viên: Xóa đầu mục bài tập
     */
    @Transactional
    public void deletePlanItem(UUID itemId) {
        if (!dailyPlanItemRepository.existsById(itemId)) {
            throw new ResourceNotFoundException("Không tìm thấy mục bài tập: " + itemId);
        }
        dailyPlanItemRepository.deleteById(itemId);
    }

    /**
     * Dành cho Học viên: Đánh dấu đã hoàn thành toàn bộ ngày học
     */
    @Transactional
    public void markDayAsCompleted(UUID studentId, UUID planId) {
        DailyStudyPlan plan = dailyStudyPlanRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ngày học: " + planId));

        StudentDailyProgress progress = progressRepository.findByStudentIdAndDailyPlanId(studentId, planId)
                .orElseGet(() -> StudentDailyProgress.builder()
                        .student(entityManager.getReference(com.englishlearning.auth.entity.Student.class, studentId))
                        .dailyPlan(plan)
                        .totalItemsCount(plan.getItems().size())
                        .build());

        progress.setIsCompleted(true);
        progress.setCompletedItemsCount(plan.getItems().size());
        progress.setCompletedAt(Instant.now());
        progressRepository.save(progress);
    }

    /**
     * Dành cho Giáo viên: Lấy Ma trận tiến độ hoàn thành theo từng ngày của toàn bộ
     * học viên trong lớp
     */
    @Transactional(readOnly = true)
    public java.util.List<com.englishlearning.curriculum.dto.DailyProgressStatResponse> getDailyProgressStatsMatrix(
            UUID classroomId) {
        // 1. Lấy danh sách học sinh đang học trong lớp
        java.util.List<com.englishlearning.classroom.entity.ClassStudent> enrollments = entityManager.createQuery(
                "SELECT cs FROM ClassStudent cs JOIN FETCH cs.student s JOIN FETCH s.user u WHERE cs.classroom.id = :classId AND cs.isActive = true",
                com.englishlearning.classroom.entity.ClassStudent.class)
                .setParameter("classId", classroomId)
                .getResultList();

        // 2. Lấy danh sách các lộ trình (Day 1, Day 2...) của lớp
        java.util.List<DailyStudyPlan> plans = dailyStudyPlanRepository
                .findByClassroomIdOrderByDayNumberDesc(classroomId);
        plans.sort(java.util.Comparator.comparing(DailyStudyPlan::getDayNumber));

        java.util.List<com.englishlearning.curriculum.dto.DailyProgressStatResponse> responseList = new java.util.ArrayList<>();

        if (enrollments.isEmpty()) {
            return responseList;
        }

        java.util.List<UUID> studentIds = enrollments.stream().map(cs -> cs.getStudent().getId()).collect(Collectors.toList());

        java.util.List<com.englishlearning.submission.entity.AssignmentAttempt> allAttempts = entityManager.createQuery(
                "SELECT a FROM AssignmentAttempt a JOIN FETCH a.student s JOIN FETCH a.assignment assign WHERE a.student.id IN :studentIds AND a.status IN ('SUBMITTED', 'GRADING', 'COMPLETED')",
                com.englishlearning.submission.entity.AssignmentAttempt.class)
                .setParameter("studentIds", studentIds)
                .getResultList();

        for (com.englishlearning.classroom.entity.ClassStudent cs : enrollments) {
            com.englishlearning.auth.entity.Student student = cs.getStudent();
            com.englishlearning.auth.entity.User user = student.getUser();

            java.util.List<com.englishlearning.curriculum.dto.DailyProgressStatResponse.DayStat> dayStats = new java.util.ArrayList<>();
            int totalCompletedDays = 0;

            for (DailyStudyPlan plan : plans) {
                java.util.Optional<StudentDailyProgress> progressOpt = progressRepository
                        .findByStudentIdAndDailyPlanId(student.getId(), plan.getId());

                int rate = 0;
                int minutes = 0;

                if (progressOpt.isPresent() && Boolean.TRUE.equals(progressOpt.get().getIsCompleted())) {
                    rate = 100;
                    totalCompletedDays++;
                    minutes = plan.getEstimatedMinutes() != null ? plan.getEstimatedMinutes() : 30;
                } else {
                    List<DailyPlanItem> items = plan.getItems();
                    if (items != null && !items.isEmpty()) {
                        int completedItemsCount = 0;
                        int totalDurationSec = 0;

                        for (DailyPlanItem item : items) {
                            if (item.getAssignment() != null) {
                                UUID assignId = item.getAssignment().getId();
                                Optional<com.englishlearning.submission.entity.AssignmentAttempt> attemptOpt = allAttempts.stream()
                                        .filter(att -> att.getStudent().getId().equals(student.getId()) && att.getAssignment().getId().equals(assignId))
                                        .findFirst();
                                if (attemptOpt.isPresent()) {
                                    completedItemsCount++;
                                    if (attemptOpt.get().getDurationSeconds() != null) {
                                        totalDurationSec += attemptOpt.get().getDurationSeconds();
                                    }
                                }
                            } else {
                                if (progressOpt.isPresent() && progressOpt.get().getCompletedItemsCount() != null && progressOpt.get().getCompletedItemsCount() > 0) {
                                    completedItemsCount++;
                                }
                            }
                        }

                        rate = Math.round(((float) completedItemsCount / items.size()) * 100);
                        minutes = totalDurationSec > 0 ? Math.max(1, totalDurationSec / 60) : (rate > 0 ? 15 : 0);
                        if (rate >= 100) {
                            rate = 100;
                            totalCompletedDays++;
                        }
                    }
                }

                dayStats.add(com.englishlearning.curriculum.dto.DailyProgressStatResponse.DayStat.builder()
                        .dayNumber(plan.getDayNumber())
                        .rate(rate)
                        .minutes(minutes)
                        .build());
            }

            int overallRate = plans.isEmpty() ? 0 : Math.round(((float) totalCompletedDays / plans.size()) * 100);

            String fullName = ((user.getFirstName() != null ? user.getFirstName() : "") + " " + (user.getLastName() != null ? user.getLastName() : "")).trim();
            if (fullName.isEmpty()) fullName = user.getEmail();

            responseList.add(com.englishlearning.curriculum.dto.DailyProgressStatResponse.builder()
                    .studentId(student.getId().toString())
                    .studentName(fullName)
                    .overallRate(overallRate)
                    .days(dayStats)
                    .build());
        }

        return responseList;
    }
}