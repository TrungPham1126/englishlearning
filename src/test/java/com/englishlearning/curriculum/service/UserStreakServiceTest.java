package com.englishlearning.curriculum.service;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.curriculum.service.impl.UserStreakServiceImpl;
import com.englishlearning.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * Unit Test cho UserStreakService (UC_STU_01: Streak Tracking & Habit Building)
 * Tuân thủ JUnit 5, Mockito, AssertJ, argument-matching.md, keep-cause-effect-clear.md.
 */
@ExtendWith(MockitoExtension.class)
class UserStreakServiceTest {

    @Mock
    private StudentRepository studentRepository;

    @InjectMocks
    private UserStreakServiceImpl userStreakService;

    // Cố định mốc ngày kiểm thử: 2026-10-29 (Tránh dùng LocalDate.now() động gây flaky test)
    private static final LocalDate FIXED_TODAY = LocalDate.of(2026, 10, 29);
    private static final LocalDate FIXED_YESTERDAY = LocalDate.of(2026, 10, 28);
    private static final LocalDate TWO_DAYS_AGO = LocalDate.of(2026, 10, 27);

    @Test
    @DisplayName("should_IncrementStreakByOne_when_UserCompletesPlanOnConsecutiveDay: Tăng chuỗi ngày học liên tục lên 1")
    void should_IncrementStreakByOne_when_UserCompletesPlanOnConsecutiveDay() {
        // Given
        UUID studentId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        Student student = Student.builder()
                .id(studentId)
                .currentStreak(4) // Đang có chuỗi 4 ngày
                .lastActiveDate(FIXED_YESTERDAY) // Hoàn thành hôm qua
                .build();

        // Tuân thủ argument-matching.md: Dùng studentId cụ thể thay vì any()
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));

        // When
        int newStreak = userStreakService.updateStreakOnPlanCompletion(studentId, FIXED_TODAY);

        // Then
        assertThat(newStreak).isEqualTo(5);
        assertThat(student.getCurrentStreak()).isEqualTo(5);
        assertThat(student.getLastActiveDate()).isEqualTo(FIXED_TODAY);

        // Tuân thủ rule: verify(repo, times(1)).save(...)
        ArgumentCaptor<Student> captor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getCurrentStreak()).isEqualTo(5);
        assertThat(captor.getValue().getLastActiveDate()).isEqualTo(FIXED_TODAY);
    }

    @Test
    @DisplayName("should_ResetStreakToOne_when_UserMissesPreviousDay: Reset streak về 1 nếu ngắt quãng ngày học")
    void should_ResetStreakToOne_when_UserMissesPreviousDay() {
        // Given
        UUID studentId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        Student student = Student.builder()
                .id(studentId)
                .currentStreak(12) // Chuỗi cũ 12 ngày
                .lastActiveDate(TWO_DAYS_AGO) // Bỏ lỡ ngày hôm qua (28/10), hôm nay mới học lại (29/10)
                .build();

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));

        // When
        int newStreak = userStreakService.updateStreakOnPlanCompletion(studentId, FIXED_TODAY);

        // Then: Streak bị ngắt quãng, reset về 1
        assertThat(newStreak).isEqualTo(1);
        assertThat(student.getCurrentStreak()).isEqualTo(1);
        assertThat(student.getLastActiveDate()).isEqualTo(FIXED_TODAY);

        verify(studentRepository, times(1)).save(student);
    }

    @Test
    @DisplayName("should_InitializeStreakToOne_when_UserCompletesPlanForFirstTime: Khởi tạo streak = 1 cho người học lần đầu")
    void should_InitializeStreakToOne_when_UserCompletesPlanForFirstTime() {
        // Given
        UUID studentId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        Student newStudent = Student.builder()
                .id(studentId)
                .currentStreak(0)
                .lastActiveDate(null) // Chưa từng học ngày nào
                .build();

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(newStudent));

        // When
        int newStreak = userStreakService.updateStreakOnPlanCompletion(studentId, FIXED_TODAY);

        // Then
        assertThat(newStreak).isEqualTo(1);
        assertThat(newStudent.getCurrentStreak()).isEqualTo(1);
        assertThat(newStudent.getLastActiveDate()).isEqualTo(FIXED_TODAY);

        verify(studentRepository, times(1)).save(newStudent);
    }

    @Test
    @DisplayName("should_KeepSameStreak_when_UserCompletesMultiplePlansOnSameDay: Giữ nguyên streak khi hoàn thành nhiều bài cùng ngày")
    void should_KeepSameStreak_when_UserCompletesMultiplePlansOnSameDay() {
        // Given
        UUID studentId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        Student student = Student.builder()
                .id(studentId)
                .currentStreak(7)
                .lastActiveDate(FIXED_TODAY) // Đã hoàn thành một bài tập hôm nay rồi
                .build();

        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));

        // When
        int resultStreak = userStreakService.updateStreakOnPlanCompletion(studentId, FIXED_TODAY);

        // Then: Giữ nguyên streak 7, không tăng thêm lần 2 trong cùng 1 ngày
        assertThat(resultStreak).isEqualTo(7);
        verify(studentRepository, never()).save(any());
    }

    @Test
    @DisplayName("should_ThrowResourceNotFoundException_when_StudentNotFound: Báo lỗi khi không tìm thấy học sinh")
    void should_ThrowResourceNotFoundException_when_StudentNotFound() {
        // Given
        UUID nonExistentId = UUID.fromString("99999999-9999-9999-9999-999999999999");
        when(studentRepository.findById(nonExistentId)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> userStreakService.updateStreakOnPlanCompletion(nonExistentId, FIXED_TODAY))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Không tìm thấy học sinh với ID: " + nonExistentId);

        verify(studentRepository, never()).save(any());
    }
}
