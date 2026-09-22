package com.englishlearning.classroom.repository;

import com.englishlearning.classroom.entity.ClassStudent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClassStudentRepository extends JpaRepository<ClassStudent, UUID> {
    boolean existsByClassroomIdAndStudentId(UUID classroomId, UUID studentId);
    long countByClassroomIdAndIsActiveTrue(UUID classroomId);
    List<ClassStudent> findByClassroomId(UUID classroomId);
    List<ClassStudent> findByStudentIdAndIsActiveTrue(UUID studentId);
    Optional<ClassStudent> findByClassroomIdAndStudentId(UUID classroomId, UUID studentId);

    @Query("SELECT cs FROM ClassStudent cs JOIN FETCH cs.classroom c WHERE cs.student.id = :studentId AND cs.isActive = true")
    List<ClassStudent> findActiveEnrollmentsWithClassroom(@Param("studentId") UUID studentId);
}