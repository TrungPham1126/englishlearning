package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.*;

import com.englishlearning.ai.entity.StudentAiQuota;
import com.englishlearning.ai.repository.StudentAiQuotaRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.common.exception.QuotaExceededException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuotaManagementServiceImpl implements QuotaManagementService {

    private final StudentAiQuotaRepository studentAiQuotaRepository;
    private final StudentRepository studentRepository;

    @Override
    @Transactional
    public StudentAiQuota deductAiQuota(UUID studentId, int count) {
        StudentAiQuota quota = getOrCreateQuota(studentId);

        // Reset tự động khi qua ngày mới
        LocalDate today = LocalDate.now();
        if (quota.getLastResetDate() == null || quota.getLastResetDate().isBefore(today)) {
            quota.setUsedToday(0);
            quota.setLastResetDate(today);
        }

        if (Boolean.TRUE.equals(quota.getIsBlocked())) {
            log.warn("Học sinh {} bị khóa quyền truy cập AI", studentId);
            throw new QuotaExceededException("Tài khoản của bạn đã bị tạm khóa quyền sử dụng dịch vụ AI.");
        }

        int requestedUsage = Math.max(1, count);
        if (quota.getUsedToday() + requestedUsage > quota.getDailyLimit()) {
            log.warn("Học sinh {} đã dùng hết quota hôm nay: {}/{}", studentId, quota.getUsedToday(), quota.getDailyLimit());
            throw new QuotaExceededException(String.format(
                    "Hạn ngạch sử dụng AI hôm nay đã hết (Đã dùng: %d/%d). Vui lòng quay lại vào ngày mai.",
                    quota.getUsedToday(), quota.getDailyLimit()
            ));
        }

        quota.setUsedToday(quota.getUsedToday() + requestedUsage);
        StudentAiQuota updatedQuota = studentAiQuotaRepository.save(quota);
        log.info("Trừ {} lượt AI cho học sinh {}. Lượt đã dùng hôm nay: {}/{}",
                requestedUsage, studentId, updatedQuota.getUsedToday(), updatedQuota.getDailyLimit());
        return updatedQuota;
    }

    @Override
    @Transactional
    public void checkAndDeductQuota(UUID studentId) {
        deductAiQuota(studentId, 1);
    }

    @Override
    @Transactional
    public StudentAiQuota getOrCreateQuota(UUID studentId) {
        return studentAiQuotaRepository.findByStudentId(studentId)
                .orElseGet(() -> {
                    Student student = studentRepository.findById(studentId)
                            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy học sinh với ID: " + studentId));

                    StudentAiQuota newQuota = StudentAiQuota.builder()
                            .student(student)
                            .dailyLimit(20)
                            .usedToday(0)
                            .lastResetDate(LocalDate.now())
                            .isBlocked(false)
                            .build();
                    return studentAiQuotaRepository.save(newQuota);
                });
    }

    @Override
    @Transactional
    public StudentAiQuota updateDailyLimit(UUID studentId, int newLimit) {
        StudentAiQuota quota = getOrCreateQuota(studentId);
        quota.setDailyLimit(Math.max(0, newLimit));
        return studentAiQuotaRepository.save(quota);
    }
}
