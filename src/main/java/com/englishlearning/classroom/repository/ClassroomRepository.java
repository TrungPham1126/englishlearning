package com.englishlearning.classroom.repository;

import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.entity.Classroom;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, UUID> {
    Page<Classroom> findByStatus(ClassStatus status, Pageable pageable);
    List<Classroom> findByTeacherId(UUID teacherId);
    boolean existsByNameIgnoreCase(String name);
}