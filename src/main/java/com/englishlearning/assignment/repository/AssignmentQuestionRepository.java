package com.englishlearning.assignment.repository;

import com.englishlearning.assignment.entity.AssignmentQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface AssignmentQuestionRepository extends JpaRepository<AssignmentQuestion, UUID> {
    List<AssignmentQuestion> findByAssignmentId(UUID assignmentId);

    @Query("SELECT q.id FROM AssignmentQuestion q WHERE q.assignment.id IN :assignmentIds")
    List<UUID> findIdsByAssignmentIdIn(@Param("assignmentIds") Collection<UUID> assignmentIds);

    @Modifying
    @Query("DELETE FROM AssignmentQuestion q WHERE q.id IN :ids")
    int deleteByIdIn(@Param("ids") Collection<UUID> ids);
}
