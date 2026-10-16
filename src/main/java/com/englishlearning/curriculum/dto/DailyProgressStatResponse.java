package com.englishlearning.curriculum.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class DailyProgressStatResponse {
    private String studentId;
    private String studentName;
    private Integer overallRate;
    private List<DayStat> days;

    @Data
    @Builder
    public static class DayStat {
        private Integer dayNumber;
        private Integer rate;
        private Integer minutes;
    }
}