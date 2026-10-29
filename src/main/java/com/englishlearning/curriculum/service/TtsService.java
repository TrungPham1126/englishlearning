package com.englishlearning.curriculum.service;

public interface TtsService {

    String synthesizeAudio(String text, String voice, String speedStr);
}
