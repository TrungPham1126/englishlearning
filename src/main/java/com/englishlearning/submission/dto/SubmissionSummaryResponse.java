package com.englishlearning.submission.dto;

import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmissionSummaryResponse {
    private UUID attemptId;
    private UUID studentId;
    private String studentName;
    private String studentEmail;
    private Integer attemptNumber;
    private Double score;
    private String status;
    private Instant submittedAt;
}