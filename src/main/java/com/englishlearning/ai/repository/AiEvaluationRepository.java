package com.englishlearning.ai.repository;

import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AiEvaluationRepository extends JpaRepository<AiEvaluation, UUID> {
    Optional<AiEvaluation> findByStudentAnswerId(UUID studentAnswerId);

    @Query("SELECT SUM(e.tokensUsed) FROM AiEvaluation e")
    Integer sumTotalTokensUsed();

    @Query("SELECT e FROM AiEvaluation e WHERE e.studentAnswer.attempt.student.id = :studentId")
    List<AiEvaluation> findByStudentId(@Param("studentId") UUID studentId);

    @Query("SELECT e FROM AiEvaluation e WHERE e.studentAnswer.attempt.student.id = :studentId AND e.evalType = :evalType")
    List<AiEvaluation> findByStudentIdAndEvalType(@Param("studentId") UUID studentId, @Param("evalType") AiEvaluationType evalType);

    @Query("SELECT AVG(e.overallScore) FROM AiEvaluation e WHERE e.evalType = :evalType AND e.overallScore IS NOT NULL")
    Double findAverageScoreByEvalType(@Param("evalType") AiEvaluationType evalType);
}
