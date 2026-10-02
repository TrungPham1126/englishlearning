package com.englishlearning.analytics.repository;

import com.englishlearning.analytics.entity.LearningSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LearningSessionRepository extends JpaRepository<LearningSession, UUID> {
    List<LearningSession> findByUserIdOrderByLoginAtDesc(UUID userId);
}