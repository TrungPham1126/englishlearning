package com.englishlearning.submission.service;

import com.englishlearning.submission.dto.*;
import com.englishlearning.submission.entity.AssignmentAttempt;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface SubmissionService {

    AttemptResponse startAttempt(UUID studentId, UUID assignmentId);

    AttemptResponse submitAttempt(UUID studentId, UUID attemptId, SubmissionRequest request);

    AttemptResponse uploadAudioResponse(UUID studentId, UUID attemptId, UUID questionId, MultipartFile audio);

    AttemptResponse getAttemptDetail(UUID attemptId, UUID studentId, boolean isTeacher);

    List<StudentAssignmentSummaryResponse> getStudentClassAssignments(UUID classId, UUID studentId);

    List<AttemptResponse> getStudentAttemptsHistory(UUID assignmentId, UUID studentId);

    List<SubmissionSummaryResponse> getTeacherSubmissions(UUID assignmentId);

    AttemptResponse gradeSubmission(UUID attemptId, TeacherGradeRequest request);

    String computeRemedialMessage(AssignmentAttempt att);
}
