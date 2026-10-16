package com.englishlearning.assignment.repository;

import com.englishlearning.assignment.entity.ExerciseAudio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExerciseAudioRepository extends JpaRepository<ExerciseAudio, UUID> {

    Optional<ExerciseAudio> findByQuestionIdAndIsActiveTrue(UUID questionId);

    Optional<ExerciseAudio> findByContentHashAndIsActiveTrue(String contentHash);

    List<ExerciseAudio> findByAssignmentId(UUID assignmentId);

    List<ExerciseAudio> findByQuestionIdOrderByVersionDesc(UUID questionId);
}

