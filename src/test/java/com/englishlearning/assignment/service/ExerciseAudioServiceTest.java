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
        DocumentStorageService mockStorage = Mockito.mock(DocumentStorageService.class);
        Mockito.when(mockStorage.storeAudioFile(Mockito.any())).thenAnswer(inv -> {
            java.io.File file = inv.getArgument(0);
            Assertions.assertNotNull(file);
            Assertions.assertTrue(file.exists());
            Assertions.assertTrue(file.length() > 10000, "Generated WAV must be > 10KB, actual: " + file.length());
            return "/api/v1/files/audio/" + file.getName();
        });

        ExerciseAudioServiceImpl service = new ExerciseAudioServiceImpl(
                null,
                null,
                null,
                null,
                mockStorage,
                new ObjectMapper(),
                Optional.empty(),
                5000,
                90000
        );
        ReflectionTestUtils.setField(service, "pythonServiceBaseUrl", "http://localhost:8000");
        RestTemplate rt = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.createServer(rt);

        byte[] validWav = new byte[12000];
        Arrays.fill(validWav, (byte) 7);
        HttpHeaders wavHeaders = new HttpHeaders();
        wavHeaders.set("X-Audio-Duration", "2.5");

        // Test 1: Speaking Shadowing Monologue Sentence
        server.expect(requestTo("http://localhost:8000/tts"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.text")
                        .value("Consistent pronunciation practice and phonemic awareness enhance oral fluency."))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.voice")
                        .value("af_heart"))
                .andRespond(withSuccess(validWav, MediaType.parseMediaType("audio/wav")).headers(wavHeaders));

        String shadowingUrl = service.synthesizeRawScriptToUrl(
                "Consistent pronunciation practice and phonemic awareness enhance oral fluency.",
                "af_heart",
                1.0
        );
        Assertions.assertTrue(shadowingUrl.startsWith("/api/v1/files/audio/mono_"));
        server.verify();

        // Test 2: Listening Multi-Speaker Dialogue (Friend A & Friend B)
        server.reset();
        String base64Wav = Base64.getEncoder().encodeToString(validWav);
        String dialogueJson = "{\"durationMs\": 3200, \"audioBase64\": \"" + base64Wav + "\", "
                + "\"segments\": [{\"speaker\":\"Friend A\",\"voice\":\"af_heart\",\"text\":\"Hi, have you prepared for the upcoming presentation?\",\"startMs\":0,\"endMs\":1600},"
                + "{\"speaker\":\"Friend B\",\"voice\":\"am_michael\",\"text\":\"Yes! I finished the slides last night.\",\"startMs\":1600,\"endMs\":3200}]}";
        server.expect(requestTo("http://localhost:8000/tts/dialogue"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.turns[0].speaker")
                        .value("Friend A"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.turns[0].voice")
                        .value("af_heart"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.turns[1].speaker")
                        .value("Friend B"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath("$.turns[1].voice")
                        .value("am_michael"))
                .andRespond(withSuccess(dialogueJson, MediaType.APPLICATION_JSON));

        String dialogueScript = "Friend A: Hi, have you prepared for the upcoming presentation?\n"
                + "Friend B: Yes! I finished the slides last night.";
        String dialogueUrl = service.synthesizeRawScriptToUrl(dialogueScript, "af_heart", 1.0);
        Assertions.assertTrue(dialogueUrl.startsWith("/api/v1/files/audio/dialogue_"));
        server.verify();
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

    @Test
    void nonShadowingSpeakingQuestions_skipAudioSynthesisAndClearCorruptedRubricTranscript() {
        ExerciseAudioRepository audioRepo = Mockito.mock(ExerciseAudioRepository.class);
        AssignmentQuestionRepository questionRepo = Mockito.mock(AssignmentQuestionRepository.class);
        AssignmentRepository assignmentRepo = Mockito.mock(AssignmentRepository.class);
        ClassStudentRepository classStudentRepo = Mockito.mock(ClassStudentRepository.class);
        DocumentStorageService storage = Mockito.mock(DocumentStorageService.class);

        ExerciseAudioServiceImpl service = new ExerciseAudioServiceImpl(
                audioRepo, questionRepo, assignmentRepo, classStudentRepo,
                storage, new ObjectMapper(), Optional.empty(), 1000, 5000
        );

        UUID qaAssId = UUID.randomUUID();
        Assignment qaAss = Assignment.builder()
                .id(qaAssId)
                .title("Hỏi - Đáp Q&A (B2)")
                .description("[SPEAKING_QA] Luyện phỏng vấn")
                .skillType(SkillType.SPEAKING)
                .build();
        UUID qaQId = UUID.randomUUID();
        AssignmentQuestion qaQ = AssignmentQuestion.builder()
                .id(qaQId)
                .assignment(qaAss)
                .skillType(SkillType.SPEAKING)
                .questionType(QuestionType.AUDIO_RESPONSE)
                .promptText("How can cities integrate more green spaces into urban areas?")
                .correctAnswer("(1) lắp đặt mái xanh và vườn treo")
                .transcript("(1) lắp đặt mái xanh và vườn treo")
                .mediaUrl("/stale/qa.wav")
                .build();

        Mockito.when(questionRepo.findById(qaQId)).thenReturn(Optional.of(qaQ));
        ExerciseAudioResponseDto res = service.generateOrGetAudioForQuestion(qaQId, AudioGeneratedBy.TEACHER, false, null);

        assertThat(res.getStatus()).isEqualTo(AudioGenerationStatus.READY);
        assertThat(res.getUrl()).isNull();
        assertThat(qaQ.getMediaUrl()).isNull();
        assertThat(qaQ.getTranscript()).isNull();
        Mockito.verify(questionRepo).save(qaQ);
        Mockito.verifyNoInteractions(storage);

        UUID part2AssId = UUID.randomUUID();
        Assignment part2Ass = Assignment.builder()
                .id(part2AssId)
                .title("IELTS Speaking Part 2")
                .description("[SPEAKING_PART_2] Cue Card")
                .skillType(SkillType.SPEAKING)
                .build();
        AssignmentQuestion part2Q = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .assignment(part2Ass)
                .questionType(QuestionType.AUDIO_RESPONSE)
                .promptText("Describe a book that you enjoyed reading recently.\nYou should say:\n- what it was")
                .mediaUrl("/stale/p2.wav")
                .build();

        Mockito.when(assignmentRepo.findById(part2AssId)).thenReturn(Optional.of(part2Ass));
        Mockito.when(questionRepo.findByAssignmentId(part2AssId)).thenReturn(List.of(part2Q));

        service.generateAudiosForAssignmentAsync(part2AssId, AudioGeneratedBy.SYSTEM);
        assertThat(part2Q.getMediaUrl()).isNull();
        Mockito.verifyNoInteractions(storage);
    }

    @Test
    void resolveSpeakingMode_whenExplicitTagsAndPromptHeuristics_detectsShadowingQaPart2Part3() {
        Assignment plainAss = Assignment.builder().title("General Speaking").description("").build();
        AssignmentQuestion plainQ = AssignmentQuestion.builder().promptText("Practice pronunciation.").build();

        assertThat(ExerciseAudioService.resolveSpeakingMode(plainAss, plainQ, "shadowing_mode")).isEqualTo("SHADOWING");
        assertThat(ExerciseAudioService.resolveSpeakingMode(plainAss, plainQ, "part 2 cue card")).isEqualTo("PART_2");
        assertThat(ExerciseAudioService.resolveSpeakingMode(plainAss, plainQ, "part 3 discussion")).isEqualTo("PART_3");
        assertThat(ExerciseAudioService.resolveSpeakingMode(plainAss, plainQ, "part 1 qa")).isEqualTo("QA");

        AssignmentQuestion readAloudQ = AssignmentQuestion.builder()
                .promptText("Read aloud: Innovation inspires sustainable growth.")
                .build();
        assertThat(ExerciseAudioService.resolveSpeakingMode(
                Assignment.builder().description("[SPEAKING_PART_2]").build(), readAloudQ, null))
                .isEqualTo("SHADOWING");

        assertThat(ExerciseAudioService.resolveSpeakingMode(
                Assignment.builder().title("Test").description("[SPEAKING_PART_2] IELTS").build(), plainQ, null))
                .isEqualTo("PART_2");
        assertThat(ExerciseAudioService.resolveSpeakingMode(
                Assignment.builder().title("Phản biện").description("[SPEAKING_PART_3]").build(), plainQ, null))
                .isEqualTo("PART_3");
        assertThat(ExerciseAudioService.resolveSpeakingMode(
                Assignment.builder().title("Hỏi - Đáp").description("[SPEAKING_QA]").build(), plainQ, null))
                .isEqualTo("QA");
        assertThat(ExerciseAudioService.resolveSpeakingMode(
                Assignment.builder().description("[SPEAKING_SHADOWING]").build(), plainQ, null))
                .isEqualTo("SHADOWING");

        AssignmentQuestion cueCardQ = AssignmentQuestion.builder()
                .promptText("Describe a book.\nYou should say:\n- title")
                .build();
        assertThat(ExerciseAudioService.resolveSpeakingMode(plainAss, cueCardQ, null)).isEqualTo("PART_2");

        AssignmentQuestion part3PromptQ = AssignmentQuestion.builder()
                .promptText("[PART 3] Discuss technology trends")
                .build();
        assertThat(ExerciseAudioService.resolveSpeakingMode(plainAss, part3PromptQ, null)).isEqualTo("PART_3");

        AssignmentQuestion questionMarkQ = AssignmentQuestion.builder()
                .promptText("Do you enjoy reading novels?")
                .transcript("")
                .build();
        assertThat(ExerciseAudioService.resolveSpeakingMode(plainAss, questionMarkQ, null)).isEqualTo("QA");

        AssignmentQuestion rubricAnswerQ = AssignmentQuestion.builder()
                .promptText("Speak about your hometown.")
                .correctAnswer("Gợi ý: nêu vị trí địa lý")
                .build();
        assertThat(ExerciseAudioService.resolveSpeakingMode(plainAss, rubricAnswerQ, null)).isEqualTo("QA");
    }

    @Test
    void isCorruptedSpeakingPrompt_andReconstructEnglishPrompt_fixesVietnameseCorruptedPromptsAcrossModesAndTopics() {
        assertThat(ExerciseAudioService.isCorruptedSpeakingPrompt(null)).isTrue();
        assertThat(ExerciseAudioService.isCorruptedSpeakingPrompt(AssignmentQuestion.builder().promptText("   ").build())).isTrue();
        assertThat(ExerciseAudioService.isCorruptedSpeakingPrompt(
                AssignmentQuestion.builder().promptText("(1) nêu ý kiến cá nhân về môi trường").build())).isTrue();
        assertThat(ExerciseAudioService.isCorruptedSpeakingPrompt(
                AssignmentQuestion.builder().promptText("Gợi ý chấm điểm bài nói IELTS").build())).isTrue();
        assertThat(ExerciseAudioService.isCorruptedSpeakingPrompt(
                AssignmentQuestion.builder().promptText("Describe a memorable trip to the beach.").build())).isFalse();

        Assignment validAss = Assignment.builder().title("Beach Trip").build();
        AssignmentQuestion validQ = AssignmentQuestion.builder().promptText("Describe your favorite hobby.").build();
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(validAss, validQ, "QA"))
                .isEqualTo("Describe your favorite hobby.");

        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Chuyến đi bãi biển").build(), null, "PART_2"))
                .contains("memorable trip to the beach");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Giáo viên yêu thích").build(), null, "PART_2"))
                .contains("teacher you admire");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Cuốn sách hay").build(), null, "PART_2"))
                .contains("interesting book");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Dự án mái xanh môi trường").build(), null, "PART_2"))
                .contains("environmental initiative");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Kỹ năng giao tiếp").build(), null, "PART_2"))
                .contains("useful skill");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Công viên thành phố").build(), null, "PART_2"))
                .contains("park or public garden");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Chủ đề chung").build(), null, "PART_2"))
                .contains("memorable experience");

        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Mái xanh đô thị").build(), null, "PART_3"))
                .contains("green roofs");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Công nghệ hiện đại").build(), null, "PART_3"))
                .contains("modern technology");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Giáo dục tương lai").build(), null, "PART_3"))
                .contains("education system");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Khác").build(), null, "PART_3"))
                .contains("main advantages and challenges");

        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Môi trường xanh").build(), null, "QA"))
                .contains("green roofs and eco-friendly urban spaces");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Du lịch bãi biển").build(), null, "QA"))
                .contains("visiting the beach");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Sở thích cá nhân").build(), null, "QA"))
                .contains("free time");
        assertThat(ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                Assignment.builder().title("Chung").build(), null, "QA"))
                .contains("personal experience");
    }

    @Test
    void cleanShadowingSentence_whenVietnameseInstructionsNumberedPrefixOrMultiline_extractsCleanEnglishSentence() {
        assertThat(ExerciseAudioService.cleanShadowingSentence("Hãy nghe và nhại lại câu sau: Learning builds confidence."))
                .isEqualTo("Learning builds confidence.");
        assertThat(ExerciseAudioService.cleanShadowingSentence("Câu 3: Fluency develops over time."))
                .isEqualTo("Fluency develops over time.");
        assertThat(ExerciseAudioService.cleanShadowingSentence("1. Speak clearly and naturally."))
                .isEqualTo("Speak clearly and naturally.");
        assertThat(ExerciseAudioService.cleanShadowingSentence("Hãy nghe và lặp lại:\nSmall daily habits create lasting change."))
                .isEqualTo("Small daily habits create lasting change.");
    }

    @Test
    void generateOrGetAudioForQuestion_whenActiveCacheHashMatches_returnsCachedAudioWithoutCallingPython() {
        ExerciseAudioRepository audioRepo = Mockito.mock(ExerciseAudioRepository.class);
        AssignmentQuestionRepository questionRepo = Mockito.mock(AssignmentQuestionRepository.class);
        AssignmentRepository assignmentRepo = Mockito.mock(AssignmentRepository.class);
        ClassStudentRepository classStudentRepo = Mockito.mock(ClassStudentRepository.class);
        DocumentStorageService storage = Mockito.mock(DocumentStorageService.class);

        ExerciseAudioServiceImpl service = new ExerciseAudioServiceImpl(
                audioRepo, questionRepo, assignmentRepo, classStudentRepo,
                storage, new ObjectMapper(), Optional.empty(), 1000, 5000
        );
        ReflectionTestUtils.setField(service, "pythonServiceBaseUrl", "http://kokoro.local");
        RestTemplate rt = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.createServer(rt);

        UUID qId = UUID.randomUUID();
        UUID audioId = UUID.randomUUID();
        Assignment speakingAss = Assignment.builder().id(UUID.randomUUID()).skillType(SkillType.SPEAKING).build();
        AssignmentQuestion question = AssignmentQuestion.builder()
                .id(qId)
                .assignment(speakingAss)
                .promptText("Consistent practice builds fluency.")
                .build();

        byte[] validWav = new byte[2048];
        Arrays.fill(validWav, (byte) 2);
        HttpHeaders wavHeaders = new HttpHeaders();
        wavHeaders.set("X-Audio-Duration", "1.4");
        server.expect(requestTo("http://kokoro.local/tts"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(validWav, MediaType.parseMediaType("audio/wav")).headers(wavHeaders));

        Mockito.when(questionRepo.findById(qId)).thenReturn(Optional.of(question));
        Mockito.when(audioRepo.findByQuestionIdOrderByVersionDesc(qId)).thenReturn(Collections.emptyList());
        Mockito.when(storage.storeAudioFile(Mockito.any())).thenReturn("/audio/cached_v1.wav");

        java.util.concurrent.atomic.AtomicReference<ExerciseAudio> storedRef = new java.util.concurrent.atomic.AtomicReference<>();
        Mockito.when(audioRepo.findByQuestionIdAndIsActiveTrue(qId)).thenAnswer(inv -> Optional.ofNullable(storedRef.get()));
        Mockito.when(audioRepo.save(Mockito.any(ExerciseAudio.class))).thenAnswer(inv -> {
            ExerciseAudio ea = inv.getArgument(0);
            ea.setId(audioId);
            storedRef.set(ea);
            return ea;
        });

        ExerciseAudioResponseDto first = service.generateOrGetAudioForQuestion(qId, AudioGeneratedBy.TEACHER, false, "af_heart");
        server.verify();

        // Second call with identical text & voice must hit cache and NOT invoke Python or storage again
        ExerciseAudioResponseDto cached = service.generateOrGetAudioForQuestion(qId, AudioGeneratedBy.STUDENT_REPAIR, false, "af_heart");

        assertThat(cached.getId()).isEqualTo(first.getId());
        assertThat(cached.getUrl()).isEqualTo("/audio/cached_v1.wav");
        assertThat(cached.getVersion()).isEqualTo(1);
        Mockito.verify(storage, Mockito.times(1)).storeAudioFile(Mockito.any());
    }

    @Test
    void generateOrGetAudioForQuestion_whenScriptBlank_returnsNullWithoutCallingPython() {
        ExerciseAudioRepository audioRepo = Mockito.mock(ExerciseAudioRepository.class);
        AssignmentQuestionRepository questionRepo = Mockito.mock(AssignmentQuestionRepository.class);
        AssignmentRepository assignmentRepo = Mockito.mock(AssignmentRepository.class);
        ClassStudentRepository classStudentRepo = Mockito.mock(ClassStudentRepository.class);
        DocumentStorageService storage = Mockito.mock(DocumentStorageService.class);

        ExerciseAudioServiceImpl service = new ExerciseAudioServiceImpl(
                audioRepo, questionRepo, assignmentRepo, classStudentRepo,
                storage, new ObjectMapper(), Optional.empty(), 1000, 5000
        );

        UUID qId = UUID.randomUUID();
        Assignment listeningAss = Assignment.builder().id(UUID.randomUUID()).skillType(SkillType.LISTENING).build();
        AssignmentQuestion blankQuestion = AssignmentQuestion.builder()
                .id(qId)
                .assignment(listeningAss)
                .promptText("Listen and choose")
                .transcript("   ")
                .build();

        Mockito.when(questionRepo.findById(qId)).thenReturn(Optional.of(blankQuestion));

        ExerciseAudioResponseDto result = service.generateOrGetAudioForQuestion(qId, AudioGeneratedBy.TEACHER, false, null);

        assertThat(result).isNull();
        Mockito.verifyNoInteractions(audioRepo, storage);
    }

    @Test
    void repairAudio_whenEnrolledStudentOrMissingClassroom_forcesRegenerationOrThrows404() {
        ExerciseAudioRepository audioRepo = Mockito.mock(ExerciseAudioRepository.class);
        AssignmentQuestionRepository questionRepo = Mockito.mock(AssignmentQuestionRepository.class);
        AssignmentRepository assignmentRepo = Mockito.mock(AssignmentRepository.class);
        ClassStudentRepository classStudentRepo = Mockito.mock(ClassStudentRepository.class);
        DocumentStorageService storage = Mockito.mock(DocumentStorageService.class);

        ExerciseAudioServiceImpl service = new ExerciseAudioServiceImpl(
                audioRepo, questionRepo, assignmentRepo, classStudentRepo,
                storage, new ObjectMapper(), Optional.empty(), 1000, 5000
        );
        ReflectionTestUtils.setField(service, "pythonServiceBaseUrl", "http://kokoro.local");
        RestTemplate rt = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.createServer(rt);

        UUID qMissingClassId = UUID.randomUUID();
        AssignmentQuestion noClassQ = AssignmentQuestion.builder()
                .id(qMissingClassId)
                .assignment(Assignment.builder().id(UUID.randomUUID()).classroom(null).build())
                .build();
        Mockito.when(questionRepo.findById(qMissingClassId)).thenReturn(Optional.of(noClassQ));
        assertThatThrownBy(() -> service.repairAudio(qMissingClassId, UUID.randomUUID(), true))
                .isInstanceOf(ResourceNotFoundException.class);

        UUID classId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        Assignment speakingAss = Assignment.builder()
                .id(UUID.randomUUID())
                .classroom(Classroom.builder().id(classId).build())
                .skillType(SkillType.SPEAKING)
                .build();
        AssignmentQuestion question = AssignmentQuestion.builder()
                .id(qId)
                .assignment(speakingAss)
                .promptText("Old text")
                .build();

        ExerciseAudio v1 = ExerciseAudio.builder().id(UUID.randomUUID()).questionId(qId).version(1).isActive(true).build();
        Mockito.when(questionRepo.findById(qId)).thenReturn(Optional.of(question));
        Mockito.when(classStudentRepo.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(true);
        Mockito.when(audioRepo.findByQuestionIdOrderByVersionDesc(qId)).thenReturn(List.of(v1));

        byte[] validWav = new byte[2048];
        Arrays.fill(validWav, (byte) 3);
        HttpHeaders wavHeaders = new HttpHeaders();
        wavHeaders.set("X-Audio-Duration", "1.6");
        server.expect(requestTo("http://kokoro.local/tts"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(validWav, MediaType.parseMediaType("audio/wav")).headers(wavHeaders));
        Mockito.when(storage.storeAudioFile(Mockito.any())).thenReturn("/audio/repaired_v2.wav");
        Mockito.when(audioRepo.save(Mockito.any(ExerciseAudio.class))).thenAnswer(inv -> {
            ExerciseAudio ea = inv.getArgument(0);
            if (ea.getId() == null) ea.setId(UUID.randomUUID());
            return ea;
        });

        ExerciseAudioResponseDto repaired = service.repairAudio(
                qId, studentId, true, "Shadow this: \"Custom repaired line.\"", "en-GB-RyanNeural");

        server.verify();
        assertThat(v1.getIsActive()).isFalse();
        assertThat(repaired.getVersion()).isEqualTo(2);
        assertThat(repaired.getUrl()).isEqualTo("/audio/repaired_v2.wav");
        assertThat(repaired.getGeneratedBy()).isEqualTo(AudioGeneratedBy.STUDENT_REPAIR);
        assertThat(question.getMediaUrl()).isEqualTo("/audio/repaired_v2.wav");
        assertThat(question.getTranscript()).isEqualTo("Custom repaired line.");
    }

    @Test
    void synthesizeRawScriptToUrl_whenTimeoutOrNaNSpeed_handlesSafelyAndMapsTimeoutMessage() throws Exception {
        ExerciseAudioRepository audioRepo = Mockito.mock(ExerciseAudioRepository.class);
        AssignmentQuestionRepository questionRepo = Mockito.mock(AssignmentQuestionRepository.class);
        AssignmentRepository assignmentRepo = Mockito.mock(AssignmentRepository.class);
        ClassStudentRepository classStudentRepo = Mockito.mock(ClassStudentRepository.class);
        DocumentStorageService storage = Mockito.mock(DocumentStorageService.class);

        ExerciseAudioServiceImpl service = new ExerciseAudioServiceImpl(
                audioRepo, questionRepo, assignmentRepo, classStudentRepo,
                storage, new ObjectMapper(), Optional.empty(), 1000, 5000
        );
        ReflectionTestUtils.setField(service, "pythonServiceBaseUrl", "http://kokoro.local");
        RestTemplate rt = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.createServer(rt);

        byte[] validWav = new byte[2048];
        Arrays.fill(validWav, (byte) 4);
        HttpHeaders wavHeaders = new HttpHeaders();
        wavHeaders.set("X-Audio-Duration", "1.2");
        server.expect(requestTo("http://kokoro.local/tts"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(validWav, MediaType.parseMediaType("audio/wav")).headers(wavHeaders));
        Mockito.when(storage.storeAudioFile(Mockito.any())).thenReturn("/audio/nan_clamped.wav");

        assertThat(service.synthesizeRawScriptToUrl("Clean sentence", "af_heart", Double.NaN))
                .isEqualTo("/audio/nan_clamped.wav");
        server.verify();

        server.reset();
        server.expect(requestTo("http://kokoro.local/tts"))
                .andRespond(request -> {
                    throw new java.net.SocketTimeoutException("Read timed out");
                });

        assertThatThrownBy(() -> service.synthesizeRawScriptToUrl("Long passage", "af_heart", 1.0))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("thời gian xử lý quá lâu");
    }

    @Test
    void getAudioStatus_whenActiveAudioHasSegmentsOrQuestionMissing_returnsParsedSegmentsOr404() {
        ExerciseAudioRepository audioRepo = Mockito.mock(ExerciseAudioRepository.class);
        AssignmentQuestionRepository questionRepo = Mockito.mock(AssignmentQuestionRepository.class);
        AssignmentRepository assignmentRepo = Mockito.mock(AssignmentRepository.class);
        ClassStudentRepository classStudentRepo = Mockito.mock(ClassStudentRepository.class);
        DocumentStorageService storage = Mockito.mock(DocumentStorageService.class);

        ExerciseAudioServiceImpl service = new ExerciseAudioServiceImpl(
                audioRepo, questionRepo, assignmentRepo, classStudentRepo,
                storage, new ObjectMapper(), Optional.empty(), 1000, 5000
        );

        UUID missingId = UUID.randomUUID();
        Mockito.when(questionRepo.findById(missingId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getAudioStatus(missingId))
                .isInstanceOf(ResourceNotFoundException.class);

        UUID qId = UUID.randomUUID();
        Assignment speakingAss = Assignment.builder().id(UUID.randomUUID()).skillType(SkillType.SPEAKING).build();
        AssignmentQuestion q = AssignmentQuestion.builder().id(qId).assignment(speakingAss).build();
        ExerciseAudio activeAudio = ExerciseAudio.builder()
                .id(UUID.randomUUID())
                .questionId(qId)
                .exerciseType(ExerciseAudioType.SHADOWING)
                .status(AudioGenerationStatus.READY)
                .url("/audio/active.wav")
                .durationMs(1800L)
                .version(2)
                .generatedBy(AudioGeneratedBy.TEACHER)
                .segments("[{\"speaker\":\"Friend A\",\"voice\":\"af_heart\",\"text\":\"Hi\",\"startMs\":0,\"endMs\":900}]")
                .build();

        Mockito.when(questionRepo.findById(qId)).thenReturn(Optional.of(q));
        Mockito.when(audioRepo.findByQuestionIdAndIsActiveTrue(qId)).thenReturn(Optional.of(activeAudio));

        ExerciseAudioResponseDto status = service.getAudioStatus(qId);

        assertThat(status.getStatus()).isEqualTo(AudioGenerationStatus.READY);
        assertThat(status.getVersion()).isEqualTo(2);
        assertThat(status.getSegments()).hasSize(1);
        assertThat(status.getSegments().get(0).getSpeaker()).isEqualTo("Friend A");
    }

    @Test
    void generateAudiosForAssignmentAsync_whenAssignmentMissingOrNullQuestions_exitsSafely() {
        ExerciseAudioRepository audioRepo = Mockito.mock(ExerciseAudioRepository.class);
        AssignmentQuestionRepository questionRepo = Mockito.mock(AssignmentQuestionRepository.class);
        AssignmentRepository assignmentRepo = Mockito.mock(AssignmentRepository.class);
        ClassStudentRepository classStudentRepo = Mockito.mock(ClassStudentRepository.class);
        DocumentStorageService storage = Mockito.mock(DocumentStorageService.class);

        ExerciseAudioServiceImpl service = new ExerciseAudioServiceImpl(
                audioRepo, questionRepo, assignmentRepo, classStudentRepo,
                storage, new ObjectMapper(), Optional.empty(), 1000, 5000
        );

        UUID missingAssId = UUID.randomUUID();
        Mockito.when(assignmentRepo.findById(missingAssId)).thenReturn(Optional.empty());
        service.generateAudiosForAssignmentAsync(missingAssId, AudioGeneratedBy.SYSTEM);

        UUID speakingAssId = UUID.randomUUID();
        Assignment speakingAss = Assignment.builder().id(speakingAssId).skillType(SkillType.SPEAKING).title("Shadow").build();
        Mockito.when(assignmentRepo.findById(speakingAssId)).thenReturn(Optional.of(speakingAss));
        Mockito.when(questionRepo.findByAssignmentId(speakingAssId)).thenReturn(null);
        service.generateAudiosForAssignmentAsync(speakingAssId, AudioGeneratedBy.TEACHER);

        Mockito.verifyNoInteractions(audioRepo, storage);
    }
}

