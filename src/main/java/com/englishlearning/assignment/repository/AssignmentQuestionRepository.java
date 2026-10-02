package com.englishlearning.assignment.repository;

import com.englishlearning.assignment.entity.AssignmentQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AssignmentQuestionRepository extends JpaRepository<AssignmentQuestion, UUID> {
    List<AssignmentQuestion> findByAssignmentId(UUID assignmentId);
}