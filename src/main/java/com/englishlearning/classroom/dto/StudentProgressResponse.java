package com.englishlearning.classroom.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class StudentProgressResponse {
    private UUID studentId;
    private String fullName;
    private String email;
    private String phone;
    private String enrolledAt;
    private Integer completedTasks;
    private Integer totalTasks;
    private Integer completionRate;
    private Double averageScore;
    private List<String> weaknesses;
    private Integer attendanceScore;
    private Integer totalStudyMinutes;
    private List<DailyProgressDetail> dailyProgressDetails; // Structured daily progress

    @Data
    @Builder
    public static class DailyProgressDetail {
        private String date;
        private Integer completedTasks;
        private Integer studyMinutes;
        private Double score;
    }
}