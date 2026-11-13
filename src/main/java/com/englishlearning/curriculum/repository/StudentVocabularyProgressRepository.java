package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.StudentVocabularyProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface StudentVocabularyProgressRepository extends JpaRepository<StudentVocabularyProgress, UUID> {
    List<StudentVocabularyProgress> findByStudentId(UUID studentId);

    long countByStudentId(UUID studentId);

    @Query("SELECT COUNT(p) FROM StudentVocabularyProgress p WHERE p.student.id = :studentId AND (p.repetitions >= 3 OR p.stage = com.englishlearning.curriculum.entity.SpacedRepetitionStage.MASTERED)")
    long countMasteredByStudentId(@Param("studentId") UUID studentId);

    @Modifying
    @Query("DELETE FROM StudentVocabularyProgress svp WHERE svp.vocabulary.id IN :vocabIds")
    int deleteByVocabularyIdIn(@Param("vocabIds") Collection<UUID> vocabIds);

    @Modifying
    @Query("DELETE FROM StudentVocabularyProgress svp WHERE svp.vocabulary.id IN :vocabIds AND svp.student.id IN :studentIds")
    int deleteByVocabularyIdInAndStudentIdIn(@Param("vocabIds") Collection<UUID> vocabIds, @Param("studentIds") Collection<UUID> studentIds);
}
