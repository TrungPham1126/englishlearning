package com.englishlearning.curriculum.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class VocabularyRequest {
    @NotBlank(message = "Từ vựng không được để trống")
    private String word;

    @NotBlank(message = "Nghĩa không được để trống")
    private String meaning;

    private String ipa;
    private String exampleSentence;
    private String partOfSpeech;
}