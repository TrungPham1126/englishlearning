package com.englishlearning.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomDetailedReportDto {

    private UUID classroomId;
    private String classroomName;
    private String description;
    private String level;
    private String status;
    private String teacherName;
    private String teacherEmail;
    private String startDate;
    private String endDate;
    private Instant generatedAt;
    private int totalStudents;
    private int totalLessons;
    private int totalDailyPlans;
    private int totalAssignments;
    private int totalExams;
    private long totalAttempts;
    private long completedAttempts;
    private long flaggedCheatingAttempts;
    private double classAverageScore;
    private double averageCompletionRate;
    private List<StudentReportRowDto> students;
    private List<AttemptReportRowDto> submissions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentReportRowDto {
        private UUID studentId;
        private String fullName;
        private String email;
        private String phone;
        private String enrolledAt;
        private int completedTasks;
        private int totalTasks;
        private int completionRate;
        private double averageScore;
        private long totalAttempts;
        private long examAttempts;
        private long cheatingFlags;
        private int totalStudyMinutes;
        private String classification;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttemptReportRowDto {
        private UUID attemptId;
        private String studentName;
        private String studentEmail;
        private String assignmentTitle;
        private String skillType;
        private boolean exam;
        private int attemptNumber;
        private String status;
        private String submittedAt;
        private Integer durationSeconds;
        private Double totalScore;
        private int violationCount;
        private boolean cheatingFlagged;
        private String cheatingReason;
        private String teacherFeedback;
    }
}
