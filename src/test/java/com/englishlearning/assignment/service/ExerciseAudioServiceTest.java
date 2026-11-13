package com.englishlearning.assignment.service;

import com.englishlearning.assignment.dto.ExerciseAudioResponseDto;
import com.englishlearning.assignment.dto.KokoroVoiceDto;
import com.englishlearning.assignment.entity.*;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.repository.ExerciseAudioRepository;
import com.englishlearning.assignment.service.impl.ExerciseAudioServiceImpl;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.service.DocumentStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

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

    @Test
    void staticHelpers_voiceNormalizationAndDialogueEdgeCases() {
        assertThat(ExerciseAudioService.normalizeKokoroVoice(null)).isEqualTo("af_heart");
        assertThat(ExerciseAudioService.normalizeKokoroVoice("   ")).isEqualTo("af_heart");
        assertThat(ExerciseAudioService.normalizeKokoroVoice("en-US-JennyNeural")).isEqualTo("af_heart");
        assertThat(ExerciseAudioService.normalizeKokoroVoice("en-US-GuyNeural")).isEqualTo("am_michael");
        assertThat(ExerciseAudioService.normalizeKokoroVoice("en-GB-SoniaNeural")).isEqualTo("bf_emma");
        assertThat(ExerciseAudioService.normalizeKokoroVoice("en-GB-RyanNeural")).isEqualTo("bm_george");
        assertThat(ExerciseAudioService.normalizeKokoroVoice("am_adam")).isEqualTo("am_adam");
        assertThat(ExerciseAudioService.normalizeKokoroVoice("unknown_voice")).isEqualTo("af_heart");

        assertThat(ExerciseAudioService.extractCleanShadowingSentence(null)).isEmpty();
        assertThat(ExerciseAudioService.cleanShadowingSentence(null)).isEmpty();
        assertThat(ExerciseAudioService.stripSpeakerAndStageDirections("  ")).isEmpty();
        assertThat(ExerciseAudioService.parseDialogueScript("")).isEmpty();

        String script = "Alice: Hello everyone.\nHow are you doing today?\n" +
                "Bob: Great! Thanks.\n" +
                "Sarah: Nice to meet you.\n" +
                "Host: Welcome to the show.";
        List<ExerciseAudioService.DialogueTurnParseResult> turns = ExerciseAudioService.parseDialogueScript(script);
        assertThat(turns).hasSize(4);
        assertThat(turns.get(0).text()).isEqualTo("Hello everyone. How are you doing today?");
        assertThat(turns.get(0).voice()).isEqualTo("af_heart");
        assertThat(turns.get(1).voice()).isEqualTo("am_michael");
        assertThat(turns.get(2).voice()).isEqualTo("bf_emma");
    }

    @Test
    void synthesizeAndGenerateAudio_mockedHttpCacheRepairStatusAndVoices() throws Exception {
        ExerciseAudioRepository audioRepo = Mockito.mock(ExerciseAudioRepository.class);
        AssignmentQuestionRepository questionRepo = Mockito.mock(AssignmentQuestionRepository.class);
        AssignmentRepository assignmentRepo = Mockito.mock(AssignmentRepository.class);
        ClassStudentRepository classStudentRepo = Mockito.mock(ClassStudentRepository.class);
        DocumentStorageService storage = Mockito.mock(DocumentStorageService.class);
        StringRedisTemplate redis = Mockito.mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOps = Mockito.mock(ValueOperations.class);
        Mockito.when(redis.opsForValue()).thenReturn(valueOps);

        ExerciseAudioServiceImpl service = new ExerciseAudioServiceImpl(
                audioRepo, questionRepo, assignmentRepo, classStudentRepo,
                storage, new ObjectMapper(), Optional.of(redis), 1000, 5000
        );
        ReflectionTestUtils.setField(service, "pythonServiceBaseUrl", "http://kokoro.local");
        RestTemplate rt = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.createServer(rt);

        assertThatThrownBy(() -> service.synthesizeRawScriptToUrl("   ", "af_heart", 1.0))
                .isInstanceOf(IllegalArgumentException.class);

        byte[] validWav = new byte[2048];
        Arrays.fill(validWav, (byte) 1);
        HttpHeaders wavHeaders = new HttpHeaders();
        wavHeaders.set("X-Audio-Duration", "1.5");
        server.expect(requestTo("http://kokoro.local/tts"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(validWav, MediaType.parseMediaType("audio/wav")).headers(wavHeaders));
        Mockito.when(storage.storeAudioFile(Mockito.any())).thenReturn("/audio/mono.wav");

        String monoUrl = service.synthesizeRawScriptToUrl("Single clean sentence.", "en-GB-SoniaNeural", 5.0);
        assertThat(monoUrl).isEqualTo("/audio/mono.wav");
        server.verify();

        server.reset();
        String base64Wav = Base64.getEncoder().encodeToString(validWav);
        String dialogueJson = "{\"durationMs\": 2400, \"audioBase64\": \"" + base64Wav + "\", " +
                "\"segments\": [{\"speaker\":\"Friend A\",\"voice\":\"af_heart\",\"text\":\"Hi\",\"startMs\":0,\"endMs\":1000}]}";
        server.expect(requestTo("http://kokoro.local/tts/dialogue"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(dialogueJson, MediaType.APPLICATION_JSON));
        Mockito.when(storage.storeAudioFile(Mockito.any())).thenReturn("/audio/dialogue.wav");

        String diagUrl = service.synthesizeRawScriptToUrl("Friend A: Hi!\nFriend B: Hello!", null, 0.1);
        assertThat(diagUrl).isEqualTo("/audio/dialogue.wav");
        server.verify();

        server.reset();
        server.expect(requestTo("http://kokoro.local/tts"))
                .andRespond(withSuccess(new byte[100], MediaType.parseMediaType("audio/wav")));
        assertThatThrownBy(() -> service.synthesizeRawScriptToUrl("Too small wav", "af_heart", 1.0))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Không thể tạo âm thanh");
        server.verify();

        UUID missingQ = UUID.randomUUID();
        Mockito.when(questionRepo.findById(missingQ)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.generateOrGetAudioForQuestion(missingQ, AudioGeneratedBy.TEACHER, false, null))
                .isInstanceOf(ResourceNotFoundException.class);

        UUID classId = UUID.randomUUID();
        Classroom classroom = Classroom.builder().id(classId).build();
        Assignment listeningAss = Assignment.builder().id(UUID.randomUUID()).classroom(classroom)
                .skillType(SkillType.LISTENING).audioUrl("/existing.wav").build();
        UUID qListenId = UUID.randomUUID();
        AssignmentQuestion qListen = AssignmentQuestion.builder().id(qListenId).assignment(listeningAss)
                .transcript("Listen carefully to the passage.").build();
        Mockito.when(questionRepo.findById(qListenId)).thenReturn(Optional.of(qListen));

        ExerciseAudioResponseDto shortcutDto = service.generateOrGetAudioForQuestion(qListenId, AudioGeneratedBy.SYSTEM, false, null);
        assertThat(shortcutDto.getStatus()).isEqualTo(AudioGenerationStatus.READY);
        assertThat(shortcutDto.getUrl()).isEqualTo("/existing.wav");

        Assignment speakingAss = Assignment.builder().id(UUID.randomUUID()).classroom(classroom)
                .skillType(SkillType.SPEAKING).build();
        UUID qSpeakId = UUID.randomUUID();
        AssignmentQuestion qSpeak = AssignmentQuestion.builder().id(qSpeakId).assignment(speakingAss)
                .promptText("Read aloud: Innovation drives progress.").build();
        Mockito.when(questionRepo.findById(qSpeakId)).thenReturn(Optional.of(qSpeak));
        Mockito.when(audioRepo.findByQuestionIdAndIsActiveTrue(qSpeakId)).thenReturn(Optional.empty());
        Mockito.when(audioRepo.findByQuestionIdOrderByVersionDesc(qSpeakId)).thenReturn(List.of());
        Mockito.when(audioRepo.save(Mockito.any(ExerciseAudio.class))).thenAnswer(inv -> {
            ExerciseAudio ea = inv.getArgument(0);
            ea.setId(UUID.randomUUID());
            return ea;
        });

        server.reset();
        server.expect(requestTo("http://kokoro.local/tts"))
                .andRespond(withSuccess(validWav, MediaType.parseMediaType("audio/wav")).headers(wavHeaders));
        Mockito.when(storage.storeAudioFile(Mockito.any())).thenReturn("/audio/speak_v1.wav");

        ExerciseAudioResponseDto generated = service.generateOrGetAudioForQuestion(qSpeakId, AudioGeneratedBy.TEACHER, false, "af_heart");
        assertThat(generated.getStatus()).isEqualTo(AudioGenerationStatus.READY);
        assertThat(generated.getUrl()).isEqualTo("/audio/speak_v1.wav");
        Mockito.verify(valueOps).set(Mockito.eq("exercise_audio:" + qSpeakId), Mockito.anyString(), Mockito.eq(Duration.ofHours(2)));
        server.verify();

        server.reset();
        server.expect(requestTo("http://kokoro.local/tts")).andRespond(withServerError());
        assertThatThrownBy(() -> service.generateOrGetAudioForQuestion(qSpeakId, AudioGeneratedBy.TEACHER, true, "af_heart"))
                .isInstanceOf(RuntimeException.class);
        Mockito.verify(audioRepo, Mockito.atLeastOnce()).save(Mockito.argThat(ea -> ea.getStatus() == AudioGenerationStatus.FAILED));

        UUID unauthStudent = UUID.randomUUID();
        Mockito.when(classStudentRepo.existsByClassroomIdAndStudentId(classId, unauthStudent)).thenReturn(false);
        assertThatThrownBy(() -> service.repairAudio(qSpeakId, unauthStudent, true))
                .isInstanceOf(AccessDeniedException.class);

        assertThat(service.getAudioStatus(qListenId).getStatus()).isEqualTo(AudioGenerationStatus.READY);
        qSpeak.setMediaUrl("/fallback.wav");
        assertThat(service.getAudioStatus(qSpeakId).getUrl()).isEqualTo("/fallback.wav");
        qSpeak.setMediaUrl(null);
        assertThat(service.getAudioStatus(qSpeakId).getStatus()).isEqualTo(AudioGenerationStatus.PENDING);

        server.reset();
        server.expect(requestTo("http://kokoro.local/tts/voices"))
                .andRespond(withSuccess("[{\"id\":\"af_heart\",\"name\":\"Heart\",\"isDefault\":true}]", MediaType.APPLICATION_JSON));
        List<KokoroVoiceDto> liveVoices = service.getKokoroVoices();
        assertThat(liveVoices).hasSize(1);
        server.verify();

        server.reset();
        server.expect(requestTo("http://kokoro.local/tts/voices")).andRespond(withServerError());
        assertThat(service.getKokoroVoices()).hasSize(4);

        Assignment listenPassageAss = Assignment.builder()
                .id(UUID.randomUUID())
                .skillType(SkillType.LISTENING)
                .description("[LISTENING SCRIPT]: Today we discuss solar power.\n[NOTES] Extra info")
                .build();
        Mockito.when(assignmentRepo.findById(listenPassageAss.getId())).thenReturn(Optional.of(listenPassageAss));
        server.reset();
        server.expect(requestTo("http://kokoro.local/tts"))
                .andRespond(withSuccess(validWav, MediaType.parseMediaType("audio/wav")).headers(wavHeaders));
        Mockito.when(storage.storeAudioFile(Mockito.any())).thenReturn("/audio/passage.wav");

        service.generateAudiosForAssignmentAsync(listenPassageAss.getId(), AudioGeneratedBy.TEACHER);
        assertThat(listenPassageAss.getAudioUrl()).isEqualTo("/audio/passage.wav");
        assertThat(listenPassageAss.getListeningScript()).contains("solar power");
    }
}

