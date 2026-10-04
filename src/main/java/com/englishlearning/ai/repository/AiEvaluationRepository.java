package com.englishlearning.ai.repository;

import com.englishlearning.ai.entity.AiEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository

public interface AiEvaluationRepository extends JpaRepository<AiEvaluation, UUID> {
    Optional<AiEvaluation> findByStudentAnswerId(UUID studentAnswerId);

    // Thêm hàm này vào trong
    // com.englishlearning.ai.repository.AiEvaluationRepository
    @org.springframework.data.jpa.repository.Query("SELECT SUM(e.tokensUsed) FROM AiEvaluation e")
    Integer sumTotalTokensUsed();
}