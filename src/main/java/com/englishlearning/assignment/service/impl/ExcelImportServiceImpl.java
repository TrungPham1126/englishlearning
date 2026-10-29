package com.englishlearning.assignment.service.impl;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionOption;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.service.ExcelImportService;
import com.englishlearning.common.exception.InvalidFileFormatException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportServiceImpl implements ExcelImportService {

    private final AssignmentRepository assignmentRepository;
    private final AssignmentQuestionRepository assignmentQuestionRepository;

    @Override
    @Transactional
    public List<AssignmentQuestion> importQuestionsFromExcel(MultipartFile file, UUID assignmentId) {
        if (file == null || file.isEmpty()) {
            throw new InvalidFileFormatException("File Excel không được để trống.");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename != null && !originalFilename.toLowerCase().endsWith(".xlsx")
                && !originalFilename.toLowerCase().endsWith(".xls")) {
            throw new InvalidFileFormatException("Định dạng file không hợp lệ. Chỉ chấp nhận file Excel (.xlsx, .xls).");
        }

        Assignment assignment = null;
        if (assignmentId != null) {
            assignment = assignmentRepository.findById(assignmentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài tập với ID: " + assignmentId));
        }

        List<AssignmentQuestion> questions = new ArrayList<>();

        try (InputStream inputStream = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(inputStream)) {

            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null || sheet.getPhysicalNumberOfRows() < 2) {
                throw new InvalidFileFormatException("File Excel không có dữ liệu câu hỏi hoặc thiếu dòng tiêu đề.");
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                throw new InvalidFileFormatException("File Excel thiếu dòng tiêu đề bắt buộc.");
            }

            validateHeaders(headerRow);

            int orderIndex = 1;
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) {
                    continue;
                }

                String promptText = getCellString(row.getCell(0));
                if (promptText.isBlank()) {
                    continue;
                }

                String typeStr = getCellString(row.getCell(1));
                QuestionType questionType = parseQuestionType(typeStr);

                String optA = getCellString(row.getCell(2));
                String optB = getCellString(row.getCell(3));
                String optC = getCellString(row.getCell(4));
                String optD = getCellString(row.getCell(5));
                String correctAnswer = getCellString(row.getCell(6));
                String explanation = getCellString(row.getCell(7));

                AssignmentQuestion question = AssignmentQuestion.builder()
                        .assignment(assignment)
                        .orderIndex(orderIndex++)
                        .promptText(promptText)
                        .questionType(questionType)
                        .correctAnswer(correctAnswer)
                        .explanation(explanation)
                        .points(1.0)
                        .options(new ArrayList<>())
                        .build();

                if (!optA.isBlank()) question.getOptions().add(createOption(question, "A", optA, optA.equalsIgnoreCase(correctAnswer)));
                if (!optB.isBlank()) question.getOptions().add(createOption(question, "B", optB, optB.equalsIgnoreCase(correctAnswer)));
                if (!optC.isBlank()) question.getOptions().add(createOption(question, "C", optC, optC.equalsIgnoreCase(correctAnswer)));
                if (!optD.isBlank()) question.getOptions().add(createOption(question, "D", optD, optD.equalsIgnoreCase(correctAnswer)));

                questions.add(question);
            }

            if (questions.isEmpty()) {
                throw new InvalidFileFormatException("Không tìm thấy câu hỏi hợp lệ nào trong file Excel.");
            }

            return assignmentQuestionRepository.saveAll(questions);

        } catch (InvalidFileFormatException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Lỗi khi đọc file Excel: {}", ex.getMessage(), ex);
            throw new InvalidFileFormatException("Dữ liệu file Excel bị lỗi hoặc không thể đọc: " + ex.getMessage(), ex);
        }
    }

    private void validateHeaders(Row headerRow) {
        String col0 = getCellString(headerRow.getCell(0)).toLowerCase();
        String col1 = getCellString(headerRow.getCell(1)).toLowerCase();
        String col6 = getCellString(headerRow.getCell(6)).toLowerCase();

        boolean hasQuestion = col0.contains("question") || col0.contains("câu hỏi");
        boolean hasType = col1.contains("type") || col1.contains("loại");
        boolean hasAnswer = col6.contains("answer") || col6.contains("đáp án") || col6.contains("correct");

        if (!hasQuestion || !hasType || !hasAnswer) {
            throw new InvalidFileFormatException("File Excel thiếu tiêu đề bắt buộc (Question, Type, Correct Answer).");
        }
    }

    private boolean isRowEmpty(Row row) {
        if (row.getLastCellNum() <= 0) return true;
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK && !getCellString(cell).isBlank()) {
                return false;
            }
        }
        return true;
    }

    private String getCellString(Cell cell) {
        if (cell == null) return "";
        DataFormatter formatter = new DataFormatter();
        return formatter.formatCellValue(cell).trim();
    }

    private QuestionType parseQuestionType(String typeStr) {
        if (typeStr == null || typeStr.isBlank()) {
            return QuestionType.MULTIPLE_CHOICE;
        }
        try {
            return QuestionType.valueOf(typeStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return QuestionType.MULTIPLE_CHOICE;
        }
    }

    private QuestionOption createOption(AssignmentQuestion question, String key, String text, boolean isCorrect) {
        return QuestionOption.builder()
                .question(question)
                .optionLabel(key)
                .optionText(text)
                .isCorrect(isCorrect)
                .build();
    }
}
