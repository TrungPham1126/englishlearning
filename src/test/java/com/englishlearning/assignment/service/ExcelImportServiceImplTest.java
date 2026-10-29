package com.englishlearning.assignment.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.service.impl.ExcelImportServiceImpl;
import com.englishlearning.common.exception.InvalidFileFormatException;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ExcelImportServiceImpl - Import danh sách câu hỏi từ file Excel (.xlsx)")
class ExcelImportServiceImplTest {

    @Mock
    private AssignmentRepository assignmentRepository;

    @Mock
    private AssignmentQuestionRepository assignmentQuestionRepository;

    private ExcelImportServiceImpl excelImportService;

    private final UUID assignmentId = UUID.fromString("44444444-4444-4444-4444-444444444444");

    @BeforeEach
    void setUp() {
        excelImportService = new ExcelImportServiceImpl(assignmentRepository, assignmentQuestionRepository);
        Assignment assignment = new Assignment();
        assignment.setId(assignmentId);
        lenient().when(assignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
    }

    @Test
    @DisplayName("Import thành công danh sách câu hỏi khi cấu trúc file Excel hợp lệ")
    void should_ParseAndImportQuestionsFromExcel_when_FileFormatIsValid() throws IOException {
        // Given: Tạo file Excel chuẩn hoàn toàn trong bộ nhớ RAM (cleanly-create-test-data.md)
        byte[] excelBytes = createValidExcelBytes(
                "What is the past participle of 'go'?",
                "MULTIPLE_CHOICE",
                "went", "gone", "going", "goes",
                "gone",
                "'Gone' is the past participle form."
        );

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "questions.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                excelBytes
        );

        Assignment assignment = new Assignment();
        assignment.setId(assignmentId);
        when(assignmentRepository.findById(assignmentId)).thenReturn(Optional.of(assignment));
        when(assignmentQuestionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // When
        List<AssignmentQuestion> questions = excelImportService.importQuestionsFromExcel(file, assignmentId);

        // Then
        assertThat(questions).hasSize(1);
        AssignmentQuestion q = questions.get(0);
        assertThat(q.getPromptText()).isEqualTo("What is the past participle of 'go'?");
        assertThat(q.getQuestionType()).isEqualTo(QuestionType.MULTIPLE_CHOICE);
        assertThat(q.getCorrectAnswer()).isEqualTo("gone");
        assertThat(q.getExplanation()).isEqualTo("'Gone' is the past participle form.");
        assertThat(q.getOptions()).hasSize(4);
        assertThat(q.getOptions().get(1).getOptionLabel()).isEqualTo("B");
        assertThat(q.getOptions().get(1).getOptionText()).isEqualTo("gone");
        assertThat(q.getOptions().get(1).getIsCorrect()).isTrue();

        ArgumentCaptor<List<AssignmentQuestion>> captor = ArgumentCaptor.forClass(List.class);
        verify(assignmentQuestionRepository, times(1)).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
    }

    @Test
    @DisplayName("Ném InvalidFileFormatException khi file Excel bị thiếu tiêu đề bắt buộc hoặc hỏng dữ liệu")
    void should_ThrowInvalidFileFormatException_when_ExcelHasMissingHeadersOrCorruptedData() throws IOException {
        // Trường hợp 1: Dữ liệu nhị phân bị hỏng (corrupted data)
        MockMultipartFile corruptedFile = new MockMultipartFile(
                "file",
                "corrupted.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[]{0x12, 0x34, 0x56, 0x78}
        );

        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(corruptedFile, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class)
                .hasMessageStartingWith("Dữ liệu file Excel bị lỗi hoặc không thể đọc");

        // Trường hợp 2: File Excel hợp lệ về zip nhưng thiếu các cột tiêu đề bắt buộc
        byte[] invalidHeaderBytes = createInvalidHeaderExcelBytes();
        MockMultipartFile missingHeadersFile = new MockMultipartFile(
                "file",
                "missing_headers.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                invalidHeaderBytes
        );

        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(missingHeadersFile, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class)
                .hasMessageContaining("File Excel thiếu tiêu đề bắt buộc");

        // Trường hợp 3: Sai định dạng đuôi mở rộng (không phải .xlsx/.xls)
        MockMultipartFile textFile = new MockMultipartFile(
                "file",
                "questions.pdf",
                "application/pdf",
                new byte[]{1, 2, 3}
        );

        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(textFile, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class)
                .hasMessageContaining("Chỉ chấp nhận file Excel (.xlsx, .xls)");

        verify(assignmentQuestionRepository, never()).saveAll(anyList());
    }

    private byte[] createValidExcelBytes(String prompt, String type, String optA, String optB, String optC, String optD, String answer, String explanation) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Questions");

            // Header Row (Row 0)
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Question");
            header.createCell(1).setCellValue("Type");
            header.createCell(2).setCellValue("Option A");
            header.createCell(3).setCellValue("Option B");
            header.createCell(4).setCellValue("Option C");
            header.createCell(5).setCellValue("Option D");
            header.createCell(6).setCellValue("Correct Answer");
            header.createCell(7).setCellValue("Explanation");

            // Data Row (Row 1)
            Row row = sheet.createRow(1);
            row.createCell(0).setCellValue(prompt);
            row.createCell(1).setCellValue(type);
            row.createCell(2).setCellValue(optA);
            row.createCell(3).setCellValue(optB);
            row.createCell(4).setCellValue(optC);
            row.createCell(5).setCellValue(optD);
            row.createCell(6).setCellValue(answer);
            row.createCell(7).setCellValue(explanation);

            workbook.write(out);
            return out.toByteArray();
        }
    }

    private byte[] createInvalidHeaderExcelBytes() throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Questions");

            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Random Title");
            header.createCell(1).setCellValue("Author");

            Row row = sheet.createRow(1);
            row.createCell(0).setCellValue("Data 1");
            row.createCell(1).setCellValue("Data 2");

            workbook.write(out);
            return out.toByteArray();
        }
    }
}
