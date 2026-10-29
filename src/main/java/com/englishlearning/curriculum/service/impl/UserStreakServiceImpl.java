package com.englishlearning.curriculum.service.impl;

import com.englishlearning.curriculum.service.*;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.repository.StudentRepository;
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
public class UserStreakServiceImpl implements UserStreakService {

    private final StudentRepository studentRepository;

    @Override
    @Transactional
    public int updateStreakOnPlanCompletion(UUID studentId, LocalDate completionDate) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy học sinh với ID: " + studentId));

        int currentStreak = student.getCurrentStreak() != null ? student.getCurrentStreak() : 0;
        LocalDate lastActive = student.getLastActiveDate();

        if (lastActive == null) {
            // Lần đầu tiên hoàn thành bài học
            currentStreak = 1;
        } else if (lastActive.equals(completionDate)) {
            // Đã hoàn thành mục khác trong cùng ngày, giữ nguyên streak
            return currentStreak;
        } else if (lastActive.equals(completionDate.minusDays(1))) {
            // Hoàn thành liên tiếp ngày kế tiếp -> Tăng streak lên 1
            currentStreak += 1;
        } else {
            // Bỏ lỡ ngày trước đó -> Reset streak về 1
            currentStreak = 1;
        }

        student.setCurrentStreak(currentStreak);
        student.setLastActiveDate(completionDate);
        studentRepository.save(student);

        log.info("Cập nhật streak thành công cho học sinh {}: {} ngày (ngày hoàn thành: {})",
                studentId, currentStreak, completionDate);
        return currentStreak;
    }

    @Override
    @Transactional(readOnly = true)
    public int getCurrentStreak(UUID studentId) {
        return studentRepository.findById(studentId)
                .map(s -> s.getCurrentStreak() != null ? s.getCurrentStreak() : 0)
                .orElse(0);
    }
}
