package com.englishlearning.classroom.repository;

import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.entity.Classroom;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, UUID> {
    Page<Classroom> findByStatus(ClassStatus status, Pageable pageable);
    long countByStatus(ClassStatus status);
    List<Classroom> findByTeacherId(UUID teacherId);
    boolean existsByNameIgnoreCase(String name);
    Optional<Classroom> findByJoinCode(String joinCode);
    boolean existsByJoinCode(String joinCode);

    @Modifying
    @Query("DELETE FROM Classroom c WHERE c.id = :id")
    int deleteClassroomRowById(@Param("id") UUID id);
}
