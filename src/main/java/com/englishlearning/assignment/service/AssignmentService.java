package com.englishlearning.assignment.service;

import com.englishlearning.assignment.dto.AssignmentRequest;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionOption;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.assignment.repository.AssignmentRepository;
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
public class AssignmentService {

    private final AssignmentRepository assignmentRepository;

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
        return assignmentRepository.save(assignment);
    }

    public Assignment getAssignmentById(UUID id) {
        return assignmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found with id: " + id));
    }

    @Transactional
    public Assignment updateAssignment(UUID id, AssignmentRequest request) {
        Assignment assignment = getAssignmentById(id);
        assignment.setTitle(request.getTitle());
        assignment.setDescription(request.getDescription());
        assignment.setTimeLimitMinutes(request.getTimeLimitMinutes());
        assignment.setDueDate(request.getDueDate());
        if (request.getMaxAttempts() != null)
            assignment.setMaxAttempts(request.getMaxAttempts());
        if (request.getPassScore() != null)
            assignment.setPassScore(request.getPassScore());
        return assignmentRepository.save(assignment);
    }

    @Transactional
    public void deleteAssignment(UUID id) {
        Assignment assignment = getAssignmentById(id);
        assignmentRepository.delete(assignment);
    }

    public List<Assignment> getAssignmentsByClassroom(UUID classroomId) {
        return assignmentRepository.findByClassroomId(classroomId);
    }
}