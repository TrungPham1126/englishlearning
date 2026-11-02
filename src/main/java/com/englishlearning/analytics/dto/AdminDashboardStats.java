package com.englishlearning.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

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
    private Map<String, Double> averageSkillScores;
    private CompletionDistributionDto completionDistribution;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailySubmissionTrendDto {
        private String date;
        private long submissions;
        private long graded;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompletionDistributionDto {
        private double high;    // >= 80%
        private double medium;  // 50% - 79%
        private double low;     // < 50%
    }
}
