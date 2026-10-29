package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.PhoneticEvaluationResponse;
import org.springframework.web.multipart.MultipartFile;

public interface WhisperPronunciationService {

    PhoneticEvaluationResponse evaluatePronunciation(MultipartFile audioFile, String referenceText);
}
