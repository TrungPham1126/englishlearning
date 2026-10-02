package com.englishlearning.curriculum.dto;

public class CreateVocabularyRequest {
    private String word;
    private String meaning;

    public CreateVocabularyRequest() {
    }

    public CreateVocabularyRequest(String word, String meaning) {
        this.word = word;
        this.meaning = meaning;
    }

    public String getWord() {
        return word;
    }

    public void setWord(String word) {
        this.word = word;
    }

    public String getMeaning() {
        return meaning;
    }

    public void setMeaning(String meaning) {
        this.meaning = meaning;
    }
}