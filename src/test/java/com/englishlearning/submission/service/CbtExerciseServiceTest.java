package com.englishlearning.submission.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.service.UserStreakService;
import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.dto.GradingResult;
import com.englishlearning.submission.dto.SubmissionRequest;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.submission.repository.StudentAnswerRepository;
import com.englishlearning.submission.service.impl.CbtExerciseServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit Test cho CbtExerciseService (UC_STU_01: CBT Exam Session & Queue Dispatch)
 * Tuân thủ JUnit 5, Mockito, AssertJ, argument-matching.md, keep-cause-effect-clear.md.
 */
@ExtendWith(MockitoExtension.class)
class CbtExerciseServiceTest {

    @Mock
    private AssignmentAttemptRepository attemptRepository;

    @Mock
    private AssignmentQuestionRepository questionRepository;

    @Mock
    private StudentAnswerRepository studentAnswerRepository;

    @Mock
    private GradingEngineService gradingEngineService;

    @Mock
    private UserStreakService userStreakService;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private CbtExerciseServiceImpl cbtExerciseService;

    // Cố định mốc thời gian kiểm thử (ISO-8601 UTC) tránh flaky test do thời gian động
    private static final Instant FIXED_START_TIME = Instant.parse("2026-10-29T10:00:00Z");
    private static final Instant ON_TIME_SUBMIT = Instant.parse("2026-10-29T10:25:00Z"); // 25 phút
    private static final Instant OVERDUE_SUBMIT = Instant.parse("2026-10-29T10:35:00Z"); // 35 phút (> 30 phút limit)

    @Test
    @DisplayName("should_RejectSubmission_when_ExamTimeLimitExceeded: Từ chối bài thi khi vượt quá thời gian làm bài quy định")
    void should_RejectSubmission_when_ExamTimeLimitExceeded() {
        // Given
        UUID studentId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID attemptId = UUID.fromString("22222222-2222-2222-2222-222222222222");
        UUID assignmentId = UUID.fromString("33333333-3333-3333-3333-333333333333");

        Assignment assignment = Assignment.builder()
                .id(assignmentId)
                .timeLimitMinutes(30) // Giới hạn 30 phút
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .assignment(assignment)
                .startedAt(FIXED_START_TIME)
                .submittedAt(null)
                .build();

        SubmissionRequest request = SubmissionRequest.builder()
                .assignmentId(assignmentId)
                .answers(List.of())
                .build();

        // Tuân thủ argument-matching.md: dùng attemptId, studentId cụ thể
        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));

        // When / Then: Nộp bài lúc 10:35 (quá 35 phút > 30 phút)
        assertThatThrownBy(() -> cbtExerciseService.submitCbtExercise(studentId, attemptId, request, OVERDUE_SUBMIT))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Thời gian làm bài thi đã vượt quá giới hạn quy định");

        verify(gradingEngineService, never()).evaluateSubmission(any(), any());
        verify(attemptRepository, never()).save(any());
        verify(rabbitTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    @DisplayName("should_CalculateExactScoreAndCompleteAttempt_when_SubmittingPurelyObjectiveQuestions: Hoàn thành bài thi trắc nghiệm và cập nhật streak")
    void should_CalculateExactScoreAndCompleteAttempt_when_SubmittingPurelyObjectiveQuestions() {
        // Given
        UUID studentId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        UUID attemptId = UUID.fromString("55555555-5555-5555-5555-555555555555");
        UUID assignmentId = UUID.fromString("66666666-6666-6666-6666-666666666666");

        Assignment assignment = Assignment.builder()
                .id(assignmentId)
                .timeLimitMinutes(30)
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .assignment(assignment)
                .startedAt(FIXED_START_TIME)
                .submittedAt(null)
                .answers(new ArrayList<>())
                .build();

        SubmissionRequest request = SubmissionRequest.builder()
                .assignmentId(assignmentId)
                .answers(List.of())
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assignmentId)).thenReturn(List.of());

        GradingResult mockGrading = GradingResult.builder()
                .totalScore(8.0)
                .maxPossibleScore(10.0)
                .scaledScore(8.0)
                .earnedPointsPerQuestion(Collections.emptyMap())
                .correctnessPerQuestion(Collections.emptyMap())
                .requiresAiGrading(false) // Thuần trắc nghiệm khách quan
                .build();
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(mockGrading);

        // When: Nộp bài đúng hạn (25 phút < 30 phút)
        AttemptResponse response = cbtExerciseService.submitCbtExercise(studentId, attemptId, request, ON_TIME_SUBMIT);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo(AttemptStatus.COMPLETED.name());
        assertThat(response.getScore()).isEqualTo(8.0);
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        assertThat(attempt.getTotalScore()).isEqualTo(8.0);
        assertThat(attempt.getSubmittedAt()).isEqualTo(ON_TIME_SUBMIT);

        // Không gửi queue AI
        verify(rabbitTemplate, never()).convertAndSend(anyString(), any(Object.class));

        // Cập nhật streak
        verify(userStreakService, times(1)).updateStreakOnPlanCompletion(eq(studentId), any(LocalDate.class));

        // Verify lưu repository
        verify(attemptRepository, times(1)).save(attempt);
    }

    @Test
    @DisplayName("should_TriggerAsyncGradingQueue_when_SubmissionContainsAiGradedQuestions: Đẩy vào message queue bất đồng bộ cho bài tự luận/AI")
    void should_TriggerAsyncGradingQueue_when_SubmissionContainsAiGradedQuestions() {
        // Given
        UUID studentId = UUID.fromString("77777777-7777-7777-7777-777777777777");
        UUID attemptId = UUID.fromString("88888888-8888-8888-8888-888888888888");
        UUID assignmentId = UUID.fromString("99999999-9999-9999-9999-999999999999");
        UUID essayQId = UUID.randomUUID();

        Assignment assignment = Assignment.builder()
                .id(assignmentId)
                .timeLimitMinutes(45)
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .assignment(assignment)
                .startedAt(FIXED_START_TIME)
                .submittedAt(null)
                .answers(new ArrayList<>())
                .build();

        SubmissionRequest request = SubmissionRequest.builder()
                .assignmentId(assignmentId)
                .answers(List.of())
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assignmentId)).thenReturn(List.of());

        GradingResult mockGrading = GradingResult.builder()
                .totalScore(0.0)
                .scaledScore(0.0)
                .earnedPointsPerQuestion(Collections.emptyMap())
                .correctnessPerQuestion(Collections.emptyMap())
                .requiresAiGrading(true) // Có câu hỏi tự luận/audio cần AI chấm
                .aiGradedQuestionIds(List.of(essayQId))
                .build();
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(mockGrading);

        // When
        AttemptResponse response = cbtExerciseService.submitCbtExercise(studentId, attemptId, request, ON_TIME_SUBMIT);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo(AttemptStatus.SUBMITTED.name());
        assertThat(attempt.getStatus()).isEqualTo(AttemptStatus.SUBMITTED);

        // Đẩy vào RabbitMQ queue ai.grading.queue
        verify(rabbitTemplate, times(1)).convertAndSend(eq(CbtExerciseServiceImpl.AI_GRADING_QUEUE), any(Map.class));

        // Chưa cập nhật streak vì bài thi chưa hoàn thành chấm điểm
        verify(userStreakService, never()).updateStreakOnPlanCompletion(any(), any());

        verify(attemptRepository, times(1)).save(attempt);
    }

    @Test
    @DisplayName("should_ThrowBadRequestException_when_AttemptAlreadySubmitted: Chặn nộp lại bài thi đã nộp trước đó")
    void should_ThrowBadRequestException_when_AttemptAlreadySubmitted() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();

        AssignmentAttempt submittedAttempt = AssignmentAttempt.builder()
                .id(attemptId)
                .submittedAt(Instant.now().minusSeconds(300)) // Đã nộp 5 phút trước
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(submittedAttempt));

        // When / Then
        assertThatThrownBy(() -> cbtExerciseService.submitCbtExercise(studentId, attemptId, new SubmissionRequest(), ON_TIME_SUBMIT))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Bài thi này đã được nộp trước đó.");

        verify(attemptRepository, never()).save(any());
    }

    @Test
    @DisplayName("should_ThrowResourceNotFoundException_when_AttemptNotFound: Báo lỗi khi không tìm thấy lượt làm bài")
    void should_ThrowResourceNotFoundException_when_AttemptNotFound() {
        // Given
        UUID studentId = UUID.randomUUID();
        UUID nonExistentAttemptId = UUID.randomUUID();

        when(attemptRepository.findByIdAndStudentId(nonExistentAttemptId, studentId)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> cbtExerciseService.submitCbtExercise(studentId, nonExistentAttemptId, new SubmissionRequest(), ON_TIME_SUBMIT))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Không tìm thấy lượt làm bài");
    }
}
