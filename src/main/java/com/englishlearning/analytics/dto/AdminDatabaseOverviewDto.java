package com.englishlearning.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDatabaseOverviewDto {

    private long totalClassrooms;
    private long completedClassrooms;
    private long totalEnrolledStudents;
    private long totalAssignments;
    private long totalExams;
    private long totalAttempts;
    private long totalStudentAnswers;
    private long totalAiEvaluations;
    private long totalDailyProgressRecords;
    private long totalSubmissionAudioFiles;
    private long estimatedSubmissionDataKb;
    private List<ClassroomDatabaseItemDto> classrooms;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClassroomDatabaseItemDto {
        private UUID id;
        private String name;
        private String level;
        private String status;
        private String teacherName;
        private String startDate;
        private String endDate;
        private long studentCount;
        private long lessonCount;
        private long dailyPlanCount;
        private long assignmentCount;
        private long examCount;
        private long attemptCount;
        private long answerCount;
        private long aiEvaluationCount;
        private long dailyProgressCount;
        private long videoWatchCount;
        private long submissionAudioCount;
        private long cheatingFlagCount;
        private double averageScore;
        private long estimatedSubmissionKb;
        private boolean eligibleForCleanPurge;
    }
}
