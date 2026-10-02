package com.englishlearning.submission.dto;

import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAssignmentSummaryResponse {
    private UUID id;
    private String title;
    private String description;
    private String skillType;
    private Integer timeLimitMinutes;
    private Instant dueDate;
    private Integer maxAttempts;
    private Double passScore;
    private Integer attemptsCount;
    private Double highestScore;
    private String status;
}