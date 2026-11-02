package com.englishlearning.assignment.service;

import com.englishlearning.assignment.entity.AssignmentQuestion;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface ExcelImportService {

    /**
     * Parse và import danh sách câu hỏi từ file Excel (.xlsx, .xls) vào bài tập.
     */
    List<AssignmentQuestion> importQuestionsFromExcel(MultipartFile file, UUID assignmentId);

    /**
     * Tạo file Excel mẫu (.xlsx) chuẩn cho giáo viên điền đề bài.
     * Hỗ trợ tạo mẫu tổng hợp tất cả các kỹ năng hoặc mẫu riêng theo từng kỹ năng.
     */
    byte[] generateSampleTemplate(String skillType);
}
