package com.englishlearning.curriculum.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.StudentStreakResponse;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.service.impl.UserStreakServiceImpl;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * Unit Test cho UserStreakServiceImpl — Chuỗi làm bài tập ngày:
 * - Chỉ tính ngày có DailyStudyPlan chứa bài tập (assignment)
 * - Ngày không có bài tập (hoặc plan rỗng 0 assignment) không làm mất chuỗi
 * - Phải hoàn thành 100% bài tập của ngày đúng hạn (<= scheduledDate)
 */
@ExtendWith(MockitoExtension.class)
class UserStreakServiceTest {

    @Mock
    private StudentRepository studentRepository;

    @Mock
    private ClassStudentRepository classStudentRepository;

    @Mock
    private DailyStudyPlanRepository dailyStudyPlanRepository;

    @Mock
    private AssignmentAttemptRepository assignmentAttemptRepository;

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final LocalDate FIXED_TODAY = LocalDate.of(2026, 10, 29);
    private static final Clock FIXED_CLOCK = Clock.fixed(
            FIXED_TODAY.atTime(10, 0).atZone(ZONE).toInstant(),
            ZONE);

    private UserStreakServiceImpl userStreakService;

    @BeforeEach
    void setUp() {
        userStreakService = new UserStreakServiceImpl(
                studentRepository,
                classStudentRepository,
                dailyStudyPlanRepository,
                assignmentAttemptRepository,
                FIXED_CLOCK
        );
    }

    private Instant onDateAtNoon(LocalDate date) {
        return date.atTime(12, 0).atZone(ZONE).toInstant();
    }

    private ClassStudent activeEnrollment(UUID studentId, UUID classroomId, LocalDate enrolledDate) {
        return ClassStudent.builder()
                .id(UUID.randomUUID())
                .classroom(Classroom.builder().id(classroomId).build())
                .student(Student.builder().id(studentId).build())
                .isActive(true)
                .enrolledAt(enrolledDate.atStartOfDay(ZONE).toInstant())
                .build();
    }

    private DailyStudyPlan planWithAssignments(UUID classroomId, int dayNumber, LocalDate scheduledDate, UUID... assignmentIds) {
        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(UUID.randomUUID())
                .classroom(Classroom.builder().id(classroomId).build())
                .dayNumber(dayNumber)
                .scheduledDate(scheduledDate)
                .isUnlocked(true)
                .items(new ArrayList<>())
                .build();
        for (int i = 0; i < assignmentIds.length; i++) {
            UUID aId = assignmentIds[i];
            DailyPlanItem item = DailyPlanItem.builder()
                    .id(UUID.randomUUID())
                    .dailyPlan(plan)
                    .orderIndex(i + 1)
                    .assignment(aId != null ? Assignment.builder().id(aId).build() : null)
                    .build();
            plan.getItems().add(item);
        }
        return plan;
    }

    @Test
    @DisplayName("Cộng dồn chuỗi khi hoàn thành 100% bài tập đúng ngày qua nhiều ngày liên tiếp có bài tập")
    void should_CountConsecutiveHomeworkDays_when_AllCompletedOnTime() {
        UUID studentId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID classId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        Student student = Student.builder()
                .id(studentId)
                .currentStreak(2)
                .lastActiveDate(LocalDate.of(2026, 10, 28))
                .build();

        UUID a1 = UUID.randomUUID();
        UUID a2 = UUID.randomUUID();
        UUID a3 = UUID.randomUUID();
        UUID a4 = UUID.randomUUID();

        DailyStudyPlan day29 = planWithAssignments(classId, 3, LocalDate.of(2026, 10, 29), a3, a4);
        DailyStudyPlan day28 = planWithAssignments(classId, 2, LocalDate.of(2026, 10, 28), a2);
        DailyStudyPlan day27 = planWithAssignments(classId, 1, LocalDate.of(2026, 10, 27), a1);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 10, 20))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(List.of(day29, day28, day27));
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a1, onDateAtNoon(LocalDate.of(2026, 10, 27))},
                        new Object[]{a2, onDateAtNoon(LocalDate.of(2026, 10, 28))},
                        new Object[]{a3, onDateAtNoon(LocalDate.of(2026, 10, 29))},
                        new Object[]{a4, onDateAtNoon(LocalDate.of(2026, 10, 29))}
                ));

        int updatedStreak = userStreakService.updateStreakOnPlanCompletion(studentId, FIXED_TODAY);

        assertThat(updatedStreak).isEqualTo(3);
        ArgumentCaptor<Student> captor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getCurrentStreak()).isEqualTo(3);
        assertThat(captor.getValue().getLastActiveDate()).isEqualTo(FIXED_TODAY);

        StudentStreakResponse summary = userStreakService.getStreakSummary(studentId);
        assertThat(summary.getCurrentStreak()).isEqualTo(3);
        assertThat(summary.getLastActiveDate()).isEqualTo(FIXED_TODAY);
        assertThat(summary.getHasHomeworkToday()).isTrue();
        assertThat(summary.getCompletedToday()).isTrue();
        assertThat(summary.getTodayCompletedTasks()).isEqualTo(2);
        assertThat(summary.getTodayTotalTasks()).isEqualTo(2);
    }

    @Test
    @DisplayName("Giữ nguyên và tiếp tục tăng chuỗi khi xen kẽ ngày không có bài tập hoặc plan rỗng")
    void should_PreserveAndIncrementStreak_when_DaysWithoutHomeworkExist() {
        UUID studentId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        UUID classId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        Student student = Student.builder().id(studentId).currentStreak(1).lastActiveDate(LocalDate.of(2026, 10, 25)).build();

        UUID a25 = UUID.randomUUID();
        UUID a28 = UUID.randomUUID();

        // 25/10 có bài (đã làm), 26/10 không có plan, 27/10 có plan nhưng không có assignment (mục đọc video/rỗng),
        // 28/10 có bài (đã làm), 29/10 hôm nay không có bài
        DailyStudyPlan day28 = planWithAssignments(classId, 3, LocalDate.of(2026, 10, 28), a28);
        DailyStudyPlan emptyDay27 = planWithAssignments(classId, 2, LocalDate.of(2026, 10, 27), (UUID) null);
        DailyStudyPlan day25 = planWithAssignments(classId, 1, LocalDate.of(2026, 10, 25), a25);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 10, 1))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(List.of(day28, emptyDay27, day25));
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a25, onDateAtNoon(LocalDate.of(2026, 10, 25))},
                        new Object[]{a28, onDateAtNoon(LocalDate.of(2026, 10, 28))}
                ));

        StudentStreakResponse summary = userStreakService.getStreakSummary(studentId);
        assertThat(summary.getCurrentStreak()).isEqualTo(2);
        assertThat(summary.getLastActiveDate()).isEqualTo(LocalDate.of(2026, 10, 28));
        assertThat(summary.getHasHomeworkToday()).isFalse();
        assertThat(summary.getCompletedToday()).isFalse();
        assertThat(summary.getTodayTotalTasks()).isZero();
    }

    @Test
    @DisplayName("Hôm nay có bài tập nhưng chưa làm xong 100% -> vẫn giữ chuỗi cũ và tăng khi hoàn thành đủ")
    void should_KeepPreviousStreakDuringTodayGracePeriod_until_AllTodayTasksCompleted() {
        UUID studentId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        UUID classId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
        Student student = Student.builder().id(studentId).currentStreak(1).lastActiveDate(LocalDate.of(2026, 10, 26)).build();

        UUID a26 = UUID.randomUUID();
        UUID t1 = UUID.randomUUID();
        UUID t2 = UUID.randomUUID();
        UUID t3 = UUID.randomUUID();

        DailyStudyPlan todayPlan = planWithAssignments(classId, 2, FIXED_TODAY, t1, t2, t3);
        DailyStudyPlan pastPlan = planWithAssignments(classId, 1, LocalDate.of(2026, 10, 26), a26);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 10, 1))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(List.of(todayPlan, pastPlan));

        // Mới nộp 1/3 bài của hôm nay
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a26, onDateAtNoon(LocalDate.of(2026, 10, 26))},
                        new Object[]{t1, onDateAtNoon(FIXED_TODAY)}
                ));

        StudentStreakResponse partialSummary = userStreakService.getStreakSummary(studentId);
        assertThat(partialSummary.getCurrentStreak()).isEqualTo(1);
        assertThat(partialSummary.getHasHomeworkToday()).isTrue();
        assertThat(partialSummary.getCompletedToday()).isFalse();
        assertThat(partialSummary.getTodayCompletedTasks()).isEqualTo(1);
        assertThat(partialSummary.getTodayTotalTasks()).isEqualTo(3);

        // Nộp đủ 3/3 bài trong ngày 29/10 -> streak tăng lên 2
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a26, onDateAtNoon(LocalDate.of(2026, 10, 26))},
                        new Object[]{t1, onDateAtNoon(FIXED_TODAY)},
                        new Object[]{t2, onDateAtNoon(FIXED_TODAY)},
                        new Object[]{t3, onDateAtNoon(FIXED_TODAY)}
                ));

        int updated = userStreakService.recordActivity(studentId);
        assertThat(updated).isEqualTo(2);
        assertThat(student.getCurrentStreak()).isEqualTo(2);
        assertThat(student.getLastActiveDate()).isEqualTo(FIXED_TODAY);
    }

    @Test
    @DisplayName("Bỏ lỡ hoặc làm thiếu bài tập của một ngày trong quá khứ -> chuỗi rớt về 0, làm xong hôm nay reset về 1")
    void should_BreakStreakToZeroOnRead_when_PastHomeworkDayMissedOrIncomplete() {
        UUID studentId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        UUID classId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
        Student student = Student.builder().id(studentId).currentStreak(5).lastActiveDate(LocalDate.of(2026, 10, 27)).build();

        UUID a27 = UUID.randomUUID();
        UUID a28a = UUID.randomUUID();
        UUID a28b = UUID.randomUUID();
        UUID a29 = UUID.randomUUID();

        DailyStudyPlan day29 = planWithAssignments(classId, 3, FIXED_TODAY, a29);
        DailyStudyPlan day28 = planWithAssignments(classId, 2, LocalDate.of(2026, 10, 28), a28a, a28b);
        DailyStudyPlan day27 = planWithAssignments(classId, 1, LocalDate.of(2026, 10, 27), a27);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 10, 1))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(List.of(day29, day28, day27));

        // 28/10 chỉ làm 1/2 bài; 29/10 chưa làm -> chuỗi hiện tại về 0
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a27, onDateAtNoon(LocalDate.of(2026, 10, 27))},
                        new Object[]{a28a, onDateAtNoon(LocalDate.of(2026, 10, 28))}
                ));

        assertThat(userStreakService.getCurrentStreak(studentId)).isZero();

        // Hôm nay làm xong 100% bài 29/10 -> bắt đầu lại chuỗi mới = 1
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a27, onDateAtNoon(LocalDate.of(2026, 10, 27))},
                        new Object[]{a28a, onDateAtNoon(LocalDate.of(2026, 10, 28))},
                        new Object[]{a29, onDateAtNoon(FIXED_TODAY)}
                ));

        int streakAfterToday = userStreakService.updateStreakOnPlanCompletion(studentId, FIXED_TODAY);
        assertThat(streakAfterToday).isEqualTo(1);
        assertThat(student.getCurrentStreak()).isEqualTo(1);
        assertThat(student.getLastActiveDate()).isEqualTo(FIXED_TODAY);
    }

    @Test
    @DisplayName("Làm bù bài ngày cũ sau scheduledDate không khôi phục chuỗi đã đứt, nhưng làm lại bài đã nộp đúng hạn vẫn giữ chuỗi")
    void should_NotRestoreStreakOnLateMakeup_and_ShouldPreserveStreakOnRetake() {
        UUID studentId = UUID.fromString("55555555-5555-5555-5555-555555555555");
        UUID classId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        Student student = Student.builder().id(studentId).currentStreak(1).build();

        UUID a27 = UUID.randomUUID();
        UUID a28 = UUID.randomUUID();
        UUID a29 = UUID.randomUUID();

        DailyStudyPlan day29 = planWithAssignments(classId, 3, FIXED_TODAY, a29);
        DailyStudyPlan day28 = planWithAssignments(classId, 2, LocalDate.of(2026, 10, 28), a28);
        DailyStudyPlan day27 = planWithAssignments(classId, 1, LocalDate.of(2026, 10, 27), a27);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 10, 1))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(List.of(day29, day28, day27));

        // Tình huống A: a28 nộp bù muộn vào 29/10 -> ngày 28/10 không được tính đúng hạn -> streak chỉ là 1
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a27, onDateAtNoon(LocalDate.of(2026, 10, 27))},
                        new Object[]{a28, onDateAtNoon(FIXED_TODAY)},
                        new Object[]{a29, onDateAtNoon(FIXED_TODAY)}
                ));

        assertThat(userStreakService.updateStreakOnPlanCompletion(studentId, FIXED_TODAY)).isEqualTo(1);

        // Tình huống B: a27 và a28 đều có earliest submission đúng ngày 27/10 & 28/10 (dù nộp lại hôm 29/10) -> streak = 3
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a27, onDateAtNoon(LocalDate.of(2026, 10, 27))},
                        new Object[]{a28, onDateAtNoon(LocalDate.of(2026, 10, 28))},
                        new Object[]{a29, onDateAtNoon(FIXED_TODAY)}
                ));

        assertThat(userStreakService.getCurrentStreak(studentId)).isEqualTo(3);
    }

    @Test
    @DisplayName("Hỗ trợ nhiều lớp đang theo học và bỏ qua các ngày trước thời điểm ghi danh vào lớp mới")
    void should_IgnorePreEnrollmentPlansAndRequireAllActiveClassTasksPerDate() {
        UUID studentId = UUID.fromString("66666666-6666-6666-6666-666666666666");
        UUID classA = UUID.fromString("aaaa1111-1111-1111-1111-111111111111");
        UUID classB = UUID.fromString("bbbb2222-2222-2222-2222-222222222222");
        Student student = Student.builder().id(studentId).currentStreak(2).build();

        UUID a27 = UUID.randomUUID();
        UUID a28 = UUID.randomUUID();
        UUID a29ClassA = UUID.randomUUID();
        UUID b29ClassB = UUID.randomUUID();
        UUID bOldPreEnroll = UUID.randomUUID();

        DailyStudyPlan planA27 = planWithAssignments(classA, 1, LocalDate.of(2026, 10, 27), a27);
        DailyStudyPlan planA28 = planWithAssignments(classA, 2, LocalDate.of(2026, 10, 28), a28);
        DailyStudyPlan planA29 = planWithAssignments(classA, 3, FIXED_TODAY, a29ClassA);
        DailyStudyPlan planB20PreEnroll = planWithAssignments(classB, 1, LocalDate.of(2026, 10, 20), bOldPreEnroll);
        DailyStudyPlan planB29 = planWithAssignments(classB, 2, FIXED_TODAY, b29ClassB);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId)).thenReturn(List.of(
                activeEnrollment(studentId, classA, LocalDate.of(2026, 10, 1)),
                activeEnrollment(studentId, classB, FIXED_TODAY)
        ));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classA, classB), FIXED_TODAY))
                .thenReturn(List.of(planA29, planB29, planA28, planA27, planB20PreEnroll));

        // Chỉ mới xong bài của lớp A hôm nay, chưa xong bài lớp B hôm nay -> giữ streak 2 ngày (lớp B ngày 20/10 bị bỏ qua)
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a27, onDateAtNoon(LocalDate.of(2026, 10, 27))},
                        new Object[]{a28, onDateAtNoon(LocalDate.of(2026, 10, 28))},
                        new Object[]{a29ClassA, onDateAtNoon(FIXED_TODAY)}
                ));

        StudentStreakResponse beforeB = userStreakService.getStreakSummary(studentId);
        assertThat(beforeB.getCurrentStreak()).isEqualTo(2);
        assertThat(beforeB.getTodayCompletedTasks()).isEqualTo(1);
        assertThat(beforeB.getTodayTotalTasks()).isEqualTo(2);
        assertThat(beforeB.getCompletedToday()).isFalse();

        // Hoàn thành nốt bài lớp B trong hôm nay -> streak tăng thành 3
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{a27, onDateAtNoon(LocalDate.of(2026, 10, 27))},
                        new Object[]{a28, onDateAtNoon(LocalDate.of(2026, 10, 28))},
                        new Object[]{a29ClassA, onDateAtNoon(FIXED_TODAY)},
                        new Object[]{b29ClassB, onDateAtNoon(FIXED_TODAY)}
                ));

        assertThat(userStreakService.updateStreakOnPlanCompletion(studentId, FIXED_TODAY)).isEqualTo(3);
    }

    @Test
    @DisplayName("Qua mốc giao thừa 31/12 không có bài -> 01/01 làm đủ vẫn nối tiếp chuỗi và xử lý edge cases")
    void should_HandleYearBoundaryAndEdgeCases() {
        Clock newYearClock = Clock.fixed(
                LocalDate.of(2027, 1, 1).atTime(9, 0).atZone(ZONE).toInstant(),
                ZONE);
        UserStreakServiceImpl newYearStreakService = new UserStreakServiceImpl(
                studentRepository,
                classStudentRepository,
                dailyStudyPlanRepository,
                assignmentAttemptRepository,
                newYearClock
        );

        UUID studentId = UUID.fromString("77777777-7777-7777-7777-777777777777");
        UUID classId = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
        Student student = Student.builder()
                .id(studentId)
                .currentStreak(1)
                .lastActiveDate(LocalDate.of(2026, 12, 30))
                .build();

        UUID aDec30 = UUID.randomUUID();
        UUID aJan01 = UUID.randomUUID();

        DailyStudyPlan jan01 = planWithAssignments(classId, 2, LocalDate.of(2027, 1, 1), aJan01);
        DailyStudyPlan dec30 = planWithAssignments(classId, 1, LocalDate.of(2026, 12, 30), aDec30);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 12, 1))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), LocalDate.of(2027, 1, 1)))
                .thenReturn(List.of(jan01, dec30));
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(
                        new Object[]{aDec30, onDateAtNoon(LocalDate.of(2026, 12, 30))},
                        new Object[]{aJan01, onDateAtNoon(LocalDate.of(2027, 1, 1))}
                ));

        int streak = newYearStreakService.updateStreakOnPlanCompletion(studentId, LocalDate.of(2027, 1, 1));
        assertThat(streak).isEqualTo(2);
        assertThat(student.getLastActiveDate()).isEqualTo(LocalDate.of(2027, 1, 1));

        // Gọi lại với ngày cũ hơn lastActiveDate -> không làm lùi lastActiveDate
        int nonRegressing = newYearStreakService.updateStreakOnPlanCompletion(studentId, LocalDate.of(2026, 12, 30));
        assertThat(nonRegressing).isEqualTo(2);
        assertThat(student.getLastActiveDate()).isEqualTo(LocalDate.of(2027, 1, 1));

        // Gọi với completionDate == null -> fallback LocalDate.now(clock) = 2027-01-01
        assertThat(newYearStreakService.updateStreakOnPlanCompletion(studentId, null)).isEqualTo(2);

        // Student không tồn tại -> getCurrentStreak = 0, updateStreakOnPlanCompletion ném ResourceNotFoundException
        UUID missingId = UUID.fromString("99999999-9999-9999-9999-999999999999");
        when(studentRepository.findById(missingId)).thenReturn(Optional.empty());
        assertThat(newYearStreakService.getCurrentStreak(missingId)).isZero();
        assertThat(newYearStreakService.getStreakSummary(null).getCurrentStreak()).isZero();
        assertThatThrownBy(() -> newYearStreakService.updateStreakOnPlanCompletion(missingId, FIXED_TODAY))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getStreakSummary_whenNoActiveEnrollments_returnsEmptySummary")
    void getStreakSummary_whenNoActiveEnrollments_returnsEmptySummary() {
        // Given
        UUID studentId = UUID.randomUUID();
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(Student.builder().id(studentId).build()));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId)).thenReturn(Collections.emptyList());

        // When
        StudentStreakResponse summary = userStreakService.getStreakSummary(studentId);

        // Then
        assertThat(summary.getCurrentStreak()).isZero();
        assertThat(summary.getLastActiveDate()).isNull();
        assertThat(summary.getHasHomeworkToday()).isFalse();
        assertThat(summary.getCompletedToday()).isFalse();
        verifyNoInteractions(dailyStudyPlanRepository, assignmentAttemptRepository);
    }

    @Test
    @DisplayName("getStreakSummary_whenActiveEnrollmentsHaveNoPlans_returnsEmptySummary")
    void getStreakSummary_whenActiveEnrollmentsHaveNoPlans_returnsEmptySummary() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID classId = UUID.randomUUID();
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(Student.builder().id(studentId).build()));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 10, 1))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(Collections.emptyList());

        // When
        StudentStreakResponse summary = userStreakService.getStreakSummary(studentId);

        // Then
        assertThat(summary.getCurrentStreak()).isZero();
        assertThat(summary.getLastActiveDate()).isNull();
        verifyNoInteractions(assignmentAttemptRepository);
    }

    @Test
    @DisplayName("getStreakSummary_whenEnrollmentHasNullEnrolledAt_stillEvaluatesPlans")
    void getStreakSummary_whenEnrollmentHasNullEnrolledAt_stillEvaluatesPlans() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID classId = UUID.randomUUID();
        UUID aId = UUID.randomUUID();
        ClassStudent enrollmentNoDate = ClassStudent.builder()
                .id(UUID.randomUUID())
                .classroom(Classroom.builder().id(classId).build())
                .student(Student.builder().id(studentId).build())
                .isActive(true)
                .enrolledAt(null)
                .build();
        DailyStudyPlan plan = planWithAssignments(classId, 1, FIXED_TODAY, aId);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(Student.builder().id(studentId).build()));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId)).thenReturn(List.of(enrollmentNoDate));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(List.of(plan));
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(new Object[][]{new Object[]{aId, FIXED_TODAY}}));

        // When
        StudentStreakResponse summary = userStreakService.getStreakSummary(studentId);

        // Then
        assertThat(summary.getCurrentStreak()).isEqualTo(1);
        assertThat(summary.getCompletedToday()).isTrue();
    }

    @Test
    @DisplayName("getStreakSummary_whenSubmissionTimestampsUseSqlDateTimestampLocalDateTimeOffsetDateTimeUtilDateAndStringUuid_parsesAllAndKeepsEarliestDate")
    void getStreakSummary_whenSubmissionTimestampsUseSqlDateTimestampLocalDateTimeOffsetDateTimeUtilDateAndStringUuid_parsesAllAndKeepsEarliestDate() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID classId = UUID.randomUUID();
        UUID aSqlDate = UUID.randomUUID();
        UUID aTimestamp = UUID.randomUUID();
        UUID aLocalDateTime = UUID.randomUUID();
        UUID aOffsetDateTime = UUID.randomUUID();
        UUID aUtilDate = UUID.randomUUID();

        DailyStudyPlan day25 = planWithAssignments(classId, 1, LocalDate.of(2026, 10, 25), aSqlDate);
        DailyStudyPlan day26 = planWithAssignments(classId, 2, LocalDate.of(2026, 10, 26), aTimestamp);
        DailyStudyPlan day27 = planWithAssignments(classId, 3, LocalDate.of(2026, 10, 27), aLocalDateTime);
        DailyStudyPlan day28 = planWithAssignments(classId, 4, LocalDate.of(2026, 10, 28), aOffsetDateTime);
        DailyStudyPlan day29 = planWithAssignments(classId, 5, FIXED_TODAY, aUtilDate);

        List<Object[]> rows = new ArrayList<>();
        rows.add(null);
        rows.add(new Object[]{aSqlDate});
        rows.add(new Object[]{"not-a-uuid", FIXED_TODAY});
        rows.add(new Object[]{aSqlDate.toString(), java.sql.Date.valueOf(LocalDate.of(2026, 10, 25))});
        // Nộp 2 lần (28/10 và 26/10) -> giữ ngày sớm nhất 26/10 nên vẫn tính đúng hạn cho day26
        rows.add(new Object[]{aTimestamp, Timestamp.from(onDateAtNoon(LocalDate.of(2026, 10, 28)))});
        rows.add(new Object[]{aTimestamp, Timestamp.from(onDateAtNoon(LocalDate.of(2026, 10, 26)))});
        rows.add(new Object[]{aLocalDateTime, LocalDateTime.of(2026, 10, 27, 8, 30)});
        rows.add(new Object[]{aOffsetDateTime, OffsetDateTime.of(2026, 10, 28, 15, 0, 0, 0, ZoneOffset.ofHours(7))});
        rows.add(new Object[]{aUtilDate, new Date(onDateAtNoon(FIXED_TODAY).toEpochMilli())});

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(Student.builder().id(studentId).build()));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 10, 1))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(List.of(day29, day28, day27, day26, day25));
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(rows);

        // When
        StudentStreakResponse summary = userStreakService.getStreakSummary(studentId);

        // Then
        assertThat(summary.getCurrentStreak()).isEqualTo(5);
        assertThat(summary.getLastActiveDate()).isEqualTo(FIXED_TODAY);
        assertThat(summary.getCompletedToday()).isTrue();
    }

    @Test
    @DisplayName("getStreakSummary_whenTodayHomeworkNotStartedYetAndYesterdayCompleted_preservesActiveStreak")
    void getStreakSummary_whenTodayHomeworkNotStartedYetAndYesterdayCompleted_preservesActiveStreak() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID classId = UUID.randomUUID();
        UUID aYesterday = UUID.randomUUID();
        UUID aToday = UUID.randomUUID();

        DailyStudyPlan yesterdayPlan = planWithAssignments(classId, 1, FIXED_TODAY.minusDays(1), aYesterday);
        DailyStudyPlan todayPlan = planWithAssignments(classId, 2, FIXED_TODAY, aToday);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(Student.builder().id(studentId).build()));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 10, 1))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(List.of(todayPlan, yesterdayPlan));
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(new Object[][]{new Object[]{aYesterday, onDateAtNoon(FIXED_TODAY.minusDays(1))}}));

        // When
        StudentStreakResponse summary = userStreakService.getStreakSummary(studentId);

        // Then
        assertThat(summary.getCurrentStreak()).isEqualTo(1);
        assertThat(summary.getLastActiveDate()).isEqualTo(FIXED_TODAY.minusDays(1));
        assertThat(summary.getHasHomeworkToday()).isTrue();
        assertThat(summary.getCompletedToday()).isFalse();
        assertThat(summary.getTodayCompletedTasks()).isZero();
        assertThat(summary.getTodayTotalTasks()).isEqualTo(1);
    }

    @Test
    @DisplayName("getStreakSummary_whenYesterdayMissed_breaksCurrentStreakToZero")
    void getStreakSummary_whenYesterdayMissed_breaksCurrentStreakToZero() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID classId = UUID.randomUUID();
        UUID aDayBefore = UUID.randomUUID();
        UUID aYesterday = UUID.randomUUID();

        DailyStudyPlan dayBeforePlan = planWithAssignments(classId, 1, FIXED_TODAY.minusDays(2), aDayBefore);
        DailyStudyPlan yesterdayPlan = planWithAssignments(classId, 2, FIXED_TODAY.minusDays(1), aYesterday);

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(Student.builder().id(studentId).build()));
        when(classStudentRepository.findByStudentIdAndIsActiveTrue(studentId))
                .thenReturn(List.of(activeEnrollment(studentId, classId, LocalDate.of(2026, 10, 1))));
        when(dailyStudyPlanRepository.findByClassroomIdsWithItemsUpToDate(Set.of(classId), FIXED_TODAY))
                .thenReturn(List.of(yesterdayPlan, dayBeforePlan));
        when(assignmentAttemptRepository.findEarliestSubmissionTimeByAssignmentForStudent(studentId))
                .thenReturn(List.of(new Object[][]{new Object[]{aDayBefore, onDateAtNoon(FIXED_TODAY.minusDays(2))}}));

        // When
        StudentStreakResponse summary = userStreakService.getStreakSummary(studentId);

        // Then
        assertThat(summary.getCurrentStreak()).isZero();
        assertThat(summary.getLastActiveDate()).isNull();
        assertThat(summary.getHasHomeworkToday()).isFalse();
    }
}
