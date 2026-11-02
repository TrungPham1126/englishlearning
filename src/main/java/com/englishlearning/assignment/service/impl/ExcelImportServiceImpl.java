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
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.DefaultIndexedColorMap;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportServiceImpl implements ExcelImportService {

    private final AssignmentRepository assignmentRepository;
    private final AssignmentQuestionRepository assignmentQuestionRepository;

    private static final String[] QUESTION_TYPES = {
            "MULTIPLE_CHOICE", "FILL_IN_BLANK", "MATCHING", "AUDIO_RESPONSE", "ESSAY", "TRUE_FALSE"
    };

    private static final String[] SKILL_TYPES = {
            "LISTENING", "SPEAKING", "READING", "WRITING", "GRAMMAR", "VOCABULARY"
    };

    private static final String[] TEMPLATE_HEADERS = {
            "STT",
            "Loại câu hỏi (*)",
            "Kỹ năng",
            "Nội dung câu hỏi / Câu mẫu Shadowing / Từ vựng (*)",
            "Điểm (*)",
            "Lựa chọn A",
            "Lựa chọn B",
            "Lựa chọn C",
            "Lựa chọn D",
            "Đáp án đúng / Từ điền / Nghĩa ghép cặp (*)",
            "Giải thích / Gợi ý chấm AI (Rubric/Hint)",
            "Văn bản tạo Audio (Kokoro TTS Script)"
    };

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

            // Quét tìm dòng tiêu đề từ dòng 0 đến tối đa dòng 10 (hỗ trợ cả file có Banner lẫn file cũ)
            int headerRowIndex = findHeaderRowIndex(sheet);
            if (headerRowIndex < 0) {
                throw new InvalidFileFormatException("File Excel thiếu tiêu đề bắt buộc (Question, Type, Correct Answer).");
            }

            Row headerRow = sheet.getRow(headerRowIndex);
            HeaderColumnMap colMap = mapHeaders(headerRow);

            int orderIndex = 1;
            for (int r = headerRowIndex + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null || isRowEmpty(row)) {
                    continue;
                }

                String promptText = getCellString(row.getCell(colMap.promptCol));
                // Nếu đề bài trống hoàn toàn (ví dụ: dòng kẻ sẵn từ 10-50 chỉ có STT/Điểm), bỏ qua an toàn
                if (promptText.isBlank()) {
                    continue;
                }

                String typeStr = colMap.typeCol >= 0 ? getCellString(row.getCell(colMap.typeCol)) : "";
                QuestionType questionType = parseQuestionType(typeStr);

                String optA = colMap.optACol >= 0 ? getCellString(row.getCell(colMap.optACol)) : "";
                String optB = colMap.optBCol >= 0 ? getCellString(row.getCell(colMap.optBCol)) : "";
                String optC = colMap.optCCol >= 0 ? getCellString(row.getCell(colMap.optCCol)) : "";
                String optD = colMap.optDCol >= 0 ? getCellString(row.getCell(colMap.optDCol)) : "";
                String rawCorrectAnswer = colMap.answerCol >= 0 ? getCellString(row.getCell(colMap.answerCol)) : "";
                String explanation = colMap.explanationCol >= 0 ? getCellString(row.getCell(colMap.explanationCol)) : "";
                String audioScript = colMap.audioCol >= 0 ? getCellString(row.getCell(colMap.audioCol)) : "";

                Double points = 1.0;
                if (colMap.pointsCol >= 0) {
                    Cell ptsCell = row.getCell(colMap.pointsCol);
                    if (ptsCell != null) {
                        try {
                            if (ptsCell.getCellType() == CellType.NUMERIC) {
                                points = ptsCell.getNumericCellValue();
                            } else {
                                String ptsStr = getCellString(ptsCell);
                                if (!ptsStr.isBlank()) {
                                    points = Double.parseDouble(ptsStr);
                                }
                            }
                        } catch (Exception ignored) {
                            points = 1.0;
                        }
                    }
                }
                if (points <= 0.0) points = 1.0;

                // Xử lý thông minh đáp án trắc nghiệm: Nếu giáo viên ghi A/B/C/D hoặc "Đáp án A", map về text của lựa chọn đó
                String finalCorrectAnswer = rawCorrectAnswer.trim();
                String matchedOptionLabel = resolveMatchingOptionLabel(finalCorrectAnswer, optA, optB, optC, optD);

                AssignmentQuestion question = AssignmentQuestion.builder()
                        .assignment(assignment)
                        .orderIndex(orderIndex++)
                        .promptText(promptText)
                        .questionType(questionType)
                        .correctAnswer(finalCorrectAnswer)
                        .explanation(explanation)
                        .transcript(audioScript.isBlank() ? null : audioScript)
                        .points(points)
                        .options(new ArrayList<>())
                        .build();

                if (questionType == QuestionType.MULTIPLE_CHOICE || questionType == QuestionType.TRUE_FALSE) {
                    if (!optA.isBlank()) {
                        boolean isCorrect = isOptionCorrect("A", optA, finalCorrectAnswer, matchedOptionLabel);
                        question.getOptions().add(createOption(question, "A", optA, isCorrect));
                    }
                    if (!optB.isBlank()) {
                        boolean isCorrect = isOptionCorrect("B", optB, finalCorrectAnswer, matchedOptionLabel);
                        question.getOptions().add(createOption(question, "B", optB, isCorrect));
                    }
                    if (!optC.isBlank()) {
                        boolean isCorrect = isOptionCorrect("C", optC, finalCorrectAnswer, matchedOptionLabel);
                        question.getOptions().add(createOption(question, "C", optC, isCorrect));
                    }
                    if (!optD.isBlank()) {
                        boolean isCorrect = isOptionCorrect("D", optD, finalCorrectAnswer, matchedOptionLabel);
                        question.getOptions().add(createOption(question, "D", optD, isCorrect));
                    }
                }

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

    @Override
    public byte[] generateSampleTemplate(String skillType) {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();

            // Font & Styles
            XSSFFont fontBanner = workbook.createFont();
            fontBanner.setFontName("Segoe UI");
            fontBanner.setFontHeightInPoints((short) 12);
            fontBanner.setBold(true);
            fontBanner.setColor(new XSSFColor(new Color(255, 255, 255), colorMap));

            XSSFCellStyle styleBanner = workbook.createCellStyle();
            styleBanner.setFont(fontBanner);
            styleBanner.setFillForegroundColor(new XSSFColor(new Color(30, 58, 138), colorMap)); // Navy #1E3A8A
            styleBanner.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            styleBanner.setAlignment(HorizontalAlignment.CENTER);
            styleBanner.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFFont fontDesc = workbook.createFont();
            fontDesc.setFontName("Segoe UI");
            fontDesc.setFontHeightInPoints((short) 9);
            fontDesc.setColor(new XSSFColor(new Color(30, 41, 59), colorMap)); // Dark slate

            XSSFCellStyle styleDesc = workbook.createCellStyle();
            styleDesc.setFont(fontDesc);
            styleDesc.setFillForegroundColor(new XSSFColor(new Color(239, 246, 255), colorMap)); // #EFF6FF
            styleDesc.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            styleDesc.setVerticalAlignment(VerticalAlignment.CENTER);
            styleDesc.setWrapText(true);

            XSSFFont fontHeader = workbook.createFont();
            fontHeader.setFontName("Segoe UI");
            fontHeader.setFontHeightInPoints((short) 10);
            fontHeader.setBold(true);
            fontHeader.setColor(new XSSFColor(new Color(15, 23, 42), colorMap));

            XSSFCellStyle styleHeader = workbook.createCellStyle();
            styleHeader.setFont(fontHeader);
            styleHeader.setFillForegroundColor(new XSSFColor(new Color(226, 232, 240), colorMap)); // #E2E8F0
            styleHeader.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            styleHeader.setAlignment(HorizontalAlignment.CENTER);
            styleHeader.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(styleHeader);

            XSSFFont fontData = workbook.createFont();
            fontData.setFontName("Segoe UI");
            fontData.setFontHeightInPoints((short) 9);

            XSSFCellStyle styleData = workbook.createCellStyle();
            fontData.setFontName("Segoe UI");
            styleData.setFont(fontData);
            styleData.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(styleData);

            XSSFCellStyle styleDataCenter = workbook.createCellStyle();
            styleDataCenter.setFont(fontData);
            styleDataCenter.setAlignment(HorizontalAlignment.CENTER);
            styleDataCenter.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorder(styleDataCenter);

            // ================= SHEET 1: Bang_Nhap_Bai_Tap =================
            Sheet sheet1 = workbook.createSheet("Bang_Nhap_Bai_Tap");
            sheet1.createFreezePane(0, 3); // Cố định 3 hàng tiêu đề

            // Hàng 1 (Row 0): Banner
            Row row0 = sheet1.createRow(0);
            row0.setHeightInPoints(34);
            Cell cellBanner = row0.createCell(0);
            cellBanner.setCellValue("BIỂU MẪU NHẬP BÀI TẬP ĐA NĂNG - ENGLISH LEARNING PLATFORM (Giáo viên chỉ cần điền vào các hàng bên dưới hoặc sửa trực tiếp trên dòng mẫu)");
            cellBanner.setCellStyle(styleBanner);
            sheet1.addMergedRegion(new CellRangeAddress(0, 0, 0, 11));

            // Hàng 2 (Row 1): Mô tả nhanh quy tắc
            Row row1 = sheet1.createRow(1);
            row1.setHeightInPoints(42);
            Cell cellDesc = row1.createCell(0);
            cellDesc.setCellValue("💡 HƯỚNG DẪN NHANH: Trắc nghiệm: Điền cột F, G, H, I & cột J ghi chữ cái (A/B/C/D) hoặc nội dung đáp án | Điền từ: Dùng '___' trong câu hỏi, đáp án ở cột J | Ghép từ: Cột D ghi từ vựng, cột J ghi nghĩa tiếng Việt | Nghe chép chính tả: Cột D ghi đề, cột J ghi từ khóa, cột L ghi kịch bản đọc để Kokoro AI tự tạo audio | Shadowing/Nói: Cột D ghi câu mẫu, cột L ghi kịch bản phát âm | Viết/Tự luận: Cột D ghi đề bài, cột K ghi gợi ý/tiêu chí chấm AI.");
            cellDesc.setCellStyle(styleDesc);
            sheet1.addMergedRegion(new CellRangeAddress(1, 1, 0, 11));

            // Hàng 3 (Row 2): Header các cột
            Row row2 = sheet1.createRow(2);
            row2.setHeightInPoints(26);
            for (int i = 0; i < TEMPLATE_HEADERS.length; i++) {
                Cell c = row2.createCell(i);
                c.setCellValue(TEMPLATE_HEADERS[i]);
                c.setCellStyle(styleHeader);
            }

            // Hàng 4-9 (Rows 3-8): 6 Dòng dữ liệu mẫu đa dạng
            List<Object[]> sampleRows = getSampleRows(skillType);
            int curRow = 3;
            for (Object[] rowData : sampleRows) {
                Row r = sheet1.createRow(curRow++);
                r.setHeightInPoints(22);
                for (int c = 0; c < rowData.length; c++) {
                    Cell cell = r.createCell(c);
                    Object val = rowData[c];
                    if (val instanceof Number) {
                        cell.setCellValue(((Number) val).doubleValue());
                        cell.setCellStyle(styleDataCenter);
                    } else {
                        cell.setCellValue(val != null ? val.toString() : "");
                        cell.setCellStyle(c == 0 || c == 1 || c == 2 || c == 4 ? styleDataCenter : styleData);
                    }
                }
            }

            // Hàng 10-50 (Rows 9-49): Kẻ sẵn 41 hàng trống định dạng sẵn
            String defaultSkill = (skillType != null && !skillType.isBlank()) ? skillType.toUpperCase() : "READING";
            for (int i = 1; i <= 41; i++) {
                Row r = sheet1.createRow(curRow++);
                r.setHeightInPoints(20);
                for (int c = 0; c < TEMPLATE_HEADERS.length; c++) {
                    Cell cell = r.createCell(c);
                    cell.setCellStyle(c == 0 || c == 1 || c == 2 || c == 4 ? styleDataCenter : styleData);
                    if (c == 0) {
                        cell.setCellValue(sampleRows.size() + i); // STT tiếp nối
                    } else if (c == 1) {
                        cell.setCellValue("MULTIPLE_CHOICE"); // Loại mặc định
                    } else if (c == 2) {
                        cell.setCellValue(defaultSkill);
                    } else if (c == 4) {
                        cell.setCellValue(1.0); // Điểm mặc định
                    } else {
                        cell.setCellValue("");
                    }
                }
            }

            // Data Validation: Dropdown Loại câu hỏi ở Cột B (index 1)
            DataValidationHelper valHelper = sheet1.getDataValidationHelper();
            CellRangeAddressList typeRange = new CellRangeAddressList(3, 100, 1, 1);
            DataValidationConstraint typeConstraint = valHelper.createExplicitListConstraint(QUESTION_TYPES);
            DataValidation typeValidation = valHelper.createValidation(typeConstraint, typeRange);
            typeValidation.setShowErrorBox(true);
            sheet1.addValidationData(typeValidation);

            // Data Validation: Dropdown Kỹ năng ở Cột C (index 2)
            CellRangeAddressList skillRange = new CellRangeAddressList(3, 100, 2, 2);
            DataValidationConstraint skillConstraint = valHelper.createExplicitListConstraint(SKILL_TYPES);
            DataValidation skillValidation = valHelper.createValidation(skillConstraint, skillRange);
            skillValidation.setShowErrorBox(true);
            sheet1.addValidationData(skillValidation);

            // Set column widths
            int[] colWidths = {6, 20, 16, 45, 10, 25, 25, 25, 25, 35, 38, 45};
            for (int i = 0; i < colWidths.length; i++) {
                sheet1.setColumnWidth(i, colWidths[i] * 256);
            }

            // ================= SHEET 2: Huong_Dan_Chi_Tiet =================
            Sheet sheet2 = workbook.createSheet("Huong_Dan_Chi_Tiet");
            createGuideSheet(workbook, sheet2, styleBanner, styleHeader, styleData, styleDesc);

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception ex) {
            log.error("Lỗi khi tạo file Excel mẫu: {}", ex.getMessage(), ex);
            throw new RuntimeException("Không thể tạo file Excel mẫu: " + ex.getMessage(), ex);
        }
    }

    private void createGuideSheet(XSSFWorkbook workbook, Sheet sheet, XSSFCellStyle styleBanner,
                                  XSSFCellStyle styleHeader, XSSFCellStyle styleData, XSSFCellStyle styleDesc) {
        // Banner Guide
        Row r0 = sheet.createRow(0);
        r0.setHeightInPoints(30);
        Cell c0 = r0.createCell(0);
        c0.setCellValue("BẢNG TRA CỨU & QUY CHUẨN CÁC STUDIO HỌC TẬP TRONG HỆ THỐNG");
        c0.setCellStyle(styleBanner);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 4));

        Row r1 = sheet.createRow(1);
        r1.setHeightInPoints(24);
        Cell c1 = r1.createCell(0);
        c1.setCellValue("Hệ thống tự động liên kết các câu hỏi với Studio học tập chuyên biệt dựa theo 'Loại câu hỏi' và 'Kỹ năng':");
        c1.setCellStyle(styleDesc);
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 4));

        Row r2 = sheet.createRow(2);
        r2.setHeightInPoints(24);
        String[] guideHeaders = {"Studio / Giao Diện Học Tập", "Loại Câu Hỏi (*)", "Kỹ Năng", "Cách Điền Cột D, J, L", "Gợi Ý & Mẹo"};
        for (int i = 0; i < guideHeaders.length; i++) {
            Cell c = r2.createCell(i);
            c.setCellValue(guideHeaders[i]);
            c.setCellStyle(styleHeader);
        }

        Object[][] guideData = {
                {"MultipleChoiceRenderer (Trắc nghiệm)", "MULTIPLE_CHOICE", "READING, GRAMMAR, LISTENING", "Cột D: Câu hỏi. Cột F, G, H, I: Lựa chọn A, B, C, D. Cột J: Ghi 'A', 'B', 'C', 'D' hoặc toàn văn lựa chọn.", "Hệ thống tự động nhận diện chữ cái hoặc khớp text."},
                {"FillInBlankRenderer (Điền từ khuyết)", "FILL_IN_BLANK", "GRAMMAR, VOCABULARY, READING", "Cột D: Câu chứa '___' (3 gạch dưới). Cột J: Từ/cụm từ cần điền đúng. Lựa chọn A-D: Để trống.", "Không phân biệt hoa thường khi chấm."},
                {"ListenAndTypeRenderer (Nghe chép chính tả)", "FILL_IN_BLANK", "LISTENING", "Cột D: Câu chứa '___'. Cột J: Từ cần gõ. Cột L: Đoạn kịch bản nghe để Kokoro TTS tự tạo audio.", "Hệ thống tự động sinh audio phát âm chuẩn bản ngữ US Native."},
                {"VocabularyMatchingStudio (Ghép cặp từ vựng)", "MATCHING", "VOCABULARY", "Cột D: Từ vựng tiếng Anh (VD: Resilient). Cột J: Nghĩa tiếng Việt. Cột K: Phiên âm IPA.", "Học sinh sẽ chơi màn lật thẻ hoặc nối từ vựng tương ứng."},
                {"SpeakingShadowingStudio (Luyện nhại âm)", "AUDIO_RESPONSE", "SPEAKING", "Cột D: Câu mẫu cần nhại. Cột J: Câu mẫu. Cột L: Câu tiếng Anh để AI sinh file audio chuẩn.", "Học sinh nghe người bản ngữ đọc rồi nói lại, AI chấm điểm phát âm & ngữ điệu."},
                {"SpeakingQAStudio / Essay Studio (Tự luận)", "AUDIO_RESPONSE hoặc ESSAY", "SPEAKING, WRITING", "Cột D: Chủ đề phỏng vấn / Đề bài luận. Cột K: Tiêu chí chấm AI (Rubric, dàn ý gợi ý).", "AI Lab sẽ đánh giá theo Rubric: Fluency, Lexical resource, Grammar, Task Response."}
        };

        int rIdx = 3;
        for (Object[] row : guideData) {
            Row r = sheet.createRow(rIdx++);
            r.setHeightInPoints(28);
            for (int c = 0; c < row.length; c++) {
                Cell cell = r.createCell(c);
                cell.setCellValue(row[c].toString());
                cell.setCellStyle(styleData);
            }
        }

        int[] widths = {32, 22, 22, 50, 42};
        for (int i = 0; i < widths.length; i++) {
            sheet.setColumnWidth(i, widths[i] * 256);
        }
    }

    private List<Object[]> getSampleRows(String skillType) {
        List<Object[]> rows = new ArrayList<>();
        // 6 Dòng dữ liệu mẫu đa dạng bao quát 6 studio học tập
        rows.add(new Object[]{
                1, "MULTIPLE_CHOICE", "READING",
                "What is the primary factor driving modern renewable energy adoption?",
                1.0,
                "Government subsidy reduction",
                "Technological cost decline and efficiency gains",
                "Fossil fuel abundance",
                "Short-term speculative investment",
                "B",
                "Lựa chọn B chính xác vì sự suy giảm chi phí công nghệ và hiệu suất cao là động lực cốt lõi thúc đẩy năng lượng tái tạo.",
                "Renewable energy adoption has accelerated globally due to falling technological costs."
        });

        rows.add(new Object[]{
                2, "FILL_IN_BLANK", "GRAMMAR",
                "If she had checked the train schedule earlier, she ___ (not miss) the morning seminar.",
                1.0,
                "", "", "", "",
                "would not have missed",
                "Câu điều kiện loại 3 (Third Conditional): If + had + V3/ed, S + would have + V3/ed.",
                ""
        });

        rows.add(new Object[]{
                3, "FILL_IN_BLANK", "LISTENING",
                "Listen and type the missing word: She has worked at the tech laboratory ___ 2015.",
                1.0,
                "", "", "", "",
                "since",
                "Dùng 'since' trước mốc thời gian cụ thể (2015) trong thì hiện tại hoàn thành.",
                "She has worked at the tech laboratory since 2015."
        });

        rows.add(new Object[]{
                4, "MATCHING", "VOCABULARY",
                "Resilient",
                1.0,
                "", "", "", "",
                "Kiên cường, có khả năng phục hồi nhanh trước khó khăn",
                "/rɪˈzɪl.jənt/ (adj): able to recover quickly from difficult conditions.",
                "Resilient individuals adapt swiftly to adverse circumstances."
        });

        rows.add(new Object[]{
                5, "AUDIO_RESPONSE", "SPEAKING",
                "Consistency is the key to mastering any new skill.",
                1.0,
                "", "", "", "",
                "Consistency is the key to mastering any new skill.",
                "Chú ý nối âm 'is the', trọng âm 'conSIStency', 'MAStering'. Ngữ điệu xuống ở cuối câu trần thuật.",
                "Consistency is the key to mastering any new skill."
        });

        rows.add(new Object[]{
                6, "AUDIO_RESPONSE", "SPEAKING",
                "Describe an environmental challenge facing your city and propose a practical community solution.",
                1.0,
                "", "", "", "",
                "Sample response covering issue analysis, local impact, and actionable community mitigation steps.",
                "Rubric chấm AI: 1. Fluency & Coherence, 2. Lexical Resource, 3. Grammatical Range, 4. Task Response.",
                ""
        });

        return rows;
    }

    private int findHeaderRowIndex(Sheet sheet) {
        int maxScan = Math.min(10, sheet.getLastRowNum());
        for (int r = 0; r <= maxScan; r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;

            boolean hasQuestion = false;
            boolean hasType = false;
            boolean hasAnswer = false;

            for (int c = 0; c < row.getLastCellNum(); c++) {
                String val = getCellString(row.getCell(c)).toLowerCase();
                if (val.contains("loại") || val.contains("type") || val.contains("dạng")) {
                    hasType = true;
                } else if (val.contains("câu hỏi") || val.contains("question") || val.contains("nội dung") || val.contains("đề bài")) {
                    hasQuestion = true;
                }
                if (val.contains("đáp án") || val.contains("correct") || val.contains("answer") || val.contains("nghĩa ghép")) {
                    hasAnswer = true;
                }
            }

            if (hasQuestion && hasType && hasAnswer) {
                return r;
            }
        }
        return -1;
    }

    private HeaderColumnMap mapHeaders(Row headerRow) {
        HeaderColumnMap map = new HeaderColumnMap();

        for (int c = 0; c < headerRow.getLastCellNum(); c++) {
            String val = getCellString(headerRow.getCell(c)).toLowerCase().trim();
            if (val.contains("loại") || val.contains("type") || val.contains("dạng")) {
                if (map.typeCol < 0) map.typeCol = c;
            } else if (val.contains("kỹ năng") || val.contains("skill")) {
                if (map.skillCol < 0) map.skillCol = c;
            } else if (val.contains("điểm") || val.contains("point") || val.contains("score")) {
                if (map.pointsCol < 0) map.pointsCol = c;
            } else if (val.contains("lựa chọn a") || val.contains("option a") || val.contains("phương án a") || val.equals("a")) {
                if (map.optACol < 0) map.optACol = c;
            } else if (val.contains("lựa chọn b") || val.contains("option b") || val.contains("phương án b") || val.equals("b")) {
                if (map.optBCol < 0) map.optBCol = c;
            } else if (val.contains("lựa chọn c") || val.contains("option c") || val.contains("phương án c") || val.equals("c")) {
                if (map.optCCol < 0) map.optCCol = c;
            } else if (val.contains("lựa chọn d") || val.contains("option d") || val.contains("phương án d") || val.equals("d")) {
                if (map.optDCol < 0) map.optDCol = c;
            } else if (val.contains("đáp án") || val.contains("correct") || val.contains("answer") || val.contains("nghĩa ghép")) {
                if (map.answerCol < 0) map.answerCol = c;
            } else if (val.contains("giải thích") || val.contains("explanation") || val.contains("gợi ý") || val.contains("rubric")) {
                if (map.explanationCol < 0) map.explanationCol = c;
            } else if (val.contains("audio") || val.contains("tts") || val.contains("kịch bản") || val.contains("script")) {
                if (map.audioCol < 0) map.audioCol = c;
            } else if (val.contains("câu hỏi") || val.contains("question") || val.contains("nội dung") || val.contains("đề bài") || val.contains("prompt")) {
                if (map.promptCol < 0) map.promptCol = c;
            }
        }

        // Tương thích ngược với file mẫu cũ 8 cột (Question, Type, OptA..D, Correct Answer, Explanation)
        if (map.promptCol < 0) map.promptCol = 0;
        if (map.typeCol < 0) map.typeCol = 1;
        if (map.optACol < 0 && headerRow.getLastCellNum() >= 3) map.optACol = 2;
        if (map.optBCol < 0 && headerRow.getLastCellNum() >= 4) map.optBCol = 3;
        if (map.optCCol < 0 && headerRow.getLastCellNum() >= 5) map.optCCol = 4;
        if (map.optDCol < 0 && headerRow.getLastCellNum() >= 6) map.optDCol = 5;
        if (map.answerCol < 0 && headerRow.getLastCellNum() >= 7) map.answerCol = 6;
        if (map.explanationCol < 0 && headerRow.getLastCellNum() >= 8) map.explanationCol = 7;

        return map;
    }

    private String resolveMatchingOptionLabel(String answer, String optA, String optB, String optC, String optD) {
        if (answer == null || answer.isBlank()) return null;
        String clean = answer.trim().toUpperCase().replaceAll("[().,\\[\\]]", "");
        if (clean.equals("A") || clean.equals("1") || clean.contains("ĐÁP ÁN A") || clean.contains("LỰA CHỌN A")) return "A";
        if (clean.equals("B") || clean.equals("2") || clean.contains("ĐÁP ÁN B") || clean.contains("LỰA CHỌN B")) return "B";
        if (clean.equals("C") || clean.equals("3") || clean.contains("ĐÁP ÁN C") || clean.contains("LỰA CHỌN C")) return "C";
        if (clean.equals("D") || clean.equals("4") || clean.contains("ĐÁP ÁN D") || clean.contains("LỰA CHỌN D")) return "D";

        if (!optA.isBlank() && optA.trim().equalsIgnoreCase(answer.trim())) return "A";
        if (!optB.isBlank() && optB.trim().equalsIgnoreCase(answer.trim())) return "B";
        if (!optC.isBlank() && optC.trim().equalsIgnoreCase(answer.trim())) return "C";
        if (!optD.isBlank() && optD.trim().equalsIgnoreCase(answer.trim())) return "D";

        return null;
    }

    private boolean isOptionCorrect(String label, String optText, String correctAnswer, String matchedLabel) {
        if (matchedLabel != null) {
            return label.equalsIgnoreCase(matchedLabel);
        }
        if (label.equalsIgnoreCase(correctAnswer.trim())) {
            return true;
        }
        return !optText.isBlank() && optText.trim().equalsIgnoreCase(correctAnswer.trim());
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
        String clean = typeStr.trim().toUpperCase();
        if (clean.contains("MATCH")) {
            return QuestionType.MATCHING;
        }
        if (clean.contains("FILL") || clean.contains("ĐIỀN") || clean.contains("CLOZE") || clean.contains("BLANK")
                || clean.contains("LISTEN_AND_TYPE") || clean.contains("DICTATION")) {
            return QuestionType.FILL_IN_BLANK;
        }
        if (clean.contains("TRUE") || clean.contains("FALSE") || clean.contains("ĐÚNG")) {
            return QuestionType.TRUE_FALSE;
        }
        if (clean.contains("AUDIO") || clean.contains("SPEAK") || clean.contains("SHADOW") || clean.contains("NÓI") || clean.contains("PHÁT ÂM")) {
            return QuestionType.AUDIO_RESPONSE;
        }
        if (clean.contains("ESSAY") || clean.contains("VIẾT") || clean.contains("LUẬN")) {
            return QuestionType.ESSAY;
        }
        try {
            return QuestionType.valueOf(clean);
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

    private void setBorder(CellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
    }

    private static class HeaderColumnMap {
        int promptCol = -1;
        int typeCol = -1;
        int skillCol = -1;
        int pointsCol = -1;
        int optACol = -1;
        int optBCol = -1;
        int optCCol = -1;
        int optDCol = -1;
        int answerCol = -1;
        int explanationCol = -1;
        int audioCol = -1;
    }
}
