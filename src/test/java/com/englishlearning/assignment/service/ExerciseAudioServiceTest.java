package com.englishlearning.assignment.service;

import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.service.impl.ExerciseAudioServiceImpl;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class ExerciseAudioServiceTest {

    @Test
    void testCleanShadowingSentenceFromQuotedPrompt() {
        String prompt = "Shadowing Practice 1:\nHãy nghe và lặp lại chính xác ngữ điệu câu sau:\n'Technological innovations have fundamentally reshaped modern pedagogical methodologies.'";
        String cleaned = ExerciseAudioService.cleanShadowingSentence(prompt);
        Assertions.assertEquals("Technological innovations have fundamentally reshaped modern pedagogical methodologies.", cleaned);
    }

    @Test
    void testCleanShadowingSentenceFromDoubleQuotedPrompt() {
        String prompt = "Listen to the audio and repeat the following sentence: \"Consistent pronunciation practice and phonemic awareness enhance oral fluency.\"";
        String cleaned = ExerciseAudioService.cleanShadowingSentence(prompt);
        Assertions.assertEquals("Consistent pronunciation practice and phonemic awareness enhance oral fluency.", cleaned);
    }

    @Test
    void testCleanShadowingSentenceFromColonPrompt() {
        String prompt = "Shadowing: Consistent pronunciation practice and phonemic awareness enhance oral fluency.";
        String cleaned = ExerciseAudioService.cleanShadowingSentence(prompt);
        Assertions.assertEquals("Consistent pronunciation practice and phonemic awareness enhance oral fluency.", cleaned);
    }

    @Test
    void testExtractCleanShadowingSentencePrefersCorrectAnswer() {
        AssignmentQuestion q = new AssignmentQuestion();
        q.setPromptText("Shadowing Practice 2:\nHãy nghe và lặp lại chính xác ngữ điệu câu sau:\n'Consistent pronunciation practice and phonemic awareness enhance oral fluency.'");
        q.setCorrectAnswer("Consistent pronunciation practice and phonemic awareness enhance oral fluency.");

        String extracted = ExerciseAudioService.extractCleanShadowingSentence(q);
        Assertions.assertEquals("Consistent pronunciation practice and phonemic awareness enhance oral fluency.", extracted);
    }

    @Test
    void testExtractCleanShadowingSentenceFallsBackToPromptWhenCorrectAnswerIsGeneric() {
        AssignmentQuestion q = new AssignmentQuestion();
        q.setPromptText("Shadow the following: \"Artificial intelligence continues to transform language learning worldwide.\"");
        q.setCorrectAnswer("Answer should demonstrate clear articulation.");

        String extracted = ExerciseAudioService.extractCleanShadowingSentence(q);
        Assertions.assertEquals("Artificial intelligence continues to transform language learning worldwide.", extracted);
    }

    @Test
    void testParseDialogueScriptWithFriendAAndFriendB() {
        String script = "Friend A: Hi, have you seen the latest movie?\n" +
                "Friend B: Not yet, I heard it has amazing reviews.\n" +
                "**Friend A (excited):** Let's go watch it this Saturday evening!\n" +
                "- [Friend B]: Sounds great! (laughs) I will book the tickets.";

        var lines = ExerciseAudioService.parseDialogueScript(script);
        Assertions.assertEquals(4, lines.size());

        Assertions.assertEquals("Friend A", lines.get(0).speaker());
        Assertions.assertEquals("Hi, have you seen the latest movie?", lines.get(0).text());
        Assertions.assertEquals("af_heart", lines.get(0).voice());

        Assertions.assertEquals("Friend B", lines.get(1).speaker());
        Assertions.assertEquals("Not yet, I heard it has amazing reviews.", lines.get(1).text());
        Assertions.assertEquals("am_michael", lines.get(1).voice());

        Assertions.assertEquals("Friend A", lines.get(2).speaker());
        Assertions.assertEquals("Let's go watch it this Saturday evening!", lines.get(2).text());
        Assertions.assertEquals("af_heart", lines.get(2).voice());

        Assertions.assertEquals("Friend B", lines.get(3).speaker());
        Assertions.assertEquals("Sounds great! I will book the tickets.", lines.get(3).text());
        Assertions.assertEquals("am_michael", lines.get(3).voice());
    }

    @Test
    void testStripSpeakerAndStageDirectionsNeverLeavesSpeakerLabel() {
        String raw = "**Speaker 1 (smiling):** Welcome to our podcast! [applause]\n" +
                "- Receptionist: Good morning, how may I help you today?";
        String stripped = ExerciseAudioService.stripSpeakerAndStageDirections(raw);
        Assertions.assertFalse(stripped.toLowerCase().contains("speaker 1"));
        Assertions.assertFalse(stripped.toLowerCase().contains("receptionist"));
        Assertions.assertFalse(stripped.toLowerCase().contains("smiling"));
        Assertions.assertFalse(stripped.toLowerCase().contains("applause"));
        Assertions.assertTrue(stripped.contains("Welcome to our podcast!"));
        Assertions.assertTrue(stripped.contains("Good morning, how may I help you today?"));
    }

    @Test
    void testSynthesizeRawScriptToUrlForShadowingAndDialogueWithKokoro() {
        boolean isPythonUp = false;
        try (java.net.Socket s = new java.net.Socket()) {
            s.connect(new java.net.InetSocketAddress("localhost", 8000), 1000);
            isPythonUp = true;
        } catch (Exception ignored) {}
        org.junit.jupiter.api.Assumptions.assumeTrue(isPythonUp, "Kokoro-82M Python service on port 8000 is not running");

        com.englishlearning.curriculum.service.DocumentStorageService mockStorage =
                org.mockito.Mockito.mock(com.englishlearning.curriculum.service.DocumentStorageService.class);
        org.mockito.Mockito.when(mockStorage.storeAudioFile(org.mockito.Mockito.any())).thenAnswer(inv -> {
            java.io.File file = inv.getArgument(0);
            Assertions.assertNotNull(file);
            Assertions.assertTrue(file.exists());
            Assertions.assertTrue(file.length() > 10000, "Generated WAV must be > 10KB, actual: " + file.length());
            return "/api/v1/files/audio/" + file.getName();
        });

        ExerciseAudioService service = new ExerciseAudioServiceImpl(
                null,
                null,
                null,
                null,
                mockStorage,
                new com.fasterxml.jackson.databind.ObjectMapper(),
                java.util.Optional.empty(),
                5000,
                90000
        );
        org.springframework.test.util.ReflectionTestUtils.setField(service, "pythonServiceBaseUrl", "http://localhost:8000");

        // Test 1: Speaking Shadowing Monologue Sentence
        String shadowingUrl = service.synthesizeRawScriptToUrl(
                "Consistent pronunciation practice and phonemic awareness enhance oral fluency.",
                "af_heart",
                1.0
        );
        Assertions.assertTrue(shadowingUrl.startsWith("/api/v1/files/audio/mono_"));

        // Test 2: Listening Multi-Speaker Dialogue (Friend A & Friend B)
        String dialogueScript = "Friend A: Hi, have you prepared for the upcoming presentation?\n" +
                "Friend B: Yes! I finished the slides last night.";
        String dialogueUrl = service.synthesizeRawScriptToUrl(dialogueScript, "af_heart", 1.0);
        Assertions.assertTrue(dialogueUrl.startsWith("/api/v1/files/audio/dialogue_"));
    }
}

