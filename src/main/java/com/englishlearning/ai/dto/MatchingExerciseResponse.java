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
public class MatchingExerciseResponse {
    private String title;
    private String type; // "MATCHING"
    private List<MatchingPairDto> pairs;
}
