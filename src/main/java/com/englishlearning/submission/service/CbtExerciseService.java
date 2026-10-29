package com.englishlearning.submission.service;

import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.dto.SubmissionRequest;

import java.time.Instant;
import java.util.UUID;

public interface CbtExerciseService {
    AttemptResponse submitCbtExercise(UUID studentId, UUID attemptId, SubmissionRequest request, Instant submitTime);
}
