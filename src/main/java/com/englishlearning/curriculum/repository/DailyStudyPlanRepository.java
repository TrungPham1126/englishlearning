package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.DailyStudyPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    List<DailyStudyPlan> findByClassroomId(UUID classroomId);

    @Query("SELECT DISTINCT p FROM DailyStudyPlan p LEFT JOIN FETCH p.items i LEFT JOIN FETCH i.assignment WHERE p.classroom.id = :classroomId ORDER BY p.dayNumber ASC")
    List<DailyStudyPlan> findByClassroomIdWithItems(@Param("classroomId") UUID classroomId);

    @Query("SELECT DISTINCT p FROM DailyStudyPlan p LEFT JOIN FETCH p.items WHERE p.classroom.id IN :classroomIds")
    List<DailyStudyPlan> findByClassroomIdsWithItems(@Param("classroomIds") List<UUID> classroomIds);
}
