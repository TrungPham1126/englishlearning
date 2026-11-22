package com.englishlearning.analytics.service;

import com.englishlearning.analytics.dto.AdminDatabaseOverviewDto;
import com.englishlearning.analytics.dto.ClassroomDetailedReportDto;
import com.englishlearning.analytics.dto.R2CostReportDto;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Tạo workbook Excel (.xlsx) chuẩn hóa, trình bày đẹp và dễ đọc bằng Apache POI
 * cho báo cáo chi tiết lớp học và báo cáo tổng hợp toàn trung tâm.
 */
@Component
public class ClassroomReportExcelExporter {

    private static final DateTimeFormatter DATE_TIME_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private static final String[] CLASSIFICATION_ORDER = {
            "Xuất sắc", "Giỏi", "Khá", "Trung bình", "Cần cố gắng", "Chưa có điểm"
    };

    public byte[] export(ClassroomDetailedReportDto report) {
        ClassroomDetailedReportDto safeReport = report != null
                ? report
                : ClassroomDetailedReportDto.builder().build();

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            ExcelPalette palette = new ExcelPalette(workbook);

            buildOverviewSheet(workbook, safeReport, palette);
            buildStudentsSheet(workbook, safeReport, palette);
            buildSubmissionsSheet(workbook, safeReport, palette);

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể tạo file báo cáo Excel cho lớp học", ex);
        }
    }

    /**
     * Xuất workbook Excel 4 sheet tổng hợp toàn trung tâm (Tổng quan, Lớp học, Giảng viên, Cloud R2).
     */
    public byte[] exportCenterReport(AdminDatabaseOverviewDto overview, R2CostReportDto r2Report) {
        AdminDatabaseOverviewDto safeOverview = overview != null
                ? overview
                : AdminDatabaseOverviewDto.builder().classrooms(Collections.emptyList()).build();
        R2CostReportDto safeR2 = r2Report != null
                ? r2Report
                : R2CostReportDto.builder()
                        .categoryBreakdowns(Collections.emptyList())
                        .largestObjects(Collections.emptyList())
                        .build();

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            ExcelPalette palette = new ExcelPalette(workbook);

            buildCenterOverviewSheet(workbook, safeOverview, safeR2, palette);
            buildCenterClassroomsSheet(workbook, safeOverview, palette);
            buildCenterTeachersSheet(workbook, safeOverview, palette);
            buildCenterR2Sheet(workbook, safeR2, palette);

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể tạo file báo cáo Excel tổng hợp trung tâm", ex);
        }
    }

    // =========================================================================
    // CLASSROOM 3-SHEET EXPORT
    // =========================================================================

    private void buildOverviewSheet(XSSFWorkbook workbook,
                                    ClassroomDetailedReportDto report,
                                    ExcelPalette palette) {
        Sheet sheet = workbook.createSheet("Tong_Quan_Lop");
        int[] widths = {8800, 11200, 8800, 8800};
        applyColumnWidths(sheet, widths);

        Row bannerRow = sheet.createRow(0);
        bannerRow.setHeightInPoints(34);
        mergeAndStyle(sheet, 0, 0, 0, 3,
                "BÁO CÁO TỔNG HỢP LỚP HỌC - " + safe(report.getClassroomName()),
                palette.banner);

        Row subHeader = sheet.createRow(1);
        subHeader.setHeightInPoints(24);
        mergeAndStyle(sheet, 1, 1, 0, 1, "THÔNG TIN CƠ BẢN", palette.section);
        mergeAndStyle(sheet, 1, 1, 2, 3, "CHỈ SỐ HỌC TẬP & DỮ LIỆU", palette.section);

        String generatedStr = report.getGeneratedAt() != null
                ? DATE_TIME_FMT.format(report.getGeneratedAt())
                : DATE_TIME_FMT.format(Instant.now());

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
            boolean alt = i % 2 == 1;
            setCell(r, 0, rows[i][0], palette.label);
            setCell(r, 1, rows[i][1], alt ? palette.dataLeftAlt : palette.dataLeft);
            setCell(r, 2, rows[i][2], palette.label);

            CellStyle rightValStyle = alt ? palette.dataBoldCenterAlt : palette.dataBoldCenter;
            if (i == 7 && report.getFlaggedCheatingAttempts() > 0) {
                rightValStyle = palette.badgeDanger;
            } else if (i == 5 && report.getClassAverageScore() >= 8.0) {
                rightValStyle = palette.badgeSuccess;
            }
            setCell(r, 3, rows[i][3], rightValStyle);
        }

        int nextRow = rows.length + 2;
        if (report.getDescription() != null && !report.getDescription().isBlank()) {
            nextRow++;
            Row descRow = sheet.createRow(nextRow);
            descRow.setHeightInPoints(30);
            setCell(descRow, 0, "Mô tả khóa học", palette.label);
            mergeAndStyle(sheet, nextRow, nextRow, 1, 3, report.getDescription(), palette.dataLeft);
            nextRow++;
        }

        // Bảng 2: Phân tích xếp loại học lực học viên
        nextRow += 2;
        Row rankSection = sheet.createRow(nextRow);
        rankSection.setHeightInPoints(24);
        mergeAndStyle(sheet, nextRow, nextRow, 0, 3, "PHÂN TÍCH XẾP LOẠI HỌC LỰC HỌC VIÊN", palette.section);
        nextRow++;

        Row rankHeader = sheet.createRow(nextRow);
        rankHeader.setHeightInPoints(22);
        String[] rankHeaders = {"Xếp loại học lực", "Số học viên", "Tỷ lệ (%)", "Ghi chú đánh giá"};
        for (int c = 0; c < rankHeaders.length; c++) {
            setCell(rankHeader, c, rankHeaders[c], palette.header);
        }
        nextRow++;

        List<ClassroomDetailedReportDto.StudentReportRowDto> students =
                report.getStudents() != null ? report.getStudents() : Collections.emptyList();
        Map<String, Integer> rankCounts = new LinkedHashMap<>();
        for (String key : CLASSIFICATION_ORDER) {
            rankCounts.put(key, 0);
        }
        for (ClassroomDetailedReportDto.StudentReportRowDto s : students) {
            String cls = safe(s.getClassification());
            rankCounts.put(cls, rankCounts.getOrDefault(cls, 0) + 1);
        }

        int totalStudentsInList = students.size();
        int rankIdx = 0;
        for (Map.Entry<String, Integer> entry : rankCounts.entrySet()) {
            if (entry.getValue() == 0 && !Arrays.asList(CLASSIFICATION_ORDER).contains(entry.getKey())) {
                continue;
            }
            Row r = sheet.createRow(nextRow++);
            r.setHeightInPoints(20);
            boolean alt = (rankIdx++ % 2) == 1;
            double pct = totalStudentsInList > 0 ? (entry.getValue() * 100.0) / totalStudentsInList : 0.0;
            setCell(r, 0, entry.getKey(), classificationBadgeStyle(entry.getKey(), palette));
            setCell(r, 1, String.valueOf(entry.getValue()), alt ? palette.dataCenterAlt : palette.dataCenter);
            setCell(r, 2, String.format("%.1f%%", pct), alt ? palette.dataCenterAlt : palette.dataCenter);
            setCell(r, 3, classificationNote(entry.getKey()), alt ? palette.dataLeftAlt : palette.dataLeft);
        }

        // Bảng 3: Thống kê bài nộp theo kỹ năng
        nextRow += 2;
        Row skillSection = sheet.createRow(nextRow);
        skillSection.setHeightInPoints(24);
        mergeAndStyle(sheet, nextRow, nextRow, 0, 3, "THỐNG KÊ BÀI NỘP & ĐIỂM THEO KỸ NĂNG", palette.section);
        nextRow++;

        Row skillHeader = sheet.createRow(nextRow++);
        skillHeader.setHeightInPoints(22);
        String[] skillHeaders = {"Kỹ năng", "Tổng lượt nộp (Bài thi)", "Điểm TB bài đã chấm", "Số cảnh báo gian lận"};
        for (int c = 0; c < skillHeaders.length; c++) {
            setCell(skillHeader, c, skillHeaders[c], palette.header);
        }

        List<ClassroomDetailedReportDto.AttemptReportRowDto> submissions =
                report.getSubmissions() != null ? report.getSubmissions() : Collections.emptyList();
        if (submissions.isEmpty()) {
            Row emptySkill = sheet.createRow(nextRow++);
            emptySkill.setHeightInPoints(22);
            mergeAndStyle(sheet, nextRow - 1, nextRow - 1, 0, 3,
                    "Chưa có dữ liệu bài nộp để thống kê theo kỹ năng.", palette.dataCenter);
        } else {
            Map<String, List<ClassroomDetailedReportDto.AttemptReportRowDto>> bySkill = new LinkedHashMap<>();
            for (ClassroomDetailedReportDto.AttemptReportRowDto sub : submissions) {
                String sk = safe(sub.getSkillType());
                bySkill.computeIfAbsent(sk, k -> new ArrayList<>()).add(sub);
            }
            int sIdx = 0;
            for (Map.Entry<String, List<ClassroomDetailedReportDto.AttemptReportRowDto>> entry : bySkill.entrySet()) {
                List<ClassroomDetailedReportDto.AttemptReportRowDto> list = entry.getValue();
                long examCnt = list.stream().filter(ClassroomDetailedReportDto.AttemptReportRowDto::isExam).count();
                long cheatCnt = list.stream().filter(ClassroomDetailedReportDto.AttemptReportRowDto::isCheatingFlagged).count();
                OptionalDouble avgOpt = list.stream()
                        .filter(it -> it.getTotalScore() != null)
                        .mapToDouble(ClassroomDetailedReportDto.AttemptReportRowDto::getTotalScore)
                        .average();

                Row r = sheet.createRow(nextRow++);
                r.setHeightInPoints(20);
                boolean alt = (sIdx++ % 2) == 1;
                setCell(r, 0, entry.getKey(), alt ? palette.dataBoldLeftAlt : palette.dataBoldLeft);
                setCell(r, 1, list.size() + " lượt (" + examCnt + " bài thi)", alt ? palette.dataCenterAlt : palette.dataCenter);
                setCell(r, 2, avgOpt.isPresent() ? String.format("%.2f / 10", avgOpt.getAsDouble()) : "Chưa chấm",
                        avgOpt.isPresent() && avgOpt.getAsDouble() >= 8.0 ? palette.badgeSuccess : (alt ? palette.dataCenterAlt : palette.dataCenter));
                setCell(r, 3, String.valueOf(cheatCnt), cheatCnt > 0 ? palette.badgeDanger : palette.badgeSuccess);
            }
        }

        // Khối chữ ký xác nhận
        appendSignatureBlock(sheet, nextRow + 2, 0, 3, palette);
        configureSheetPrintAndView(sheet, 0, -1, -1);
    }

    private void buildStudentsSheet(XSSFWorkbook workbook,
                                    ClassroomDetailedReportDto report,
                                    ExcelPalette palette) {
        Sheet sheet = workbook.createSheet("Danh_Sach_Hoc_Vien");
        String[] headers = {
                "STT", "Họ và Tên", "Email", "Số điện thoại", "Ngày ghi danh",
                "Bài hoàn thành", "Tổng nhiệm vụ", "Tỷ lệ HT (%)", "Lượt nộp bài",
                "Lượt làm bài thi", "Điểm TB", "Thời gian học (phút)", "Cảnh báo gian lận", "Xếp loại"
        };
        int[] widths = {1800, 6800, 7800, 4400, 4800, 3800, 3800, 3600, 3500, 3800, 3200, 4800, 4200, 4400};
        applyColumnWidths(sheet, widths);

        Row banner = sheet.createRow(0);
        banner.setHeightInPoints(32);
        mergeAndStyle(sheet, 0, 0, 0, headers.length - 1,
                "DANH SÁCH & KẾT QUẢ HỌC VIÊN - " + safe(report.getClassroomName()),
                palette.banner);

        Row headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(26);
        for (int i = 0; i < headers.length; i++) {
            setCell(headerRow, i, headers[i], palette.header);
        }

        List<ClassroomDetailedReportDto.StudentReportRowDto> students = report.getStudents();
        if (students == null || students.isEmpty()) {
            Row empty = sheet.createRow(2);
            empty.setHeightInPoints(24);
            mergeAndStyle(sheet, 2, 2, 0, headers.length - 1,
                    "Chưa có học viên nào ghi danh trong lớp này.", palette.dataCenter);
            configureSheetPrintAndView(sheet, 2, -1, -1);
            return;
        }

        int totalCompleted = 0;
        int totalTasks = 0;
        double sumCompletion = 0;
        long totalAttempts = 0;
        long totalExams = 0;
        double sumScore = 0;
        int scoredCount = 0;
        int totalMinutes = 0;
        long totalCheating = 0;

        for (int idx = 0; idx < students.size(); idx++) {
            ClassroomDetailedReportDto.StudentReportRowDto s = students.get(idx);
            Row r = sheet.createRow(idx + 2);
            r.setHeightInPoints(21);
            boolean alt = (idx % 2) == 1;

            CellStyle left = alt ? palette.dataLeftAlt : palette.dataLeft;
            CellStyle center = alt ? palette.dataCenterAlt : palette.dataCenter;

            setCell(r, 0, String.valueOf(idx + 1), center);
            setCell(r, 1, safe(s.getFullName()), alt ? palette.dataBoldLeftAlt : palette.dataBoldLeft);
            setCell(r, 2, safe(s.getEmail()), left);
            setCell(r, 3, safe(s.getPhone()), center);
            setCell(r, 4, safe(s.getEnrolledAt()), center);
            setCell(r, 5, String.valueOf(s.getCompletedTasks()), center);
            setCell(r, 6, String.valueOf(s.getTotalTasks()), center);
            setCell(r, 7, s.getCompletionRate() + "%", completionBadgeStyle(s.getCompletionRate(), palette));
            setCell(r, 8, String.valueOf(s.getTotalAttempts()), center);
            setCell(r, 9, String.valueOf(s.getExamAttempts()), center);
            setCell(r, 10, String.format("%.1f", s.getAverageScore()), scoreStyle(s.getAverageScore(), alt, palette));
            setCell(r, 11, String.valueOf(s.getTotalStudyMinutes()), center);
            setCell(r, 12, String.valueOf(s.getCheatingFlags()), s.getCheatingFlags() > 0 ? palette.badgeDanger : palette.badgeSuccess);
            setCell(r, 13, safe(s.getClassification()), classificationBadgeStyle(s.getClassification(), palette));

            totalCompleted += s.getCompletedTasks();
            totalTasks += s.getTotalTasks();
            sumCompletion += s.getCompletionRate();
            totalAttempts += s.getTotalAttempts();
            totalExams += s.getExamAttempts();
            if (s.getAverageScore() > 0) {
                sumScore += s.getAverageScore();
                scoredCount++;
            }
            totalMinutes += s.getTotalStudyMinutes();
            totalCheating += s.getCheatingFlags();
        }

        // Dòng tổng kết toàn lớp
        int totalRowIdx = students.size() + 2;
        Row totalRow = sheet.createRow(totalRowIdx);
        totalRow.setHeightInPoints(24);
        mergeAndStyle(sheet, totalRowIdx, totalRowIdx, 0, 4,
                "TỔNG CỘNG / TRUNG BÌNH TOÀN LỚP (" + students.size() + " học viên)",
                palette.totalLeft);
        setCell(totalRow, 5, String.valueOf(totalCompleted), palette.totalCenter);
        setCell(totalRow, 6, String.valueOf(totalTasks), palette.totalCenter);
        setCell(totalRow, 7, String.format("%.1f%%", sumCompletion / students.size()), palette.totalCenter);
        setCell(totalRow, 8, String.valueOf(totalAttempts), palette.totalCenter);
        setCell(totalRow, 9, String.valueOf(totalExams), palette.totalCenter);
        setCell(totalRow, 10, scoredCount > 0 ? String.format("%.2f", sumScore / scoredCount) : "0.0", palette.totalCenter);
        setCell(totalRow, 11, String.valueOf(totalMinutes), palette.totalCenter);
        setCell(totalRow, 12, String.valueOf(totalCheating), totalCheating > 0 ? palette.badgeDanger : palette.totalCenter);
        setCell(totalRow, 13, "-", palette.totalCenter);

        configureSheetPrintAndView(sheet, 2, headers.length - 1, students.size() + 1);
    }

    private void buildSubmissionsSheet(XSSFWorkbook workbook,
                                       ClassroomDetailedReportDto report,
                                       ExcelPalette palette) {
        Sheet sheet = workbook.createSheet("Chi_Tiet_Bai_Nop_Thi");
        String[] headers = {
                "STT", "Học viên", "Email", "Tên bài tập / Đề thi", "Phân loại",
                "Kỹ năng", "Lần làm", "Trạng thái", "Thời gian nộp", "Thời lượng (s)",
                "Điểm số", "Số vi phạm", "Đánh dấu gian lận", "Lý do vi phạm", "Nhận xét giáo viên"
        };
        int[] widths = {1800, 6200, 7200, 7800, 3500, 3500, 2600, 3800, 4800, 3500, 3200, 3000, 4000, 7200, 8200};
        applyColumnWidths(sheet, widths);

        Row banner = sheet.createRow(0);
        banner.setHeightInPoints(32);
        mergeAndStyle(sheet, 0, 0, 0, headers.length - 1,
                "CHI TIẾT BÀI NỘP & KẾT QUẢ BÀI THI - " + safe(report.getClassroomName()),
                palette.banner);

        Row headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(26);
        for (int i = 0; i < headers.length; i++) {
            setCell(headerRow, i, headers[i], palette.header);
        }

        List<ClassroomDetailedReportDto.AttemptReportRowDto> rows = report.getSubmissions();
        if (rows == null || rows.isEmpty()) {
            Row empty = sheet.createRow(2);
            empty.setHeightInPoints(24);
            mergeAndStyle(sheet, 2, 2, 0, headers.length - 1,
                    "Chưa có dữ liệu bài nộp hoặc đã được dọn sạch khỏi cơ sở dữ liệu.", palette.dataCenter);
            configureSheetPrintAndView(sheet, 2, -1, -1);
            return;
        }

        long examCount = 0;
        double sumScore = 0;
        int scoredCount = 0;
        long totalViolations = 0;
        long totalCheating = 0;

        for (int idx = 0; idx < rows.size(); idx++) {
            ClassroomDetailedReportDto.AttemptReportRowDto item = rows.get(idx);
            Row r = sheet.createRow(idx + 2);
            r.setHeightInPoints(22);
            boolean alt = (idx % 2) == 1;

            CellStyle left = alt ? palette.dataLeftAlt : palette.dataLeft;
            CellStyle center = alt ? palette.dataCenterAlt : palette.dataCenter;

            setCell(r, 0, String.valueOf(idx + 1), center);
            setCell(r, 1, safe(item.getStudentName()), alt ? palette.dataBoldLeftAlt : palette.dataBoldLeft);
            setCell(r, 2, safe(item.getStudentEmail()), left);
            setCell(r, 3, safe(item.getAssignmentTitle()), left);
            setCell(r, 4, item.isExam() ? "Bài Thi" : "Bài Tập", item.isExam() ? palette.badgeInfo : palette.badgeNeutral);
            setCell(r, 5, safe(item.getSkillType()), center);
            setCell(r, 6, String.valueOf(item.getAttemptNumber()), center);
            setCell(r, 7, safe(item.getStatus()), statusBadgeStyle(item.getStatus(), palette));
            setCell(r, 8, safe(item.getSubmittedAt()), center);
            setCell(r, 9, item.getDurationSeconds() != null ? String.valueOf(item.getDurationSeconds()) : "-", center);
            setCell(r, 10, item.getTotalScore() != null ? String.format("%.2f", item.getTotalScore()) : "Chờ chấm",
                    item.getTotalScore() != null ? scoreStyle(item.getTotalScore(), alt, palette) : palette.badgeWarning);
            setCell(r, 11, String.valueOf(item.getViolationCount()), item.getViolationCount() > 0 ? palette.badgeDanger : center);
            setCell(r, 12, item.isCheatingFlagged() ? "GIAN LẬN" : "Bình thường",
                    item.isCheatingFlagged() ? palette.badgeDanger : palette.badgeSuccess);
            setCell(r, 13, safe(item.getCheatingReason()), left);
            setCell(r, 14, safe(item.getTeacherFeedback()), left);

            if (item.isExam()) examCount++;
            if (item.getTotalScore() != null) {
                sumScore += item.getTotalScore();
                scoredCount++;
            }
            totalViolations += item.getViolationCount();
            if (item.isCheatingFlagged()) totalCheating++;
        }

        int totalRowIdx = rows.size() + 2;
        Row totalRow = sheet.createRow(totalRowIdx);
        totalRow.setHeightInPoints(24);
        mergeAndStyle(sheet, totalRowIdx, totalRowIdx, 0, 3,
                "TỔNG KẾT BÀI NỘP & KẾT QUẢ THI (" + rows.size() + " lượt)",
                palette.totalLeft);
        setCell(totalRow, 4, examCount + " thi / " + (rows.size() - examCount) + " BT", palette.totalCenter);
        mergeAndStyle(sheet, totalRowIdx, totalRowIdx, 5, 9, "Điểm trung bình bài đã chấm", palette.totalCenter);
        setCell(totalRow, 10, scoredCount > 0 ? String.format("%.2f", sumScore / scoredCount) : "-", palette.totalCenter);
        setCell(totalRow, 11, String.valueOf(totalViolations), totalViolations > 0 ? palette.badgeDanger : palette.totalCenter);
        setCell(totalRow, 12, totalCheating + " cảnh báo", totalCheating > 0 ? palette.badgeDanger : palette.totalCenter);
        mergeAndStyle(sheet, totalRowIdx, totalRowIdx, 13, 14, "-", palette.totalCenter);

        configureSheetPrintAndView(sheet, 2, headers.length - 1, rows.size() + 1);
    }

    // =========================================================================
    // CENTER-WIDE 4-SHEET EXPORT
    // =========================================================================

    private void buildCenterOverviewSheet(XSSFWorkbook workbook,
                                          AdminDatabaseOverviewDto overview,
                                          R2CostReportDto r2Report,
                                          ExcelPalette palette) {
        Sheet sheet = workbook.createSheet("Tong_Quan_Trung_Tam");
        applyColumnWidths(sheet, new int[]{9200, 10000, 9200, 10000});

        Row banner = sheet.createRow(0);
        banner.setHeightInPoints(34);
        mergeAndStyle(sheet, 0, 0, 0, 3,
                "BÁO CÁO TỔNG HỢP HOẠT ĐỘNG TRUNG TÂM ĐÀO TẠO ELP",
                palette.banner);

        Row subHeader = sheet.createRow(1);
        subHeader.setHeightInPoints(24);
        mergeAndStyle(sheet, 1, 1, 0, 1, "QUY MÔ ĐÀO TẠO & DỮ LIỆU HỌC TẬP", palette.section);
        mergeAndStyle(sheet, 1, 1, 2, 3, "HẠ TẦNG LƯU TRỮ CLOUDFLARE R2 & CHI PHÍ", palette.section);

        String generatedStr = r2Report.getGeneratedAt() != null
                ? DATE_TIME_FMT.format(r2Report.getGeneratedAt())
                : DATE_TIME_FMT.format(Instant.now());
        String estSizeText = formatKb(overview.getEstimatedSubmissionDataKb());

        String[][] rows = {
                {"Tổng số lớp học", String.valueOf(overview.getTotalClassrooms()),
                        "Tên Bucket R2", safe(r2Report.getBucketName())},
                {"Số lớp đã kết thúc", String.valueOf(overview.getCompletedClassrooms()),
                        "Chế độ đồng bộ dữ liệu", r2Report.isLiveConnected() ? "LIVE R2 BUCKET" : "ƯỚC TÍNH DATABASE"},
                {"Tổng lượt học viên ghi danh", String.valueOf(overview.getTotalEnrolledStudents()),
                        "Tổng số đối tượng (Objects)", String.valueOf(r2Report.getTotalObjects())},
                {"Tổng bài tập / Đề thi", overview.getTotalAssignments() + " bài tập / " + overview.getTotalExams() + " đề thi",
                        "Dung lượng R2 sử dụng", String.format("%.4f GB (%.1f%% Free 10GB)", r2Report.getTotalStorageGb(), r2Report.getFreeTierUsagePercent())},
                {"Tổng lượt nộp bài tập & thi", String.valueOf(overview.getTotalAttempts()),
                        "Thao tác Class A / Class B", r2Report.getClassAOps() + " / " + r2Report.getClassBOps()},
                {"Tổng bản ghi câu trả lời", String.valueOf(overview.getTotalStudentAnswers()),
                        "Chi phí dự kiến tháng (USD)", String.format("$%.4f", r2Report.getTotalPayableUsd())},
                {"Tổng lượt AI đánh giá", String.valueOf(overview.getTotalAiEvaluations()),
                        "Quy đổi VNĐ dự kiến", String.format("%,d ₫", r2Report.getTotalPayableVnd())},
                {"Tổng file Audio Speaking", String.valueOf(overview.getTotalSubmissionAudioFiles()),
                        "Ngân sách tháng định mức", String.format("$%.2f", r2Report.getMonthlyBudgetUsd())},
                {"Dung lượng dữ liệu bài làm", estSizeText,
                        "Thời điểm xuất báo cáo", generatedStr}
        };

        for (int i = 0; i < rows.length; i++) {
            Row r = sheet.createRow(i + 2);
            r.setHeightInPoints(22);
            boolean alt = (i % 2) == 1;
            setCell(r, 0, rows[i][0], palette.label);
            setCell(r, 1, rows[i][1], alt ? palette.dataBoldCenterAlt : palette.dataBoldCenter);
            setCell(r, 2, rows[i][2], palette.label);
            setCell(r, 3, rows[i][3], alt ? palette.dataBoldCenterAlt : palette.dataBoldCenter);
        }

        // Phân bổ theo trạng thái & trình độ CEFR từ danh sách lớp
        List<AdminDatabaseOverviewDto.ClassroomDatabaseItemDto> classrooms =
                overview.getClassrooms() != null ? overview.getClassrooms() : Collections.emptyList();

        int nextRow = rows.length + 3;
        Row distTitle = sheet.createRow(nextRow);
        distTitle.setHeightInPoints(24);
        mergeAndStyle(sheet, nextRow, nextRow, 0, 1, "PHÂN BỔ LỚP THEO TRẠNG THÁI", palette.section);
        mergeAndStyle(sheet, nextRow, nextRow, 2, 3, "PHÂN BỔ LỚP THEO TRÌNH ĐỘ (CEFR)", palette.section);
        nextRow++;

        Row distHeader = sheet.createRow(nextRow++);
        distHeader.setHeightInPoints(22);
        setCell(distHeader, 0, "Trạng thái lớp", palette.header);
        setCell(distHeader, 1, "Số lớp / Tổng sĩ số", palette.header);
        setCell(distHeader, 2, "Trình độ CEFR", palette.header);
        setCell(distHeader, 3, "Số lớp / Tổng sĩ số", palette.header);

        Map<String, long[]> statusMap = new LinkedHashMap<>();
        Map<String, long[]> levelMap = new LinkedHashMap<>();
        for (AdminDatabaseOverviewDto.ClassroomDatabaseItemDto c : classrooms) {
            String st = safe(c.getStatus());
            long[] stAgg = statusMap.computeIfAbsent(st, k -> new long[2]);
            stAgg[0] += 1;
            stAgg[1] += c.getStudentCount();

            String lvl = safe(c.getLevel());
            long[] lvlAgg = levelMap.computeIfAbsent(lvl, k -> new long[2]);
            lvlAgg[0] += 1;
            lvlAgg[1] += c.getStudentCount();
        }

        List<Map.Entry<String, long[]>> stEntries = new ArrayList<>(statusMap.entrySet());
        List<Map.Entry<String, long[]>> lvlEntries = new ArrayList<>(levelMap.entrySet());
        int maxDistRows = Math.max(stEntries.size(), lvlEntries.size());
        if (maxDistRows == 0) {
            Row empty = sheet.createRow(nextRow++);
            empty.setHeightInPoints(22);
            mergeAndStyle(sheet, nextRow - 1, nextRow - 1, 0, 3, "Chưa có dữ liệu lớp học trong hệ thống.", palette.dataCenter);
        } else {
            for (int i = 0; i < maxDistRows; i++) {
                Row r = sheet.createRow(nextRow++);
                r.setHeightInPoints(21);
                boolean alt = (i % 2) == 1;
                if (i < stEntries.size()) {
                    Map.Entry<String, long[]> e = stEntries.get(i);
                    setCell(r, 0, e.getKey(), statusBadgeStyle(e.getKey(), palette));
                    setCell(r, 1, e.getValue()[0] + " lớp (" + e.getValue()[1] + " học viên)", alt ? palette.dataCenterAlt : palette.dataCenter);
                } else {
                    setCell(r, 0, "-", alt ? palette.dataCenterAlt : palette.dataCenter);
                    setCell(r, 1, "-", alt ? palette.dataCenterAlt : palette.dataCenter);
                }
                if (i < lvlEntries.size()) {
                    Map.Entry<String, long[]> e = lvlEntries.get(i);
                    setCell(r, 2, e.getKey(), alt ? palette.dataBoldCenterAlt : palette.dataBoldCenter);
                    setCell(r, 3, e.getValue()[0] + " lớp (" + e.getValue()[1] + " học viên)", alt ? palette.dataCenterAlt : palette.dataCenter);
                } else {
                    setCell(r, 2, "-", alt ? palette.dataCenterAlt : palette.dataCenter);
                    setCell(r, 3, "-", alt ? palette.dataCenterAlt : palette.dataCenter);
                }
            }
        }

        appendSignatureBlock(sheet, nextRow + 2, 0, 3, palette);
        configureSheetPrintAndView(sheet, 0, -1, -1);
    }

    private void buildCenterClassroomsSheet(XSSFWorkbook workbook,
                                            AdminDatabaseOverviewDto overview,
                                            ExcelPalette palette) {
        Sheet sheet = workbook.createSheet("Danh_Sach_Lop_Hoc");
        String[] headers = {
                "STT", "Tên lớp học", "Trình độ", "Trạng thái", "Giảng viên",
                "Ngày bắt đầu", "Ngày kết thúc", "Sĩ số", "Bài giảng", "Lộ trình ngày",
                "Bài tập", "Đề thi", "Lượt nộp", "Đánh giá AI", "Điểm TB", "Gian lận",
                "Audio Speaking", "Dung lượng (KB)"
        };
        int[] widths = {1600, 7200, 3400, 3800, 5600, 3600, 3600, 2600, 2800, 3400, 2600, 2600, 2800, 3200, 2800, 2800, 3600, 4000};
        applyColumnWidths(sheet, widths);

        Row banner = sheet.createRow(0);
        banner.setHeightInPoints(32);
        mergeAndStyle(sheet, 0, 0, 0, headers.length - 1,
                "DANH SÁCH CHI TIẾT LỚP HỌC & DỮ LIỆU ĐÀO TẠO",
                palette.banner);

        Row headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(26);
        for (int i = 0; i < headers.length; i++) {
            setCell(headerRow, i, headers[i], palette.header);
        }

        List<AdminDatabaseOverviewDto.ClassroomDatabaseItemDto> classrooms = overview.getClassrooms();
        if (classrooms == null || classrooms.isEmpty()) {
            Row empty = sheet.createRow(2);
            empty.setHeightInPoints(24);
            mergeAndStyle(sheet, 2, 2, 0, headers.length - 1,
                    "Chưa có lớp học nào trong cơ sở dữ liệu.", palette.dataCenter);
            configureSheetPrintAndView(sheet, 2, -1, -1);
            return;
        }

        long sumStudents = 0, sumLessons = 0, sumPlans = 0, sumAssignments = 0, sumExams = 0;
        long sumAttempts = 0, sumAi = 0, sumCheat = 0, sumAudio = 0, sumKb = 0;
        double sumAvg = 0;
        int scoredClasses = 0;

        for (int i = 0; i < classrooms.size(); i++) {
            AdminDatabaseOverviewDto.ClassroomDatabaseItemDto c = classrooms.get(i);
            Row r = sheet.createRow(i + 2);
            r.setHeightInPoints(21);
            boolean alt = (i % 2) == 1;
            CellStyle left = alt ? palette.dataLeftAlt : palette.dataLeft;
            CellStyle center = alt ? palette.dataCenterAlt : palette.dataCenter;

            setCell(r, 0, String.valueOf(i + 1), center);
            setCell(r, 1, safe(c.getName()), alt ? palette.dataBoldLeftAlt : palette.dataBoldLeft);
            setCell(r, 2, safe(c.getLevel()), center);
            setCell(r, 3, safe(c.getStatus()), statusBadgeStyle(c.getStatus(), palette));
            setCell(r, 4, safe(c.getTeacherName()), left);
            setCell(r, 5, safe(c.getStartDate()), center);
            setCell(r, 6, safe(c.getEndDate()), center);
            setCell(r, 7, String.valueOf(c.getStudentCount()), center);
            setCell(r, 8, String.valueOf(c.getLessonCount()), center);
            setCell(r, 9, String.valueOf(c.getDailyPlanCount()), center);
            setCell(r, 10, String.valueOf(c.getAssignmentCount()), center);
            setCell(r, 11, String.valueOf(c.getExamCount()), center);
            setCell(r, 12, String.valueOf(c.getAttemptCount()), center);
            setCell(r, 13, String.valueOf(c.getAiEvaluationCount()), center);
            setCell(r, 14, c.getAverageScore() > 0 ? String.format("%.2f", c.getAverageScore()) : "-",
                    c.getAverageScore() > 0 ? scoreStyle(c.getAverageScore(), alt, palette) : center);
            setCell(r, 15, String.valueOf(c.getCheatingFlagCount()), c.getCheatingFlagCount() > 0 ? palette.badgeDanger : palette.badgeSuccess);
            setCell(r, 16, String.valueOf(c.getSubmissionAudioCount()), center);
            setCell(r, 17, String.format("%,d", c.getEstimatedSubmissionKb()), center);

            sumStudents += c.getStudentCount();
            sumLessons += c.getLessonCount();
            sumPlans += c.getDailyPlanCount();
            sumAssignments += c.getAssignmentCount();
            sumExams += c.getExamCount();
            sumAttempts += c.getAttemptCount();
            sumAi += c.getAiEvaluationCount();
            if (c.getAverageScore() > 0) {
                sumAvg += c.getAverageScore();
                scoredClasses++;
            }
            sumCheat += c.getCheatingFlagCount();
            sumAudio += c.getSubmissionAudioCount();
            sumKb += c.getEstimatedSubmissionKb();
        }

        int totalRowIdx = classrooms.size() + 2;
        Row totalRow = sheet.createRow(totalRowIdx);
        totalRow.setHeightInPoints(24);
        mergeAndStyle(sheet, totalRowIdx, totalRowIdx, 0, 6,
                "TỔNG CỘNG / TRUNG BÌNH (" + classrooms.size() + " lớp học)",
                palette.totalLeft);
        setCell(totalRow, 7, String.valueOf(sumStudents), palette.totalCenter);
        setCell(totalRow, 8, String.valueOf(sumLessons), palette.totalCenter);
        setCell(totalRow, 9, String.valueOf(sumPlans), palette.totalCenter);
        setCell(totalRow, 10, String.valueOf(sumAssignments), palette.totalCenter);
        setCell(totalRow, 11, String.valueOf(sumExams), palette.totalCenter);
        setCell(totalRow, 12, String.valueOf(sumAttempts), palette.totalCenter);
        setCell(totalRow, 13, String.valueOf(sumAi), palette.totalCenter);
        setCell(totalRow, 14, scoredClasses > 0 ? String.format("%.2f", sumAvg / scoredClasses) : "-", palette.totalCenter);
        setCell(totalRow, 15, String.valueOf(sumCheat), sumCheat > 0 ? palette.badgeDanger : palette.totalCenter);
        setCell(totalRow, 16, String.valueOf(sumAudio), palette.totalCenter);
        setCell(totalRow, 17, String.format("%,d", sumKb), palette.totalCenter);

        configureSheetPrintAndView(sheet, 2, headers.length - 1, classrooms.size() + 1);
    }

    private void buildCenterTeachersSheet(XSSFWorkbook workbook,
                                          AdminDatabaseOverviewDto overview,
                                          ExcelPalette palette) {
        Sheet sheet = workbook.createSheet("Doi_Ngu_Giang_Vien");
        String[] headers = {
                "STT", "Giảng viên", "Số lớp phụ trách", "Danh sách lớp & cấp độ",
                "Tổng học viên", "Tổng bài giảng", "Tổng BT & Đề thi", "Tổng lượt nộp",
                "Điểm TB các lớp", "Đánh giá tải"
        };
        int[] widths = {1800, 6200, 4000, 11000, 3600, 3600, 4000, 3600, 3800, 4200};
        applyColumnWidths(sheet, widths);

        Row banner = sheet.createRow(0);
        banner.setHeightInPoints(32);
        mergeAndStyle(sheet, 0, 0, 0, headers.length - 1,
                "TỔNG HỢP PHÂN CÔNG & TẢI GIẢNG DẠY GIẢNG VIÊN",
                palette.banner);

        Row headerRow = sheet.createRow(1);
        headerRow.setHeightInPoints(26);
        for (int i = 0; i < headers.length; i++) {
            setCell(headerRow, i, headers[i], palette.header);
        }

        List<AdminDatabaseOverviewDto.ClassroomDatabaseItemDto> classrooms =
                overview.getClassrooms() != null ? overview.getClassrooms() : Collections.emptyList();
        if (classrooms.isEmpty()) {
            Row empty = sheet.createRow(2);
            empty.setHeightInPoints(24);
            mergeAndStyle(sheet, 2, 2, 0, headers.length - 1,
                    "Chưa có dữ liệu phân công giảng viên.", palette.dataCenter);
            configureSheetPrintAndView(sheet, 2, -1, -1);
            return;
        }

        Map<String, List<AdminDatabaseOverviewDto.ClassroomDatabaseItemDto>> byTeacher = new LinkedHashMap<>();
        for (AdminDatabaseOverviewDto.ClassroomDatabaseItemDto c : classrooms) {
            String teacher = (c.getTeacherName() == null || c.getTeacherName().isBlank())
                    ? "Chưa phân công"
                    : c.getTeacherName().trim();
            byTeacher.computeIfAbsent(teacher, k -> new ArrayList<>()).add(c);
        }

        int idx = 0;
        long totalClasses = 0, totalStudents = 0, totalLessons = 0, totalTasks = 0, totalAttempts = 0;
        for (Map.Entry<String, List<AdminDatabaseOverviewDto.ClassroomDatabaseItemDto>> entry : byTeacher.entrySet()) {
            List<AdminDatabaseOverviewDto.ClassroomDatabaseItemDto> list = entry.getValue();
            Row r = sheet.createRow(idx + 2);
            boolean alt = (idx % 2) == 1;
            CellStyle center = alt ? palette.dataCenterAlt : palette.dataCenter;

            String classNames = list.stream()
                    .map(c -> safe(c.getName()) + " (" + safe(c.getLevel()) + ")")
                    .reduce((a, b) -> a + ", " + b)
                    .orElse("-");
            long st = list.stream().mapToLong(AdminDatabaseOverviewDto.ClassroomDatabaseItemDto::getStudentCount).sum();
            long ls = list.stream().mapToLong(AdminDatabaseOverviewDto.ClassroomDatabaseItemDto::getLessonCount).sum();
            long tk = list.stream().mapToLong(c -> c.getAssignmentCount() + c.getExamCount()).sum();
            long at = list.stream().mapToLong(AdminDatabaseOverviewDto.ClassroomDatabaseItemDto::getAttemptCount).sum();
            OptionalDouble avg = list.stream()
                    .filter(c -> c.getAverageScore() > 0)
                    .mapToDouble(AdminDatabaseOverviewDto.ClassroomDatabaseItemDto::getAverageScore)
                    .average();

            boolean unassigned = "Chưa phân công".equals(entry.getKey());
            String loadLabel = unassigned ? "Chờ phân công" : (list.size() >= 3 ? "Tải cao" : "Bình thường");
            CellStyle loadStyle = unassigned ? palette.badgeNeutral : (list.size() >= 3 ? palette.badgeWarning : palette.badgeSuccess);

            r.setHeightInPoints(classNames.length() > 75 ? 32 : 22);
            setCell(r, 0, String.valueOf(idx + 1), center);
            setCell(r, 1, entry.getKey(), alt ? palette.dataBoldLeftAlt : palette.dataBoldLeft);
            setCell(r, 2, String.valueOf(list.size()), center);
            setCell(r, 3, classNames, alt ? palette.dataLeftAlt : palette.dataLeft);
            setCell(r, 4, String.valueOf(st), center);
            setCell(r, 5, String.valueOf(ls), center);
            setCell(r, 6, String.valueOf(tk), center);
            setCell(r, 7, String.valueOf(at), center);
            setCell(r, 8, avg.isPresent() ? String.format("%.2f", avg.getAsDouble()) : "-", center);
            setCell(r, 9, loadLabel, loadStyle);

            totalClasses += list.size();
            totalStudents += st;
            totalLessons += ls;
            totalTasks += tk;
            totalAttempts += at;
            idx++;
        }

        int totalRowIdx = idx + 2;
        Row totalRow = sheet.createRow(totalRowIdx);
        totalRow.setHeightInPoints(24);
        mergeAndStyle(sheet, totalRowIdx, totalRowIdx, 0, 1,
                "TỔNG CỘNG (" + idx + " giảng viên / nhóm)", palette.totalLeft);
        setCell(totalRow, 2, String.valueOf(totalClasses), palette.totalCenter);
        setCell(totalRow, 3, "-", palette.totalCenter);
        setCell(totalRow, 4, String.valueOf(totalStudents), palette.totalCenter);
        setCell(totalRow, 5, String.valueOf(totalLessons), palette.totalCenter);
        setCell(totalRow, 6, String.valueOf(totalTasks), palette.totalCenter);
        setCell(totalRow, 7, String.valueOf(totalAttempts), palette.totalCenter);
        setCell(totalRow, 8, "-", palette.totalCenter);
        setCell(totalRow, 9, "-", palette.totalCenter);

        configureSheetPrintAndView(sheet, 2, headers.length - 1, idx + 1);
    }

    private void buildCenterR2Sheet(XSSFWorkbook workbook,
                                    R2CostReportDto r2Report,
                                    ExcelPalette palette) {
        Sheet sheet = workbook.createSheet("Luu_Tru_Cloud_R2");
        applyColumnWidths(sheet, new int[]{1800, 9000, 5600, 3800, 4200, 3600, 5200});

        Row banner = sheet.createRow(0);
        banner.setHeightInPoints(32);
        mergeAndStyle(sheet, 0, 0, 0, 6,
                "CHI TIẾT LƯU TRỮ CLOUDFLARE R2 & TỆP DUNG LƯỢNG LỚN",
                palette.banner);

        Row catSection = sheet.createRow(1);
        catSection.setHeightInPoints(24);
        mergeAndStyle(sheet, 1, 1, 0, 6, "PHÂN BỔ DUNG LƯỢNG THEO DANH MỤC LƯU TRỮ", palette.section);

        Row catHeader = sheet.createRow(2);
        catHeader.setHeightInPoints(24);
        String[] catHeaders = {
                "STT", "Danh mục lưu trữ", "Prefix thư mục", "Số lượng tệp",
                "Dung lượng (MB)", "Tỷ trọng (%)", "Chi phí Gross ước tính (USD)"
        };
        for (int i = 0; i < catHeaders.length; i++) {
            setCell(catHeader, i, catHeaders[i], palette.header);
        }

        int rowIdx = 3;
        List<R2CostReportDto.R2CategoryBreakdownDto> categories = r2Report.getCategoryBreakdowns();
        if (categories == null || categories.isEmpty()) {
            Row empty = sheet.createRow(rowIdx++);
            empty.setHeightInPoints(22);
            mergeAndStyle(sheet, rowIdx - 1, rowIdx - 1, 0, 6,
                    "Chưa có dữ liệu phân bổ danh mục R2.", palette.dataCenter);
        } else {
            long totalObj = 0;
            double totalMb = 0;
            double totalUsd = 0;
            for (int i = 0; i < categories.size(); i++) {
                R2CostReportDto.R2CategoryBreakdownDto c = categories.get(i);
                Row r = sheet.createRow(rowIdx++);
                r.setHeightInPoints(21);
                boolean alt = (i % 2) == 1;
                CellStyle center = alt ? palette.dataCenterAlt : palette.dataCenter;
                setCell(r, 0, String.valueOf(i + 1), center);
                setCell(r, 1, safe(c.getLabel()), alt ? palette.dataBoldLeftAlt : palette.dataBoldLeft);
                setCell(r, 2, safe(c.getPrefix()), center);
                setCell(r, 3, String.format("%,d", c.getObjectCount()), center);
                setCell(r, 4, String.format("%.2f", c.getSizeMb()), center);
                setCell(r, 5, String.format("%.1f%%", c.getSharePercent()), center);
                setCell(r, 6, String.format("$%.4f", c.getEstimatedGrossStorageUsd()), center);

                totalObj += c.getObjectCount();
                totalMb += c.getSizeMb();
                totalUsd += c.getEstimatedGrossStorageUsd();
            }
            Row tot = sheet.createRow(rowIdx++);
            tot.setHeightInPoints(24);
            mergeAndStyle(sheet, rowIdx - 1, rowIdx - 1, 0, 2, "TỔNG CỘNG BUCKET", palette.totalLeft);
            setCell(tot, 3, String.format("%,d", totalObj), palette.totalCenter);
            setCell(tot, 4, String.format("%.2f MB", totalMb), palette.totalCenter);
            setCell(tot, 5, "100.0%", palette.totalCenter);
            setCell(tot, 6, String.format("$%.4f", totalUsd), palette.totalCenter);
        }

        rowIdx += 2;
        Row objSection = sheet.createRow(rowIdx);
        objSection.setHeightInPoints(24);
        mergeAndStyle(sheet, rowIdx, rowIdx, 0, 6, "TOP TỆP LƯU TRỮ DUNG LƯỢNG LỚN NHẤT", palette.section);
        rowIdx++;

        Row objHeader = sheet.createRow(rowIdx++);
        objHeader.setHeightInPoints(24);
        String[] objHeaders = {
                "STT", "Tên tệp / Key lưu trữ", "Danh mục", "Kích thước (Bytes)",
                "Dung lượng (MB)", "Thời điểm tạo/sửa", "Ghi chú"
        };
        for (int i = 0; i < objHeaders.length; i++) {
            setCell(objHeader, i, objHeaders[i], palette.header);
        }

        List<R2CostReportDto.R2LargestObjectDto> largest = r2Report.getLargestObjects();
        if (largest == null || largest.isEmpty()) {
            Row empty = sheet.createRow(rowIdx++);
            empty.setHeightInPoints(22);
            mergeAndStyle(sheet, rowIdx - 1, rowIdx - 1, 0, 6,
                    "Chưa ghi nhận tệp dung lượng lớn nào trong bucket.", palette.dataCenter);
        } else {
            for (int i = 0; i < largest.size(); i++) {
                R2CostReportDto.R2LargestObjectDto o = largest.get(i);
                Row r = sheet.createRow(rowIdx++);
                r.setHeightInPoints(21);
                boolean alt = (i % 2) == 1;
                CellStyle center = alt ? palette.dataCenterAlt : palette.dataCenter;
                setCell(r, 0, String.valueOf(i + 1), center);
                setCell(r, 1, safe(o.getKey()), alt ? palette.dataLeftAlt : palette.dataLeft);
                setCell(r, 2, safe(o.getCategory()), center);
                setCell(r, 3, String.format("%,d", o.getSizeBytes()), center);
                setCell(r, 4, String.format("%.2f", o.getSizeMb()), center);
                setCell(r, 5, o.getLastModified() != null ? DATE_TIME_FMT.format(o.getLastModified()) : "-", center);
                setCell(r, 6, o.getSizeMb() >= 20 ? "Cần theo dõi dung lượng" : "Bình thường",
                        o.getSizeMb() >= 20 ? palette.badgeWarning : palette.badgeNeutral);
            }
        }

        configureSheetPrintAndView(sheet, 0, -1, -1);
    }

    // =========================================================================
    // SHARED HELPERS & STYLING PALETTE
    // =========================================================================

    private void applyColumnWidths(Sheet sheet, int[] widths) {
        for (int i = 0; i < widths.length; i++) {
            sheet.setColumnWidth(i, widths[i]);
        }
    }

    private void configureSheetPrintAndView(Sheet sheet, int freezeRow, int lastFilterCol, int lastFilterRow) {
        sheet.setDisplayGridlines(true);
        sheet.setAutobreaks(true);
        sheet.setFitToPage(true);
        sheet.setHorizontallyCenter(true);

        PrintSetup ps = sheet.getPrintSetup();
        ps.setLandscape(true);
        ps.setPaperSize(PrintSetup.A4_PAPERSIZE);
        ps.setFitWidth((short) 1);
        ps.setFitHeight((short) 0);

        sheet.setMargin(PageMargin.TOP, 0.45);
        sheet.setMargin(PageMargin.BOTTOM, 0.45);
        sheet.setMargin(PageMargin.LEFT, 0.35);
        sheet.setMargin(PageMargin.RIGHT, 0.35);

        if (freezeRow > 0) {
            sheet.createFreezePane(0, freezeRow);
        }
        if (lastFilterCol >= 0 && lastFilterRow >= 2) {
            sheet.setAutoFilter(new CellRangeAddress(1, lastFilterRow, 0, lastFilterCol));
        }
    }

    private void appendSignatureBlock(Sheet sheet, int startRow, int firstCol, int lastCol, ExcelPalette palette) {
        int mid = firstCol + (lastCol - firstCol) / 2;
        Row dateRow = sheet.createRow(startRow);
        dateRow.setHeightInPoints(20);
        mergeAndStyle(sheet, startRow, startRow, mid + 1, lastCol,
                "Ngày xuất báo cáo: " + DATE_TIME_FMT.format(Instant.now()), palette.signSub);

        Row signTitle = sheet.createRow(startRow + 1);
        signTitle.setHeightInPoints(22);
        mergeAndStyle(sheet, startRow + 1, startRow + 1, firstCol, mid, "NGƯỜI LẬP BÁO CÁO (ADMIN)", palette.signTitle);
        mergeAndStyle(sheet, startRow + 1, startRow + 1, mid + 1, lastCol, "BAN GIÁM ĐỐC TRUNG TÂM", palette.signTitle);

        Row signNote = sheet.createRow(startRow + 2);
        signNote.setHeightInPoints(18);
        mergeAndStyle(sheet, startRow + 2, startRow + 2, firstCol, mid, "(Ký và ghi rõ họ tên)", palette.signSub);
        mergeAndStyle(sheet, startRow + 2, startRow + 2, mid + 1, lastCol, "(Xác nhận & đóng dấu)", palette.signSub);
    }

    private void mergeAndStyle(Sheet sheet, int firstRow, int lastRow, int firstCol, int lastCol, String value, CellStyle style) {
        for (int r = firstRow; r <= lastRow; r++) {
            Row row = sheet.getRow(r);
            if (row == null) {
                row = sheet.createRow(r);
            }
            for (int c = firstCol; c <= lastCol; c++) {
                Cell cell = row.getCell(c);
                if (cell == null) {
                    cell = row.createCell(c);
                }
                if (r == firstRow && c == firstCol && value != null) {
                    cell.setCellValue(value);
                }
                if (style != null) {
                    cell.setCellStyle(style);
                }
            }
        }
        if (lastRow > firstRow || lastCol > firstCol) {
            sheet.addMergedRegion(new CellRangeAddress(firstRow, lastRow, firstCol, lastCol));
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

    private String formatKb(long kb) {
        if (kb >= 1024L * 1024L) {
            return String.format("%.2f GB", kb / (1024.0 * 1024.0));
        }
        if (kb >= 1024L) {
            return String.format("%.2f MB", kb / 1024.0);
        }
        return kb + " KB";
    }

    private CellStyle scoreStyle(double score, boolean alt, ExcelPalette palette) {
        if (score >= 8.0) return palette.badgeSuccess;
        if (score >= 6.5) return palette.badgeInfo;
        if (score >= 5.0) return palette.badgeWarning;
        if (score > 0.0) return palette.badgeDanger;
        return alt ? palette.dataCenterAlt : palette.dataCenter;
    }

    private CellStyle completionBadgeStyle(int pct, ExcelPalette palette) {
        if (pct >= 80) return palette.badgeSuccess;
        if (pct >= 50) return palette.badgeWarning;
        return palette.badgeDanger;
    }

    private CellStyle classificationBadgeStyle(String cls, ExcelPalette palette) {
        if (cls == null) return palette.badgeNeutral;
        return switch (cls) {
            case "Xuất sắc", "Giỏi" -> palette.badgeSuccess;
            case "Khá" -> palette.badgeInfo;
            case "Trung bình" -> palette.badgeWarning;
            case "Cần cố gắng" -> palette.badgeDanger;
            default -> palette.badgeNeutral;
        };
    }

    private CellStyle statusBadgeStyle(String status, ExcelPalette palette) {
        if (status == null) return palette.badgeNeutral;
        return switch (status) {
            case "COMPLETED", "GRADED" -> palette.badgeSuccess;
            case "IN_PROGRESS", "OPEN" -> palette.badgeInfo;
            case "PLANNING", "SUBMITTED" -> palette.badgeWarning;
            case "CANCELLED" -> palette.badgeDanger;
            default -> palette.badgeNeutral;
        };
    }

    private String classificationNote(String cls) {
        return switch (cls) {
            case "Xuất sắc" -> "Điểm TB ≥ 8.5 • Đạt chuẩn năng lực vượt trội";
            case "Giỏi" -> "Điểm TB 7.5 - 8.4 • Tiếp thu tốt kiến thức";
            case "Khá" -> "Điểm TB 6.0 - 7.4 • Đáp ứng chuẩn mục tiêu lớp";
            case "Trung bình" -> "Điểm TB 5.0 - 5.9 • Cần tăng cường luyện tập";
            case "Cần cố gắng" -> "Điểm TB < 5.0 • Cần giảng viên kèm sát";
            default -> "Học viên chưa có bài làm được chấm điểm";
        };
    }

    private static final class ExcelPalette {
        private final DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();
        final XSSFCellStyle banner;
        final XSSFCellStyle section;
        final XSSFCellStyle header;
        final XSSFCellStyle label;
        final XSSFCellStyle dataLeft;
        final XSSFCellStyle dataLeftAlt;
        final XSSFCellStyle dataBoldLeft;
        final XSSFCellStyle dataBoldLeftAlt;
        final XSSFCellStyle dataCenter;
        final XSSFCellStyle dataCenterAlt;
        final XSSFCellStyle dataBoldCenter;
        final XSSFCellStyle dataBoldCenterAlt;
        final XSSFCellStyle totalLeft;
        final XSSFCellStyle totalCenter;
        final XSSFCellStyle badgeSuccess;
        final XSSFCellStyle badgeInfo;
        final XSSFCellStyle badgeWarning;
        final XSSFCellStyle badgeDanger;
        final XSSFCellStyle badgeNeutral;
        final XSSFCellStyle signTitle;
        final XSSFCellStyle signSub;

        ExcelPalette(XSSFWorkbook wb) {
            this.banner = makeSolidStyle(wb, new Color(30, 58, 138), Color.WHITE, (short) 13, true, HorizontalAlignment.CENTER, false);
            this.section = makeBorderedSolidStyle(wb, new Color(219, 234, 254), new Color(30, 58, 138), (short) 10, true, HorizontalAlignment.CENTER);
            this.header = makeHeaderStyle(wb);
            this.label = makeBorderedSolidStyle(wb, new Color(241, 245, 249), new Color(51, 65, 85), (short) 10, true, HorizontalAlignment.LEFT);

            Color white = Color.WHITE;
            Color altBg = new Color(248, 250, 252);
            Color darkText = new Color(15, 23, 42);

            this.dataLeft = makeBorderedSolidStyle(wb, white, darkText, (short) 10, false, HorizontalAlignment.LEFT);
            this.dataLeftAlt = makeBorderedSolidStyle(wb, altBg, darkText, (short) 10, false, HorizontalAlignment.LEFT);
            this.dataBoldLeft = makeBorderedSolidStyle(wb, white, darkText, (short) 10, true, HorizontalAlignment.LEFT);
            this.dataBoldLeftAlt = makeBorderedSolidStyle(wb, altBg, darkText, (short) 10, true, HorizontalAlignment.LEFT);
            this.dataCenter = makeBorderedSolidStyle(wb, white, darkText, (short) 10, false, HorizontalAlignment.CENTER);
            this.dataCenterAlt = makeBorderedSolidStyle(wb, altBg, darkText, (short) 10, false, HorizontalAlignment.CENTER);
            this.dataBoldCenter = makeBorderedSolidStyle(wb, white, new Color(30, 64, 175), (short) 10, true, HorizontalAlignment.CENTER);
            this.dataBoldCenterAlt = makeBorderedSolidStyle(wb, altBg, new Color(30, 64, 175), (short) 10, true, HorizontalAlignment.CENTER);

            this.totalLeft = makeTotalStyle(wb, HorizontalAlignment.LEFT);
            this.totalCenter = makeTotalStyle(wb, HorizontalAlignment.CENTER);

            this.badgeSuccess = makeBorderedSolidStyle(wb, new Color(209, 250, 229), new Color(6, 95, 70), (short) 10, true, HorizontalAlignment.CENTER);
            this.badgeInfo = makeBorderedSolidStyle(wb, new Color(219, 234, 254), new Color(30, 64, 175), (short) 10, true, HorizontalAlignment.CENTER);
            this.badgeWarning = makeBorderedSolidStyle(wb, new Color(254, 243, 199), new Color(146, 64, 14), (short) 10, true, HorizontalAlignment.CENTER);
            this.badgeDanger = makeBorderedSolidStyle(wb, new Color(254, 226, 226), new Color(153, 27, 27), (short) 10, true, HorizontalAlignment.CENTER);
            this.badgeNeutral = makeBorderedSolidStyle(wb, new Color(241, 245, 249), new Color(71, 85, 105), (short) 10, true, HorizontalAlignment.CENTER);

            this.signTitle = makePlainStyle(wb, new Color(15, 23, 42), (short) 10, true, HorizontalAlignment.CENTER);
            this.signSub = makePlainStyle(wb, new Color(100, 116, 139), (short) 9, false, HorizontalAlignment.CENTER);
        }

        private XSSFCellStyle makeSolidStyle(XSSFWorkbook wb, Color bg, Color fg, short pt, boolean bold, HorizontalAlignment align, boolean bordered) {
            XSSFFont font = wb.createFont();
            font.setFontName("Segoe UI");
            font.setFontHeightInPoints(pt);
            font.setBold(bold);
            font.setColor(new XSSFColor(fg, colorMap));

            XSSFCellStyle style = wb.createCellStyle();
            style.setFont(font);
            style.setFillForegroundColor(new XSSFColor(bg, colorMap));
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            style.setAlignment(align);
            style.setVerticalAlignment(VerticalAlignment.CENTER);
            style.setWrapText(true);
            if (bordered) {
                applyThinBorders(style);
            }
            return style;
        }

        private XSSFCellStyle makeBorderedSolidStyle(XSSFWorkbook wb, Color bg, Color fg, short pt, boolean bold, HorizontalAlignment align) {
            return makeSolidStyle(wb, bg, fg, pt, bold, align, true);
        }

        private XSSFCellStyle makeHeaderStyle(XSSFWorkbook wb) {
            XSSFCellStyle style = makeBorderedSolidStyle(
                    wb, new Color(226, 232, 240), new Color(15, 23, 42), (short) 10, true, HorizontalAlignment.CENTER);
            style.setBorderBottom(BorderStyle.MEDIUM);
            style.setBottomBorderColor(new XSSFColor(new Color(30, 64, 175), colorMap));
            return style;
        }

        private XSSFCellStyle makeTotalStyle(XSSFWorkbook wb, HorizontalAlignment align) {
            XSSFCellStyle style = makeBorderedSolidStyle(
                    wb, new Color(239, 246, 255), new Color(30, 58, 138), (short) 10, true, align);
            style.setBorderTop(BorderStyle.MEDIUM);
            style.setTopBorderColor(new XSSFColor(new Color(30, 64, 175), colorMap));
            style.setBorderBottom(BorderStyle.DOUBLE);
            style.setBottomBorderColor(new XSSFColor(new Color(30, 64, 175), colorMap));
            return style;
        }

        private XSSFCellStyle makePlainStyle(XSSFWorkbook wb, Color fg, short pt, boolean bold, HorizontalAlignment align) {
            XSSFFont font = wb.createFont();
            font.setFontName("Segoe UI");
            font.setFontHeightInPoints(pt);
            font.setBold(bold);
            font.setColor(new XSSFColor(fg, colorMap));

            XSSFCellStyle style = wb.createCellStyle();
            style.setFont(font);
            style.setAlignment(align);
            style.setVerticalAlignment(VerticalAlignment.CENTER);
            return style;
        }

        private void applyThinBorders(XSSFCellStyle style) {
            XSSFColor borderColor = new XSSFColor(new Color(203, 213, 225), colorMap);
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
            style.setTopBorderColor(borderColor);
            style.setBottomBorderColor(borderColor);
            style.setLeftBorderColor(borderColor);
            style.setRightBorderColor(borderColor);
        }
    }
}
