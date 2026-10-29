package com.englishlearning.curriculum.service;

import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.curriculum.service.impl.DailyPlanServiceImpl;
import com.englishlearning.common.exception.ForbiddenException;
import com.englishlearning.curriculum.dto.DailyHomeworkOverviewResponse;
import com.englishlearning.curriculum.dto.DaySummaryDto;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * Unit Test cho DailyPlanService (UC_STU_01: Daily Roadmap Checkpoints & Progress)
 * Tuân thủ JUnit 5, Mockito, AssertJ, argument-matching.md, keep-cause-effect-clear.md.
 */
@ExtendWith(MockitoExtension.class)
class DailyPlanServiceTest {

    @Mock
    private DailyStudyPlanRepository dailyStudyPlanRepository;

    @Mock
    private DailyPlanItemRepository dailyPlanItemRepository;

    @Mock
    private StudentDailyProgressRepository progressRepository;

    @Mock
    private ClassStudentRepository classStudentRepository;

    @InjectMocks
    private DailyPlanServiceImpl dailyPlanService;

    // Cố định mốc ngày kiểm thử: 2026-10-29 (Tránh dùng LocalDate.now() động)
    private static final LocalDate ACCESS_DATE = LocalDate.of(2026, 10, 29);

    @Test
    @DisplayName("should_GenerateDailyRoadmapCheckpoints_when_UserAccessesNewDay: Tạo lộ trình học ngày và mở khóa checkpoints hợp lệ")
    void should_GenerateDailyRoadmapCheckpoints_when_UserAccessesNewDay() {
        // Given
        UUID classroomId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        UUID studentId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

        // Tuân thủ argument-matching.md: Không dùng any() cho ID nghiệp vụ
        when(classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)).thenReturn(true);

        UUID planDay1Id = UUID.randomUUID();
        UUID planDay2Id = UUID.randomUUID();
        UUID planDay3Id = UUID.randomUUID();

        // 3 ngày học: Day 1 (quá khứ, hoàn thành), Day 2 (hôm nay, chưa xong), Day 3 (tương lai, khóa)
        DailyStudyPlan day1 = DailyStudyPlan.builder()
                .id(planDay1Id)
                .dayNumber(1)
                .title("DAY 1: Phonics Foundation")
                .scheduledDate(LocalDate.of(2026, 10, 28))
                .estimatedMinutes(30)
                .isUnlocked(true)
                .build();

        DailyStudyPlan day2 = DailyStudyPlan.builder()
                .id(planDay2Id)
                .dayNumber(2)
                .title("DAY 2: Vocabulary in Context")
                .scheduledDate(ACCESS_DATE) // Hôm nay 29/10
                .estimatedMinutes(40)
                .isUnlocked(false) // Hệ thống sẽ tự unlock vì là ngày hôm nay
                .build();

        DailyStudyPlan day3 = DailyStudyPlan.builder()
                .id(planDay3Id)
                .dayNumber(3)
                .title("DAY 3: Sentence Shadowing")
                .scheduledDate(LocalDate.of(2026, 10, 30)) // Ngày mai 30/10
                .estimatedMinutes(45)
                .isUnlocked(false)
                .build();

        List<DailyStudyPlan> plans = List.of(day3, day2, day1); // Sắp xếp giảm dần theo dayNumber
        when(dailyStudyPlanRepository.findByClassroomIdOrderByDayNumberDesc(classroomId)).thenReturn(plans);

        // Day 1 đã hoàn thành
        when(progressRepository.findByStudentIdAndDailyPlanId(studentId, planDay1Id))
                .thenReturn(Optional.of(StudentDailyProgress.builder().isCompleted(true).build()));
        // Day 2 chưa hoàn thành
        when(progressRepository.findByStudentIdAndDailyPlanId(studentId, planDay2Id))
                .thenReturn(Optional.of(StudentDailyProgress.builder().isCompleted(false).build()));
        // Day 3 chưa có tiến độ
        when(progressRepository.findByStudentIdAndDailyPlanId(studentId, planDay3Id))
                .thenReturn(Optional.empty());

        // Items của Day 2 (Target Day đang chọn)
        DailyPlanItem item1 = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .title("Luyện nghe 10 từ vựng cốt lõi")
                .itemType("VOCABULARY")
                .orderIndex(1)
                .sectionName("CORE_PRACTICE")
                .build();
        when(dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(planDay2Id)).thenReturn(List.of(item1));

        // When
        DailyHomeworkOverviewResponse response =
                dailyPlanService.generateDailyRoadmapCheckpoints(classroomId, studentId, null, ACCESS_DATE);

        // Then
        assertThat(response).isNotNull();
        // Day 1 và Day 2 được mở khóa (unlockedCount = 2), Day 3 bị khóa
        assertThat(response.getTotalDays()).isEqualTo(2);
        assertThat(response.getCompletedDays()).isEqualTo(1);
        assertThat(response.getCompletionPercentage()).isEqualTo(50); // 1 / 2 = 50%

        List<DaySummaryDto> days = response.getDays();
        assertThat(days).hasSize(3);

        DaySummaryDto day2Summary = days.stream().filter(d -> d.getId().equals(planDay2Id)).findFirst().orElseThrow();
        assertThat(day2Summary.getIsCurrentDay()).isTrue();
        assertThat(day2Summary.getIsUnlocked()).isTrue();
        assertThat(day2Summary.getIsCompleted()).isFalse();

        DaySummaryDto day3Summary = days.stream().filter(d -> d.getId().equals(planDay3Id)).findFirst().orElseThrow();
        assertThat(day3Summary.getIsCurrentDay()).isFalse();
        assertThat(day3Summary.getIsUnlocked()).isFalse(); // Ngày tương lai vẫn khóa

        assertThat(response.getCurrentSelectedDay()).isNotNull();
        assertThat(response.getCurrentSelectedDay().getDayNumber()).isEqualTo(2);
        assertThat(response.getCurrentSelectedDay().getSections()).hasSize(1);
        assertThat(response.getCurrentSelectedDay().getSections().get(0).getSectionName()).isEqualTo("CORE_PRACTICE");

        verify(classStudentRepository, times(1)).existsByClassroomIdAndStudentId(classroomId, studentId);
        verify(dailyStudyPlanRepository, times(1)).findByClassroomIdOrderByDayNumberDesc(classroomId);
    }

    @Test
    @DisplayName("should_ThrowForbiddenException_when_StudentNotEnrolledInClassroom: Chặn học viên không thuộc lớp truy cập")
    void should_ThrowForbiddenException_when_StudentNotEnrolledInClassroom() {
        // Given
        UUID classroomId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
        UUID studentId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");

        when(classStudentRepository.existsByClassroomIdAndStudentId(classroomId, studentId)).thenReturn(false);

        // When / Then
        assertThatThrownBy(() -> dailyPlanService.generateDailyRoadmapCheckpoints(classroomId, studentId, null, ACCESS_DATE))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Học viên không thuộc lớp học này");

        verify(dailyStudyPlanRepository, never()).findByClassroomIdOrderByDayNumberDesc(any());
    }
}
