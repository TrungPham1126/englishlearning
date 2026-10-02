package com.englishlearning.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShadowingEvaluationResponse {
    // 1. Thang đo KPI tổng quan
    private Integer overallScore; // Điểm tổng (0 - 100)
    private Boolean isPassed; // >= 80 điểm là Đạt
    private Integer passScore; // Mặc định 80
    private String statusMessage; // "Bạn chưa đạt! Cần >= 80 để pass."

    private KpiMetrics kpi;

    // 2. Dữ liệu câu trực quan để tô màu và hiển thị ký hiệu nối âm/ngắt nghỉ
    private List<SentenceToken> sentenceTokens;

    // 3. Danh sách chi tiết từng từ và từng âm vị (IPA)
    private List<WordPhonemeDetail> wordRows;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KpiMetrics {
        private Integer pronunciation; // Phát âm
        private Integer fluency; // Trôi chảy
        private Integer completeness; // Hoàn thiện
        private Integer prosody; // Ngữ điệu
        private Integer wordsPerMinute; // Tốc độ (từ/phút)
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SentenceToken {
        private String word;
        private String color; // "GREEN", "YELLOW", "RED"
        private Boolean hasPauseAfter; // Có dấu ngắt nghỉ sau từ
        private Boolean hasLinkingAfter;// Có nối âm với từ kế tiếp (‿)
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WordPhonemeDetail {
        private String word;
        private Integer score; // Điểm của từ (0 - 100)
        private List<PhonemeItem> phonemes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PhonemeItem {
        private String ipa; // Ví dụ: /tʃ/, /eɪ/, /n/
        private Integer score; // Điểm âm vị (0 - 100)
        private String note; // "/tʃ/ phát âm giống /ʃ/" hoặc "/s/ phát âm đúng"
    }
}