package com.englishlearning.analytics.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class TeacherDashboardResponse {
    private long totalClasses;
    private long totalStudents;
    private long pendingGrading;
    private double avgCompletionRate;
    private List<SkillAnalysis> skills;
    private List<PendingTask> tasks;

    @Data
    @Builder
    public static class SkillAnalysis {
        private String skill;
        private double score;
        private String status;
        private String barColor;
    }

    @Data
    @Builder
    public static class PendingTask {
        private String id;
        private String title;
        private String className;
        private String due;
        private String type;
    }
}