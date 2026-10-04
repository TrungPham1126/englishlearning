// src/main/java/com/englishlearning/ai/service/AiMonitoringService.java
package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.AiStatsResponse;
import com.englishlearning.ai.dto.StudentQuotaResponse;
import com.englishlearning.ai.dto.UpdateQuotaRequest;
import com.englishlearning.ai.entity.StudentAiQuota;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.ai.repository.StudentAiQuotaRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiMonitoringService {
    private final StudentAiQuotaRepository quotaRepository;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final StudentRepository studentRepository;

    @Transactional(readOnly = true)
    public AiStatsResponse getStats() {
        Integer totalTokens = aiEvaluationRepository.sumTotalTokensUsed();
        if (totalTokens == null)
            totalTokens = 0; // Fallback nếu chưa có token nào

        long totalEvaluations = aiEvaluationRepository.count();
        // Giả sử API Groq/Gemini tốn khoảng 0.001$ cho 1 lượt chấm bài
        double estimatedCost = totalEvaluations * 0.001;

        return AiStatsResponse.builder()
                .totalTokens(totalTokens)
                .estimatedCostUsd(estimatedCost)
                .activeUsers(studentRepository.count())
                .blockedUsers(quotaRepository.countByIsBlockedTrue())
                .build();
    }

    @Transactional
    public List<StudentQuotaResponse> getAllQuotas() {
        List<Student> students = studentRepository.findAll();
        LocalDate today = LocalDate.now();

        return students.stream().map(student -> {
            StudentAiQuota quota = quotaRepository.findByStudentId(student.getId())
                    .orElseGet(() -> quotaRepository.save(StudentAiQuota.builder()
                            .student(student).build()));

            // Tự động reset daily usage nếu qua ngày mới
            if (!quota.getLastResetDate().isEqual(today)) {
                quota.setUsedToday(0);
                quota.setLastResetDate(today);
                quotaRepository.save(quota);
            }

            return StudentQuotaResponse.builder()
                    .studentId(student.getId())
                    .email(student.getUser().getEmail())
                    .dailyUsed(quota.getUsedToday())
                    .dailyLimit(quota.getDailyLimit())
                    .isBlocked(quota.getIsBlocked())
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional
    public void updateQuota(UUID studentId, UpdateQuotaRequest request) {
        StudentAiQuota quota = quotaRepository.findByStudentId(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Quota của học viên này"));

        if (request.getDailyLimit() != null)
            quota.setDailyLimit(request.getDailyLimit());
        if (request.getIsBlocked() != null)
            quota.setIsBlocked(request.getIsBlocked());

        quotaRepository.save(quota);
    }
}