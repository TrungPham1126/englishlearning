package com.englishlearning.ai.repository;

import com.englishlearning.ai.entity.AiGeneratedExercise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AiGeneratedExerciseRepository extends JpaRepository<AiGeneratedExercise, UUID> {
}