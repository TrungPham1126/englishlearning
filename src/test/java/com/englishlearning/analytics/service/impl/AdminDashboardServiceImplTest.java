package com.englishlearning.analytics.service.impl;

import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.analytics.dto.AdminDashboardStats;
import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.repository.VideoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminDashboardServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private TeacherRepository teacherRepository;
    @Mock
    private StudentRepository studentRepository;
    @Mock
    private ClassroomRepository classroomRepository;
    @Mock
    private LessonRepository lessonRepository;
    @Mock
    private VideoRepository videoRepository;
    @Mock
    private AssignmentRepository assignmentRepository;
    @Mock
    private AssignmentAttemptRepository assignmentAttemptRepository;
    @Mock
    private AiEvaluationRepository aiEvaluationRepository;
    @Mock
    private ClassStudentRepository classStudentRepository;
    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private AdminDashboardServiceImpl adminDashboardService;

    @Test
    @DisplayName("getDashboardStats tính toán chính xác averageSkillScores và completionDistribution")
    void getDashboardStats_success() {
        when(videoRepository.findByStatus(VideoStatus.PENDING_REVIEW)).thenReturn(Collections.emptyList());
        when(classroomRepository.countByStatus(any(ClassStatus.class))).thenReturn(5L);
        when(assignmentAttemptRepository.count()).thenReturn(100L);
        when(assignmentAttemptRepository.countByStatus(AttemptStatus.SUBMITTED)).thenReturn(10L);

        // Mock skill scores
        when(assignmentAttemptRepository.findAverageScoreBySkillType(SkillType.LISTENING)).thenReturn(8.0); // 80.0
        when(assignmentAttemptRepository.findAverageScoreBySkillType(SkillType.READING)).thenReturn(7.5);   // 75.0
        when(aiEvaluationRepository.findAverageScoreByEvalType(AiEvaluationType.SPEAKING)).thenReturn(8.5); // 85.0
        when(aiEvaluationRepository.findAverageScoreByEvalType(AiEvaluationType.WRITING)).thenReturn(9.0);  // 90.0

        // Mock completion distribution
        UUID student1 = UUID.randomUUID();
        TypedQuery<UUID> mockIdQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT DISTINCT cs.student.id"), eq(UUID.class))).thenReturn(mockIdQuery);
        when(mockIdQuery.getResultList()).thenReturn(List.of(student1));

        TypedQuery<Long> mockCountQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT COUNT(a) FROM Assignment a"), eq(Long.class))).thenReturn(mockCountQuery);
        when(mockCountQuery.setParameter(anyString(), any())).thenReturn(mockCountQuery);
        when(mockCountQuery.getSingleResult()).thenReturn(10L);

        when(assignmentAttemptRepository.countCompletedDistinctAssignmentsByStudentId(student1)).thenReturn(9L); // 90% -> high

        AdminDashboardStats stats = adminDashboardService.getDashboardStats();

        assertThat(stats).isNotNull();
        assertThat(stats.getAverageSkillScores()).isNotNull();
        assertThat(stats.getAverageSkillScores().get("Listening")).isEqualTo(80.0);
        assertThat(stats.getAverageSkillScores().get("Reading")).isEqualTo(75.0);
        assertThat(stats.getAverageSkillScores().get("Speaking")).isEqualTo(85.0);
        assertThat(stats.getAverageSkillScores().get("Writing")).isEqualTo(90.0);

        assertThat(stats.getCompletionDistribution()).isNotNull();
        assertThat(stats.getCompletionDistribution().getHigh()).isEqualTo(100.0);
        assertThat(stats.getCompletionDistribution().getMedium()).isEqualTo(0.0);
        assertThat(stats.getCompletionDistribution().getLow()).isEqualTo(0.0);
    }
}
