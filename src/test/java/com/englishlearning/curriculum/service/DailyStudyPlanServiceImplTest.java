package com.englishlearning.curriculum.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.curriculum.dto.DailyHomeworkOverviewResponse;
import com.englishlearning.curriculum.dto.DayDetailDto;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import com.englishlearning.curriculum.service.impl.DailyStudyPlanServiceImpl;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
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

        // When
        DailyHomeworkOverviewResponse response = dailyStudyPlanService.getStudentDailyOverview(classroomId, studentId, planId);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getDays().get(0).getIsCompleted()).isTrue();
        assertThat(response.getCompletionPercentage()).isEqualTo(100);

        DayDetailDto currentDay = response.getCurrentSelectedDay();
        assertThat(currentDay).isNotNull();
        assertThat(currentDay.getIsCompleted()).isTrue();

        var allItems = currentDay.getSections().stream().flatMap(s -> s.getItems().stream()).toList();
        assertThat(allItems).hasSize(3);
        assertThat(allItems).allMatch(t -> Boolean.TRUE.equals(t.getIsDone()));
    }
}
