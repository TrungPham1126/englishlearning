package com.englishlearning.analytics.service;

import com.englishlearning.analytics.dto.AdminDatabaseOverviewDto;
import com.englishlearning.analytics.dto.ClassroomDetailedReportDto;
import com.englishlearning.analytics.dto.R2CostReportDto;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ClassroomReportExcelExporter - Xuất Workbook Excel Báo Cáo Lớp Học & Toàn Trung Tâm")
class ClassroomReportExcelExporterTest {

    private final ClassroomReportExcelExporter exporter = new ClassroomReportExcelExporter();

    @Test
    @DisplayName("Xuất đầy đủ 3 sheet với dữ liệu học viên, bài thi, cảnh báo gian lận & giá trị null an toàn")
    void should_ExportFullWorkbookWithStudentsAndSubmissions() throws Exception {
        UUID classId = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        ClassroomDetailedReportDto report = ClassroomDetailedReportDto.builder()
                .classroomId(classId)
                .classroomName("IELTS Master K12")
                .level("UPPER_INTERMEDIATE")
                .status("IN_PROGRESS")
                .teacherName("Nguyen Lan")
                .teacherEmail("lan@englishlearning.com")
                .startDate("2026-01-01")
                .endDate("2026-06-01")
                .generatedAt(Instant.parse("2026-05-01T10:15:00Z"))
                .totalStudents(2)
                .totalLessons(10)
                .totalDailyPlans(30)
                .totalAssignments(5)
                .totalExams(1)
                .totalAttempts(4)
                .completedAttempts(3)
                .flaggedCheatingAttempts(1)
                .classAverageScore(8.25)
                .averageCompletionRate(85.0)
                .students(List.of(
                        ClassroomDetailedReportDto.StudentReportRowDto.builder()
                                .studentId(UUID.randomUUID())
                                .fullName("Tran An")
                                .email("an@student.com")
                                .phone("0901234567")
                                .enrolledAt("2026-01-05")
                                .completedTasks(8)
                                .totalTasks(10)
                                .completionRate(80)
                                .averageScore(8.5)
                                .totalAttempts(2)
                                .examAttempts(1)
                                .cheatingFlags(1)
                                .totalStudyMinutes(120)
                                .classification("Khá")
                                .build()
                ))
                .submissions(List.of(
                        ClassroomDetailedReportDto.AttemptReportRowDto.builder()
                                .attemptId(UUID.randomUUID())
                                .studentName("Tran An")
                                .studentEmail("an@student.com")
                                .assignmentTitle("Midterm Reading Exam")
                                .skillType("READING")
                                .exam(true)
                                .attemptNumber(1)
                                .status("SUBMITTED")
                                .submittedAt("2026-05-01 10:00")
                                .durationSeconds(null)
                                .totalScore(null)
                                .violationCount(2)
                                .cheatingFlagged(true)
                                .cheatingReason("Tab switch 2 lần")
                                .teacherFeedback(null)
                                .build(),
                        ClassroomDetailedReportDto.AttemptReportRowDto.builder()
                                .attemptId(UUID.randomUUID())
                                .studentName("Le Binh")
                                .studentEmail("binh@student.com")
                                .assignmentTitle("Listening Unit 1")
                                .skillType("LISTENING")
                                .exam(false)
                                .attemptNumber(1)
                                .status("GRADED")
                                .submittedAt("2026-05-01 09:00")
                                .durationSeconds(320)
                                .totalScore(9.0)
                                .violationCount(0)
                                .cheatingFlagged(false)
                                .build()
                ))
                .build();

        byte[] xlsxBytes = exporter.export(report);
        assertThat(xlsxBytes).isNotEmpty();

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(xlsxBytes))) {
            assertThat(wb.getNumberOfSheets()).isEqualTo(3);

            Sheet overview = wb.getSheet("Tong_Quan_Lop");
            assertThat(overview.getRow(0).getCell(0).getStringCellValue()).contains("IELTS Master K12");
            assertThat(overview.getRow(2).getCell(1).getStringCellValue()).isEqualTo(classId.toString());
            assertThat(overview.isDisplayGridlines()).isTrue();
            assertThat(overview.getPrintSetup().getLandscape()).isTrue();

            // Kiểm tra bảng phân tích xếp loại học lực trên sheet tổng quan
            boolean hasRankSection = false;
            for (int r = 10; r <= overview.getLastRowNum(); r++) {
                if (overview.getRow(r) != null && overview.getRow(r).getCell(0) != null
                        && overview.getRow(r).getCell(0).getStringCellValue().contains("PHÂN TÍCH XẾP LOẠI")) {
                    hasRankSection = true;
                    break;
                }
            }
            assertThat(hasRankSection).isTrue();

            Sheet studentsSheet = wb.getSheet("Danh_Sach_Hoc_Vien");
            assertThat(studentsSheet.getPaneInformation().isFreezePane()).isTrue();
            assertThat(studentsSheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("Tran An");
            assertThat(studentsSheet.getRow(2).getCell(7).getStringCellValue()).isEqualTo("80%");
            assertThat(studentsSheet.getRow(3).getCell(0).getStringCellValue())
                    .contains("TỔNG CỘNG / TRUNG BÌNH TOÀN LỚP");

            Sheet submissionsSheet = wb.getSheet("Chi_Tiet_Bai_Nop_Thi");
            assertThat(submissionsSheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo("Bài Thi");
            assertThat(submissionsSheet.getRow(2).getCell(9).getStringCellValue()).isEqualTo("-");
            assertThat(submissionsSheet.getRow(2).getCell(10).getStringCellValue()).isEqualTo("Chờ chấm");
            assertThat(submissionsSheet.getRow(2).getCell(12).getStringCellValue()).isEqualTo("GIAN LẬN");

            assertThat(submissionsSheet.getRow(3).getCell(4).getStringCellValue()).isEqualTo("Bài Tập");
            assertThat(submissionsSheet.getRow(3).getCell(10).getStringCellValue()).isEqualTo(String.format("%.2f", 9.0));
            assertThat(submissionsSheet.getRow(3).getCell(12).getStringCellValue()).isEqualTo("Bình thường");
            assertThat(submissionsSheet.getRow(4).getCell(0).getStringCellValue())
                    .contains("TỔNG KẾT BÀI NỘP & KẾT QUẢ THI");
        }
    }

    @Test
    @DisplayName("Xuất workbook hợp lệ khi danh sách học viên và bài nộp rỗng/null")
    void should_ExportEmptyNoticeRows_when_StudentsAndSubmissionsEmpty() throws Exception {
        ClassroomDetailedReportDto emptyReport = ClassroomDetailedReportDto.builder()
                .classroomName(null)
                .students(Collections.emptyList())
                .submissions(null)
                .build();

        byte[] bytes = exporter.export(emptyReport);

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertThat(wb.getSheet("Danh_Sach_Hoc_Vien").getRow(2).getCell(0).getStringCellValue())
                    .contains("Chưa có học viên");
            assertThat(wb.getSheet("Chi_Tiet_Bai_Nop_Thi").getRow(2).getCell(0).getStringCellValue())
                    .contains("Chưa có dữ liệu bài nộp");
        }
    }

    @Test
    @DisplayName("Xuất workbook 4 sheet báo cáo tổng hợp toàn trung tâm (Tổng quan, Lớp học, Giảng viên, Cloud R2)")
    void should_ExportCenterOverviewWorkbookWithFourSheets() throws Exception {
        AdminDatabaseOverviewDto overview = AdminDatabaseOverviewDto.builder()
                .totalClassrooms(2)
                .completedClassrooms(1)
                .totalEnrolledStudents(35)
                .totalAssignments(18)
                .totalExams(4)
                .totalAttempts(120)
                .totalStudentAnswers(840)
                .totalAiEvaluations(55)
                .totalSubmissionAudioFiles(24)
                .estimatedSubmissionDataKb(16384)
                .classrooms(List.of(
                        AdminDatabaseOverviewDto.ClassroomDatabaseItemDto.builder()
                                .id(UUID.randomUUID())
                                .name("IELTS Foundation A1")
                                .level("B1")
                                .status("IN_PROGRESS")
                                .teacherName("Nguyen Lan")
                                .startDate("2026-02-01")
                                .endDate("2026-06-01")
                                .studentCount(20)
                                .lessonCount(12)
                                .dailyPlanCount(30)
                                .assignmentCount(10)
                                .examCount(2)
                                .attemptCount(75)
                                .aiEvaluationCount(35)
                                .cheatingFlagCount(1)
                                .averageScore(7.8)
                                .submissionAudioCount(15)
                                .estimatedSubmissionKb(10240)
                                .build(),
                        AdminDatabaseOverviewDto.ClassroomDatabaseItemDto.builder()
                                .id(UUID.randomUUID())
                                .name("IELTS Intensive B2")
                                .level("B2")
                                .status("COMPLETED")
                                .teacherName("Nguyen Lan")
                                .startDate("2025-10-01")
                                .endDate("2026-01-20")
                                .studentCount(15)
                                .lessonCount(10)
                                .dailyPlanCount(24)
                                .assignmentCount(8)
                                .examCount(2)
                                .attemptCount(45)
                                .aiEvaluationCount(20)
                                .cheatingFlagCount(0)
                                .averageScore(8.4)
                                .submissionAudioCount(9)
                                .estimatedSubmissionKb(6144)
                                .build()
                ))
                .build();

        R2CostReportDto r2 = R2CostReportDto.builder()
                .bucketName("elp-media-prod")
                .liveConnected(true)
                .totalObjects(320)
                .totalStorageGb(1.25)
                .freeTierUsagePercent(12.5)
                .classAOps(2500)
                .classBOps(14000)
                .totalPayableUsd(0.0)
                .totalPayableVnd(0L)
                .monthlyBudgetUsd(20.0)
                .generatedAt(Instant.parse("2026-05-01T10:15:00Z"))
                .categoryBreakdowns(List.of(
                        R2CostReportDto.R2CategoryBreakdownDto.builder()
                                .categoryKey("videos")
                                .label("Video bài giảng & HLS")
                                .prefix("videos/")
                                .objectCount(40)
                                .sizeMb(1024.0)
                                .sharePercent(80.0)
                                .estimatedGrossStorageUsd(0.015)
                                .build()
                ))
                .largestObjects(List.of(
                        R2CostReportDto.R2LargestObjectDto.builder()
                                .key("videos/unit-1.mp4")
                                .category("videos")
                                .sizeBytes(52428800L)
                                .sizeMb(50.0)
                                .lastModified(Instant.parse("2026-04-28T08:00:00Z"))
                                .build()
                ))
                .build();

        byte[] bytes = exporter.exportCenterReport(overview, r2);
        assertThat(bytes).isNotEmpty();

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertThat(wb.getNumberOfSheets()).isEqualTo(4);
            assertThat(wb.getSheetAt(0).getSheetName()).isEqualTo("Tong_Quan_Trung_Tam");
            assertThat(wb.getSheetAt(1).getSheetName()).isEqualTo("Danh_Sach_Lop_Hoc");
            assertThat(wb.getSheetAt(2).getSheetName()).isEqualTo("Doi_Ngu_Giang_Vien");
            assertThat(wb.getSheetAt(3).getSheetName()).isEqualTo("Luu_Tru_Cloud_R2");

            Sheet classesSheet = wb.getSheet("Danh_Sach_Lop_Hoc");
            assertThat(classesSheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("IELTS Foundation A1");
            assertThat(classesSheet.getRow(4).getCell(0).getStringCellValue()).contains("TỔNG CỘNG / TRUNG BÌNH");

            Sheet teachersSheet = wb.getSheet("Doi_Ngu_Giang_Vien");
            assertThat(teachersSheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("Nguyen Lan");
            assertThat(teachersSheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("2");

            Sheet r2Sheet = wb.getSheet("Luu_Tru_Cloud_R2");
            assertThat(r2Sheet.getRow(3).getCell(1).getStringCellValue()).isEqualTo("Video bài giảng & HLS");
        }
    }

    @Test
    @DisplayName("Xử lý an toàn đầu vào null, mô tả lớp học, đủ 6 mức xếp loại học lực, giảng viên tải cao/chưa phân công và R2 offline")
    void should_HandleNullInputsDescriptionsHighTeacherWorkloadAndR2OfflineBranches() throws Exception {
        // 1. Đầu vào null hoàn toàn cho cả 2 hàm export
        byte[] nullClassBytes = exporter.export(null);
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(nullClassBytes))) {
            assertThat(wb.getNumberOfSheets()).isEqualTo(3);
        }
        byte[] nullCenterBytes = exporter.exportCenterReport(null, null);
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(nullCenterBytes))) {
            assertThat(wb.getNumberOfSheets()).isEqualTo(4);
        }

        // 2. Báo cáo lớp có description, đủ các nhóm xếp loại & dải điểm
        ClassroomDetailedReportDto detailed = ClassroomDetailedReportDto.builder()
                .classroomName("B1 Evening")
                .description("Khóa học luyện giao tiếp và phản xạ B1 buổi tối")
                .classAverageScore(6.8)
                .flaggedCheatingAttempts(0)
                .students(List.of(
                        ClassroomDetailedReportDto.StudentReportRowDto.builder()
                                .fullName("S1").completionRate(90).averageScore(9.0).classification("Xuất sắc").build(),
                        ClassroomDetailedReportDto.StudentReportRowDto.builder()
                                .fullName("S2").completionRate(75).averageScore(7.8).classification("Giỏi").build(),
                        ClassroomDetailedReportDto.StudentReportRowDto.builder()
                                .fullName("S3").completionRate(55).averageScore(5.5).classification("Trung bình").build(),
                        ClassroomDetailedReportDto.StudentReportRowDto.builder()
                                .fullName("S4").completionRate(30).averageScore(3.5).classification("Cần cố gắng").build(),
                        ClassroomDetailedReportDto.StudentReportRowDto.builder()
                                .fullName("S5").completionRate(0).averageScore(0.0).classification("Chưa có điểm").build()
                ))
                .build();

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(exporter.export(detailed)))) {
            Sheet ov = wb.getSheet("Tong_Quan_Lop");
            assertThat(ov.getRow(11).getCell(0).getStringCellValue()).isEqualTo("Mô tả khóa học");
            assertThat(ov.getRow(11).getCell(1).getStringCellValue()).contains("phản xạ B1 buổi tối");
        }

        // 3. Báo cáo trung tâm với dung lượng GB, giảng viên chưa phân công + giảng viên tải cao (>=3 lớp) và R2 offline
        AdminDatabaseOverviewDto centerOverview = AdminDatabaseOverviewDto.builder()
                .estimatedSubmissionDataKb(2L * 1024L * 1024L) // 2.00 GB
                .classrooms(List.of(
                        AdminDatabaseOverviewDto.ClassroomDatabaseItemDto.builder()
                                .name("Class Unassigned").level("A1").status("PLANNING").teacherName("   ").averageScore(0.0).build(),
                        AdminDatabaseOverviewDto.ClassroomDatabaseItemDto.builder()
                                .name("HighLoad C1 - Long Classroom Name For Row Height Wrap Verification").level("C1")
                                .status("OPEN").teacherName("Dr. Minh").averageScore(8.2).cheatingFlagCount(2).build(),
                        AdminDatabaseOverviewDto.ClassroomDatabaseItemDto.builder()
                                .name("HighLoad C2 - Long Classroom Name For Row Height Wrap Verification").level("C1")
                                .status("IN_PROGRESS").teacherName("Dr. Minh").averageScore(6.0).build(),
                        AdminDatabaseOverviewDto.ClassroomDatabaseItemDto.builder()
                                .name("HighLoad C3").level("B2").status("CANCELLED").teacherName("Dr. Minh").averageScore(4.5).build()
                ))
                .build();

        R2CostReportDto r2Offline = R2CostReportDto.builder()
                .liveConnected(false)
                .categoryBreakdowns(Collections.emptyList())
                .largestObjects(List.of(
                        R2CostReportDto.R2LargestObjectDto.builder()
                                .key("speaking/sample.webm").category("audio").sizeBytes(1024L).sizeMb(1.0).lastModified(null).build()
                ))
                .build();

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(exporter.exportCenterReport(centerOverview, r2Offline)))) {
            Sheet centerOv = wb.getSheet("Tong_Quan_Trung_Tam");
            assertThat(centerOv.getRow(3).getCell(3).getStringCellValue()).isEqualTo("ƯỚC TÍNH DATABASE");
            assertThat(centerOv.getRow(10).getCell(1).getStringCellValue()).contains("GB");

            Sheet teachers = wb.getSheet("Doi_Ngu_Giang_Vien");
            assertThat(teachers.getRow(2).getCell(1).getStringCellValue()).isEqualTo("Chưa phân công");
            assertThat(teachers.getRow(2).getCell(9).getStringCellValue()).isEqualTo("Chờ phân công");
            assertThat(teachers.getRow(3).getCell(1).getStringCellValue()).isEqualTo("Dr. Minh");
            assertThat(teachers.getRow(3).getCell(9).getStringCellValue()).isEqualTo("Tải cao");

            Sheet r2Sheet = wb.getSheet("Luu_Tru_Cloud_R2");
            assertThat(r2Sheet.getRow(3).getCell(0).getStringCellValue()).contains("Chưa có dữ liệu phân bổ danh mục R2");
        }
    }
}
