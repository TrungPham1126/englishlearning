package com.englishlearning.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchingPairDto {
    private String id;
    private String word;
    private String ipa;
    private String meaning;
    private String mediaUrl;
}
