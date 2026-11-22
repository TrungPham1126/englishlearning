package com.englishlearning.submission.service.impl;



import com.englishlearning.analytics.service.AnalyticsService;

import com.englishlearning.assignment.entity.Assignment;

import com.englishlearning.assignment.entity.AssignmentQuestion;

import com.englishlearning.assignment.entity.QuestionType;

import com.englishlearning.assignment.entity.SkillType;

import com.englishlearning.assignment.repository.AssignmentQuestionRepository;

import com.englishlearning.assignment.repository.AssignmentRepository;

import com.englishlearning.assignment.service.ExerciseAudioService;

import com.englishlearning.auth.entity.Student;

import com.englishlearning.common.exception.BadRequestException;

import com.englishlearning.common.exception.ResourceNotFoundException;

import com.englishlearning.common.util.ScoreScaleUtils;

import com.englishlearning.curriculum.entity.DailyPlanItem;

import com.englishlearning.notification.entity.NotificationType;

import com.englishlearning.notification.service.NotificationService;

import com.englishlearning.submission.dto.*;

import com.englishlearning.submission.entity.AssignmentAttempt;

import com.englishlearning.submission.entity.AttemptStatus;

import com.englishlearning.submission.entity.StudentAnswer;

import com.englishlearning.submission.repository.AssignmentAttemptRepository;

import com.englishlearning.submission.repository.StudentAnswerRepository;

import com.englishlearning.submission.service.SubmissionService;

import com.englishlearning.video.service.R2StorageService;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;

import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.multipart.MultipartFile;



import java.io.File;

import java.time.Duration;

import java.time.Instant;

import java.util.ArrayList;

import java.util.Collections;

import java.util.HashSet;

import java.util.LinkedHashMap;

import java.util.List;

import java.util.Map;

import java.util.Optional;

import java.util.Set;

import java.util.UUID;

import java.util.stream.Collectors;

import com.fasterxml.jackson.core.type.TypeReference;

import com.fasterxml.jackson.databind.ObjectMapper;



@Service

@RequiredArgsConstructor

@Slf4j

public class SubmissionServiceImpl implements SubmissionService {

    private final R2StorageService r2StorageService;

    private final AssignmentAttemptRepository attemptRepository;

    private final StudentAnswerRepository answerRepository;

    private final AssignmentQuestionRepository questionRepository;

    private final AssignmentRepository assignmentRepository;

    private final AnalyticsService analyticsService;

    private final EntityManager entityManager;

    private final com.englishlearning.ai.repository.AiEvaluationRepository aiEvaluationRepository;

    private final NotificationService notificationService;

    private final com.englishlearning.classroom.repository.ClassStudentRepository classStudentRepository;

    private final com.englishlearning.curriculum.repository.StudentDailyProgressRepository progressRepository;

    private final com.englishlearning.curriculum.service.UserStreakService userStreakService;

    private final com.englishlearning.curriculum.repository.DailyPlanItemRepository dailyPlanItemRepository;
    private final com.englishlearning.submission.service.GradingEngineService gradingEngineService;



    // ==========================================

    // 1. BẮT ĐẦU VÀ NỘP BÀI THI

    // ==========================================

    @Override

    @Transactional

    public AttemptResponse startAttempt(UUID studentId, UUID assignmentId) {

        Assignment assignment = assignmentRepository.findById(assignmentId)

                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài tập: " + assignmentId));



        if (assignment.getClassroom() != null && !classStudentRepository.existsByClassroomIdAndStudentId(assignment.getClassroom().getId(), studentId)) {

            throw new com.englishlearning.common.exception.ForbiddenException("Bạn không có quyền làm bài tập của lớp học này");

        }



        List<AssignmentAttempt> previousAttempts = attemptRepository.findByStudentIdAndAssignmentId(studentId,

                assignmentId);

        if (previousAttempts == null) {

            previousAttempts = Collections.emptyList();

        }



        // 1. NẾU ĐANG CÓ LẦN LÀM DỞ DANG (IN_PROGRESS) -> TRẢ VỀ TIẾP TỤC

        Optional<AssignmentAttempt> existingInProgress = previousAttempts.stream()

                .filter(att -> att.getStatus() == AttemptStatus.IN_PROGRESS)

                .findFirst();



        List<AssignmentQuestion> assQuestions = assignment.getQuestions() != null

                ? assignment.getQuestions()

                : Collections.emptyList();



        if (existingInProgress.isPresent()) {

            AssignmentAttempt current = existingInProgress.get();

            if (current.getAnswers() == null) {

                current.setAnswers(new ArrayList<>());

            }

            boolean hasNewAnswers = false;

            for (AssignmentQuestion q : assQuestions) {

                if (!shouldPersistDetailedAnswer(assignment, q)) {

                    continue;

                }

                boolean exists = current.getAnswers().stream()

                        .anyMatch(a -> a.getQuestion() != null && a.getQuestion().getId().equals(q.getId()));

                if (!exists) {

                    StudentAnswer ans = new StudentAnswer();

                    ans.setAttempt(current);

                    ans.setQuestion(q);

                    ans.setEarnedPoints(0.0);

                    ans.setIsCorrect(false);

                    current.getAnswers().add(ans);

                    answerRepository.save(ans);

                    hasNewAnswers = true;

                }

            }

            if (hasNewAnswers) {

                attemptRepository.save(current);

            }

            log.info("Học sinh {} tiếp tục làm bài dở: {}", studentId, current.getId());

            return getAttemptDetail(current.getId(), studentId, false);

        }



        // 2. KIỂM TRA ĐIỀU KIỆN LÀM LẠI (RETAKE / REMEDIAL) VÀ GIỚI HẠN SỐ LẦN LÀM

        int maxAttempts = (assignment.getMaxAttempts() != null && assignment.getMaxAttempts() > 0)

                ? assignment.getMaxAttempts()

                : 3;



        List<AssignmentAttempt> completedAttempts = previousAttempts.stream()

                .filter(att -> att.getStatus() != AttemptStatus.IN_PROGRESS)

                .sorted((a1, a2) -> {

                    if (a1.getSubmittedAt() != null && a2.getSubmittedAt() != null) {

                        return a2.getSubmittedAt().compareTo(a1.getSubmittedAt());

                    }

                    int n1 = a1.getAttemptNumber() != null ? a1.getAttemptNumber() : 0;

                    int n2 = a2.getAttemptNumber() != null ? a2.getAttemptNumber() : 0;

                    return Integer.compare(n2, n1);

                })

                .collect(Collectors.toList());



        long completedCount = completedAttempts.size();



        boolean isExam = Boolean.TRUE.equals(assignment.getIsExam());

        if (isExam && completedAttempts.stream().anyMatch(a -> Boolean.TRUE.equals(a.getIsCheatingFlagged()))) {

            throw new BadRequestException("Bài thi của bạn đã bị khóa do vi phạm quy chế phòng thi (gian lận). Vui lòng liên hệ giáo viên.");

        }

        // Kiểm tra bài tập có chứa câu hỏi tự luận không (ESSAY, IELTS Task 1/2, Paragraph dài)

        boolean hasEssay = assignment.getQuestions() != null && assignment.getQuestions().stream()

                .anyMatch(q -> q.getQuestionType() == com.englishlearning.assignment.entity.QuestionType.ESSAY);



        boolean allowsOrNeedsRetake = false;

        if (!completedAttempts.isEmpty() && !hasEssay) {

            AssignmentAttempt lastCompleted = completedAttempts.get(0);

            Double lastScore = lastCompleted.getTotalScore();

            if (lastScore == null) {

                lastScore = 0.0;

            }

            double scorePercent = ScoreScaleUtils.normalizeToScale100(lastScore);

            double errorRate = Math.max(0.0, 100.0 - scorePercent);



            // 2. PHẠM VI ĐƯỢC SAI VỚI TẤT CẢ CÁC DẠNG BÀI (Do giáo viên cấu hình):
            double allowedErrorThreshold = 20.0;
            if (assignment.getMaxAllowedErrorPercent() != null) {
                allowedErrorThreshold = assignment.getMaxAllowedErrorPercent();
            } else if (assignment.getPassScore() != null) {
                double pScore = ScoreScaleUtils.normalizeToScale100(assignment.getPassScore());
                allowedErrorThreshold = Math.max(0.0, 100.0 - pScore);
            }

            double highestScorePercent = completedAttempts.stream()
                    .mapToDouble(a -> ScoreScaleUtils.normalizeToScale100(a.getTotalScore()))
                    .max().orElse(0.0);
            double lowestErrorRate = Math.max(0.0, 100.0 - highestScorePercent);

            if (lowestErrorRate <= allowedErrorThreshold) {
                throw new BadRequestException("Bạn đã hoàn thành ĐẠT CHUẨN bài tập này (Điểm: " + (Math.round(highestScorePercent * 10.0) / 10.0) + "%, trong phạm vi sai cho phép ≤ " + allowedErrorThreshold + "%). Không thể làm lại bài đã đạt!");
            }

            if (completedCount >= maxAttempts) {
                throw new BadRequestException("Bạn đã thực hiện đủ " + maxAttempts + " lần làm bài nhưng tỷ lệ sai (" + (Math.round(lowestErrorRate * 10.0) / 10.0) + "%) vượt quá phạm vi cho phép (" + allowedErrorThreshold + "%). Kết quả chính thức: NOT PASS và không thể thử lại.");
            }

            allowsOrNeedsRetake = true;
        }

        if (completedCount >= maxAttempts && !allowsOrNeedsRetake) {

            if (hasEssay) {

                throw new BadRequestException("Bài viết tự luận đã được nộp thành công và đang chờ giáo viên chấm điểm. Bạn không thể làm lại.");

            }

            throw new BadRequestException("Bạn đã dùng hết số lần làm bài cho phép (" + maxAttempts + " lần) và đã đạt yêu cầu bài tập.");

        }



        // 3. TẠO LẦN LÀM MỚI

        Student student = entityManager.getReference(Student.class, studentId);

        AssignmentAttempt attempt = AssignmentAttempt.builder()

                .student(student)

                .assignment(assignment)

                .attemptNumber((int) completedCount + 1)

                .startedAt(Instant.now())

                .status(AttemptStatus.IN_PROGRESS)

                .build();



        attempt = attemptRepository.save(attempt);

        if (attempt.getAnswers() == null) {

            attempt.setAnswers(new ArrayList<>());

        }



        for (AssignmentQuestion q : assQuestions) {

            if (!shouldPersistDetailedAnswer(assignment, q)) {

                continue;

            }

            StudentAnswer ans = new StudentAnswer();

            ans.setAttempt(attempt);

            ans.setQuestion(q);

            ans.setEarnedPoints(0.0);

            ans.setIsCorrect(false);

            attempt.getAnswers().add(ans);

            answerRepository.save(ans);

        }

        attempt = attemptRepository.save(attempt);



        log.info("Khởi tạo lượt thi #{} cho học sinh {} với {} câu hỏi", attempt.getAttemptNumber(), studentId, assQuestions.size());

        return getAttemptDetail(attempt.getId(), studentId, false);

    }



    private boolean shouldPersistDetailedAnswer(Assignment assignment, AssignmentQuestion question) {
        if (assignment != null && Boolean.TRUE.equals(assignment.getIsExam())) {
            return true;
        }
        if (question != null && question.getQuestionType() != null) {
            QuestionType qType = question.getQuestionType();
            return qType == QuestionType.ESSAY || qType == QuestionType.AUDIO_RESPONSE;
        }
        return false;
    }

    private boolean hasAnyPersistedQuestion(Assignment assignment) {
        if (assignment == null) {
            return false;
        }
        if (Boolean.TRUE.equals(assignment.getIsExam())) {
            return true;
        }
        if (assignment.getQuestions() == null) {
            return false;
        }
        return assignment.getQuestions().stream().anyMatch(q -> shouldPersistDetailedAnswer(assignment, q));
    }

    private void applyAnswerResponseText(StudentAnswer answer, SubmissionRequest.AnswerDto ansReq,
                                         AssignmentQuestion question, Map<UUID, AssignmentQuestion> questionMap) {
        if (ansReq.getTextAnswer() != null && !ansReq.getTextAnswer().isBlank()) {
            answer.setTextResponse(ansReq.getTextAnswer().trim());
        } else if (ansReq.getSelectedOptionId() != null) {
            if (question != null && question.getQuestionType() == QuestionType.MATCHING) {
                AssignmentQuestion targetQ = questionMap.get(ansReq.getSelectedOptionId());
                if (targetQ != null && targetQ.getCorrectAnswer() != null) {
                    answer.setTextResponse(targetQ.getCorrectAnswer().trim());
                } else {
                    answer.setTextResponse(ansReq.getSelectedOptionId().toString());
                }
            } else {
                answer.setTextResponse(ansReq.getSelectedOptionId().toString());
            }
        }
    }

    private double resolveAiOrExistingManualScore(AssignmentQuestion question, StudentAnswer workingAns) {
        double point = (question.getPoints() != null && question.getPoints() > 0) ? question.getPoints() : 1.0;
        if (workingAns == null) {
            return 0.0;
        }
        if (question.getQuestionType() == QuestionType.ESSAY && workingAns.getId() != null) {
            var evalOpt = aiEvaluationRepository.findByStudentAnswerId(workingAns.getId());
            if (evalOpt.isPresent()) {
                var eval = evalOpt.get();
                double aiBand = eval.getOverallScore() != null ? eval.getOverallScore() : 0.0;
                Double existingEarned = workingAns.getEarnedPoints();
                boolean shouldConvertAiBand = existingEarned == null
                        || existingEarned <= 0.0
                        || existingEarned > 10.0
                        || (aiBand > 0.0 && Math.abs(existingEarned - aiBand) < 0.01);
                if (shouldConvertAiBand) {
                    double converted10;
                    if (aiBand > 10.0) {
                        converted10 = ScoreScaleUtils.normalizeToScale10OrZero(aiBand);
                    } else if ((eval.getEvalType() == null
                            || eval.getEvalType() == com.englishlearning.ai.entity.AiEvaluationType.WRITING)
                            && aiBand <= 9.0) {
                        converted10 = ScoreScaleUtils.clampScale10((aiBand / 9.0) * 10.0);
                    } else {
                        converted10 = ScoreScaleUtils.clampScale10(aiBand);
                    }
                    workingAns.setEarnedPoints(converted10);
                    workingAns.setIsCorrect(aiBand >= 5.0 || converted10 >= 5.0);
                    return (converted10 / 10.0) * point;
                }
            }
        }
        if (workingAns.getEarnedPoints() != null && workingAns.getEarnedPoints() > 0) {
            double normalizedEarned = ScoreScaleUtils.normalizeToScale10OrZero(workingAns.getEarnedPoints());
            if (workingAns.getEarnedPoints() > 10.0) {
                workingAns.setEarnedPoints(normalizedEarned);
            }
            return (normalizedEarned / 10.0) * point;
        }
        if (workingAns.getId() != null) {
            var evalOpt = aiEvaluationRepository.findByStudentAnswerId(workingAns.getId());
            if (evalOpt.isPresent()) {
                double rawAiScore = evalOpt.get().getOverallScore() != null ? evalOpt.get().getOverallScore() : 0.0;
                double aiScore = ScoreScaleUtils.normalizeToScale10OrZero(rawAiScore);
                workingAns.setEarnedPoints(aiScore);
                workingAns.setIsCorrect(aiScore >= 5.0);
                return (aiScore / 10.0) * point;
            }
        }
        if (question.getQuestionType() == QuestionType.ESSAY) {
            workingAns.setIsCorrect(false);
            workingAns.setEarnedPoints(0.0);
        }
        return 0.0;
    }

    private double scoreAndPersistAnswers(AssignmentAttempt attempt, Assignment assignment,
                                          List<AssignmentQuestion> questions,
                                          List<SubmissionRequest.AnswerDto> incomingAnswers) {
        if (attempt.getAnswers() == null) {
            attempt.setAnswers(new ArrayList<>());
        }
        List<AssignmentQuestion> safeQuestions = questions != null ? questions : Collections.emptyList();
        List<SubmissionRequest.AnswerDto> safeAnswers = incomingAnswers != null ? incomingAnswers : Collections.emptyList();
        Map<UUID, AssignmentQuestion> questionMap = safeQuestions.stream()
                .filter(q -> q != null && q.getId() != null)
                .collect(Collectors.toMap(AssignmentQuestion::getId, q -> q, (q1, q2) -> q1));
        GradingResult gradingResult = gradingEngineService.evaluateSubmission(safeQuestions, safeAnswers);
        Map<UUID, Boolean> correctnessMap = gradingResult != null && gradingResult.getCorrectnessPerQuestion() != null
                ? gradingResult.getCorrectnessPerQuestion() : Collections.emptyMap();
        Map<UUID, Double> earnedMap = gradingResult != null && gradingResult.getEarnedPointsPerQuestion() != null
                ? gradingResult.getEarnedPointsPerQuestion() : Collections.emptyMap();
        double totalScore = 0.0;
        Set<UUID> handledQuestionIds = new HashSet<>();

        for (SubmissionRequest.AnswerDto ansReq : safeAnswers) {
            if (ansReq == null || ansReq.getQuestionId() == null) {
                continue;
            }
            AssignmentQuestion question = questionMap.get(ansReq.getQuestionId());
            if (question == null) {
                continue;
            }
            handledQuestionIds.add(question.getId());

            boolean persist = shouldPersistDetailedAnswer(assignment, question);
            StudentAnswer existingAns = attempt.getAnswers().stream()
                    .filter(a -> a.getQuestion() != null && ansReq.getQuestionId().equals(a.getQuestion().getId()))
                    .findFirst()
                    .orElse(null);

            StudentAnswer workingAns = existingAns;
            if (workingAns == null && persist) {
                workingAns = new StudentAnswer();
                workingAns.setAttempt(attempt);
                workingAns.setQuestion(question);
                attempt.getAnswers().add(workingAns);
            }

            if (persist && workingAns != null) {
                applyAnswerResponseText(workingAns, ansReq, question, questionMap);
            }

            if (question.getQuestionType() == QuestionType.AUDIO_RESPONSE || question.getQuestionType() == QuestionType.ESSAY) {
                totalScore += resolveAiOrExistingManualScore(question, workingAns);
            } else {
                boolean isCorrect = Boolean.TRUE.equals(correctnessMap.get(question.getId()));
                Double earned = earnedMap.get(question.getId());
                double point = earned != null ? earned : 0.0;
                if (persist && workingAns != null) {
                    workingAns.setIsCorrect(isCorrect);
                    workingAns.setEarnedPoints(point);
                }
                totalScore += point;
            }

            if (persist && workingAns != null) {
                answerRepository.save(workingAns);
            }
        }

        // Preserve & apply scores for AUDIO_RESPONSE/ESSAY answers uploaded or evaluated before submit when omitted from DTO answers
        for (AssignmentQuestion question : safeQuestions) {
            if (question.getId() == null || handledQuestionIds.contains(question.getId())) {
                continue;
            }
            if (question.getQuestionType() != QuestionType.AUDIO_RESPONSE && question.getQuestionType() != QuestionType.ESSAY) {
                continue;
            }
            StudentAnswer existingAns = attempt.getAnswers().stream()
                    .filter(a -> a.getQuestion() != null && question.getId().equals(a.getQuestion().getId()))
                    .findFirst()
                    .orElse(null);
            if (existingAns != null) {
                totalScore += resolveAiOrExistingManualScore(question, existingAns);
                if (shouldPersistDetailedAnswer(assignment, question)) {
                    answerRepository.save(existingAns);
                }
            }
        }

        if (!Boolean.TRUE.equals(assignment != null ? assignment.getIsExam() : null)) {
            attempt.getAnswers().removeIf(a -> {
                if (a.getQuestion() == null) {
                    return false;
                }
                AssignmentQuestion resolvedQ = a.getQuestion().getQuestionType() != null
                        ? a.getQuestion()
                        : questionMap.getOrDefault(a.getQuestion().getId(), a.getQuestion());
                return !shouldPersistDetailedAnswer(assignment, resolvedQ);
            });
        }

        double maxPossible = safeQuestions.stream()
                .mapToDouble(q -> (q.getPoints() != null && q.getPoints() > 0) ? q.getPoints() : 1.0)
                .sum();
        double finalScore = maxPossible > 0 ? (totalScore / maxPossible) * 10.0
                : (safeQuestions.isEmpty() ? 0 : (totalScore / safeQuestions.size()) * 10.0);
        return ScoreScaleUtils.clampScale10(finalScore);
    }

    private String appendViolationLog(String existingJson, int index, String eventType, String reason) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            List<Map<String, Object>> logs = (existingJson != null && !existingJson.isBlank())
                    ? mapper.readValue(existingJson, new TypeReference<List<Map<String, Object>>>() {})
                    : new ArrayList<>();
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("count", index);
            entry.put("eventType", eventType != null && !eventType.isBlank() ? eventType : "FOCUS_LOST");
            entry.put("reason", reason != null && !reason.isBlank() ? reason : "Rời khỏi màn hình toàn phần");
            entry.put("timestamp", Instant.now().toString());
            logs.add(entry);
            return mapper.writeValueAsString(logs);
        } catch (Exception e) {
            return existingJson != null ? existingJson : "[]";
        }
    }

    private void notifyTeacherCheatingOrSubmission(AssignmentAttempt attempt, boolean isCheating) {
        Assignment assignment = attempt.getAssignment();
        if (assignment == null || assignment.getClassroom() == null || assignment.getClassroom().getTeacher() == null) {
            return;
        }
        try {
            UUID teacherUserId = assignment.getClassroom().getTeacher().getId();
            UUID classId = assignment.getClassroom().getId();
            boolean isExam = Boolean.TRUE.equals(assignment.getIsExam());
            String studentName = attempt.getStudent() != null && attempt.getStudent().getUser() != null
                    ? (attempt.getStudent().getUser().getFirstName() + " " + attempt.getStudent().getUser().getLastName()).trim()
                    : "Học viên";

            String title = isCheating
                    ? "Cảnh báo gian lận bài thi"
                    : (isExam ? "Bài thi mới cần chấm điểm" : "Bài nộp mới cần chấm điểm");
            String message = isCheating
                    ? String.format("%s đã bị đánh dấu GIAN LẬN (%d/%d lần vi phạm) trong bài thi \"%s\". Lý do: %s",
                            studentName,
                            attempt.getViolationCount() != null ? attempt.getViolationCount() : 3,
                            assignment.getMaxViolations() != null ? assignment.getMaxViolations() : 3,
                            assignment.getTitle(),
                            attempt.getCheatingReason() != null ? attempt.getCheatingReason() : "Rời khỏi chế độ toàn màn hình")
                    : String.format("%s đã nộp %s \"%s\" cần bạn đánh giá.",
                            studentName, isExam ? "bài thi" : "bài tập", assignment.getTitle());
            String targetUrl = isExam
                    ? "/teacher/classrooms/" + classId + "/exams"
                    : "/teacher/classrooms/" + classId + "/grading";

            notificationService.sendSystemNotification(
                    teacherUserId,
                    title,
                    message,
                    NotificationType.SYSTEM_ALERT.name(),
                    isCheating ? "CHEATING_ALERT" : "SUBMISSION_RECEIVED",
                    targetUrl,
                    attempt.getId()
            );
        } catch (Exception e) {
            log.warn("Không thể gửi thông báo cho giáo viên: {}", e.getMessage());
        }
    }

    @Override

    @Transactional

    public AttemptResponse submitAttempt(UUID studentId, UUID attemptId, SubmissionRequest request) {

        if (request == null) {

            throw new BadRequestException("Dữ liệu nộp bài không được để trống.");

        }

        AssignmentAttempt attempt = attemptRepository.findByIdAndStudentId(attemptId, studentId)

                .orElseThrow(() -> new ResourceNotFoundException("Attempt not found"));



        if (attempt.getSubmittedAt() != null) {

            if (Boolean.TRUE.equals(attempt.getIsCheatingFlagged())) {

                return getAttemptDetail(attemptId, studentId, false);

            }

            throw new BadRequestException("This attempt has already been submitted.");

        }



        Assignment assignment = attempt.getAssignment();
        UUID resolvedAssignmentId = request.getAssignmentId() != null
                ? request.getAssignmentId()
                : (assignment != null ? assignment.getId() : null);
        List<AssignmentQuestion> rawQuestions = questionRepository.findByAssignmentId(resolvedAssignmentId);
        List<AssignmentQuestion> questions = rawQuestions != null ? rawQuestions : Collections.emptyList();
        double finalScore = scoreAndPersistAnswers(attempt, assignment, questions, request.getAnswers());

        if (Boolean.TRUE.equals(request.getCheatingFlagged())) {
            attempt.setIsCheatingFlagged(true);
            if (request.getViolationCount() != null) {
                attempt.setViolationCount(request.getViolationCount());
            }
            if (request.getCheatingReason() != null && !request.getCheatingReason().isBlank()) {
                attempt.setCheatingReason(request.getCheatingReason());
            }
            if (request.getViolationLogJson() != null && !request.getViolationLogJson().isBlank()) {
                attempt.setViolationLogJson(request.getViolationLogJson());
            }
        }

        boolean requiresTeacherGrading = Boolean.TRUE.equals(attempt.getIsCheatingFlagged())
                || questions.stream().anyMatch(q -> {
            if (q.getQuestionType() == QuestionType.ESSAY) {
                return true;
            }
            if (q.getQuestionType() == QuestionType.AUDIO_RESPONSE) {
                StudentAnswer ans = attempt.getAnswers().stream()
                        .filter(a -> a.getQuestion() != null && a.getQuestion().getId().equals(q.getId()))
                        .findFirst().orElse(null);
                return ans == null || ans.getEarnedPoints() == null || ans.getEarnedPoints() == 0.0;
            }
            return false;
        });

        Instant now = Instant.now();

        attempt.setSubmittedAt(now);

        attempt.setTotalScore(finalScore);

        attempt.setStatus(requiresTeacherGrading ? AttemptStatus.SUBMITTED : AttemptStatus.COMPLETED);



        if (attempt.getStartedAt() != null) {

            attempt.setDurationSeconds((int) Duration.between(attempt.getStartedAt(), now).getSeconds());

        }



        attemptRepository.save(attempt);

        log.info("Student {} submitted attempt {} with score {}, status {}", studentId, attemptId, finalScore, attempt.getStatus());



        // Tự động cập nhật Tiến độ Ngày (StudentDailyProgress) và chuỗi Streak thật

        updateDailyProgressOnCompletion(studentId, attempt.getAssignment().getId(), attempt.getDurationSeconds());

        try {

            userStreakService.recordActivity(studentId);

        } catch (Exception streakEx) {

            log.warn("Không thể cập nhật streak cho học sinh {}: {}", studentId, streakEx.getMessage());

        }



        if (Boolean.TRUE.equals(attempt.getIsCheatingFlagged())) {

            notifyTeacherCheatingOrSubmission(attempt, true);

        } else if (!requiresTeacherGrading) {

            if (attempt.getAssignment() != null && attempt.getAssignment().getSkillType() != null) {

                String skillType = attempt.getAssignment().getSkillType().name();

                double skillBoost = finalScore * 0.05;

                analyticsService.updateSkillScore(studentId, skillType, skillBoost);

            }

        } else {

            notifyTeacherCheatingOrSubmission(attempt, false);

        }



        String remedialMessage = computeRemedialMessage(attempt);



        return AttemptResponse.builder()

                .attemptId(attempt.getId())

                .assignmentId(attempt.getAssignment().getId())

                .status(attempt.getStatus().name())

                .score(finalScore)

                .aiFeedback(remedialMessage)

                .audioUrl(attempt.getAssignment().getAudioUrl())

                .listeningScript(attempt.getAssignment().getListeningScript())

                .isExam(Boolean.TRUE.equals(attempt.getAssignment().getIsExam()))

                .violationCount(attempt.getViolationCount())

                .isCheatingFlagged(Boolean.TRUE.equals(attempt.getIsCheatingFlagged()))

                .cheatingReason(attempt.getCheatingReason())

                .answersPersisted(hasAnyPersistedQuestion(attempt.getAssignment()))

                .startedAt(attempt.getStartedAt())

                .submittedAt(attempt.getSubmittedAt())

                .build();

    }

    @Override
    @Transactional
    public AttemptResponse recordAttemptViolation(UUID studentId, UUID attemptId, ExamViolationRequest request) {
        AssignmentAttempt attempt = attemptRepository.findByIdAndStudentId(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Attempt not found"));

        if (attempt.getSubmittedAt() != null) {
            return getAttemptDetail(attemptId, studentId, false);
        }

        Assignment assignment = attempt.getAssignment();
        int maxViolations = (assignment != null && assignment.getMaxViolations() != null && assignment.getMaxViolations() > 0)
                ? assignment.getMaxViolations() : 3;
        int nextCount = (attempt.getViolationCount() != null ? attempt.getViolationCount() : 0) + 1;
        String eventType = request != null ? request.getEventType() : "FOCUS_LOST";
        String reason = request != null && request.getReason() != null && !request.getReason().isBlank()
                ? request.getReason()
                : "Thoát chế độ toàn màn hình hoặc rời cửa sổ thi";

        attempt.setViolationCount(nextCount);
        attempt.setViolationLogJson(appendViolationLog(attempt.getViolationLogJson(), nextCount, eventType, reason));

        if (nextCount >= maxViolations) {
            attempt.setIsCheatingFlagged(true);
            attempt.setCheatingReason("Vi phạm quy chế phòng thi (" + nextCount + "/" + maxViolations + " lần): " + reason);

            List<AssignmentQuestion> questions = assignment != null
                    ? questionRepository.findByAssignmentId(assignment.getId())
                    : Collections.emptyList();
            double finalScore = scoreAndPersistAnswers(attempt, assignment, questions,
                    request != null ? request.getCurrentAnswers() : null);

            Instant now = Instant.now();
            attempt.setSubmittedAt(now);
            attempt.setTotalScore(finalScore);
            attempt.setStatus(AttemptStatus.SUBMITTED);
            if (attempt.getStartedAt() != null) {
                attempt.setDurationSeconds((int) Duration.between(attempt.getStartedAt(), now).getSeconds());
            }
            attemptRepository.save(attempt);
            if (assignment != null) {
                updateDailyProgressOnCompletion(studentId, assignment.getId(), attempt.getDurationSeconds());
            }
            notifyTeacherCheatingOrSubmission(attempt, true);
        } else {
            attemptRepository.save(attempt);
        }

        return getAttemptDetail(attemptId, studentId, false);
    }



    // ==========================================

    // 2. NỘP FILE GHI ÂM (AUDIO RESPONSE)

    // ==========================================

    @Override

    @Transactional

    public AttemptResponse uploadAudioResponse(UUID studentId, UUID attemptId, UUID questionId, MultipartFile audio) {

        AssignmentAttempt attempt = attemptRepository.findByIdAndStudentId(attemptId, studentId)

                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài làm"));



        if (attempt.getSubmittedAt() != null) {

            throw new BadRequestException("Bài kiểm tra đã nộp");

        }

        if (audio == null || audio.isEmpty()) {

            throw new BadRequestException("File ghi âm không được để trống");

        }



        File tempFile = null;

        try {

            String originalFilename = audio.getOriginalFilename();

            String ext = (originalFilename != null && originalFilename.contains("."))

                    ? originalFilename.substring(originalFilename.lastIndexOf("."))

                    : ".wav";



            tempFile = File.createTempFile("audio_", ext);

            audio.transferTo(tempFile);



            String key = "speaking/" + UUID.randomUUID() + ext;

            String contentType = (audio.getContentType() != null && !audio.getContentType().isBlank())

                    ? audio.getContentType()

                    : "audio/wav";



            String url = r2StorageService.uploadFile(key, tempFile, contentType);



            StudentAnswer answer = attempt.getAnswers().stream()

                    .filter(a -> a.getQuestion() != null && a.getQuestion().getId().equals(questionId))

                    .findFirst()

                    .orElseGet(() -> {

                        StudentAnswer newAns = new StudentAnswer();

                        newAns.setAttempt(attempt);

                        AssignmentQuestion q = new AssignmentQuestion();

                        q.setId(questionId);

                        newAns.setQuestion(q);

                        newAns.setEarnedPoints(0.0);

                        newAns.setIsCorrect(false);

                        attempt.getAnswers().add(newAns);

                        return newAns;

                    });



            answer.setAudioResponseUrl(url);

            answerRepository.save(answer);



            return getAttemptDetail(attemptId, studentId, false);

        } catch (Exception e) {

            log.error("Lỗi upload audio: ", e);

            throw new RuntimeException("Lỗi upload audio: " + e.getMessage(), e);

        } finally {

            if (tempFile != null && tempFile.exists()) {

                tempFile.delete();

            }

        }

    }



    // ==========================================

    // 3. CHI TIẾT VÀ LỊCH SỬ BÀI THI

    // ==========================================

    @Override

    @Transactional

    public AttemptResponse getAttemptDetail(UUID attemptId, UUID studentId, boolean isTeacher) {

        AssignmentAttempt attempt = isTeacher

                ? attemptRepository.findById(attemptId)

                        .orElseThrow(() -> new ResourceNotFoundException("Attempt not found"))

                : attemptRepository.findByIdAndStudentId(attemptId, studentId)

                        .orElseThrow(() -> new ResourceNotFoundException("Not found or unauthorized"));



        UUID assignmentId = attempt.getAssignment().getId();

        Assignment assignmentWithQuestions = assignmentRepository.findByIdWithQuestions(assignmentId)

                .orElse(attempt.getAssignment());

        repairCorruptedNonShadowingSpeakingAssignment(assignmentWithQuestions);
        boolean isNonShadowingSpeakingAssignment = ExerciseAudioService.isNonShadowingSpeakingAssignment(assignmentWithQuestions);



        boolean isSubmittedOrCompleted = attempt.getStatus() != AttemptStatus.IN_PROGRESS;

        boolean revealAnswers = isTeacher || isSubmittedOrCompleted;



        List<AssignmentQuestion> detailQuestions = assignmentWithQuestions.getQuestions() != null

                ? assignmentWithQuestions.getQuestions()

                : Collections.emptyList();

        List<AttemptResponse.QuestionResultDetail> questionDetails = detailQuestions.stream()

                .map(q -> {

                    StudentAnswer ans = attempt.getAnswers().stream()

                            .filter(a -> a.getQuestion() != null && a.getQuestion().getId().equals(q.getId()))

                            .findFirst().orElse(null);



                    UUID selectedOptId = null;

                    if (ans != null && (q.getQuestionType() == QuestionType.MULTIPLE_CHOICE

                            || q.getQuestionType() == QuestionType.TRUE_FALSE)) {

                        try {

                            selectedOptId = UUID.fromString(ans.getTextResponse());

                        } catch (Exception ignored) {

                        }

                    }



                    Double rawEarnedPoints = (ans != null && ans.getEarnedPoints() != null) ? ans.getEarnedPoints() : 0.0;
                    Double earnedPoints = (q.getQuestionType() == QuestionType.ESSAY || q.getQuestionType() == QuestionType.AUDIO_RESPONSE)
                            && (q.getPoints() == null || q.getPoints() <= 10.0)
                            && rawEarnedPoints > 10.0
                            ? ScoreScaleUtils.normalizeToScale10OrZero(rawEarnedPoints)
                            : rawEarnedPoints;

                    Boolean isCorrect = ans != null && Boolean.TRUE.equals(ans.getIsCorrect());



                    boolean isAudioResponse = q.getQuestionType() == com.englishlearning.assignment.entity.QuestionType.AUDIO_RESPONSE;

                    boolean isMatching = q.getQuestionType() == com.englishlearning.assignment.entity.QuestionType.MATCHING;



                    List<AttemptResponse.OptionDetail> optionDetails = (q.getOptions() != null)

                            ? q.getOptions().stream().map(opt -> AttemptResponse.OptionDetail.builder()

                                    .id(opt.getId())

                                    .optionLabel(opt.getOptionLabel())

                                    .optionText(opt.getOptionText())

                                    .matchText(opt.getMatchText() != null ? opt.getMatchText() : (isMatching ? q.getCorrectAnswer() : null))

                                    .isCorrect((revealAnswers || (isMatching && Boolean.TRUE.equals(opt.getIsCorrect()))) ? opt.getIsCorrect() : null)

                                    .build()).collect(Collectors.toList())

                            : Collections.emptyList();



                    String feedback = null;

                    AttemptResponse.AiEvaluationDetail aiEvalDetail = null;

                    if (ans != null) {

                        if (ans.getEvalFeedback() != null && !ans.getEvalFeedback().isBlank()) {

                            feedback = ans.getEvalFeedback();

                        }

                        if (ans.getId() != null) {

                            var evalOpt = aiEvaluationRepository.findByStudentAnswerId(ans.getId());

                            if (evalOpt.isPresent()) {

                                var eval = evalOpt.get();

                                if (feedback == null || feedback.isBlank()) {

                                    feedback = eval.getSuggestionsJson();

                                }

                                aiEvalDetail = AttemptResponse.AiEvaluationDetail.builder()

                                        .id(eval.getId())

                                        .evalType(eval.getEvalType() != null ? eval.getEvalType().name() : null)

                                        .overallScore(ScoreScaleUtils.normalizeToScale10(eval.getOverallScore()))

                                        .pronunciationScore(ScoreScaleUtils.normalizeToScale10(eval.getPronunciationScore()))

                                        .fluencyScore(ScoreScaleUtils.normalizeToScale10(eval.getFluencyScore()))

                                        .grammarScore(ScoreScaleUtils.normalizeToScale10(eval.getGrammarScore()))

                                        .vocabularyScore(ScoreScaleUtils.normalizeToScale10(eval.getVocabularyScore()))

                                        .coherenceScore(ScoreScaleUtils.normalizeToScale10(eval.getCoherenceScore()))

                                        .estimatedCefr(eval.getEstimatedCefr())

                                        .sttTranscript(eval.getSttTranscript())

                                        .correctedText(eval.getCorrectedText())

                                        .mistakesJson(eval.getMistakesJson())

                                        .suggestionsJson(eval.getSuggestionsJson())

                                        .build();

                            }

                        }

                    }



                    boolean suppressSampleAudioForQuestion = isNonShadowingSpeakingAssignment
                            || ExerciseAudioService.isNonShadowingSpeakingQuestion(assignmentWithQuestions, q);

                    return AttemptResponse.QuestionResultDetail.builder()

                            .id(q.getId())

                            .questionId(q.getId())

                            .studentAnswerId(ans != null ? ans.getId() : null)

                            .promptText(q.getPromptText())

                            .questionType(q.getQuestionType() != null ? q.getQuestionType().name() : null)

                            .skillType(q.getSkillType() != null

                                    ? q.getSkillType().name()

                                    : (assignmentWithQuestions.getSkillType() != null

                                            ? assignmentWithQuestions.getSkillType().name()

                                            : null))

                            .maxPoints(q.getPoints())

                            .earnedPoints(revealAnswers ? earnedPoints : null)

                            .studentAnswer(ans != null ? ans.getTextResponse() : null)

                            .audioUrl(ans != null ? ans.getAudioResponseUrl() : null)

                            .mediaUrl(suppressSampleAudioForQuestion ? null : q.getMediaUrl())

                            .transcript((!suppressSampleAudioForQuestion && (revealAnswers || isAudioResponse)) ? q.getTranscript() : null)

                            .options(optionDetails)

                            .selectedOptionId(selectedOptId)

                            .correctAnswer((revealAnswers || isAudioResponse || isMatching) ? q.getCorrectAnswer() : null)

                            .matchText(isMatching ? q.getCorrectAnswer() : null)

                            .explanation((revealAnswers || isAudioResponse || isMatching) ? q.getExplanation() : null)

                            .isCorrect(revealAnswers ? isCorrect : null)

                            .evalFeedback(revealAnswers ? feedback : null)

                            .aiEvaluation(revealAnswers ? aiEvalDetail : null)

                            .build();

                }).collect(Collectors.toList());



        AttemptResponse res = mapToAttemptSummary(attempt);

        boolean exposeAudioAndScript = assignmentWithQuestions.getSkillType() == SkillType.LISTENING
                || Boolean.TRUE.equals(assignmentWithQuestions.getIsExam());

        if (exposeAudioAndScript) {

            if (res.getAudioUrl() == null || res.getAudioUrl().isBlank()) {

                res.setAudioUrl(assignmentWithQuestions.getAudioUrl());

            }

            if (res.getListeningScript() == null || res.getListeningScript().isBlank()) {

                res.setListeningScript(assignmentWithQuestions.getListeningScript());

            }

        }

        res.setAnswersPersisted(hasAnyPersistedQuestion(assignmentWithQuestions));

        if (res.getPassage() == null || res.getPassage().isBlank()) {

            res.setPassage(assignmentWithQuestions.getSkillType() == SkillType.LISTENING && assignmentWithQuestions.getListeningScript() != null

                    ? assignmentWithQuestions.getListeningScript()

                    : assignmentWithQuestions.getDescription());

        }

        res.setQuestions(questionDetails);

        return res;

    }

    private void repairCorruptedNonShadowingSpeakingAssignment(Assignment assignment) {
        if (assignment == null || !ExerciseAudioService.isNonShadowingSpeakingAssignment(assignment)) {
            return;
        }
        String resolvedMode = ExerciseAudioService.resolveSpeakingMode(assignment, null, null);
        boolean assignmentDirty = false;
        String desc = assignment.getDescription();
        if (desc != null && (desc.toLowerCase(java.util.Locale.ROOT).contains("- shadowing")
                || desc.toUpperCase(java.util.Locale.ROOT).contains("[SPEAKING_SHADOWING]"))) {
            String replacementLabel = switch (resolvedMode) {
                case "PART_2" -> "Part 2 Cue Card";
                case "PART_3" -> "Part 3 Discussion";
                default -> "Q&A";
            };
            String repairedDesc = desc
                    .replaceAll("(?i)-\\s*Shadowing", "- " + replacementLabel)
                    .replaceAll("(?i)\\[SPEAKING_SHADOWING\\]", "[SPEAKING_" + resolvedMode + "]");
            if (!repairedDesc.equals(desc)) {
                assignment.setDescription(repairedDesc);
                assignmentDirty = true;
            }
        }
        if (assignmentDirty && assignmentRepository != null) {
            assignmentRepository.save(assignment);
        }

        if (assignment.getQuestions() == null) {
            return;
        }
        for (AssignmentQuestion q : assignment.getQuestions()) {
            if (!ExerciseAudioService.isNonShadowingSpeakingQuestion(assignment, q)) {
                continue;
            }
            boolean qDirty = false;
            if (ExerciseAudioService.isCorruptedSpeakingPrompt(q)) {
                String qMode = ExerciseAudioService.resolveSpeakingMode(assignment, q, null);
                String recoveredPrompt = ExerciseAudioService.reconstructEnglishPromptForNonShadowingSpeaking(
                        assignment, q, qMode);
                if (recoveredPrompt != null && !recoveredPrompt.isBlank()) {
                    if ((q.getCorrectAnswer() == null || q.getCorrectAnswer().isBlank())
                            && q.getPromptText() != null && !q.getPromptText().isBlank()) {
                        q.setCorrectAnswer(q.getPromptText().trim());
                    }
                    q.setPromptText(recoveredPrompt);
                    qDirty = true;
                }
            }
            if (q.getTranscript() != null && !q.getTranscript().isBlank()) {
                q.setTranscript(null);
                qDirty = true;
            }
            if (q.getMediaUrl() != null && !q.getMediaUrl().isBlank()) {
                q.setMediaUrl(null);
                qDirty = true;
            }
            if (qDirty && questionRepository != null) {
                questionRepository.save(q);
            }
        }
    }



    @Override

    public List<StudentAssignmentSummaryResponse> getStudentClassAssignments(UUID classId, UUID studentId) {

        if (!classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)) {

            throw new com.englishlearning.common.exception.ForbiddenException("Bạn không phải là thành viên của lớp học này");

        }



        return assignmentRepository.findByClassroomId(classId).stream().map(a -> {

            int attemptsCount = attemptRepository.countAttempts(a.getId(), studentId);

            Double highestScore = attemptRepository.findHighestScore(a.getId(), studentId);

            String status = attemptsCount > 0 ? "COMPLETED"

                    : (a.getDueDate() != null && a.getDueDate().isBefore(Instant.now()) ? "OVERDUE" : "NOT_STARTED");



            boolean isExam = Boolean.TRUE.equals(a.getIsExam());

            boolean isCheatingFlagged = isExam && attemptRepository.findByStudentIdAndAssignmentId(studentId, a.getId())

                    .stream().anyMatch(att -> Boolean.TRUE.equals(att.getIsCheatingFlagged()));

            return StudentAssignmentSummaryResponse.builder()

                    .id(a.getId())

                    .title(a.getTitle())

                    .description(a.getDescription())

                    .skillType(a.getSkillType() != null ? a.getSkillType().name() : null)

                    .timeLimitMinutes(a.getTimeLimitMinutes())

                    .dueDate(a.getDueDate())

                    .maxAttempts(a.getMaxAttempts())

                    .passScore(ScoreScaleUtils.normalizeToScale10(a.getPassScore()))

                    .attemptsCount(attemptsCount)

                    .highestScore(ScoreScaleUtils.normalizeToScale10OrZero(highestScore))

                    .status(status)

                    .isExam(isExam)

                    .examSkills(a.getExamSkills())

                    .strictFullscreen(Boolean.TRUE.equals(a.getStrictFullscreen()))

                    .maxViolations(a.getMaxViolations())

                    .isCheatingFlagged(isCheatingFlagged)

                    .build();

        }).collect(Collectors.toList());

    }



    @Override

    public List<AttemptResponse> getStudentAttemptsHistory(UUID assignmentId, UUID studentId) {

        return attemptRepository.findByAssignmentIdAndStudentIdOrderByAttemptNumberDesc(assignmentId, studentId)

                .stream().map(this::mapToAttemptSummary).collect(Collectors.toList());

    }



    @Override

    public List<SubmissionSummaryResponse> getTeacherSubmissions(UUID assignmentId) {

        return attemptRepository.findByAssignmentIdOrderBySubmittedAtDesc(assignmentId).stream()

                .map(att -> {

                    String studentName = "Học viên";

                    String studentEmail = null;

                    UUID stId = null;

                    if (att.getStudent() != null) {

                        stId = att.getStudent().getId();

                        if (att.getStudent().getUser() != null) {

                            String fn = att.getStudent().getUser().getFirstName() != null ? att.getStudent().getUser().getFirstName() : "";

                            String ln = att.getStudent().getUser().getLastName() != null ? att.getStudent().getUser().getLastName() : "";

                            String combined = (fn + " " + ln).trim();

                            if (!combined.isBlank()) {

                                studentName = combined;

                            }

                            studentEmail = att.getStudent().getUser().getEmail();

                        }

                    }

                    return SubmissionSummaryResponse.builder()

                            .attemptId(att.getId())

                            .studentId(stId)

                            .studentName(studentName)

                            .studentEmail(studentEmail)

                            .attemptNumber(att.getAttemptNumber())

                            .score(ScoreScaleUtils.normalizeToScale10(att.getTotalScore()))

                            .status(att.getStatus() != null ? att.getStatus().name() : null)

                            .submittedAt(att.getSubmittedAt())

                            .violationCount(att.getViolationCount() != null ? att.getViolationCount() : 0)

                            .isCheatingFlagged(Boolean.TRUE.equals(att.getIsCheatingFlagged()))

                            .cheatingReason(att.getCheatingReason())

                            .build();

                })

                .collect(Collectors.toList());

    }



    @Override
    @Transactional(readOnly = true)
    public List<TeacherStudentSubmissionDto> getStudentClassroomSubmissions(UUID classId, UUID studentId) {
        List<AssignmentAttempt> attempts = attemptRepository.findSubmittedByClassroomIdAndStudentId(classId, studentId);
        if (attempts.isEmpty()) {
            return Collections.emptyList();
        }

        List<UUID> assignmentIds = attempts.stream()
                .map(a -> a.getAssignment().getId())
                .distinct()
                .collect(Collectors.toList());

        Map<UUID, List<String>> questionTypesByAssignment = new LinkedHashMap<>();
        List<Object[]> qTypeRows = entityManager.createQuery(
                "SELECT q.assignment.id, q.questionType FROM AssignmentQuestion q WHERE q.assignment.id IN :ids ORDER BY q.orderIndex ASC",
                Object[].class)
                .setParameter("ids", assignmentIds)
                .getResultList();
        for (Object[] row : qTypeRows) {
            UUID aId = (UUID) row[0];
            com.englishlearning.assignment.entity.QuestionType qType = (com.englishlearning.assignment.entity.QuestionType) row[1];
            if (aId != null && qType != null) {
                questionTypesByAssignment
                        .computeIfAbsent(aId, k -> new ArrayList<>())
                        .add(qType.name());
            }
        }

        Map<UUID, com.englishlearning.curriculum.entity.DailyStudyPlan> planByAssignment = new LinkedHashMap<>();
        List<DailyPlanItem> planItems = dailyPlanItemRepository.findByClassroomIdWithDailyPlanAndAssignment(classId);
        for (DailyPlanItem item : planItems) {
            if (item.getAssignment() != null && item.getDailyPlan() != null) {
                planByAssignment.putIfAbsent(item.getAssignment().getId(), item.getDailyPlan());
            }
        }

        Map<UUID, com.englishlearning.ai.entity.AiEvaluation> evalByAnswerId = new LinkedHashMap<>();
        for (com.englishlearning.ai.entity.AiEvaluation eval : aiEvaluationRepository.findByStudentId(studentId)) {
            if (eval.getStudentAnswer() != null && eval.getStudentAnswer().getId() != null) {
                evalByAnswerId.put(eval.getStudentAnswer().getId(), eval);
            }
        }

        return attempts.stream().map(a -> {
            Assignment ass = a.getAssignment();
            UUID assId = ass.getId();
            String skillType = ass.getSkillType() != null ? ass.getSkillType().name() : null;
            List<String> qTypes = questionTypesByAssignment.getOrDefault(assId, Collections.emptyList())
                    .stream().distinct().collect(Collectors.toList());

            com.englishlearning.curriculum.entity.DailyStudyPlan plan = planByAssignment.get(assId);

            boolean hasAudio = "SPEAKING".equals(skillType) || qTypes.contains("AUDIO_RESPONSE");
            boolean hasFeedback = false;
            com.englishlearning.ai.entity.AiEvaluation matchedEval = null;
            String previewText = null;

            if (a.getAnswers() != null) {
                for (StudentAnswer ans : a.getAnswers()) {
                    if (ans.getAudioResponseUrl() != null && !ans.getAudioResponseUrl().isBlank()) {
                        hasAudio = true;
                    }
                    if (ans.getEvalFeedback() != null && !ans.getEvalFeedback().isBlank()) {
                        hasFeedback = true;
                    }
                    if (matchedEval == null && ans.getId() != null) {
                        matchedEval = evalByAnswerId.get(ans.getId());
                    }
                    if (previewText == null && ans.getTextResponse() != null && !ans.getTextResponse().isBlank()) {
                        previewText = ans.getTextResponse().trim();
                    }
                }
            }

            if ((previewText == null || previewText.isBlank()) && matchedEval != null
                    && matchedEval.getSttTranscript() != null && !matchedEval.getSttTranscript().isBlank()) {
                previewText = matchedEval.getSttTranscript().trim();
            }
            if (previewText != null && previewText.length() > 220) {
                previewText = previewText.substring(0, 217) + "...";
            }

            return TeacherStudentSubmissionDto.builder()
                    .attemptId(a.getId())
                    .assignmentId(assId)
                    .assignmentTitle(ass.getTitle())
                    .skillType(skillType)
                    .questionTypes(qTypes)
                    .attemptNumber(a.getAttemptNumber())
                    .status(a.getStatus().name())
                    .score(ScoreScaleUtils.normalizeToScale10(a.getTotalScore()))
                    .teacherFeedback(a.getTeacherFeedback())
                    .submittedAt(a.getSubmittedAt() != null ? a.getSubmittedAt() : a.getStartedAt())
                    .dayNumber(plan != null ? plan.getDayNumber() : null)
                    .dayTitle(plan != null ? plan.getTitle() : null)
                    .scheduledDate(plan != null ? plan.getScheduledDate() : null)
                    .hasAiEvaluation(matchedEval != null || hasFeedback)
                    .aiScore(matchedEval != null ? ScoreScaleUtils.normalizeToScale10(matchedEval.getOverallScore()) : null)
                    .aiCefr(matchedEval != null ? matchedEval.getEstimatedCefr() : null)
                    .aiEvalType(matchedEval != null && matchedEval.getEvalType() != null
                            ? matchedEval.getEvalType().name() : null)
                    .previewText(previewText)
                    .hasAudio(hasAudio)
                    .isExam(Boolean.TRUE.equals(ass.getIsExam()))
                    .violationCount(a.getViolationCount() != null ? a.getViolationCount() : 0)
                    .isCheatingFlagged(Boolean.TRUE.equals(a.getIsCheatingFlagged()))
                    .cheatingReason(a.getCheatingReason())
                    .build();
        }).collect(Collectors.toList());
    }



    @Override

    @Transactional

    public AttemptResponse gradeSubmission(UUID attemptId, TeacherGradeRequest request) {

        AssignmentAttempt attempt = attemptRepository.findById(attemptId)

                .orElseThrow(() -> new ResourceNotFoundException("Not found"));

        if (request == null || request.getFinalScore() == null
                || !Double.isFinite(request.getFinalScore())
                || request.getFinalScore() < 0.0
                || request.getFinalScore() > 10.0) {
            throw new BadRequestException("Điểm số phải nằm trong thang điểm từ 0 đến 10");
        }
        double validatedFinalScore = ScoreScaleUtils.clampScale10(request.getFinalScore());

        if (request.getAnswerScores() != null && !request.getAnswerScores().isEmpty()) {

            for (Map.Entry<UUID, Double> entry : request.getAnswerScores().entrySet()) {

                UUID targetId = entry.getKey();

                Double score = entry.getValue();

                if (targetId == null || score == null) {

                    continue;

                }
                if (!Double.isFinite(score) || score < 0.0) {
                    throw new BadRequestException("Điểm từng câu không được nhỏ hơn 0");
                }

                attempt.getAnswers().stream()

                        .filter(a -> a.getId().equals(targetId) || (a.getQuestion() != null && a.getQuestion().getId().equals(targetId)))

                        .findFirst()

                        .ifPresent(ans -> {

                            double maxPt = (ans.getQuestion() != null && ans.getQuestion().getPoints() != null)
                                    ? ans.getQuestion().getPoints() : 10.0;
                            boolean isSubjective = ans.getQuestion() != null &&
                                    (ans.getQuestion().getQuestionType() == QuestionType.ESSAY
                                            || ans.getQuestion().getQuestionType() == QuestionType.AUDIO_RESPONSE);
                            if (isSubjective && score > 10.0) {
                                throw new BadRequestException("Điểm câu tự luận/nói phải từ 0 đến 10");
                            }
                            if (!isSubjective && maxPt > 0 && score > maxPt) {
                                throw new BadRequestException("Điểm câu hỏi không được vượt quá điểm tối đa (" + maxPt + ")");
                            }
                            double savedQuestionScore = isSubjective
                                    ? ScoreScaleUtils.clampScale10(score)
                                    : ScoreScaleUtils.roundOneDecimal(score);
                            ans.setEarnedPoints(savedQuestionScore);
                            ans.setIsCorrect(isSubjective ? savedQuestionScore >= 5.0 : savedQuestionScore >= (maxPt * 0.5));

                            answerRepository.save(ans);

                        });

            }

        } else if (attempt.getAnswers() != null && attempt.getAnswers().size() == 1) {

            StudentAnswer singleAns = attempt.getAnswers().get(0);

            if (singleAns.getQuestion() != null && (singleAns.getQuestion().getQuestionType() == com.englishlearning.assignment.entity.QuestionType.ESSAY
                    || singleAns.getQuestion().getQuestionType() == com.englishlearning.assignment.entity.QuestionType.AUDIO_RESPONSE)) {

                singleAns.setEarnedPoints(validatedFinalScore);

                singleAns.setIsCorrect(validatedFinalScore >= 5.0);

                answerRepository.save(singleAns);

            }

        }



        attempt.setTeacherFeedback(request.getFeedback());

        attempt.setTotalScore(validatedFinalScore);

        attempt.setStatus(AttemptStatus.COMPLETED);

        attemptRepository.save(attempt);



        if (attempt.getAssignment() != null && attempt.getAssignment().getSkillType() != null

                && attempt.getStudent() != null) {

            String skillType = attempt.getAssignment().getSkillType().name();

            double skillBoost = validatedFinalScore * 0.05;

            analyticsService.updateSkillScore(attempt.getStudent().getId(), skillType, skillBoost);

        }

        if (attempt.getStudent() != null && attempt.getAssignment() != null) {

            updateDailyProgressOnCompletion(attempt.getStudent().getId(), attempt.getAssignment().getId(), attempt.getDurationSeconds());

        }



        try {

            UUID studentUserId = attempt.getStudent().getId();

            boolean isExam = Boolean.TRUE.equals(attempt.getAssignment().getIsExam());

            String title = isExam ? "Bài thi đã được chấm điểm" : "Bài tập đã được chấm điểm";

            String feedbackMsg = (request.getFeedback() != null && !request.getFeedback().isBlank())

                    ? (" Nhận xét: " + request.getFeedback())

                    : "";

            String message = String.format("Giáo viên đã chấm %s \"%s\": Điểm %.1f/10.%s",

                    isExam ? "bài thi" : "bài tập",

                    attempt.getAssignment().getTitle(),

                    validatedFinalScore,

                    feedbackMsg);

            String redirectUrl = isExam

                    ? "/student/exams/" + attempt.getAssignment().getId() + "/take"

                    : "/student/assignments/" + attempt.getAssignment().getId() + "/take";

            notificationService.sendSystemNotification(

                    studentUserId,

                    title,

                    message,

                    NotificationType.NEW_GRADE.name(),

                    "GRADED",

                    redirectUrl,

                    attempt.getAssignment().getId()

            );

        } catch (Exception e) {

            log.warn("Không thể gửi thông báo chấm điểm cho học sinh: {}", e.getMessage());

        }



        return mapToAttemptSummary(attempt);

    }



    public AttemptResponse submitAssignment(UUID studentId, UUID attemptId, SubmissionRequest request) {

        return submitAttempt(studentId, attemptId, request);

    }



    private void updateDailyProgressOnCompletion(UUID studentId, UUID assignmentId, Integer durationSeconds) {

        try {

            List<DailyPlanItem> items = dailyPlanItemRepository

                    .findByAssignmentIdWithDailyPlan(assignmentId);



            for (var item : items) {

                var plan = item.getDailyPlan();

                if (plan != null) {

                    List<DailyPlanItem> allPlanItems = dailyPlanItemRepository.findByDailyPlanIdOrderByOrderIndexAsc(plan.getId());

                    int totalItems = allPlanItems.size();



                    int actualCompletedCount = 0;

                    for (DailyPlanItem planItem : allPlanItems) {

                        if (planItem.getAssignment() != null) {

                            boolean isSubmitted = attemptRepository.countAttempts(planItem.getAssignment().getId(), studentId) > 0;

                            if (isSubmitted) {

                                actualCompletedCount++;

                            }

                        }

                    }



                    var progress = progressRepository.findByStudentIdAndDailyPlanId(studentId, plan.getId())

                            .orElseGet(() -> com.englishlearning.curriculum.entity.StudentDailyProgress.builder()

                                    .student(entityManager.getReference(Student.class, studentId))

                                    .dailyPlan(plan)

                                    .totalItemsCount(totalItems)

                                    .completedItemsCount(0)

                                    .isCompleted(false)

                                    .build());



                    progress.setTotalItemsCount(totalItems);

                    progress.setCompletedItemsCount(actualCompletedCount);



                    int currentSpent = progress.getTimeSpentSeconds() != null ? progress.getTimeSpentSeconds() : 0;

                    if (durationSeconds != null && durationSeconds > 0) {

                        progress.setTimeSpentSeconds(currentSpent + durationSeconds);

                    }



                    boolean isAllDone = totalItems > 0 && actualCompletedCount >= totalItems;

                    progress.setIsCompleted(isAllDone);

                    if (isAllDone) {

                        progress.setCompletedAt(Instant.now());

                    } else {

                        progress.setCompletedAt(null);

                    }



                    progressRepository.save(progress);

                    log.info("Cập nhật tiến độ ngày {} cho học sinh {}: {}/{} bài tập hoàn thành, isCompleted={}, timeSpent={}s",

                            plan.getDayNumber(), studentId, actualCompletedCount, totalItems, isAllDone, progress.getTimeSpentSeconds());

                }

            }

        } catch (Exception e) {

            log.warn("Không thể cập nhật tiến độ Daily Study Plan: {}", e.getMessage());

        }

    }



    private AttemptResponse mapToAttemptSummary(AssignmentAttempt att) {

        boolean isExam = Boolean.TRUE.equals(att.getAssignment().getIsExam());

        boolean isListeningAssignment = att.getAssignment().getSkillType() == SkillType.LISTENING || isExam;

        String audioUrl = isListeningAssignment ? att.getAssignment().getAudioUrl() : null;

        String listeningScript = isListeningAssignment ? att.getAssignment().getListeningScript() : null;



        String passage = listeningScript != null ? listeningScript : att.getAssignment().getDescription();



        return AttemptResponse.builder()

                .attemptId(att.getId())

                .assignmentId(att.getAssignment().getId())

                .assignmentTitle(att.getAssignment().getTitle())

                .assignmentDescription(att.getAssignment().getDescription())

                .skillType(att.getAssignment().getSkillType() != null ? att.getAssignment().getSkillType().name() : null)

                .audioUrl(audioUrl)

                .listeningScript(listeningScript)

                .passage(passage)

                .attemptNumber(att.getAttemptNumber())

                .score(ScoreScaleUtils.normalizeToScale10(att.getTotalScore()))

                .status(att.getStatus().name())

                .teacherFeedback(att.getTeacherFeedback())

                .aiFeedback(computeRemedialMessage(att))

                .timeLimitMinutes(att.getAssignment().getTimeLimitMinutes())

                .passScore(ScoreScaleUtils.normalizeToScale10(att.getAssignment().getPassScore()))

                .maxAllowedErrorPercent(att.getAssignment().getMaxAllowedErrorPercent())

                .maxAttempts(att.getAssignment().getMaxAttempts())

                .isExam(isExam)

                .examSkills(att.getAssignment().getExamSkills())

                .strictFullscreen(Boolean.TRUE.equals(att.getAssignment().getStrictFullscreen()))

                .maxViolations(att.getAssignment().getMaxViolations())

                .violationCount(att.getViolationCount() != null ? att.getViolationCount() : 0)

                .isCheatingFlagged(Boolean.TRUE.equals(att.getIsCheatingFlagged()))

                .cheatingReason(att.getCheatingReason())

                .violationLogJson(att.getViolationLogJson())

                .answersPersisted(hasAnyPersistedQuestion(att.getAssignment()))

                .startedAt(att.getStartedAt())

                .submittedAt(att.getSubmittedAt())

                .build();

    }



    @Override

    public String computeRemedialMessage(AssignmentAttempt att) {

        if (att == null || att.getStatus() == AttemptStatus.IN_PROGRESS || att.getAssignment() == null) {

            return null;

        }



        boolean hasEssay = false;

        try {

            if (att.getAssignment().getQuestions() != null) {

                hasEssay = att.getAssignment().getQuestions().stream()

                        .anyMatch(q -> q.getQuestionType() == com.englishlearning.assignment.entity.QuestionType.ESSAY);

            }

        } catch (Exception ignored) {}



        if (hasEssay) {

            return "Bài viết tự luận đã được nộp thành công và đang chờ giáo viên / AI chấm điểm chuyên sâu.";

        }



        double score = ScoreScaleUtils.normalizeToScale10OrZero(att.getTotalScore());

        double scorePercent = (score / 10.0) * 100.0;

        double errorRate = Math.max(0.0, Math.min(100.0, 100.0 - scorePercent));

        errorRate = Math.round(errorRate * 10.0) / 10.0;



        com.englishlearning.assignment.entity.SkillType skill = att.getAssignment().getSkillType();

        if (skill == com.englishlearning.assignment.entity.SkillType.VOCABULARY ||

            skill == com.englishlearning.assignment.entity.SkillType.GRAMMAR ||

            skill == com.englishlearning.assignment.entity.SkillType.READING) {

            if (errorRate > 50.0 || scorePercent < 50.0) {

                return String.format("Kết quả bài làm chưa đạt chuẩn (Sai %.0f%%). Bạn cần làm lại bài tập này để củng cố kiến thức!", errorRate);

            } else {

                return "Chúc mừng! Bạn đã hoàn thành xuất sắc bài tập và đạt chuẩn kiến thức.";

            }

        } else if (skill == com.englishlearning.assignment.entity.SkillType.LISTENING) {

            if (errorRate > 70.0 || scorePercent < 30.0) {

                return String.format("Kết quả bài nghe chưa đạt chuẩn (Sai %.0f%%). Bạn hãy luyện tập nghe lại bài này để cải thiện kỹ năng!", errorRate);

            } else {

                return "Chúc mừng! Bạn đã đạt chuẩn kỹ năng nghe.";

            }

        } else if (skill == com.englishlearning.assignment.entity.SkillType.WRITING) {

            if (errorRate > 70.0 || scorePercent < 30.0) {

                return String.format("Kết quả bài tập chưa đạt chuẩn (Sai %.0f%%). Hãy luyện tập làm lại để nắm vững cấu trúc câu!", errorRate);

            } else {

                return "Chúc mừng! Bạn đã hoàn thành bài tập ngữ pháp viết câu đạt chuẩn.";

            }

        } else {

            if (errorRate > 50.0) {

                return String.format("Kết quả bài làm chưa đạt chuẩn (Sai %.0f%%). Bạn cần làm lại bài tập này để củng cố kiến thức!", errorRate);

            } else {

                return "Chúc mừng! Bạn đã hoàn thành bài tập đạt chuẩn.";

            }

        }

    }

}

