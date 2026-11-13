package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.dto.AiStatsResponse;
import com.englishlearning.ai.dto.StudentQuotaResponse;
import com.englishlearning.ai.dto.UpdateQuotaRequest;
import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
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
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.StudentAnswer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AiMonitoringServiceImpl - Kill Switch, Rate Limiter, Quotas & Cost Analytics")
class AiMonitoringServiceImplTest {

    @Mock private StudentAiQuotaRepository quotaRepository;
    @Mock private AiEvaluationRepository aiEvaluationRepository;
    @Mock private AiGeneratedExerciseRepository aiGeneratedExerciseRepository;
    @Mock private StudentRepository studentRepository;
    @Mock private TeacherRepository teacherRepository;
    @Mock private UserRepository userRepository;

    private AiMonitoringServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AiMonitoringServiceImpl(
                quotaRepository,
                aiEvaluationRepository,
                aiGeneratedExerciseRepository,
                studentRepository,
                teacherRepository,
                userRepository
        );
    }

    @Test
    @DisplayName("Global Kill-Switch: bật chặn toàn bộ yêu cầu với HTTP 429 và tắt cho phép chạy lại")
    void toggleGlobalKillSwitch_blocksAndResumesTraffic() {
        assertThat(service.isGlobalKillSwitchActive()).isFalse();

        boolean activated = service.toggleGlobalKillSwitch();
        assertThat(activated).isTrue();
        assertThat(service.isGlobalKillSwitchActive()).isTrue();

        UUID userId = UUID.randomUUID();
        assertThatThrownBy(() -> service.checkRateLimitAndQuota(userId, false))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    ResponseStatusException rse = (ResponseStatusException) ex;
                    assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(rse.getReason()).contains("tạm dừng");
                });

        boolean deactivated = service.toggleGlobalKillSwitch();
        assertThat(deactivated).isFalse();
        service.checkRateLimitAndQuota(userId, true);
    }

    @Test
    @DisplayName("checkRateLimitAndQuota (Student): chặn khi bị khóa, chạm ngưỡng ngày (tự động khóa) hoặc vượt 3 lần/phút")
    void checkRateLimitAndQuota_studentQuotasAndSlidingWindow() {
        UUID blockedId = UUID.randomUUID();
        StudentAiQuota blockedQuota = StudentAiQuota.builder()
                .student(Student.builder().id(blockedId).build())
                .isBlocked(true)
                .build();
        when(quotaRepository.findByStudentId(blockedId)).thenReturn(Optional.of(blockedQuota));

        assertThatThrownBy(() -> service.checkRateLimitAndQuota(blockedId, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("đạt giới hạn");

        UUID maxedId = UUID.randomUUID();
        StudentAiQuota maxedQuota = StudentAiQuota.builder()
                .student(Student.builder().id(maxedId).build())
                .dailyLimit(5)
                .usedToday(5)
                .lastResetDate(LocalDate.now())
                .isBlocked(false)
                .build();
        when(quotaRepository.findByStudentId(maxedId)).thenReturn(Optional.of(maxedQuota));

        assertThatThrownBy(() -> service.checkRateLimitAndQuota(maxedId, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("đạt giới hạn");
        assertThat(maxedQuota.getIsBlocked()).isTrue();
        verify(quotaRepository).save(maxedQuota);

        // Sliding window student: tối đa 3 lần/phút -> lần thứ 4 ném 429
        UUID activeStudentId = UUID.randomUUID();
        StudentAiQuota activeQuota = StudentAiQuota.builder()
                .student(Student.builder().id(activeStudentId).build())
                .dailyLimit(20)
                .usedToday(0)
                .lastResetDate(LocalDate.now())
                .isBlocked(false)
                .build();
        when(quotaRepository.findByStudentId(activeStudentId)).thenReturn(Optional.of(activeQuota));

        service.checkRateLimitAndQuota(activeStudentId, false);
        service.checkRateLimitAndQuota(activeStudentId, false);
        service.checkRateLimitAndQuota(activeStudentId, false);

        assertThatThrownBy(() -> service.checkRateLimitAndQuota(activeStudentId, false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("tối đa 3 lần/phút");
    }

    @Test
    @DisplayName("checkRateLimitAndQuota (Teacher): giới hạn 5 lần/phút, custom daily limit và teacherBlockedMap")
    void checkRateLimitAndQuota_teacherRateAndCustomQuotas() {
        UUID teacherId = UUID.randomUUID();

        // Mặc định cho phép 5 calls/phút -> call thứ 6 bị rate limit
        for (int i = 0; i < 5; i++) {
            service.checkRateLimitAndQuota(teacherId, true);
        }
        assertThatThrownBy(() -> service.checkRateLimitAndQuota(teacherId, true))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("tối đa 5 lần/phút");

        // Giáo viên mới: custom limit = 2, ghi nhận 2 lần -> lần kế tiếp chạm ngưỡng ngày
        UUID cappedTeacher = UUID.randomUUID();
        UpdateQuotaRequest capReq = new UpdateQuotaRequest();
        capReq.setDailyLimit(2);
        when(studentRepository.existsById(cappedTeacher)).thenReturn(false);
        service.updateQuota(cappedTeacher, capReq);

        service.recordTokenUsage(cappedTeacher, "TEACHER", 100, 100, "GROQ");
        service.recordTokenUsage(cappedTeacher, "TEACHER", 100, 100, "GROQ");

        assertThatThrownBy(() -> service.checkRateLimitAndQuota(cappedTeacher, true))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("2 lượt/ngày");

        // Khóa giáo viên trực tiếp qua updateQuota
        UUID lockedTeacher = UUID.randomUUID();
        UpdateQuotaRequest blockReq = new UpdateQuotaRequest();
        blockReq.setIsBlocked(true);
        when(studentRepository.existsById(lockedTeacher)).thenReturn(false);
        service.updateQuota(lockedTeacher, blockReq);

        assertThatThrownBy(() -> service.checkRateLimitAndQuota(lockedTeacher, true))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("tạm khóa");
    }

    @Test
    @DisplayName("recordTokenUsage: tính đúng chi phí Gemini/Groq, tự tạo quota, reset qua ngày mới và khóa khi hết hạn mức")
    void recordTokenUsage_accumulatesCostsResetAndBlocksStudentAtLimit() {
        UUID studentId = UUID.randomUUID();
        Student student = Student.builder().id(studentId).build();
        StudentAiQuota yesterdayQuota = StudentAiQuota.builder()
                .student(student)
                .dailyLimit(2)
                .usedToday(2)
                .lastResetDate(LocalDate.now().minusDays(1))
                .isBlocked(true)
                .promptTokensUsed(0L)
                .completionTokensUsed(0L)
                .estimatedCostUsd(0.0)
                .build();

        when(studentRepository.existsById(studentId)).thenReturn(true);
        when(quotaRepository.findByStudentId(studentId)).thenReturn(Optional.of(yesterdayQuota));
        when(quotaRepository.save(any(StudentAiQuota.class))).thenAnswer(inv -> inv.getArgument(0));

        // Lần 1 trong ngày mới -> reset usedToday=1, mở khóa, cộng token Gemini
        service.recordTokenUsage(studentId, 1_000_000L, 1_000_000L);
        assertThat(yesterdayQuota.getUsedToday()).isEqualTo(1);
        assertThat(yesterdayQuota.getIsBlocked()).isFalse();
        assertThat(yesterdayQuota.getLastResetDate()).isEqualTo(LocalDate.now());
        // Cost Gemini = 0.075 + 0.30 = 0.375
        assertThat(yesterdayQuota.getEstimatedCostUsd()).isCloseTo(0.375, within(1e-6));

        // Lần 2 trong ngày -> chạm limit=2 -> tự động isBlocked=true
        service.recordTokenUsage(studentId, "STUDENT", 0L, 0L, "GEMINI");
        assertThat(yesterdayQuota.getUsedToday()).isEqualTo(2);
        assertThat(yesterdayQuota.getIsBlocked()).isTrue();

        // Kiểm tra overload cho student chưa có quota -> tìm student và tạo mới
        UUID newcomerId = UUID.randomUUID();
        when(studentRepository.existsById(newcomerId)).thenReturn(true);
        when(quotaRepository.findByStudentId(newcomerId)).thenReturn(Optional.empty());
        when(studentRepository.findById(newcomerId)).thenReturn(Optional.of(Student.builder().id(newcomerId).build()));

        service.recordTokenUsage(newcomerId, "STUDENT", 500L, 500L, "GEMINI");
        verify(quotaRepository, atLeast(2)).save(any(StudentAiQuota.class));
    }

    @Test
    @DisplayName("getStats & getAllQuotas: tổng hợp DB + live accumulators, 7 ngày biểu đồ, backfill token & ước tính Groq/Gemini")
    void getStatsAndGetAllQuotas_aggregatesDatabaseAndLiveMetrics() {
        UUID s1 = UUID.randomUUID();
        UUID s2 = UUID.randomUUID();
        UUID t1 = UUID.randomUUID();
        UUID tExtra = UUID.randomUUID();

        Student student1 = Student.builder().id(s1).build();
        Student student2 = Student.builder().id(s2).build();
        Teacher teacher1 = Teacher.builder().id(t1).build();
        Teacher teacherExtra = Teacher.builder().id(tExtra).build();

        // Student 1 quota có token=0 để kích hoạt backfill từ AiEvaluation, kèm lastResetDate cũ để trigger reset
        StudentAiQuota q1 = StudentAiQuota.builder()
                .student(student1)
                .dailyLimit(20)
                .usedToday(4)
                .lastResetDate(LocalDate.now().minusDays(2))
                .isBlocked(true)
                .promptTokensUsed(0L)
                .completionTokensUsed(0L)
                .estimatedCostUsd(0.0)
                .build();

        AssignmentAttempt attempt1 = AssignmentAttempt.builder().student(student1).build();
        StudentAnswer ans1 = StudentAnswer.builder().attempt(attempt1).build();
        AiEvaluation evWithTokens = AiEvaluation.builder()
                .studentAnswer(ans1)
                .evalType(AiEvaluationType.SPEAKING)
                .tokensUsed(1000)
                .createdAt(Instant.now())
                .build();
        AiEvaluation evEstimated = AiEvaluation.builder()
                .studentAnswer(ans1)
                .evalType(AiEvaluationType.WRITING)
                .sttTranscript("transcript 12345678")
                .suggestionsJson("{\"tip\":\"good job today\"}")
                .createdAt(Instant.now().minusSeconds(3600))
                .build();

        AiGeneratedExercise ex1 = AiGeneratedExercise.builder()
                .teacher(teacher1)
                .targetCefr("B2")
                .exerciseType("QUIZ")
                .questionCount(4)
                .rawResponseJson("{\"questions\":[1,2,3,4]}")
                .createdAt(Instant.now())
                .build();
        AiGeneratedExercise ex2 = AiGeneratedExercise.builder()
                .teacher(teacherExtra)
                .targetCefr("B1")
                .exerciseType("MATCHING")
                .questionCount(6)
                .rawResponseJson("{}")
                .createdAt(Instant.now())
                .build();

        when(quotaRepository.findAll()).thenReturn(List.of(q1));
        when(aiEvaluationRepository.findAll()).thenReturn(List.of(evWithTokens, evEstimated));
        when(aiGeneratedExerciseRepository.findAll()).thenReturn(List.of(ex1, ex2));
        when(studentRepository.findAll()).thenReturn(List.of(student1, student2));
        when(teacherRepository.findAll()).thenReturn(List.of(teacher1));
        when(quotaRepository.findByStudentId(s1)).thenReturn(Optional.of(q1));
        when(quotaRepository.findByStudentId(s2)).thenReturn(Optional.empty());
        when(quotaRepository.save(any(StudentAiQuota.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(s1)).thenReturn(Optional.of(User.builder().id(s1).firstName("Nguyễn").lastName("An").email("an@test.com").build()));
        when(userRepository.findById(t1)).thenReturn(Optional.of(User.builder().id(t1).firstName("Thầy").lastName("Bình").email("binh@test.com").build()));
        when(userRepository.findById(s2)).thenReturn(Optional.empty());
        when(userRepository.findById(tExtra)).thenReturn(Optional.empty());

        // Bơm thêm live token Groq để kiểm tra cộng dồn live + DB
        service.recordTokenUsage(t1, "TEACHER", 400L, 600L, "GROQ");

        AiStatsResponse stats = service.getStats();

        assertThat(stats.getDailyUsage()).hasSize(7);
        assertThat(stats.getGeminiStats().isHealthy()).isTrue();
        assertThat(stats.getGroqStats().getTotalRequests()).isEqualTo(3L); // 2 DB exercises + 1 live request
        assertThat(stats.getGeminiStats().getTotalRequests()).isEqualTo(2L);
        assertThat(stats.getTotalTokens()).isGreaterThan(0L);
        assertThat(stats.getStudentQuotas()).hasSize(4); // 2 students + 2 teachers

        // q1 phải đã được reset ngày & backfill token từ studentEvals
        assertThat(q1.getLastResetDate()).isEqualTo(LocalDate.now());
        assertThat(q1.getPromptTokensUsed()).isGreaterThan(0L);

        StudentQuotaResponse s1Quota = stats.getStudentQuotas().stream()
                .filter(q -> s1.equals(q.getStudentId()))
                .findFirst().orElseThrow();
        assertThat(s1Quota.getStudentName()).isEqualTo("Nguyễn An");
        assertThat(s1Quota.getRole()).isEqualTo("STUDENT");
        assertThat(s1Quota.getDailyUsed()).isEqualTo(2); // 2 evaluations today

        StudentQuotaResponse tExtraQuota = stats.getStudentQuotas().stream()
                .filter(q -> tExtra.equals(q.getStudentId()))
                .findFirst().orElseThrow();
        assertThat(tExtraQuota.getStudentName()).isEqualTo("Giáo viên");
        assertThat(tExtraQuota.getRole()).isEqualTo("TEACHER");
    }

    @Test
    @DisplayName("updateQuota: ném ResourceNotFoundException khi học sinh chưa có bản ghi quota, cập nhật thành công khi tồn tại")
    void updateQuota_handlesStudentNotFoundAndSuccess() {
        UUID studentId = UUID.randomUUID();
        UpdateQuotaRequest req = new UpdateQuotaRequest();
        req.setDailyLimit(100);
        req.setIsBlocked(false);

        when(studentRepository.existsById(studentId)).thenReturn(true);
        when(quotaRepository.findByStudentId(studentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateQuota(studentId, req))
                .isInstanceOf(ResourceNotFoundException.class);

        StudentAiQuota existing = StudentAiQuota.builder()
                .student(Student.builder().id(studentId).build())
                .dailyLimit(20)
                .isBlocked(true)
                .build();
        when(quotaRepository.findByStudentId(studentId)).thenReturn(Optional.of(existing));

        service.updateQuota(studentId, req);

        assertThat(existing.getDailyLimit()).isEqualTo(100);
        assertThat(existing.getIsBlocked()).isFalse();
        verify(quotaRepository).save(existing);
    }
}
