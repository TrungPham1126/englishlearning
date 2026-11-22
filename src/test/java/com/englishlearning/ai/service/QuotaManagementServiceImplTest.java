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

    @Test
    @DisplayName("Dùng lock pessimistic khi tồn tại, chặn học viên isBlocked, clamp count<=0 & updateDailyLimit âm, báo 404 khi thiếu Student")
    void should_HandleLockedHitBlockedStudentMissingStudentAndClampValues() {
        Student student = Student.builder().id(studentId).build();
        StudentAiQuota blocked = StudentAiQuota.builder()
                .student(student).dailyLimit(20).usedToday(1).lastResetDate(LocalDate.now()).isBlocked(true).build();
        when(studentAiQuotaRepository.findByStudentIdWithLock(studentId)).thenReturn(Optional.of(blocked));

        assertThatThrownBy(() -> quotaManagementService.deductAiQuota(studentId, 1))
                .isInstanceOf(QuotaExceededException.class)
                .hasMessageContaining("tạm khóa");

        // Unblocked & count=0 -> Math.max(1, 0) = 1
        blocked.setIsBlocked(false);
        when(studentAiQuotaRepository.save(any(StudentAiQuota.class))).thenAnswer(inv -> inv.getArgument(0));
        StudentAiQuota incremented = quotaManagementService.deductAiQuota(studentId, 0);
        assertThat(incremented.getUsedToday()).isEqualTo(2);

        // Missing student -> ResourceNotFoundException
        UUID missingId = UUID.randomUUID();
        when(studentAiQuotaRepository.findByStudentId(missingId)).thenReturn(Optional.empty());
        when(studentRepository.findById(missingId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> quotaManagementService.getOrCreateQuota(missingId))
                .isInstanceOf(com.englishlearning.common.exception.ResourceNotFoundException.class)
                .hasMessageContaining("Không tìm thấy học sinh");

        // updateDailyLimit âm -> clamp về 0 và tự khởi tạo nếu chưa có
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(studentAiQuotaRepository.findByStudentId(studentId)).thenReturn(Optional.empty());
        StudentAiQuota updated = quotaManagementService.updateDailyLimit(studentId, -5);
        assertThat(updated.getDailyLimit()).isZero();
        assertThat(updated.getUsedToday()).isZero();
    }

    @Test
    @DisplayName("deductAiQuota: tự tạo quota mặc định (limit=20) khi chưa có, reset khi lastResetDate=null & cập nhật dailyLimit dương")
    void deductAiQuota_createsDefaultQuotaWhenMissingResetsNullDateAndUpdatesPositiveLimit() {
        Student student = Student.builder().id(studentId).build();
        when(studentAiQuotaRepository.save(any(StudentAiQuota.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. Cả findByStudentIdWithLock và findByStudentId đều rỗng -> tạo mới với dailyLimit=20 rồi trừ 3 lượt
        when(studentAiQuotaRepository.findByStudentIdWithLock(studentId)).thenReturn(Optional.empty());
        when(studentAiQuotaRepository.findByStudentId(studentId)).thenReturn(Optional.empty());
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));

        StudentAiQuota createdAndDeducted = quotaManagementService.deductAiQuota(studentId, 3);
        assertThat(createdAndDeducted.getDailyLimit()).isEqualTo(20);
        assertThat(createdAndDeducted.getUsedToday()).isEqualTo(3);

        // 2. lastResetDate == null -> tự reset về 0, đặt ngày hôm nay rồi trừ 2 lượt
        StudentAiQuota nullDateQuota = StudentAiQuota.builder()
                .student(student).dailyLimit(20).usedToday(15).lastResetDate(null).isBlocked(false).build();
        when(studentAiQuotaRepository.findByStudentIdWithLock(studentId)).thenReturn(Optional.of(nullDateQuota));

        StudentAiQuota afterNullDate = quotaManagementService.deductAiQuota(studentId, 2);
        assertThat(afterNullDate.getUsedToday()).isEqualTo(2);
        assertThat(afterNullDate.getLastResetDate()).isEqualTo(LocalDate.now());

        // 3. updateDailyLimit dương trên bản ghi sẵn có -> cập nhật về 50
        when(studentAiQuotaRepository.findByStudentId(studentId)).thenReturn(Optional.of(nullDateQuota));
        StudentAiQuota raised = quotaManagementService.updateDailyLimit(studentId, 50);
        assertThat(raised.getDailyLimit()).isEqualTo(50);
    }
}
