package com.englishlearning.curriculum.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GrammarTopicResponse {
    private UUID id;
    private UUID lessonId;
    private String title;
    private String ruleSummary;
    private String formula;
    private String examples;
}