package com.englishlearning.analytics.service;

import com.englishlearning.analytics.dto.ClassroomDetailedReportDto;
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

@DisplayName("ClassroomReportExcelExporter - Xuất Workbook 3 Sheet Excel Báo Cáo Lớp Học")
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

            Sheet studentsSheet = wb.getSheet("Danh_Sach_Hoc_Vien");
            assertThat(studentsSheet.getRow(2).getCell(1).getStringCellValue()).isEqualTo("Tran An");
            assertThat(studentsSheet.getRow(2).getCell(7).getStringCellValue()).isEqualTo("80%");

            Sheet submissionsSheet = wb.getSheet("Chi_Tiet_Bai_Nop_Thi");
            assertThat(submissionsSheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo("Bài Thi");
            assertThat(submissionsSheet.getRow(2).getCell(9).getStringCellValue()).isEqualTo("-");
            assertThat(submissionsSheet.getRow(2).getCell(10).getStringCellValue()).isEqualTo("Chờ chấm");
            assertThat(submissionsSheet.getRow(2).getCell(12).getStringCellValue()).isEqualTo("GIAN LẬN");

            assertThat(submissionsSheet.getRow(3).getCell(4).getStringCellValue()).isEqualTo("Bài Tập");
            assertThat(submissionsSheet.getRow(3).getCell(10).getStringCellValue()).isEqualTo(String.format("%.2f", 9.0));
            assertThat(submissionsSheet.getRow(3).getCell(12).getStringCellValue()).isEqualTo("Bình thường");
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
}
