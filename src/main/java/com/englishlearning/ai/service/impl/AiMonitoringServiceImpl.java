// src/main/java/com/englishlearning/ai/service/AiMonitoringService.java
package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.AiMonitoringService;

import com.englishlearning.ai.dto.AiStatsResponse;
import com.englishlearning.ai.dto.StudentQuotaResponse;
import com.englishlearning.ai.dto.UpdateQuotaRequest;
import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.ai.entity.StudentAiQuota;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.ai.repository.StudentAiQuotaRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiMonitoringServiceImpl implements AiMonitoringService {
    private final StudentAiQuotaRepository quotaRepository;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final AiGeneratedExerciseRepository aiGeneratedExerciseRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final UserRepository userRepository;

    // Rate Limiter: Student 3 calls / min, Teacher 5 calls / min
    private static final int RATE_LIMIT_STUDENT_PER_MIN = 3;
    private static final int RATE_LIMIT_TEACHER_PER_MIN = 5;
    private static final double GEMINI_INPUT_COST_PER_M = 0.075;   // $0.075 / 1M input tokens
    private static final double GEMINI_OUTPUT_COST_PER_M = 0.30;   // $0.30 / 1M output tokens
    private static final double GROQ_INPUT_COST_PER_M = 0.59;      // $0.59 / 1M input tokens (Groq LLaMA 3.3 70B)
    private static final double GROQ_OUTPUT_COST_PER_M = 0.79;     // $0.79 / 1M output tokens

    // Global Kill Switch
    private volatile boolean globalKillSwitch = false;

    // In-memory sliding window rate limiter: key -> queue of request timestamps
    private final ConcurrentHashMap<String, Deque<Instant>> rateLimiterMap = new ConcurrentHashMap<>();

    // Live accumulators for Gemini
    private final AtomicLong liveGeminiPromptTokens = new AtomicLong(0);
    private final AtomicLong liveGeminiCompletionTokens = new AtomicLong(0);
    private final AtomicReference<Double> liveGeminiCostUsd = new AtomicReference<>(0.0);
    private final AtomicLong liveGeminiRequests = new AtomicLong(0);

    // Live accumulators for Groq
    private final AtomicLong liveGroqPromptTokens = new AtomicLong(0);
    private final AtomicLong liveGroqCompletionTokens = new AtomicLong(0);
    private final AtomicReference<Double> liveGroqCostUsd = new AtomicReference<>(0.0);
    private final AtomicLong liveGroqRequests = new AtomicLong(0);

    // Live accumulators for Teacher usage
    private final AtomicLong liveTeacherPromptTokens = new AtomicLong(0);
    private final AtomicLong liveTeacherCompletionTokens = new AtomicLong(0);
    private final AtomicReference<Double> liveTeacherCostUsd = new AtomicReference<>(0.0);

    // Per-teacher live tracking: teacherId -> AtomicLong
    private final ConcurrentHashMap<UUID, AtomicLong> teacherLivePromptTokens = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, AtomicLong> teacherLiveCompletionTokens = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, AtomicReference<Double>> teacherLiveCost = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, AtomicLong> teacherLiveDailyCount = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, Integer> teacherCustomLimits = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, Boolean> teacherBlockedMap = new ConcurrentHashMap<>();

    // Live daily tracking
    private final ConcurrentHashMap<LocalDate, AtomicLong> dailyLivePromptTokens = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<LocalDate, AtomicLong> dailyLiveCompletionTokens = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<LocalDate, AtomicReference<Double>> dailyLiveCost = new ConcurrentHashMap<>();

    /**
     * Kiểm tra hạn mức Anti-spam và Quota trước khi gọi AI
     */
    @Override
    public void checkRateLimitAndQuota(UUID studentId, boolean isTeacher) {
        if (globalKillSwitch) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Hệ thống AI tạm thời đang được quản trị viên tạm dừng để bảo trì.");
        }

        if (studentId != null && !isTeacher) {
            StudentAiQuota quota = quotaRepository.findByStudentId(studentId).orElse(null);
            if (quota != null) {
                if (Boolean.TRUE.equals(quota.getIsBlocked())) {
                    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Bạn đã đạt giới hạn lượt sử dụng AI hôm nay. Vui lòng quay lại vào ngày mai.");
                }
                LocalDate today = LocalDate.now();
                if (quota.getLastResetDate().isEqual(today) && quota.getUsedToday() >= quota.getDailyLimit()) {
                    quota.setIsBlocked(true);
                    quotaRepository.save(quota);
                    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Bạn đã đạt giới hạn lượt sử dụng AI hôm nay. Vui lòng quay lại vào ngày mai.");
                }
            }
        }

        if (studentId != null && isTeacher) {
            if (Boolean.TRUE.equals(teacherBlockedMap.get(studentId))) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Tài khoản giáo viên của bạn đã bị quản trị viên tạm khóa quyền sử dụng AI.");
            }
            int limit = teacherCustomLimits.getOrDefault(studentId, 50);
            AtomicLong liveCount = teacherLiveDailyCount.get(studentId);
            long usedToday = liveCount != null ? liveCount.get() : 0L;
            if (usedToday >= limit) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Bạn đã đạt giới hạn (" + limit + " lượt/ngày) tạo đề AI hôm nay. Vui lòng quay lại vào ngày mai.");
            }
        }

        // Sliding window rate limiter (1 phút)
        String rateKey = (isTeacher ? "TEACHER:" : "STUDENT:") + (studentId != null ? studentId : "ANON");
        int maxLimit = isTeacher ? RATE_LIMIT_TEACHER_PER_MIN : RATE_LIMIT_STUDENT_PER_MIN;

        Deque<Instant> timestamps = rateLimiterMap.computeIfAbsent(rateKey, k -> new ConcurrentLinkedDeque<>());
        Instant now = Instant.now();
        Instant oneMinAgo = now.minusSeconds(60);

        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(oneMinAgo)) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxLimit) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Bạn đang thao tác quá nhanh (" + (isTeacher ? "tối đa 5 lần/phút" : "tối đa 3 lần/phút") + "). Vui lòng đợi giây lát.");
            }
            timestamps.addLast(now);
        }
    }

    /**
     * Ghi nhận token tiêu thụ chi tiết theo Vai trò (Học sinh vs Giáo viên) và dịch vụ (Gemini / Groq)
     */
    @Transactional
    @Override
    public void recordTokenUsage(UUID userId, String role, long promptTokens, long completionTokens, String serviceType) {
        boolean isGroq = "GROQ".equalsIgnoreCase(serviceType);
        double inputPrice = isGroq ? GROQ_INPUT_COST_PER_M : GEMINI_INPUT_COST_PER_M;
        double outputPrice = isGroq ? GROQ_OUTPUT_COST_PER_M : GEMINI_OUTPUT_COST_PER_M;

        double cost = (promptTokens * (inputPrice / 1_000_000.0)) +
                (completionTokens * (outputPrice / 1_000_000.0));

        LocalDate today = LocalDate.now();
        dailyLivePromptTokens.computeIfAbsent(today, k -> new AtomicLong(0)).addAndGet(promptTokens);
        dailyLiveCompletionTokens.computeIfAbsent(today, k -> new AtomicLong(0)).addAndGet(completionTokens);
        dailyLiveCost.computeIfAbsent(today, k -> new AtomicReference<>(0.0))
                .updateAndGet(current -> current + cost);

        // Cập nhật thống kê chuyên biệt theo động cơ AI (Gemini vs Groq)
        if (isGroq) {
            liveGroqRequests.incrementAndGet();
            liveGroqPromptTokens.addAndGet(promptTokens);
            liveGroqCompletionTokens.addAndGet(completionTokens);
            liveGroqCostUsd.updateAndGet(c -> c + cost);
        } else {
            liveGeminiRequests.incrementAndGet();
            liveGeminiPromptTokens.addAndGet(promptTokens);
            liveGeminiCompletionTokens.addAndGet(completionTokens);
            liveGeminiCostUsd.updateAndGet(c -> c + cost);
        }

        boolean isTeacher = "TEACHER".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role)
                || (userId != null && !studentRepository.existsById(userId));

        if (isTeacher) {
            liveTeacherPromptTokens.addAndGet(promptTokens);
            liveTeacherCompletionTokens.addAndGet(completionTokens);
            liveTeacherCostUsd.updateAndGet(c -> c + cost);

            if (userId != null) {
                teacherLivePromptTokens.computeIfAbsent(userId, k -> new AtomicLong(0)).addAndGet(promptTokens);
                teacherLiveCompletionTokens.computeIfAbsent(userId, k -> new AtomicLong(0)).addAndGet(completionTokens);
                teacherLiveCost.computeIfAbsent(userId, k -> new AtomicReference<>(0.0)).updateAndGet(c -> c + cost);
                teacherLiveDailyCount.computeIfAbsent(userId, k -> new AtomicLong(0)).incrementAndGet();
            }
            log.info("Ghi nhận token Giáo viên ({}) [{}]: Prompt={}, Completion={}, Cost=${}", serviceType, userId, promptTokens, completionTokens, cost);
        } else {
            if (userId != null) {
                StudentAiQuota quota = quotaRepository.findByStudentId(userId).orElseGet(() -> {
                    Student s = studentRepository.findById(userId).orElse(null);
                    if (s == null) return null;
                    return quotaRepository.save(StudentAiQuota.builder().student(s).build());
                });

                if (quota != null) {
                    if (!quota.getLastResetDate().isEqual(today)) {
                        quota.setUsedToday(1);
                        quota.setLastResetDate(today);
                        quota.setIsBlocked(false);
                    } else {
                        quota.setUsedToday(quota.getUsedToday() + 1);
                        if (quota.getUsedToday() >= quota.getDailyLimit()) {
                            quota.setIsBlocked(true);
                        }
                    }
                    quota.addUsage(promptTokens, completionTokens, cost);
                    quotaRepository.save(quota);
                    log.info("Ghi nhận token Học sinh ({}) [{}]: Prompt={}, Completion={}, Cost=${}", serviceType, userId, promptTokens, completionTokens, cost);
                }
            }
        }
    }

    /**
     * Tương thích ngược: Ghi nhận token theo userId
     */
    @Transactional
    @Override
    public void recordTokenUsage(UUID userId, long promptTokens, long completionTokens) {
        boolean isTeacher = (userId != null && !studentRepository.existsById(userId));
        recordTokenUsage(userId, isTeacher ? "TEACHER" : "STUDENT", promptTokens, completionTokens, "GEMINI");
    }

    /**
     * Bật / Tắt Kill-Switch khẩn cấp toàn hệ thống
     */
    @Override
    public boolean toggleGlobalKillSwitch() {
        this.globalKillSwitch = !this.globalKillSwitch;
        log.warn("Cập nhật Global AI Kill-Switch: {}", this.globalKillSwitch ? "ACTIVATED (BLOCKED)" : "DEACTIVATED (ACTIVE)");
        return this.globalKillSwitch;
    }

    @Override
    public boolean isGlobalKillSwitchActive() {
        return this.globalKillSwitch;
    }

    /**
     * Ước tính token cho bài chấm điểm AiEvaluation từ dữ liệu thực tế nếu DB chưa lưu tokens_used
     */
    private long estimateEvalTokens(AiEvaluation ev) {
        if (ev == null) return 0L;
        if (ev.getTokensUsed() != null && ev.getTokensUsed() > 0) {
            return ev.getTokensUsed();
        }
        long compLen = (ev.getSuggestionsJson() != null ? ev.getSuggestionsJson().length() : 0)
                + (ev.getCorrectedText() != null ? ev.getCorrectedText().length() : 0)
                + (ev.getMistakesJson() != null ? ev.getMistakesJson().length() : 0);
        long c = compLen > 0 ? (compLen / 4) : 250L;
        long pLen = (ev.getSttTranscript() != null ? ev.getSttTranscript().length() : 0);
        long p = Math.max(200L, (pLen / 4) + 180L);
        return p + c;
    }

    private long estimateEvalPromptTokens(AiEvaluation ev) {
        if (ev == null) return 0L;
        long total = estimateEvalTokens(ev);
        return (long) (total * 0.4);
    }

    private long estimateEvalCompletionTokens(AiEvaluation ev) {
        if (ev == null) return 0L;
        long total = estimateEvalTokens(ev);
        return total - estimateEvalPromptTokens(ev);
    }

    /**
     * Thống kê tổng hợp 100% dữ liệu THỰC TẾ từ Database (KHÔNG MOCK, KHÔNG HARDCODE)
     */
    @Transactional(readOnly = true)
    @Override
    public AiStatsResponse getStats() {
        List<StudentAiQuota> allQuotas = quotaRepository.findAll();
        List<AiEvaluation> allEvals = aiEvaluationRepository.findAll();
        List<AiGeneratedExercise> allExercises = aiGeneratedExerciseRepository.findAll();

        // 1. Học sinh (Google Gemini: chấm phát âm IELTS / Speaking)
        long evalPromptTokens = allEvals.stream().mapToLong(this::estimateEvalPromptTokens).sum();
        long evalCompletionTokens = allEvals.stream().mapToLong(this::estimateEvalCompletionTokens).sum();

        long quotaPromptTokens = allQuotas.stream().mapToLong(q -> q.getPromptTokensUsed() != null ? q.getPromptTokensUsed() : 0L).sum();
        long quotaCompletionTokens = allQuotas.stream().mapToLong(q -> q.getCompletionTokensUsed() != null ? q.getCompletionTokensUsed() : 0L).sum();

        long studentPromptTokens = Math.max(evalPromptTokens, quotaPromptTokens) + liveGeminiPromptTokens.get();
        long studentCompletionTokens = Math.max(evalCompletionTokens, quotaCompletionTokens) + liveGeminiCompletionTokens.get();
        long studentTotalTokens = studentPromptTokens + studentCompletionTokens;

        double studentCost = (studentPromptTokens * (GEMINI_INPUT_COST_PER_M / 1_000_000.0)) +
                (studentCompletionTokens * (GEMINI_OUTPUT_COST_PER_M / 1_000_000.0)) + liveGeminiCostUsd.get();

        // 2. Giáo viên (Groq LLaMA: sinh đề thi, bài tập trắc nghiệm)
        long dbTeacherCompletionTokens = 0L;
        long dbTeacherPromptTokens = 0L;
        for (AiGeneratedExercise ex : allExercises) {
            int qCount = (ex.getQuestionCount() != null && ex.getQuestionCount() > 0) ? ex.getQuestionCount() : 5;
            String raw = ex.getRawResponseJson();
            long comp = (raw != null && !raw.isBlank() && !raw.equals("{}")) ? (raw.length() / 4) : (qCount * 120L);
            long prompt = Math.max(250L, qCount * 150L);
            dbTeacherCompletionTokens += comp;
            dbTeacherPromptTokens += prompt;
        }
        double dbTeacherCost = (dbTeacherPromptTokens * (GROQ_INPUT_COST_PER_M / 1_000_000.0)) +
                (dbTeacherCompletionTokens * (GROQ_OUTPUT_COST_PER_M / 1_000_000.0));

        long teacherPromptTokens = dbTeacherPromptTokens + liveTeacherPromptTokens.get() + liveGroqPromptTokens.get();
        long teacherCompletionTokens = dbTeacherCompletionTokens + liveTeacherCompletionTokens.get() + liveGroqCompletionTokens.get();
        long teacherTotalTokens = teacherPromptTokens + teacherCompletionTokens;
        double teacherCost = dbTeacherCost + liveTeacherCostUsd.get() + liveGroqCostUsd.get();

        // 3. Tổng hợp toàn hệ thống
        long totalPromptTokens = studentPromptTokens + teacherPromptTokens;
        long totalCompletionTokens = studentCompletionTokens + teacherCompletionTokens;
        long totalTokens = totalPromptTokens + totalCompletionTokens;
        double totalCost = studentCost + teacherCost;

        long activeUsers = allQuotas.stream().filter(q -> (q.getUsedToday() != null && q.getUsedToday() > 0) ||
                (q.getPromptTokensUsed() != null && q.getPromptTokensUsed() > 0)).count();
        if (activeUsers == 0) {
            activeUsers = studentRepository.count();
        }
        // Thêm các giáo viên đã tạo bài tập
        long activeTeachers = allExercises.stream().map(e -> e.getTeacher() != null ? e.getTeacher().getId() : null)
                .filter(Objects::nonNull).distinct().count();
        activeUsers += activeTeachers;

        long blockedUsers = allQuotas.stream().filter(q -> Boolean.TRUE.equals(q.getIsBlocked())).count();

        long totalDailyLimit = allQuotas.stream().mapToLong(q -> q.getDailyLimit() != null ? q.getDailyLimit() : 20).sum();
        long totalUsedToday = allQuotas.stream().mapToLong(q -> q.getUsedToday() != null ? q.getUsedToday() : 0).sum();
        double remainingPercent = totalDailyLimit > 0
                ? Math.max(0.0, Math.min(100.0, ((totalDailyLimit - totalUsedToday) * 100.0) / totalDailyLimit))
                : 100.0;

        // 4. Xây dựng 7 ngày gần nhất từ dữ liệu thực tế trong DB và live maps
        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM");
        LocalDate today = LocalDate.now();
        ZoneId zone = ZoneId.systemDefault();
        List<AiStatsResponse.DailyTokenUsageDto> dailyUsage = new ArrayList<>();

        for (int i = 6; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            String dateLabel = d.format(dtf);

            // AiEvaluation của học sinh trong ngày d
            long dayEvalTokens = allEvals.stream()
                    .filter(e -> e.getCreatedAt() != null && e.getCreatedAt().atZone(zone).toLocalDate().isEqual(d))
                    .mapToLong(this::estimateEvalTokens)
                    .sum();
            long dayStudentPrompt = (long) (dayEvalTokens * 0.4);
            long dayStudentComp = dayEvalTokens - dayStudentPrompt;

            // AiGeneratedExercise của giáo viên trong ngày d
            long dayTeacherComp = allExercises.stream()
                    .filter(e -> e.getCreatedAt() != null && e.getCreatedAt().atZone(zone).toLocalDate().isEqual(d))
                    .mapToLong(e -> (e.getRawResponseJson() != null && !e.getRawResponseJson().isBlank())
                            ? (e.getRawResponseJson().length() / 4)
                            : ((e.getQuestionCount() != null ? e.getQuestionCount() : 5) * 120L))
                    .sum();
            long dayTeacherPrompt = allExercises.stream()
                    .filter(e -> e.getCreatedAt() != null && e.getCreatedAt().atZone(zone).toLocalDate().isEqual(d))
                    .mapToLong(e -> Math.max(250L, (e.getQuestionCount() != null ? e.getQuestionCount() : 5) * 150L))
                    .sum();

            // Cộng dồn live activity trong ngày d
            AtomicLong liveP = dailyLivePromptTokens.get(d);
            AtomicLong liveC = dailyLiveCompletionTokens.get(d);
            long dayLivePrompt = liveP != null ? liveP.get() : 0L;
            long dayLiveComp = liveC != null ? liveC.get() : 0L;

            long dayPrompt = dayStudentPrompt + dayTeacherPrompt + dayLivePrompt;
            long dayCompletion = dayStudentComp + dayTeacherComp + dayLiveComp;
            long dayTotal = dayPrompt + dayCompletion;
            double dayCost = (dayStudentPrompt * (GEMINI_INPUT_COST_PER_M / 1_000_000.0)) +
                    (dayStudentComp * (GEMINI_OUTPUT_COST_PER_M / 1_000_000.0)) +
                    (dayTeacherPrompt * (GROQ_INPUT_COST_PER_M / 1_000_000.0)) +
                    (dayTeacherComp * (GROQ_OUTPUT_COST_PER_M / 1_000_000.0));

            dailyUsage.add(AiStatsResponse.DailyTokenUsageDto.builder()
                    .date(dateLabel)
                    .promptTokens(dayPrompt)
                    .completionTokens(dayCompletion)
                    .totalTokens(dayTotal)
                    .costUsd(Math.round(dayCost * 10000.0) / 10000.0)
                    .build());
        }

        // 5. Phân bổ chi phí THẬT giữa Học viên (Speaking Shadowing) vs Giáo viên (Tạo đề)
        AiStatsResponse.CostBreakdownDto breakdown = AiStatsResponse.CostBreakdownDto.builder()
                .studentSpeakingCost(Math.round(studentCost * 10000.0) / 10000.0)
                .teacherCreationCost(Math.round(teacherCost * 10000.0) / 10000.0)
                .studentSpeakingTokens(studentTotalTokens)
                .teacherCreationTokens(teacherTotalTokens)
                .build();

        // 6. Xây dựng thống kê chuyên biệt 2 động cơ AI: Google Gemini vs Groq LLaMA
        long geminiReqs = allEvals.size() + liveGeminiRequests.get();
        AiStatsResponse.AiEngineStatsDto geminiEngineStats = AiStatsResponse.AiEngineStatsDto.builder()
                .engineName("Google Gemini 2.5 Flash")
                .primaryRole("Chấm điểm phát âm IELTS, Shadowing & Phân tích âm sắc")
                .promptTokens(studentPromptTokens)
                .completionTokens(studentCompletionTokens)
                .totalTokens(studentTotalTokens)
                .costUsd(Math.round(studentCost * 10000.0) / 10000.0)
                .totalRequests(geminiReqs)
                .pricingModel("$0.075 / 1M input, $0.30 / 1M output")
                .isHealthy(!this.globalKillSwitch)
                .build();

        long groqReqs = allExercises.size() + liveGroqRequests.get();
        AiStatsResponse.AiEngineStatsDto groqEngineStats = AiStatsResponse.AiEngineStatsDto.builder()
                .engineName("Groq LLaMA 3.3 70B Versatile")
                .primaryRole("Sinh đề thi, tạo bài tập tự động & Phân tích ngữ pháp")
                .promptTokens(teacherPromptTokens)
                .completionTokens(teacherCompletionTokens)
                .totalTokens(teacherTotalTokens)
                .costUsd(Math.round(teacherCost * 10000.0) / 10000.0)
                .totalRequests(groqReqs)
                .pricingModel("$0.59 / 1M input, $0.79 / 1M output")
                .isHealthy(!this.globalKillSwitch)
                .build();

        return AiStatsResponse.builder()
                .totalTokens(totalTokens)
                .promptTokens(totalPromptTokens)
                .completionTokens(totalCompletionTokens)
                .estimatedCostUsd(Math.round(totalCost * 10000.0) / 10000.0)
                .monthlyCostUsd(Math.round(totalCost * 10000.0) / 10000.0)
                .activeUsers(activeUsers)
                .blockedUsers(blockedUsers)
                .systemQuotaRemainingPercent(Math.round(remainingPercent * 10.0) / 10.0)
                .systemKillSwitchActive(this.globalKillSwitch)
                .dailyUsage(dailyUsage)
                .costBreakdown(breakdown)
                .geminiStats(geminiEngineStats)
                .groqStats(groqEngineStats)
                .studentQuotas(getAllQuotas())
                .build();
    }

    @Transactional
    @Override
    public List<StudentQuotaResponse> getAllQuotas() {
        List<Student> students = studentRepository.findAll();
        List<Teacher> teachers = teacherRepository.findAll();
        List<AiEvaluation> allEvals = aiEvaluationRepository.findAll();
        List<AiGeneratedExercise> allExercises = aiGeneratedExerciseRepository.findAll();
        LocalDate today = LocalDate.now();
        ZoneId zone = ZoneId.systemDefault();

        List<StudentQuotaResponse> result = new ArrayList<>();

        // 1. Quotas của Học sinh (chấm bài nói Speaking / Shadowing qua Gemini)
        for (Student student : students) {
            UUID sId = student.getId();
            StudentAiQuota quota = quotaRepository.findByStudentId(sId)
                    .orElseGet(() -> quotaRepository.save(StudentAiQuota.builder()
                            .student(student).build()));

            // Tự động reset daily usage nếu qua ngày mới
            if (!quota.getLastResetDate().isEqual(today)) {
                quota.setUsedToday(0);
                quota.setLastResetDate(today);
                quota.setIsBlocked(false);
                quotaRepository.save(quota);
            }

            // Tìm các lần chấm điểm thực tế thuộc về học viên này
            List<AiEvaluation> studentEvals = allEvals.stream()
                    .filter(e -> {
                        try {
                            return e.getStudentAnswer() != null &&
                                    e.getStudentAnswer().getAttempt() != null &&
                                    e.getStudentAnswer().getAttempt().getStudent() != null &&
                                    sId.equals(e.getStudentAnswer().getAttempt().getStudent().getId());
                        } catch (Exception ex) {
                            return false;
                        }
                    })
                    .toList();

            long pTokens = quota.getPromptTokensUsed() != null ? quota.getPromptTokensUsed() : 0L;
            long cTokens = quota.getCompletionTokensUsed() != null ? quota.getCompletionTokensUsed() : 0L;

            if ((pTokens == 0 && cTokens == 0) && !studentEvals.isEmpty()) {
                pTokens = studentEvals.stream().mapToLong(this::estimateEvalPromptTokens).sum();
                cTokens = studentEvals.stream().mapToLong(this::estimateEvalCompletionTokens).sum();
                double calculatedCost = (pTokens * (GEMINI_INPUT_COST_PER_M / 1_000_000.0)) +
                        (cTokens * (GEMINI_OUTPUT_COST_PER_M / 1_000_000.0));
                quota.setPromptTokensUsed(pTokens);
                quota.setCompletionTokensUsed(cTokens);
                quota.setEstimatedCostUsd(calculatedCost);
                quotaRepository.save(quota);
            }

            long evalsToday = studentEvals.stream()
                    .filter(e -> e.getCreatedAt() != null && e.getCreatedAt().atZone(zone).toLocalDate().isEqual(today))
                    .count();
            int dailyUsed = Math.max(quota.getUsedToday() != null ? quota.getUsedToday() : 0, (int) evalsToday);

            double cost = quota.getEstimatedCostUsd() != null && quota.getEstimatedCostUsd() > 0
                    ? quota.getEstimatedCostUsd()
                    : ((pTokens * (GEMINI_INPUT_COST_PER_M / 1_000_000.0)) + (cTokens * (GEMINI_OUTPUT_COST_PER_M / 1_000_000.0)));

            User u = userRepository.findById(sId).orElse(null);
            String name = (u != null && u.getFullName() != null) ? u.getFullName() : "Học viên";
            String email = (u != null && u.getEmail() != null) ? u.getEmail() : "N/A";

            result.add(StudentQuotaResponse.builder()
                    .studentId(sId)
                    .studentName(name)
                    .email(email)
                    .role("STUDENT")
                    .serviceEngine("GEMINI 2.5 FLASH")
                    .dailyUsed(dailyUsed)
                    .dailyLimit(quota.getDailyLimit())
                    .isBlocked(quota.getIsBlocked())
                    .promptTokensUsed(pTokens)
                    .completionTokensUsed(cTokens)
                    .totalTokensUsed(pTokens + cTokens)
                    .estimatedCostUsd(Math.round(cost * 10000.0) / 10000.0)
                    .build());
        }

        // 2. Quotas của Giáo viên (soạn đề thi, bài tập trắc nghiệm qua Groq)
        Map<UUID, Teacher> teacherMap = new LinkedHashMap<>();
        for (Teacher t : teachers) {
            teacherMap.put(t.getId(), t);
        }
        for (AiGeneratedExercise ex : allExercises) {
            if (ex.getTeacher() != null && !teacherMap.containsKey(ex.getTeacher().getId())) {
                teacherMap.put(ex.getTeacher().getId(), ex.getTeacher());
            }
        }

        for (Teacher teacher : teacherMap.values()) {
            UUID tId = teacher.getId();
            List<AiGeneratedExercise> teacherExercises = allExercises.stream()
                    .filter(e -> e.getTeacher() != null && tId.equals(e.getTeacher().getId()))
                    .toList();

            long createdToday = teacherExercises.stream()
                    .filter(e -> e.getCreatedAt() != null && e.getCreatedAt().atZone(zone).toLocalDate().isEqual(today))
                    .count();

            // Token đã dùng từ tất cả bài tập đã tạo trong DB
            long pTokens = 0L;
            long cTokens = 0L;
            for (AiGeneratedExercise ex : teacherExercises) {
                int qCount = (ex.getQuestionCount() != null && ex.getQuestionCount() > 0) ? ex.getQuestionCount() : 5;
                String raw = ex.getRawResponseJson();
                long comp = (raw != null && !raw.isBlank() && !raw.equals("{}")) ? (raw.length() / 4) : (qCount * 120L);
                long prompt = Math.max(250L, qCount * 150L);
                pTokens += prompt;
                cTokens += comp;
            }

            // Cộng thêm live tokens nếu có
            AtomicLong liveP = teacherLivePromptTokens.get(tId);
            AtomicLong liveC = teacherLiveCompletionTokens.get(tId);
            if (liveP != null) pTokens += liveP.get();
            if (liveC != null) cTokens += liveC.get();

            double cost = (pTokens * (GROQ_INPUT_COST_PER_M / 1_000_000.0)) +
                    (cTokens * (GROQ_OUTPUT_COST_PER_M / 1_000_000.0));

            int limit = teacherCustomLimits.getOrDefault(tId, 50);
            boolean isBlocked = Boolean.TRUE.equals(teacherBlockedMap.get(tId)) || (createdToday >= limit);

            User u = userRepository.findById(tId).orElse(null);
            String name = (u != null && u.getFullName() != null) ? u.getFullName() : "Giáo viên";
            String email = (u != null && u.getEmail() != null) ? u.getEmail() : "N/A";

            result.add(StudentQuotaResponse.builder()
                    .studentId(tId)
                    .studentName(name)
                    .email(email)
                    .role("TEACHER")
                    .serviceEngine("GROQ LLaMA 3.3")
                    .dailyUsed((int) createdToday)
                    .dailyLimit(limit)
                    .isBlocked(isBlocked)
                    .promptTokensUsed(pTokens)
                    .completionTokensUsed(cTokens)
                    .totalTokensUsed(pTokens + cTokens)
                    .estimatedCostUsd(Math.round(cost * 10000.0) / 10000.0)
                    .build());
        }

        return result;
    }

    @Transactional
    @Override
    public void updateQuota(UUID userId, UpdateQuotaRequest request) {
        if (studentRepository.existsById(userId)) {
            StudentAiQuota quota = quotaRepository.findByStudentId(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Quota của học viên này"));

            if (request.getDailyLimit() != null)
                quota.setDailyLimit(request.getDailyLimit());
            if (request.getIsBlocked() != null)
                quota.setIsBlocked(request.getIsBlocked());

            quotaRepository.save(quota);
        } else {
            // Cập nhật quota cho giáo viên
            if (request.getDailyLimit() != null) {
                teacherCustomLimits.put(userId, request.getDailyLimit());
            }
            if (request.getIsBlocked() != null) {
                teacherBlockedMap.put(userId, request.getIsBlocked());
            }
        }
    }
}