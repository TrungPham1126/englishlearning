package com.englishlearning.assignment.repository;

import com.englishlearning.assignment.entity.Assignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AssignmentRepository extends JpaRepository<Assignment, UUID> {
    List<Assignment> findByLessonId(UUID lessonId);

    List<Assignment> findByClassroomId(UUID classroomId);

    // Chỉ fetch a.questions để tránh MultipleBagFetchException
    @Query("SELECT DISTINCT a FROM Assignment a LEFT JOIN FETCH a.questions WHERE a.id = :id")
    Optional<Assignment> findByIdWithQuestions(@Param("id") UUID id);
}