package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.service.impl.PythonIntegrationServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;

public class PythonIntegrationServiceTest {

    private PythonIntegrationService pythonIntegrationService;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper();
        String url = "http://127.0.0.1:8000/api/v1/audio/evaluate-phonetics";
        pythonIntegrationService = new PythonIntegrationServiceImpl(objectMapper, url, 5000, 60000);
    }

    @Test
    void testEvaluatePhoneticsWithRealAudio() throws Exception {
        File audioFile = new File("d:/codes/doanchuyennganh/real_16k.wav");
        if (!audioFile.exists()) {
            audioFile = new File("../real_16k.wav");
        }
        Assertions.assertTrue(audioFile.exists(), "Audio file real_16k.wav must exist");

        byte[] audioBytes = Files.readAllBytes(audioFile.toPath());
        String script = "Technology has revolutionized the way people communicate";

        ShadowingEvaluationResponse response = pythonIntegrationService.evaluatePhonetics(
                audioBytes,
                audioFile.getName(),
                script);

        Assertions.assertNotNull(response);
        System.out.println("=== TEST BACKEND SHADOWING EVALUATION RESULT ===");
        System.out.println("Overall Score: " + response.getOverallScore());
        System.out.println("Is Passed: " + response.getIsPassed());
        System.out.println("Pass Score: " + response.getPassScore());
        System.out.println("Status Message: " + response.getStatusMessage());
        System.out.println("KPI: " + response.getKpi());
        System.out.println("Word Rows Count: " + (response.getWordRows() != null ? response.getWordRows().size() : 0));
        System.out.println("Sentence Tokens Count: "
                + (response.getSentenceTokens() != null ? response.getSentenceTokens().size() : 0));

        Assertions.assertNotNull(response.getOverallScore());
        Assertions.assertTrue(response.getOverallScore() > 0 && response.getOverallScore() <= 100);
        Assertions.assertNotNull(response.getKpi());
        Assertions.assertNotNull(response.getWordRows());
        Assertions.assertFalse(response.getWordRows().isEmpty());
        Assertions.assertNotNull(response.getSentenceTokens());
        Assertions.assertFalse(response.getSentenceTokens().isEmpty());
    }

    @Test
    void testEvaluatePhoneticsWithSampleM4aAudio() throws Exception {
        File audioFile = new File("d:/codes/doanchuyennganh/sample_m4a.wav");
        if (!audioFile.exists()) {
            audioFile = new File("../sample_m4a.wav");
        }
        Assertions.assertTrue(audioFile.exists(), "Audio file sample_m4a.wav must exist");

        byte[] audioBytes = Files.readAllBytes(audioFile.toPath());
        String script = "I believe education plays a vital role in every person life";

        ShadowingEvaluationResponse response = pythonIntegrationService.evaluatePhonetics(
                audioBytes,
                audioFile.getName(),
                script);

        Assertions.assertNotNull(response);
        System.out.println("=== TEST BACKEND SHADOWING EVALUATION RESULT 2 (SAMPLE M4A) ===");
        System.out.println("Overall Score: " + response.getOverallScore());
        System.out.println("Is Passed: " + response.getIsPassed());
        System.out.println("KPI: " + response.getKpi());
        System.out.println("Words evaluated: " + (response.getWordRows() != null ? response.getWordRows().size() : 0));
        if (response.getWordRows() != null && !response.getWordRows().isEmpty()) {
            System.out.println("First Word: " + response.getWordRows().get(0).getWord() + " (Score: "
                    + response.getWordRows().get(0).getScore() + ")");
            System.out.println("Phonemes in First Word: " + response.getWordRows().get(0).getPhonemes());
        }

        Assertions.assertNotNull(response.getOverallScore());
        Assertions.assertTrue(response.getOverallScore() > 0 && response.getOverallScore() <= 100);
        Assertions.assertNotNull(response.getKpi());
        Assertions.assertNotNull(response.getWordRows());
        Assertions.assertEquals(11, response.getWordRows().size());
    }
}
