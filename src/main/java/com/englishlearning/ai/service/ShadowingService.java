package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface ShadowingService {

    ShadowingEvaluationResponse evaluateShadowing(MultipartFile audioFile, UUID studentAnswerId, String customSentence);
}
