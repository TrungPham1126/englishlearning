package com.englishlearning.curriculum.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DailyHomeworkOverviewResponse {
    private Integer completionPercentage; // Ví dụ: 81
    private Integer totalDays; // Tổng số ngày đã mở
    private Integer completedDays; // Số ngày học sinh đã hoàn thành
    private List<DaySummaryDto> days; // Danh sách các DAY (cột trái)
    private DayDetailDto currentSelectedDay; // Chi tiết DAY đang chọn (cột phải)
}