package com.englishlearning.analytics.controller;

import com.englishlearning.analytics.dto.TeacherDashboardResponse;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.common.dto.ApiResponse;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TeacherDashboardControllerTest {

    @Mock
    private EntityManager entityManager;
    @Mock
    private ClassroomRepository classroomRepository;
    @Mock
    private AssignmentRepository assignmentRepository;
    @Mock
    private ClassStudentRepository classStudentRepository;
    @Mock
    private AssignmentAttemptRepository assignmentAttemptRepository;

    @InjectMocks
    private TeacherDashboardController teacherDashboardController;

    private CustomUserDetails userDetails;
    private UUID teacherId;

    @BeforeEach
    void setUp() {
        teacherId = UUID.randomUUID();
        User user = User.builder().id(teacherId).email("teacher@example.com").password("secret").build();
        userDetails = new CustomUserDetails(user);
    }

    @Test
    @DisplayName("getStats tính toán chính xác completionRate từ số học sinh và bài tập thực tế")
    void getStats_calculatesRealCompletionRate() {
        // Mock các query tổng quan
        Query mockTotalClassesQuery = mock(Query.class);
        when(entityManager.createQuery(contains("COUNT(c) FROM Classroom c"))).thenReturn(mockTotalClassesQuery);
        when(mockTotalClassesQuery.setParameter(anyString(), any())).thenReturn(mockTotalClassesQuery);
        when(mockTotalClassesQuery.getSingleResult()).thenReturn(1L);

        Query mockTotalStudentsQuery = mock(Query.class);
        when(entityManager.createQuery(contains("COUNT(cs) FROM ClassStudent cs"))).thenReturn(mockTotalStudentsQuery);
        when(mockTotalStudentsQuery.setParameter(anyString(), any())).thenReturn(mockTotalStudentsQuery);
        when(mockTotalStudentsQuery.getSingleResult()).thenReturn(10L);

        Query mockPendingGradingQuery = mock(Query.class);
        when(entityManager.createQuery(contains("a.status = :status"))).thenReturn(mockPendingGradingQuery);
        when(mockPendingGradingQuery.setParameter(anyString(), any())).thenReturn(mockPendingGradingQuery);
        when(mockPendingGradingQuery.getSingleResult()).thenReturn(2L);

        jakarta.persistence.TypedQuery<Object[]> mockPendingAttemptsQuery = mock(jakarta.persistence.TypedQuery.class);
        when(entityManager.createQuery(contains("ORDER BY a.submittedAt ASC"), eq(Object[].class))).thenReturn(mockPendingAttemptsQuery);
        when(mockPendingAttemptsQuery.setParameter(anyString(), any())).thenReturn(mockPendingAttemptsQuery);
        when(mockPendingAttemptsQuery.setMaxResults(anyInt())).thenReturn(mockPendingAttemptsQuery);
        when(mockPendingAttemptsQuery.getResultList()).thenReturn(Collections.emptyList());

        Query mockSkillQuery = mock(Query.class);
        when(entityManager.createQuery(contains("AVG(p.listeningScore)"))).thenReturn(mockSkillQuery);
        when(mockSkillQuery.setParameter(anyString(), any())).thenReturn(mockSkillQuery);
        when(mockSkillQuery.getSingleResult()).thenReturn(new Object[]{8.0, 7.5, 6.0, 8.5});

        // Mock lớp học và tỷ lệ hoàn thành thực tế
        UUID classId = UUID.randomUUID();
        Classroom classroom = Classroom.builder().id(classId).name("IELTS 6.5").build();
        when(classroomRepository.findByTeacherId(teacherId)).thenReturn(List.of(classroom));

        // studentCount = 10, assignments = 2 -> totalExpected = 20
        when(classStudentRepository.countByClassroomIdAndIsActiveTrue(classId)).thenReturn(10L);
        Assignment a1 = Assignment.builder().id(UUID.randomUUID()).build();
        Assignment a2 = Assignment.builder().id(UUID.randomUUID()).build();
        when(assignmentRepository.findByClassroomId(classId)).thenReturn(List.of(a1, a2));

        // actualSubmittedCount = 18 -> rate = 18 / 20 * 100 = 90.0%
        when(assignmentAttemptRepository.countCompletedByClassroomId(classId)).thenReturn(18L);

        // Execute
        ResponseEntity<ApiResponse<TeacherDashboardResponse>> response = teacherDashboardController.getStats(userDetails);

        // Verify
        assertThat(response.getBody()).isNotNull();
        TeacherDashboardResponse data = response.getBody().getData();
        assertThat(data).isNotNull();
        assertThat(data.getTotalClasses()).isEqualTo(1L);
        assertThat(data.getTotalStudents()).isEqualTo(10L);
        assertThat(data.getPendingGrading()).isEqualTo(2L);
        assertThat(data.getAvgCompletionRate()).isEqualTo(90.0);
    }
}
