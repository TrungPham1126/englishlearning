package com.englishlearning.ai.repository;

import com.englishlearning.ai.entity.AiGeneratedExercise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.UUID;

@Repository
public interface AiGeneratedExerciseRepository extends JpaRepository<AiGeneratedExercise, UUID> {

    @Modifying
    @Query("DELETE FROM AiGeneratedExercise e WHERE e.lesson.id IN :lessonIds")
    int deleteByLessonIdIn(@Param("lessonIds") Collection<UUID> lessonIds);
}
