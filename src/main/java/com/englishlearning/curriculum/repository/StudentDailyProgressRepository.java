package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.StudentDailyProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentDailyProgressRepository extends JpaRepository<StudentDailyProgress, UUID> {
    Optional<StudentDailyProgress> findByStudentIdAndDailyPlanId(UUID studentId, UUID dailyPlanId);

    List<StudentDailyProgress> findByStudentId(UUID studentId);

    List<StudentDailyProgress> findByStudentIdIn(List<UUID> studentIds);

    boolean existsByStudentIdAndDailyPlanId(UUID studentId, UUID dailyPlanId);

    long countByDailyPlanIdIn(Collection<UUID> dailyPlanIds);

    @Modifying
    @Query("DELETE FROM StudentDailyProgress sdp WHERE sdp.dailyPlan.id IN :dailyPlanIds")
    int deleteByDailyPlanIdIn(@Param("dailyPlanIds") Collection<UUID> dailyPlanIds);
}
