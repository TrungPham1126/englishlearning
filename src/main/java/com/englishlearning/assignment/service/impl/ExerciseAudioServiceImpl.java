package com.englishlearning.assignment.service.impl;

import com.englishlearning.assignment.dto.ExerciseAudioResponseDto;
import com.englishlearning.assignment.dto.KokoroVoiceDto;
import com.englishlearning.assignment.entity.*;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.repository.ExerciseAudioRepository;
import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.service.DocumentStorageService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class ExerciseAudioServiceImpl implements ExerciseAudioService {

    private final ExerciseAudioRepository exerciseAudioRepository;
    private final AssignmentQuestionRepository assignmentQuestionRepository;
    private final AssignmentRepository assignmentRepository;
    private final ClassStudentRepository classStudentRepository;
    private final DocumentStorageService documentStorageService;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;

    @Value("${python.audio-service.base-url:http://localhost:8000}")
    private String pythonServiceBaseUrl;

    // Concurrency lock map per Question ID to prevent duplicate synthesis stampedes
    private final ConcurrentHashMap<UUID, Object> questionLocks = new ConcurrentHashMap<>();

    // Rate limiter in-memory fallback (in case Redis is temporarily unreachable)
    private final ConcurrentHashMap<String, Instant> cooldownTracker = new ConcurrentHashMap<>();

    public ExerciseAudioServiceImpl(
            ExerciseAudioRepository exerciseAudioRepository,
            AssignmentQuestionRepository assignmentQuestionRepository,
            AssignmentRepository assignmentRepository,
            ClassStudentRepository classStudentRepository,
            DocumentStorageService documentStorageService,
            ObjectMapper objectMapper,
            Optional<StringRedisTemplate> redisTemplate,
            @Value("${python.audio-service.connect-timeout:10000}") int connectTimeout,
            @Value("${python.audio-service.read-timeout:120000}") int readTimeout) {
        this.exerciseAudioRepository = exerciseAudioRepository;
        this.assignmentQuestionRepository = assignmentQuestionRepository;
        this.assignmentRepository = assignmentRepository;
        this.classStudentRepository = classStudentRepository;
        this.documentStorageService = documentStorageService;
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplate.orElse(null);

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public String synthesizeRawScriptToUrl(String rawScript, String preferredVoice, double speed) {
        if (rawScript == null || rawScript.isBlank()) {
            throw new IllegalArgumentException("Nội dung văn bản để tổng hợp âm thanh không được để trống.");
        }

        String normalizedVoice = ExerciseAudioService.normalizeKokoroVoice(preferredVoice);
        double clampedSpeed = Math.max(0.5, Math.min(2.0, speed));

        List<ExerciseAudioService.DialogueTurnParseResult> parsedTurns = ExerciseAudioService.parseDialogueScript(rawScript);
        boolean isDialogue = parsedTurns.size() >= 2;

        File tempAudioFile = null;
        try {
            if (isDialogue) {
                DialogueSynthesisResult diagRes = synthesizeDialogueWithPython(parsedTurns, normalizedVoice, clampedSpeed);
                tempAudioFile = diagRes.tempFile;
                validateGeneratedAudioFile(tempAudioFile, diagRes.durationMs);
            } else {
                String cleanText = parsedTurns.size() == 1
                        ? parsedTurns.get(0).text
                        : ExerciseAudioService.stripSpeakerAndStageDirections(rawScript);
                if (cleanText.isBlank()) {
                    cleanText = rawScript.trim();
                }
                MonologueSynthesisResult monoRes = synthesizeMonologueWithPython(cleanText, normalizedVoice, clampedSpeed);
                tempAudioFile = monoRes.tempFile;
                validateGeneratedAudioFile(tempAudioFile, monoRes.durationMs);
            }
            return documentStorageService.storeAudioFile(tempAudioFile);
        } catch (Exception e) {
            log.error("Lỗi khi tổng hợp audio từ script: {}", e.getMessage(), e);
            String userMsg = isTimeoutException(e)
                    ? "Không thể tạo âm thanh bài nghe do thời gian xử lý quá lâu. Vui lòng thử lại với đoạn nghe ngắn hơn hoặc thử lại sau."
                    : "Không thể tạo âm thanh bài nghe lúc này. Vui lòng thử lại.";
            throw new RuntimeException(userMsg, e);
        } finally {
            if (tempAudioFile != null && tempAudioFile.exists()) {
                try {
                    Files.deleteIfExists(tempAudioFile.toPath());
                } catch (Exception ignored) {}
            }
        }
    }

    @Override
    public ExerciseAudioResponseDto generateOrGetAudioForQuestion(
            UUID questionId,
            AudioGeneratedBy generatedBy,
            boolean forceRecreate,
            String preferredVoice) {
        return generateOrGetAudioForQuestion(questionId, generatedBy, forceRecreate, preferredVoice, null);
    }

    @Override
    public ExerciseAudioResponseDto generateOrGetAudioForQuestion(
            UUID questionId,
            AudioGeneratedBy generatedBy,
            boolean forceRecreate,
            String preferredVoice,
            String customTextOverride) {

        Object lock = questionLocks.computeIfAbsent(questionId, k -> new Object());
        synchronized (lock) {
            AssignmentQuestion question = assignmentQuestionRepository.findById(questionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi với id: " + questionId));

            Assignment assignment = question.getAssignment();
            ExerciseAudioType exerciseType = (assignment.getSkillType() == SkillType.LISTENING)
                    ? ExerciseAudioType.LISTENING
                    : ExerciseAudioType.SHADOWING;

            String scriptText;
            if (customTextOverride != null && !customTextOverride.isBlank() && exerciseType == ExerciseAudioType.SHADOWING) {
                scriptText = ExerciseAudioService.cleanShadowingSentence(customTextOverride);
            } else {
                scriptText = resolveScriptText(question, exerciseType);
            }

            if (scriptText.isBlank()) {
                log.warn("Câu hỏi {} không có nội dung text/transcript để sinh audio.", questionId);
                return null;
            }

            log.info("Generating TTS for text: {} (questionId: {}, type: {})", scriptText, questionId, exerciseType);

            List<ExerciseAudioService.DialogueTurnParseResult> parsedTurns = (exerciseType == ExerciseAudioType.LISTENING)
                    ? ExerciseAudioService.parseDialogueScript(scriptText)
                    : Collections.emptyList();
            boolean isDialogue = (exerciseType == ExerciseAudioType.LISTENING) && parsedTurns.size() >= 2;

            String voiceConfigJson = buildVoiceConfigJson(parsedTurns, isDialogue, preferredVoice);
            String contentHash = computeContentHash(scriptText, voiceConfigJson, isDialogue);

            // Kiểm tra bản ghi âm thanh đang hoạt động (Active Cache check)
            if (!forceRecreate) {
                if (exerciseType == ExerciseAudioType.LISTENING && assignment.getAudioUrl() != null && !assignment.getAudioUrl().isBlank()) {
                    log.info("Sử dụng audio có sẵn trên Assignment cho questionId: {}, url: {}", questionId, assignment.getAudioUrl());
                    return ExerciseAudioResponseDto.builder()
                            .questionId(questionId)
                            .assignmentId(assignment.getId())
                            .status(AudioGenerationStatus.READY)
                            .url(assignment.getAudioUrl())
                            .version(1)
                            .generatedBy(AudioGeneratedBy.SYSTEM)
                            .build();
                }
                Optional<ExerciseAudio> existingActive = exerciseAudioRepository.findByQuestionIdAndIsActiveTrue(questionId);
                if (existingActive.isPresent() && existingActive.get().getStatus() == AudioGenerationStatus.READY) {
                    ExerciseAudio cur = existingActive.get();
                    if (contentHash.equals(cur.getContentHash()) && cur.getUrl() != null && !cur.getUrl().isBlank()) {
                        log.info("Sử dụng audio có sẵn (Cache Hit) cho questionId: {}, url: {}", questionId, cur.getUrl());
                        return toDto(cur);
                    }
                }
            }

            log.info("Bắt đầu sinh audio Kokoro-82M cho questionId: {}, type: {}, isDialogue: {}, generatedBy: {}",
                    questionId, exerciseType, isDialogue, generatedBy);

            File tempAudioFile = null;
            try {
                int nextVersion = getNextVersion(questionId);
                Long durationMs;
                String segmentsJson = null;

                if (isDialogue) {
                    DialogueSynthesisResult diagRes = synthesizeDialogueWithPython(parsedTurns, preferredVoice, 1.0);
                    tempAudioFile = diagRes.tempFile;
                    durationMs = diagRes.durationMs;
                    segmentsJson = diagRes.segmentsJson;
                } else {
                    String monoText = parsedTurns.size() == 1
                            ? parsedTurns.get(0).text
                            : ExerciseAudioService.stripSpeakerAndStageDirections(scriptText);
                    if (monoText.isBlank()) {
                        monoText = scriptText;
                    }
                    MonologueSynthesisResult monoRes = synthesizeMonologueWithPython(monoText, preferredVoice, 1.0);
                    tempAudioFile = monoRes.tempFile;
                    durationMs = monoRes.durationMs;
                }

                // Kiểm tra tính toàn vẹn (Validation) của tệp âm thanh
                validateGeneratedAudioFile(tempAudioFile, durationMs);

                // Lưu trữ audio lâu dài lên Cloudflare R2 / S3 (hoặc fallback cục bộ)
                String storedAudioUrl = documentStorageService.storeAudioFile(tempAudioFile);
                log.info("Lưu trữ audio thành công cho questionId: {}. URL: {}", questionId, storedAudioUrl);

                // Thay thế nguyên tử bản ghi Active
                deactivateOldAudios(questionId);

                ExerciseAudio newAudio = ExerciseAudio.builder()
                        .exerciseType(exerciseType)
                        .assignmentId(assignment.getId())
                        .questionId(questionId)
                        .contentHash(contentHash)
                        .voiceConfig(voiceConfigJson)
                        .status(AudioGenerationStatus.READY)
                        .isActive(true)
                        .url(storedAudioUrl)
                        .durationMs(durationMs)
                        .segments(segmentsJson)
                        .version(nextVersion)
                        .generatedBy(generatedBy)
                        .errorMessage(null)
                        .build();

                ExerciseAudio savedAudio = exerciseAudioRepository.save(newAudio);

                // Cập nhật lại mediaUrl và transcript chuẩn cho AssignmentQuestion
                question.setMediaUrl(storedAudioUrl);
                if (exerciseType == ExerciseAudioType.SHADOWING && !scriptText.isBlank()) {
                    question.setTranscript(scriptText);
                } else if (isDialogue && (question.getTranscript() == null || question.getTranscript().isBlank())) {
                    question.setTranscript(scriptText);
                }
                assignmentQuestionRepository.save(question);

                if (exerciseType == ExerciseAudioType.LISTENING) {
                    assignment.setAudioUrl(storedAudioUrl);
                    if (assignment.getListeningScript() == null || assignment.getListeningScript().isBlank()) {
                        assignment.setListeningScript(scriptText);
                    }
                    assignmentRepository.save(assignment);
                }

                // Làm mới cache Redis
                cacheAudioInRedis(questionId, savedAudio);

                return toDto(savedAudio);

            } catch (Exception e) {
                log.error("Lỗi khi sinh audio Kokoro-82M cho questionId: {}: {}", questionId, e.getMessage(), e);

                // Ghi nhận bản ghi lỗi để hệ thống theo dõi
                ExerciseAudio failedAudio = ExerciseAudio.builder()
                        .exerciseType(exerciseType)
                        .assignmentId(assignment.getId())
                        .questionId(questionId)
                        .contentHash(contentHash)
                        .voiceConfig(voiceConfigJson)
                        .status(AudioGenerationStatus.FAILED)
                        .isActive(false)
                        .version(getNextVersion(questionId))
                        .generatedBy(generatedBy)
                        .errorMessage(e.getMessage())
                        .build();
                exerciseAudioRepository.save(failedAudio);

                String userMsg = isTimeoutException(e)
                        ? "Không thể tạo âm thanh bài nghe do thời gian xử lý quá lâu. Vui lòng thử lại."
                        : "Không thể tạo âm thanh bài nghe lúc này. Vui lòng thử lại.";
                throw new RuntimeException(userMsg, e);
            } finally {
                if (tempAudioFile != null && tempAudioFile.exists()) {
                    try {
                        Files.deleteIfExists(tempAudioFile.toPath());
                    } catch (Exception ignored) {}
                }
            }
        }
    }

    @Override
    @Async
    public void generateAudiosForAssignmentAsync(UUID assignmentId, AudioGeneratedBy generatedBy) {
        log.info("Kích hoạt job chạy ngầm sinh audio cho toàn bộ bài tập ID: {}", assignmentId);
        com.englishlearning.assignment.entity.Assignment assignment = assignmentRepository.findById(assignmentId).orElse(null);
        if (assignment == null) return;

        if (assignment.getSkillType() == SkillType.LISTENING) {
            String script = assignment.getListeningScript();
            if ((script == null || script.isBlank()) && assignment.getQuestions() != null) {
                script = assignment.getQuestions().stream()
                        .map(AssignmentQuestion::getTranscript)
                        .filter(t -> t != null && !t.isBlank())
                        .findFirst().orElse(null);
            }
            if ((script == null || script.isBlank()) && assignment.getDescription() != null) {
                String desc = assignment.getDescription();
                if (desc.toUpperCase().contains("LISTENING SCRIPT") || desc.toUpperCase().contains("PASSAGE")) {
                    String[] parts = desc.split("(?i)\\[?(?:LISTENING SCRIPT|PASSAGE)\\]?:?");
                    if (parts.length > 1) {
                        script = parts[1].split("\\n\\s*\\[")[0].trim();
                    }
                }
            }
            if (script != null && !script.isBlank() && (assignment.getAudioUrl() == null || assignment.getAudioUrl().isBlank())) {
                try {
                    log.info("Sinh audio cho bài LISTENING ID: {}", assignmentId);
                    String audioUrl = synthesizeRawScriptToUrl(script, "af_heart", 1.0);
                    if (audioUrl != null && !audioUrl.isBlank()) {
                        assignment.setAudioUrl(audioUrl);
                        if (assignment.getListeningScript() == null || assignment.getListeningScript().isBlank()) {
                            assignment.setListeningScript(script);
                        }
                        assignmentRepository.save(assignment);
                    }
                } catch (Exception ex) {
                    log.warn("Không thể sinh audio cho bài nghe LISTENING ID {}: {}", assignmentId, ex.getMessage());
                }
            }
            return;
        }

        List<AssignmentQuestion> questions = assignmentQuestionRepository.findByAssignmentId(assignmentId);
        for (AssignmentQuestion q : questions) {
            try {
                generateOrGetAudioForQuestion(q.getId(), generatedBy, false, null);
            } catch (Exception ex) {
                log.warn("Không thể sinh audio chạy ngầm cho question {}: {}", q.getId(), ex.getMessage());
            }
        }
        log.info("Hoàn tất job sinh audio chạy ngầm cho bài tập ID: {}", assignmentId);
    }

    @Override
    @Transactional
    public ExerciseAudioResponseDto repairAudio(UUID questionId, UUID requestingUserId, boolean isStudent) {
        return repairAudio(questionId, requestingUserId, isStudent, null, null);
    }

    @Override
    @Transactional
    public ExerciseAudioResponseDto repairAudio(
            UUID questionId,
            UUID requestingUserId,
            boolean isStudent,
            String customText,
            String customVoice) {
        AssignmentQuestion question = assignmentQuestionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi với id: " + questionId));

        UUID classroomId = question.getAssignment().getClassroom().getId();

        // 1. Kiểm tra quyền sở hữu bài tập
        if (isStudent) {
            boolean isEnrolled = classStudentRepository.existsByClassroomIdAndStudentId(classroomId, requestingUserId);
            if (!isEnrolled) {
                log.warn("Học sinh {} cố gắng repair bài tập của lớp {} mà không thuộc lớp này", requestingUserId, classroomId);
                throw new AccessDeniedException("Bạn không thuộc lớp học được giao bài tập này.");
            }
        }

        log.info("Tiến hành REPAIR audio cho questionId: {} do user: {} yêu cầu (customText: {}, voice: {})",
                questionId, requestingUserId, customText, customVoice);

        // 2. Thực hiện tái sinh audio cưỡng bức (forceRecreate = true) và ghi đè URL mới vào DB
        return generateOrGetAudioForQuestion(
                questionId,
                isStudent ? AudioGeneratedBy.STUDENT_REPAIR : AudioGeneratedBy.TEACHER,
                true,
                customVoice,
                customText
        );
    }

    @Override
    public ExerciseAudioResponseDto getAudioStatus(UUID questionId) {
        AssignmentQuestion q = assignmentQuestionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question not found: " + questionId));

        Assignment assignment = q.getAssignment();
        if (assignment != null && assignment.getSkillType() == SkillType.LISTENING) {
            if (assignment.getAudioUrl() != null && !assignment.getAudioUrl().isBlank()) {
                return ExerciseAudioResponseDto.builder()
                        .questionId(questionId)
                        .assignmentId(assignment.getId())
                        .status(AudioGenerationStatus.READY)
                        .url(assignment.getAudioUrl())
                        .durationMs(0L)
                        .version(1)
                        .generatedBy(AudioGeneratedBy.SYSTEM)
                        .build();
            }
        }

        Optional<ExerciseAudio> activeOpt = exerciseAudioRepository.findByQuestionIdAndIsActiveTrue(questionId);
        if (activeOpt.isPresent()) {
            return toDto(activeOpt.get());
        }

        if (q.getMediaUrl() != null && !q.getMediaUrl().isBlank() && (assignment == null || assignment.getSkillType() != SkillType.LISTENING)) {
            return ExerciseAudioResponseDto.builder()
                    .questionId(questionId)
                    .assignmentId(assignment != null ? assignment.getId() : null)
                    .status(AudioGenerationStatus.READY)
                    .url(q.getMediaUrl())
                    .durationMs(0L)
                    .version(1)
                    .generatedBy(AudioGeneratedBy.SYSTEM)
                    .build();
        }

        return ExerciseAudioResponseDto.builder()
                .questionId(questionId)
                .assignmentId(assignment != null ? assignment.getId() : null)
                .status(AudioGenerationStatus.PENDING)
                .version(0)
                .build();
    }

    @Override
    public List<KokoroVoiceDto> getKokoroVoices() {
        String url = pythonServiceBaseUrl + "/tts/voices";
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(url, String.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                return objectMapper.readValue(resp.getBody(), new TypeReference<List<KokoroVoiceDto>>() {});
            }
        } catch (Exception ex) {
            log.warn("Không thể lấy danh sách giọng từ Python service: {}. Sử dụng danh mục dự phòng.", ex.getMessage());
        }

        return List.of(
                KokoroVoiceDto.builder().id("af_heart").name("Heart (US Female)").accent("en-US").gender("Female").description("Giọng nữ Mỹ truyền cảm, tự nhiên").isDefault(true).build(),
                KokoroVoiceDto.builder().id("am_michael").name("Michael (US Male)").accent("en-US").gender("Male").description("Giọng nam Mỹ trầm ấm, chuẩn mực").isDefault(false).build(),
                KokoroVoiceDto.builder().id("bf_emma").name("Emma (UK Female)").accent("en-GB").gender("Female").description("Giọng nữ Anh RP chuẩn").isDefault(false).build(),
                KokoroVoiceDto.builder().id("bm_george").name("George (UK Male)").accent("en-GB").gender("Male").description("Giọng nam Anh BBC chuẩn").isDefault(false).build()
        );
    }

    // =========================================================================
    // PRIVATE INTERNAL HELPERS
    // =========================================================================

    private String resolveScriptText(AssignmentQuestion question, ExerciseAudioType exerciseType) {
        if (exerciseType == ExerciseAudioType.LISTENING) {
            Assignment assignment = question.getAssignment();
            if (assignment != null) {
                if (assignment.getListeningScript() != null && !assignment.getListeningScript().isBlank()) {
                    return assignment.getListeningScript().trim();
                }
                if (assignment.getDescription() != null && !assignment.getDescription().isBlank()) {
                    String desc = assignment.getDescription();
                    if (desc.toUpperCase().contains("LISTENING SCRIPT") || desc.toUpperCase().contains("PASSAGE")) {
                        String[] parts = desc.split("(?i)\\[?(?:LISTENING SCRIPT|PASSAGE)\\]?:?");
                        if (parts.length > 1) {
                            String p = parts[1].split("\\n\\s*\\[")[0].trim();
                            if (!p.isBlank()) return p;
                        }
                    }
                }
            }
            if (question.getTranscript() != null && !question.getTranscript().isBlank()) {
                return question.getTranscript().trim();
            }
            return "";
        }

        return ExerciseAudioService.extractCleanShadowingSentence(question);
    }

    private MonologueSynthesisResult synthesizeMonologueWithPython(String text, String preferredVoice, double speed) throws Exception {
        String url = pythonServiceBaseUrl + "/tts";
        String voice = ExerciseAudioService.normalizeKokoroVoice(preferredVoice);
        String cleanSpokenText = ExerciseAudioService.stripSpeakerAndStageDirections(text);
        if (cleanSpokenText.isBlank()) {
            cleanSpokenText = text.trim();
        }

        Map<String, Object> req = Map.of(
                "text", cleanSpokenText,
                "voice", voice,
                "speed", speed
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.parseMediaType("audio/wav")));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(req, headers);
        ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.POST, entity, byte[].class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Python TTS endpoint trả về mã lỗi: " + response.getStatusCode());
        }

        byte[] wavBytes = response.getBody();
        String durHeader = response.getHeaders().getFirst("X-Audio-Duration");
        long durationMs = 0L;
        if (durHeader != null) {
            try {
                durationMs = (long) (Double.parseDouble(durHeader) * 1000);
            } catch (Exception ignored) {}
        }
        if (durationMs <= 0 && wavBytes.length > 44) {
            durationMs = Math.round(((wavBytes.length - 44) / 48000.0) * 1000);
        }

        Path tempDir = Files.createTempDirectory("kokoro_tts_");
        File tempFile = tempDir.resolve("mono_" + UUID.randomUUID() + ".wav").toFile();
        try (FileOutputStream fos = new FileOutputStream(tempFile)) {
            fos.write(wavBytes);
        }

        return new MonologueSynthesisResult(tempFile, durationMs);
    }

    private DialogueSynthesisResult synthesizeDialogueWithPython(
            List<ExerciseAudioService.DialogueTurnParseResult> turns,
            String preferredVoice,
            double speed) throws Exception {

        String url = pythonServiceBaseUrl + "/tts/dialogue";

        Map<String, String> speakerVoiceMap = ExerciseAudioService.buildSpeakerVoiceMap(turns);

        List<Map<String, Object>> turnsPayload = new ArrayList<>();
        for (ExerciseAudioService.DialogueTurnParseResult t : turns) {
            String cleanUtterance = ExerciseAudioService.stripSpeakerAndStageDirections(t.text);
            if (cleanUtterance.isBlank()) continue;
            turnsPayload.add(Map.of(
                    "speaker", t.speaker,
                    "text", cleanUtterance,
                    "voice", speakerVoiceMap.getOrDefault(t.speaker.toUpperCase(), ExerciseAudioService.DEFAULT_SHADOWING_VOICE),
                    "speed", speed
            ));
        }

        Map<String, Object> req = Map.of(
                "turns", turnsPayload,
                "interTurnPauseMs", 450
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(req, headers);
        ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Python Dialogue TTS endpoint trả về lỗi: " + response.getStatusCode());
        }

        JsonNode root = objectMapper.readTree(response.getBody());
        long durationMs = root.path("durationMs").asLong(0L);
        String audioBase64 = root.path("audioBase64").asText("");
        JsonNode segmentsNode = root.path("segments");
        String segmentsJson = (segmentsNode != null && !segmentsNode.isMissingNode()) ? segmentsNode.toString() : "[]";

        byte[] wavBytes = Base64.getDecoder().decode(audioBase64);
        Path tempDir = Files.createTempDirectory("kokoro_diag_");
        File tempFile = tempDir.resolve("dialogue_" + UUID.randomUUID() + ".wav").toFile();
        try (FileOutputStream fos = new FileOutputStream(tempFile)) {
            fos.write(wavBytes);
        }

        return new DialogueSynthesisResult(tempFile, durationMs, segmentsJson);
    }

    private void validateGeneratedAudioFile(File file, Long durationMs) {
        if (file == null || !file.exists() || file.length() < 1000) {
            throw new IllegalStateException("Tệp âm thanh sinh ra bị rỗng hoặc dung lượng quá nhỏ (< 1KB).");
        }
        if (durationMs != null && durationMs < 300) {
            throw new IllegalStateException("Thời lượng âm thanh quá ngắn (< 300ms), nghi ngờ bị im lặng hoặc lỗi phát âm.");
        }
    }

    private void deactivateOldAudios(UUID questionId) {
        List<ExerciseAudio> audios = exerciseAudioRepository.findByQuestionIdOrderByVersionDesc(questionId);
        for (ExerciseAudio a : audios) {
            if (Boolean.TRUE.equals(a.getIsActive())) {
                a.setIsActive(false);
                exerciseAudioRepository.save(a);
            }
        }
    }

    private int getNextVersion(UUID questionId) {
        List<ExerciseAudio> audios = exerciseAudioRepository.findByQuestionIdOrderByVersionDesc(questionId);
        if (audios.isEmpty()) return 1;
        return audios.get(0).getVersion() + 1;
    }

    private String buildVoiceConfigJson(List<ExerciseAudioService.DialogueTurnParseResult> turns, boolean isDialogue, String preferredVoice) {
        try {
            if (isDialogue) {
                Map<String, String> spkMap = ExerciseAudioService.buildSpeakerVoiceMap(turns);
                return objectMapper.writeValueAsString(Map.of("dialogue", true, "speakers", spkMap));
            } else {
                String v = ExerciseAudioService.normalizeKokoroVoice(preferredVoice);
                return objectMapper.writeValueAsString(Map.of("dialogue", false, "voice", v, "speed", 1.0));
            }
        } catch (Exception e) {
            return "{}";
        }
    }

    private String computeContentHash(String text, String voiceConfig, boolean isDialogue) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String payload = "kokoro-v0.9.5|" + (isDialogue ? "dialogue|" : "mono|") + text.trim().toLowerCase() + "|" + voiceConfig;
            byte[] hash = digest.digest(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return UUID.randomUUID().toString().replace("-", "");
        }
    }

    private void cacheAudioInRedis(UUID questionId, ExerciseAudio audio) {
        if (redisTemplate != null) {
            try {
                String cacheKey = "exercise_audio:" + questionId;
                String json = objectMapper.writeValueAsString(toDto(audio));
                redisTemplate.opsForValue().set(cacheKey, json, Duration.ofHours(2));
            } catch (Exception ex) {
                log.warn("Không thể lưu cache Redis cho questionId {}: {}", questionId, ex.getMessage());
            }
        }
    }

    private ExerciseAudioResponseDto toDto(ExerciseAudio a) {
        List<ExerciseAudioResponseDto.DialogueSegmentDto> segs = new ArrayList<>();
        if (a.getSegments() != null && !a.getSegments().isBlank()) {
            try {
                segs = objectMapper.readValue(a.getSegments(), new TypeReference<List<ExerciseAudioResponseDto.DialogueSegmentDto>>() {});
            } catch (Exception ignored) {}
        }

        return ExerciseAudioResponseDto.builder()
                .id(a.getId())
                .exerciseType(a.getExerciseType())
                .assignmentId(a.getAssignmentId())
                .questionId(a.getQuestionId())
                .status(a.getStatus())
                .url(a.getUrl())
                .durationMs(a.getDurationMs())
                .version(a.getVersion())
                .generatedBy(a.getGeneratedBy())
                .errorMessage(a.getErrorMessage())
                .segments(segs)
                .updatedAt(a.getUpdatedAt())
                .build();
    }

    private static class MonologueSynthesisResult {
        File tempFile;
        Long durationMs;
        MonologueSynthesisResult(File tempFile, Long durationMs) {
            this.tempFile = tempFile;
            this.durationMs = durationMs;
        }
    }

    private static class DialogueSynthesisResult {
        File tempFile;
        Long durationMs;
        String segmentsJson;
        DialogueSynthesisResult(File tempFile, Long durationMs, String segmentsJson) {
            this.tempFile = tempFile;
            this.durationMs = durationMs;
            this.segmentsJson = segmentsJson;
        }
    }

    private boolean isTimeoutException(Throwable t) {
        if (t == null) return false;
        String msg = t.getMessage() != null ? t.getMessage().toLowerCase() : "";
        if (msg.contains("timed out") || msg.contains("timeout") || msg.contains("sockettimeoutexception")) {
            return true;
        }
        return isTimeoutException(t.getCause());
    }
}
