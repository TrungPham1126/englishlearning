package com.englishlearning.submission.service.impl;

import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

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

        // 1. NẾU ĐANG CÓ LẦN LÀM DỞ DANG (IN_PROGRESS) -> TRẢ VỀ TIẾP TỤC
        Optional<AssignmentAttempt> existingInProgress = previousAttempts.stream()
                .filter(att -> att.getStatus() == AttemptStatus.IN_PROGRESS)
                .findFirst();

        if (existingInProgress.isPresent()) {
            AssignmentAttempt current = existingInProgress.get();
            boolean hasNewAnswers = false;
            for (AssignmentQuestion q : assignment.getQuestions()) {
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
                : 1;

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
            double scorePercent = (lastScore / 10.0) * 100.0;
            double errorRate = Math.max(0.0, 100.0 - scorePercent);

            com.englishlearning.assignment.entity.SkillType skill = assignment.getSkillType();
            if (skill == com.englishlearning.assignment.entity.SkillType.VOCABULARY ||
                skill == com.englishlearning.assignment.entity.SkillType.GRAMMAR ||
                skill == com.englishlearning.assignment.entity.SkillType.READING) {
                if (errorRate > 50.0 || scorePercent < 50.0) {
                    allowsOrNeedsRetake = true;
                }
            } else if (skill == com.englishlearning.assignment.entity.SkillType.LISTENING) {
                if (errorRate > 70.0 || scorePercent < 30.0) {
                    allowsOrNeedsRetake = true;
                }
            } else if (skill == com.englishlearning.assignment.entity.SkillType.WRITING) {
                if (errorRate > 70.0 || scorePercent < 30.0) {
                    allowsOrNeedsRetake = true;
                }
            } else {
                if (errorRate > 50.0 || scorePercent < 50.0) {
                    allowsOrNeedsRetake = true;
                }
            }
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

        for (AssignmentQuestion q : assignment.getQuestions()) {
            StudentAnswer ans = new StudentAnswer();
            ans.setAttempt(attempt);
            ans.setQuestion(q);
            ans.setEarnedPoints(0.0);
            ans.setIsCorrect(false);
            attempt.getAnswers().add(ans);
            answerRepository.save(ans);
        }
        attempt = attemptRepository.save(attempt);

        log.info("Khởi tạo lượt thi #{} cho học sinh {} với {} câu hỏi", attempt.getAttemptNumber(), studentId, assignment.getQuestions().size());
        return getAttemptDetail(attempt.getId(), studentId, false);
    }

    @Override
    @Transactional
    public AttemptResponse submitAttempt(UUID studentId, UUID attemptId, SubmissionRequest request) {
        AssignmentAttempt attempt = attemptRepository.findByIdAndStudentId(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Attempt not found"));

        if (attempt.getSubmittedAt() != null) {
            throw new BadRequestException("This attempt has already been submitted.");
        }

        List<AssignmentQuestion> questions = questionRepository.findByAssignmentId(request.getAssignmentId());
        Map<UUID, AssignmentQuestion> questionMap = questions.stream()
                .collect(Collectors.toMap(AssignmentQuestion::getId, q -> q));

        double totalScore = 0.0;

        for (SubmissionRequest.AnswerDto ansReq : request.getAnswers()) {
            StudentAnswer answer = attempt.getAnswers().stream()
                    .filter(a -> a.getQuestion() != null && a.getQuestion().getId().equals(ansReq.getQuestionId()))
                    .findFirst()
                    .orElseGet(() -> {
                        StudentAnswer newAns = new StudentAnswer();
                        newAns.setAttempt(attempt);
                        AssignmentQuestion questionRef = new AssignmentQuestion();
                        questionRef.setId(ansReq.getQuestionId());
                        newAns.setQuestion(questionRef);
                        attempt.getAnswers().add(newAns);
                        return newAns;
                    });

            if (ansReq.getTextAnswer() != null && !ansReq.getTextAnswer().isBlank()) {
                answer.setTextResponse(ansReq.getTextAnswer());
            } else if (ansReq.getSelectedOptionId() != null) {
                answer.setTextResponse(ansReq.getSelectedOptionId().toString());
            }

            AssignmentQuestion question = questionMap.get(ansReq.getQuestionId());
            if (question != null) {
                boolean isCorrect = false;
                if (ansReq.getSelectedOptionId() != null && question.getOptions() != null) {
                    isCorrect = question.getOptions().stream()
                            .anyMatch(opt -> opt.getId().equals(ansReq.getSelectedOptionId()) && opt.getIsCorrect());
                    answer.setIsCorrect(isCorrect);
                    if (isCorrect) {
                        double point = question.getPoints() != null ? question.getPoints() : 1.0;
                        answer.setEarnedPoints(point);
                        totalScore += point;
                    } else {
                        answer.setEarnedPoints(0.0);
                    }
                } else if (question.getQuestionType() == com.englishlearning.assignment.entity.QuestionType.AUDIO_RESPONSE) {
                    double point = question.getPoints() != null ? question.getPoints() : 10.0;
                    if (answer.getEarnedPoints() != null && answer.getEarnedPoints() > 0) {
                        totalScore += (answer.getEarnedPoints() / 10.0) * point;
                    } else if (answer.getId() != null) {
                        var evalOpt = aiEvaluationRepository.findByStudentAnswerId(answer.getId());
                        if (evalOpt.isPresent()) {
                            double aiScore = evalOpt.get().getOverallScore() != null ? evalOpt.get().getOverallScore() : 0.0;
                            answer.setEarnedPoints(aiScore);
                            answer.setIsCorrect(aiScore >= 5.0);
                            totalScore += (aiScore / 10.0) * point;
                        }
                    }
                } else if (ansReq.getTextAnswer() != null && !ansReq.getTextAnswer().isBlank()) {
                    if (question.getCorrectAnswer() != null && !question.getCorrectAnswer().isBlank()) {
                        isCorrect = ansReq.getTextAnswer().trim().equalsIgnoreCase(question.getCorrectAnswer().trim());
                        answer.setIsCorrect(isCorrect);
                        if (isCorrect) {
                            double point = question.getPoints() != null ? question.getPoints() : 1.0;
                            answer.setEarnedPoints(point);
                            totalScore += point;
                        } else {
                            answer.setEarnedPoints(0.0);
                        }
                    }
                }
            }
            answerRepository.save(answer);
        }

        double maxPossible = questions.stream().mapToDouble(q -> q.getPoints() != null ? q.getPoints() : 1.0).sum();
        double finalScore = maxPossible > 0 ? (totalScore / maxPossible) * 10.0 : (questions.isEmpty() ? 0 : (totalScore / questions.size()) * 10.0);
        finalScore = Math.round(finalScore * 10.0) / 10.0;
        boolean requiresTeacherGrading = questions.stream().anyMatch(q -> {
            if (q.getQuestionType() == com.englishlearning.assignment.entity.QuestionType.ESSAY) {
                return true;
            }
            if (q.getQuestionType() == com.englishlearning.assignment.entity.QuestionType.AUDIO_RESPONSE) {
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

        if (!requiresTeacherGrading) {
            String skillType = attempt.getAssignment().getSkillType().name();
            double skillBoost = finalScore * 0.05;
            analyticsService.updateSkillScore(studentId, skillType, skillBoost);
            updateDailyProgressOnCompletion(studentId, attempt.getAssignment().getId());
        } else if (attempt.getAssignment().getClassroom() != null && attempt.getAssignment().getClassroom().getTeacher() != null) {
            try {
                UUID teacherUserId = attempt.getAssignment().getClassroom().getTeacher().getId();
                notificationService.sendSystemNotification(
                        teacherUserId,
                        "Bài nộp mới cần chấm điểm",
                        "Học sinh đã nộp bài tập \"" + attempt.getAssignment().getTitle() + "\" cần bạn đánh giá.",
                        NotificationType.SYSTEM_ALERT.name(),
                        "/teacher/grading"
                );
            } catch (Exception e) {
                log.warn("Không thể gửi thông báo cho giáo viên: {}", e.getMessage());
            }
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
                .startedAt(attempt.getStartedAt())
                .submittedAt(attempt.getSubmittedAt())
                .build();
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
    @Transactional(readOnly = true)
    public AttemptResponse getAttemptDetail(UUID attemptId, UUID studentId, boolean isTeacher) {
        AssignmentAttempt attempt = isTeacher
                ? attemptRepository.findById(attemptId)
                        .orElseThrow(() -> new ResourceNotFoundException("Attempt not found"))
                : attemptRepository.findByIdAndStudentId(attemptId, studentId)
                        .orElseThrow(() -> new ResourceNotFoundException("Not found or unauthorized"));

        UUID assignmentId = attempt.getAssignment().getId();
        Assignment assignmentWithQuestions = assignmentRepository.findByIdWithQuestions(assignmentId)
                .orElse(attempt.getAssignment());

        boolean isSubmittedOrCompleted = attempt.getStatus() != AttemptStatus.IN_PROGRESS;
        boolean revealAnswers = isTeacher || isSubmittedOrCompleted;

        List<AttemptResponse.QuestionResultDetail> questionDetails = assignmentWithQuestions.getQuestions().stream()
                .map(q -> {
                    StudentAnswer ans = attempt.getAnswers().stream()
                            .filter(a -> a.getQuestion() != null && a.getQuestion().getId().equals(q.getId()))
                            .findFirst().orElse(null);

                    UUID selectedOptId = null;
                    if (ans != null && q
                            .getQuestionType() == com.englishlearning.assignment.entity.QuestionType.MULTIPLE_CHOICE) {
                        try {
                            selectedOptId = UUID.fromString(ans.getTextResponse());
                        } catch (Exception ignored) {
                        }
                    }

                    Double earnedPoints = (ans != null && ans.getEarnedPoints() != null) ? ans.getEarnedPoints() : 0.0;
                    Boolean isCorrect = ans != null && Boolean.TRUE.equals(ans.getIsCorrect());

                    List<AttemptResponse.OptionDetail> optionDetails = (q.getOptions() != null)
                            ? q.getOptions().stream().map(opt -> AttemptResponse.OptionDetail.builder()
                                    .id(opt.getId())
                                    .optionLabel(opt.getOptionLabel())
                                    .optionText(opt.getOptionText())
                                    .isCorrect(revealAnswers ? opt.getIsCorrect() : null)
                                    .build()).collect(Collectors.toList())
                            : Collections.emptyList();

                    String feedback = null;
                    if (ans != null) {
                        if (ans.getEvalFeedback() != null && !ans.getEvalFeedback().isBlank()) {
                            feedback = ans.getEvalFeedback();
                        } else if (ans.getId() != null) {
                            var evalOpt = aiEvaluationRepository.findByStudentAnswerId(ans.getId());
                            if (evalOpt.isPresent()) {
                                feedback = evalOpt.get().getSuggestionsJson();
                            }
                        }
                    }

                    boolean isAudioResponse = q.getQuestionType() == com.englishlearning.assignment.entity.QuestionType.AUDIO_RESPONSE;

                    return AttemptResponse.QuestionResultDetail.builder()
                            .id(q.getId())
                            .questionId(q.getId())
                            .studentAnswerId(ans != null ? ans.getId() : null)
                            .promptText(q.getPromptText())
                            .questionType(q.getQuestionType().name())
                            .maxPoints(q.getPoints())
                            .earnedPoints(revealAnswers ? earnedPoints : null)
                            .studentAnswer(ans != null ? ans.getTextResponse() : null)
                            .audioUrl(ans != null ? ans.getAudioResponseUrl() : null)
                            .mediaUrl(q.getMediaUrl())
                            .transcript((revealAnswers || isAudioResponse) ? q.getTranscript() : null)
                            .options(optionDetails)
                            .selectedOptionId(selectedOptId)
                            .correctAnswer((revealAnswers || isAudioResponse) ? q.getCorrectAnswer() : null)
                            .explanation((revealAnswers || isAudioResponse) ? q.getExplanation() : null)
                            .isCorrect(revealAnswers ? isCorrect : null)
                            .evalFeedback(revealAnswers ? feedback : null)
                            .build();
                }).collect(Collectors.toList());

        AttemptResponse res = mapToAttemptSummary(attempt);
        if (assignmentWithQuestions.getSkillType() == com.englishlearning.assignment.entity.SkillType.LISTENING) {
            if (res.getAudioUrl() == null || res.getAudioUrl().isBlank()) {
                res.setAudioUrl(assignmentWithQuestions.getAudioUrl());
            }
            if (res.getListeningScript() == null || res.getListeningScript().isBlank()) {
                res.setListeningScript(assignmentWithQuestions.getListeningScript());
            }
        }
        if (res.getPassage() == null || res.getPassage().isBlank()) {
            res.setPassage(assignmentWithQuestions.getSkillType() == com.englishlearning.assignment.entity.SkillType.LISTENING && assignmentWithQuestions.getListeningScript() != null
                    ? assignmentWithQuestions.getListeningScript()
                    : assignmentWithQuestions.getDescription());
        }
        res.setQuestions(questionDetails);
        return res;
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

            return StudentAssignmentSummaryResponse.builder()
                    .id(a.getId())
                    .title(a.getTitle())
                    .description(a.getDescription())
                    .skillType(a.getSkillType().name())
                    .timeLimitMinutes(a.getTimeLimitMinutes())
                    .dueDate(a.getDueDate())
                    .maxAttempts(a.getMaxAttempts())
                    .passScore(a.getPassScore())
                    .attemptsCount(attemptsCount)
                    .highestScore(highestScore != null ? highestScore : 0.0)
                    .status(status)
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
                .map(att -> SubmissionSummaryResponse.builder()
                        .attemptId(att.getId())
                        .studentId(att.getStudent().getId())
                        .studentName(att.getStudent().getUser().getFirstName() + " "
                                + att.getStudent().getUser().getLastName())
                        .studentEmail(att.getStudent().getUser().getEmail())
                        .attemptNumber(att.getAttemptNumber())
                        .score(att.getTotalScore())
                        .status(att.getStatus().name())
                        .submittedAt(att.getSubmittedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public AttemptResponse gradeSubmission(UUID attemptId, TeacherGradeRequest request) {
        AssignmentAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Not found"));

        if (request.getAnswerScores() != null && !request.getAnswerScores().isEmpty()) {
            for (Map.Entry<UUID, Double> entry : request.getAnswerScores().entrySet()) {
                UUID targetId = entry.getKey();
                Double score = entry.getValue();
                attempt.getAnswers().stream()
                        .filter(a -> a.getId().equals(targetId) || (a.getQuestion() != null && a.getQuestion().getId().equals(targetId)))
                        .findFirst()
                        .ifPresent(ans -> {
                            ans.setEarnedPoints(score);
                            ans.setIsCorrect(score >= 5.0);
                            answerRepository.save(ans);
                        });
            }
        }

        attempt.setTeacherFeedback(request.getFeedback());
        attempt.setTotalScore(request.getFinalScore());
        attempt.setStatus(AttemptStatus.COMPLETED);
        attemptRepository.save(attempt);

        String skillType = attempt.getAssignment().getSkillType().name();
        double skillBoost = request.getFinalScore() * 0.05;
        analyticsService.updateSkillScore(attempt.getStudent().getId(), skillType, skillBoost);
        updateDailyProgressOnCompletion(attempt.getStudent().getId(), attempt.getAssignment().getId());

        try {
            UUID studentUserId = attempt.getStudent().getId();
            String title = "Bài tập đã được chấm điểm";
            String feedbackMsg = (request.getFeedback() != null && !request.getFeedback().isBlank())
                    ? (" Nhận xét: " + request.getFeedback())
                    : "";
            String message = String.format("Giáo viên đã chấm bài tập \"%s\": Điểm %.1f/10.%s",
                    attempt.getAssignment().getTitle(),
                    request.getFinalScore(),
                    feedbackMsg);
            String redirectUrl = "/student/assignments/" + attempt.getAssignment().getId() + "/submissions/" + attempt.getId();
            notificationService.sendSystemNotification(studentUserId, title, message, NotificationType.NEW_GRADE.name(), redirectUrl);
        } catch (Exception e) {
            log.warn("Không thể gửi thông báo chấm điểm cho học sinh: {}", e.getMessage());
        }

        return mapToAttemptSummary(attempt);
    }

    private void updateDailyProgressOnCompletion(UUID studentId, UUID assignmentId) {
        try {
            List<com.englishlearning.curriculum.entity.DailyPlanItem> items = entityManager.createQuery(
                    "SELECT dpi FROM DailyPlanItem dpi JOIN FETCH dpi.dailyPlan dp WHERE dpi.assignment.id = :aId",
                    com.englishlearning.curriculum.entity.DailyPlanItem.class)
                    .setParameter("aId", assignmentId)
                    .getResultList();

            for (var item : items) {
                var plan = item.getDailyPlan();
                if (plan != null) {
                    var progress = progressRepository.findByStudentIdAndDailyPlanId(studentId, plan.getId())
                            .orElseGet(() -> com.englishlearning.curriculum.entity.StudentDailyProgress.builder()
                                    .student(entityManager.getReference(Student.class, studentId))
                                    .dailyPlan(plan)
                                    .totalItemsCount(plan.getItems() != null ? plan.getItems().size() : 1)
                                    .completedItemsCount(0)
                                    .isCompleted(false)
                                    .build());
                    int completed = progress.getCompletedItemsCount() != null ? progress.getCompletedItemsCount() + 1 : 1;
                    progress.setCompletedItemsCount(completed);
                    int total = (plan.getItems() != null && !plan.getItems().isEmpty()) ? plan.getItems().size() : 1;
                    if (completed >= total) {
                        progress.setIsCompleted(true);
                        progress.setCompletedAt(Instant.now());
                    }
                    progressRepository.save(progress);
                    log.info("Cập nhật tiến độ ngày {} cho học sinh {}: {}/{} mục", plan.getDayNumber(), studentId, completed, total);
                }
            }
        } catch (Exception e) {
            log.warn("Không thể cập nhật tiến độ Daily Study Plan: {}", e.getMessage());
        }
    }

    private AttemptResponse mapToAttemptSummary(AssignmentAttempt att) {
        boolean isListeningAssignment = att.getAssignment().getSkillType() == com.englishlearning.assignment.entity.SkillType.LISTENING;
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
                .score(att.getTotalScore())
                .status(att.getStatus().name())
                .teacherFeedback(att.getTeacherFeedback())
                .aiFeedback(computeRemedialMessage(att))
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

        Double score = att.getTotalScore();
        if (score == null) {
            score = 0.0;
        }
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
