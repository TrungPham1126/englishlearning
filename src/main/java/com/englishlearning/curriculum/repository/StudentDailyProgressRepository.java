package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.StudentDailyProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentDailyProgressRepository extends JpaRepository<StudentDailyProgress, UUID> {
    Optional<StudentDailyProgress> findByStudentIdAndDailyPlanId(UUID studentId, UUID dailyPlanId);

    List<StudentDailyProgress> findByStudentId(UUID studentId);

    boolean existsByStudentIdAndDailyPlanId(UUID studentId, UUID dailyPlanId);
}