package com.englishlearning.submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherStudentSubmissionDto {
    private UUID attemptId;
    private UUID assignmentId;
    private String assignmentTitle;
    private String skillType;
    private List<String> questionTypes;
    private Integer attemptNumber;
    private String status;
    private Double score;
    private String teacherFeedback;
    private Instant submittedAt;
    private Integer dayNumber;
    private String dayTitle;
    private LocalDate scheduledDate;
    private Boolean hasAiEvaluation;
    private Double aiScore;
    private String aiCefr;
    private String aiEvalType;
    private String previewText;
    private Boolean hasAudio;
    private Boolean isExam;
    private Integer violationCount;
    private Boolean isCheatingFlagged;
    private String cheatingReason;
}
