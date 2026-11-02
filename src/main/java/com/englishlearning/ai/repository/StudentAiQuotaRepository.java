// src/main/java/com/englishlearning/ai/repository/StudentAiQuotaRepository.java
package com.englishlearning.ai.repository;

import com.englishlearning.ai.entity.StudentAiQuota;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentAiQuotaRepository extends JpaRepository<StudentAiQuota, UUID> {
    Optional<StudentAiQuota> findByStudentId(UUID studentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT q FROM StudentAiQuota q WHERE q.student.id = :studentId")
    Optional<StudentAiQuota> findByStudentIdWithLock(@Param("studentId") UUID studentId);

    long countByIsBlockedTrue();
}
