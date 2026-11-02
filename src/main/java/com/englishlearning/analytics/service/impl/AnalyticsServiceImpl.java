package com.englishlearning.analytics.service.impl;

import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.repository.StudentSkillProfileRepository;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.curriculum.repository.StudentVocabularyProgressRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsServiceImpl implements AnalyticsService {

    private final StudentSkillProfileRepository profileRepository;
    private final AssignmentAttemptRepository assignmentAttemptRepository;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final StudentVocabularyProgressRepository studentVocabularyProgressRepository;
    private final EntityManager entityManager;

    /**
     * Lấy hồ sơ kỹ năng của học sinh. Nếu chưa tồn tại trong DB thì tự động khởi tạo mới.
     * Đồng thời tính toán và đồng bộ lại điểm thực tế từ lịch sử làm bài và AI evaluation.
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
                    .pronunciationScore(0.0)
                    .fluencyScore(0.0)
                    .build();
            return profileRepository.save(newProfile);
        });

        // Tính toán lại điểm số kỹ năng thực tế từ DB
        syncRealSkillScores(studentId, profile);

        // Cập nhật lại lộ trình học AI gợi ý
        if (profile.getAiRecommendedPath() == null || profile.getAiRecommendedPath().isBlank()
                || profile.getAiRecommendedPath().contains("Đọc và Từ vựng")) {
            profile.setAiRecommendedPath(generateRecommendedPath(profile));
        }

        return profileRepository.save(profile);
    }

    @Override
    @Transactional
    public StudentSkillProfile getStudentAnalytics(UUID studentId) {
        return getMyProfile(studentId);
    }

    @Override
    @Transactional
    public StudentSkillProfile getStudentAnalytics(Long userId) {
        if (userId == null) {
            return null;
        }
        // Fallback chuyển đổi sang UUID giả định hoặc tra cứu
        UUID studentId = new UUID(0L, userId);
        return getMyProfile(studentId);
    }

    /**
     * Đồng bộ điểm kỹ năng thực tế (thang điểm 0 - 100) từ các bài làm thực tế của học sinh.
     */
    private void syncRealSkillScores(UUID studentId, StudentSkillProfile profile) {
        List<AssignmentAttempt> completedAttempts = assignmentAttemptRepository.findCompletedAttemptsByStudentId(studentId);
        List<AiEvaluation> aiEvaluations = aiEvaluationRepository.findByStudentId(studentId);

        // 1. Listening, Reading, Grammar từ AssignmentAttempt
        if (completedAttempts != null && !completedAttempts.isEmpty()) {
            Double listeningAvg = calculateAveragePercentage(completedAttempts, SkillType.LISTENING);
            if (listeningAvg != null) {
                profile.setListeningScore(listeningAvg);
            }

            Double readingAvg = calculateAveragePercentage(completedAttempts, SkillType.READING);
            if (readingAvg != null) {
                profile.setReadingScore(readingAvg);
            }

            Double grammarAvg = calculateAveragePercentage(completedAttempts, SkillType.GRAMMAR);
            if (grammarAvg != null) {
                profile.setGrammarScore(grammarAvg);
            }
        }

        // 2. Pronunciation, Fluency, Speaking, Writing từ AiEvaluation kết hợp AssignmentAttempt
        if (aiEvaluations != null && !aiEvaluations.isEmpty()) {
            // Pronunciation
            List<Double> pronScores = aiEvaluations.stream()
                    .map(AiEvaluation::getPronunciationScore)
                    .filter(Objects::nonNull)
                    .map(this::normalizeTo100Scale)
                    .toList();
            if (!pronScores.isEmpty()) {
                profile.setPronunciationScore(roundOneDecimal(pronScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));
            }

            // Fluency
            List<Double> fluencyScores = aiEvaluations.stream()
                    .map(AiEvaluation::getFluencyScore)
                    .filter(Objects::nonNull)
                    .map(this::normalizeTo100Scale)
                    .toList();
            if (!fluencyScores.isEmpty()) {
                profile.setFluencyScore(roundOneDecimal(fluencyScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));
            }

            // Speaking từ AI evaluation
            List<Double> speakingScores = new ArrayList<>();
            aiEvaluations.stream()
                    .filter(e -> e.getEvalType() == AiEvaluationType.SPEAKING && e.getOverallScore() != null)
                    .map(e -> normalizeTo100Scale(e.getOverallScore()))
                    .forEach(speakingScores::add);
            if (completedAttempts != null) {
                completedAttempts.stream()
                        .filter(a -> a.getAssignment() != null && a.getAssignment().getSkillType() == SkillType.SPEAKING && a.getTotalScore() != null)
                        .map(this::convertAttemptScoreTo100)
                        .forEach(speakingScores::add);
            }
            if (!speakingScores.isEmpty()) {
                profile.setSpeakingScore(roundOneDecimal(speakingScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));
            }

            // Writing từ AI evaluation
            List<Double> writingScores = new ArrayList<>();
            aiEvaluations.stream()
                    .filter(e -> e.getEvalType() == AiEvaluationType.WRITING && e.getOverallScore() != null)
                    .map(e -> normalizeTo100Scale(e.getOverallScore()))
                    .forEach(writingScores::add);
            if (completedAttempts != null) {
                completedAttempts.stream()
                        .filter(a -> a.getAssignment() != null && a.getAssignment().getSkillType() == SkillType.WRITING && a.getTotalScore() != null)
                        .map(this::convertAttemptScoreTo100)
                        .forEach(writingScores::add);
            }
            if (!writingScores.isEmpty()) {
                profile.setWritingScore(roundOneDecimal(writingScores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));
            }
        } else if (completedAttempts != null) {
            // Trường hợp học sinh có bài Speaking/Writing nhưng chưa qua AI evaluation
            Double speakingAvg = calculateAveragePercentage(completedAttempts, SkillType.SPEAKING);
            if (speakingAvg != null) {
                profile.setSpeakingScore(speakingAvg);
            }
            Double writingAvg = calculateAveragePercentage(completedAttempts, SkillType.WRITING);
            if (writingAvg != null) {
                profile.setWritingScore(writingAvg);
            }
        }

        // 3. Vocabulary: Tỷ lệ từ vựng đã thuộc (masteryLevel >= 3) kết hợp điểm bài tập Vocabulary
        long totalVocab = studentVocabularyProgressRepository.countByStudentId(studentId);
        long masteredVocab = studentVocabularyProgressRepository.countMasteredByStudentId(studentId);
        Double vocabMasteryRate = totalVocab > 0 ? (masteredVocab * 100.0 / totalVocab) : null;

        Double vocabAttemptAvg = null;
        if (completedAttempts != null) {
            vocabAttemptAvg = calculateAveragePercentage(completedAttempts, SkillType.VOCABULARY);
        }

        if (vocabMasteryRate != null && vocabAttemptAvg != null) {
            profile.setVocabularyScore(roundOneDecimal((vocabMasteryRate * 0.5) + (vocabAttemptAvg * 0.5)));
        } else if (vocabMasteryRate != null) {
            profile.setVocabularyScore(roundOneDecimal(vocabMasteryRate));
        } else if (vocabAttemptAvg != null) {
            profile.setVocabularyScore(vocabAttemptAvg);
        }
    }

    private Double calculateAveragePercentage(List<AssignmentAttempt> attempts, SkillType skillType) {
        List<Double> scores = attempts.stream()
                .filter(a -> a.getAssignment() != null && a.getAssignment().getSkillType() == skillType && a.getTotalScore() != null)
                .map(this::convertAttemptScoreTo100)
                .toList();
        if (scores.isEmpty()) {
            return null;
        }
        return roundOneDecimal(scores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0));
    }

    private double convertAttemptScoreTo100(AssignmentAttempt attempt) {
        double score = attempt.getTotalScore() != null ? attempt.getTotalScore() : 0.0;
        // Điểm totalScore thường theo thang điểm 10.0
        if (score <= 10.0) {
            return (score / 10.0) * 100.0;
        }
        return Math.min(100.0, score);
    }

    private double normalizeTo100Scale(Double score) {
        if (score == null) {
            return 0.0;
        }
        if (score <= 10.0) {
            return score * 10.0;
        }
        return Math.min(100.0, score);
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    /**
     * Cộng dồn điểm cho một kỹ năng cụ thể sau khi hoàn thành bài tập hoặc AI chấm điểm.
     */
    @Override
    @Transactional
    public void updateSkillScore(UUID studentId, String skillType, double scoreToAdd) {
        if (skillType == null || skillType.isBlank()) {
            log.warn("Bỏ qua cập nhật điểm: skillType bị rỗng đối với học sinh {}", studentId);
            return;
        }

        StudentSkillProfile profile = getMyProfile(studentId);

        switch (skillType.toUpperCase()) {
            case "LISTENING" -> profile.setListeningScore(Math.min(100.0, profile.getListeningScore() + scoreToAdd));
            case "SPEAKING" -> profile.setSpeakingScore(Math.min(100.0, profile.getSpeakingScore() + scoreToAdd));
            case "READING" -> profile.setReadingScore(Math.min(100.0, profile.getReadingScore() + scoreToAdd));
            case "WRITING" -> profile.setWritingScore(Math.min(100.0, profile.getWritingScore() + scoreToAdd));
            case "GRAMMAR" -> profile.setGrammarScore(Math.min(100.0, profile.getGrammarScore() + scoreToAdd));
            case "VOCABULARY" -> profile.setVocabularyScore(Math.min(100.0, profile.getVocabularyScore() + scoreToAdd));
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

        Map<String, Double> skillScores = new LinkedHashMap<>();
        skillScores.put("Nói (Speaking)", s);
        skillScores.put("Nghe (Listening)", l);
        skillScores.put("Đọc (Reading)", r);
        skillScores.put("Viết (Writing)", w);
        skillScores.put("Ngữ pháp (Grammar)", g);
        skillScores.put("Từ vựng (Vocabulary)", v);

        var sorted = skillScores.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .toList();

        var strongest = sorted.get(0);
        var weakest = sorted.get(sorted.size() - 1);

        double strongThreshold = strongest.getValue() > 10.0 ? 60.0 : 7.0;
        double weakThreshold = strongest.getValue() > 10.0 ? 40.0 : 4.0;

        if (strongest.getValue() >= strongThreshold && weakest.getValue() <= weakThreshold) {
            String lowSkills = sorted.stream()
                    .filter(e -> e.getValue() <= weakThreshold)
                    .map(Map.Entry::getKey)
                    .limit(3)
                    .collect(Collectors.joining(", "));

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
