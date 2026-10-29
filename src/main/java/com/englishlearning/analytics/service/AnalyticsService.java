package com.englishlearning.analytics.service;

import com.englishlearning.analytics.entity.StudentSkillProfile;

import java.util.UUID;

public interface AnalyticsService {

    /**
     * Lấy hồ sơ kỹ năng của học sinh. Nếu chưa tồn tại trong DB thì tự động khởi
     * tạo mới.
     */
    StudentSkillProfile getMyProfile(UUID studentId);

    /**
     * Cộng dồn điểm cho một kỹ năng cụ thể sau khi hoàn thành bài tập hoặc AI chấm
     * điểm.
     */
    void updateSkillScore(UUID studentId, String skillType, double scoreToAdd);

    /**
     * Thuật toán AI phân tích độ lệch kỹ năng và tối ưu hóa lộ trình học tập cá nhân hóa
     */
    String generateRecommendedPath(StudentSkillProfile profile);
}
