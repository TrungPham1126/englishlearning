package com.englishlearning.common.util;

/**
 * Tiện ích chuẩn hóa điểm số theo quy ước thang điểm chuẩn của hệ thống (0.0 - 10.0 cho bài tập/bài thi
 * và 0.0 - 100.0 cho biểu đồ kỹ năng tổng hợp).
 */
public final class ScoreScaleUtils {

    private ScoreScaleUtils() {
    }

    /**
     * Chuẩn hóa điểm thô (có thể đang ở thang 0-10 hoặc dữ liệu legacy 0-100) về thang chuẩn 0.0 - 10.0.
     *
     * @return null nếu đầu vào là null; ngược lại luôn nằm trong [0.0, 10.0], làm tròn 1 chữ số thập phân.
     */
    public static Double normalizeToScale10(Double raw) {
        if (raw == null) {
            return null;
        }
        if (!Double.isFinite(raw) || raw <= 0.0) {
            return 0.0;
        }
        if (raw <= 10.0) {
            return roundOneDecimal(raw);
        }
        if (raw <= 100.0) {
            return roundOneDecimal(raw / 10.0);
        }
        return 10.0;
    }

    /**
     * Tương tự {@link #normalizeToScale10(Double)} nhưng trả về 0.0 nếu null.
     */
    public static double normalizeToScale10OrZero(Double raw) {
        if (raw == null) {
            return 0.0;
        }
        Double normalized = normalizeToScale10(raw);
        return normalized != null ? normalized : 0.0;
    }

    /**
     * Chuẩn hóa điểm thô (thang 0-10 hoặc 0-100) về thang 0.0 - 100.0.
     */
    public static double normalizeToScale100(Double raw) {
        if (raw == null || !Double.isFinite(raw) || raw <= 0.0) {
            return 0.0;
        }
        if (raw <= 10.0) {
            return roundOneDecimal(raw * 10.0);
        }
        if (raw <= 100.0) {
            return roundOneDecimal(raw);
        }
        return 100.0;
    }

    /**
     * Giới hạn giá trị trong đoạn [0.0, 10.0] và làm tròn 1 chữ số thập phân.
     */
    public static double clampScale10(double score) {
        if (!Double.isFinite(score)) {
            return 0.0;
        }
        double clamped = Math.max(0.0, Math.min(10.0, score));
        return roundOneDecimal(clamped);
    }

    /**
     * Làm tròn tới 1 chữ số thập phân.
     */
    public static double roundOneDecimal(double value) {
        if (!Double.isFinite(value)) {
            return 0.0;
        }
        return Math.round(value * 10.0) / 10.0;
    }
}
