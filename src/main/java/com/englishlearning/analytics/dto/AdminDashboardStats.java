package com.englishlearning.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDashboardStats {
    private long totalUsers;
    private long totalTeachers;
    private long totalStudents;
    private long totalClasses;
    private long openClasses;
    private long inProgressClasses;
    private long planningClasses;
    private long completedClasses;
    private long totalLessons;
    private long totalVideos;
    private long pendingVideos;
    private long totalAssignments;
    private long totalSubmissions;
    private long pendingGrading;
    private double completionRate;
    private List<DailySubmissionTrendDto> weeklySubmissionsTrend;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailySubmissionTrendDto {
        private String date;
        private long submissions;
        private long graded;
    }
}