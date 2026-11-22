package com.englishlearning.common.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ScoreScaleUtilsTest {

    @Test
    @DisplayName("normalizeToScale10 chuẩn hóa đúng null, âm, thang 10, legacy 0-100 và giá trị không hữu hạn")
    void normalizeToScale10_handlesAllRanges() {
        assertThat(ScoreScaleUtils.normalizeToScale10(null)).isNull();
        assertThat(ScoreScaleUtils.normalizeToScale10(-2.0)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale10(0.0)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale10(7.85)).isEqualTo(7.9);
        assertThat(ScoreScaleUtils.normalizeToScale10(10.0)).isEqualTo(10.0);
        assertThat(ScoreScaleUtils.normalizeToScale10(36.5)).isEqualTo(3.7);
        assertThat(ScoreScaleUtils.normalizeToScale10(76.0)).isEqualTo(7.6);
        assertThat(ScoreScaleUtils.normalizeToScale10(100.0)).isEqualTo(10.0);
        assertThat(ScoreScaleUtils.normalizeToScale10(150.0)).isEqualTo(10.0);
        assertThat(ScoreScaleUtils.normalizeToScale10(Double.NaN)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale10(Double.POSITIVE_INFINITY)).isEqualTo(0.0);
    }

    @Test
    @DisplayName("normalizeToScale10OrZero trả về 0.0 cho null và chuẩn hóa đúng thang 10")
    void normalizeToScale10OrZero_handlesNullAndLegacy() {
        assertThat(ScoreScaleUtils.normalizeToScale10OrZero(null)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale10OrZero(Double.NaN)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale10OrZero(Double.NEGATIVE_INFINITY)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale10OrZero(78.0)).isEqualTo(7.8);
        assertThat(ScoreScaleUtils.normalizeToScale10OrZero(8.4)).isEqualTo(8.4);
    }

    @Test
    @DisplayName("normalizeToScale100 quy đổi thang 0-10 sang 0-100 và kẹp cận [0, 100]")
    void normalizeToScale100_handlesBothScales() {
        assertThat(ScoreScaleUtils.normalizeToScale100(null)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale100(Double.NaN)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale100(Double.POSITIVE_INFINITY)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale100(-1.0)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.normalizeToScale100(8.2)).isEqualTo(82.0);
        assertThat(ScoreScaleUtils.normalizeToScale100(10.0)).isEqualTo(100.0);
        assertThat(ScoreScaleUtils.normalizeToScale100(78.0)).isEqualTo(78.0);
        assertThat(ScoreScaleUtils.normalizeToScale100(100.0)).isEqualTo(100.0);
        assertThat(ScoreScaleUtils.normalizeToScale100(120.0)).isEqualTo(100.0);
    }

    @Test
    @DisplayName("clampScale10 và roundOneDecimal giới hạn [0.0, 10.0] và xử lý NaN")
    void clampAndRound_handlesEdgeValues() {
        assertThat(ScoreScaleUtils.clampScale10(-3.0)).isEqualTo(0.0);
        assertThat(ScoreScaleUtils.clampScale10(8.64)).isEqualTo(8.6);
        assertThat(ScoreScaleUtils.clampScale10(12.5)).isEqualTo(10.0);
        assertThat(ScoreScaleUtils.clampScale10(Double.NaN)).isEqualTo(0.0);

        assertThat(ScoreScaleUtils.roundOneDecimal(7.85)).isEqualTo(7.9);
        assertThat(ScoreScaleUtils.roundOneDecimal(Double.NaN)).isEqualTo(0.0);
    }
}
