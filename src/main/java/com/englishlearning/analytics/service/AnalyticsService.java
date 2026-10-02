package com.englishlearning.analytics.service;

import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.repository.StudentSkillProfileRepository;
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
public class AnalyticsService {

    private final StudentSkillProfileRepository profileRepository;
    private final EntityManager entityManager;

    /**
     * Lấy hồ sơ kỹ năng của học sinh. Nếu chưa tồn tại trong DB thì tự động khởi
     * tạo mới.
     */
    @Transactional
    public StudentSkillProfile getMyProfile(UUID studentId) {
        return profileRepository.findById(studentId).orElseGet(() -> {
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
    }

    /**
     * Cộng dồn điểm cho một kỹ năng cụ thể sau khi hoàn thành bài tập hoặc AI chấm
     * điểm.
     */
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

        profileRepository.save(profile);
        log.info("Đã cộng dồn thành công +{} điểm vào kỹ năng {} của học sinh {}", scoreToAdd, skillType.toUpperCase(),
                studentId);
    }
}