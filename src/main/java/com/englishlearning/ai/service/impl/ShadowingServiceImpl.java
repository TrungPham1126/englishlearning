package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.dto.AiCoachingAdvice;
import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.util.SpeakingScoreCalibrationUtils;
import com.englishlearning.ai.service.GeminiClientService;
import com.englishlearning.ai.service.GroqClientService;
import com.englishlearning.ai.service.PythonIntegrationService;
import com.englishlearning.ai.service.ShadowingService;
import com.englishlearning.ai.service.SpeakingAiCoachingService;
import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.notification.service.NotificationService;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.submission.entity.StudentAnswer;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.util.ScoreScaleUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShadowingServiceImpl implements ShadowingService {

    private final GroqClientService groqClientService;
    private final GeminiClientService geminiClientService;
    private final PythonIntegrationService pythonIntegrationService;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final NotificationService notificationService;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final AnalyticsService analyticsService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private SpeakingAiCoachingService speakingAiCoachingService;

    public void setSpeakingAiCoachingService(SpeakingAiCoachingService speakingAiCoachingService) {
        this.speakingAiCoachingService = speakingAiCoachingService;
    }

    private static final String SHADOWING_SYSTEM_INSTRUCTION = """
            You are an encouraging yet accurate Cambridge & IELTS Speaking Pronunciation Coach (calibrated to Engnovate IELTS Speaking standards).
            Your task is to fairly evaluate a student's spoken transcript against the Reference Sentence.

            CRITICAL GRADING RULES:
            1. Fair & Constructive Calibration: Do NOT penalize overly harshly for minor L2 accent variations, natural speech contractions, unreleased word-final plosives (/p/, /t/, /k/), or minor ASR homophones. Reward intelligible, natural pronunciation generously.
            2. Word-by-word analysis: For every word in the Reference Sentence, determine:
               - Was it spoken clearly or intelligibly (including close ASR homophones)? If yes -> score 96-100, color 'GREEN', wordStatus 'SPOKEN'.
               - Was it spoken with noticeable pronunciation deviation but still recognizable? If yes -> score 72-88, color 'YELLOW', wordStatus 'PARTIAL'.
               - Was it completely omitted (missing), unread, or absent? If yes -> score 0, color 'GRAY', wordStatus 'MISSING', and for all its phonemes score 0 with note 'Bạn chưa đọc từ này.'.
            3. Completeness & Overall Score:
               - completeness = (number of spoken words / total reference words) * 100. For example, if 2 out of 9 words are read, completeness MUST be ~22%.
               - overallScore MUST be scaled down strictly by completeness when words are omitted (e.g. if student only reads 2/9 words, overallScore <= 25). When completeness >= 95% and speech is clear/standard, overallScore, pronunciation, fluency, and prosody MUST be in the 96-100 range.
            4. Real IPA phonemes: Break down each reference word into its TRUE real IPA phonemes (e.g. 'ten' -> /t/, /e/, /n/ or 'habits' -> /h/, /æ/, /b/, /ɪ/, /ts/). Give constructive pedagogical feedback for each phoneme in Vietnamese.
            5. If overallScore >= 75, isPassed = true, else false.
            6. All notes, explanations, and statusMessage MUST be in Vietnamese.
            7. Return strictly valid JSON matching this schema:
            {
              "overallScore": 85,
              "isPassed": true,
              "passScore": 80,
              "statusMessage": "Nhận xét tổng quan bằng tiếng Việt",
              "kpi": {
                "pronunciation": 85,
                "fluency": 88,
                "completeness": 90,
                "prosody": 84,
                "wordsPerMinute": 110
              },
              "sentenceTokens": [
                {"word": "word", "color": "GREEN", "wordStatus": "SPOKEN", "hasPauseAfter": false, "hasLinkingAfter": false}
              ],
              "wordRows": [
                {
                  "word": "word",
                  "score": 85,
                  "wordStatus": "SPOKEN",
                  "phonemes": [
                    {"ipa": "/w/", "score": 85, "note": "Phát âm chuẩn"}
                  ]
                }
              ]
            }
            """;

    @Transactional
    @Override
    public ShadowingEvaluationResponse evaluateShadowing(MultipartFile audioFile, UUID studentAnswerId,
            String customSentence) {
        StudentAnswer foundAnswer = (studentAnswerId != null)
                ? entityManager.find(StudentAnswer.class, studentAnswerId)
                : null;
        if (studentAnswerId != null && foundAnswer == null) {
            log.warn("Không tìm thấy StudentAnswer với ID: {}. Thử tìm theo Question ID trong các lượt làm bài đang mở...",
                    studentAnswerId);
            try {
                List<StudentAnswer> candidates = entityManager.createQuery(
                        "SELECT a FROM StudentAnswer a WHERE a.question.id = :qId AND a.attempt.status = :status ORDER BY a.attempt.startedAt DESC",
                        StudentAnswer.class)
                        .setParameter("qId", studentAnswerId)
                        .setParameter("status", com.englishlearning.submission.entity.AttemptStatus.IN_PROGRESS)
                        .getResultList();
                if (!candidates.isEmpty()) {
                    foundAnswer = candidates.get(0);
                    log.info("Đã tìm thấy StudentAnswer {} tương ứng với Question ID {}", foundAnswer.getId(), studentAnswerId);
                }
            } catch (Exception ex) {
                log.warn("Lỗi tra cứu StudentAnswer theo Question ID: {}", ex.getMessage());
            }
        }
        final StudentAnswer answer = foundAnswer;

        String referenceSentence = customSentence;
        if (referenceSentence == null || referenceSentence.isBlank()) {
            if (answer != null && answer.getQuestion() != null) {
                referenceSentence = com.englishlearning.assignment.service.ExerciseAudioService
                        .extractCleanShadowingSentence(answer.getQuestion());
            }
            if (referenceSentence == null || referenceSentence.isBlank()) {
                throw new BadRequestException("Không tìm thấy câu mẫu đối chiếu cho bài tập Shadowing.");
            }
        }

        String cleanRef = cleanReferenceSentence(referenceSentence);

        try {
            // 1. Chuẩn bị dữ liệu âm thanh và bóc băng STT
            String transcript = "";
            byte[] audioBytes = null;
            String audioFilename = "audio.wav";

            if (audioFile == null || audioFile.isEmpty()) {
                if (answer != null && answer.getAudioResponseUrl() != null && !answer.getAudioResponseUrl().isBlank()) {
                    log.info("Downloading audio from URL: {}", answer.getAudioResponseUrl());
                    java.net.URL url = new java.net.URL(answer.getAudioResponseUrl());
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    try (java.io.InputStream in = conn.getInputStream()) {
                        audioBytes = in.readAllBytes();
                        audioFilename = "audio.webm";
                    }
                } else {
                    log.warn(
                            "Không tìm thấy file audio hoặc URL hợp lệ để chấm điểm. Sẽ chấm điểm với transcript rỗng.");
                    transcript = "";
                }
            } else {
                audioBytes = audioFile.getBytes();
                audioFilename = audioFile.getOriginalFilename() != null ? audioFile.getOriginalFilename() : "audio.wav";
            }

            ShadowingEvaluationResponse response = null;
            String rawJson = null;

            // 1. ƯU TIÊN HÀNG ĐẦU: Chấm điểm âm học F1/F2 qua Python FastAPI microservice (cực nhanh < 1s)
            if (audioBytes != null && audioBytes.length > 0) {
                try {
                    log.info("Gọi Python acoustic microservice để phân tích Formant F1/F2 & alignment cho script: '{}'...", cleanRef);
                    ShadowingEvaluationResponse pyResp = pythonIntegrationService.evaluatePhonetics(audioBytes, audioFilename, cleanRef);
                    if (pyResp != null && pyResp.getOverallScore() != null) {
                        response = pyResp;
                        if (response.getEvaluatedBy() == null || response.getEvaluatedBy().isBlank()) {
                            response.setEvaluatedBy("PYTHON_ACOUSTIC_ENGINE");
                        }
                        transcript = cleanRef;
                        log.info("Nhận kết quả thành công từ Python acoustic microservice! EvaluatedBy: {}", response.getEvaluatedBy());
                    }
                } catch (Exception pyEx) {
                    log.error("Python acoustic microservice gặp lỗi hoặc timeout: {}. Kích hoạt Fallback AI.",
                            pyEx.getMessage());
                }
            }

            // 2. FALLBACK DỰ PHÒNG: Chỉ bóc băng Groq Whisper & gọi Gemini/Groq AI khi Python microservice gặp sự cố
            if (response == null) {
                log.info("Thực hiện fallback chấm phát âm qua Groq Whisper STT + Gemini AI / Groq...");
                if (audioBytes != null && audioBytes.length > 0) {
                    try {
                        String whisperRawJson = groqClientService.transcribeAudioVerbose(audioBytes, audioFilename);
                        com.fasterxml.jackson.databind.JsonNode rootNode = objectMapper.readTree(whisperRawJson);
                        transcript = rootNode.path("text").asText();
                    } catch (Exception ex) {
                        log.warn("Lỗi khi gọi Groq Whisper verbose: {}. Thử gọi phương thức thông thường.",
                                ex.getMessage());
                        try {
                            transcript = groqClientService.transcribeAudio(audioBytes, audioFilename);
                        } catch (Exception ignored) {
                        }
                    }
                }
                log.info("Fallback Whisper transcript: {}", transcript);

                response = evaluateTranscriptWithAi(transcript, cleanRef);
            }

            if (response != null) {
                SpeakingScoreCalibrationUtils.applyShadowingBoost(response);
            }

            // 3. AI Coach tổng hợp dữ liệu âm học vừa chấm để đưa lời khuyên cụ thể cho học viên
            if (response != null && response.getAiCoaching() == null && speakingAiCoachingService != null) {
                AiCoachingAdvice coaching = speakingAiCoachingService.generateShadowingCoaching(
                        response, cleanRef, "SHADOWING");
                if (coaching != null) {
                    response.setAiCoaching(coaching);
                }
            }
            rawJson = objectMapper.writeValueAsString(response);

            // 4. Lưu kết quả vào cơ sở dữ liệu và cập nhật kỹ năng học viên
            final StudentAnswer finalAnswer = answer;
            if (finalAnswer != null) {
                AiEvaluation evaluation = aiEvaluationRepository.findByStudentAnswerId(finalAnswer.getId())
                        .orElseGet(() -> AiEvaluation.builder()
                                .studentAnswer(finalAnswer)
                                .evalType(AiEvaluationType.SPEAKING)
                                .build());

                double overallScaled = response.getOverallScore() != null
                        ? ScoreScaleUtils.clampScale10(response.getOverallScore() / 10.0)
                        : 0.0;
                evaluation.setOverallScore(overallScaled);
                evaluation.setSttTranscript(transcript);
                evaluation.setSuggestionsJson(rawJson);
                evaluation.setEvaluationEngine(response.getEvaluatedBy());
                aiEvaluationRepository.save(evaluation);

                finalAnswer.setEvalFeedback(rawJson);
                finalAnswer.setEarnedPoints(overallScaled);
                finalAnswer.setIsCorrect(Boolean.TRUE.equals(response.getIsPassed()));
                entityManager.merge(finalAnswer);

                if (finalAnswer.getAttempt() != null && finalAnswer.getAttempt().getStudent() != null) {
                    analyticsService.updateSkillScore(finalAnswer.getAttempt().getStudent().getId(), "SPEAKING",
                            overallScaled * 0.1);
                }
            }

            return response;
        } catch (Exception e) {
            log.error("Shadowing evaluation error: ", e);
            throw new RuntimeException("Chấm bài Shadowing thất bại: " + e.getMessage(), e);
        }
    }

    private String cleanReferenceSentence(String raw) {
        String cleaned = com.englishlearning.assignment.service.ExerciseAudioService.cleanShadowingSentence(raw);
        return (cleaned != null && !cleaned.isBlank()) ? cleaned : "Hello";
    }

    /**
     * Gửi yêu cầu chấm phát âm ngữ âm tới Gemini AI (hoặc Groq nếu Gemini gặp sự cố)
     */
    private ShadowingEvaluationResponse evaluateTranscriptWithAi(String transcript, String referenceSentence) {
        String userPrompt = String.format("""
                Reference Sentence: "%s"
                Student Spoken Transcript: "%s"

                Evaluate rigorously according to the instructions and return JSON.
                """, referenceSentence,
                (transcript != null && !transcript.isBlank()) ? transcript : "[SILENCE / NO SPEECH DETECTED]");

        try {
            log.info("Thực hiện đánh giá bài nói qua Gemini AI fallback...");
            String geminiJson = geminiClientService.generateWithSystemInstruction(SHADOWING_SYSTEM_INSTRUCTION,
                    userPrompt);
            String cleanGeminiJson = GeminiClientService.stripMarkdown(geminiJson);
            ShadowingEvaluationResponse response = objectMapper.readValue(cleanGeminiJson,
                    ShadowingEvaluationResponse.class);
            response.setEvaluatedBy("GEMINI_AI_FALLBACK");
            log.info("Gemini AI fallback đánh giá thành công! EvaluatedBy: GEMINI_AI_FALLBACK");
            return response;
        } catch (Exception e) {
            log.warn("Gemini AI gặp sự cố ({}), chuyển sang Groq fallback...", e.getMessage());
            try {
                String groqJson = groqClientService.chatCompletionJson(SHADOWING_SYSTEM_INSTRUCTION, userPrompt);
                String cleanGroqJson = GroqClientService.stripMarkdown(groqJson);
                ShadowingEvaluationResponse response = objectMapper.readValue(cleanGroqJson,
                        ShadowingEvaluationResponse.class);
                response.setEvaluatedBy("GROQ_AI_FALLBACK");
                log.info("Groq AI fallback đánh giá thành công! EvaluatedBy: GROQ_AI_FALLBACK");
                return response;
            } catch (Exception groqEx) {
                log.error("Cả Gemini AI và Groq AI fallback đều thất bại: {}", groqEx.getMessage());
                throw new RuntimeException("Cả Gemini AI và Groq AI fallback đều thất bại: " + groqEx.getMessage(),
                        groqEx);
            }
        }
    }
}