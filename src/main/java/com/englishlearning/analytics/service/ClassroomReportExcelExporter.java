package com.englishlearning.analytics.service;

import com.englishlearning.analytics.dto.ClassroomDetailedReportDto;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Tạo workbook Excel (.xlsx) báo cáo chi tiết lớp học bằng Apache POI.
 */
@Component
public class ClassroomReportExcelExporter {

    private static final DateTimeFormatter DATE_TIME_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    public byte[] export(ClassroomDetailedReportDto report) {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();
            XSSFCellStyle bannerStyle = createBannerStyle(workbook, colorMap);
            XSSFCellStyle sectionStyle = createSectionStyle(workbook, colorMap);
            XSSFCellStyle headerStyle = createHeaderStyle(workbook, colorMap);
            XSSFCellStyle labelStyle = createLabelStyle(workbook, colorMap);
            XSSFCellStyle dataStyle = createDataStyle(workbook, HorizontalAlignment.LEFT, false);
            XSSFCellStyle dataCenterStyle = createDataStyle(workbook, HorizontalAlignment.CENTER, false);
            XSSFCellStyle dataBoldCenterStyle = createDataStyle(workbook, HorizontalAlignment.CENTER, true);
            XSSFCellStyle warnStyle = createHighlightStyle(workbook, colorMap, new Color(254, 226, 226), new Color(153, 27, 27));

            buildOverviewSheet(workbook, report, bannerStyle, sectionStyle, labelStyle, dataStyle, dataBoldCenterStyle);
            buildStudentsSheet(workbook, report, bannerStyle, headerStyle, dataStyle, dataCenterStyle, warnStyle);
            buildSubmissionsSheet(workbook, report, bannerStyle, headerStyle, dataStyle, dataCenterStyle, warnStyle);

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể tạo file báo cáo Excel cho lớp học", ex);
        }
    }

    private void buildOverviewSheet(XSSFWorkbook workbook,
                                    ClassroomDetailedReportDto report,
                                    XSSFCellStyle bannerStyle,
                                    XSSFCellStyle sectionStyle,
                                    XSSFCellStyle labelStyle,
                                    XSSFCellStyle dataStyle,
                                    XSSFCellStyle valueCenterStyle) {
        Sheet sheet = workbook.createSheet("Tong_Quan_Lop");
        sheet.setColumnWidth(0, 8500);
        sheet.setColumnWidth(1, 11000);
        sheet.setColumnWidth(2, 8500);
        sheet.setColumnWidth(3, 8500);

        Row bannerRow = sheet.createRow(0);
        bannerRow.setHeightInPoints(30);
        setCell(bannerRow, 0, "BÁO CÁO TỔNG HỢP LỚP HỌC - " + safe(report.getClassroomName()), bannerStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 3));

        Row subHeader = sheet.createRow(1);
        subHeader.setHeightInPoints(22);
        setCell(subHeader, 0, "THÔNG TIN CƠ BẢN", sectionStyle);
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 1));
        setCell(subHeader, 2, "CHỈ SỐ HỌC TẬP & DỮ LIỆU", sectionStyle);
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 2, 3));

        String generatedStr = report.getGeneratedAt() != null ? DATE_TIME_FMT.format(report.getGeneratedAt()) : "-";
        String[][] rows = {
                {"Mã lớp học", safe(report.getClassroomId() != null ? report.getClassroomId().toString() : "-"),
                        "Tổng học viên ghi danh", String.valueOf(report.getTotalStudents())},
                {"Tên lớp", safe(report.getClassroomName()),
                        "Tổng số bài giảng", String.valueOf(report.getTotalLessons())},
                {"Trình độ (CEFR)", safe(report.getLevel()),
                        "Tổng ngày lộ trình học", String.valueOf(report.getTotalDailyPlans())},
                {"Trạng thái lớp", safe(report.getStatus()),
                        "Số bài tập / Đề thi", report.getTotalAssignments() + " bài tập / " + report.getTotalExams() + " bài thi"},
                {"Giảng viên phụ trách", safe(report.getTeacherName()),
                        "Tổng lượt nộp bài / Hoàn thành", report.getTotalAttempts() + " / " + report.getCompletedAttempts()},
                {"Email giảng viên", safe(report.getTeacherEmail()),
                        "Điểm trung bình toàn lớp", String.format("%.2f / 10", report.getClassAverageScore())},
                {"Thời gian khóa học", safe(report.getStartDate()) + " -> " + safe(report.getEndDate()),
                        "Tỷ lệ hoàn thành TB (%)", String.format("%.1f%%", report.getAverageCompletionRate())},
                {"Thời điểm xuất báo cáo", generatedStr,
                        "Số bài thi cảnh báo gian lận", String.valueOf(report.getFlaggedCheatingAttempts())}
        };

        for (int i = 0; i < rows.length; i++) {
            Row r = sheet.createRow(i + 2);
            r.setHeightInPoints(22);
            setCell(r, 0, rows[i][0], labelStyle);
            setCell(r, 1, rows[i][1], dataStyle);
            setCell(r, 2, rows[i][2], labelStyle);
            setCell(r, 3, rows[i][3], valueCenterStyle);
        }

        if (report.getDescription() != null && !report.getDescription().isBlank()) {
            int rowIdx = rows.length + 3;
            Row descTitle = sheet.createRow(rowIdx);
            setCell(descTitle, 0, "Mô tả khóa học", labelStyle);
            setCell(descTitle, 1, report.getDescription(), dataStyle);
            sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 1, 3));
        }
    }

    private void buildStudentsSheet(XSSFWorkbook workbook,
                                    ClassroomDetailedReportDto report,
                                    XSSFCellStyle bannerStyle,
                                    XSSFCellStyle headerStyle,
                                    XSSFCellStyle dataStyle,
                                    XSSFCellStyle centerStyle,
                                    XSSFCellStyle warnStyle) {
        Sheet sheet = workbook.createSheet("Danh_Sach_Hoc_Vien");
        String[] headers = {
                "STT", "Họ và Tên", "Email", "Số điện thoại", "Ngày ghi danh",
                "Bài hoàn thành", "Tổng nhiệm vụ", "Tỷ lệ HT (%)", "Lượt nộp bài",
                "Lượt làm bài thi", "Điểm TB", "Thời gian học (phút)", "Cảnh báo gian lận", "Xếp loại"
        };
        int[] widths = {1800, 6500, 7500, 4200, 5000, 3800, 3800, 3500, 3500, 3800, 3200, 4800, 4200, 4200};
        for (int i = 0; i < widths.length; i++) {
            sheet.setColumnWidth(i, widths[i]);
        }

        Row banner = sheet.createRow(0);
        banner.setHeightInPoints(28);
        setCell(banner, 0, "DANH SÁCH & KẾT QUẢ HỌC VIÊN - " + safe(report.getClassroomName()), bannerStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

        Row headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(24);
        for (int i = 0; i < headers.length; i++) {
            setCell(headerRow, i, headers[i], headerStyle);
        }

        List<ClassroomDetailedReportDto.StudentReportRowDto> students = report.getStudents();
        if (students == null || students.isEmpty()) {
            Row empty = sheet.createRow(2);
            setCell(empty, 0, "Chưa có học viên nào ghi danh trong lớp này.", dataStyle);
            sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, headers.length - 1));
            return;
        }

        for (int idx = 0; idx < students.size(); idx++) {
            ClassroomDetailedReportDto.StudentReportRowDto s = students.get(idx);
            Row r = sheet.createRow(idx + 2);
            r.setHeightInPoints(20);
            setCell(r, 0, String.valueOf(idx + 1), centerStyle);
            setCell(r, 1, safe(s.getFullName()), dataStyle);
            setCell(r, 2, safe(s.getEmail()), dataStyle);
            setCell(r, 3, safe(s.getPhone()), centerStyle);
            setCell(r, 4, safe(s.getEnrolledAt()), centerStyle);
            setCell(r, 5, String.valueOf(s.getCompletedTasks()), centerStyle);
            setCell(r, 6, String.valueOf(s.getTotalTasks()), centerStyle);
            setCell(r, 7, s.getCompletionRate() + "%", centerStyle);
            setCell(r, 8, String.valueOf(s.getTotalAttempts()), centerStyle);
            setCell(r, 9, String.valueOf(s.getExamAttempts()), centerStyle);
            setCell(r, 10, String.format("%.1f", s.getAverageScore()), centerStyle);
            setCell(r, 11, String.valueOf(s.getTotalStudyMinutes()), centerStyle);
            setCell(r, 12, String.valueOf(s.getCheatingFlags()), s.getCheatingFlags() > 0 ? warnStyle : centerStyle);
            setCell(r, 13, safe(s.getClassification()), centerStyle);
        }
    }

    private void buildSubmissionsSheet(XSSFWorkbook workbook,
                                       ClassroomDetailedReportDto report,
                                       XSSFCellStyle bannerStyle,
                                       XSSFCellStyle headerStyle,
                                       XSSFCellStyle dataStyle,
                                       XSSFCellStyle centerStyle,
                                       XSSFCellStyle warnStyle) {
        Sheet sheet = workbook.createSheet("Chi_Tiet_Bai_Nop_Thi");
        String[] headers = {
                "STT", "Học viên", "Email", "Tên bài tập / Đề thi", "Phân loại",
                "Kỹ năng", "Lần làm", "Trạng thái", "Thời gian nộp", "Thời lượng (s)",
                "Điểm số", "Số vi phạm", "Đánh dấu gian lận", "Lý do vi phạm", "Nhận xét giáo viên"
        };
        int[] widths = {1800, 6000, 7000, 7500, 3500, 3500, 2600, 3600, 4800, 3500, 3000, 3000, 4000, 7000, 8000};
        for (int i = 0; i < widths.length; i++) {
            sheet.setColumnWidth(i, widths[i]);
        }

        Row banner = sheet.createRow(0);
        banner.setHeightInPoints(28);
        setCell(banner, 0, "CHI TIẾT BÀI NỘP & KẾT QUẢ BÀI THI - " + safe(report.getClassroomName()), bannerStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, headers.length - 1));

        Row headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(24);
        for (int i = 0; i < headers.length; i++) {
            setCell(headerRow, i, headers[i], headerStyle);
        }

        List<ClassroomDetailedReportDto.AttemptReportRowDto> rows = report.getSubmissions();
        if (rows == null || rows.isEmpty()) {
            Row empty = sheet.createRow(2);
            setCell(empty, 0, "Chưa có dữ liệu bài nộp hoặc đã được dọn sạch khỏi cơ sở dữ liệu.", dataStyle);
            sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, headers.length - 1));
            return;
        }

        for (int idx = 0; idx < rows.size(); idx++) {
            ClassroomDetailedReportDto.AttemptReportRowDto item = rows.get(idx);
            Row r = sheet.createRow(idx + 2);
            r.setHeightInPoints(20);
            setCell(r, 0, String.valueOf(idx + 1), centerStyle);
            setCell(r, 1, safe(item.getStudentName()), dataStyle);
            setCell(r, 2, safe(item.getStudentEmail()), dataStyle);
            setCell(r, 3, safe(item.getAssignmentTitle()), dataStyle);
            setCell(r, 4, item.isExam() ? "Bài Thi" : "Bài Tập", centerStyle);
            setCell(r, 5, safe(item.getSkillType()), centerStyle);
            setCell(r, 6, String.valueOf(item.getAttemptNumber()), centerStyle);
            setCell(r, 7, safe(item.getStatus()), centerStyle);
            setCell(r, 8, safe(item.getSubmittedAt()), centerStyle);
            setCell(r, 9, item.getDurationSeconds() != null ? String.valueOf(item.getDurationSeconds()) : "-", centerStyle);
            setCell(r, 10, item.getTotalScore() != null ? String.format("%.2f", item.getTotalScore()) : "Chờ chấm", centerStyle);
            setCell(r, 11, String.valueOf(item.getViolationCount()), item.getViolationCount() > 0 ? warnStyle : centerStyle);
            setCell(r, 12, item.isCheatingFlagged() ? "GIAN LẬN" : "Bình thường", item.isCheatingFlagged() ? warnStyle : centerStyle);
            setCell(r, 13, safe(item.getCheatingReason()), dataStyle);
            setCell(r, 14, safe(item.getTeacherFeedback()), dataStyle);
        }
    }

    private void setCell(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value);
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    private String safe(String val) {
        return val != null && !val.isBlank() ? val : "-";
    }

    private XSSFCellStyle createBannerStyle(XSSFWorkbook wb, DefaultIndexedColorMap colorMap) {
        XSSFFont font = wb.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 12);
        font.setBold(true);
        font.setColor(new XSSFColor(Color.WHITE, colorMap));

        XSSFCellStyle style = wb.createCellStyle();
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(new Color(30, 58, 138), colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }

    private XSSFCellStyle createSectionStyle(XSSFWorkbook wb, DefaultIndexedColorMap colorMap) {
        XSSFFont font = wb.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 10);
        font.setBold(true);
        font.setColor(new XSSFColor(new Color(30, 58, 138), colorMap));

        XSSFCellStyle style = wb.createCellStyle();
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(new Color(239, 246, 255), colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyBorders(style);
        return style;
    }

    private XSSFCellStyle createHeaderStyle(XSSFWorkbook wb, DefaultIndexedColorMap colorMap) {
        XSSFFont font = wb.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 10);
        font.setBold(true);
        font.setColor(new XSSFColor(new Color(15, 23, 42), colorMap));

        XSSFCellStyle style = wb.createCellStyle();
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(new Color(226, 232, 240), colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        applyBorders(style);
        return style;
    }

    private XSSFCellStyle createLabelStyle(XSSFWorkbook wb, DefaultIndexedColorMap colorMap) {
        XSSFFont font = wb.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 10);
        font.setBold(true);
        font.setColor(new XSSFColor(new Color(51, 65, 85), colorMap));

        XSSFCellStyle style = wb.createCellStyle();
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(new Color(248, 250, 252), colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyBorders(style);
        return style;
    }

    private XSSFCellStyle createDataStyle(XSSFWorkbook wb, HorizontalAlignment align, boolean bold) {
        XSSFFont font = wb.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 10);
        font.setBold(bold);

        XSSFCellStyle style = wb.createCellStyle();
        style.setFont(font);
        style.setAlignment(align);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        applyBorders(style);
        return style;
    }

    private XSSFCellStyle createHighlightStyle(XSSFWorkbook wb, DefaultIndexedColorMap colorMap, Color bg, Color fg) {
        XSSFFont font = wb.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 10);
        font.setBold(true);
        font.setColor(new XSSFColor(fg, colorMap));

        XSSFCellStyle style = wb.createCellStyle();
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(bg, colorMap));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyBorders(style);
        return style;
    }

    private void applyBorders(XSSFCellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setTopBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
    }
}
