package com.englishlearning.curriculum.service.impl;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.StudentStreakResponse;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.service.UserStreakService;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

@Service
@Slf4j
public class UserStreakServiceImpl implements UserStreakService {

    private final StudentRepository studentRepository;
    private final ClassStudentRepository classStudentRepository;
    private final DailyStudyPlanRepository dailyStudyPlanRepository;
    private final AssignmentAttemptRepository assignmentAttemptRepository;
    private final Clock clock;

    @Autowired
    public UserStreakServiceImpl(
            StudentRepository studentRepository,
            ClassStudentRepository classStudentRepository,
            DailyStudyPlanRepository dailyStudyPlanRepository,
            AssignmentAttemptRepository assignmentAttemptRepository) {
        this(studentRepository, classStudentRepository, dailyStudyPlanRepository, assignmentAttemptRepository, Clock.systemDefaultZone());
    }

    public UserStreakServiceImpl(
            StudentRepository studentRepository,
            ClassStudentRepository classStudentRepository,
            DailyStudyPlanRepository dailyStudyPlanRepository,
            AssignmentAttemptRepository assignmentAttemptRepository,
            Clock clock) {
        this.studentRepository = studentRepository;
        this.classStudentRepository = classStudentRepository;
        this.dailyStudyPlanRepository = dailyStudyPlanRepository;
        this.assignmentAttemptRepository = assignmentAttemptRepository;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
    }

    @Override
    @Transactional
    public int updateStreakOnPlanCompletion(UUID studentId, LocalDate completionDate) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy học sinh với ID: " + studentId));

        LocalDate effectiveDate = completionDate != null ? completionDate : LocalDate.now(clock);
        LocalDate evaluationDate = (student.getLastActiveDate() != null && effectiveDate.isBefore(student.getLastActiveDate()))
                ? student.getLastActiveDate()
                : effectiveDate;

        StudentStreakResponse summary = calculateStreak(studentId, evaluationDate);
        int updatedStreak = summary.getCurrentStreak() != null ? summary.getCurrentStreak() : 0;

        student.setCurrentStreak(updatedStreak);
        if (summary.getLastActiveDate() != null) {
            student.setLastActiveDate(summary.getLastActiveDate());
        }
        studentRepository.save(student);

        log.info("Cập nhật streak bài tập ngày cho học sinh {}: {} ngày (mốc đánh giá: {}, ngày hoàn thành gần nhất: {})",
                studentId, updatedStreak, evaluationDate, student.getLastActiveDate());
        return updatedStreak;
    }

    @Override
    @Transactional
    public int recordActivity(UUID studentId) {
        return updateStreakOnPlanCompletion(studentId, LocalDate.now(clock));
    }

    @Override
    @Transactional(readOnly = true)
    public int getCurrentStreak(UUID studentId) {
        StudentStreakResponse summary = getStreakSummary(studentId);
        return summary.getCurrentStreak() != null ? summary.getCurrentStreak() : 0;
    }

    @Override
    @Transactional(readOnly = true)
    public StudentStreakResponse getStreakSummary(UUID studentId) {
        return getStreakSummary(studentId, LocalDate.now(clock));
    }

    @Override
    @Transactional(readOnly = true)
    public StudentStreakResponse getStreakSummary(UUID studentId, LocalDate referenceDate) {
        if (studentId == null || studentRepository.findById(studentId).isEmpty()) {
            return emptySummary();
        }
        return calculateStreak(studentId, referenceDate);
    }

    private StudentStreakResponse calculateStreak(UUID studentId, LocalDate referenceDate) {
        ZoneId zoneId = clock.getZone();
        LocalDate today = referenceDate != null ? referenceDate : LocalDate.now(clock);

        List<ClassStudent> enrollments = classStudentRepository.findByStudentIdAndIsActiveTrue(studentId);
        if (enrollments == null || enrollments.isEmpty()) {
            return emptySummary();
        }

        Map<UUID, LocalDate> enrolledDateByClassroomId = new LinkedHashMap<>();
        for (ClassStudent enrollment : enrollments) {
            if (enrollment != null && enrollment.getClassroom() != null && enrollment.getClassroom().getId() != null) {
                LocalDate enrolledDate = enrollment.getEnrolledAt() != null
                        ? enrollment.getEnrolledAt().atZone(zoneId).toLocalDate()
                        : null;
                enrolledDateByClassroomId.putIfAbsent(enrollment.getClassroom().getId(), enrolledDate);
            }
        }
        if (enrolledDateByClassroomId.isEmpty()) {
            return emptySummary();
        }

        List<DailyStudyPlan> plans = dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(
                enrolledDateByClassroomId.keySet(), today);
        if (plans == null || plans.isEmpty()) {
            return emptySummary();
        }

        TreeMap<LocalDate, Set<UUID>> homeworkByDate = new TreeMap<>(Comparator.reverseOrder());
        for (DailyStudyPlan plan : plans) {
            if (plan == null || plan.getScheduledDate() == null || plan.getScheduledDate().isAfter(today)) {
                continue;
            }
            if (plan.getClassroom() != null && plan.getClassroom().getId() != null) {
                LocalDate enrolledDate = enrolledDateByClassroomId.get(plan.getClassroom().getId());
                if (enrolledDate != null && plan.getScheduledDate().isBefore(enrolledDate)) {
                    continue;
                }
            }

            List<DailyPlanItem> items = plan.getItems();
            if (items == null || items.isEmpty()) {
                continue;
            }

            Set<UUID> planAssignmentIds = new HashSet<>();
            for (DailyPlanItem item : items) {
                if (item != null && item.getAssignment() != null && item.getAssignment().getId() != null) {
                    planAssignmentIds.add(item.getAssignment().getId());
                }
            }
            if (planAssignmentIds.isEmpty()) {
                continue;
            }

            homeworkByDate.computeIfAbsent(plan.getScheduledDate(), k -> new HashSet<>()).addAll(planAssignmentIds);
        }

        if (homeworkByDate.isEmpty()) {
            return emptySummary();
        }

        Map<UUID, LocalDate> earliestSubmitDateByAssignment = extractEarliestSubmitDates(
                assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId),
                zoneId);

        boolean hasHomeworkToday = homeworkByDate.containsKey(today);
        Set<UUID> todayAssignments = hasHomeworkToday ? homeworkByDate.get(today) : Collections.emptySet();
        int todayTotalTasks = todayAssignments.size();
        int todayCompletedTasks = 0;
        for (UUID assignmentId : todayAssignments) {
            LocalDate earliestDate = earliestSubmitDateByAssignment.get(assignmentId);
            if (earliestDate != null && !earliestDate.isAfter(today)) {
                todayCompletedTasks++;
            }
        }
        boolean completedToday = hasHomeworkToday && todayTotalTasks > 0 && todayCompletedTasks >= todayTotalTasks;

        int streak = 0;
        LocalDate lastCompletedDate = null;

        for (Map.Entry<LocalDate, Set<UUID>> entry : homeworkByDate.entrySet()) {
            LocalDate homeworkDate = entry.getKey();
            Set<UUID> requiredAssignments = entry.getValue();

            boolean dayCompletedOnTime = !requiredAssignments.isEmpty();
            for (UUID assignmentId : requiredAssignments) {
                LocalDate earliestDate = earliestSubmitDateByAssignment.get(assignmentId);
                if (earliestDate == null || earliestDate.isAfter(homeworkDate)) {
                    dayCompletedOnTime = false;
                    break;
                }
            }

            if (dayCompletedOnTime) {
                streak++;
                if (lastCompletedDate == null) {
                    lastCompletedDate = homeworkDate;
                }
            } else if (homeworkDate.equals(today)) {
                // Hôm nay vẫn đang diễn ra nên chưa hoàn thành hết bài hôm nay chưa làm mất chuỗi trước đó
                continue;
            } else {
                // Bỏ lỡ hoặc không hoàn thành đúng hạn một ngày có bài tập trong quá khứ -> ngắt chuỗi
                break;
            }
        }

        return StudentStreakResponse.builder()
                .currentStreak(streak)
                .lastActiveDate(lastCompletedDate)
                .hasHomeworkToday(hasHomeworkToday)
                .completedToday(completedToday)
                .todayCompletedTasks(todayCompletedTasks)
                .todayTotalTasks(todayTotalTasks)
                .build();
    }

    private Map<UUID, LocalDate> extractEarliestSubmitDates(List<Object[]> rows, ZoneId zoneId) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<UUID, LocalDate> result = new HashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            UUID assignmentId = toUuid(row[0]);
            LocalDate submitDate = toLocalDate(row[1], zoneId);
            if (assignmentId != null && submitDate != null) {
                result.merge(assignmentId, submitDate, (existing, incoming) ->
                        incoming.isBefore(existing) ? incoming : existing);
            }
        }
        return result;
    }

    private UUID toUuid(Object value) {
        if (value instanceof UUID uuid) {
            return uuid;
        }
        if (value instanceof String str && !str.isBlank()) {
            try {
                return UUID.fromString(str.trim());
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }
        return null;
    }

    private LocalDate toLocalDate(Object temporal, ZoneId zoneId) {
        if (temporal instanceof Instant instant) {
            return instant.atZone(zoneId).toLocalDate();
        }
        if (temporal instanceof Timestamp timestamp) {
            return timestamp.toInstant().atZone(zoneId).toLocalDate();
        }
        if (temporal instanceof LocalDate localDate) {
            return localDate;
        }
        if (temporal instanceof LocalDateTime localDateTime) {
            return localDateTime.toLocalDate();
        }
        if (temporal instanceof OffsetDateTime offsetDateTime) {
            return offsetDateTime.atZoneSameInstant(zoneId).toLocalDate();
        }
        if (temporal instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        if (temporal instanceof Date date) {
            return date.toInstant().atZone(zoneId).toLocalDate();
        }
        return null;
    }

    private StudentStreakResponse emptySummary() {
        return StudentStreakResponse.builder()
                .currentStreak(0)
                .lastActiveDate(null)
                .hasHomeworkToday(false)
                .completedToday(false)
                .todayCompletedTasks(0)
                .todayTotalTasks(0)
                .build();
    }
}
