package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.StudentVocabularyProgress;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface StudentVocabularyProgressRepository extends JpaRepository<StudentVocabularyProgress, UUID> {
    Optional<StudentVocabularyProgress> findByStudentIdAndVocabularyId(UUID studentId, UUID vocabularyId);

    @Query("SELECT p FROM StudentVocabularyProgress p JOIN FETCH p.vocabulary WHERE p.student.id = :studentId AND p.nextReviewAt <= :now")
    Page<StudentVocabularyProgress> findDueCards(@Param("studentId") UUID studentId, @Param("now") Instant now,
            Pageable pageable);
}