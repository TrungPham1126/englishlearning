package com.englishlearning.curriculum.scheduler;

import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.service.NotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DailyAssignmentScheduler - Cron mở khóa bài tập hàng ngày")
class DailyAssignmentSchedulerTest {

    @Mock
    private DailyStudyPlanRepository dailyStudyPlanRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private DailyAssignmentScheduler scheduler;

    @Test
    @DisplayName("unlockDailyAssignments - Không có kế hoạch cần mở khóa hôm nay -> bỏ qua notification và saveAll")
    void unlockDailyAssignments_whenNoPlans_doesNothing() {
        when(dailyStudyPlanRepository.findByScheduledDateAndIsUnlockedFalse(LocalDate.now()))
                .thenReturn(Collections.emptyList());

        scheduler.unlockDailyAssignments();

        verifyNoInteractions(notificationService);
        verify(dailyStudyPlanRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("unlockDailyAssignments - Mở khóa nhiều kế hoạch và gửi notification cho từng lớp học")
    void unlockDailyAssignments_whenPlansExist_unlocksAndNotifies() {
        UUID classId = UUID.randomUUID();
        UUID planId1 = UUID.randomUUID();
        UUID planId2 = UUID.randomUUID();

        DailyStudyPlan plan1 = DailyStudyPlan.builder()
                .id(planId1)
                .dayNumber(3)
                .title("DAY 3: Listening")
                .classroom(Classroom.builder().id(classId).build())
                .isUnlocked(false)
                .build();
        DailyStudyPlan plan2 = DailyStudyPlan.builder()
                .id(planId2)
                .dayNumber(4)
                .title(null)
                .classroom(null)
                .isUnlocked(false)
                .build();

        when(dailyStudyPlanRepository.findByScheduledDateAndIsUnlockedFalse(LocalDate.now()))
                .thenReturn(List.of(plan1, plan2));

        scheduler.unlockDailyAssignments();

        assertThat(plan1.getIsUnlocked()).isTrue();
        assertThat(plan2.getIsUnlocked()).isTrue();

        ArgumentCaptor<NotificationDto> notifCaptor = ArgumentCaptor.forClass(NotificationDto.class);
        verify(notificationService, times(1)).dispatchNotification(notifCaptor.capture());
        NotificationDto dto = notifCaptor.getValue();
        assertThat(dto.getClassroomId()).isEqualTo(classId);
        assertThat(dto.getTitle()).contains("DAY 3: Listening");
        assertThat(dto.getActionType()).isEqualTo("NEW_ASSIGNMENT");
        assertThat(dto.getReferenceId()).isEqualTo(planId1.toString());
        assertThat(dto.getTargetUrl()).isEqualTo("/student/courses/" + classId + "/daily-plan");

        verify(dailyStudyPlanRepository).saveAll(List.of(plan1, plan2));
    }

    @Test
    @DisplayName("unlockDailyAssignments - Lỗi gửi notification không làm hỏng quá trình mở khóa & lưu DB")
    void unlockDailyAssignments_whenNotificationFails_stillSavesUnlockedPlans() {
        UUID classId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(5)
                .title(null)
                .classroom(Classroom.builder().id(classId).build())
                .isUnlocked(false)
                .build();

        when(dailyStudyPlanRepository.findByScheduledDateAndIsUnlockedFalse(LocalDate.now()))
                .thenReturn(List.of(plan));
        doThrow(new RuntimeException("RabbitMQ down")).when(notificationService).dispatchNotification(any());

        scheduler.unlockDailyAssignments();

        assertThat(plan.getIsUnlocked()).isTrue();
        verify(dailyStudyPlanRepository).saveAll(List.of(plan));
    }
}
