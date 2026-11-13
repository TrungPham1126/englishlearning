package com.englishlearning.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomPurgeResultDto {

    private UUID classroomId;
    private String classroomName;
    private boolean entireClassroomDeleted;
    private long deletedAiEvaluations;
    private long deletedStudentAnswers;
    private long deletedAttempts;
    private long deletedDailyProgress;
    private long deletedVideoWatchHistory;
    private long deletedVocabularyProgress;
    private long deletedR2MediaFiles;
    private long freedEstimatedKb;
    private String message;
    private Instant executedAt;
}
