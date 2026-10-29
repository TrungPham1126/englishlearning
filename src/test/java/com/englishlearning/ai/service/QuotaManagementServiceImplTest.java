package com.englishlearning.ai.service;

import com.englishlearning.ai.service.impl.QuotaManagementServiceImpl;

import com.englishlearning.ai.entity.StudentAiQuota;
import com.englishlearning.ai.repository.StudentAiQuotaRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.common.exception.QuotaExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("QuotaManagementServiceImpl - Quản lý và kiểm soát hạn ngạch AI của học viên")
class QuotaManagementServiceImplTest {

    @Mock
    private StudentAiQuotaRepository studentAiQuotaRepository;

    @Mock
    private StudentRepository studentRepository;

    private QuotaManagementServiceImpl quotaManagementService;

    private final UUID studentId = UUID.fromString("33333333-cccc-dddd-eeee-333333333333");

    @BeforeEach
    void setUp() {
        quotaManagementService = new QuotaManagementServiceImpl(studentAiQuotaRepository, studentRepository);
    }

    @Test
    @DisplayName("Trừ đúng số lượt hạn ngạch khi học viên sử dụng dịch vụ AI Speaking/Writing")
    void should_DeductAiQuota_when_UserInvokesAiSpeakingOrWritingService() {
        // Given
        Student student = new Student();
        student.setId(studentId);

        StudentAiQuota quota = StudentAiQuota.builder()
                .student(student)
                .dailyLimit(20)
                .usedToday(5)
                .lastResetDate(LocalDate.now())
                .isBlocked(false)
                .build();

        when(studentAiQuotaRepository.findByStudentId(studentId)).thenReturn(Optional.of(quota));
        when(studentAiQuotaRepository.save(any(StudentAiQuota.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        StudentAiQuota result = quotaManagementService.deductAiQuota(studentId, 2);

        // Then
        assertThat(result.getUsedToday()).isEqualTo(7);

        ArgumentCaptor<StudentAiQuota> captor = ArgumentCaptor.forClass(StudentAiQuota.class);
        verify(studentAiQuotaRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getUsedToday()).isEqualTo(7);
    }

    @Test
    @DisplayName("Ném QuotaExceededException khi học viên dùng vượt quá giới hạn hàng ngày được cấp")
    void should_ThrowQuotaExceededException_when_UserExceedsAssignedDailyLimit() {
        // Given: Đã dùng hết 20/20 lượt hôm nay
        Student student = new Student();
        student.setId(studentId);

        StudentAiQuota quota = StudentAiQuota.builder()
                .student(student)
                .dailyLimit(20)
                .usedToday(20)
                .lastResetDate(LocalDate.now())
                .isBlocked(false)
                .build();

        when(studentAiQuotaRepository.findByStudentId(studentId)).thenReturn(Optional.of(quota));

        // When & Then
        assertThatThrownBy(() -> quotaManagementService.checkAndDeductQuota(studentId))
                .isInstanceOf(QuotaExceededException.class)
                .hasMessageContaining("Hạn ngạch sử dụng AI hôm nay đã hết");

        verify(studentAiQuotaRepository, never()).save(any(StudentAiQuota.class));
    }

    @Test
    @DisplayName("Tự động đặt lại số lượt đã dùng (reset to 0) khi học viên truy cập vào ngày mới")
    void should_ResetUsageCount_when_AccessingOnNewDay() {
        // Given: Lần dùng gần nhất là ngày hôm qua (yesterday)
        Student student = new Student();
        student.setId(studentId);

        StudentAiQuota quota = StudentAiQuota.builder()
                .student(student)
                .dailyLimit(20)
                .usedToday(18)
                .lastResetDate(LocalDate.now().minusDays(1))
                .isBlocked(false)
                .build();

        when(studentAiQuotaRepository.findByStudentId(studentId)).thenReturn(Optional.of(quota));
        when(studentAiQuotaRepository.save(any(StudentAiQuota.class))).thenAnswer(inv -> inv.getArgument(0));

        // When: Trừ 1 lượt vào ngày mới
        StudentAiQuota result = quotaManagementService.deductAiQuota(studentId, 1);

        // Then: Số lượt đã dùng phải là 1 (0 reset + 1 lượt mới)
        assertThat(result.getUsedToday()).isEqualTo(1);
        assertThat(result.getLastResetDate()).isEqualTo(LocalDate.now());
        verify(studentAiQuotaRepository, times(1)).save(quota);
    }
}
