package com.englishlearning.curriculum.service;

import com.englishlearning.curriculum.dto.VocabularyRequest;
import com.englishlearning.curriculum.dto.VocabularyResponse;

import java.util.List;
import java.util.UUID;

public interface VocabularyService {

    VocabularyResponse addVocabulary(UUID lessonId, VocabularyRequest request);

    List<VocabularyResponse> getVocabulariesByLesson(UUID lessonId);

    VocabularyResponse updateVocabulary(UUID id, VocabularyRequest request);

    void deleteVocabulary(UUID id);
}
