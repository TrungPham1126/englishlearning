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
    private Integer currentStreak; // Chuỗi ngày có bài tập hoàn thành liên tiếp
    private Boolean hasHomeworkToday; // Hôm nay có bài tập được giao hay không
    private Boolean completedToday; // Đã hoàn thành 100% bài tập hôm nay hay chưa
    private List<DaySummaryDto> days; // Danh sách các DAY (cột trái)
    private DayDetailDto currentSelectedDay; // Chi tiết DAY đang chọn (cột phải)
}