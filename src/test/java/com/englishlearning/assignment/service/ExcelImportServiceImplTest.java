package com.englishlearning.assignment.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.service.impl.ExcelImportServiceImpl;
import com.englishlearning.common.exception.InvalidFileFormatException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
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
import java.nio.file.Files;
import java.nio.file.Path;
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
    @DisplayName("Import thành công danh sách câu hỏi khi cấu trúc file Excel hợp lệ (Legacy 8 cột)")
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
    @DisplayName("Import thành công file Excel mẫu chuẩn 12 cột mới với Banner ở Hàng 1-2 và bỏ qua dòng trống kẻ sẵn")
    void should_ParseAndImportQuestions_when_Using12ColumnTemplateWithBannersAndBlankRows() throws IOException {
        byte[] templateBytes = excelImportService.generateSampleTemplate("READING");
        assertThat(templateBytes).isNotEmpty();

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "Mau_Giao_Bai_Tap_Chuan.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                templateBytes
        );

        when(assignmentQuestionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // When: Import từ file mẫu vừa sinh ra (chứa 6 câu mẫu và 41 dòng kẻ sẵn)
        List<AssignmentQuestion> questions = excelImportService.importQuestionsFromExcel(file, assignmentId);

        // Then: Đúng 6 câu mẫu được nhận diện, 41 dòng kẻ sẵn (prompt rỗng) bị bỏ qua sạch sẽ
        assertThat(questions).hasSize(6);

        // Kiểm tra câu 1: Multiple choice
        AssignmentQuestion q1 = questions.get(0);
        assertThat(q1.getQuestionType()).isEqualTo(QuestionType.MULTIPLE_CHOICE);
        assertThat(q1.getOptions()).hasSize(4);
        assertThat(q1.getOptions().get(1).getIsCorrect()).isTrue(); // B là đáp án đúng

        // Kiểm tra câu 3: Listen and type (FILL_IN_BLANK) có transcript TTS
        AssignmentQuestion q3 = questions.get(2);
        assertThat(q3.getQuestionType()).isEqualTo(QuestionType.FILL_IN_BLANK);
        assertThat(q3.getCorrectAnswer()).isEqualTo("since");
        assertThat(q3.getTranscript()).contains("She has worked at the tech laboratory since 2015.");

        // Kiểm tra câu 4: MATCHING
        AssignmentQuestion q4 = questions.get(3);
        assertThat(q4.getQuestionType()).isEqualTo(QuestionType.MATCHING);
        assertThat(q4.getPromptText()).isEqualTo("Resilient");
        assertThat(q4.getCorrectAnswer()).contains("Kiên cường");
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

    @Test
    @DisplayName("Null hoặc file 0 byte / thiếu sheet / ít hơn 2 hàng / assignment không tồn tại -> ném ngoại lệ chính xác")
    void importQuestionsFromExcel_emptyNullSheetlessAndMissingAssignment_throwsExceptions() throws IOException {
        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(null, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class);

        MockMultipartFile zeroBytes = new MockMultipartFile(
                "file", "empty.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[0]
        );
        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(zeroBytes, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class)
                .hasMessageContaining("không được để trống");

        UUID unknownAssId = UUID.randomUUID();
        when(assignmentRepository.findById(unknownAssId)).thenReturn(Optional.empty());
        MockMultipartFile validFile = new MockMultipartFile(
                "file", "q.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                createValidExcelBytes("Q?", "MULTIPLE_CHOICE", "A1", "B1", "", "", "A", "")
        );
        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(validFile, unknownAssId))
                .isInstanceOf(ResourceNotFoundException.class);

        byte[] emptySheetBytes;
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            wb.createSheet("Empty");
            wb.write(out);
            emptySheetBytes = out.toByteArray();
        }
        MockMultipartFile oneRowFile = new MockMultipartFile("file", "one.xlsx", "application/octet-stream", emptySheetBytes);
        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(oneRowFile, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class);
    }

    @Test
    @DisplayName("Bắt lỗi sai loại câu hỏi, thiếu đáp án FILL_IN_BLANK/MATCHING, hoặc toàn bộ dòng rỗng")
    void importQuestionsFromExcel_invalidQuestionTypeMissingDataOrBlankRows_throwsInvalidFileFormatException() throws IOException {
        // Invalid question type
        byte[] badTypeBytes = createValidExcelBytes("Q1", "UNKNOWN_FORMAT", "A", "B", "", "", "A", "");
        MockMultipartFile badTypeFile = new MockMultipartFile("file", "badtype.xlsx", "application/octet-stream", badTypeBytes);
        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(badTypeFile, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class)
                .hasMessageContaining("Loại câu hỏi không hợp lệ");

        // Missing answer on FILL_IN_BLANK
        byte[] missingAnsBytes = createValidExcelBytes("She ___ here.", "FILL_IN_BLANK", "", "", "", "", "", "Hint");
        MockMultipartFile missingAnsFile = new MockMultipartFile("file", "missing_ans.xlsx", "application/octet-stream", missingAnsBytes);
        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(missingAnsFile, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class)
                .hasMessageContaining("Thiếu đáp án đúng");

        // Missing options and answer on MULTIPLE_CHOICE
        byte[] emptyMcqBytes = createValidExcelBytes("Pick one", "MULTIPLE_CHOICE", "", "", "", "", "", "");
        MockMultipartFile emptyMcqFile = new MockMultipartFile("file", "empty_mcq.xlsx", "application/octet-stream", emptyMcqBytes);
        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(emptyMcqFile, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class)
                .hasMessageContaining("thiếu lựa chọn và đáp án");

        // Header valid but all data rows have blank prompt
        byte[] noDataBytes = createValidExcelBytes("", "MULTIPLE_CHOICE", "", "", "", "", "", "");
        MockMultipartFile noDataFile = new MockMultipartFile("file", "nodata.xlsx", "application/octet-stream", noDataBytes);
        assertThatThrownBy(() -> excelImportService.importQuestionsFromExcel(noDataFile, assignmentId))
                .isInstanceOf(InvalidFileFormatException.class)
                .hasMessageContaining("Không tìm thấy câu hỏi hợp lệ");
    }

    @Test
    @DisplayName("Import đầy đủ 6 loại câu hỏi (gồm TRUE_FALSE, ESSAY, AUDIO_RESPONSE, MATCHING, tiếng Việt alias) + file .xls legacy + Unicode")
    void importQuestionsFromExcel_all6TypesXlsFormatSkillMappingAndAnswerAliases_succeeds() throws IOException {
        byte[] xlsBytes;
        try (Workbook wb = new HSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("BaiTap");
            Row h = sheet.createRow(0);
            h.createCell(0).setCellValue("STT");
            h.createCell(1).setCellValue("Loại câu hỏi");
            h.createCell(2).setCellValue("Kỹ năng");
            h.createCell(3).setCellValue("Nội dung câu hỏi");
            h.createCell(4).setCellValue("Điểm");
            h.createCell(5).setCellValue("Lựa chọn A");
            h.createCell(6).setCellValue("Lựa chọn B");
            h.createCell(7).setCellValue("Lựa chọn C");
            h.createCell(8).setCellValue("Lựa chọn D");
            h.createCell(9).setCellValue("Đáp án đúng");
            h.createCell(10).setCellValue("Giải thích");
            h.createCell(11).setCellValue("Audio TTS");

            Row r1 = sheet.createRow(1);
            r1.createCell(0).setCellValue(1);
            r1.createCell(1).setCellValue("TRẮC NGHIỆM");
            r1.createCell(2).setCellValue("READING");
            r1.createCell(3).setCellValue("Chọn từ đúng");
            r1.createCell(4).setCellValue("2.5");
            r1.createCell(5).setCellValue("One");
            r1.createCell(6).setCellValue("Two");
            r1.createCell(7).setCellValue("Three");
            r1.createCell(8).setCellValue("Four");
            r1.createCell(9).setCellValue("Đáp án C");

            Row r2 = sheet.createRow(2);
            r2.createCell(0).setCellValue(2);
            r2.createCell(1).setCellValue("TRUE_FALSE");
            r2.createCell(2).setCellValue("LISTENING");
            r2.createCell(3).setCellValue("Water boils at 100C.");
            r2.createCell(4).setCellValue(-2); // negative points -> fallback 1.0
            r2.createCell(5).setCellValue("True");
            r2.createCell(6).setCellValue("False");
            r2.createCell(9).setCellValue("A");

            Row r3 = sheet.createRow(3);
            r3.createCell(0).setCellValue(3);
            r3.createCell(1).setCellValue("TỰ LUẬN");
            r3.createCell(2).setCellValue("WRITING");
            r3.createCell(3).setCellValue("Viết đoạn văn về biến đổi khí hậu (150 từ)");
            r3.createCell(10).setCellValue("Chấm theo IELTS Rubric");

            Row r4 = sheet.createRow(4);
            r4.createCell(0).setCellValue(4);
            r4.createCell(1).setCellValue("AUDIO_RESPONSE");
            r4.createCell(2).setCellValue("SPEAKING");
            r4.createCell(3).setCellValue("Practice saying: Hello world!");
            r4.createCell(11).setCellValue("Hello world!");

            wb.write(out);
            xlsBytes = out.toByteArray();
        }

        MockMultipartFile xlsFile = new MockMultipartFile("file", "legacy.xls", "application/vnd.ms-excel", xlsBytes);
        when(assignmentQuestionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<AssignmentQuestion> imported = excelImportService.importQuestionsFromExcel(xlsFile, null);

        assertThat(imported).hasSize(4);
        assertThat(imported.get(0).getQuestionType()).isEqualTo(QuestionType.MULTIPLE_CHOICE);
        assertThat(imported.get(0).getSkillType()).isEqualTo(SkillType.READING);
        assertThat(imported.get(0).getPoints()).isEqualTo(2.5);
        assertThat(imported.get(0).getOptions().get(2).getIsCorrect()).isTrue();

        assertThat(imported.get(1).getQuestionType()).isEqualTo(QuestionType.TRUE_FALSE);
        assertThat(imported.get(1).getSkillType()).isEqualTo(SkillType.LISTENING);
        assertThat(imported.get(1).getPoints()).isEqualTo(1.0);
        assertThat(imported.get(1).getOptions().get(0).getIsCorrect()).isTrue();

        assertThat(imported.get(2).getQuestionType()).isEqualTo(QuestionType.ESSAY);
        assertThat(imported.get(2).getPromptText()).contains("biến đổi khí hậu");

        assertThat(imported.get(3).getQuestionType()).isEqualTo(QuestionType.AUDIO_RESPONSE);
        assertThat(imported.get(3).getTranscript()).isEqualTo("Hello world!");

        byte[] defaultTemplate = excelImportService.generateSampleTemplate(null);
        assertThat(defaultTemplate).isNotEmpty();
    }

    @Test
    @DisplayName("importQuestionsFromExcel - Đọc file chuẩn Mau_Nhap_Bai_Tap_Chuan.xlsx: bỏ qua 0_Huong_Dan, map đúng promptText (không bị Script hijacking) và WRITING -> ESSAY")
    void importRealStandardTemplate_readsMauTongHopAndMapsAllTypesIncludingWriting() throws IOException {
        byte[] realTemplateBytes = Files.readAllBytes(Path.of("Mau_Nhap_Bai_Tap_Chuan.xlsx"));
        MockMultipartFile realTemplate = new MockMultipartFile(
                "file", "Mau_Nhap_Bai_Tap_Chuan.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", realTemplateBytes);

        when(assignmentQuestionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<AssignmentQuestion> imported = excelImportService.importQuestionsFromExcel(realTemplate, null);

        assertThat(imported).hasSize(11);
        assertThat(imported.get(0).getPromptText())
                .isEqualTo("What is the primary factor driving modern renewable energy adoption?");
        assertThat(imported.get(0).getTranscript())
                .isEqualTo("Renewable energy adoption has accelerated globally due to falling technological costs.");
        assertThat(imported.get(0).getQuestionType()).isEqualTo(QuestionType.MULTIPLE_CHOICE);
        assertThat(imported.get(0).getOptions().get(1).getIsCorrect()).isTrue();

        // Row 11 (index 9): WRITING alias maps to ESSAY
        assertThat(imported.get(9).getQuestionType()).isEqualTo(QuestionType.ESSAY);
        assertThat(imported.get(9).getSkillType()).isEqualTo(SkillType.WRITING);
        assertThat(imported.get(9).getPromptText()).contains("80-120 words");

        // Row 12 (index 10): TRUE_FALSE with FALSE correct
        assertThat(imported.get(10).getQuestionType()).isEqualTo(QuestionType.TRUE_FALSE);
        assertThat(imported.get(10).getOptions())
                .filteredOn(opt -> Boolean.TRUE.equals(opt.getIsCorrect()))
                .extracting(opt -> opt.getOptionText())
                .containsExactly("FALSE");
    }
}
