package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.fasterxml.jackson.databind.JsonNode;

public interface PythonIntegrationService {

    ShadowingEvaluationResponse evaluatePhonetics(byte[] audioBytes, String filename, String script);

    ShadowingEvaluationResponse mapToShadowingEvaluationResponse(JsonNode rootNode);

    JsonNode evaluateWriting(
            String topic,
            String essayText,
            String assignmentTitle,
            String keyPoints,
            String rubrics,
            String writingTask);

    default JsonNode evaluateWriting(
            String topic,
            String essayText,
            String assignmentTitle,
            String keyPoints,
            String rubrics) {
        return evaluateWriting(topic, essayText, assignmentTitle, keyPoints, rubrics, "TASK_2");
    }

    default JsonNode evaluateWriting(String topic, String essayText) {
        return evaluateWriting(topic, essayText, null, null, null, "TASK_2");
    }

    default boolean isWritingServiceEnabled() {
        return false;
    }
}
