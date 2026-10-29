package com.englishlearning.submission.service;

import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.submission.dto.GradingResult;
import com.englishlearning.submission.dto.SubmissionRequest;

import java.util.List;

public interface GradingEngineService {
    GradingResult evaluateSubmission(List<AssignmentQuestion> questions, List<SubmissionRequest.AnswerDto> answers);
}
