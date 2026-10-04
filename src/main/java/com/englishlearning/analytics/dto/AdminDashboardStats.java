package com.englishlearning.analytics.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminDashboardStats {
    private long totalUsers;
    private long totalTeachers;
    private long totalStudents;
    private long totalClasses;
    private long totalLessons;
    private long totalVideos;
    private long pendingVideos;
    private long totalAssignments;
}