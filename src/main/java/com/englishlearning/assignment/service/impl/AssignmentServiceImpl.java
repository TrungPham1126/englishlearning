package com.englishlearning.assignment.service.impl;

import com.englishlearning.assignment.dto.AssignmentRequest;
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
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.Lesson;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AssignmentServiceImpl implements AssignmentService {

    private final AssignmentRepository assignmentRepository;
    private final ExerciseAudioService exerciseAudioService;

    @Override
    @Transactional
    public Assignment createAssignment(AssignmentRequest request) {
        log.info("Creating a new assignment: {}", request.getTitle());

        Assignment assignment = new Assignment();
        assignment.setTitle(request.getTitle());
        assignment.setDescription(request.getDescription());
        assignment.setSkillType(SkillType.valueOf(request.getSkillType().toUpperCase()));
        assignment.setTimeLimitMinutes(request.getTimeLimitMinutes());
        assignment.setDueDate(request.getDueDate());

        if (request.getMaxAttempts() != null) {
            assignment.setMaxAttempts(request.getMaxAttempts());
        }
        if (request.getPassScore() != null) {
            assignment.setPassScore(request.getPassScore());
        }
        assignment.setAudioUrl(request.getAudioUrl());
        assignment.setListeningScript(request.getListeningScript());

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
                question.setQuestionType(QuestionType.valueOf(qReq.getQuestionType().toUpperCase()));
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
        if (saved.getSkillType() == SkillType.SPEAKING || saved.getSkillType() == SkillType.LISTENING) {
            exerciseAudioService.generateAudiosForAssignmentAsync(saved.getId(), AudioGeneratedBy.TEACHER);
        }
        return saved;
    }

    @Override
    public Assignment getAssignmentById(UUID id) {
        return assignmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found with id: " + id));
    }

    @Override
    @Transactional
    public Assignment updateAssignment(UUID id, AssignmentRequest request) {
        Assignment assignment = getAssignmentById(id);
        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            assignment.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            assignment.setDescription(request.getDescription());
        }
        if (request.getSkillType() != null && !request.getSkillType().isBlank()) {
            assignment.setSkillType(SkillType.valueOf(request.getSkillType().toUpperCase()));
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
        if (request.getPassScore() != null) {
            assignment.setPassScore(request.getPassScore());
        }
        if (request.getAudioUrl() != null) {
            assignment.setAudioUrl(request.getAudioUrl());
        }
        if (request.getListeningScript() != null) {
            assignment.setListeningScript(request.getListeningScript());
        }

        if (request.getQuestions() != null && !request.getQuestions().isEmpty()) {
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
                    question.setQuestionType(QuestionType.valueOf(qReq.getQuestionType().toUpperCase()));
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
                        option.setIsCorrect(optReq.isCorrect());
                        question.getOptions().add(option);
                    }
                }
            }
        }

        Assignment saved = assignmentRepository.save(assignment);
        if (saved.getSkillType() == SkillType.SPEAKING || saved.getSkillType() == SkillType.LISTENING) {
            exerciseAudioService.generateAudiosForAssignmentAsync(saved.getId(), AudioGeneratedBy.TEACHER);
        }
        return saved;
    }

    @Override
    @Transactional
    public void deleteAssignment(UUID id) {
        Assignment assignment = getAssignmentById(id);
        assignmentRepository.delete(assignment);
    }

    @Override
    public List<Assignment> getAssignmentsByClassroom(UUID classroomId) {
        return assignmentRepository.findByClassroomId(classroomId);
    }

    @Override
    public void backfillAllAudios() {
        log.info("Bắt đầu backfill audio cho tất cả các bài tập Speaking & Listening đã tồn tại...");
        List<Assignment> all = assignmentRepository.findAll();
        int count = 0;
        for (Assignment a : all) {
            if (a.getSkillType() == SkillType.SPEAKING || a.getSkillType() == SkillType.LISTENING) {
                exerciseAudioService.generateAudiosForAssignmentAsync(a.getId(), AudioGeneratedBy.SYSTEM);
                count++;
            }
        }
        log.info("Đã kích hoạt backfill audio chạy ngầm cho {} bài tập.", count);
    }
}
