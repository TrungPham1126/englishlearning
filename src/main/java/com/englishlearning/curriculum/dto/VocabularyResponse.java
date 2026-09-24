package com.englishlearning.curriculum.dto;

import lombok.*;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class VocabularyResponse {
    private UUID id;
    private UUID lessonId;
    private String word;
    private String meaning;
    private String ipa;
    private String exampleSentence;
    private String partOfSpeech;
}