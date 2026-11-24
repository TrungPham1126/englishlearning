package com.englishlearning.ai.util;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;

import java.util.List;
import java.util.Locale;

/**
 * Tiện ích chuẩn hóa điểm Speaking (+10% so với kết quả chấm thô),
 * giúp thang chấm khuyến khích người học hơn mà vẫn giữ nguyên các guardrail bài rỗng/sai kịch bản.
 */
public final class SpeakingScoreCalibrationUtils {

    public static final double SPEAKING_SCORE_BOOST_MULTIPLIER = 1.10;

    private SpeakingScoreCalibrationUtils() {
    }

    /**
     * Cộng thêm 10% cho điểm thang 0-100 và kẹp trần tại 100.
     * Không tặng điểm cho trường hợp null hoặc <= 0.
     */
    public static Integer boostPercentageScore(Integer rawScore) {
        if (rawScore == null) {
            return null;
        }
        if (rawScore <= 0) {
            return 0;
        }
        return (int) Math.min(100L, Math.round(rawScore * SPEAKING_SCORE_BOOST_MULTIPLIER));
    }

    /**
     * Cộng thêm 10% cho điểm IELTS Band trước khi làm tròn nửa band và kẹp trần tại 9.0.
     */
    public static double boostBandRaw(double rawBand) {
        if (Double.isNaN(rawBand) || Double.isInfinite(rawBand) || rawBand <= 0.0) {
            return 0.0;
        }
        return Math.min(9.0, rawBand * SPEAKING_SCORE_BOOST_MULTIPLIER);
    }

    /**
     * Áp dụng mức cộng +10% cho kết quả chấm Shadowing / Phonetics:
     * đồng bộ overallScore, KPI (pronunciation, fluency, prosody), điểm từng từ/âm vị không phải MISSING/WRONG_WORD,
     * màu token câu và trạng thái đạt.
     */
    public static ShadowingEvaluationResponse applyShadowingBoost(ShadowingEvaluationResponse response) {
        if (response == null) {
            return null;
        }

        boolean wasPassed = Boolean.TRUE.equals(response.getIsPassed());

        if (response.getOverallScore() != null && response.getOverallScore() > 0) {
            response.setOverallScore(boostPercentageScore(response.getOverallScore()));
        }

        ShadowingEvaluationResponse.KpiMetrics kpi = response.getKpi();
        if (kpi != null) {
            kpi.setPronunciation(boostPercentageScore(kpi.getPronunciation()));
            kpi.setFluency(boostPercentageScore(kpi.getFluency()));
            kpi.setProsody(boostPercentageScore(kpi.getProsody()));
        }

        List<ShadowingEvaluationResponse.WordPhonemeDetail> wordRows = response.getWordRows();
        if (wordRows != null) {
            for (ShadowingEvaluationResponse.WordPhonemeDetail row : wordRows) {
                if (row == null || isUnscoredWordStatus(row.getWordStatus())) {
                    continue;
                }
                if (row.getScore() != null && row.getScore() > 0) {
                    row.setScore(boostPercentageScore(row.getScore()));
                }
                if (row.getPhonemes() != null) {
                    for (ShadowingEvaluationResponse.PhonemeItem phoneme : row.getPhonemes()) {
                        if (phoneme != null && phoneme.getScore() != null && phoneme.getScore() > 0) {
                            phoneme.setScore(boostPercentageScore(phoneme.getScore()));
                        }
                    }
                }
            }
        }

        List<ShadowingEvaluationResponse.SentenceToken> tokens = response.getSentenceTokens();
        if (tokens != null && wordRows != null) {
            int pairCount = Math.min(tokens.size(), wordRows.size());
            for (int i = 0; i < pairCount; i++) {
                ShadowingEvaluationResponse.SentenceToken token = tokens.get(i);
                ShadowingEvaluationResponse.WordPhonemeDetail row = wordRows.get(i);
                if (token == null || row == null || row.getScore() == null) {
                    continue;
                }
                if (isUnscoredWordStatus(token.getWordStatus())
                        || isUnscoredWordStatus(row.getWordStatus())
                        || "GRAY".equalsIgnoreCase(token.getColor())) {
                    continue;
                }
                int boostedScore = row.getScore();
                token.setColor(boostedScore >= 80 ? "GREEN" : (boostedScore >= 60 ? "YELLOW" : "RED"));
            }
        }

        int passThreshold = response.getPassScore() != null ? response.getPassScore() : 80;
        boolean hasIncompleteSentence = kpi != null
                && kpi.getCompleteness() != null
                && kpi.getCompleteness() > 0
                && kpi.getCompleteness() < 80;

        if (response.getOverallScore() != null
                && response.getOverallScore() > 0
                && !hasIncompleteSentence
                && response.getOverallScore() >= passThreshold
                && !wasPassed) {
            response.setIsPassed(true);
            String msg = response.getStatusMessage();
            if (msg != null && msg.toLowerCase(Locale.ROOT).contains("chưa đạt")) {
                response.setStatusMessage("Bài nói đạt yêu cầu! Phát âm và ngữ điệu rõ ràng.");
            }
        }

        return response;
    }

    private static boolean isUnscoredWordStatus(String status) {
        return "MISSING".equalsIgnoreCase(status) || "WRONG_WORD".equalsIgnoreCase(status);
    }
}
