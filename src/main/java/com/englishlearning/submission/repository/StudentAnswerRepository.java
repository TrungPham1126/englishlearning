package com.englishlearning.submission.repository;

import com.englishlearning.submission.entity.StudentAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface StudentAnswerRepository extends JpaRepository<StudentAnswer, UUID> {

    @Query("SELECT sa.id FROM StudentAnswer sa WHERE sa.attempt.id IN :attemptIds")
    List<UUID> findIdsByAttemptIdIn(@Param("attemptIds") Collection<UUID> attemptIds);

    @Query("SELECT sa.audioResponseUrl FROM StudentAnswer sa WHERE sa.attempt.id IN :attemptIds AND sa.audioResponseUrl IS NOT NULL AND sa.audioResponseUrl <> ''")
    List<String> findAudioUrlsByAttemptIdIn(@Param("attemptIds") Collection<UUID> attemptIds);

    @Query("SELECT COUNT(sa) FROM StudentAnswer sa WHERE sa.attempt.assignment.classroom.id = :classroomId")
    long countByClassroomId(@Param("classroomId") UUID classroomId);

    @Query("SELECT COUNT(sa) FROM StudentAnswer sa WHERE sa.attempt.assignment.classroom.id = :classroomId AND sa.audioResponseUrl IS NOT NULL AND sa.audioResponseUrl <> ''")
    long countAudioResponsesByClassroomId(@Param("classroomId") UUID classroomId);

    @Query("SELECT COUNT(sa) FROM StudentAnswer sa WHERE sa.audioResponseUrl IS NOT NULL AND sa.audioResponseUrl <> ''")
    long countAllAudioResponses();

    @Modifying
    @Query("DELETE FROM StudentAnswer sa WHERE sa.attempt.id IN :attemptIds")
    int deleteByAttemptIdIn(@Param("attemptIds") Collection<UUID> attemptIds);
}
