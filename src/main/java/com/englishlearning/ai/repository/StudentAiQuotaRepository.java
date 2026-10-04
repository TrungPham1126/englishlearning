// src/main/java/com/englishlearning/ai/repository/StudentAiQuotaRepository.java
package com.englishlearning.ai.repository;

import com.englishlearning.ai.entity.StudentAiQuota;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentAiQuotaRepository extends JpaRepository<StudentAiQuota, UUID> {
    Optional<StudentAiQuota> findByStudentId(UUID studentId);

    long countByIsBlockedTrue();
}