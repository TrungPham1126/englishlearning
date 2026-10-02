package com.englishlearning.curriculum.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class DictApiResponseDto {
    private String word;
    private String phonetic;
    private List<PhoneticDto> phonetics;
    private List<MeaningDto> meanings;

    public String getWord() {
        return word;
    }

    public void setWord(String word) {
        this.word = word;
    }

    public String getPhonetic() {
        return phonetic;
    }

    public void setPhonetic(String phonetic) {
        this.phonetic = phonetic;
    }

    public List<PhoneticDto> getPhonetics() {
        return phonetics;
    }

    public void setPhonetics(List<PhoneticDto> phonetics) {
        this.phonetics = phonetics;
    }

    public List<MeaningDto> getMeanings() {
        return meanings;
    }

    public void setMeanings(List<MeaningDto> meanings) {
        this.meanings = meanings;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PhoneticDto {
        private String text;
        private String audio;

        public String getText() {
            return text;
        }

        public void setText(String text) {
            this.text = text;
        }

        public String getAudio() {
            return audio;
        }

        public void setAudio(String audio) {
            this.audio = audio;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MeaningDto {
        private String partOfSpeech;
        private List<DefinitionDto> definitions;

        public String getPartOfSpeech() {
            return partOfSpeech;
        }

        public void setPartOfSpeech(String partOfSpeech) {
            this.partOfSpeech = partOfSpeech;
        }

        public List<DefinitionDto> getDefinitions() {
            return definitions;
        }

        public void setDefinitions(List<DefinitionDto> definitions) {
            this.definitions = definitions;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DefinitionDto {
        private String definition;
        private String example;

        public String getDefinition() {
            return definition;
        }

        public void setDefinition(String definition) {
            this.definition = definition;
        }

        public String getExample() {
            return example;
        }

        public void setExample(String example) {
            this.example = example;
        }
    }
}