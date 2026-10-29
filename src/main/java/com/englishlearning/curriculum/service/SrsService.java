package com.englishlearning.curriculum.service;

import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.curriculum.dto.VocabularyResponse;

import java.util.UUID;

public interface SrsService {

    PageResponse<VocabularyResponse> getDueVocabularies(UUID studentId, int limit);

    void reviewVocabulary(UUID studentId, UUID vocabularyId, int grade);
}
