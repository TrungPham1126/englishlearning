package com.englishlearning.assignment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.Comparator;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "question_options")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionOption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    @JsonIgnore
    private AssignmentQuestion question;

    @Column(name = "option_label", length = 10, nullable = false)
    private String optionLabel;

    @Column(name = "option_text", columnDefinition = "TEXT", nullable = false)
    private String optionText;

    @Column(name = "match_text", columnDefinition = "TEXT")
    private String matchText;

    @Column(name = "is_correct", nullable = false)
    @Builder.Default
    private Boolean isCorrect = false;

    private static final Pattern LEADING_LABEL_PATTERN = Pattern.compile("^\\s*([A-Za-z])\\s*[.):-]\\s+.*");

    public static final Comparator<QuestionOption> DISPLAY_ORDER_COMPARATOR = Comparator.nullsLast(
            Comparator.comparingInt((QuestionOption o) -> optionOrderRank(o.getOptionLabel(), o.getOptionText()))
                    .thenComparing(o -> normalizeOptionLabel(o.getOptionLabel(), o.getOptionText()), String.CASE_INSENSITIVE_ORDER)
    );

    public static String normalizeOptionLabel(String rawLabel, String rawText) {
        String label = rawLabel != null ? rawLabel.trim().replaceAll("[.):]+$", "").trim().toUpperCase(Locale.ROOT) : "";
        if (!label.isEmpty()) {
            return label;
        }
        if (rawText != null) {
            Matcher matcher = LEADING_LABEL_PATTERN.matcher(rawText);
            if (matcher.matches()) {
                return matcher.group(1).toUpperCase(Locale.ROOT);
            }
        }
        return "";
    }

    public static int optionOrderRank(String rawLabel, String rawText) {
        String norm = normalizeOptionLabel(rawLabel, rawText);
        if (norm.isEmpty()) {
            return Integer.MAX_VALUE;
        }
        if ("TRUE".equals(norm)) {
            return 0;
        }
        if ("FALSE".equals(norm)) {
            return 1;
        }
        if ("NOT_GIVEN".equals(norm) || "NOT GIVEN".equals(norm)) {
            return 2;
        }
        if (norm.length() == 1 && norm.charAt(0) >= 'A' && norm.charAt(0) <= 'Z') {
            return norm.charAt(0) - 'A';
        }
        if (norm.matches("\\d+")) {
            try {
                return 100 + Integer.parseInt(norm);
            } catch (NumberFormatException ignored) {
                return 1000;
            }
        }
        return 1000;
    }
}
