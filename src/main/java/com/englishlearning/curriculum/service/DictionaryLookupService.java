package com.englishlearning.curriculum.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

public interface DictionaryLookupService {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class DictionaryEntryDto {
        private String word;
        private String ipa;
        private String audioUrl;
        private String partOfSpeech;
        private String meaning;
        private String exampleSentence;
    }

    DictionaryEntryDto lookup(String rawWord);
}
