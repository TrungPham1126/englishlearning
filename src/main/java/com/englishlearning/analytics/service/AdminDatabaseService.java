package com.englishlearning.analytics.service;

import com.englishlearning.analytics.dto.AdminDatabaseOverviewDto;
import com.englishlearning.analytics.dto.ClassroomDetailedReportDto;
import com.englishlearning.analytics.dto.ClassroomPurgeResultDto;
import com.englishlearning.analytics.dto.R2CostReportDto;

import java.util.UUID;

public interface AdminDatabaseService {

    /**
     * Thống kê tổng quan cơ sở dữ liệu và mức chiếm dụng bản ghi theo từng lớp học.
     */
    AdminDatabaseOverviewDto getDatabaseOverview();

    /**
     * Xóa toàn bộ dữ liệu làm bài và tiến độ học tập của học viên thuộc một lớp học (giữ lại cấu trúc lớp).
     */
    ClassroomPurgeResultDto purgeClassroomSubmissions(UUID classroomId, boolean force, UUID actorUserId, String ipAddress);

    /**
     * Xóa hoàn toàn một lớp học cùng toàn bộ giáo trình, bài tập, bài làm của học viên và file media R2 liên quan.
     */
    ClassroomPurgeResultDto deleteClassroom(UUID classroomId, UUID actorUserId, String ipAddress);

    /**
     * Tổng hợp dữ liệu báo cáo chi tiết cho một lớp học.
     */
    ClassroomDetailedReportDto getClassroomDetailedReport(UUID classroomId);

    /**
     * Xuất file Excel (.xlsx) báo cáo chi tiết về lớp học.
     */
    byte[] exportClassroomReportExcel(UUID classroomId);

    /**
     * Xuất file Excel (.xlsx) từ DTO báo cáo chi tiết đã tổng hợp sẵn.
     */
    byte[] exportClassroomReportExcel(ClassroomDetailedReportDto report);

    /**
     * Xuất file Excel (.xlsx) báo cáo tổng hợp toàn trung tâm (4 sheet).
     */
    byte[] exportCenterOverviewExcel();

    /**
     * Lấy báo cáo lưu trữ và ước tính chi tiêu Cloudflare R2.
     */
    R2CostReportDto getR2CostReport();
}
