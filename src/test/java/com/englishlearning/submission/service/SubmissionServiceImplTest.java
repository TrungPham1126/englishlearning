package com.englishlearning.submission.service;

import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionOption;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ForbiddenException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import com.englishlearning.curriculum.service.UserStreakService;
import com.englishlearning.notification.service.NotificationService;
import com.englishlearning.submission.dto.AttemptResponse;
import com.englishlearning.submission.dto.ExamViolationRequest;
import com.englishlearning.submission.dto.GradingResult;
import com.englishlearning.submission.dto.StudentAssignmentSummaryResponse;
import com.englishlearning.submission.dto.SubmissionRequest;
import com.englishlearning.submission.dto.SubmissionSummaryResponse;
import com.englishlearning.submission.dto.TeacherGradeRequest;
import com.englishlearning.submission.dto.TeacherStudentSubmissionDto;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.entity.StudentAnswer;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.submission.repository.StudentAnswerRepository;
import com.englishlearning.submission.service.impl.SubmissionServiceImpl;
import com.englishlearning.video.service.R2StorageService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SubmissionServiceImpl - Student Learning Profile Submissions & Re-grading")
class SubmissionServiceImplTest {

    @Mock
    private R2StorageService r2StorageService;
    @Mock
    private AssignmentAttemptRepository attemptRepository;
    @Mock
    private StudentAnswerRepository answerRepository;
    @Mock
    private AssignmentQuestionRepository questionRepository;
    @Mock
    private AssignmentRepository assignmentRepository;
    @Mock
    private AnalyticsService analyticsService;
    @Mock
    private EntityManager entityManager;
    @Mock
    private AiEvaluationRepository aiEvaluationRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private ClassStudentRepository classStudentRepository;
    @Mock
    private StudentDailyProgressRepository progressRepository;
    @Mock
    private UserStreakService userStreakService;
    @Mock
    private DailyPlanItemRepository dailyPlanItemRepository;
    @Mock
    private GradingEngineService gradingEngineService;

    @InjectMocks
    private SubmissionServiceImpl submissionService;

    @Test
    @DisplayName("getStudentClassroomSubmissions nhóm đúng ngày lộ trình & đính kèm điểm AI")
    @SuppressWarnings("unchecked")
    void getStudentClassroomSubmissions_MapsDailyPlanAndAiEvaluation() {
        UUID classId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();

        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Viết đoạn văn về lợi ích đại học")
                .skillType(SkillType.WRITING)
                .build();

        StudentAnswer ans = new StudentAnswer();
        ans.setId(answerId);
        ans.setTextResponse("University brings many career opportunities and personal growth.");
        ans.setEvalFeedback("{\"overallBand\": 6.5}");

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.SUBMITTED)
                .totalScore(6.5)
                .submittedAt(Instant.parse("2026-11-12T09:00:00Z"))
                .answers(List.of(ans))
                .build();

        when(attemptRepository.findSubmittedByClassroomIdAndStudentId(classId, studentId))
                .thenReturn(List.of(attempt));

        TypedQuery<Object[]> typedQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(anyString(), eq(Object[].class))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("ids"), any())).thenReturn(typedQuery);
        when(typedQuery.getResultList()).thenReturn(List.<Object[]>of(new Object[]{assId, QuestionType.ESSAY}));

        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(UUID.randomUUID())
                .dayNumber(2)
                .title("Academic Writing Basics")
                .scheduledDate(LocalDate.of(2026, 11, 12))
                .build();
        DailyPlanItem planItem = DailyPlanItem.builder()
                .id(UUID.randomUUID())
                .dailyPlan(plan)
                .assignment(assignment)
                .build();
        when(dailyPlanItemRepository.findByClassroomIdWithDailyPlanAndAssignment(classId))
                .thenReturn(List.of(planItem));

        AiEvaluation eval = AiEvaluation.builder()
                .id(UUID.randomUUID())
                .studentAnswer(ans)
                .evalType(AiEvaluationType.WRITING)
                .overallScore(6.5)
                .estimatedCefr("B2")
                .build();
        when(aiEvaluationRepository.findByStudentId(studentId)).thenReturn(List.of(eval));

        List<TeacherStudentSubmissionDto> result = submissionService.getStudentClassroomSubmissions(classId, studentId);

        assertThat(result).hasSize(1);
        TeacherStudentSubmissionDto dto = result.get(0);
        assertThat(dto.getAttemptId()).isEqualTo(attemptId);
        assertThat(dto.getDayNumber()).isEqualTo(2);
        assertThat(dto.getDayTitle()).isEqualTo("Academic Writing Basics");
        assertThat(dto.getScheduledDate()).isEqualTo(LocalDate.of(2026, 11, 12));
        assertThat(dto.getHasAiEvaluation()).isTrue();
        assertThat(dto.getAiScore()).isEqualTo(6.5);
        assertThat(dto.getAiCefr()).isEqualTo("B2");
        assertThat(dto.getAiEvalType()).isEqualTo("WRITING");
        assertThat(dto.getQuestionTypes()).containsExactly("ESSAY");
    }

    @Test
    @DisplayName("getAttemptDetail luôn trả về AiEvaluationDetail đầy đủ dù evalFeedback đã có sẵn")
    void getAttemptDetail_IncludesStructuredAiEvaluationEvenWhenFeedbackExists() {
        UUID attemptId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID ansId = UUID.randomUUID();
        UUID evalId = UUID.randomUUID();

        AssignmentQuestion question = AssignmentQuestion.builder()
                .id(qId)
                .orderIndex(1)
                .questionType(QuestionType.AUDIO_RESPONSE)
                .promptText("Describe your hometown")
                .points(10.0)
                .build();

        Assignment assignment = Assignment.builder()
                .id(UUID.randomUUID())
                .title("Speaking Topic 1")
                .skillType(SkillType.SPEAKING)
                .questions(List.of(question))
                .build();

        StudentAnswer ans = new StudentAnswer();
        ans.setId(ansId);
        ans.setQuestion(question);
        ans.setAudioResponseUrl("https://cdn.example.com/audio.webm");
        ans.setEvalFeedback("{\"overallBand\": 7.0, \"generalFeedback\": \"Tốt\"}");
        ans.setEarnedPoints(7.0);

        Student student = Student.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(UUID.randomUUID()).firstName("An").lastName("Nguyen").build())
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.SUBMITTED)
                .totalScore(7.0)
                .answers(List.of(ans))
                .build();

        when(attemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));
        when(assignmentRepository.findByIdWithQuestions(assignment.getId())).thenReturn(Optional.of(assignment));

        AiEvaluation eval = AiEvaluation.builder()
                .id(evalId)
                .studentAnswer(ans)
                .evalType(AiEvaluationType.SPEAKING)
                .overallScore(7.0)
                .pronunciationScore(7.0)
                .fluencyScore(7.5)
                .grammarScore(6.5)
                .vocabularyScore(7.0)
                .coherenceScore(7.0)
                .estimatedCefr("B2+")
                .sttTranscript("My hometown is peaceful and green.")
                .correctedText("My hometown is remarkably peaceful and vibrant.")
                .mistakesJson("[]")
                .suggestionsJson("[\"Speak slightly slower\"]")
                .build();
        when(aiEvaluationRepository.findByStudentAnswerId(ansId)).thenReturn(Optional.of(eval));

        AttemptResponse response = submissionService.getAttemptDetail(attemptId, null, true);

        assertThat(response.getQuestions()).hasSize(1);
        AttemptResponse.QuestionResultDetail qDetail = response.getQuestions().get(0);
        assertThat(qDetail.getEvalFeedback()).contains("\"overallBand\": 7.0");
        assertThat(qDetail.getAiEvaluation()).isNotNull();
        assertThat(qDetail.getAiEvaluation().getId()).isEqualTo(evalId);
        assertThat(qDetail.getAiEvaluation().getOverallScore()).isEqualTo(7.0);
        assertThat(qDetail.getAiEvaluation().getEstimatedCefr()).isEqualTo("B2+");
        assertThat(qDetail.getAiEvaluation().getSttTranscript()).isEqualTo("My hometown is peaceful and green.");
    }

    @Test
    @DisplayName("gradeSubmission cho phép giáo viên chấm lại bài đã COMPLETED và đồng bộ điểm StudentAnswer")
    void gradeSubmission_RegradesCompletedAttemptAndSingleEssayAnswer() {
        UUID attemptId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();

        AssignmentQuestion q = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .questionType(QuestionType.ESSAY)
                .points(10.0)
                .build();

        StudentAnswer ans = new StudentAnswer();
        ans.setId(UUID.randomUUID());
        ans.setQuestion(q);
        ans.setEarnedPoints(6.5);

        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Essay 1")
                .skillType(SkillType.WRITING)
                .build();

        Student student = Student.builder()
                .id(studentId)
                .user(User.builder().id(studentId).firstName("Binh").lastName("Tran").build())
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.COMPLETED)
                .totalScore(6.5)
                .teacherFeedback("Cần sửa thì động từ")
                .answers(List.of(ans))
                .build();

        when(attemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        TeacherGradeRequest req = new TeacherGradeRequest();
        req.setFinalScore(8.5);
        req.setFeedback("Sau khi xem lại, lập luận rất thuyết phục.");

        AttemptResponse res = submissionService.gradeSubmission(attemptId, req);

        assertThat(res.getStatus()).isEqualTo("COMPLETED");
        assertThat(res.getScore()).isEqualTo(8.5);
        assertThat(res.getTeacherFeedback()).isEqualTo("Sau khi xem lại, lập luận rất thuyết phục.");
        assertThat(ans.getEarnedPoints()).isEqualTo(8.5);
        assertThat(ans.getIsCorrect()).isTrue();
        verify(answerRepository).save(ans);
        verify(attemptRepository).save(attempt);
    }

    @Test
    @DisplayName("submitAttempt với bài thường Reading/MCQ chỉ đánh dấu hoàn thành, KHÔNG lưu StudentAnswer")
    void submitAttempt_NonExamMcq_MarksCompletedWithoutPersistingStudentAnswers() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID optId = UUID.randomUUID();

        AssignmentQuestion q = AssignmentQuestion.builder()
                .id(qId)
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .points(1.0)
                .build();

        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Reading Practice 1")
                .skillType(SkillType.READING)
                .isExam(false)
                .questions(List.of(q))
                .build();

        Student student = Student.builder()
                .id(studentId)
                .user(User.builder().id(studentId).firstName("Minh").lastName("Le").build())
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(60))
                .answers(new ArrayList<>())
                .build();

        SubmissionRequest req = SubmissionRequest.builder()
                .assignmentId(assId)
                .answers(List.of(SubmissionRequest.AnswerDto.builder()
                        .questionId(qId)
                        .selectedOptionId(optId)
                        .build()))
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(q));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(
                GradingResult.builder()
                        .earnedPointsPerQuestion(Map.of(qId, 1.0))
                        .correctnessPerQuestion(Map.of(qId, true))
                        .build()
        );

        AttemptResponse res = submissionService.submitAttempt(studentId, attemptId, req);

        assertThat(res.getStatus()).isEqualTo("COMPLETED");
        assertThat(res.getScore()).isEqualTo(10.0);
        assertThat(res.getAnswersPersisted()).isFalse();
        assertThat(attempt.getAnswers()).isEmpty();
        verify(answerRepository, never()).save(any());
        verify(attemptRepository).save(attempt);
    }

    @Test
    @DisplayName("submitAttempt với bài thường ESSAY phải lưu chi tiết bài viết StudentAnswer")
    void submitAttempt_NonExamEssay_PersistsStudentAnswer() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();

        AssignmentQuestion q = AssignmentQuestion.builder()
                .id(qId)
                .questionType(QuestionType.ESSAY)
                .points(10.0)
                .build();

        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Writing Task 2")
                .skillType(SkillType.WRITING)
                .isExam(false)
                .questions(List.of(q))
                .build();

        Student student = Student.builder()
                .id(studentId)
                .user(User.builder().id(studentId).firstName("Hoa").lastName("Pham").build())
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(120))
                .answers(new ArrayList<>())
                .build();

        SubmissionRequest req = SubmissionRequest.builder()
                .assignmentId(assId)
                .answers(List.of(SubmissionRequest.AnswerDto.builder()
                        .questionId(qId)
                        .textAnswer("Technology has transformed education in positive ways.")
                        .build()))
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(q));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(
                GradingResult.builder()
                        .earnedPointsPerQuestion(Map.of())
                        .correctnessPerQuestion(Map.of())
                        .build()
        );

        AttemptResponse res = submissionService.submitAttempt(studentId, attemptId, req);

        assertThat(res.getStatus()).isEqualTo("SUBMITTED");
        assertThat(res.getAnswersPersisted()).isTrue();
        assertThat(attempt.getAnswers()).hasSize(1);
        assertThat(attempt.getAnswers().get(0).getTextResponse())
                .isEqualTo("Technology has transformed education in positive ways.");
        verify(answerRepository, times(1)).save(any(StudentAnswer.class));
    }

    @Test
    @DisplayName("submitAttempt với Bài Thi (isExam=true) lưu TOÀN BỘ bài làm kể cả trắc nghiệm")
    void submitAttempt_Exam_PersistsAllAnswersIncludingObjective() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID mcqId = UUID.randomUUID();
        UUID essayId = UUID.randomUUID();
        UUID optId = UUID.randomUUID();

        AssignmentQuestion mcq = AssignmentQuestion.builder()
                .id(mcqId)
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .skillType(SkillType.READING)
                .points(2.0)
                .build();
        AssignmentQuestion essay = AssignmentQuestion.builder()
                .id(essayId)
                .questionType(QuestionType.ESSAY)
                .skillType(SkillType.WRITING)
                .points(8.0)
                .build();

        Assignment exam = Assignment.builder()
                .id(assId)
                .title("Midterm Multi-Skill Exam")
                .skillType(SkillType.READING)
                .isExam(true)
                .questions(List.of(mcq, essay))
                .build();

        Student student = Student.builder()
                .id(studentId)
                .user(User.builder().id(studentId).firstName("Khoa").lastName("Vo").build())
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(exam)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(300))
                .answers(new ArrayList<>())
                .build();

        SubmissionRequest req = SubmissionRequest.builder()
                .assignmentId(assId)
                .answers(List.of(
                        SubmissionRequest.AnswerDto.builder().questionId(mcqId).selectedOptionId(optId).build(),
                        SubmissionRequest.AnswerDto.builder().questionId(essayId).textAnswer("My exam essay").build()
                ))
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(mcq, essay));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(
                GradingResult.builder()
                        .earnedPointsPerQuestion(Map.of(mcqId, 2.0))
                        .correctnessPerQuestion(Map.of(mcqId, true))
                        .build()
        );

        AttemptResponse res = submissionService.submitAttempt(studentId, attemptId, req);

        assertThat(res.getIsExam()).isTrue();
        assertThat(res.getAnswersPersisted()).isTrue();
        assertThat(attempt.getAnswers()).hasSize(2);
        verify(answerRepository, times(2)).save(any(StudentAnswer.class));
    }

    @Test
    @DisplayName("recordAttemptViolation cảnh báo 2 lần đầu, lần 3 đánh dấu gian lận & tự nộp bài")
    void recordAttemptViolation_WarnsTwiceAndFlagsCheatingOnThirdStrike() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID optId = UUID.randomUUID();

        AssignmentQuestion q = AssignmentQuestion.builder()
                .id(qId)
                .orderIndex(1)
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .skillType(SkillType.GRAMMAR)
                .points(10.0)
                .build();

        Assignment exam = Assignment.builder()
                .id(assId)
                .title("Final Proctored Exam")
                .skillType(SkillType.GRAMMAR)
                .isExam(true)
                .strictFullscreen(true)
                .maxViolations(3)
                .questions(List.of(q))
                .build();

        Student student = Student.builder()
                .id(studentId)
                .user(User.builder().id(studentId).firstName("Lan").lastName("Hoang").build())
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(exam)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(90))
                .violationCount(0)
                .isCheatingFlagged(false)
                .answers(new ArrayList<>())
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(assignmentRepository.findByIdWithQuestions(assId)).thenReturn(Optional.of(exam));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(q));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(
                GradingResult.builder()
                        .earnedPointsPerQuestion(Map.of(qId, 10.0))
                        .correctnessPerQuestion(Map.of(qId, true))
                        .build()
        );

        AttemptResponse strike1 = submissionService.recordAttemptViolation(studentId, attemptId,
                ExamViolationRequest.builder().eventType("TAB_SWITCH").reason("Chuyển tab trình duyệt").build());
        assertThat(strike1.getViolationCount()).isEqualTo(1);
        assertThat(strike1.getIsCheatingFlagged()).isFalse();
        assertThat(strike1.getStatus()).isEqualTo("IN_PROGRESS");

        AttemptResponse strike2 = submissionService.recordAttemptViolation(studentId, attemptId,
                ExamViolationRequest.builder().eventType("FULLSCREEN_EXIT").reason("Thoát toàn màn hình").build());
        assertThat(strike2.getViolationCount()).isEqualTo(2);
        assertThat(strike2.getIsCheatingFlagged()).isFalse();
        assertThat(strike2.getStatus()).isEqualTo("IN_PROGRESS");

        AttemptResponse strike3 = submissionService.recordAttemptViolation(studentId, attemptId,
                ExamViolationRequest.builder()
                        .eventType("WINDOW_BLUR")
                        .reason("Rời khỏi cửa sổ thi")
                        .currentAnswers(List.of(SubmissionRequest.AnswerDto.builder()
                                .questionId(qId)
                                .selectedOptionId(optId)
                                .build()))
                        .build());

        assertThat(strike3.getViolationCount()).isEqualTo(3);
        assertThat(strike3.getIsCheatingFlagged()).isTrue();
        assertThat(strike3.getCheatingReason()).contains("3/3");
        assertThat(strike3.getStatus()).isEqualTo("SUBMITTED");
        assertThat(strike3.getViolationLogJson()).contains("TAB_SWITCH", "FULLSCREEN_EXIT", "WINDOW_BLUR");
        assertThat(attempt.getAnswers()).hasSize(1);
        verify(answerRepository, times(1)).save(any(StudentAnswer.class));
    }

    @Test
    @DisplayName("startAttempt chặn học sinh làm lại bài thi nếu lượt trước bị đánh dấu gian lận")
    void startAttempt_ThrowsBadRequest_WhenExamAlreadyFlaggedCheating() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();

        Assignment exam = Assignment.builder()
                .id(assId)
                .title("Locked Exam")
                .skillType(SkillType.READING)
                .isExam(true)
                .maxAttempts(3)
                .build();

        AssignmentAttempt flaggedAttempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .assignment(exam)
                .attemptNumber(1)
                .status(AttemptStatus.SUBMITTED)
                .isCheatingFlagged(true)
                .totalScore(0.0)
                .submittedAt(Instant.now().minusSeconds(60))
                .build();

        when(assignmentRepository.findById(assId)).thenReturn(Optional.of(exam));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assId)).thenReturn(List.of(flaggedAttempt));

        assertThatThrownBy(() -> submissionService.startAttempt(studentId, assId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("gian lận");
    }

    @Test
    @DisplayName("gradeSubmission với bài thi hỗ trợ chấm lại từng câu via answerScores và cập nhật điểm tổng")
    void gradeSubmission_ExamWithAnswerScores_UpdatesIndividualAnswersAndFinalScore() {
        UUID attemptId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID q1Id = UUID.randomUUID();
        UUID q2Id = UUID.randomUUID();

        AssignmentQuestion q1 = AssignmentQuestion.builder()
                .id(q1Id)
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .points(2.0)
                .build();
        AssignmentQuestion q2 = AssignmentQuestion.builder()
                .id(q2Id)
                .questionType(QuestionType.ESSAY)
                .points(10.0)
                .build();

        StudentAnswer ans1 = new StudentAnswer();
        ans1.setId(UUID.randomUUID());
        ans1.setQuestion(q1);
        ans1.setEarnedPoints(0.0);
        ans1.setIsCorrect(false);

        StudentAnswer ans2 = new StudentAnswer();
        ans2.setId(UUID.randomUUID());
        ans2.setQuestion(q2);
        ans2.setEarnedPoints(5.0);
        ans2.setIsCorrect(true);

        Assignment exam = Assignment.builder()
                .id(assId)
                .title("Exam Multi-Skill")
                .skillType(SkillType.WRITING)
                .isExam(true)
                .build();

        Student student = Student.builder()
                .id(studentId)
                .user(User.builder().id(studentId).firstName("Tuan").lastName("Do").build())
                .build();

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(exam)
                .attemptNumber(1)
                .status(AttemptStatus.SUBMITTED)
                .totalScore(5.0)
                .answers(List.of(ans1, ans2))
                .build();

        when(attemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        TeacherGradeRequest req = new TeacherGradeRequest();
        req.setFinalScore(8.0);
        req.setFeedback("Chấm lại phần tự luận và trắc nghiệm.");
        req.setAnswerScores(Map.of(q1Id, 2.0, q2Id, 6.0));

        AttemptResponse res = submissionService.gradeSubmission(attemptId, req);

        assertThat(res.getScore()).isEqualTo(8.0);
        assertThat(res.getStatus()).isEqualTo("COMPLETED");
        assertThat(ans1.getEarnedPoints()).isEqualTo(2.0);
        assertThat(ans1.getIsCorrect()).isTrue();
        assertThat(ans2.getEarnedPoints()).isEqualTo(6.0);
        assertThat(ans2.getIsCorrect()).isTrue();
        verify(answerRepository, times(2)).save(any(StudentAnswer.class));
        verify(attemptRepository).save(attempt);
    }

    @Test
    @DisplayName("startAttempt ném ResourceNotFoundException khi bài tập không tồn tại")
    void startAttempt_AssignmentNotFound_Throws404() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        when(assignmentRepository.findById(assId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> submissionService.startAttempt(studentId, assId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("startAttempt ném ForbiddenException khi học viên không thuộc lớp học của bài tập")
    void startAttempt_NotInClassroom_ThrowsForbidden() {
        UUID studentId = UUID.randomUUID();
        UUID classId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        Classroom classroom = Classroom.builder().id(classId).build();
        Assignment assignment = Assignment.builder().id(assId).classroom(classroom).build();

        when(assignmentRepository.findById(assId)).thenReturn(Optional.of(assignment));
        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(false);

        assertThatThrownBy(() -> submissionService.startAttempt(studentId, assId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("startAttempt khôi phục lượt IN_PROGRESS hiện có và bổ sung câu ESSAY mới chưa có StudentAnswer")
    void startAttempt_ResumesInProgressAndAddsMissingPersistedQuestions() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID qEssayId = UUID.randomUUID();

        AssignmentQuestion essayQ = AssignmentQuestion.builder()
                .id(qEssayId)
                .questionType(QuestionType.ESSAY)
                .promptText("Write about AI")
                .points(10.0)
                .build();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Essay Task")
                .skillType(SkillType.WRITING)
                .questions(List.of(essayQ))
                .build();

        AssignmentAttempt inProgress = AssignmentAttempt.builder()
                .id(attemptId)
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now())
                .answers(new ArrayList<>())
                .build();

        when(assignmentRepository.findById(assId)).thenReturn(Optional.of(assignment));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assId)).thenReturn(List.of(inProgress));
        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(inProgress));
        when(assignmentRepository.findByIdWithQuestions(assId)).thenReturn(Optional.of(assignment));

        AttemptResponse res = submissionService.startAttempt(studentId, assId);

        assertThat(res.getAttemptId()).isEqualTo(attemptId);
        assertThat(res.getStatus()).isEqualTo("IN_PROGRESS");
        verify(answerRepository).save(any(StudentAnswer.class));
        verify(attemptRepository).save(inProgress);
        assertThat(inProgress.getAnswers()).hasSize(1);
    }

    @Test
    @DisplayName("startAttempt từ chối làm lại nếu đã đạt chuẩn (lowestErrorRate <= allowedErrorThreshold)")
    void startAttempt_AlreadyPassedThreshold_ThrowsBadRequest() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .maxAttempts(3)
                .maxAllowedErrorPercent(20.0)
                .questions(new ArrayList<>())
                .build();
        AssignmentAttempt completed = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.COMPLETED)
                .totalScore(8.5)
                .submittedAt(Instant.now())
                .build();

        when(assignmentRepository.findById(assId)).thenReturn(Optional.of(assignment));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assId)).thenReturn(List.of(completed));

        assertThatThrownBy(() -> submissionService.startAttempt(studentId, assId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ĐẠT CHUẨN");
    }

    @Test
    @DisplayName("startAttempt chặn làm lại khi vượt maxAttempts (maxAttempts = 1) dù điểm dưới ngưỡng đạt")
    void startAttempt_ExceededMaxAttempts_ThrowsBadRequest() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .maxAttempts(1)
                .maxAllowedErrorPercent(20.0)
                .questions(new ArrayList<>())
                .build();
        AssignmentAttempt failedAttempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.COMPLETED)
                .totalScore(4.0)
                .submittedAt(Instant.now())
                .build();

        when(assignmentRepository.findById(assId)).thenReturn(Optional.of(assignment));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assId)).thenReturn(List.of(failedAttempt));

        assertThatThrownBy(() -> submissionService.startAttempt(studentId, assId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("NOT PASS");
    }

    @Test
    @DisplayName("startAttempt cho phép làm lại (lượt #2) khi chưa đạt chuẩn và còn lượt trong maxAttempts")
    void startAttempt_BelowThresholdWithinMaxAttempts_CreatesAttemptNumber2() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID newAttemptId = UUID.randomUUID();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Grammar Retake")
                .skillType(SkillType.GRAMMAR)
                .maxAttempts(3)
                .maxAllowedErrorPercent(20.0)
                .questions(new ArrayList<>())
                .build();
        AssignmentAttempt firstAttempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.COMPLETED)
                .totalScore(5.0)
                .submittedAt(Instant.now())
                .build();

        Student studentRef = Student.builder().id(studentId).build();
        when(assignmentRepository.findById(assId)).thenReturn(Optional.of(assignment));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assId)).thenReturn(List.of(firstAttempt));
        when(entityManager.getReference(Student.class, studentId)).thenReturn(studentRef);
        when(attemptRepository.save(any(AssignmentAttempt.class))).thenAnswer(inv -> {
            AssignmentAttempt a = inv.getArgument(0);
            if (a.getId() == null) {
                a.setId(newAttemptId);
            }
            if (a.getAnswers() == null) {
                a.setAnswers(new ArrayList<>());
            }
            return a;
        });
        when(attemptRepository.findByIdAndStudentId(eq(newAttemptId), eq(studentId))).thenAnswer(inv ->
                Optional.of(AssignmentAttempt.builder()
                        .id(newAttemptId)
                        .student(studentRef)
                        .assignment(assignment)
                        .attemptNumber(2)
                        .status(AttemptStatus.IN_PROGRESS)
                        .startedAt(Instant.now())
                        .answers(new ArrayList<>())
                        .build()));
        when(assignmentRepository.findByIdWithQuestions(assId)).thenReturn(Optional.of(assignment));

        AttemptResponse res = submissionService.startAttempt(studentId, assId);

        assertThat(res.getAttemptId()).isEqualTo(newAttemptId);
        assertThat(res.getAttemptNumber()).isEqualTo(2);
        assertThat(res.getStatus()).isEqualTo("IN_PROGRESS");
    }

    @Test
    @DisplayName("submitAttempt hoàn tất bài tự động, cập nhật DailyProgress + Analytics + chịu lỗi UserStreakService")
    void submitAttempt_CompletedWithDailyProgressAndResilientStreak() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID optId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();

        QuestionOption correctOpt = QuestionOption.builder().id(optId).optionLabel("A").optionText("Yes").isCorrect(true).build();
        AssignmentQuestion q1 = AssignmentQuestion.builder()
                .id(qId)
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .points(2.0)
                .options(List.of(correctOpt))
                .build();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Grammar Quiz")
                .skillType(SkillType.GRAMMAR)
                .questions(List.of(q1))
                .build();
        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(Student.builder().id(studentId).build())
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(120))
                .answers(new ArrayList<>())
                .build();

        GradingResult gradingResult = GradingResult.builder()
                .totalScore(2.0)
                .maxPossibleScore(2.0)
                .scaledScore(10.0)
                .earnedPointsPerQuestion(Map.of(qId, 2.0))
                .correctnessPerQuestion(Map.of(qId, true))
                .build();

        DailyStudyPlan plan = DailyStudyPlan.builder().id(planId).dayNumber(1).build();
        DailyPlanItem planItem = DailyPlanItem.builder().id(UUID.randomUUID()).dailyPlan(plan).assignment(assignment).build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(q1));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(gradingResult);
        when(dailyPlanItemRepository.findByAssignmentIdWithDailyPlan(assId)).thenReturn(List.of(planItem));
        when(dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(planId)).thenReturn(List.of(planItem));
        when(attemptRepository.countAttempts(assId, studentId)).thenReturn(1);
        when(progressRepository.findByStudentIdAndDailyPlanId(studentId, planId)).thenReturn(Optional.empty());
        when(entityManager.getReference(Student.class, studentId)).thenReturn(Student.builder().id(studentId).build());
        org.mockito.Mockito.doThrow(new RuntimeException("Redis/Streak DB down")).when(userStreakService).recordActivity(studentId);

        SubmissionRequest req = SubmissionRequest.builder()
                .assignmentId(assId)
                .answers(List.of(SubmissionRequest.AnswerDto.builder()
                        .questionId(qId)
                        .selectedOptionId(optId)
                        .build()))
                .build();

        AttemptResponse res = submissionService.submitAttempt(studentId, attemptId, req);

        assertThat(res.getStatus()).isEqualTo("COMPLETED");
        assertThat(res.getScore()).isEqualTo(10.0);
        assertThat(res.getAiFeedback()).contains("xuất sắc");
        verify(progressRepository).save(any(StudentDailyProgress.class));
        verify(analyticsService).updateSkillScore(studentId, "GRAMMAR", 0.5);
    }

    @Test
    @DisplayName("submitAttempt với AUDIO_RESPONSE đã có AiEvaluation lấy điểm AI & đánh dấu COMPLETED")
    void submitAttempt_AudioResponseWithAiEvaluation_MarksCompletedWithAiScore() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID ansId = UUID.randomUUID();

        AssignmentQuestion speakingQ = AssignmentQuestion.builder()
                .id(qId)
                .questionType(QuestionType.AUDIO_RESPONSE)
                .points(10.0)
                .build();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Speaking AI")
                .skillType(SkillType.SPEAKING)
                .questions(List.of(speakingQ))
                .build();
        StudentAnswer existingAns = new StudentAnswer();
        existingAns.setId(ansId);
        existingAns.setQuestion(speakingQ);
        existingAns.setAudioResponseUrl("https://r2.dev/speak.wav");
        existingAns.setEarnedPoints(0.0);

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(Student.builder().id(studentId).build())
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(45))
                .answers(new ArrayList<>(List.of(existingAns)))
                .build();
        existingAns.setAttempt(attempt);

        AiEvaluation eval = AiEvaluation.builder()
                .id(UUID.randomUUID())
                .overallScore(8.5)
                .suggestionsJson("Good fluency")
                .build();

        GradingResult gradingResult = GradingResult.builder()
                .totalScore(0.0)
                .maxPossibleScore(0.0)
                .scaledScore(0.0)
                .earnedPointsPerQuestion(Map.of())
                .correctnessPerQuestion(Map.of())
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(speakingQ));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(gradingResult);
        when(aiEvaluationRepository.findByStudentAnswerId(ansId)).thenReturn(Optional.of(eval));
        when(dailyPlanItemRepository.findByAssignmentIdWithDailyPlan(assId)).thenReturn(java.util.Collections.emptyList());

        SubmissionRequest req = SubmissionRequest.builder()
                .assignmentId(assId)
                .answers(java.util.Collections.emptyList())
                .build();

        AttemptResponse res = submissionService.submitAttempt(studentId, attemptId, req);

        assertThat(res.getStatus()).isEqualTo("COMPLETED");
        assertThat(res.getScore()).isEqualTo(8.5);
        assertThat(existingAns.getEarnedPoints()).isEqualTo(8.5);
    }

    @Test
    @DisplayName("submitAttempt với ESSAY đã có Writing AiEvaluation (Band 0-9) tự động quy đổi (Band / 9.0) * 10")
    void submitAttempt_EssayWithWritingAiBand_ConvertsBandToTenScale() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID ansId = UUID.randomUUID();

        AssignmentQuestion essayQ = AssignmentQuestion.builder()
                .id(qId)
                .questionType(QuestionType.ESSAY)
                .points(10.0)
                .build();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("IELTS Writing Task 2")
                .skillType(SkillType.WRITING)
                .questions(List.of(essayQ))
                .build();
        StudentAnswer existingAns = new StudentAnswer();
        existingAns.setId(ansId);
        existingAns.setQuestion(essayQ);
        existingAns.setTextResponse("In my opinion, public transport reduces congestion...");
        // Simulates AiLabServiceImpl.evaluateWriting saving raw overallBand=6.5 before submission
        existingAns.setEarnedPoints(6.5);

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(Student.builder().id(studentId).build())
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(120))
                .answers(new ArrayList<>(List.of(existingAns)))
                .build();
        existingAns.setAttempt(attempt);

        AiEvaluation eval = AiEvaluation.builder()
                .id(UUID.randomUUID())
                .evalType(com.englishlearning.ai.entity.AiEvaluationType.WRITING)
                .overallScore(6.5)
                .build();

        GradingResult gradingResult = GradingResult.builder()
                .totalScore(0.0)
                .maxPossibleScore(0.0)
                .scaledScore(0.0)
                .earnedPointsPerQuestion(Map.of())
                .correctnessPerQuestion(Map.of())
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(essayQ));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(gradingResult);
        when(aiEvaluationRepository.findByStudentAnswerId(ansId)).thenReturn(Optional.of(eval));
        when(dailyPlanItemRepository.findByAssignmentIdWithDailyPlan(assId)).thenReturn(java.util.Collections.emptyList());

        SubmissionRequest req = SubmissionRequest.builder()
                .assignmentId(assId)
                .answers(java.util.Collections.emptyList())
                .build();

        AttemptResponse res = submissionService.submitAttempt(studentId, attemptId, req);

        // Band 6.5 / 9.0 * 10.0 = 7.222... -> 7.2; ESSAY attempts remain SUBMITTED for teacher confirmation
        assertThat(res.getStatus()).isEqualTo("SUBMITTED");
        assertThat(res.getScore()).isEqualTo(7.2);
        assertThat(existingAns.getEarnedPoints()).isEqualTo(7.2);
        assertThat(existingAns.getIsCorrect()).isTrue();
    }

    @Test
    @DisplayName("submitAttempt với cheatingFlagged=true chuyển SUBMITTED và gửi cảnh báo gian lận cho giáo viên")
    void submitAttempt_CheatingFlagged_MarksSubmittedAndNotifiesTeacher() {
        UUID studentId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();
        UUID classId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();

        Teacher teacher = new Teacher();
        teacher.setId(teacherId);
        Classroom classroom = Classroom.builder().id(classId).teacher(teacher).build();
        Assignment exam = Assignment.builder()
                .id(assId)
                .title("Final Exam")
                .classroom(classroom)
                .isExam(true)
                .maxViolations(3)
                .questions(new ArrayList<>())
                .build();
        Student student = Student.builder()
                .id(studentId)
                .user(User.builder().id(studentId).firstName("Minh").lastName("Tran").build())
                .build();
        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(exam)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(60))
                .answers(new ArrayList<>())
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(new ArrayList<>());
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(
                GradingResult.builder().scaledScore(0.0).earnedPointsPerQuestion(Map.of()).correctnessPerQuestion(Map.of()).build());
        when(dailyPlanItemRepository.findByAssignmentIdWithDailyPlan(assId)).thenReturn(java.util.Collections.emptyList());

        SubmissionRequest req = SubmissionRequest.builder()
                .assignmentId(assId)
                .cheatingFlagged(true)
                .violationCount(3)
                .cheatingReason("Chuyển tab liên tục")
                .answers(java.util.Collections.emptyList())
                .build();

        AttemptResponse res = submissionService.submitAttempt(studentId, attemptId, req);

        assertThat(res.getStatus()).isEqualTo("SUBMITTED");
        assertThat(res.getIsCheatingFlagged()).isTrue();
        assertThat(res.getCheatingReason()).isEqualTo("Chuyển tab liên tục");
        verify(notificationService).sendSystemNotification(
                eq(teacherId), anyString(), anyString(), anyString(), eq("CHEATING_ALERT"), anyString(), eq(attemptId));
    }

    @Test
    @DisplayName("submitAttempt ném BadRequestException khi bài không gian lận đã nộp trước đó")
    void submitAttempt_AlreadySubmittedWithoutCheating_ThrowsBadRequest() {
        UUID studentId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .submittedAt(Instant.now())
                .isCheatingFlagged(false)
                .build();
        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));

        assertThatThrownBy(() -> submissionService.submitAttempt(studentId, attemptId, new SubmissionRequest()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("already been submitted");
    }

    @Test
    @DisplayName("uploadAudioResponse ném BadRequestException khi file rỗng và thành công lưu R2 khi hợp lệ")
    void uploadAudioResponse_EmptyAndValidFlows() throws Exception {
        UUID studentId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();

        Assignment speakingAss = Assignment.builder().id(assId).skillType(SkillType.SPEAKING).questions(new ArrayList<>()).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .assignment(speakingAss)
                .status(AttemptStatus.IN_PROGRESS)
                .answers(new ArrayList<>())
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));

        MockMultipartFile emptyAudio = new MockMultipartFile("audio", "empty.wav", "audio/wav", new byte[0]);
        assertThatThrownBy(() -> submissionService.uploadAudioResponse(studentId, attemptId, qId, emptyAudio))
                .isInstanceOf(BadRequestException.class);

        MockMultipartFile validAudio = new MockMultipartFile("audio", "answer.mp3", "audio/mpeg", "fake-mp3-bytes".getBytes());
        when(r2StorageService.uploadFile(anyString(), any(java.io.File.class), eq("audio/mpeg")))
                .thenReturn("https://r2.example/speaking/answer.mp3");
        when(assignmentRepository.findByIdWithQuestions(assId)).thenReturn(Optional.of(speakingAss));

        AttemptResponse res = submissionService.uploadAudioResponse(studentId, attemptId, qId, validAudio);

        assertThat(res.getAttemptId()).isEqualTo(attemptId);
        verify(r2StorageService).uploadFile(anyString(), any(java.io.File.class), eq("audio/mpeg"));
        verify(answerRepository).save(any(StudentAnswer.class));
    }

    @Test
    @DisplayName("getAttemptDetail ẩn đáp án đúng & giải thích khi học viên đang IN_PROGRESS, nhưng parse selectedOptionId cho TRUE_FALSE")
    void getAttemptDetail_InProgressHidesAnswersAndParsesTrueFalseSelectedOptionId() {
        UUID studentId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID tfOptId = UUID.randomUUID();

        QuestionOption trueOpt = QuestionOption.builder().id(tfOptId).optionLabel("True").optionText("True").isCorrect(true).build();
        AssignmentQuestion tfQuestion = AssignmentQuestion.builder()
                .id(qId)
                .questionType(QuestionType.TRUE_FALSE)
                .promptText("The earth orbits the sun.")
                .correctAnswer("True")
                .explanation("Astronomical fact")
                .points(1.0)
                .options(List.of(trueOpt))
                .build();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Reading TF")
                .skillType(SkillType.READING)
                .questions(List.of(tfQuestion))
                .build();
        StudentAnswer ans = new StudentAnswer();
        ans.setId(UUID.randomUUID());
        ans.setQuestion(tfQuestion);
        ans.setTextResponse(tfOptId.toString());
        ans.setEarnedPoints(1.0);
        ans.setIsCorrect(true);

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .assignment(assignment)
                .status(AttemptStatus.IN_PROGRESS)
                .answers(List.of(ans))
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(assignmentRepository.findByIdWithQuestions(assId)).thenReturn(Optional.of(assignment));

        AttemptResponse studentView = submissionService.getAttemptDetail(attemptId, studentId, false);
        assertThat(studentView.getQuestions()).hasSize(1);
        AttemptResponse.QuestionResultDetail qDetail = studentView.getQuestions().get(0);
        assertThat(qDetail.getSelectedOptionId()).isEqualTo(tfOptId);
        assertThat(qDetail.getCorrectAnswer()).isNull();
        assertThat(qDetail.getExplanation()).isNull();
        assertThat(qDetail.getEarnedPoints()).isNull();
        assertThat(qDetail.getIsCorrect()).isNull();
        assertThat(qDetail.getOptions().get(0).getIsCorrect()).isNull();

        when(attemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));
        AttemptResponse teacherView = submissionService.getAttemptDetail(attemptId, studentId, true);
        assertThat(teacherView.getQuestions().get(0).getCorrectAnswer()).isEqualTo("True");
        assertThat(teacherView.getQuestions().get(0).getExplanation()).isEqualTo("Astronomical fact");
        assertThat(teacherView.getQuestions().get(0).getIsCorrect()).isTrue();
    }

    @Test
    @DisplayName("getStudentClassAssignments phân loại COMPLETED / OVERDUE / NOT_STARTED và từ chối ngoài lớp")
    void getStudentClassAssignments_StatusesAndForbidden() {
        UUID classId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(false);

        assertThatThrownBy(() -> submissionService.getStudentClassAssignments(classId, studentId))
                .isInstanceOf(ForbiddenException.class);

        UUID doneId = UUID.randomUUID();
        UUID overdueId = UUID.randomUUID();
        UUID todoId = UUID.randomUUID();

        Assignment doneAss = Assignment.builder().id(doneId).title("Done").skillType(SkillType.GRAMMAR).build();
        Assignment overdueAss = Assignment.builder().id(overdueId).title("Late").dueDate(Instant.now().minusSeconds(3600)).build();
        Assignment todoAss = Assignment.builder().id(todoId).title("Open").dueDate(Instant.now().plusSeconds(3600)).build();

        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(true);
        when(assignmentRepository.findByClassroomId(classId)).thenReturn(List.of(doneAss, overdueAss, todoAss));
        when(attemptRepository.countAttempts(doneId, studentId)).thenReturn(1);
        when(attemptRepository.findHighestScore(doneId, studentId)).thenReturn(9.0);
        when(attemptRepository.countAttempts(overdueId, studentId)).thenReturn(0);
        when(attemptRepository.findHighestScore(overdueId, studentId)).thenReturn(null);
        when(attemptRepository.countAttempts(todoId, studentId)).thenReturn(0);
        when(attemptRepository.findHighestScore(todoId, studentId)).thenReturn(null);

        List<StudentAssignmentSummaryResponse> list = submissionService.getStudentClassAssignments(classId, studentId);

        assertThat(list).hasSize(3);
        assertThat(list.get(0).getStatus()).isEqualTo("COMPLETED");
        assertThat(list.get(0).getHighestScore()).isEqualTo(9.0);
        assertThat(list.get(1).getStatus()).isEqualTo("OVERDUE");
        assertThat(list.get(1).getHighestScore()).isEqualTo(0.0);
        assertThat(list.get(2).getStatus()).isEqualTo("NOT_STARTED");
    }

    @Test
    @DisplayName("getTeacherSubmissions xử lý an toàn khi student/user null")
    void getTeacherSubmissions_NullSafeStudentMapping() {
        UUID assId = UUID.randomUUID();
        AssignmentAttempt orphanAttempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .attemptNumber(1)
                .totalScore(7.5)
                .status(AttemptStatus.COMPLETED)
                .build();
        AssignmentAttempt namedAttempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .student(Student.builder().id(UUID.randomUUID())
                        .user(User.builder().firstName("An").lastName("Le").email("an@test.com").build())
                        .build())
                .attemptNumber(2)
                .totalScore(9.0)
                .status(AttemptStatus.SUBMITTED)
                .isCheatingFlagged(true)
                .violationCount(2)
                .build();

        when(attemptRepository.findByAssignmentIdOrderBySubmittedAtDesc(assId)).thenReturn(List.of(orphanAttempt, namedAttempt));

        List<SubmissionSummaryResponse> res = submissionService.getTeacherSubmissions(assId);

        assertThat(res).hasSize(2);
        assertThat(res.get(0).getStudentName()).isEqualTo("Học viên");
        assertThat(res.get(0).getViolationCount()).isEqualTo(0);
        assertThat(res.get(1).getStudentName()).isEqualTo("An Le");
        assertThat(res.get(1).getStudentEmail()).isEqualTo("an@test.com");
        assertThat(res.get(1).getIsCheatingFlagged()).isTrue();
    }

    @Test
    @DisplayName("getStudentAttemptsHistory đảo đúng thứ tự tham số assignmentId và studentId")
    void getStudentAttemptsHistory_MapsSummaries() {
        UUID assId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        AssignmentAttempt att = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .assignment(Assignment.builder().id(assId).title("Reading 1").skillType(SkillType.READING).build())
                .attemptNumber(1)
                .totalScore(8.0)
                .status(AttemptStatus.COMPLETED)
                .build();
        when(attemptRepository.findByAssignmentIdAndStudentIdOrderByAttemptNumberDesc(assId, studentId))
                .thenReturn(List.of(att));

        List<AttemptResponse> history = submissionService.getStudentAttemptsHistory(assId, studentId);

        assertThat(history).hasSize(1);
        assertThat(history.get(0).getScore()).isEqualTo(8.0);
        assertThat(history.get(0).getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("computeRemedialMessage bao phủ đủ 6 kỹ năng, ESSAY và trạng thái IN_PROGRESS")
    void computeRemedialMessage_CoversAllSkillThresholdsAndStates() {
        assertThat(submissionService.computeRemedialMessage(null)).isNull();

        AssignmentAttempt inProg = AssignmentAttempt.builder()
                .status(AttemptStatus.IN_PROGRESS)
                .assignment(Assignment.builder().skillType(SkillType.GRAMMAR).build())
                .build();
        assertThat(submissionService.computeRemedialMessage(inProg)).isNull();

        AssignmentAttempt essayAttempt = AssignmentAttempt.builder()
                .status(AttemptStatus.SUBMITTED)
                .assignment(Assignment.builder().skillType(SkillType.WRITING)
                        .questions(List.of(AssignmentQuestion.builder().questionType(QuestionType.ESSAY).build()))
                        .build())
                .build();
        assertThat(submissionService.computeRemedialMessage(essayAttempt)).contains("chờ giáo viên / AI");

        AssignmentAttempt grammarFail = AssignmentAttempt.builder()
                .status(AttemptStatus.COMPLETED).totalScore(4.0)
                .assignment(Assignment.builder().skillType(SkillType.GRAMMAR).build())
                .build();
        assertThat(submissionService.computeRemedialMessage(grammarFail)).contains("60%");

        AssignmentAttempt readingPass = AssignmentAttempt.builder()
                .status(AttemptStatus.COMPLETED).totalScore(6.0)
                .assignment(Assignment.builder().skillType(SkillType.READING).build())
                .build();
        assertThat(submissionService.computeRemedialMessage(readingPass)).contains("xuất sắc");

        AssignmentAttempt listeningFail = AssignmentAttempt.builder()
                .status(AttemptStatus.COMPLETED).totalScore(2.0)
                .assignment(Assignment.builder().skillType(SkillType.LISTENING).build())
                .build();
        assertThat(submissionService.computeRemedialMessage(listeningFail)).contains("bài nghe");

        AssignmentAttempt listeningPass = AssignmentAttempt.builder()
                .status(AttemptStatus.COMPLETED).totalScore(4.0)
                .assignment(Assignment.builder().skillType(SkillType.LISTENING).build())
                .build();
        assertThat(submissionService.computeRemedialMessage(listeningPass)).contains("kỹ năng nghe");

        AssignmentAttempt writingFail = AssignmentAttempt.builder()
                .status(AttemptStatus.COMPLETED).totalScore(2.0)
                .assignment(Assignment.builder().skillType(SkillType.WRITING).build())
                .build();
        assertThat(submissionService.computeRemedialMessage(writingFail)).contains("cấu trúc câu");

        AssignmentAttempt writingPass = AssignmentAttempt.builder()
                .status(AttemptStatus.COMPLETED).totalScore(5.0)
                .assignment(Assignment.builder().skillType(SkillType.WRITING).build())
                .build();
        assertThat(submissionService.computeRemedialMessage(writingPass)).contains("ngữ pháp viết câu");

        AssignmentAttempt speakingPass = AssignmentAttempt.builder()
                .status(AttemptStatus.COMPLETED).totalScore(6.0)
                .assignment(Assignment.builder().skillType(SkillType.SPEAKING).build())
                .build();
        assertThat(submissionService.computeRemedialMessage(speakingPass)).contains("đạt chuẩn");
    }

    @Test
    @DisplayName("submitAttempt với AUDIO_RESPONSE có points=null và AI score=8.0 không bị nhân 10 lần lên 80.0")
    void submitAttempt_SubjectiveWithNullPointsAndAiScore_DoesNotMultiplyByTen() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID ansId = UUID.randomUUID();

        AssignmentQuestion speakingQ = AssignmentQuestion.builder()
                .id(qId)
                .questionType(QuestionType.AUDIO_RESPONSE)
                .points(null)
                .build();

        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Speaking Practice")
                .skillType(SkillType.SPEAKING)
                .isExam(false)
                .questions(List.of(speakingQ))
                .build();

        Student student = Student.builder()
                .id(studentId)
                .user(User.builder().id(studentId).firstName("Lan").lastName("Tran").build())
                .build();

        StudentAnswer preEvaluated = new StudentAnswer();
        preEvaluated.setId(ansId);
        preEvaluated.setQuestion(speakingQ);
        preEvaluated.setAudioResponseUrl("https://r2.example/speaking.wav");

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(60))
                .answers(new ArrayList<>(List.of(preEvaluated)))
                .build();

        AiEvaluation eval = AiEvaluation.builder()
                .id(UUID.randomUUID())
                .studentAnswer(preEvaluated)
                .evalType(AiEvaluationType.SPEAKING)
                .overallScore(8.0)
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(speakingQ));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(
                GradingResult.builder()
                        .earnedPointsPerQuestion(Map.of())
                        .correctnessPerQuestion(Map.of())
                        .build()
        );
        when(aiEvaluationRepository.findByStudentAnswerId(ansId)).thenReturn(Optional.of(eval));

        AttemptResponse res = submissionService.submitAttempt(
                studentId,
                attemptId,
                SubmissionRequest.builder()
                        .assignmentId(assId)
                        .answers(List.of(SubmissionRequest.AnswerDto.builder().questionId(qId).build()))
                        .build()
        );

        assertThat(res.getScore()).isEqualTo(8.0);
        assertThat(attempt.getTotalScore()).isLessThanOrEqualTo(10.0);
    }

    @Test
    @DisplayName("gradeSubmission từ chối finalScore ngoài khoảng [0.0, 10.0]")
    void gradeSubmission_RejectsOutOfRangeScores() {
        UUID attemptId = UUID.randomUUID();
        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .status(AttemptStatus.SUBMITTED)
                .answers(new ArrayList<>())
                .build();
        when(attemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        TeacherGradeRequest tooHigh = new TeacherGradeRequest();
        tooHigh.setFinalScore(85.0);
        tooHigh.setFeedback("Scale 100");
        assertThatThrownBy(() -> submissionService.gradeSubmission(attemptId, tooHigh))
                .isInstanceOf(BadRequestException.class);

        TeacherGradeRequest negative = new TeacherGradeRequest();
        negative.setFinalScore(-1.0);
        negative.setFeedback("Negative");
        assertThatThrownBy(() -> submissionService.gradeSubmission(attemptId, negative))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("startAttempt_whenPassScoreConfiguredWithoutMaxAllowedError_blocksRetakeWhenScoreMeetsPassScore")
    void startAttempt_whenPassScoreConfiguredWithoutMaxAllowedError_blocksRetakeWhenScoreMeetsPassScore() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .maxAttempts(3)
                .maxAllowedErrorPercent(null)
                .passScore(7.0)
                .questions(new ArrayList<>())
                .build();
        AssignmentAttempt completed = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.COMPLETED)
                .totalScore(7.5)
                .submittedAt(Instant.now().minusSeconds(30))
                .build();

        when(assignmentRepository.findById(assId)).thenReturn(Optional.of(assignment));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assId)).thenReturn(List.of(completed));

        assertThatThrownBy(() -> submissionService.startAttempt(studentId, assId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ĐẠT CHUẨN");
    }

    @Test
    @DisplayName("startAttempt_whenHasEssayAndReachedMaxAttempts_throwsEssayWaitingGradingBadRequest")
    void startAttempt_whenHasEssayAndReachedMaxAttempts_throwsEssayWaitingGradingBadRequest() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        Assignment assignment = Assignment.builder()
                .id(assId)
                .maxAttempts(1)
                .questions(List.of(AssignmentQuestion.builder().id(UUID.randomUUID()).questionType(QuestionType.ESSAY).build()))
                .build();
        AssignmentAttempt submittedEssay = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.SUBMITTED)
                .submittedAt(Instant.now().minusSeconds(60))
                .build();

        when(assignmentRepository.findById(assId)).thenReturn(Optional.of(assignment));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assId)).thenReturn(List.of(submittedEssay));

        assertThatThrownBy(() -> submissionService.startAttempt(studentId, assId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("tự luận");
    }

    @Test
    @DisplayName("startAttempt_whenPreviousAttemptsNullAndExamHasQuestions_createsFirstAttemptAndPersistsAnswers")
    void startAttempt_whenPreviousAttemptsNullAndExamHasQuestions_createsFirstAttemptAndPersistsAnswers() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        AssignmentQuestion mcq = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .promptText("Choose A")
                .points(2.0)
                .build();
        Assignment exam = Assignment.builder()
                .id(assId)
                .title("Midterm Exam")
                .skillType(SkillType.READING)
                .isExam(true)
                .questions(List.of(mcq))
                .build();
        Student studentRef = Student.builder().id(studentId).build();

        when(assignmentRepository.findById(assId)).thenReturn(Optional.of(exam));
        when(attemptRepository.findByStudentIdAndAssignmentId(studentId, assId)).thenReturn(null);
        when(entityManager.getReference(Student.class, studentId)).thenReturn(studentRef);
        when(attemptRepository.save(any(AssignmentAttempt.class))).thenAnswer(inv -> {
            AssignmentAttempt a = inv.getArgument(0);
            if (a.getId() == null) {
                a.setId(attemptId);
            }
            return a;
        });
        when(attemptRepository.findByIdAndStudentId(eq(attemptId), eq(studentId))).thenAnswer(inv ->
                Optional.of(AssignmentAttempt.builder()
                        .id(attemptId)
                        .student(studentRef)
                        .assignment(exam)
                        .attemptNumber(1)
                        .status(AttemptStatus.IN_PROGRESS)
                        .startedAt(Instant.now())
                        .answers(new ArrayList<>())
                        .build()));
        when(assignmentRepository.findByIdWithQuestions(assId)).thenReturn(Optional.of(exam));

        AttemptResponse res = submissionService.startAttempt(studentId, assId);

        assertThat(res.getAttemptId()).isEqualTo(attemptId);
        assertThat(res.getAttemptNumber()).isEqualTo(1);
        assertThat(res.getAnswersPersisted()).isTrue();
        verify(answerRepository).save(any(StudentAnswer.class));
        verify(attemptRepository, times(2)).save(any(AssignmentAttempt.class));
    }

    @Test
    @DisplayName("submitAttempt_whenRequestNullOrAttemptNotFound_throwsBadRequestOrNotFound")
    void submitAttempt_whenRequestNullOrAttemptNotFound_throwsBadRequestOrNotFound() {
        UUID studentId = UUID.randomUUID();
        UUID missingAttemptId = UUID.randomUUID();

        assertThatThrownBy(() -> submissionService.submitAttempt(studentId, missingAttemptId, null))
                .isInstanceOf(BadRequestException.class);

        when(attemptRepository.findByIdAndStudentId(missingAttemptId, studentId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> submissionService.submitAttempt(studentId, missingAttemptId, new SubmissionRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("submitAttempt_whenAlreadySubmittedWithCheatingFlagged_returnsAttemptDetailInsteadOfThrowing")
    void submitAttempt_whenAlreadySubmittedWithCheatingFlagged_returnsAttemptDetailInsteadOfThrowing() {
        UUID studentId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        Assignment exam = Assignment.builder().id(assId).title("Exam").isExam(true).questions(new ArrayList<>()).build();
        AssignmentAttempt flaggedAttempt = AssignmentAttempt.builder()
                .id(attemptId)
                .assignment(exam)
                .attemptNumber(1)
                .status(AttemptStatus.SUBMITTED)
                .submittedAt(Instant.now().minusSeconds(30))
                .isCheatingFlagged(true)
                .cheatingReason("Exited fullscreen")
                .totalScore(0.0)
                .answers(new ArrayList<>())
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(flaggedAttempt));
        when(assignmentRepository.findByIdWithQuestions(assId)).thenReturn(Optional.of(exam));

        AttemptResponse res = submissionService.submitAttempt(studentId, attemptId, new SubmissionRequest());

        assertThat(res.getAttemptId()).isEqualTo(attemptId);
        assertThat(res.getIsCheatingFlagged()).isTrue();
        verify(attemptRepository, never()).save(any());
    }

    @Test
    @DisplayName("submitAttempt_whenAudioResponseUnscored_setsStatusSubmittedAndNotifiesTeacher")
    void submitAttempt_whenAudioResponseUnscored_setsStatusSubmittedAndNotifiesTeacher() {
        UUID studentId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();
        UUID classId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();
        UUID ansId = UUID.randomUUID();

        Teacher teacher = new Teacher();
        teacher.setId(teacherId);
        Classroom classroom = Classroom.builder().id(classId).teacher(teacher).build();
        AssignmentQuestion audioQ = AssignmentQuestion.builder()
                .id(qId)
                .questionType(QuestionType.AUDIO_RESPONSE)
                .points(10.0)
                .build();
        Assignment speakingAss = Assignment.builder()
                .id(assId)
                .title("Speaking Practice")
                .classroom(classroom)
                .skillType(SkillType.SPEAKING)
                .questions(List.of(audioQ))
                .build();
        Student student = Student.builder()
                .id(studentId)
                .user(User.builder().id(studentId).firstName("Hoa").lastName("Nguyen").build())
                .build();
        StudentAnswer ungradedAudioAns = new StudentAnswer();
        ungradedAudioAns.setId(ansId);
        ungradedAudioAns.setQuestion(audioQ);
        ungradedAudioAns.setAudioResponseUrl("https://r2.dev/audio.wav");
        ungradedAudioAns.setEarnedPoints(0.0);

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(student)
                .assignment(speakingAss)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(40))
                .answers(new ArrayList<>(List.of(ungradedAudioAns)))
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(audioQ));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(
                GradingResult.builder().earnedPointsPerQuestion(Map.of()).correctnessPerQuestion(Map.of()).build());
        when(aiEvaluationRepository.findByStudentAnswerId(ansId)).thenReturn(Optional.empty());
        when(dailyPlanItemRepository.findByAssignmentIdWithDailyPlan(assId)).thenReturn(java.util.Collections.emptyList());

        AttemptResponse res = submissionService.submitAttempt(
                studentId, attemptId, SubmissionRequest.builder().assignmentId(assId).answers(List.of()).build());

        assertThat(res.getStatus()).isEqualTo("SUBMITTED");
        assertThat(res.getScore()).isZero();
        verify(analyticsService, never()).updateSkillScore(any(), any(), anyDouble());
        verify(notificationService).sendSystemNotification(
                eq(teacherId), anyString(), anyString(), anyString(), eq("SUBMISSION_RECEIVED"), anyString(), eq(attemptId));
    }

    @Test
    @DisplayName("submitAttempt_whenEssayAndAudioHaveLegacyScale100AiScores_normalizesBothToScale10")
    void submitAttempt_whenEssayAndAudioHaveLegacyScale100AiScores_normalizesBothToScale10() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        UUID essayQId = UUID.randomUUID();
        UUID audioQId = UUID.randomUUID();
        UUID essayAnsId = UUID.randomUUID();
        UUID audioAnsId = UUID.randomUUID();

        AssignmentQuestion essayQ = AssignmentQuestion.builder()
                .id(essayQId).questionType(QuestionType.ESSAY).points(10.0).build();
        AssignmentQuestion audioQ = AssignmentQuestion.builder()
                .id(audioQId).questionType(QuestionType.AUDIO_RESPONSE).points(10.0).build();
        Assignment assignment = Assignment.builder()
                .id(assId).title("Mixed Subjective").skillType(SkillType.WRITING).questions(List.of(essayQ, audioQ)).build();

        StudentAnswer essayAns = new StudentAnswer();
        essayAns.setId(essayAnsId);
        essayAns.setQuestion(essayQ);
        StudentAnswer audioAns = new StudentAnswer();
        audioAns.setId(audioAnsId);
        audioAns.setQuestion(audioQ);

        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(Student.builder().id(studentId).build())
                .assignment(assignment)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(120))
                .answers(new ArrayList<>(List.of(essayAns, audioAns)))
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of(essayQ, audioQ));
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(
                GradingResult.builder().earnedPointsPerQuestion(Map.of()).correctnessPerQuestion(Map.of()).build());
        when(aiEvaluationRepository.findByStudentAnswerId(essayAnsId)).thenReturn(Optional.of(
                AiEvaluation.builder().evalType(AiEvaluationType.WRITING).overallScore(85.0).build()));
        when(aiEvaluationRepository.findByStudentAnswerId(audioAnsId)).thenReturn(Optional.of(
                AiEvaluation.builder().evalType(AiEvaluationType.SPEAKING).overallScore(80.0).build()));
        when(dailyPlanItemRepository.findByAssignmentIdWithDailyPlan(assId)).thenReturn(java.util.Collections.emptyList());

        AttemptResponse res = submissionService.submitAttempt(
                studentId, attemptId, SubmissionRequest.builder().assignmentId(assId).answers(List.of()).build());

        assertThat(essayAns.getEarnedPoints()).isEqualTo(8.5);
        assertThat(audioAns.getEarnedPoints()).isEqualTo(8.0);
        assertThat(res.getScore()).isEqualTo(8.3);
        assertThat(res.getStatus()).isEqualTo("SUBMITTED");
    }

    @Test
    @DisplayName("submitAssignment_delegatesDirectlyToSubmitAttempt")
    void submitAssignment_delegatesDirectlyToSubmitAttempt() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID attemptId = UUID.randomUUID();
        Assignment assignment = Assignment.builder().id(assId).title("Quick Task").skillType(SkillType.READING).build();
        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(attemptId)
                .student(Student.builder().id(studentId).build())
                .assignment(assignment)
                .status(AttemptStatus.IN_PROGRESS)
                .startedAt(Instant.now().minusSeconds(20))
                .answers(null)
                .build();

        when(attemptRepository.findByIdAndStudentId(attemptId, studentId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByAssignmentId(assId)).thenReturn(List.of());
        when(gradingEngineService.evaluateSubmission(any(), any())).thenReturn(
                GradingResult.builder().earnedPointsPerQuestion(Map.of()).correctnessPerQuestion(Map.of()).build());
        when(dailyPlanItemRepository.findByAssignmentIdWithDailyPlan(assId)).thenReturn(java.util.Collections.emptyList());

        AttemptResponse res = submissionService.submitAssignment(
                studentId, attemptId, SubmissionRequest.builder().assignmentId(assId).answers(List.of()).build());

        assertThat(res.getAttemptId()).isEqualTo(attemptId);
        assertThat(res.getStatus()).isEqualTo("COMPLETED");
        verify(attemptRepository).save(attempt);
    }

    @Test
    @DisplayName("recordAttemptViolation_whenAlreadySubmittedOrRequestNullOrAttemptMissing_handlesAllBranches")
    void recordAttemptViolation_whenAlreadySubmittedOrRequestNullOrAttemptMissing_handlesAllBranches() {
        UUID studentId = UUID.randomUUID();
        UUID missingAttemptId = UUID.randomUUID();
        when(attemptRepository.findByIdAndStudentId(missingAttemptId, studentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> submissionService.recordAttemptViolation(studentId, missingAttemptId, null))
                .isInstanceOf(ResourceNotFoundException.class);

        UUID submittedId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        Assignment exam = Assignment.builder().id(assId).title("Exam").isExam(true).maxViolations(3).questions(new ArrayList<>()).build();
        AssignmentAttempt alreadySubmitted = AssignmentAttempt.builder()
                .id(submittedId)
                .assignment(exam)
                .attemptNumber(1)
                .status(AttemptStatus.SUBMITTED)
                .submittedAt(Instant.now().minusSeconds(10))
                .violationCount(2)
                .answers(new ArrayList<>())
                .build();

        when(attemptRepository.findByIdAndStudentId(submittedId, studentId)).thenReturn(Optional.of(alreadySubmitted));
        when(assignmentRepository.findByIdWithQuestions(assId)).thenReturn(Optional.of(exam));

        AttemptResponse existingDetail = submissionService.recordAttemptViolation(studentId, submittedId, null);
        assertThat(existingDetail.getViolationCount()).isEqualTo(2);
        verify(attemptRepository, never()).save(alreadySubmitted);

        UUID inProgId = UUID.randomUUID();
        AssignmentAttempt inProg = AssignmentAttempt.builder()
                .id(inProgId)
                .assignment(exam)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .violationCount(0)
                .answers(new ArrayList<>())
                .build();
        when(attemptRepository.findByIdAndStudentId(inProgId, studentId)).thenReturn(Optional.of(inProg));

        AttemptResponse warningRes = submissionService.recordAttemptViolation(studentId, inProgId, null);
        assertThat(warningRes.getViolationCount()).isEqualTo(1);
        assertThat(warningRes.getIsCheatingFlagged()).isFalse();
        assertThat(warningRes.getViolationLogJson()).contains("FOCUS_LOST");
        verify(attemptRepository).save(inProg);
    }

    @Test
    @DisplayName("getAttemptDetail luôn sắp xếp đáp án A, B, C, D dù DB trả về thứ tự xáo trộn khi làm bài và xem đáp án")
    void getAttemptDetail_sortsScrambledOptionsInCanonicalOrderForBothInProgressAndCompleted() {
        UUID studentId = UUID.randomUUID();
        UUID assId = UUID.randomUUID();
        UUID qId = UUID.randomUUID();

        QuestionOption optD = QuestionOption.builder().id(UUID.randomUUID()).optionLabel("D").optionText("Delta").isCorrect(false).build();
        QuestionOption optB = QuestionOption.builder().id(UUID.randomUUID()).optionLabel("B").optionText("Bravo").isCorrect(true).build();
        QuestionOption optA = QuestionOption.builder().id(UUID.randomUUID()).optionLabel("A").optionText("Alpha").isCorrect(false).build();
        QuestionOption optC = QuestionOption.builder().id(UUID.randomUUID()).optionLabel("C").optionText("Charlie").isCorrect(false).build();

        AssignmentQuestion mcq = AssignmentQuestion.builder()
                .id(qId)
                .orderIndex(1)
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .skillType(SkillType.GRAMMAR)
                .promptText("Choose B")
                .correctAnswer("B")
                .options(new ArrayList<>(List.of(optD, optB, optA, optC)))
                .build();

        Assignment assignment = Assignment.builder()
                .id(assId)
                .title("Grammar Quiz")
                .skillType(SkillType.GRAMMAR)
                .questions(List.of(mcq))
                .build();

        UUID inProgAttemptId = UUID.randomUUID();
        AssignmentAttempt inProgressAttempt = AssignmentAttempt.builder()
                .id(inProgAttemptId)
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .answers(new ArrayList<>())
                .build();

        UUID completedAttemptId = UUID.randomUUID();
        AssignmentAttempt completedAttempt = AssignmentAttempt.builder()
                .id(completedAttemptId)
                .assignment(assignment)
                .attemptNumber(1)
                .status(AttemptStatus.COMPLETED)
                .answers(new ArrayList<>())
                .build();

        when(attemptRepository.findByIdAndStudentId(inProgAttemptId, studentId)).thenReturn(Optional.of(inProgressAttempt));
        when(attemptRepository.findByIdAndStudentId(completedAttemptId, studentId)).thenReturn(Optional.of(completedAttempt));
        when(assignmentRepository.findByIdWithQuestions(assId)).thenReturn(Optional.of(assignment));

        AttemptResponse inProgressRes = submissionService.getAttemptDetail(inProgAttemptId, studentId, false);
        assertThat(inProgressRes.getQuestions()).hasSize(1);
        assertThat(inProgressRes.getQuestions().get(0).getOptions())
                .extracting(AttemptResponse.OptionDetail::getOptionLabel)
                .containsExactly("A", "B", "C", "D");

        AttemptResponse completedRes = submissionService.getAttemptDetail(completedAttemptId, studentId, false);
        assertThat(completedRes.getQuestions()).hasSize(1);
        assertThat(completedRes.getQuestions().get(0).getOptions())
                .extracting(AttemptResponse.OptionDetail::getOptionLabel)
                .containsExactly("A", "B", "C", "D");
    }

    @Test
    @DisplayName("getAttemptDetail chỉ trả về gợi ý an toàn (hint) cho câu Điền từ / Sắp xếp từ ở bài tập thường, không lộ đáp án và tắt gợi ý với Trắc nghiệm / Bài thi")
    void getAttemptDetail_returnsSafeHintOnlyForEligibleNonExamQuestions() {
        UUID studentId = UUID.randomUUID();

        AssignmentQuestion fillQ = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .orderIndex(1)
                .questionType(QuestionType.FILL_IN_BLANK)
                .promptText("Nghe và nhập từ: /ˈbrekfəst/")
                .correctAnswer("breakfast")
                .build();
        AssignmentQuestion unscrambleQ = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .orderIndex(2)
                .questionType(QuestionType.FILL_IN_BLANK)
                .promptText("Sắp xếp các từ sau thành câu hoàn chỉnh: How / often / do / you / practice / piano / ?")
                .correctAnswer("How often do you practice piano?")
                .build();
        AssignmentQuestion mcqQ = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .orderIndex(3)
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .promptText("Choose one:")
                .correctAnswer("A")
                .options(new ArrayList<>())
                .build();
        AssignmentQuestion tfQ = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .orderIndex(4)
                .questionType(QuestionType.TRUE_FALSE)
                .promptText("The earth is flat.")
                .correctAnswer("FALSE")
                .options(new ArrayList<>())
                .build();

        UUID normalAssId = UUID.randomUUID();
        Assignment normalAss = Assignment.builder()
                .id(normalAssId)
                .title("Practice Mix")
                .isExam(false)
                .questions(List.of(fillQ, unscrambleQ, mcqQ, tfQ))
                .build();
        UUID normalAttemptId = UUID.randomUUID();
        AssignmentAttempt normalAttempt = AssignmentAttempt.builder()
                .id(normalAttemptId)
                .assignment(normalAss)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .answers(new ArrayList<>())
                .build();

        UUID examAssId = UUID.randomUUID();
        Assignment examAss = Assignment.builder()
                .id(examAssId)
                .title("Midterm Exam")
                .isExam(true)
                .questions(List.of(fillQ))
                .build();
        UUID examAttemptId = UUID.randomUUID();
        AssignmentAttempt examAttempt = AssignmentAttempt.builder()
                .id(examAttemptId)
                .assignment(examAss)
                .attemptNumber(1)
                .status(AttemptStatus.IN_PROGRESS)
                .answers(new ArrayList<>())
                .build();

        when(attemptRepository.findByIdAndStudentId(normalAttemptId, studentId)).thenReturn(Optional.of(normalAttempt));
        when(assignmentRepository.findByIdWithQuestions(normalAssId)).thenReturn(Optional.of(normalAss));
        when(attemptRepository.findByIdAndStudentId(examAttemptId, studentId)).thenReturn(Optional.of(examAttempt));
        when(assignmentRepository.findByIdWithQuestions(examAssId)).thenReturn(Optional.of(examAss));

        AttemptResponse practiceRes = submissionService.getAttemptDetail(normalAttemptId, studentId, false);
        assertThat(practiceRes.getQuestions()).hasSize(4);
        assertThat(practiceRes.getQuestions().get(0).getHint()).isEqualTo("b________ (9 ký tự)");
        assertThat(practiceRes.getQuestions().get(0).getCorrectAnswer()).isNull();
        assertThat(practiceRes.getQuestions().get(1).getHint()).isEqualTo("Bắt đầu bằng \"How\" (6 từ)");
        assertThat(practiceRes.getQuestions().get(1).getCorrectAnswer()).isNull();
        assertThat(practiceRes.getQuestions().get(2).getHint()).isNull();
        assertThat(practiceRes.getQuestions().get(3).getHint()).isNull();

        AttemptResponse examRes = submissionService.getAttemptDetail(examAttemptId, studentId, false);
        assertThat(examRes.getQuestions()).hasSize(1);
        assertThat(examRes.getQuestions().get(0).getHint()).isNull();
    }
}
