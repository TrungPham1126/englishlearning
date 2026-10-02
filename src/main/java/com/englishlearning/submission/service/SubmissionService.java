package com.englishlearning.submission.service;

import com.englishlearning.analytics.service.AnalyticsService;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.submission.dto.*;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.entity.StudentAnswer;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.submission.repository.StudentAnswerRepository;
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
public class SubmissionService {
    private final R2StorageService r2StorageService;
    private final AssignmentAttemptRepository attemptRepository;
    private final StudentAnswerRepository answerRepository;
    private final AssignmentQuestionRepository questionRepository;
    private final AssignmentRepository assignmentRepository;
    private final AnalyticsService analyticsService;
    private final EntityManager entityManager;

    // ==========================================
    // 1. BẮT ĐẦU VÀ NỘP BÀI THI
    // ==========================================
    @Transactional
    public AttemptResponse startAttempt(UUID studentId, UUID assignmentId) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài tập: " + assignmentId));

        List<AssignmentAttempt> previousAttempts = attemptRepository.findByStudentIdAndAssignmentId(studentId,
                assignmentId);

        // 1. NẾU ĐANG CÓ LẦN LÀM DỞ DANG (IN_PROGRESS) -> TRẢ VỀ TIẾP TỤC
        Optional<AssignmentAttempt> existingInProgress = previousAttempts.stream()
                .filter(att -> att.getStatus() == AttemptStatus.IN_PROGRESS)
                .findFirst();

        if (existingInProgress.isPresent()) {
            AssignmentAttempt current = existingInProgress.get();
            log.info("Học sinh {} tiếp tục làm bài dở: {}", studentId, current.getId());
            return mapToAttemptSummary(current);
        }

        // 2. KIỂM TRA GIỚI HẠN SỐ LẦN LÀM (maxAttempts)
        int maxAttempts = (assignment.getMaxAttempts() != null && assignment.getMaxAttempts() > 0)
                ? assignment.getMaxAttempts()
                : 1;

        long completedCount = previousAttempts.stream()
                .filter(att -> att.getStatus() != AttemptStatus.IN_PROGRESS)
                .count();

        if (completedCount >= maxAttempts) {
            throw new BadRequestException("Bạn đã dùng hết số lần làm bài cho phép (" + maxAttempts + " lần).");
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
        log.info("Khởi tạo lượt thi #{} cho học sinh {}", attempt.getAttemptNumber(), studentId);
        return mapToAttemptSummary(attempt);
    }

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
            StudentAnswer answer = new StudentAnswer();
            answer.setAttempt(attempt);

            AssignmentQuestion questionRef = new AssignmentQuestion();
            questionRef.setId(ansReq.getQuestionId());
            answer.setQuestion(questionRef);

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
                }
                answer.setIsCorrect(isCorrect);
                if (isCorrect) {
                    double point = question.getPoints() != null ? question.getPoints() : 1.0;
                    answer.setEarnedPoints(point);
                    totalScore += point;
                } else {
                    answer.setEarnedPoints(0.0);
                }
            }
            answerRepository.save(answer);
        }

        double finalScore = questions.isEmpty() ? 0 : (totalScore / questions.size()) * 10.0;
        Instant now = Instant.now();
        attempt.setSubmittedAt(now);
        attempt.setTotalScore(finalScore);
        attempt.setStatus(AttemptStatus.SUBMITTED);

        if (attempt.getStartedAt() != null) {
            attempt.setDurationSeconds((int) Duration.between(attempt.getStartedAt(), now).getSeconds());
        }

        attemptRepository.save(attempt);
        log.info("Student {} submitted attempt {} with score {}", studentId, attemptId, finalScore);

        String skillType = attempt.getAssignment().getSkillType().name();
        double skillBoost = finalScore * 0.05;
        analyticsService.updateSkillScore(studentId, skillType, skillBoost);

        return AttemptResponse.builder()
                .attemptId(attempt.getId())
                .assignmentId(attempt.getAssignment().getId())
                .status(attempt.getStatus().name())
                .score(finalScore)
                .startedAt(attempt.getStartedAt())
                .submittedAt(attempt.getSubmittedAt())
                .build();
    }

    // ==========================================
    // 2. NỘP FILE GHI ÂM (AUDIO RESPONSE)
    // ==========================================
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
                                    .isCorrect(isTeacher ? opt.getIsCorrect() : null)
                                    .build()).collect(Collectors.toList())
                            : Collections.emptyList();

                    return AttemptResponse.QuestionResultDetail.builder()
                            .id(q.getId())
                            .questionId(q.getId())
                            .studentAnswerId(ans != null ? ans.getId() : null)
                            .promptText(q.getPromptText())
                            .questionType(q.getQuestionType().name())
                            .maxPoints(q.getPoints())
                            .earnedPoints(earnedPoints)
                            .studentAnswer(ans != null ? ans.getTextResponse() : null)
                            .audioUrl(ans != null ? ans.getAudioResponseUrl() : null)
                            .mediaUrl(q.getMediaUrl())
                            .transcript(q.getTranscript())
                            .options(optionDetails)
                            .selectedOptionId(selectedOptId)
                            .correctAnswer(isTeacher ? q.getCorrectAnswer() : null)
                            .explanation(q.getExplanation())
                            .isCorrect(isCorrect)
                            .build();
                }).collect(Collectors.toList());

        AttemptResponse res = mapToAttemptSummary(attempt);
        res.setQuestions(questionDetails);
        return res;
    }

    public List<StudentAssignmentSummaryResponse> getStudentClassAssignments(UUID classId, UUID studentId) {
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

    public List<AttemptResponse> getStudentAttemptsHistory(UUID assignmentId, UUID studentId) {
        return attemptRepository.findByAssignmentIdAndStudentIdOrderByAttemptNumberDesc(assignmentId, studentId)
                .stream().map(this::mapToAttemptSummary).collect(Collectors.toList());
    }

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

    @Transactional
    public AttemptResponse gradeSubmission(UUID attemptId, TeacherGradeRequest request) {
        AssignmentAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Not found"));

        attempt.setTeacherFeedback(request.getFeedback());
        attempt.setTotalScore(request.getFinalScore());
        attempt.setStatus(AttemptStatus.COMPLETED);
        attemptRepository.save(attempt);

        String skillType = attempt.getAssignment().getSkillType().name();
        double skillBoost = request.getFinalScore() * 0.05;
        analyticsService.updateSkillScore(attempt.getStudent().getId(), skillType, skillBoost);

        return mapToAttemptSummary(attempt);
    }

    private AttemptResponse mapToAttemptSummary(AssignmentAttempt att) {
        return AttemptResponse.builder()
                .attemptId(att.getId())
                .assignmentId(att.getAssignment().getId())
                .assignmentTitle(att.getAssignment().getTitle())
                .attemptNumber(att.getAttemptNumber())
                .score(att.getTotalScore())
                .status(att.getStatus().name())
                .teacherFeedback(att.getTeacherFeedback())
                .startedAt(att.getStartedAt())
                .submittedAt(att.getSubmittedAt())
                .build();
    }
}