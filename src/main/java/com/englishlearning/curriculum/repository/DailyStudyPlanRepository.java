package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.DailyStudyPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DailyStudyPlanRepository extends JpaRepository<DailyStudyPlan, UUID> {
    List<DailyStudyPlan> findByClassroomIdOrderByDayNumberDesc(UUID classroomId);

    List<DailyStudyPlan> findByScheduledDateAndIsUnlockedFalse(LocalDate scheduledDate);

    Optional<DailyStudyPlan> findByClassroomIdAndDayNumber(UUID classroomId, Integer dayNumber);
}