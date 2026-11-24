package com.englishlearning.assignment.service.impl;



import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import com.englishlearning.assignment.dto.AssignmentRequest;

import com.englishlearning.assignment.dto.QuestionBankItemDto;

import com.englishlearning.assignment.entity.Assignment;

import com.englishlearning.assignment.entity.AssignmentQuestion;

import com.englishlearning.assignment.entity.AudioGeneratedBy;

import com.englishlearning.assignment.entity.QuestionOption;

import com.englishlearning.assignment.entity.QuestionType;

import com.englishlearning.assignment.entity.SkillType;

import com.englishlearning.assignment.repository.AssignmentRepository;

import com.englishlearning.assignment.service.AssignmentService;

import com.englishlearning.assignment.service.ExerciseAudioService;

import com.englishlearning.classroom.entity.Classroom;

import com.englishlearning.common.exception.BadRequestException;

import com.englishlearning.common.exception.ResourceNotFoundException;

import com.englishlearning.common.util.ScoreScaleUtils;

import com.englishlearning.curriculum.entity.Lesson;

import com.englishlearning.notification.dto.NotificationDto;

import com.englishlearning.notification.service.NotificationService;

import lombok.RequiredArgsConstructor;

import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.transaction.support.TransactionSynchronization;

import org.springframework.transaction.support.TransactionSynchronizationManager;



import java.util.ArrayList;

import java.util.List;

import java.util.UUID;

import java.util.concurrent.CompletableFuture;



@Service

@RequiredArgsConstructor

@Slf4j

public class AssignmentServiceImpl implements AssignmentService {



    private final AssignmentRepository assignmentRepository;

    private final ExerciseAudioService exerciseAudioService;

    private final NotificationService notificationService;
    private final com.englishlearning.assignment.repository.AssignmentQuestionRepository assignmentQuestionRepository;

    @PersistenceContext
    private EntityManager entityManager;



    @Override

    @Transactional

    public Assignment createAssignment(AssignmentRequest request) {
        if (request == null) {
            throw new BadRequestException("Assignment request must not be null");
        }
        if (request.getTimeLimitMinutes() != null && request.getTimeLimitMinutes() <= 0) {
            throw new BadRequestException("Thời gian làm bài phải lớn hơn 0");
        }
        if (request.getMaxAttempts() != null && request.getMaxAttempts() <= 0) {
            throw new BadRequestException("Số lượt làm bài tối đa phải lớn hơn 0");
        }
        if (request.getMaxAllowedErrorPercent() != null
                && (request.getMaxAllowedErrorPercent() < 0 || request.getMaxAllowedErrorPercent() > 100)) {
            throw new BadRequestException("Tỷ lệ sai tối đa phải trong khoảng 0 đến 100");
        }

        log.info("Creating a new assignment: {}", request.getTitle());



        Assignment assignment = new Assignment();

        assignment.setTitle(request.getTitle());

        assignment.setDescription(request.getDescription());

        try {

            assignment.setSkillType(SkillType.valueOf(request.getSkillType().trim().toUpperCase()));

        } catch (IllegalArgumentException | NullPointerException ex) {

            throw new BadRequestException("Invalid skillType: " + request.getSkillType());

        }

        assignment.setTimeLimitMinutes(request.getTimeLimitMinutes());

        assignment.setDueDate(request.getDueDate());



        if (request.getMaxAttempts() != null) {

            assignment.setMaxAttempts(request.getMaxAttempts());

        }

        if (request.getMaxAllowedErrorPercent() != null) {

            assignment.setMaxAllowedErrorPercent(request.getMaxAllowedErrorPercent());

            assignment.setPassScore(ScoreScaleUtils.clampScale10((100.0 - request.getMaxAllowedErrorPercent()) / 10.0));

        } else if (request.getPassScore() != null) {

            assignment.setPassScore(ScoreScaleUtils.normalizeToScale10(request.getPassScore()));

            double score100 = ScoreScaleUtils.normalizeToScale100(request.getPassScore());

            assignment.setMaxAllowedErrorPercent(Math.max(0.0, 100.0 - score100));

        }

        assignment.setAudioUrl(request.getAudioUrl());

        assignment.setListeningScript(request.getListeningScript());

        boolean isExam = Boolean.TRUE.equals(request.getIsExam());

        assignment.setIsExam(isExam);

        if (request.getExamSkills() != null && !request.getExamSkills().isEmpty()) {

            String joinedSkills = request.getExamSkills().stream()

                    .filter(s -> s != null && !s.isBlank())

                    .map(s -> s.trim().toUpperCase())

                    .distinct()

                    .collect(java.util.stream.Collectors.joining(","));

            assignment.setExamSkills(joinedSkills.isBlank() ? null : joinedSkills);

        }

        assignment.setStrictFullscreen(request.getStrictFullscreen() != null ? request.getStrictFullscreen() : isExam);

        assignment.setMaxViolations(request.getMaxViolations() != null && request.getMaxViolations() > 0

                ? request.getMaxViolations() : 3);



        // Set Classroom reference

        Classroom classroom = new Classroom();

        classroom.setId(request.getClassroomId());

        assignment.setClassroom(classroom);



        // Set Lesson reference (if provided)

        if (request.getLessonId() != null) {

            Lesson lesson = new Lesson();

            lesson.setId(request.getLessonId());

            assignment.setLesson(lesson);

        }



        List<AssignmentQuestion> questions = new ArrayList<>();

        if (request.getQuestions() != null && !request.getQuestions().isEmpty()) {

            int orderIndex = 1;

            for (AssignmentRequest.QuestionRequest qReq : request.getQuestions()) {

                AssignmentQuestion question = new AssignmentQuestion();

                question.setAssignment(assignment);

                question.setOrderIndex(orderIndex++);

                try {

                    String qTypeStr = (qReq.getQuestionType() != null && !qReq.getQuestionType().isBlank())

                            ? qReq.getQuestionType().trim().toUpperCase()

                            : "MULTIPLE_CHOICE";

                    question.setQuestionType(QuestionType.valueOf(qTypeStr));

                } catch (IllegalArgumentException ex) {

                    throw new BadRequestException("Invalid questionType: " + qReq.getQuestionType());

                }

                if (qReq.getSkillType() != null && !qReq.getSkillType().isBlank()) {

                    try {

                        question.setSkillType(SkillType.valueOf(qReq.getSkillType().trim().toUpperCase()));

                    } catch (IllegalArgumentException ex) {

                        throw new BadRequestException("Invalid question skillType: " + qReq.getSkillType());

                    }

                } else {

                    question.setSkillType(assignment.getSkillType());

                }

                question.setPromptText(qReq.getPromptText());

                question.setMediaUrl(qReq.getMediaUrl());

                question.setTranscript(qReq.getTranscript());

                question.setCorrectAnswer(qReq.getCorrectAnswer());

                question.setExplanation(qReq.getExplanation());



                if (qReq.getPoints() != null) {

                    question.setPoints(qReq.getPoints());

                }



                List<QuestionOption> options = new ArrayList<>();

                if (qReq.getOptions() != null) {

                    char label = 'A'; // Khởi tạo nhãn bắt đầu từ 'A'

                    for (AssignmentRequest.OptionRequest optReq : qReq.getOptions()) {

                        QuestionOption option = new QuestionOption();

                        option.setQuestion(question);

                        option.setOptionLabel(String.valueOf(label++)); // Tự động tăng A -> B -> C -> D

                        option.setOptionText(optReq.getOptionText());

                        option.setMatchText(optReq.getMatchText());

                        option.setIsCorrect(optReq.isCorrect());

                        options.add(option);

                    }

                }

                question.setOptions(options);

                questions.add(question);

            }

        }

        assignment.setQuestions(questions);



        // Save cascade Assignment -> Questions -> Options

        Assignment saved = assignmentRepository.save(assignment);

        final UUID savedId = saved.getId();
        final boolean needAsyncAudio = requiresAsyncAudioGeneration(saved);

        if (request.getClassroomId() != null) {
            boolean createdExam = Boolean.TRUE.equals(saved.getIsExam());
            NotificationDto notifDto = NotificationDto.builder()
                    .classroomId(request.getClassroomId())
                    .title((createdExam ? "Bài thi mới: " : "Bài tập mới: ") + saved.getTitle())
                    .message(createdExam
                            ? "Giáo viên đã giao bài thi mới \"" + saved.getTitle() + "\" (yêu cầu chế độ toàn màn hình). Hãy chuẩn bị kỹ trước khi làm bài!"
                            : "Giáo viên đã giao bài tập mới \"" + saved.getTitle() + "\". Hãy hoàn thành trước hạn nộp!")
                    .notificationType("NEW_ASSIGNMENT")
                    .actionType(createdExam ? "NEW_EXAM" : "NEW_ASSIGNMENT")
                    .referenceId(savedId != null ? savedId.toString() : null)
                    .targetUrl((createdExam ? "/student/exams/" : "/student/assignments/") + savedId + "/take")
                    .build();

            runAfterCommitOrImmediately(() -> {
                try {
                    notificationService.dispatchNotification(notifDto);
                } catch (Exception ex) {
                    log.warn("Không thể gửi thông báo giao bài tập mới: {}", ex.getMessage());
                }
            }, true);
        }

        if (needAsyncAudio) {
            runAfterCommitOrImmediately(() -> {
                try {
                    exerciseAudioService.generateAudiosForAssignmentAsync(savedId, AudioGeneratedBy.TEACHER);
                } catch (Exception ex) {
                    log.warn("Không thể kích hoạt sinh audio chạy ngầm cho bài tập {}: {}", savedId, ex.getMessage());
                }
            }, false);
        }

        return saved;

    }



    @Override
    @Transactional(readOnly = true)
    public Assignment getAssignmentById(UUID id) {
        Assignment assignment = assignmentRepository.findByIdWithQuestions(id)
                .orElseGet(() -> assignmentRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Assignment not found with id: " + id)));

        if (assignment.getQuestions() == null || assignment.getQuestions().isEmpty()) {
            List<com.englishlearning.assignment.entity.AssignmentQuestion> directQuestions =
                    assignmentQuestionRepository.findByAssignmentId(id);
            if (directQuestions != null && !directQuestions.isEmpty()) {
                assignment.setQuestions(directQuestions);
            }
        }

        if (assignment.getQuestions() != null) {
            try {
                assignment.getQuestions().sort(java.util.Comparator.comparing(q -> q.getOrderIndex() != null ? q.getOrderIndex() : 0));
            } catch (UnsupportedOperationException ex) {
                List<AssignmentQuestion> sorted = new ArrayList<>(assignment.getQuestions());
                sorted.sort(java.util.Comparator.comparing(q -> q.getOrderIndex() != null ? q.getOrderIndex() : 0));
                assignment.setQuestions(sorted);
            }
            for (com.englishlearning.assignment.entity.AssignmentQuestion q : assignment.getQuestions()) {
                sortQuestionOptions(q);
            }
        }
        return assignment;
    }

    private void sortQuestionOptions(AssignmentQuestion q) {
        if (q == null || q.getOptions() == null) {
            return;
        }
        try {
            q.getOptions().sort(QuestionOption.DISPLAY_ORDER_COMPARATOR);
        } catch (UnsupportedOperationException ex) {
            List<QuestionOption> sorted = new ArrayList<>(q.getOptions());
            sorted.sort(QuestionOption.DISPLAY_ORDER_COMPARATOR);
            q.setOptions(sorted);
        }
    }



    @Override

    @Transactional

    public Assignment updateAssignment(UUID id, AssignmentRequest request) {
        if (request == null) {
            throw new BadRequestException("Assignment request must not be null");
        }
        if (request.getTimeLimitMinutes() != null && request.getTimeLimitMinutes() <= 0) {
            throw new BadRequestException("Thời gian làm bài phải lớn hơn 0");
        }
        if (request.getMaxAttempts() != null && request.getMaxAttempts() <= 0) {
            throw new BadRequestException("Số lượt làm bài tối đa phải lớn hơn 0");
        }
        if (request.getMaxAllowedErrorPercent() != null
                && (request.getMaxAllowedErrorPercent() < 0 || request.getMaxAllowedErrorPercent() > 100)) {
            throw new BadRequestException("Tỷ lệ sai tối đa phải trong khoảng 0 đến 100");
        }

        Assignment assignment = getAssignmentById(id);

        if (request.getTitle() != null && !request.getTitle().isBlank()) {

            assignment.setTitle(request.getTitle());

        }

        if (request.getDescription() != null) {

            assignment.setDescription(request.getDescription());

        }

        if (request.getSkillType() != null && !request.getSkillType().isBlank()) {

            try {

                assignment.setSkillType(SkillType.valueOf(request.getSkillType().trim().toUpperCase()));

            } catch (IllegalArgumentException ex) {

                throw new BadRequestException("Invalid skillType: " + request.getSkillType());

            }

        }

        if (request.getTimeLimitMinutes() != null) {

            assignment.setTimeLimitMinutes(request.getTimeLimitMinutes());

        }

        if (request.getDueDate() != null) {

            assignment.setDueDate(request.getDueDate());

        }

        if (request.getMaxAttempts() != null) {

            assignment.setMaxAttempts(request.getMaxAttempts());

        }

        if (request.getMaxAllowedErrorPercent() != null) {

            assignment.setMaxAllowedErrorPercent(request.getMaxAllowedErrorPercent());

            assignment.setPassScore(ScoreScaleUtils.clampScale10((100.0 - request.getMaxAllowedErrorPercent()) / 10.0));

        } else if (request.getPassScore() != null) {

            assignment.setPassScore(ScoreScaleUtils.normalizeToScale10(request.getPassScore()));

            double score100 = ScoreScaleUtils.normalizeToScale100(request.getPassScore());

            assignment.setMaxAllowedErrorPercent(Math.max(0.0, 100.0 - score100));

        }

        if (request.getAudioUrl() != null) {

            assignment.setAudioUrl(request.getAudioUrl());

        }

        if (request.getListeningScript() != null) {

            assignment.setListeningScript(request.getListeningScript());

        }

        if (request.getIsExam() != null) {

            assignment.setIsExam(request.getIsExam());

        }

        if (request.getExamSkills() != null) {

            String joinedSkills = request.getExamSkills().stream()

                    .filter(s -> s != null && !s.isBlank())

                    .map(s -> s.trim().toUpperCase())

                    .distinct()

                    .collect(java.util.stream.Collectors.joining(","));

            assignment.setExamSkills(joinedSkills.isBlank() ? null : joinedSkills);

        }

        if (request.getStrictFullscreen() != null) {

            assignment.setStrictFullscreen(request.getStrictFullscreen());

        }

        if (request.getMaxViolations() != null && request.getMaxViolations() > 0) {

            assignment.setMaxViolations(request.getMaxViolations());

        }



        if (request.getQuestions() != null && !request.getQuestions().isEmpty()) {

            if (assignment.getQuestions() == null) {

                assignment.setQuestions(new ArrayList<>());

            }

            List<AssignmentQuestion> existingQuestions = assignment.getQuestions();

            List<AssignmentRequest.QuestionRequest> incoming = request.getQuestions();

            int orderIndex = 1;



            for (int i = 0; i < incoming.size(); i++) {

                AssignmentRequest.QuestionRequest qReq = incoming.get(i);

                AssignmentQuestion question;

                if (existingQuestions != null && i < existingQuestions.size()) {

                    question = existingQuestions.get(i);

                    if (question.getOptions() != null) {

                        question.getOptions().clear();

                    } else {

                        question.setOptions(new ArrayList<>());

                    }

                } else {

                    question = new AssignmentQuestion();

                    question.setAssignment(assignment);

                    question.setOptions(new ArrayList<>());

                    if (existingQuestions != null) {

                        existingQuestions.add(question);

                    }

                }



                question.setOrderIndex(orderIndex++);

                if (qReq.getQuestionType() != null && !qReq.getQuestionType().isBlank()) {
                    try {
                        question.setQuestionType(QuestionType.valueOf(qReq.getQuestionType().trim().toUpperCase()));
                    } catch (IllegalArgumentException ex) {
                        throw new BadRequestException("Invalid questionType: " + qReq.getQuestionType());
                    }
                }

                if (qReq.getSkillType() != null && !qReq.getSkillType().isBlank()) {
                    try {
                        question.setSkillType(SkillType.valueOf(qReq.getSkillType().trim().toUpperCase()));
                    } catch (IllegalArgumentException ex) {
                        throw new BadRequestException("Invalid question skillType: " + qReq.getSkillType());
                    }
                }

                question.setPromptText(qReq.getPromptText());

                if (qReq.getMediaUrl() != null) {

                    question.setMediaUrl(qReq.getMediaUrl());

                }

                if (qReq.getTranscript() != null) {

                    question.setTranscript(qReq.getTranscript());

                }

                question.setCorrectAnswer(qReq.getCorrectAnswer());

                question.setExplanation(qReq.getExplanation());

                if (qReq.getPoints() != null) {

                    question.setPoints(qReq.getPoints());

                }



                if (qReq.getOptions() != null) {

                    char label = 'A';

                    for (AssignmentRequest.OptionRequest optReq : qReq.getOptions()) {

                        QuestionOption option = new QuestionOption();

                        option.setQuestion(question);

                        option.setOptionLabel(String.valueOf(label++));

                        option.setOptionText(optReq.getOptionText());

                        option.setMatchText(optReq.getMatchText());

                        option.setIsCorrect(optReq.isCorrect());

                        question.getOptions().add(option);

                    }

                }

            }

            if (existingQuestions != null && existingQuestions.size() > incoming.size()) {

                existingQuestions.subList(incoming.size(), existingQuestions.size()).clear();

            }

        }



        Assignment saved = assignmentRepository.save(assignment);

        if (requiresAsyncAudioGeneration(saved)) {
            final UUID savedId = saved.getId();
            runAfterCommitOrImmediately(() -> {
                try {
                    exerciseAudioService.generateAudiosForAssignmentAsync(savedId, AudioGeneratedBy.TEACHER);
                } catch (Exception ex) {
                    log.warn("Không thể kích hoạt sinh audio chạy ngầm sau khi cập nhật bài tập {}: {}", savedId, ex.getMessage());
                }
            }, false);
        }

        return saved;

    }



        @Override
    @Transactional
    public void deleteAssignment(UUID id) {
        Assignment assignment = getAssignmentById(id);

        try {
            entityManager.createQuery("DELETE FROM DailyPlanItem dpi WHERE dpi.assignment.id = :aid")
                    .setParameter("aid", id)
                    .executeUpdate();
        } catch (Exception e) {
            log.warn("Lỗi khi dọn dẹp DailyPlanItem liên kết: {}", e.getMessage());
        }

        try {
            entityManager.createQuery("DELETE FROM ExerciseAudio ea WHERE ea.assignmentId = :aid")
                    .setParameter("aid", id)
                    .executeUpdate();
        } catch (Exception e) {
            log.warn("Lỗi khi dọn dẹp ExerciseAudio: {}", e.getMessage());
        }

        try {
            entityManager.createQuery("DELETE FROM StudentAnswer sa WHERE sa.attempt.id IN (SELECT att.id FROM AssignmentAttempt att WHERE att.assignment.id = :aid)")
                    .setParameter("aid", id)
                    .executeUpdate();

            entityManager.createQuery("DELETE FROM AssignmentAttempt att WHERE att.assignment.id = :aid")
                    .setParameter("aid", id)
                    .executeUpdate();
        } catch (Exception e) {
            log.warn("Lỗi khi dọn dẹp AssignmentAttempt / StudentAnswer: {}", e.getMessage());
        }

        assignmentRepository.delete(assignment);
        log.info("Xóa thành công bài tập ID: {}", id);
    }

    private void runAfterCommitOrImmediately(Runnable action, boolean detachToBackgroundThread) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    if (detachToBackgroundThread) {
                        CompletableFuture.runAsync(action);
                    } else {
                        action.run();
                    }
                }
            });
        } else {
            action.run();
        }
    }



    private boolean requiresAsyncAudioGeneration(Assignment assignment) {
        if (assignment == null) {
            return false;
        }
        if (assignment.getSkillType() == SkillType.LISTENING) {
            return true;
        }
        if (assignment.getSkillType() == SkillType.SPEAKING) {
            // Chỉ sinh audio mẫu cho bài Shadowing; Speaking Q&A / Part 2 / Part 3 không dùng audio mẫu
            return !ExerciseAudioService.isNonShadowingSpeakingAssignment(assignment);
        }
        return assignment.getQuestions() != null && assignment.getQuestions().stream().anyMatch(q ->
                q.getSkillType() == SkillType.LISTENING
                        || ((q.getQuestionType() == QuestionType.AUDIO_RESPONSE || q.getSkillType() == SkillType.SPEAKING)
                        && !ExerciseAudioService.isNonShadowingSpeakingQuestion(assignment, q)));
    }

    @Override

    public List<Assignment> getAssignmentsByClassroom(UUID classroomId) {

        return assignmentRepository.findByClassroomId(classroomId);

    }

    @Override

    @Transactional(readOnly = true)

    public List<Assignment> getExamsByClassroom(UUID classroomId) {

        List<Assignment> classroomAssignments = assignmentRepository.findByClassroomId(classroomId);
        if (classroomAssignments == null) {
            return java.util.Collections.emptyList();
        }

        List<Assignment> exams = classroomAssignments.stream()

                .filter(a -> a != null && Boolean.TRUE.equals(a.getIsExam()))

                .collect(java.util.stream.Collectors.toList());

        for (Assignment exam : exams) {

            if (exam.getQuestions() != null) {

                exam.getQuestions().size();

                exam.getQuestions().forEach(this::sortQuestionOptions);

            }

        }

        return exams;

    }

    @Override

    @Transactional(readOnly = true)

    public List<QuestionBankItemDto> getClassroomQuestionBank(UUID classroomId) {

        List<Assignment> classroomAssignments = assignmentRepository.findByClassroomId(classroomId);
        if (classroomAssignments == null) {
            return java.util.Collections.emptyList();
        }

        List<QuestionBankItemDto> items = new ArrayList<>();

        java.util.Set<String> seenKeys = new java.util.HashSet<>();

        for (Assignment a : classroomAssignments) {
            if (a == null) continue;

            List<AssignmentQuestion> qs = a.getQuestions();

            if (qs == null) continue;

            for (AssignmentQuestion q : qs) {

                String key = (q.getQuestionType() != null ? q.getQuestionType().name() : "") + "::"

                        + (q.getPromptText() != null ? q.getPromptText().trim().toLowerCase() : "");

                if (!seenKeys.add(key)) {

                    continue;

                }

                List<QuestionBankItemDto.OptionDto> optDtos = q.getOptions() == null

                        ? java.util.Collections.emptyList()

                        : q.getOptions().stream()

                                .sorted(QuestionOption.DISPLAY_ORDER_COMPARATOR)

                                .map(opt -> QuestionBankItemDto.OptionDto.builder()

                                        .optionText(opt.getOptionText())

                                        .matchText(opt.getMatchText())

                                        .isCorrect(opt.getIsCorrect())

                                        .build())

                                .collect(java.util.stream.Collectors.toList());

                String effectiveSkill = q.getSkillType() != null

                        ? q.getSkillType().name()

                        : (a.getSkillType() != null ? a.getSkillType().name() : "GRAMMAR");

                items.add(QuestionBankItemDto.builder()

                        .id(q.getId())

                        .assignmentId(a.getId())

                        .assignmentTitle(a.getTitle())

                        .skillType(effectiveSkill)

                        .questionType(q.getQuestionType() != null ? q.getQuestionType().name() : "MULTIPLE_CHOICE")

                        .promptText(q.getPromptText())

                        .mediaUrl(q.getMediaUrl())

                        .transcript(q.getTranscript())

                        .correctAnswer(q.getCorrectAnswer())

                        .explanation(q.getExplanation())

                        .points(q.getPoints())

                        .options(optDtos)

                        .build());

            }

        }

        return items;

    }



    @Override
    public void backfillAllAudios() {
        log.info("Bắt đầu backfill audio cho tất cả các bài tập Shadowing & Listening đã tồn tại...");
        List<Assignment> all = assignmentRepository.findAll();
        if (all == null) {
            return;
        }
        int count = 0;
        for (Assignment a : all) {
            if (requiresAsyncAudioGeneration(a)) {
                exerciseAudioService.generateAudiosForAssignmentAsync(a.getId(), AudioGeneratedBy.SYSTEM);
                count++;
            }
        }
        log.info("Đã kích hoạt backfill audio chạy ngầm cho {} bài tập.", count);
    }

}

