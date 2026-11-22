package com.englishlearning.curriculum.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.User;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ForbiddenException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import com.englishlearning.curriculum.service.impl.DailyStudyPlanServiceImpl;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DailyStudyPlanServiceImplTest {

    @Mock
    private DailyStudyPlanRepository dailyStudyPlanRepository;

    @Mock
    private DailyPlanItemRepository dailyPlanItemRepository;

    @Mock
    private StudentDailyProgressRepository progressRepository;

    @Mock
    private AssignmentAttemptRepository attemptRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private ClassStudentRepository classStudentRepository;

    @Mock
    private AssignmentRepository assignmentRepository;

    @Mock
    private UserStreakService userStreakService;

    @InjectMocks
    private DailyStudyPlanServiceImpl dailyStudyPlanService;

    @Test
    @DisplayName("should_NotCompleteDay_when_OnlyOneOfThreeTasksSubmitted: Làm 1/3 bài tập thì ngày chưa hoàn thành và chỉ bài đó isDone=true")
    void should_NotCompleteDay_when_OnlyOneOfThreeTasksSubmitted() {
        // Given
        UUID classroomId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();

        when(classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)).thenReturn(true);

        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(1)
                .title("DAY 1: Pronunciation & Grammar")
                .scheduledDate(LocalDate.now())
                .estimatedMinutes(30)
                .isUnlocked(true)
                .build();

        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId))
                .thenReturn(List.of(plan));

        UUID assign1 = UUID.randomUUID();
        UUID assign2 = UUID.randomUUID();
        UUID assign3 = UUID.randomUUID();

        DailyPlanItem item1 = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .title("Task 1: Pronunciation")
                .sectionName("Speaking")
                .orderIndex(1)
                .assignment(Assignment.builder().id(assign1).build())
                .build();

        DailyPlanItem item2 = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .title("Task 2: Grammar Quiz")
                .sectionName("Grammar")
                .orderIndex(2)
                .assignment(Assignment.builder().id(assign2).build())
                .build();

        DailyPlanItem item3 = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .title("Task 3: Vocabulary")
                .sectionName("Vocabulary")
                .orderIndex(3)
                .assignment(Assignment.builder().id(assign3).build())
                .build();

        List<DailyPlanItem> items = List.of(item1, item2, item3);
        when(dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(planId)).thenReturn(items);

        // Chỉ có bài 1 được nộp (countAttempts > 0), bài 2 và 3 chưa nộp
        when(attemptRepository.countAttempts(assign1, studentId)).thenReturn(1);
        when(attemptRepository.countAttempts(assign2, studentId)).thenReturn(0);
        when(attemptRepository.countAttempts(assign3, studentId)).thenReturn(0);

        // When
        DailyHomeworkOverviewResponse response = dailyStudyPlanService.getStudentDailyOverview(classroomId, studentId, planId);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getDays().get(0).getIsCompleted()).isFalse();

        DayDetailDto currentDay = response.getCurrentSelectedDay();
        assertThat(currentDay).isNotNull();
        assertThat(currentDay.getIsCompleted()).isFalse();

        // Kiểm tra từng item
        var allItems = currentDay.getSections().stream().flatMap(s -> s.getItems().stream()).toList();
        assertThat(allItems).hasSize(3);

        var task1 = allItems.stream().filter(t -> t.getAssignmentId().equals(assign1)).findFirst().orElseThrow();
        var task2 = allItems.stream().filter(t -> t.getAssignmentId().equals(assign2)).findFirst().orElseThrow();
        var task3 = allItems.stream().filter(t -> t.getAssignmentId().equals(assign3)).findFirst().orElseThrow();

        assertThat(task1.getIsDone()).isTrue();
        assertThat(task2.getIsDone()).isFalse();
        assertThat(task3.getIsDone()).isFalse();
    }

    @Test
    @DisplayName("should_CompleteDay_when_AllThreeTasksSubmitted: Nộp đủ cả 3 bài tập thì ngày học mới hoàn thành")
    void should_CompleteDay_when_AllThreeTasksSubmitted() {
        // Given
        UUID classroomId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();

        when(classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)).thenReturn(true);

        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(1)
                .title("DAY 1: Pronunciation & Grammar")
                .scheduledDate(LocalDate.now())
                .estimatedMinutes(30)
                .isUnlocked(true)
                .build();

        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId))
                .thenReturn(List.of(plan));

        UUID assign1 = UUID.randomUUID();
        UUID assign2 = UUID.randomUUID();
        UUID assign3 = UUID.randomUUID();

        DailyPlanItem item1 = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .title("Task 1: Pronunciation")
                .sectionName("Speaking")
                .orderIndex(1)
                .assignment(Assignment.builder().id(assign1).build())
                .build();

        DailyPlanItem item2 = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .title("Task 2: Grammar Quiz")
                .sectionName("Grammar")
                .orderIndex(2)
                .assignment(Assignment.builder().id(assign2).build())
                .build();

        DailyPlanItem item3 = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .title("Task 3: Vocabulary")
                .sectionName("Vocabulary")
                .orderIndex(3)
                .assignment(Assignment.builder().id(assign3).build())
                .build();

        List<DailyPlanItem> items = List.of(item1, item2, item3);
        when(dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(planId)).thenReturn(items);

        // Cả 3 bài đều đã nộp
        when(attemptRepository.countAttempts(assign1, studentId)).thenReturn(1);
        when(attemptRepository.countAttempts(assign2, studentId)).thenReturn(1);
        when(attemptRepository.countAttempts(assign3, studentId)).thenReturn(1);
        when(userStreakService.getStreakSummary(studentId)).thenReturn(StudentStreakResponse.builder()
                .currentStreak(4)
                .hasHomeworkToday(true)
                .completedToday(true)
                .todayCompletedTasks(3)
                .todayTotalTasks(3)
                .build());

        // When
        DailyHomeworkOverviewResponse response = dailyStudyPlanService.getStudentDailyOverview(classroomId, studentId, planId);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getDays().get(0).getIsCompleted()).isTrue();
        assertThat(response.getCompletionPercentage()).isEqualTo(100);
        assertThat(response.getCurrentStreak()).isEqualTo(4);
        assertThat(response.getHasHomeworkToday()).isTrue();
        assertThat(response.getCompletedToday()).isTrue();

        DayDetailDto currentDay = response.getCurrentSelectedDay();
        assertThat(currentDay).isNotNull();
        assertThat(currentDay.getIsCompleted()).isTrue();

        var allItems = currentDay.getSections().stream().flatMap(s -> s.getItems().stream()).toList();
        assertThat(allItems).hasSize(3);
        assertThat(allItems).allMatch(t -> Boolean.TRUE.equals(t.getIsDone()));
    }

    @Test
    @DisplayName("getStudentDailyOverview - Chặn học viên ngoài lớp, danh sách rỗng và đường dẫn batch-fetch + null section")
    void getStudentDailyOverview_batchPathAndEdgeCases() {
        UUID classroomId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        when(classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)).thenReturn(false);

        assertThatThrownBy(() -> dailyStudyPlanService.getStudentDailyOverview(classroomId, studentId, null))
                .isInstanceOf(ForbiddenException.class);

        when(classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)).thenReturn(true);
        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId)).thenReturn(Collections.emptyList());

        DailyHomeworkOverviewResponse emptyRes = dailyStudyPlanService.getStudentDailyOverview(classroomId, studentId, null);
        assertThat(emptyRes.getCompletionPercentage()).isEqualTo(100);
        assertThat(emptyRes.getCurrentSelectedDay()).isNull();

        UUID planId = UUID.randomUUID();
        UUID a1 = UUID.randomUUID();
        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(2)
                .title(null)
                .scheduledDate(LocalDate.now().minusDays(1))
                .estimatedMinutes(25)
                .isUnlocked(false)
                .build();
        DailyPlanItem i1 = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .dailyPlan(plan)
                .sectionName(null)
                .title("Reading Practice")
                .itemType("READING")
                .orderIndex(1)
                .assignment(Assignment.builder().id(a1).build())
                .build();

        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId)).thenReturn(List.of(plan));
        when(dailyPlanItemRepository.findByClassroomIdWithDailyPlanAndAssignment(classroomId)).thenReturn(List.of(i1));
        when(attemptRepository.findCompletedAssignmentIdsByStudentId(studentId)).thenReturn(Set.of(a1));

        DailyHomeworkOverviewResponse batchRes = dailyStudyPlanService.getStudentDailyOverview(classroomId, studentId, null);
        assertThat(batchRes.getTotalDays()).isEqualTo(1);
        assertThat(batchRes.getCompletedDays()).isEqualTo(1);
        assertThat(batchRes.getCompletionPercentage()).isEqualTo(100);
        assertThat(batchRes.getCurrentSelectedDay().getTitle()).isEqualTo("DAY 2");
        assertThat(batchRes.getCurrentSelectedDay().getSections().get(0).getSectionName()).isEqualTo("CORE");
        verify(attemptRepository, never()).countAttempts(any(), any());
    }

    @Test
    @DisplayName("createDailyPlan & updateDailyPlan - Tự động đặt title mặc định, isUnlocked theo ngày và báo 404")
    void createAndUpdateDailyPlan_allBranches() {
        UUID classId = UUID.randomUUID();
        Classroom classroom = Classroom.builder().id(classId).build();
        CreateDailyPlanRequest createReq = new CreateDailyPlanRequest();
        createReq.setClassroomId(classId);
        createReq.setDayNumber(7);
        createReq.setScheduledDate(LocalDate.now());
        createReq.setTitle("   ");
        createReq.setEstimatedMinutes(45);

        when(entityManager.find(Classroom.class, classId)).thenReturn(classroom);
        when(dailyStudyPlanRepository.save(any(DailyStudyPlan.class))).thenAnswer(inv -> {
            DailyStudyPlan p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });

        DailyStudyPlan createdToday = dailyStudyPlanService.createDailyPlan(createReq);
        assertThat(createdToday.getTitle()).isEqualTo("DAY 7");
        assertThat(createdToday.getIsUnlocked()).isTrue();

        createReq.setScheduledDate(LocalDate.now().plusDays(3));
        createReq.setTitle("Future Day");
        DailyStudyPlan createdFuture = dailyStudyPlanService.createDailyPlan(createReq);
        assertThat(createdFuture.getTitle()).isEqualTo("Future Day");
        assertThat(createdFuture.getIsUnlocked()).isFalse();

        UUID missingClass = UUID.randomUUID();
        createReq.setClassroomId(missingClass);
        when(entityManager.find(Classroom.class, missingClass)).thenReturn(null);
        assertThatThrownBy(() -> dailyStudyPlanService.createDailyPlan(createReq))
                .isInstanceOf(ResourceNotFoundException.class);

        UUID planId = createdToday.getId();
        UpdateDailyPlanRequest updateReq = new UpdateDailyPlanRequest();
        updateReq.setTitle("Updated Day 7");
        updateReq.setDayNumber(8);
        updateReq.setScheduledDate(LocalDate.now().plusDays(1));
        updateReq.setEstimatedMinutes(60);
        updateReq.setIsUnlocked(true);

        when(dailyStudyPlanRepository.findById(planId)).thenReturn(Optional.of(createdToday));
        DailyStudyPlan updated = dailyStudyPlanService.updateDailyPlan(planId, updateReq);
        assertThat(updated.getTitle()).isEqualTo("Updated Day 7");
        assertThat(updated.getDayNumber()).isEqualTo(8);
        assertThat(updated.getEstimatedMinutes()).isEqualTo(60);

        UUID missingPlan = UUID.randomUUID();
        when(dailyStudyPlanRepository.findById(missingPlan)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> dailyStudyPlanService.updateDailyPlan(missingPlan, updateReq))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getPlansByClassroom & getAssignmentsByDailyPlan - Fallback sort an toàn với List bất biến và gộp bài tập không trùng lặp")
    void getPlansAndAssignments_allBranches() {
        UUID classId = UUID.randomUUID();
        DailyStudyPlan p2 = DailyStudyPlan.builder().id(UUID.randomUUID()).dayNumber(2).build();
        DailyStudyPlan p1 = DailyStudyPlan.builder().id(UUID.randomUUID()).dayNumber(1).build();
        DailyStudyPlan pNullDay = DailyStudyPlan.builder().id(UUID.randomUUID()).dayNumber(null).build();

        when(dailyStudyPlanRepository.findByClassroomIdWithItems(classId)).thenReturn(Collections.emptyList());
        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classId))
                .thenReturn(List.of(p2, pNullDay, p1)); // immutable list

        List<DailyStudyPlan> sorted = dailyStudyPlanService.getPlansByClassroom(classId);
        assertThat(sorted).containsExactly(p1, p2, pNullDay);

        // getAssignmentsByDailyPlan
        UUID planId = UUID.randomUUID();
        LocalDate planDate = LocalDate.of(2026, 11, 13);
        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(3)
                .scheduledDate(planDate)
                .classroom(Classroom.builder().id(classId).build())
                .build();
        UUID aDirectId = UUID.randomUUID();
        UUID aDueDateId = UUID.randomUUID();
        UUID aTitleVnId = UUID.randomUUID();
        UUID aUnrelatedId = UUID.randomUUID();

        Assignment aDirect = Assignment.builder().id(aDirectId).title("Direct Item").build();
        Assignment aDueDate = Assignment.builder().id(aDueDateId).title("Popup Quiz")
                .dueDate(planDate.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant()).build();
        Assignment aTitleVn = Assignment.builder().id(aTitleVnId).title("Bài tập Ngày 3").build();
        Assignment aUnrelated = Assignment.builder().id(aUnrelatedId).title("Day 9 Homework").build();

        when(dailyStudyPlanRepository.findById(planId)).thenReturn(Optional.of(plan));
        when(dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(planId)).thenReturn(List.of(
                DailyPlanItem.builder().assignment(aDirect).build()));
        when(assignmentRepository.findByClassroomId(classId))
                .thenReturn(List.of(aDirect, aDueDate, aTitleVn, aUnrelated));

        List<Assignment> combined = dailyStudyPlanService.getAssignmentsByDailyPlan(planId);
        assertThat(combined).extracting(Assignment::getId)
                .containsExactly(aDirectId, aDueDateId, aTitleVnId);
    }

    @Test
    @DisplayName("addPlanItem, deletePlanItem, deleteDailyPlan & markDayAsCompleted - Xử lý CRUD, assignment không tồn tại & null items")
    void planItemCrudAndMarkDayCompleted_allBranches() {
        UUID planId = UUID.randomUUID();
        UUID assignId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();

        DailyStudyPlan plan = DailyStudyPlan.builder().id(planId).items(null).build();
        CreatePlanItemRequest itemReq = new CreatePlanItemRequest();
        itemReq.setSectionName("A. CORE");
        itemReq.setTitle("1. Listening");
        itemReq.setItemType("LISTENING");
        itemReq.setOrderIndex(1);
        itemReq.setAssignmentId(assignId);

        when(dailyStudyPlanRepository.findById(planId)).thenReturn(Optional.of(plan));
        when(entityManager.find(Assignment.class, assignId)).thenReturn(null);
        assertThatThrownBy(() -> dailyStudyPlanService.addPlanItem(planId, itemReq))
                .isInstanceOf(ResourceNotFoundException.class);

        Assignment assignment = Assignment.builder().id(assignId).build();
        when(entityManager.find(Assignment.class, assignId)).thenReturn(assignment);
        when(dailyPlanItemRepository.save(any(DailyPlanItem.class))).thenAnswer(inv -> inv.getArgument(0));
        DailyPlanItem savedItem = dailyStudyPlanService.addPlanItem(planId, itemReq);
        assertThat(savedItem.getAssignment()).isEqualTo(assignment);

        // deletePlanItem & deleteDailyPlan
        UUID itemId = UUID.randomUUID();
        when(dailyPlanItemRepository.existsById(itemId)).thenReturn(true, false);
        dailyStudyPlanService.deletePlanItem(itemId);
        verify(dailyPlanItemRepository).deleteById(itemId);
        assertThatThrownBy(() -> dailyStudyPlanService.deletePlanItem(itemId))
                .isInstanceOf(ResourceNotFoundException.class);

        when(dailyStudyPlanRepository.existsById(planId)).thenReturn(true, false);
        dailyStudyPlanService.deleteDailyPlan(planId);
        verify(dailyStudyPlanRepository).deleteById(planId);
        assertThatThrownBy(() -> dailyStudyPlanService.deleteDailyPlan(planId))
                .isInstanceOf(ResourceNotFoundException.class);

        // markDayAsCompleted with null items list & absent progress
        Student studentRef = Student.builder().id(studentId).build();
        when(progressRepository.findByStudentIdAndDailyPlanId(studentId, planId)).thenReturn(Optional.empty());
        when(entityManager.getReference(Student.class, studentId)).thenReturn(studentRef);

        dailyStudyPlanService.markDayAsCompleted(studentId, planId);

        ArgumentCaptor<StudentDailyProgress> progressCaptor = ArgumentCaptor.forClass(StudentDailyProgress.class);
        verify(progressRepository).save(progressCaptor.capture());
        assertThat(progressCaptor.getValue().getIsCompleted()).isTrue();
        assertThat(progressCaptor.getValue().getTotalItemsCount()).isZero();
        assertThat(progressCaptor.getValue().getCompletedItemsCount()).isZero();
    }

    @Test
    @DisplayName("getDailyProgressStatsMatrix - Tính overallRate, số phút học và fallback email khi tên trống")
    @SuppressWarnings("unchecked")
    void getDailyProgressStatsMatrix_computesMatrixCorrectly() {
        UUID classId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        TypedQuery<ClassStudent> enrollmentQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("FROM ClassStudent cs"), eq(ClassStudent.class)))
                .thenReturn(enrollmentQuery);
        when(enrollmentQuery.setParameter("classId", classId)).thenReturn(enrollmentQuery);

        // 1. Empty enrollments -> empty result
        when(enrollmentQuery.getResultList()).thenReturn(Collections.emptyList());
        assertThat(dailyStudyPlanService.getDailyProgressStatsMatrix(classId)).isEmpty();

        // 2. Active enrollment + 2 days (Day 1 finished by progress, Day 2 1/2 tasks via attempt)
        User user = User.builder().id(studentId).email("anon@test.com").firstName("").lastName(null).build();
        Student student = Student.builder().id(studentId).user(user).build();
        ClassStudent cs = ClassStudent.builder().student(student).isActive(true).build();
        when(enrollmentQuery.getResultList()).thenReturn(List.of(cs));

        UUID day1Id = UUID.randomUUID();
        UUID day2Id = UUID.randomUUID();
        UUID assignId = UUID.randomUUID();

        DailyStudyPlan day1 = DailyStudyPlan.builder().id(day1Id).dayNumber(1).estimatedMinutes(40).build();
        DailyPlanItem d2Assign = DailyPlanItem.builder().assignment(Assignment.builder().id(assignId).build()).build();
        DailyPlanItem d2Reading = DailyPlanItem.builder().assignment(null).build();
        DailyStudyPlan day2 = DailyStudyPlan.builder().id(day2Id).dayNumber(2).items(List.of(d2Assign, d2Reading)).build();

        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classId)).thenReturn(List.of(day2, day1));

        TypedQuery<AssignmentAttempt> attemptQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("FROM AssignmentAttempt a"), eq(AssignmentAttempt.class)))
                .thenReturn(attemptQuery);
        when(attemptQuery.setParameter("studentIds", List.of(studentId))).thenReturn(attemptQuery);
        when(attemptQuery.getResultList()).thenReturn(List.of(AssignmentAttempt.builder()
                .student(student)
                .assignment(Assignment.builder().id(assignId).build())
                .durationSeconds(180)
                .build()));

        when(progressRepository.findByStudentIdAndDailyPlanId(studentId, day1Id))
                .thenReturn(Optional.of(StudentDailyProgress.builder().isCompleted(true).build()));
        when(progressRepository.findByStudentIdAndDailyPlanId(studentId, day2Id))
                .thenReturn(Optional.empty());

        List<DailyProgressStatResponse> stats = dailyStudyPlanService.getDailyProgressStatsMatrix(classId);

        assertThat(stats).hasSize(1);
        DailyProgressStatResponse st = stats.get(0);
        assertThat(st.getStudentName()).isEqualTo("anon@test.com");
        assertThat(st.getOverallRate()).isEqualTo(50); // 1 completed day out of 2 plans
        assertThat(st.getDays()).hasSize(2);
        assertThat(st.getDays().get(0).getDayNumber()).isEqualTo(1);
        assertThat(st.getDays().get(0).getRate()).isEqualTo(100);
        assertThat(st.getDays().get(0).getMinutes()).isEqualTo(40);
        assertThat(st.getDays().get(1).getDayNumber()).isEqualTo(2);
        assertThat(st.getDays().get(1).getRate()).isEqualTo(50);
        assertThat(st.getDays().get(1).getMinutes()).isEqualTo(3);
    }

    @Test
    @DisplayName("createDailyPlan: Tự động tính max(dayNumber) + 1 khi dayNumber <= 0 hoặc null")
    void createDailyPlan_whenDayNumberInvalid_calculatesNextFromExistingMax() {
        UUID classId = UUID.randomUUID();
        Classroom classroom = Classroom.builder().id(classId).build();
        DailyStudyPlan day17 = DailyStudyPlan.builder()
                .id(UUID.randomUUID())
                .classroom(classroom)
                .dayNumber(17)
                .title("DAY 17")
                .scheduledDate(LocalDate.of(2026, 5, 26))
                .build();

        CreateDailyPlanRequest req = new CreateDailyPlanRequest();
        req.setClassroomId(classId);
        req.setDayNumber(0);
        req.setScheduledDate(LocalDate.of(2026, 5, 27));

        when(entityManager.find(Classroom.class, classId)).thenReturn(classroom);
        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classId))
                .thenReturn(List.of(day17));
        when(dailyStudyPlanRepository.save(any(DailyStudyPlan.class)))
                .thenAnswer(inv -> {
                    DailyStudyPlan p = inv.getArgument(0);
                    p.setId(UUID.randomUUID());
                    return p;
                });

        DailyStudyPlan created = dailyStudyPlanService.createDailyPlan(req);

        assertThat(created.getDayNumber()).isEqualTo(18);
        assertThat(created.getTitle()).isEqualTo("DAY 18");
    }

    @Test
    @DisplayName("addPlanItem: Cập nhật tại chỗ thay vì nhân bản khi assignmentId đã tồn tại trong plan")
    void addPlanItem_whenAssignmentAlreadyExistsInPlan_updatesExistingItemInPlace() {
        UUID planId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        UUID existingItemId = UUID.randomUUID();
        Classroom classroom = Classroom.builder().id(UUID.randomUUID()).build();
        Assignment assignment = Assignment.builder().id(assignmentId).title("Unit 1").build();
        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(planId)
                .classroom(classroom)
                .dayNumber(1)
                .build();
        DailyPlanItem existingItem = DailyPlanItem.builder()
                .id(existingItemId)
                .dailyPlan(plan)
                .assignment(assignment)
                .sectionName("Cũ")
                .title("Tên cũ")
                .itemType("ASSIGNMENT")
                .orderIndex(1)
                .build();

        CreatePlanItemRequest req = new CreatePlanItemRequest();
        req.setSectionName("Mới");
        req.setTitle("Bài tập đã cập nhật");
        req.setItemType("ASSIGNMENT");
        req.setOrderIndex(3);
        req.setAssignmentId(assignmentId);

        when(dailyStudyPlanRepository.findById(planId)).thenReturn(Optional.of(plan));
        when(entityManager.find(Assignment.class, assignmentId)).thenReturn(assignment);
        when(dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(planId))
                .thenReturn(List.of(existingItem));
        when(dailyPlanItemRepository.save(any(DailyPlanItem.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        DailyPlanItem saved = dailyStudyPlanService.addPlanItem(planId, req);

        assertThat(saved.getId()).isEqualTo(existingItemId);
        assertThat(saved.getTitle()).isEqualTo("Bài tập đã cập nhật");
        assertThat(saved.getSectionName()).isEqualTo("Mới");
        verify(dailyPlanItemRepository).save(existingItem);
    }

    @Test
    @DisplayName("getStudentDailyOverview_whenPlanHasNullScheduledDate_handlesSafelyWithoutNpe")
    void getStudentDailyOverview_whenPlanHasNullScheduledDate_handlesSafelyWithoutNpe() {
        // Given
        UUID classroomId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        when(classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)).thenReturn(true);

        DailyStudyPlan nullDateUnlockedPlan = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(1)
                .title("DAY 1 Flexible")
                .scheduledDate(null)
                .estimatedMinutes(20)
                .isUnlocked(true)
                .build();
        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId))
                .thenReturn(List.of(nullDateUnlockedPlan));
        when(dailyPlanItemRepository.findByClassroomIdWithDailyPlanAndAssignment(classroomId))
                .thenReturn(Collections.emptyList());
        when(dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(planId))
                .thenReturn(Collections.emptyList());

        // When
        DailyHomeworkOverviewResponse response = dailyStudyPlanService.getStudentDailyOverview(classroomId, studentId, null);

        // Then
        assertThat(response.getTotalDays()).isEqualTo(1);
        assertThat(response.getCompletedDays()).isZero();
        assertThat(response.getDays()).hasSize(1);
        assertThat(response.getDays().get(0).getDateLabel()).isEmpty();
        assertThat(response.getDays().get(0).getIsCurrentDay()).isFalse();
        assertThat(response.getDays().get(0).getIsUnlocked()).isTrue();
        assertThat(response.getCurrentSelectedDay()).isNotNull();
        assertThat(response.getCurrentSelectedDay().getFullHeaderLabel()).isEqualTo("DAY 1 Flexible");
    }

    @Test
    @DisplayName("getStudentDailyOverview_whenAllPlansInFutureLocked_returnsZeroTotalDays100PercentAndFallsBackToFirstPlan")
    void getStudentDailyOverview_whenAllPlansInFutureLocked_returnsZeroTotalDays100PercentAndFallsBackToFirstPlan() {
        // Given
        UUID classroomId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        when(classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)).thenReturn(true);

        DailyStudyPlan futureLockedPlan = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(10)
                .title("DAY 10 Future")
                .scheduledDate(LocalDate.now().plusDays(5))
                .estimatedMinutes(30)
                .isUnlocked(false)
                .build();
        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId))
                .thenReturn(List.of(futureLockedPlan));
        when(dailyPlanItemRepository.findByClassroomIdWithDailyPlanAndAssignment(classroomId))
                .thenReturn(Collections.emptyList());
        when(dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(planId))
                .thenReturn(Collections.emptyList());

        // When
        DailyHomeworkOverviewResponse response = dailyStudyPlanService.getStudentDailyOverview(classroomId, studentId, null);

        // Then
        assertThat(response.getTotalDays()).isZero();
        assertThat(response.getCompletedDays()).isZero();
        assertThat(response.getCompletionPercentage()).isEqualTo(100);
        assertThat(response.getCurrentSelectedDay()).isNotNull();
        assertThat(response.getCurrentSelectedDay().getId()).isEqualTo(planId);
        assertThat(response.getDays().get(0).getIsUnlocked()).isFalse();
    }

    @Test
    @DisplayName("getStudentDailyOverview_whenSelectedDayIdNotFound_fallsBackToUnlockedOrFirstPlan")
    void getStudentDailyOverview_whenSelectedDayIdNotFound_fallsBackToUnlockedOrFirstPlan() {
        // Given
        UUID classroomId = UUID.randomUUID();
        UUID pastPlanId = UUID.randomUUID();
        UUID futurePlanId = UUID.randomUUID();
        UUID unknownSelectedId = UUID.randomUUID();

        DailyStudyPlan futurePlan = DailyStudyPlan.builder()
                .id(futurePlanId)
                .dayNumber(2)
                .title("DAY 2")
                .scheduledDate(LocalDate.now().plusDays(2))
                .isUnlocked(false)
                .build();
        DailyStudyPlan pastPlan = DailyStudyPlan.builder()
                .id(pastPlanId)
                .dayNumber(1)
                .title("DAY 1")
                .scheduledDate(LocalDate.now().minusDays(1))
                .isUnlocked(true)
                .build();

        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId))
                .thenReturn(List.of(futurePlan, pastPlan));
        when(dailyPlanItemRepository.findByClassroomIdWithDailyPlanAndAssignment(classroomId))
                .thenReturn(Collections.emptyList());
        when(dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(any()))
                .thenReturn(Collections.emptyList());

        // When
        DailyHomeworkOverviewResponse response = dailyStudyPlanService.getStudentDailyOverview(classroomId, null, unknownSelectedId);

        // Then
        assertThat(response.getCurrentSelectedDay()).isNotNull();
        assertThat(response.getCurrentSelectedDay().getId()).isEqualTo(pastPlanId);
        verify(classStudentRepository, never()).existsByClassroomIdAndStudentId(any(), any());
        verifyNoInteractions(userStreakService, attemptRepository);
    }

    @Test
    @DisplayName("createDailyPlan_whenScheduledDateNull_throwsBadRequestException")
    void createDailyPlan_whenScheduledDateNull_throwsBadRequestException() {
        // Given
        CreateDailyPlanRequest req = new CreateDailyPlanRequest();
        req.setClassroomId(UUID.randomUUID());
        req.setDayNumber(1);
        req.setScheduledDate(null);

        // When / Then
        assertThatThrownBy(() -> dailyStudyPlanService.createDailyPlan(req))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(dailyStudyPlanRepository);
    }

    @Test
    @DisplayName("createDailyPlan_whenDayNumberNullAndNoExistingPlans_assignsDay1AndDefaultTitle")
    void createDailyPlan_whenDayNumberNullAndNoExistingPlans_assignsDay1AndDefaultTitle() {
        // Given
        UUID classId = UUID.randomUUID();
        Classroom classroom = Classroom.builder().id(classId).build();
        CreateDailyPlanRequest req = new CreateDailyPlanRequest();
        req.setClassroomId(classId);
        req.setDayNumber(null);
        req.setTitle(null);
        req.setScheduledDate(LocalDate.now());

        when(entityManager.find(Classroom.class, classId)).thenReturn(classroom);
        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classId))
                .thenReturn(Collections.emptyList());
        when(dailyStudyPlanRepository.save(any(DailyStudyPlan.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        DailyStudyPlan saved = dailyStudyPlanService.createDailyPlan(req);

        // Then
        assertThat(saved.getDayNumber()).isEqualTo(1);
        assertThat(saved.getTitle()).isEqualTo("DAY 1");
        assertThat(saved.getIsUnlocked()).isTrue();
    }

    @Test
    @DisplayName("updateDailyPlan_whenDayNumberInvalid_throwsBadRequestException")
    void updateDailyPlan_whenDayNumberInvalid_throwsBadRequestException() {
        // Given
        UUID planId = UUID.randomUUID();
        UpdateDailyPlanRequest req = new UpdateDailyPlanRequest();
        req.setDayNumber(0);

        // When / Then
        assertThatThrownBy(() -> dailyStudyPlanService.updateDailyPlan(planId, req))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(dailyStudyPlanRepository);
    }

    @Test
    @DisplayName("updateDailyPlan_whenOptionalFieldsNull_preservesExistingValues")
    void updateDailyPlan_whenOptionalFieldsNull_preservesExistingValues() {
        // Given
        UUID planId = UUID.randomUUID();
        LocalDate originalDate = LocalDate.of(2026, 10, 20);
        DailyStudyPlan existing = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(4)
                .title("Original Title")
                .scheduledDate(originalDate)
                .estimatedMinutes(35)
                .isUnlocked(false)
                .build();

        UpdateDailyPlanRequest req = new UpdateDailyPlanRequest();
        when(dailyStudyPlanRepository.findById(planId)).thenReturn(Optional.of(existing));
        when(dailyStudyPlanRepository.save(any(DailyStudyPlan.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        DailyStudyPlan updated = dailyStudyPlanService.updateDailyPlan(planId, req);

        // Then
        assertThat(updated.getTitle()).isEqualTo("Original Title");
        assertThat(updated.getDayNumber()).isEqualTo(4);
        assertThat(updated.getScheduledDate()).isEqualTo(originalDate);
        assertThat(updated.getEstimatedMinutes()).isEqualTo(35);
        assertThat(updated.getIsUnlocked()).isFalse();
    }

    @Test
    @DisplayName("addPlanItem_whenPlanNotFound_throwsResourceNotFoundException")
    void addPlanItem_whenPlanNotFound_throwsResourceNotFoundException() {
        // Given
        UUID missingPlanId = UUID.randomUUID();
        CreatePlanItemRequest req = new CreatePlanItemRequest();
        req.setSectionName("CORE");
        req.setTitle("Warmup");
        req.setItemType("VOCABULARY");
        req.setOrderIndex(1);

        when(dailyStudyPlanRepository.findById(missingPlanId)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> dailyStudyPlanService.addPlanItem(missingPlanId, req))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(dailyPlanItemRepository);
    }

    @Test
    @DisplayName("addPlanItem_whenNoAssignmentId_createsStandaloneItemWithOrderIndex")
    void addPlanItem_whenNoAssignmentId_createsStandaloneItemWithOrderIndex() {
        // Given
        UUID planId = UUID.randomUUID();
        DailyStudyPlan plan = DailyStudyPlan.builder().id(planId).build();
        CreatePlanItemRequest req = new CreatePlanItemRequest();
        req.setSectionName("VOCAB");
        req.setTitle("Flashcards");
        req.setItemType("VOCABULARY");
        req.setOrderIndex(2);
        req.setAssignmentId(null);

        when(dailyStudyPlanRepository.findById(planId)).thenReturn(Optional.of(plan));
        when(dailyPlanItemRepository.save(any(DailyPlanItem.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        DailyPlanItem saved = dailyStudyPlanService.addPlanItem(planId, req);

        // Then
        assertThat(saved.getDailyPlan()).isEqualTo(plan);
        assertThat(saved.getAssignment()).isNull();
        assertThat(saved.getOrderIndex()).isEqualTo(2);
        assertThat(saved.getTitle()).isEqualTo("Flashcards");
    }

    @Test
    @DisplayName("markDayAsCompleted_whenPlanNotFound_throwsResourceNotFoundException")
    void markDayAsCompleted_whenPlanNotFound_throwsResourceNotFoundException() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID missingPlanId = UUID.randomUUID();
        when(dailyStudyPlanRepository.findById(missingPlanId)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> dailyStudyPlanService.markDayAsCompleted(studentId, missingPlanId))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(progressRepository);
    }

    @Test
    @DisplayName("markDayAsCompleted_whenProgressAlreadyExists_updatesExistingProgressRecord")
    void markDayAsCompleted_whenProgressAlreadyExists_updatesExistingProgressRecord() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        UUID progressId = UUID.randomUUID();
        List<DailyPlanItem> items = List.of(
                DailyPlanItem.builder().id(UUID.randomUUID()).build(),
                DailyPlanItem.builder().id(UUID.randomUUID()).build()
        );
        DailyStudyPlan plan = DailyStudyPlan.builder().id(planId).items(items).build();
        StudentDailyProgress existingProgress = StudentDailyProgress.builder()
                .id(progressId)
                .dailyPlan(plan)
                .isCompleted(false)
                .completedItemsCount(1)
                .totalItemsCount(2)
                .build();

        when(dailyStudyPlanRepository.findById(planId)).thenReturn(Optional.of(plan));
        when(progressRepository.findByStudentIdAndDailyPlanId(studentId, planId))
                .thenReturn(Optional.of(existingProgress));

        // When
        dailyStudyPlanService.markDayAsCompleted(studentId, planId);

        // Then
        ArgumentCaptor<StudentDailyProgress> captor = ArgumentCaptor.forClass(StudentDailyProgress.class);
        verify(progressRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(progressId);
        assertThat(captor.getValue().getIsCompleted()).isTrue();
        assertThat(captor.getValue().getCompletedItemsCount()).isEqualTo(2);
        assertThat(captor.getValue().getTotalItemsCount()).isEqualTo(2);
        assertThat(captor.getValue().getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("getAssignmentsByDailyPlan_whenPlanNotFound_throwsResourceNotFoundException")
    void getAssignmentsByDailyPlan_whenPlanNotFound_throwsResourceNotFoundException() {
        // Given
        UUID missingPlanId = UUID.randomUUID();
        when(dailyStudyPlanRepository.findById(missingPlanId)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> dailyStudyPlanService.getAssignmentsByDailyPlan(missingPlanId))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(dailyPlanItemRepository, assignmentRepository);
    }

    @Test
    @DisplayName("getDailyProgressStatsMatrix_whenZeroPlansOrNullUserEnrollment_handlesSafely")
    @SuppressWarnings("unchecked")
    void getDailyProgressStatsMatrix_whenZeroPlansOrNullUserEnrollment_handlesSafely() {
        // Given
        UUID classId = UUID.randomUUID();
        UUID validStudentId = UUID.randomUUID();
        TypedQuery<ClassStudent> enrollmentQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("FROM ClassStudent cs"), eq(ClassStudent.class)))
                .thenReturn(enrollmentQuery);
        when(enrollmentQuery.setParameter("classId", classId)).thenReturn(enrollmentQuery);

        ClassStudent nullUserEnrollment = ClassStudent.builder()
                .student(Student.builder().id(UUID.randomUUID()).user(null).build())
                .isActive(true)
                .build();
        ClassStudent validEnrollment = ClassStudent.builder()
                .student(Student.builder()
                        .id(validStudentId)
                        .user(User.builder().id(validStudentId).email("student@test.com").build())
                        .build())
                .isActive(true)
                .build();
        when(enrollmentQuery.getResultList()).thenReturn(List.of(nullUserEnrollment, validEnrollment));
        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classId)).thenReturn(Collections.emptyList());

        TypedQuery<AssignmentAttempt> attemptQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("FROM AssignmentAttempt a"), eq(AssignmentAttempt.class)))
                .thenReturn(attemptQuery);
        when(attemptQuery.setParameter(eq("studentIds"), any())).thenReturn(attemptQuery);
        when(attemptQuery.getResultList()).thenReturn(Collections.emptyList());

        // When
        List<DailyProgressStatResponse> stats = dailyStudyPlanService.getDailyProgressStatsMatrix(classId);

        // Then
        assertThat(stats).hasSize(1);
        assertThat(stats.get(0).getStudentId()).isEqualTo(validStudentId.toString());
        assertThat(stats.get(0).getOverallRate()).isZero();
        assertThat(stats.get(0).getDays()).isEmpty();
    }

    @Test
    @DisplayName("getDailyProgressStatsMatrix_whenStudentHasFullNameAndNonAssignmentItemProgress_computesAccurately")
    @SuppressWarnings("unchecked")
    void getDailyProgressStatsMatrix_whenStudentHasFullNameAndNonAssignmentItemProgress_computesAccurately() {
        // Given
        UUID classId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID day1Id = UUID.randomUUID();

        TypedQuery<ClassStudent> enrollmentQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("FROM ClassStudent cs"), eq(ClassStudent.class)))
                .thenReturn(enrollmentQuery);
        when(enrollmentQuery.setParameter("classId", classId)).thenReturn(enrollmentQuery);

        User user = User.builder().id(studentId).email("an@test.com").firstName("Nguyen").lastName("An").build();
        Student student = Student.builder().id(studentId).user(user).build();
        when(enrollmentQuery.getResultList()).thenReturn(List.of(ClassStudent.builder().student(student).isActive(true).build()));

        DailyPlanItem readingItem = DailyPlanItem.builder().assignment(null).build();
        DailyStudyPlan day1 = DailyStudyPlan.builder().id(day1Id).dayNumber(1).items(List.of(readingItem)).build();
        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classId)).thenReturn(List.of(day1));

        TypedQuery<AssignmentAttempt> attemptQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("FROM AssignmentAttempt a"), eq(AssignmentAttempt.class)))
                .thenReturn(attemptQuery);
        when(attemptQuery.setParameter("studentIds", List.of(studentId))).thenReturn(attemptQuery);
        when(attemptQuery.getResultList()).thenReturn(Collections.emptyList());

        when(progressRepository.findByStudentIdAndDailyPlanId(studentId, day1Id))
                .thenReturn(Optional.of(StudentDailyProgress.builder().isCompleted(false).completedItemsCount(1).build()));

        // When
        List<DailyProgressStatResponse> stats = dailyStudyPlanService.getDailyProgressStatsMatrix(classId);

        // Then
        assertThat(stats).hasSize(1);
        assertThat(stats.get(0).getStudentName()).isEqualTo("Nguyen An");
        assertThat(stats.get(0).getOverallRate()).isEqualTo(100);
        assertThat(stats.get(0).getDays().get(0).getRate()).isEqualTo(100);
        assertThat(stats.get(0).getDays().get(0).getMinutes()).isEqualTo(15);
    }
}
