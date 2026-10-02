package com.englishlearning.submission.repository;

import com.englishlearning.submission.entity.AssignmentAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AssignmentAttemptRepository extends JpaRepository<AssignmentAttempt, UUID> {
    List<AssignmentAttempt> findByStudentIdAndAssignmentId(UUID studentId, UUID assignmentId);

    Optional<AssignmentAttempt> findByIdAndStudentId(UUID id, UUID studentId);

    // THÊM MỚI TỪ ĐÂY:
    List<AssignmentAttempt> findByAssignmentIdAndStudentIdOrderByAttemptNumberDesc(UUID assignmentId, UUID studentId);

    List<AssignmentAttempt> findByAssignmentIdOrderBySubmittedAtDesc(UUID assignmentId);

    @Query("SELECT COUNT(a) FROM AssignmentAttempt a WHERE a.assignment.id = :assignmentId AND a.student.id = :studentId")
    int countAttempts(@Param("assignmentId") UUID assignmentId, @Param("studentId") UUID studentId);

    @Query("SELECT MAX(a.totalScore) FROM AssignmentAttempt a WHERE a.assignment.id = :assignmentId AND a.student.id = :studentId")
    Double findHighestScore(@Param("assignmentId") UUID assignmentId, @Param("studentId") UUID studentId);
}