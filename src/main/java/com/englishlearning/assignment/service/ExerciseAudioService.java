package com.englishlearning.assignment.service;

import com.englishlearning.assignment.dto.ExerciseAudioResponseDto;
import com.englishlearning.assignment.dto.KokoroVoiceDto;
import com.englishlearning.assignment.entity.*;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.repository.ExerciseAudioRepository;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class ExerciseAudioService {

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

    private static final String DEFAULT_SHADOWING_VOICE = "af_heart";
    private static final List<String> DIALOGUE_VOICE_ROTATION = List.of(
            "af_heart",   // Speaker 1: US Nữ (Truyền cảm, tự nhiên)
            "am_michael", // Speaker 2: US Nam (Trầm ấm, rõ ràng)
            "bf_emma",    // Speaker 3: UK Nữ (Chuẩn Received Pronunciation)
            "bm_george"   // Speaker 4: UK Nam (Chuẩn BBC)
    );

    private static final Pattern DIALOGUE_LINE_PATTERN = Pattern.compile(
            "^(?:[-*•]+|\\d+[.)])?\\s*(?:\\*{1,2}|_)?(?:\\[\\s*([A-Za-z0-9_.\\-\\s]{1,30})\\s*\\]|([A-Za-z0-9_.\\-\\s]{1,30})(?:\\s*\\([^)]{1,25}\\))?)(?:\\*{1,2}|_)?\\s*:\\s*(?:\\*{1,2}|_)?\\s*(.+)$"
    );

    private static final Pattern INLINE_SPEAKER_SPLIT_PATTERN = Pattern.compile(
            "(?<=\\.|\\?|!)\\s+(?=(?:\\*{1,2}|_)?(?:Friend\\s+[A-Z0-9]|Speaker\\s+[A-Z0-9]|Person\\s+[A-Z0-9]|Student\\s+[A-Z0-9]|Man|Woman|Boy|Girl|Receptionist|Customer|Interviewer|Candidate|Teacher|Professor|Waiter|Waitress|Doctor|Patient|[A-Z][a-z]{2,15})(?:\\*{1,2}|_)?\\s*:)"
    );

    private static final Set<String> FEMALE_KEYWORDS = Set.of(
            "woman", "girl", "female", "lady", "mother", "mom", "mum", "sister", "daughter", "wife",
            "mrs", "ms", "miss", "madam", "waitress", "actress", "hostess", "nurse", "receptionist",
            "alice", "sarah", "emma", "anna", "mary", "lisa", "jane", "emily", "sophia", "olivia",
            "bella", "heart", "claire", "lucy", "hannah", "rachel", "kate", "katie", "jessica", "amy", "linda", "susan", "maria", "elena"
    );

    private static final Set<String> MALE_KEYWORDS = Set.of(
            "man", "boy", "male", "gentleman", "father", "dad", "brother", "son", "husband",
            "mr", "sir", "waiter", "actor", "host", "policeman", "manager",
            "bob", "john", "michael", "david", "tom", "james", "robert", "william", "richard",
            "charles", "thomas", "daniel", "matthew", "mark", "paul", "steven", "kevin", "brian",
            "george", "adam", "alex", "ben", "jack", "sam", "peter", "chris", "eric", "nick", "ryan"
    );

    private static final List<String> FEMALE_VOICE_POOL = List.of("af_heart", "bf_emma", "af_bella");
    private static final List<String> MALE_VOICE_POOL = List.of("am_michael", "bm_george", "am_adam");

    public ExerciseAudioService(
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

    /**
     * Tổng hợp trực tiếp văn bản hoặc kịch bản hội thoại thành URL audio lưu trữ trên R2/Local.
     * Tự động nhận diện kịch bản hội thoại đa nhân vật (Friend A / Friend B) hoặc đọc đơn (Monologue)
     * và loại bỏ hoàn toàn nhãn người nói để không bao giờ đọc to "Friend A", "Friend B".
     */
    public String synthesizeRawScriptToUrl(String rawScript, String preferredVoice, double speed) {
        if (rawScript == null || rawScript.isBlank()) {
            throw new IllegalArgumentException("Nội dung văn bản để tổng hợp âm thanh không được để trống.");
        }

        String normalizedVoice = normalizeKokoroVoice(preferredVoice);
        double clampedSpeed = Math.max(0.5, Math.min(2.0, speed));

        List<DialogueTurnParseResult> parsedTurns = parseDialogueScript(rawScript);
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
                        : stripSpeakerAndStageDirections(rawScript);
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

    public static String normalizeKokoroVoice(String voice) {
        if (voice == null || voice.isBlank()) {
            return DEFAULT_SHADOWING_VOICE;
        }
        String v = voice.trim();
        return switch (v) {
            case "af_heart", "am_michael", "af_bella", "am_adam", "bf_emma", "bm_george" -> v;
            case "en-US-JennyNeural" -> "af_heart";
            case "en-US-GuyNeural" -> "am_michael";
            case "en-GB-SoniaNeural" -> "bf_emma";
            case "en-GB-RyanNeural" -> "bm_george";
            default -> DEFAULT_SHADOWING_VOICE;
        };
    }

    /**
     * Sinh hoặc lấy âm thanh Kokoro-82M chuẩn cho câu hỏi/bài tập.
     */
    public ExerciseAudioResponseDto generateOrGetAudioForQuestion(
            UUID questionId,
            AudioGeneratedBy generatedBy,
            boolean forceRecreate,
            String preferredVoice) {

        Object lock = questionLocks.computeIfAbsent(questionId, k -> new Object());
        synchronized (lock) {
            AssignmentQuestion question = assignmentQuestionRepository.findById(questionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi với id: " + questionId));

            Assignment assignment = question.getAssignment();
            ExerciseAudioType exerciseType = (assignment.getSkillType() == SkillType.LISTENING)
                    ? ExerciseAudioType.LISTENING
                    : ExerciseAudioType.SHADOWING;

            String scriptText = resolveScriptText(question, exerciseType);
            if (scriptText.isBlank()) {
                log.warn("Câu hỏi {} không có nội dung text/transcript để sinh audio.", questionId);
                return null;
            }

            List<DialogueTurnParseResult> parsedTurns = (exerciseType == ExerciseAudioType.LISTENING)
                    ? parseDialogueScript(scriptText)
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
                            : stripSpeakerAndStageDirections(scriptText);
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

                // Cập nhật lại mediaUrl cho AssignmentQuestion
                question.setMediaUrl(storedAudioUrl);
                if (isDialogue && (question.getTranscript() == null || question.getTranscript().isBlank())) {
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

    /**
     * Tự động sinh audio chạy ngầm cho tất cả câu hỏi trong bài tập (Background Async Job)
     */
    @Async
    public void generateAudiosForAssignmentAsync(UUID assignmentId, AudioGeneratedBy generatedBy) {
        log.info("Kích hoạt job chạy ngầm sinh audio cho toàn bộ bài tập ID: {}", assignmentId);
        com.englishlearning.assignment.entity.Assignment assignment = assignmentRepository.findById(assignmentId).orElse(null);
        if (assignment == null) return;

        // Nếu là bài LISTENING: Chỉ sinh 1 file audio duy nhất cho toàn bài (listeningScript)
        // và lưu vào assignment.audioUrl, KHÔNG sinh 10 file nhân bản cho 10 câu hỏi!
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

    /**
     * Tự phục hồi khi audio bị lỗi (Học sinh hoặc Giáo viên bấm tạo lại)
     * Đảm bảo xác thực quyền, chống spam và thay thế nguyên tử.
     */
    @Transactional
    public ExerciseAudioResponseDto repairAudio(UUID questionId, UUID requestingUserId, boolean isStudent) {
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

        // 2. Chống lạm dụng & Rate Limiting (60 giây cooldown theo câu hỏi)
        String cooldownKey = "repair_cd:" + questionId;
        String userQuotaKey = "repair_user:" + requestingUserId;

        boolean checkedViaRedis = false;
        if (redisTemplate != null) {
            try {
                Boolean cdSet = redisTemplate.opsForValue().setIfAbsent(cooldownKey, "1", Duration.ofSeconds(45));
                if (Boolean.FALSE.equals(cdSet)) {
                    throw new IllegalStateException("Audio của câu này vừa được yêu cầu tạo lại. Vui lòng chờ 45 giây trước khi thử lại.");
                }
                Long count = redisTemplate.opsForValue().increment(userQuotaKey);
                if (count != null && count == 1) {
                    redisTemplate.expire(userQuotaKey, Duration.ofMinutes(5));
                } else if (count != null && count > 10) {
                    throw new IllegalStateException("Bạn đã tạo lại audio quá 10 lần trong 5 phút. Vui lòng thử lại sau.");
                }
                checkedViaRedis = true;
            } catch (IllegalStateException e) {
                throw e;
            } catch (Exception ex) {
                log.warn("Không thể kết nối Redis để kiểm tra cooldown/quota, fallback sang in-memory: {}", ex.getMessage());
            }
        }

        if (!checkedViaRedis) {
            Instant lastRequest = cooldownTracker.get(cooldownKey);
            if (lastRequest != null && Instant.now().isBefore(lastRequest.plusSeconds(45))) {
                throw new IllegalStateException("Audio vừa được yêu cầu tạo lại. Vui lòng chờ 45 giây.");
            }
            cooldownTracker.put(cooldownKey, Instant.now());
        }

        log.info("Tiến hành REPAIR audio cho questionId: {} do user: {} yêu cầu", questionId, requestingUserId);

        // 3. Thực hiện tái sinh audio cưỡng bức
        return generateOrGetAudioForQuestion(
                questionId,
                isStudent ? AudioGeneratedBy.STUDENT_REPAIR : AudioGeneratedBy.TEACHER,
                true,
                null
        );
    }

    /**
     * Tra cứu trạng thái và siêu dữ liệu âm thanh của câu hỏi
     */
    public ExerciseAudioResponseDto getAudioStatus(UUID questionId) {
        AssignmentQuestion q = assignmentQuestionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question not found: " + questionId));

        // Đối với bài LISTENING: Ưu tiên tuyệt đối audio ở cấp bài nghe (Assignment)
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

    /**
     * Danh sách các giọng Kokoro-82M được hỗ trợ
     */
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
            // Tuyệt đối KHÔNG trả về promptText câu hỏi trắc nghiệm cho bài Listening
            return "";
        }

        // Với Shadowing: CHỈ ĐỌC DUY NHẤT CÂU MẪU CẦN LUYỆN NÓI
        return extractCleanShadowingSentence(question);
    }

    public static String extractCleanShadowingSentence(AssignmentQuestion question) {
        if (question == null) return "";

        // 1. Ưu tiên lấy correctAnswer nếu đã có câu chuẩn
        String ans = question.getCorrectAnswer();
        if (ans != null && !ans.isBlank()
                && !ans.toLowerCase().contains("answer should")
                && !ans.toLowerCase().contains("tùy chọn")
                && !ans.toLowerCase().contains("presentation response")) {
            String cleanedAns = cleanShadowingSentence(ans);
            if (!cleanedAns.isBlank()) {
                return cleanedAns;
            }
        }

        // 2. Trích xuất câu mục tiêu duy nhất từ promptText
        String prompt = question.getPromptText();
        if (prompt != null && !prompt.isBlank()) {
            return cleanShadowingSentence(prompt);
        }

        return "";
    }

    public static String cleanShadowingSentence(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String s = raw.trim();

        // 1. Trích xuất nội dung trong dấu ngoặc kép/đơn ("...", “...”, '...')
        Pattern quotePattern = Pattern.compile("[\"'“‘]([^\"'”’]{4,})[\"'”’]");
        Matcher matcher = quotePattern.matcher(s);
        if (matcher.find()) {
            String inside = matcher.group(1).trim();
            if (inside.split("\\s+").length >= 2 || inside.length() >= 8) {
                s = inside;
            }
        } else if (s.contains(":")) {
            // 2. Lấy phần sau dấu hai chấm nếu dấu hai chấm dùng cho câu chỉ dẫn
            String[] parts = s.split(":");
            String lastPart = parts[parts.length - 1].trim();
            if (!lastPart.isBlank() && (lastPart.split("\\s+").length >= 2 || lastPart.length() >= 8)) {
                s = lastPart;
            }
        }

        // 3. Loại bỏ các tiền tố chỉ dẫn bằng Tiếng Anh và Tiếng Việt
        s = s.replaceAll("(?i)^(?:please\\s+)?(?:listen\\s+(?:and|&|\\+)\\s+(?:repeat|shadow)|repeat\\s+after\\s+(?:me|the\\s+speaker)|shadow(?:ing)?(?:\\s+practice(?:\\s*\\d+)?)?(?:\\s+the\\s+following)?(?:\\s+sentence)?|read\\s+aloud|imitate\\s+the\\s+sentence|practice\\s+saying)[:\\s\\-–—]+", "");
        s = s.replaceAll("(?i)^(?:hãy\\s+)?(?:nghe\\s+(?:và|&)\\s+(?:nhại|lặp)\\s+lại|nhại\\s+(?:theo|giọng|lại)|đọc\\s+(?:theo|lại)|luyện\\s+phát\\s+âm)(?:\\s+chính\\s+xác(?:\\s+ngữ\\s+điệu)?)?(?:\\s+câu(?:\\s+sau)?)?[:\\s\\-–—]+", "");
        s = s.replaceAll("(?i)^(?:question|câu)\\s*\\d+[:\\s.\\-–—]+", "");
        s = s.replaceAll("^\\d+[\\.\\)\\-–—]\\s*", "");

        // 4. Xóa các dấu ngoặc kép bao quanh hoặc ký tự thừa ở 2 đầu
        s = s.replaceAll("^[\"'“‘«\\s]+|[\"'”’»\\s]+$", "").trim();

        // 5. Nếu còn nhiều dòng, lấy dòng tiếng Anh thực thụ
        if (s.contains("\n")) {
            String[] lines = s.split("\\r?\\n");
            for (int i = lines.length - 1; i >= 0; i--) {
                String line = lines[i].trim();
                if (!line.isBlank() && !line.toLowerCase().matches(".*(hãy|lặp lại|nghe|shadow|repeat).*")) {
                    s = line.replaceAll("^[\"'“‘«\\s]+|[\"'”’»\\s]+$", "").trim();
                    break;
                }
            }
        }

        return s;
    }

    /**
     * Loại bỏ hoàn toàn nhãn người nói (Friend A:, Speaker 1:, **Man:**), chỉ dẫn sân khấu ((laughs), [music])
     * và ký tự Markdown trên TỪNG DÒNG để văn bản gửi xuống TTS chỉ còn nội dung thoại thuần túy.
     */
    public static String stripSpeakerAndStageDirections(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String normalized = INLINE_SPEAKER_SPLIT_PATTERN.matcher(raw.trim()).replaceAll("\n");
        String[] lines = normalized.split("\\r?\\n");
        List<String> cleanedLines = new ArrayList<>();
        for (String rawLine : lines) {
            String s = rawLine.trim();
            if (s.isBlank()) continue;
            s = s.replaceAll("^(?:[-*•]+|\\d+[.)])\\s*", "");
            s = s.replaceAll("^(?:\\*{1,2}|_)?(?:\\[\\s*([A-Za-z0-9_.\\-\\s]{1,30})\\s*\\]|([A-Za-z0-9_.\\-\\s]{1,30})(?:\\s*\\([^)]{1,25}\\))?)(?:\\*{1,2}|_)?\\s*:\\s*(?:\\*{1,2}|_)?\\s*", "");
            s = s.replaceAll("(?i)\\(\\s*(?:laugh(?:s|ing)?|sigh(?:s|ing)?|cough(?:s|ing)?|pause(?:s)?|whisper(?:s|ing)?|chuckle(?:s|ing)?|smile(?:s|ing)?|gasp(?:s)?|clears throat|music|applause|excited|angry|sad|happy|surprised|nervous)\\s*\\)", " ");
            s = s.replaceAll("\\[\\s*[^\\]]{1,30}\\s*\\]", " ");
            s = s.replaceAll("[*_#`~]+", "");
            s = s.replaceAll("\\s+", " ").trim();
            if (!s.isBlank()) {
                cleanedLines.add(s);
            }
        }
        return String.join(" ", cleanedLines).trim();
    }

    public static String resolveSmartVoiceForSpeaker(String speakerLabel, Collection<String> alreadyAssignedVoices) {
        String clean = (speakerLabel == null ? "" : speakerLabel)
                .replaceAll("[^a-zA-Z0-9\\s]", " ")
                .trim()
                .toLowerCase();
        Set<String> tokens = new HashSet<>(Arrays.asList(clean.split("\\s+")));

        boolean isFemale = !Collections.disjoint(tokens, FEMALE_KEYWORDS);
        boolean isMale = !Collections.disjoint(tokens, MALE_KEYWORDS);

        if (!isFemale && !isMale) {
            if (clean.contains("friend a") || clean.contains("speaker a") || clean.contains("person a")
                    || clean.contains("student a") || clean.contains("speaker 1") || clean.contains("person 1")
                    || clean.contains("student 1") || "a".equals(clean)) {
                isFemale = true;
            } else if (clean.contains("friend b") || clean.contains("speaker b") || clean.contains("person b")
                    || clean.contains("student b") || clean.contains("speaker 2") || clean.contains("person 2")
                    || clean.contains("student 2") || "b".equals(clean)) {
                isMale = true;
            }
        }

        if (isFemale && !isMale) {
            for (String v : FEMALE_VOICE_POOL) {
                if (!alreadyAssignedVoices.contains(v)) {
                    return v;
                }
            }
            return FEMALE_VOICE_POOL.get(alreadyAssignedVoices.size() % FEMALE_VOICE_POOL.size());
        }

        if (isMale && !isFemale) {
            for (String v : MALE_VOICE_POOL) {
                if (!alreadyAssignedVoices.contains(v)) {
                    return v;
                }
            }
            return MALE_VOICE_POOL.get(alreadyAssignedVoices.size() % MALE_VOICE_POOL.size());
        }

        for (String v : DIALOGUE_VOICE_ROTATION) {
            if (!alreadyAssignedVoices.contains(v)) {
                return v;
            }
        }
        return DIALOGUE_VOICE_ROTATION.get(alreadyAssignedVoices.size() % DIALOGUE_VOICE_ROTATION.size());
    }

    public static List<DialogueTurnParseResult> parseDialogueScript(String text) {
        if (text == null || text.isBlank()) {
            return Collections.emptyList();
        }
        List<DialogueTurnParseResult> turns = new ArrayList<>();
        String normalizedText = INLINE_SPEAKER_SPLIT_PATTERN.matcher(text.trim()).replaceAll("\n");
        String[] lines = normalizedText.split("\\r?\\n");

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isBlank()) continue;

            // Bỏ dấu gạch đầu dòng trước khi match DIALOGUE_LINE_PATTERN
            String cleanLine = line.replaceAll("^(?:[-*•]+|\\d+[.)])\\s*", "").trim();
            Matcher matcher = DIALOGUE_LINE_PATTERN.matcher(cleanLine);
            if (matcher.find()) {
                String rawSpeaker = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
                String speaker = rawSpeaker
                        .replaceAll("\\s*\\([^)]{1,25}\\)", "")
                        .replaceAll("[*_#`~\\[\\]]+", "")
                        .trim();
                String rawUtterance = matcher.group(3);
                String utterance = stripSpeakerAndStageDirections(rawUtterance);
                if (!speaker.isBlank() && !utterance.isBlank()) {
                    turns.add(new DialogueTurnParseResult(speaker, utterance));
                }
            } else if (!turns.isEmpty()) {
                // Nếu dòng tiếp theo không có nhãn người nói mới, nối tiếp vào lượt thoại của người đang nói
                DialogueTurnParseResult lastTurn = turns.get(turns.size() - 1);
                String extra = stripSpeakerAndStageDirections(cleanLine);
                if (!extra.isBlank()) {
                    lastTurn.text = lastTurn.text + " " + extra;
                }
            }
        }

        Map<String, String> speakerVoiceMap = buildSpeakerVoiceMap(turns);
        for (DialogueTurnParseResult t : turns) {
            t.voice = speakerVoiceMap.getOrDefault(t.speaker.toUpperCase(), DEFAULT_SHADOWING_VOICE);
        }
        return turns;
    }

    private MonologueSynthesisResult synthesizeMonologueWithPython(String text, String preferredVoice, double speed) throws Exception {
        String url = pythonServiceBaseUrl + "/tts";
        String voice = normalizeKokoroVoice(preferredVoice);
        String cleanSpokenText = stripSpeakerAndStageDirections(text);
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
            // Tính toán thời lượng theo chuẩn 24000Hz 16-bit Mono (48000 bytes/giây)
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
            List<DialogueTurnParseResult> turns,
            String preferredVoice,
            double speed) throws Exception {

        String url = pythonServiceBaseUrl + "/tts/dialogue";

        // Gán giọng thông minh theo giới tính / tên nhân vật (Friend A -> Nữ af_heart, Friend B -> Nam am_michael)
        Map<String, String> speakerVoiceMap = buildSpeakerVoiceMap(turns);

        List<Map<String, Object>> turnsPayload = new ArrayList<>();
        for (DialogueTurnParseResult t : turns) {
            String cleanUtterance = stripSpeakerAndStageDirections(t.text);
            if (cleanUtterance.isBlank()) continue;
            turnsPayload.add(Map.of(
                    "speaker", t.speaker,
                    "text", cleanUtterance,
                    "voice", speakerVoiceMap.getOrDefault(t.speaker.toUpperCase(), DEFAULT_SHADOWING_VOICE),
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

    public static Map<String, String> buildSpeakerVoiceMap(List<DialogueTurnParseResult> turns) {
        Map<String, String> speakerVoiceMap = new LinkedHashMap<>();
        List<String> assignedVoices = new ArrayList<>();
        for (DialogueTurnParseResult t : turns) {
            String spkKey = t.speaker.toUpperCase();
            if (!speakerVoiceMap.containsKey(spkKey)) {
                String chosenVoice = resolveSmartVoiceForSpeaker(t.speaker, assignedVoices);
                speakerVoiceMap.put(spkKey, chosenVoice);
                assignedVoices.add(chosenVoice);
            }
        }
        return speakerVoiceMap;
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

    private String buildVoiceConfigJson(List<DialogueTurnParseResult> turns, boolean isDialogue, String preferredVoice) {
        try {
            if (isDialogue) {
                Map<String, String> spkMap = buildSpeakerVoiceMap(turns);
                return objectMapper.writeValueAsString(Map.of("dialogue", true, "speakers", spkMap));
            } else {
                String v = normalizeKokoroVoice(preferredVoice);
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

    public static class DialogueTurnParseResult {
        public String speaker;
        public String text;
        public String voice;
        public DialogueTurnParseResult(String speaker, String text) {
            this.speaker = speaker;
            this.text = text;
            this.voice = DEFAULT_SHADOWING_VOICE;
        }
        public String speaker() { return speaker; }
        public String text() { return text; }
        public String voice() { return voice; }
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


