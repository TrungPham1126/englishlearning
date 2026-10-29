package com.englishlearning.submission.service.impl;

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
import com.englishlearning.submission.entity.StudentAnswer;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.submission.repository.StudentAnswerRepository;
import com.englishlearning.submission.service.CbtExerciseService;
import com.englishlearning.submission.service.GradingEngineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class CbtExerciseServiceImpl implements CbtExerciseService {

    public static final String AI_GRADING_QUEUE = "ai.grading.queue";

    private final AssignmentAttemptRepository attemptRepository;
    private final AssignmentQuestionRepository questionRepository;
    private final StudentAnswerRepository studentAnswerRepository;
    private final GradingEngineService gradingEngineService;
    private final UserStreakService userStreakService;
    private final RabbitTemplate rabbitTemplate;

    @Override
    @Transactional
    public AttemptResponse submitCbtExercise(UUID studentId, UUID attemptId, SubmissionRequest request, Instant submitTime) {
        AssignmentAttempt attempt = attemptRepository.findByIdAndStudentId(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lượt làm bài với ID: " + attemptId));

        if (attempt.getSubmittedAt() != null) {
            throw new BadRequestException("Bài thi này đã được nộp trước đó.");
        }

        Assignment assignment = attempt.getAssignment();
        Instant effectiveSubmitTime = submitTime != null ? submitTime : Instant.now();

        // 1. Kiểm tra giới hạn thời gian làm bài (Exam Time Limit)
        if (assignment != null && assignment.getTimeLimitMinutes() != null && attempt.getStartedAt() != null) {
            long durationMinutes = Duration.between(attempt.getStartedAt(), effectiveSubmitTime).toMinutes();
            if (durationMinutes > assignment.getTimeLimitMinutes()) {
                throw new BadRequestException("Thời gian làm bài thi đã vượt quá giới hạn quy định (" +
                        durationMinutes + " phút > " + assignment.getTimeLimitMinutes() + " phút).");
            }
        }

        // 2. Chấm điểm qua GradingEngineService
        List<AssignmentQuestion> questions = questionRepository.findByAssignmentId(request.getAssignmentId());
        GradingResult gradingResult = gradingEngineService.evaluateSubmission(questions, request.getAnswers());

        // 3. Cập nhật câu trả lời chi tiết của học sinh
        if (request.getAnswers() != null) {
            for (SubmissionRequest.AnswerDto ansDto : request.getAnswers()) {
                StudentAnswer answer = attempt.getAnswers().stream()
                        .filter(a -> a.getQuestion() != null && a.getQuestion().getId().equals(ansDto.getQuestionId()))
                        .findFirst()
                        .orElseGet(() -> {
                            StudentAnswer newAns = new StudentAnswer();
                            newAns.setAttempt(attempt);
                            AssignmentQuestion qRef = new AssignmentQuestion();
                            qRef.setId(ansDto.getQuestionId());
                            newAns.setQuestion(qRef);
                            attempt.getAnswers().add(newAns);
                            return newAns;
                        });

                if (ansDto.getTextAnswer() != null) {
                    answer.setTextResponse(ansDto.getTextAnswer());
                } else if (ansDto.getSelectedOptionId() != null) {
                    answer.setTextResponse(ansDto.getSelectedOptionId().toString());
                }

                Double earned = gradingResult.getEarnedPointsPerQuestion().get(ansDto.getQuestionId());
                Boolean isCorrect = gradingResult.getCorrectnessPerQuestion().get(ansDto.getQuestionId());
                answer.setEarnedPoints(earned != null ? earned : 0.0);
                answer.setIsCorrect(Boolean.TRUE.equals(isCorrect));
                studentAnswerRepository.save(answer);
            }
        }

        attempt.setSubmittedAt(effectiveSubmitTime);
        attempt.setTotalScore(gradingResult.getScaledScore());

        // 4. Nếu có câu hỏi cần AI chấm -> Đẩy vào RabbitMQ Queue và chuyển trạng thái SUBMITTED
        if (gradingResult.isRequiresAiGrading()) {
            attempt.setStatus(AttemptStatus.SUBMITTED);
            Map<String, Object> aiMessage = new HashMap<>();
            aiMessage.put("attemptId", attempt.getId().toString());
            aiMessage.put("studentId", studentId.toString());
            aiMessage.put("assignmentId", assignment != null ? assignment.getId().toString() : null);
            aiMessage.put("questionIds", gradingResult.getAiGradedQuestionIds());

            try {
                rabbitTemplate.convertAndSend(AI_GRADING_QUEUE, aiMessage);
                log.info("Đã gửi message vào hàng đợi chấm bài AI {}: {}", AI_GRADING_QUEUE, attemptId);
            } catch (Exception e) {
                log.error("Lỗi khi gửi message vào queue AI grading: {}", e.getMessage());
            }
        } else {
            // Đề thi khách quan hoàn toàn -> Đóng lượt làm bài và cập nhật streak
            attempt.setStatus(AttemptStatus.COMPLETED);
            LocalDate completionDate = effectiveSubmitTime.atZone(ZoneId.systemDefault()).toLocalDate();
            userStreakService.updateStreakOnPlanCompletion(studentId, completionDate);
        }

        attemptRepository.save(attempt);

        return AttemptResponse.builder()
                .attemptId(attempt.getId())
                .assignmentId(assignment != null ? assignment.getId() : null)
                .status(attempt.getStatus().name())
                .score(attempt.getTotalScore())
                .startedAt(attempt.getStartedAt())
                .submittedAt(attempt.getSubmittedAt())
                .build();
    }
}
