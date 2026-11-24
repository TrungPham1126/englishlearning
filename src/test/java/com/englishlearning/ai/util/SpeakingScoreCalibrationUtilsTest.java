package com.englishlearning.ai.util;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("SpeakingScoreCalibrationUtils - Cộng thêm +10% điểm Speaking an toàn & đồng bộ")
class SpeakingScoreCalibrationUtilsTest {

    @Test
    @DisplayName("boostPercentageScore: xử lý null, <=0 và cộng +10% kẹp trần 100")
    void boostPercentageScore_handlesBoundariesAndRounds() {
        assertThat(SpeakingScoreCalibrationUtils.boostPercentageScore(null)).isNull();
        assertThat(SpeakingScoreCalibrationUtils.boostPercentageScore(0)).isZero();
        assertThat(SpeakingScoreCalibrationUtils.boostPercentageScore(-15)).isZero();
        assertThat(SpeakingScoreCalibrationUtils.boostPercentageScore(50)).isEqualTo(55);
        assertThat(SpeakingScoreCalibrationUtils.boostPercentageScore(73)).isEqualTo(80);
        assertThat(SpeakingScoreCalibrationUtils.boostPercentageScore(80)).isEqualTo(88);
        assertThat(SpeakingScoreCalibrationUtils.boostPercentageScore(90)).isEqualTo(99);
        assertThat(SpeakingScoreCalibrationUtils.boostPercentageScore(92)).isEqualTo(100);
        assertThat(SpeakingScoreCalibrationUtils.boostPercentageScore(100)).isEqualTo(100);
    }

    @Test
    @DisplayName("boostBandRaw: giữ 0.0 / NaN và cộng +10% kẹp trần 9.0")
    void boostBandRaw_handlesBoundaries() {
        assertThat(SpeakingScoreCalibrationUtils.boostBandRaw(0.0)).isZero();
        assertThat(SpeakingScoreCalibrationUtils.boostBandRaw(Double.NaN)).isZero();
        assertThat(SpeakingScoreCalibrationUtils.boostBandRaw(5.0)).isEqualTo(5.5);
        assertThat(SpeakingScoreCalibrationUtils.boostBandRaw(6.5)).isEqualTo(7.15);
        assertThat(SpeakingScoreCalibrationUtils.boostBandRaw(8.5)).isEqualTo(9.0);
    }

    @Test
    @DisplayName("applyShadowingBoost: cộng KPI/từ/âm vị, đổi màu token YELLOW->GREEN, không cộng MISSING/WRONG_WORD")
    void applyShadowingBoost_updatesScoresColorsAndPassStatus() {
        ShadowingEvaluationResponse response = ShadowingEvaluationResponse.builder()
                .overallScore(75)
                .isPassed(false)
                .passScore(80)
                .statusMessage("Chưa đạt yêu cầu. Có từ phát âm chưa chuẩn.")
                .kpi(ShadowingEvaluationResponse.KpiMetrics.builder()
                        .pronunciation(74)
                        .fluency(78)
                        .completeness(90)
                        .prosody(70)
                        .wordsPerMinute(118)
                        .build())
                .sentenceTokens(new ArrayList<>(List.of(
                        ShadowingEvaluationResponse.SentenceToken.builder()
                                .word("hello").color("YELLOW").wordStatus("SPOKEN").build(),
                        ShadowingEvaluationResponse.SentenceToken.builder()
                                .word("world").color("RED").wordStatus("PARTIAL").build(),
                        ShadowingEvaluationResponse.SentenceToken.builder()
                                .word("today").color("GRAY").wordStatus("MISSING").build(),
                        ShadowingEvaluationResponse.SentenceToken.builder()
                                .word("friend").color("RED").wordStatus("WRONG_WORD").build()
                )))
                .wordRows(new ArrayList<>(List.of(
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                .word("hello").score(75).wordStatus("SPOKEN")
                                .phonemes(new ArrayList<>(List.of(
                                        ShadowingEvaluationResponse.PhonemeItem.builder()
                                                .ipa("/h/").score(75).note("OK").build())))
                                .build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                .word("world").score(56).wordStatus("PARTIAL")
                                .phonemes(new ArrayList<>(List.of(
                                        ShadowingEvaluationResponse.PhonemeItem.builder()
                                                .ipa("/d/").score(56).note("Nhẹ").build())))
                                .build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                .word("today").score(0).wordStatus("MISSING")
                                .phonemes(new ArrayList<>(List.of(
                                        ShadowingEvaluationResponse.PhonemeItem.builder()
                                                .ipa("/t/").score(0).note("Chưa đọc").build())))
                                .build(),
                        ShadowingEvaluationResponse.WordPhonemeDetail.builder()
                                .word("friend").score(10).wordStatus("WRONG_WORD")
                                .phonemes(new ArrayList<>())
                                .build()
                )))
                .build();

        ShadowingEvaluationResponse boosted = SpeakingScoreCalibrationUtils.applyShadowingBoost(response);

        assertThat(boosted.getOverallScore()).isEqualTo(83);
        assertThat(boosted.getIsPassed()).isTrue();
        assertThat(boosted.getStatusMessage()).doesNotContain("Chưa đạt");

        assertThat(boosted.getKpi().getPronunciation()).isEqualTo(81);
        assertThat(boosted.getKpi().getFluency()).isEqualTo(86);
        assertThat(boosted.getKpi().getProsody()).isEqualTo(77);
        assertThat(boosted.getKpi().getCompleteness()).isEqualTo(90);
        assertThat(boosted.getKpi().getWordsPerMinute()).isEqualTo(118);

        // Từ đạt >= 80 sau boost đổi từ YELLOW -> GREEN
        assertThat(boosted.getWordRows().get(0).getScore()).isEqualTo(83);
        assertThat(boosted.getWordRows().get(0).getPhonemes().get(0).getScore()).isEqualTo(83);
        assertThat(boosted.getSentenceTokens().get(0).getColor()).isEqualTo("GREEN");

        // Từ 56 -> 62 đổi từ RED -> YELLOW
        assertThat(boosted.getWordRows().get(1).getScore()).isEqualTo(62);
        assertThat(boosted.getSentenceTokens().get(1).getColor()).isEqualTo("YELLOW");

        // MISSING / WRONG_WORD giữ nguyên không cộng điểm
        assertThat(boosted.getWordRows().get(2).getScore()).isZero();
        assertThat(boosted.getWordRows().get(2).getPhonemes().get(0).getScore()).isZero();
        assertThat(boosted.getSentenceTokens().get(2).getColor()).isEqualTo("GRAY");
        assertThat(boosted.getWordRows().get(3).getScore()).isEqualTo(10);
        assertThat(boosted.getSentenceTokens().get(3).getColor()).isEqualTo("RED");
    }

    @Test
    @DisplayName("applyShadowingBoost: không bật isPassed nếu bài đọc thiếu câu (0 < completeness < 80) hoặc 0 điểm")
    void applyShadowingBoost_respectsIncompleteAndZeroGuardrails() {
        ShadowingEvaluationResponse incomplete = ShadowingEvaluationResponse.builder()
                .overallScore(75)
                .isPassed(false)
                .passScore(80)
                .statusMessage("Chưa đạt yêu cầu. Bạn đã bỏ qua từ.")
                .kpi(ShadowingEvaluationResponse.KpiMetrics.builder()
                        .pronunciation(85)
                        .completeness(65)
                        .build())
                .build();

        SpeakingScoreCalibrationUtils.applyShadowingBoost(incomplete);
        assertThat(incomplete.getOverallScore()).isEqualTo(83);
        assertThat(incomplete.getIsPassed()).isFalse();

        ShadowingEvaluationResponse silence = ShadowingEvaluationResponse.builder()
                .overallScore(0)
                .isPassed(false)
                .passScore(80)
                .build();
        SpeakingScoreCalibrationUtils.applyShadowingBoost(silence);
        assertThat(silence.getOverallScore()).isZero();
        assertThat(silence.getIsPassed()).isFalse();
    }
}
