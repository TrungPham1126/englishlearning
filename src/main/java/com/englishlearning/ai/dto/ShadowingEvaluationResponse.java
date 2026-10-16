package com.englishlearning.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ShadowingEvaluationResponse {
    // 1. Thang đo KPI tổng quan
    private Integer overallScore; // Điểm tổng (0 - 100)
    private Boolean isPassed; // >= 80 điểm là Đạt
    private Integer passScore; // Mặc định 80
    private String statusMessage; // "Bạn chưa đạt! Cần >= 80 để pass."
    private String evaluatedBy; // "PYTHON_ACOUSTIC_ENGINE", "GEMINI_AI_FALLBACK", "GROQ_AI_FALLBACK"

    @Builder.Default
    private KpiMetrics kpi = new KpiMetrics();

    // 2. Dữ liệu câu trực quan để tô màu và hiển thị ký hiệu nối âm/ngắt nghỉ
    @Builder.Default
    private List<SentenceToken> sentenceTokens = new ArrayList<>();

    // 3. Danh sách chi tiết từng từ và từng âm vị (IPA)
    @Builder.Default
    private List<WordPhonemeDetail> wordRows = new ArrayList<>();

    @JsonSetter("overallScore")
    public void setOverallScoreFromNode(JsonNode node) {
        if (node != null && node.isNumber()) {
            this.overallScore = (int) Math.round(node.asDouble());
        } else if (node != null && !node.isNull()) {
            try {
                this.overallScore = (int) Math.round(Double.parseDouble(node.asText()));
            } catch (Exception ignored) {}
        }
    }

    @JsonSetter("passScore")
    public void setPassScoreFromNode(JsonNode node) {
        if (node != null && node.isNumber()) {
            this.passScore = (int) Math.round(node.asDouble());
        } else if (node != null && !node.isNull()) {
            try {
                this.passScore = (int) Math.round(Double.parseDouble(node.asText()));
            } catch (Exception ignored) {}
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class KpiMetrics {
        @Builder.Default
        private Integer pronunciation = 0; // Phát âm
        @Builder.Default
        private Integer fluency = 0; // Trôi chảy
        @Builder.Default
        private Integer completeness = 0; // Hoàn thiện
        @Builder.Default
        private Integer prosody = 0; // Ngữ điệu
        @Builder.Default
        private Integer wordsPerMinute = 0; // Tốc độ (từ/phút)

        @JsonSetter("pronunciation")
        public void setPronunciationNode(JsonNode n) { if (n != null && n.isNumber()) this.pronunciation = (int) Math.round(n.asDouble()); }
        @JsonSetter("fluency")
        public void setFluencyNode(JsonNode n) { if (n != null && n.isNumber()) this.fluency = (int) Math.round(n.asDouble()); }
        @JsonSetter("completeness")
        public void setCompletenessNode(JsonNode n) { if (n != null && n.isNumber()) this.completeness = (int) Math.round(n.asDouble()); }
        @JsonSetter("prosody")
        public void setProsodyNode(JsonNode n) { if (n != null && n.isNumber()) this.prosody = (int) Math.round(n.asDouble()); }
        @JsonSetter("wordsPerMinute")
        public void setWordsPerMinuteNode(JsonNode n) { if (n != null && n.isNumber()) this.wordsPerMinute = (int) Math.round(n.asDouble()); }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SentenceToken {
        private String word;
        private String color; // "GREEN", "YELLOW", "RED", "GRAY"
        private String wordStatus; // "SPOKEN", "MISSING", "PARTIAL"
        @Builder.Default
        private Boolean hasPauseAfter = false; // Có dấu ngắt nghỉ sau từ
        @Builder.Default
        private Boolean hasLinkingAfter = false; // Có nối âm với từ kế tiếp (‿)
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WordPhonemeDetail {
        private String word;
        private Integer score; // Điểm của từ (0 - 100)
        private String wordStatus; // "SPOKEN", "MISSING", "PARTIAL"
        @Builder.Default
        private List<PhonemeItem> phonemes = new ArrayList<>();

        @JsonSetter("score")
        public void setScoreNode(JsonNode n) { if (n != null && n.isNumber()) this.score = (int) Math.round(n.asDouble()); }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PhonemeItem {
        private String ipa; // Ví dụ: /tʃ/, /eɪ/, /n/
        private Integer score; // Điểm âm vị (0 - 100)
        private String note; // "/tʃ/ phát âm giống /ʃ/" hoặc "/s/ phát âm đúng"

        @JsonSetter("score")
        public void setScoreNode(JsonNode n) { if (n != null && n.isNumber()) this.score = (int) Math.round(n.asDouble()); }
    }
}