package com.englishlearning.assignment.service;

import com.englishlearning.assignment.dto.AssignmentRequest;
import com.englishlearning.assignment.dto.QuestionBankItemDto;
import com.englishlearning.assignment.entity.*;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.service.impl.AssignmentServiceImpl;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.service.NotificationService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AssignmentServiceImpl - Atomic Coverage for Assignment, Exam & Question Bank")
class AssignmentServiceImplTest {

    @Mock
    private AssignmentRepository assignmentRepository;
    @Mock
    private ExerciseAudioService exerciseAudioService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private AssignmentQuestionRepository assignmentQuestionRepository;
    @Mock
    private EntityManager entityManager;

    private AssignmentServiceImpl assignmentService;

    private UUID classroomId;
    private UUID lessonId;
    private UUID assignmentId;

    @BeforeEach
    void setUp() {
        assignmentService = new AssignmentServiceImpl(
                assignmentRepository,
                exerciseAudioService,
                notificationService,
                assignmentQuestionRepository
        );
        ReflectionTestUtils.setField(assignmentService, "entityManager", entityManager);
        classroomId = UUID.randomUUID();
        lessonId = UUID.randomUUID();
        assignmentId = UUID.randomUUID();
    }

    @Test
    @DisplayName("createAssignment: Tạo bài thi đa kỹ năng với toàn bộ 6 QuestionType, cấu hình phòng thi & trigger async audio")
    void createAssignment_examAllQuestionTypes_configuresExamNotifiesAndTriggersAudio() {
        AssignmentRequest.OptionRequest optA = new AssignmentRequest.OptionRequest();
        optA.setOptionText("Paris");
        optA.setCorrect(true);
        AssignmentRequest.OptionRequest optB = new AssignmentRequest.OptionRequest();
        optB.setOptionText("London");
        optB.setCorrect(false);

        AssignmentRequest.OptionRequest matchPair = new AssignmentRequest.OptionRequest();
        matchPair.setOptionText("Resilient");
        matchPair.setMatchText("Kiên cường");
        matchPair.setIsCorrect(true);

        AssignmentRequest.QuestionRequest qMcq = new AssignmentRequest.QuestionRequest();
        qMcq.setQuestionType("MULTIPLE_CHOICE");
        qMcq.setSkillType("READING");
        qMcq.setPromptText("Capital of France?");
        qMcq.setPoints(2.0);
        qMcq.setOptions(List.of(optA, optB));

        AssignmentRequest.QuestionRequest qTf = new AssignmentRequest.QuestionRequest();
        qTf.setQuestionType("TRUE_FALSE");
        qTf.setPromptText("The earth orbits the sun.");
        qTf.setCorrectAnswer("True");

        AssignmentRequest.QuestionRequest qFill = new AssignmentRequest.QuestionRequest();
        qFill.setQuestionType("FILL_IN_BLANK");
        qFill.setSkillType("GRAMMAR");
        qFill.setPromptText("She ___ here since 2015.");
        qFill.setCorrectAnswer("has lived");

        AssignmentRequest.QuestionRequest qMatch = new AssignmentRequest.QuestionRequest();
        qMatch.setQuestionType("MATCHING");
        qMatch.setSkillType("VOCABULARY");
        qMatch.setPromptText("Resilient");
        qMatch.setCorrectAnswer("Kiên cường");
        qMatch.setOptions(List.of(matchPair));

        AssignmentRequest.QuestionRequest qAudio = new AssignmentRequest.QuestionRequest();
        qAudio.setQuestionType("AUDIO_RESPONSE");
        qAudio.setSkillType("SPEAKING");
        qAudio.setPromptText("Read aloud carefully.");
        qAudio.setTranscript("Practice makes perfect.");

        AssignmentRequest.QuestionRequest qEssay = new AssignmentRequest.QuestionRequest();
        qEssay.setQuestionType("ESSAY");
        qEssay.setSkillType("WRITING");
        qEssay.setPromptText("Discuss remote work.");

        AssignmentRequest req = new AssignmentRequest();
        req.setTitle("Final Comprehensive Exam");
        req.setDescription("Covers all core skills");
        req.setClassroomId(classroomId);
        req.setLessonId(lessonId);
        req.setSkillType("reading");
        req.setTimeLimitMinutes(60);
        req.setDueDate(Instant.parse("2026-12-01T10:00:00Z"));
        req.setMaxAttempts(2);
        req.setPassScore(7.5);
        req.setMaxAllowedErrorPercent(25.0);
        req.setIsExam(true);
        req.setExamSkills(Arrays.asList("reading", " ", "WRITING", "READING", null, "listening"));
        req.setStrictFullscreen(null); // should default to isExam (true)
        req.setMaxViolations(0);       // should default to 3
        req.setQuestions(List.of(qMcq, qTf, qFill, qMatch, qAudio, qEssay));

        when(assignmentRepository.save(any(Assignment.class))).thenAnswer(inv -> {
            Assignment a = inv.getArgument(0);
            a.setId(assignmentId);
            return a;
        });

        Assignment saved = assignmentService.createAssignment(req);

        assertThat(saved.getId()).isEqualTo(assignmentId);
        assertThat(saved.getSkillType()).isEqualTo(SkillType.READING);
        assertThat(saved.getTimeLimitMinutes()).isEqualTo(60);
        assertThat(saved.getMaxAttempts()).isEqualTo(2);
        assertThat(saved.getMaxAllowedErrorPercent()).isEqualTo(25.0);
        assertThat(saved.getPassScore()).isEqualTo(7.5);
        assertThat(saved.getIsExam()).isTrue();
        assertThat(saved.getStrictFullscreen()).isTrue();
        assertThat(saved.getMaxViolations()).isEqualTo(3);
        assertThat(saved.getExamSkills()).isEqualTo("READING,WRITING,LISTENING");
        assertThat(saved.getLesson()).isNotNull();
        assertThat(saved.getLesson().getId()).isEqualTo(lessonId);

        assertThat(saved.getQuestions()).hasSize(6);
        assertThat(saved.getQuestions().get(0).getOrderIndex()).isEqualTo(1);
        assertThat(saved.getQuestions().get(0).getOptions().get(0).getOptionLabel()).isEqualTo("A");
        assertThat(saved.getQuestions().get(0).getOptions().get(1).getOptionLabel()).isEqualTo("B");
        assertThat(saved.getQuestions().get(1).getSkillType()).isEqualTo(SkillType.READING); // inherited
        assertThat(saved.getQuestions().get(3).getOptions().get(0).getMatchText()).isEqualTo("Kiên cường");
        assertThat(saved.getQuestions().get(4).getQuestionType()).isEqualTo(QuestionType.AUDIO_RESPONSE);
        assertThat(saved.getQuestions().get(5).getQuestionType()).isEqualTo(QuestionType.ESSAY);

        ArgumentCaptor<NotificationDto> notifCaptor = ArgumentCaptor.forClass(NotificationDto.class);
        verify(notificationService).dispatchNotification(notifCaptor.capture());
        assertThat(notifCaptor.getValue().getActionType()).isEqualTo("NEW_EXAM");
        assertThat(notifCaptor.getValue().getTargetUrl()).isEqualTo("/student/exams/" + assignmentId + "/take");

        verify(exerciseAudioService).generateAudiosForAssignmentAsync(assignmentId, AudioGeneratedBy.TEACHER);
    }

    @Test
    @DisplayName("createAssignment: passScore thang 10 & thang 100, maxAllowedErrorPercent không cần passScore, lỗi notification không làm fail")
    void createAssignment_scoreThresholdsAndNotificationResilience() {
        // Case 1: maxAllowedErrorPercent provided while passScore is null; plain READING MCQ -> no audio trigger
        AssignmentRequest req1 = new AssignmentRequest();
        req1.setTitle("Grammar Drill");
        req1.setClassroomId(classroomId);
        req1.setSkillType("GRAMMAR");
        req1.setMaxAllowedErrorPercent(30.0);
        req1.setExamSkills(List.of("   "));

        AssignmentRequest.QuestionRequest qDefaultType = new AssignmentRequest.QuestionRequest();
        qDefaultType.setPromptText("Choose correct verb");
        qDefaultType.setQuestionType("   "); // defaults to MULTIPLE_CHOICE
        req1.setQuestions(List.of(qDefaultType));

        when(assignmentRepository.save(any(Assignment.class))).thenAnswer(inv -> {
            Assignment a = inv.getArgument(0);
            a.setId(assignmentId);
            return a;
        });
        doThrow(new RuntimeException("FCM down")).when(notificationService).dispatchNotification(any());

        Assignment res1 = assignmentService.createAssignment(req1);

        assertThat(res1.getMaxAllowedErrorPercent()).isEqualTo(30.0);
        assertThat(res1.getPassScore()).isEqualTo(7.0);
        assertThat(res1.getExamSkills()).isNull();
        assertThat(res1.getQuestions().get(0).getQuestionType()).isEqualTo(QuestionType.MULTIPLE_CHOICE);
        verify(exerciseAudioService, never()).generateAudiosForAssignmentAsync(any(), any());

        // Case 2: passScore > 10 (percentage scale 85.0) & LISTENING triggers async audio
        AssignmentRequest req2 = new AssignmentRequest();
        req2.setTitle("Listening Practice");
        req2.setClassroomId(classroomId);
        req2.setSkillType("LISTENING");
        req2.setPassScore(85.0);
        req2.setMaxViolations(5);

        Assignment res2 = assignmentService.createAssignment(req2);

        assertThat(res2.getMaxAllowedErrorPercent()).isEqualTo(15.0);
        assertThat(res2.getMaxViolations()).isEqualTo(5);
        verify(exerciseAudioService).generateAudiosForAssignmentAsync(assignmentId, AudioGeneratedBy.TEACHER);
    }

    @Test
    @DisplayName("createAssignment: Ném BadRequestException khi skillType hoặc questionType không hợp lệ")
    void createAssignment_invalidEnums_throwBadRequest() {
        AssignmentRequest badSkillReq = new AssignmentRequest();
        badSkillReq.setTitle("Test");
        badSkillReq.setClassroomId(classroomId);
        badSkillReq.setSkillType("INVALID_SKILL");

        assertThatThrownBy(() -> assignmentService.createAssignment(badSkillReq))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid skillType");

        AssignmentRequest badQTypeReq = new AssignmentRequest();
        badQTypeReq.setTitle("Test");
        badQTypeReq.setClassroomId(classroomId);
        badQTypeReq.setSkillType("READING");
        AssignmentRequest.QuestionRequest qReq = new AssignmentRequest.QuestionRequest();
        qReq.setPromptText("Prompt");
        qReq.setQuestionType("UNKNOWN_QTYPE");
        badQTypeReq.setQuestions(List.of(qReq));

        assertThatThrownBy(() -> assignmentService.createAssignment(badQTypeReq))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid questionType");
    }

    @Test
    @DisplayName("getAssignmentById: Fallback findById + findByAssignmentId, sắp xếp orderIndex & ném 404 khi không tồn tại")
    void getAssignmentById_fallbacksAndNotFound() {
        Assignment a = Assignment.builder().id(assignmentId).questions(new ArrayList<>()).build();
        AssignmentQuestion q2 = AssignmentQuestion.builder().id(UUID.randomUUID()).orderIndex(2).options(List.of()).build();
        AssignmentQuestion q1 = AssignmentQuestion.builder().id(UUID.randomUUID()).orderIndex(1).options(null).build();

        when(assignmentRepository.findByIdWithQuestions(assignmentId)).thenReturn(Optional.empty());
        when(assignmentRepository.findById(assignmentId)).thenReturn(Optional.of(a));
        when(assignmentQuestionRepository.findByAssignmentId(assignmentId)).thenReturn(new ArrayList<>(List.of(q2, q1)));

        Assignment found = assignmentService.getAssignmentById(assignmentId);
        assertThat(found.getQuestions()).containsExactly(q1, q2);

        UUID missingId = UUID.randomUUID();
        when(assignmentRepository.findByIdWithQuestions(missingId)).thenReturn(Optional.empty());
        when(assignmentRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> assignmentService.getAssignmentById(missingId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("updateAssignment: Cập nhật cấu hình, merge câu hỏi (cập nhật, thêm mới, xóa dư) & xử lý lỗi enum")
    void updateAssignment_updatesFieldsMergesQuestionsAndValidates() {
        AssignmentQuestion qOld1 = AssignmentQuestion.builder()
                .id(UUID.randomUUID()).orderIndex(1).questionType(QuestionType.MULTIPLE_CHOICE)
                .options(new ArrayList<>(List.of(QuestionOption.builder().optionText("Old").build()))).build();
        AssignmentQuestion qOld2 = AssignmentQuestion.builder()
                .id(UUID.randomUUID()).orderIndex(2).questionType(QuestionType.FILL_IN_BLANK).build();
        AssignmentQuestion qOld3 = AssignmentQuestion.builder()
                .id(UUID.randomUUID()).orderIndex(3).questionType(QuestionType.ESSAY).build();

        Assignment existing = Assignment.builder()
                .id(assignmentId)
                .title("Old Title")
                .skillType(SkillType.GRAMMAR)
                .questions(new ArrayList<>(List.of(qOld1, qOld2, qOld3)))
                .build();

        when(assignmentRepository.findByIdWithQuestions(assignmentId)).thenReturn(Optional.of(existing));
        when(assignmentRepository.save(any(Assignment.class))).thenAnswer(inv -> inv.getArgument(0));

        // Shrink 3 -> 2 questions, update q1 & q2
        AssignmentRequest.OptionRequest newOpt = new AssignmentRequest.OptionRequest();
        newOpt.setOptionText("Updated opt");
        newOpt.setIsCorrect(true);

        AssignmentRequest.QuestionRequest in1 = new AssignmentRequest.QuestionRequest();
        in1.setPromptText("Updated Q1");
        in1.setQuestionType("MULTIPLE_CHOICE");
        in1.setPoints(3.0);
        in1.setOptions(List.of(newOpt));

        AssignmentRequest.QuestionRequest in2 = new AssignmentRequest.QuestionRequest();
        in2.setPromptText("Updated Q2");
        in2.setQuestionType("SPEAKING".equals("SPEAKING") ? "AUDIO_RESPONSE" : "ESSAY");
        in2.setSkillType("SPEAKING");
        in2.setMediaUrl("/audio/q2.wav");
        in2.setTranscript("Speak clearly");

        AssignmentRequest req = new AssignmentRequest();
        req.setTitle("New Title");
        req.setDescription("New Desc");
        req.setSkillType("SPEAKING");
        req.setTimeLimitMinutes(20);
        req.setMaxAttempts(5);
        req.setPassScore(6.0);
        req.setAudioUrl("/audio/main.wav");
        req.setListeningScript("Script");
        req.setIsExam(true);
        req.setExamSkills(List.of("SPEAKING"));
        req.setStrictFullscreen(true);
        req.setMaxViolations(4);
        req.setQuestions(List.of(in1, in2));

        Assignment updated = assignmentService.updateAssignment(assignmentId, req);

        assertThat(updated.getTitle()).isEqualTo("New Title");
        assertThat(updated.getSkillType()).isEqualTo(SkillType.SPEAKING);
        assertThat(updated.getMaxAllowedErrorPercent()).isEqualTo(40.0);
        assertThat(updated.getMaxViolations()).isEqualTo(4);
        assertThat(updated.getQuestions()).hasSize(2);
        assertThat(updated.getQuestions().get(0).getOptions()).hasSize(1);
        assertThat(updated.getQuestions().get(0).getOptions().get(0).getOptionText()).isEqualTo("Updated opt");
        verify(exerciseAudioService).generateAudiosForAssignmentAsync(assignmentId, AudioGeneratedBy.TEACHER);

        // Grow when incoming > existing + handle existingQuestions = null
        existing.setQuestions(null);
        AssignmentRequest growReq = new AssignmentRequest();
        AssignmentRequest.QuestionRequest in3 = new AssignmentRequest.QuestionRequest();
        in3.setPromptText("Added Q");
        in3.setQuestionType("ESSAY");
        growReq.setQuestions(List.of(in3));

        Assignment grown = assignmentService.updateAssignment(assignmentId, growReq);
        assertThat(grown.getQuestions()).hasSize(1);
    }

    @Test
    @DisplayName("deleteAssignment: Dọn sạch DailyPlanItem, ExerciseAudio, StudentAnswer, AssignmentAttempt trước khi xóa")
    void deleteAssignment_cleansDependentEntitiesAndResilientToHqlErrors() {
        Assignment existing = Assignment.builder().id(assignmentId).questions(new ArrayList<>()).build();
        when(assignmentRepository.findByIdWithQuestions(assignmentId)).thenReturn(Optional.of(existing));

        Query mockQuery = mock(Query.class);
        when(entityManager.createQuery(anyString())).thenReturn(mockQuery);
        when(mockQuery.setParameter(eq("aid"), eq(assignmentId))).thenReturn(mockQuery);
        when(mockQuery.executeUpdate()).thenReturn(1);

        assignmentService.deleteAssignment(assignmentId);

        verify(entityManager, times(4)).createQuery(anyString());
        verify(mockQuery, times(4)).executeUpdate();
        verify(assignmentRepository).delete(existing);

        // Resilience when HQL cleanup throws
        reset(entityManager, assignmentRepository);
        when(assignmentRepository.findByIdWithQuestions(assignmentId)).thenReturn(Optional.of(existing));
        when(entityManager.createQuery(anyString())).thenThrow(new RuntimeException("HQL error"));

        assignmentService.deleteAssignment(assignmentId);
        verify(assignmentRepository).delete(existing);
    }

    @Test
    @DisplayName("getAssignmentsByClassroom, getExamsByClassroom, getClassroomQuestionBank, backfillAllAudios")
    void queriesQuestionBankAndBackfill_workCorrectly() {
        AssignmentQuestion q1 = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .skillType(SkillType.GRAMMAR)
                .promptText("  Choose tense  ")
                .correctAnswer("had gone")
                .points(1.0)
                .options(List.of(QuestionOption.builder().optionText("had gone").matchText(null).isCorrect(true).build()))
                .build();
        AssignmentQuestion q1Dup = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .promptText("choose tense")
                .build();
        AssignmentQuestion q2 = AssignmentQuestion.builder()
                .id(UUID.randomUUID())
                .questionType(QuestionType.MATCHING)
                .promptText("Resilient")
                .correctAnswer("Kiên cường")
                .options(null)
                .build();

        Assignment exam = Assignment.builder()
                .id(UUID.randomUUID())
                .title("Midterm")
                .isExam(true)
                .skillType(SkillType.SPEAKING)
                .questions(List.of(q1))
                .build();
        Assignment practice = Assignment.builder()
                .id(UUID.randomUUID())
                .title("Drill")
                .isExam(false)
                .skillType(SkillType.VOCABULARY)
                .questions(List.of(q1Dup, q2))
                .build();
        Assignment emptyAss = Assignment.builder()
                .id(UUID.randomUUID())
                .title("No Qs")
                .skillType(SkillType.LISTENING)
                .questions(null)
                .build();

        when(assignmentRepository.findByClassroomId(classroomId)).thenReturn(List.of(exam, practice, emptyAss));

        assertThat(assignmentService.getAssignmentsByClassroom(classroomId)).hasSize(3);
        List<Assignment> exams = assignmentService.getExamsByClassroom(classroomId);
        assertThat(exams).containsExactly(exam);

        List<QuestionBankItemDto> bank = assignmentService.getClassroomQuestionBank(classroomId);
        assertThat(bank).hasSize(2);
        assertThat(bank.get(0).getSkillType()).isEqualTo("GRAMMAR");
        assertThat(bank.get(0).getOptions()).hasSize(1);
        assertThat(bank.get(1).getSkillType()).isEqualTo("VOCABULARY"); // inherited from practice
        assertThat(bank.get(1).getOptions()).isEmpty();

        when(assignmentRepository.findAll()).thenReturn(List.of(exam, practice, emptyAss));
        assignmentService.backfillAllAudios();
        verify(exerciseAudioService).generateAudiosForAssignmentAsync(exam.getId(), AudioGeneratedBy.SYSTEM);
        verify(exerciseAudioService).generateAudiosForAssignmentAsync(emptyAss.getId(), AudioGeneratedBy.SYSTEM);
        verify(exerciseAudioService, never()).generateAudiosForAssignmentAsync(practice.getId(), AudioGeneratedBy.SYSTEM);
    }
}
