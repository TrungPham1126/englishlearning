package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.fasterxml.jackson.databind.JsonNode;

public interface PythonIntegrationService {

    ShadowingEvaluationResponse evaluatePhonetics(byte[] audioBytes, String filename, String script);

    ShadowingEvaluationResponse mapToShadowingEvaluationResponse(JsonNode rootNode);
}
