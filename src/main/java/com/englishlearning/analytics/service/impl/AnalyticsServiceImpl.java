package com.englishlearning.analytics.service.impl;

import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.repository.StudentSkillProfileRepository;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.auth.entity.Student;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsServiceImpl implements AnalyticsService {

    private final StudentSkillProfileRepository profileRepository;
    private final EntityManager entityManager;

    /**
     * Lấy hồ sơ kỹ năng của học sinh. Nếu chưa tồn tại trong DB thì tự động khởi
     * tạo mới.
     */
    @Override
    @Transactional
    public StudentSkillProfile getMyProfile(UUID studentId) {
        StudentSkillProfile profile = profileRepository.findById(studentId).orElseGet(() -> {
            log.info("Khởi tạo mới StudentSkillProfile cho học sinh có ID: {}", studentId);
            StudentSkillProfile newProfile = StudentSkillProfile.builder()
                    .student(entityManager.getReference(Student.class, studentId))
                    .listeningScore(0.0)
                    .speakingScore(0.0)
                    .readingScore(0.0)
                    .writingScore(0.0)
                    .grammarScore(0.0)
                    .vocabularyScore(0.0)
                    .build();
            return profileRepository.save(newProfile);
        });

        // Nếu aiRecommendedPath chưa có hoặc là đoạn text mặc định cũ, tự động phân tích lộ trình chuẩn xác
        if (profile.getAiRecommendedPath() == null || profile.getAiRecommendedPath().isBlank()
                || profile.getAiRecommendedPath().contains("Đọc và Từ vựng")) {
            profile.setAiRecommendedPath(generateRecommendedPath(profile));
            profile = profileRepository.save(profile);
        }

        return profile;
    }

    /**
     * Cộng dồn điểm cho một kỹ năng cụ thể sau khi hoàn thành bài tập hoặc AI chấm
     * điểm.
     */
    @Override
    @Transactional
    public void updateSkillScore(UUID studentId, String skillType, double scoreToAdd) {
        if (skillType == null || skillType.isBlank()) {
            log.warn("Bỏ qua cập nhật điểm: skillType bị rỗng đối với học sinh {}", studentId);
            return;
        }

        StudentSkillProfile profile = getMyProfile(studentId);

        // Sử dụng Java 14+ Switch Expressions để cộng điểm an toàn
        switch (skillType.toUpperCase()) {
            case "LISTENING" -> profile.setListeningScore(profile.getListeningScore() + scoreToAdd);
            case "SPEAKING" -> profile.setSpeakingScore(profile.getSpeakingScore() + scoreToAdd);
            case "READING" -> profile.setReadingScore(profile.getReadingScore() + scoreToAdd);
            case "WRITING" -> profile.setWritingScore(profile.getWritingScore() + scoreToAdd);
            case "GRAMMAR" -> profile.setGrammarScore(profile.getGrammarScore() + scoreToAdd);
            case "VOCABULARY" -> profile.setVocabularyScore(profile.getVocabularyScore() + scoreToAdd);
            default -> log.warn("Không nhận diện được loại kỹ năng: {}. Bỏ qua cập nhật điểm.", skillType);
        }

        profile.setAiRecommendedPath(generateRecommendedPath(profile));
        profileRepository.save(profile);
        log.info("Đã cộng dồn thành công +{} điểm vào kỹ năng {} của học sinh {}", scoreToAdd, skillType.toUpperCase(),
                studentId);
    }

    /**
     * Thuật toán AI phân tích độ lệch kỹ năng và tối ưu hóa lộ trình học tập cá nhân hóa
     */
    @Override
    public String generateRecommendedPath(StudentSkillProfile profile) {
        double l = profile.getListeningScore() != null ? profile.getListeningScore() : 0.0;
        double s = profile.getSpeakingScore() != null ? profile.getSpeakingScore() : 0.0;
        double r = profile.getReadingScore() != null ? profile.getReadingScore() : 0.0;
        double w = profile.getWritingScore() != null ? profile.getWritingScore() : 0.0;
        double g = profile.getGrammarScore() != null ? profile.getGrammarScore() : 0.0;
        double v = profile.getVocabularyScore() != null ? profile.getVocabularyScore() : 0.0;

        double total = l + s + r + w + g + v;
        if (total < 1.0) {
            return "Hồ sơ năng lực đang ở giai đoạn khởi động. Hãy bắt đầu làm các bài tập trắc nghiệm Nghe - Đọc và luyện tập Từ vựng mỗi ngày để AI thu thập dữ liệu và đề xuất lộ trình tối ưu cho bạn.";
        }

        java.util.Map<String, Double> skillScores = new java.util.LinkedHashMap<>();
        skillScores.put("Nói (Speaking)", s);
        skillScores.put("Nghe (Listening)", l);
        skillScores.put("Đọc (Reading)", r);
        skillScores.put("Viết (Writing)", w);
        skillScores.put("Ngữ pháp (Grammar)", g);
        skillScores.put("Từ vựng (Vocabulary)", v);

        var sorted = skillScores.entrySet().stream()
                .sorted(java.util.Map.Entry.<String, Double>comparingByValue().reversed())
                .toList();

        var strongest = sorted.get(0);
        var weakest = sorted.get(sorted.size() - 1);

        if (strongest.getValue() >= 10.0 && weakest.getValue() <= 3.0) {
            String lowSkills = sorted.stream()
                    .filter(e -> e.getValue() <= 3.0)
                    .map(java.util.Map.Entry::getKey)
                    .limit(3)
                    .collect(java.util.stream.Collectors.joining(", "));

            return String.format(
                "Bạn đang có thế mạnh vượt trội ở kỹ năng %s (%.1f pts). Tuy nhiên, các kỹ năng nền tảng gồm %s còn ở mức sơ khai, tạo ra sự mất cân đối lớn trên biểu đồ năng lực. Lộ trình tối ưu đề xuất: Hãy ưu tiên luyện tập Từ vựng và luyện Nghe hàng ngày để bồi đắp vốn từ và phản xạ hiểu, giúp kỹ năng Nói phát triển toàn diện và nâng chuẩn đầu ra B2.",
                strongest.getKey(), strongest.getValue(), lowSkills
            );
        }

        return String.format(
            "Bạn đang phát triển tốt kỹ năng %s (%.1f pts). Để bứt phá dải điểm tổng thể, hãy tập trung cải thiện thêm kỹ năng %s (%.1f pts) thông qua các bài tập chuyên đề và tương tác chấm điểm cùng AI.",
            strongest.getKey(), strongest.getValue(), weakest.getKey(), weakest.getValue()
        );
    }
}
