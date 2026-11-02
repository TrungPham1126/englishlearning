package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.DailyPlanItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DailyPlanItemRepository extends JpaRepository<DailyPlanItem, UUID> {
    List<DailyPlanItem> findByDailyPlanIdOrderByOrderIndexAsc(UUID dailyPlanId);

    List<DailyPlanItem> findByAssignmentId(UUID assignmentId);

    @Query("SELECT dpi FROM DailyPlanItem dpi JOIN FETCH dpi.dailyPlan dp WHERE dpi.assignment.id = :assignmentId")
    List<DailyPlanItem> findByAssignmentIdWithDailyPlan(@Param("assignmentId") UUID assignmentId);

    @Query("SELECT dpi FROM DailyPlanItem dpi JOIN FETCH dpi.dailyPlan dp WHERE dpi.assignment.lesson.id = :lessonId")
    List<DailyPlanItem> findByLessonIdWithDailyPlan(@Param("lessonId") UUID lessonId);

    @Query("SELECT dpi FROM DailyPlanItem dpi JOIN FETCH dpi.dailyPlan dp LEFT JOIN FETCH dpi.assignment a WHERE dp.classroom.id = :classroomId ORDER BY dpi.orderIndex ASC")
    List<DailyPlanItem> findByClassroomIdWithDailyPlanAndAssignment(@Param("classroomId") UUID classroomId);
}
