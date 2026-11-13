package com.englishlearning.submission.repository;

import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
public interface AssignmentAttemptRepository extends JpaRepository<AssignmentAttempt, UUID> {
    long countByStatus(AttemptStatus status);
    List<AssignmentAttempt> findByStudentIdAndAssignmentId(UUID studentId, UUID assignmentId);

    Optional<AssignmentAttempt> findByIdAndStudentId(UUID id, UUID studentId);

    List<AssignmentAttempt> findByAssignmentIdAndStudentIdOrderByAttemptNumberDesc(UUID assignmentId, UUID studentId);

    List<AssignmentAttempt> findByAssignmentIdOrderBySubmittedAtDesc(UUID assignmentId);

    @Query("SELECT COUNT(a) FROM AssignmentAttempt a WHERE a.assignment.id = :assignmentId AND a.student.id = :studentId AND a.status IN ('SUBMITTED', 'GRADING', 'COMPLETED')")
    int countAttempts(@Param("assignmentId") UUID assignmentId, @Param("studentId") UUID studentId);

    @Query("SELECT MAX(a.totalScore) FROM AssignmentAttempt a WHERE a.assignment.id = :assignmentId AND a.student.id = :studentId")
    Double findHighestScore(@Param("assignmentId") UUID assignmentId, @Param("studentId") UUID studentId);

    List<AssignmentAttempt> findByStudentId(UUID studentId);

    @Query("SELECT a FROM AssignmentAttempt a WHERE a.student.id = :studentId AND a.status IN ('SUBMITTED', 'GRADING', 'COMPLETED')")
    List<AssignmentAttempt> findCompletedAttemptsByStudentId(@Param("studentId") UUID studentId);

    @Query("SELECT a FROM AssignmentAttempt a WHERE a.student.id = :studentId AND a.assignment.skillType = :skillType AND a.status IN ('SUBMITTED', 'GRADING', 'COMPLETED')")
    List<AssignmentAttempt> findCompletedAttemptsByStudentIdAndSkillType(@Param("studentId") UUID studentId, @Param("skillType") SkillType skillType);

    @Query("SELECT AVG(a.totalScore) FROM AssignmentAttempt a WHERE a.assignment.skillType = :skillType AND a.status IN ('SUBMITTED', 'GRADING', 'COMPLETED') AND a.totalScore IS NOT NULL")
    Double findAverageScoreBySkillType(@Param("skillType") SkillType skillType);

    @Query("SELECT DISTINCT a FROM AssignmentAttempt a JOIN FETCH a.assignment ass LEFT JOIN FETCH a.answers WHERE ass.classroom.id = :classroomId AND a.student.id = :studentId AND a.status <> com.englishlearning.submission.entity.AttemptStatus.IN_PROGRESS ORDER BY a.submittedAt DESC, a.startedAt DESC")
    List<AssignmentAttempt> findSubmittedByClassroomIdAndStudentId(@Param("classroomId") UUID classroomId, @Param("studentId") UUID studentId);

    @Query("SELECT COUNT(a) FROM AssignmentAttempt a WHERE a.assignment.classroom.id = :classroomId AND a.status IN ('SUBMITTED', 'GRADING', 'COMPLETED')")
    long countCompletedByClassroomId(@Param("classroomId") UUID classroomId);

    @Query("SELECT COUNT(DISTINCT a.assignment.id) FROM AssignmentAttempt a WHERE a.student.id = :studentId AND a.status IN ('SUBMITTED', 'GRADING', 'COMPLETED')")
    long countCompletedDistinctAssignmentsByStudentId(@Param("studentId") UUID studentId);

    @Query("SELECT DISTINCT a.assignment.id FROM AssignmentAttempt a WHERE a.student.id = :studentId AND a.status IN ('SUBMITTED', 'GRADING', 'COMPLETED')")
    Set<UUID> findCompletedAssignmentIdsByStudentId(@Param("studentId") UUID studentId);

    @Query("SELECT a FROM AssignmentAttempt a JOIN FETCH a.assignment ass LEFT JOIN FETCH a.student s LEFT JOIN FETCH s.user WHERE ass.classroom.id = :classroomId ORDER BY a.submittedAt DESC, a.createdAt DESC")
    List<AssignmentAttempt> findAllByClassroomIdWithDetails(@Param("classroomId") UUID classroomId);

    @Query("SELECT a.id FROM AssignmentAttempt a WHERE a.assignment.id IN :assignmentIds")
    List<UUID> findIdsByAssignmentIdIn(@Param("assignmentIds") Collection<UUID> assignmentIds);

    @Modifying
    @Query("DELETE FROM AssignmentAttempt a WHERE a.id IN :ids")
    int deleteByIdIn(@Param("ids") Collection<UUID> ids);
}
