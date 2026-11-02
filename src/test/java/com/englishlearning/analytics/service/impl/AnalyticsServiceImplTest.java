package com.englishlearning.analytics.service.impl;

import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.repository.StudentSkillProfileRepository;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.curriculum.repository.StudentVocabularyProgressRepository;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceImplTest {

    @Mock
    private StudentSkillProfileRepository profileRepository;

    @Mock
    private AssignmentAttemptRepository assignmentAttemptRepository;

    @Mock
    private AiEvaluationRepository aiEvaluationRepository;

    @Mock
    private StudentVocabularyProgressRepository studentVocabularyProgressRepository;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private AnalyticsServiceImpl analyticsService;

    private UUID studentId;
    private StudentSkillProfile profile;

    @BeforeEach
    void setUp() {
        studentId = UUID.randomUUID();
        profile = StudentSkillProfile.builder()
                .id(studentId)
                .listeningScore(0.0)
                .speakingScore(0.0)
                .readingScore(0.0)
                .writingScore(0.0)
                .grammarScore(0.0)
                .vocabularyScore(0.0)
                .pronunciationScore(0.0)
                .fluencyScore(0.0)
                .build();
    }

    @Test
    @DisplayName("getMyProfile tính toán chính xác điểm kỹ năng từ lịch sử làm bài thật (thang 0-100)")
    void getMyProfile_calculatesRealScores() {
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(profile));
        when(profileRepository.save(any(StudentSkillProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // 1. Mock AssignmentAttempt (thang 10: 8.5 -> 85.0%, 7.0 -> 70.0%)
        Assignment listeningAssignment = Assignment.builder().skillType(SkillType.LISTENING).build();
        AssignmentAttempt listeningAttempt = AssignmentAttempt.builder()
                .assignment(listeningAssignment)
                .totalScore(8.5)
                .status(AttemptStatus.COMPLETED)
                .build();

        Assignment readingAssignment = Assignment.builder().skillType(SkillType.READING).build();
        AssignmentAttempt readingAttempt = AssignmentAttempt.builder()
                .assignment(readingAssignment)
                .totalScore(7.0)
                .status(AttemptStatus.COMPLETED)
                .build();

        when(assignmentAttemptRepository.findCompletedAttemptsByStudentId(studentId))
                .thenReturn(List.of(listeningAttempt, readingAttempt));

        // 2. Mock AiEvaluation (thang 10: pronunciation=8.0 -> 80.0, fluency=7.5 -> 75.0, overallScore=8.2 -> 82.0)
        AiEvaluation aiEvalSpeaking = AiEvaluation.builder()
                .evalType(AiEvaluationType.SPEAKING)
                .pronunciationScore(8.0)
                .fluencyScore(7.5)
                .overallScore(8.2)
                .build();

        when(aiEvaluationRepository.findByStudentId(studentId))
                .thenReturn(List.of(aiEvalSpeaking));

        // 3. Mock StudentVocabularyProgress: 10 từ, 8 từ đã thuộc (mastered) -> 80%
        when(studentVocabularyProgressRepository.countByStudentId(studentId)).thenReturn(10L);
        when(studentVocabularyProgressRepository.countMasteredByStudentId(studentId)).thenReturn(8L);

        // Execute
        StudentSkillProfile result = analyticsService.getMyProfile(studentId);

        // Verify
        assertThat(result).isNotNull();
        assertThat(result.getListeningScore()).isEqualTo(85.0);
        assertThat(result.getReadingScore()).isEqualTo(70.0);
        assertThat(result.getPronunciationScore()).isEqualTo(80.0);
        assertThat(result.getFluencyScore()).isEqualTo(75.0);
        assertThat(result.getSpeakingScore()).isEqualTo(82.0);
        assertThat(result.getVocabularyScore()).isEqualTo(80.0);
        assertThat(result.getAiRecommendedPath()).isNotBlank();
    }
}
