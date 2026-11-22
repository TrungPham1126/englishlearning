package com.englishlearning.common.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Chuẩn hóa dữ liệu điểm legacy (thang 0-100 trong SQL seed hoặc dữ liệu cũ bị nhân hệ số)
 * về thang điểm chuẩn 0.0 - 10.0 một cách an toàn và lũy đẳng (idempotent) khi khởi động ứng dụng.
 */
@Component
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.score-migration.enabled", havingValue = "true", matchIfMissing = true)
public class ScoreScaleMigrationRunner implements ApplicationRunner {

    private final ObjectProvider<JdbcTemplate> jdbcTemplateProvider;

    @Override
    public void run(ApplicationArguments args) {
        JdbcTemplate jdbc = jdbcTemplateProvider.getIfAvailable();
        if (jdbc == null) {
            return;
        }

        int attemptsUpdated = safeUpdate(
                jdbc,
                "assignment_attempts",
                "UPDATE assignment_attempts "
                        + "SET total_score = ROUND(CASE WHEN total_score > 100 THEN 10.0 ELSE total_score / 10.0 END, 1) "
                        + "WHERE total_score > 10.0"
        );

        int passScoreUpdated = safeUpdate(
                jdbc,
                "assignments",
                "UPDATE assignments "
                        + "SET pass_score = ROUND(CASE WHEN pass_score > 100 THEN 10.0 ELSE pass_score / 10.0 END, 1) "
                        + "WHERE pass_score > 10.0"
        );

        int subjectiveAnswersUpdated = safeUpdate(
                jdbc,
                "student_answers",
                "UPDATE student_answers "
                        + "SET earned_points = ROUND(CASE WHEN earned_points > 100 THEN 10.0 ELSE earned_points / 10.0 END, 1) "
                        + "WHERE earned_points > 10.0 "
                        + "AND question_id IN (SELECT id FROM assignment_questions WHERE question_type IN ('ESSAY', 'AUDIO_RESPONSE'))"
        );

        int aiEvaluationsUpdated = safeUpdate(
                jdbc,
                "ai_evaluations",
                "UPDATE ai_evaluations "
                        + "SET overall_score = CASE WHEN overall_score > 10.0 THEN ROUND(CASE WHEN overall_score > 100 THEN 10.0 ELSE overall_score / 10.0 END, 1) ELSE overall_score END, "
                        + "pronunciation_score = CASE WHEN pronunciation_score > 10.0 THEN ROUND(CASE WHEN pronunciation_score > 100 THEN 10.0 ELSE pronunciation_score / 10.0 END, 1) ELSE pronunciation_score END, "
                        + "fluency_score = CASE WHEN fluency_score > 10.0 THEN ROUND(CASE WHEN fluency_score > 100 THEN 10.0 ELSE fluency_score / 10.0 END, 1) ELSE fluency_score END, "
                        + "grammar_score = CASE WHEN grammar_score > 10.0 THEN ROUND(CASE WHEN grammar_score > 100 THEN 10.0 ELSE grammar_score / 10.0 END, 1) ELSE grammar_score END, "
                        + "vocabulary_score = CASE WHEN vocabulary_score > 10.0 THEN ROUND(CASE WHEN vocabulary_score > 100 THEN 10.0 ELSE vocabulary_score / 10.0 END, 1) ELSE vocabulary_score END, "
                        + "coherence_score = CASE WHEN coherence_score > 10.0 THEN ROUND(CASE WHEN coherence_score > 100 THEN 10.0 ELSE coherence_score / 10.0 END, 1) ELSE coherence_score END "
                        + "WHERE overall_score > 10.0 OR pronunciation_score > 10.0 OR fluency_score > 10.0 OR grammar_score > 10.0 OR vocabulary_score > 10.0 OR coherence_score > 10.0"
        );

        int totalUpdated = attemptsUpdated + passScoreUpdated + subjectiveAnswersUpdated + aiEvaluationsUpdated;
        if (totalUpdated > 0) {
            log.info(
                    "[SCORE_SCALE_MIGRATION] Đã chuẩn hóa về thang 10: attempts={}, assignments.pass_score={}, subjective_answers={}, ai_evaluations={}",
                    attemptsUpdated, passScoreUpdated, subjectiveAnswersUpdated, aiEvaluationsUpdated
            );
        }
    }

    private int safeUpdate(JdbcTemplate jdbc, String target, String sql) {
        try {
            return jdbc.update(sql);
        } catch (Exception ex) {
            log.debug("[SCORE_SCALE_MIGRATION] Bỏ qua bảng {}: {}", target, ex.getMessage());
            return 0;
        }
    }
}
