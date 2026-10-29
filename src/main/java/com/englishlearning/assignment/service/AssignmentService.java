package com.englishlearning.assignment.service;

import com.englishlearning.assignment.dto.AssignmentRequest;
import com.englishlearning.assignment.entity.Assignment;

import java.util.List;
import java.util.UUID;

public interface AssignmentService {

    Assignment createAssignment(AssignmentRequest request);

    Assignment getAssignmentById(UUID id);

    Assignment updateAssignment(UUID id, AssignmentRequest request);

    void deleteAssignment(UUID id);

    List<Assignment> getAssignmentsByClassroom(UUID classroomId);

    void backfillAllAudios();
}
