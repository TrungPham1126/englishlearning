package com.englishlearning.analytics.controller;

import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = TeacherDashboardController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("TeacherDashboardController WebMvc - RBAC & Null-Safety trên Pending Tasks")
class TeacherDashboardWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private EntityManager entityManager;

    @MockBean
    private ClassroomRepository classroomRepository;

    @MockBean
    private AssignmentRepository assignmentRepository;

    @MockBean
    private ClassStudentRepository classStudentRepository;

    @MockBean
    private AssignmentAttemptRepository assignmentAttemptRepository;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID teacherId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID studentId = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User user = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@englishlearning.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(user);
    }

    @Test
    @DisplayName("TEACHER/ADMIN truy cập /stats thành công kể cả khi row pendingAttempts chứa null; STUDENT bị 403")
    @SuppressWarnings("unchecked")
    void getStats_enforcesRbacAndHandlesNullablePendingRows() throws Exception {
        Query countClassesQ = mock(Query.class);
        when(entityManager.createQuery(contains("COUNT(c)"))).thenReturn(countClassesQ);
        when(countClassesQ.setParameter(anyString(), any())).thenReturn(countClassesQ);
        when(countClassesQ.getSingleResult()).thenReturn(2L);

        Query countStudentsQ = mock(Query.class);
        when(entityManager.createQuery(contains("COUNT(cs)"))).thenReturn(countStudentsQ);
        when(countStudentsQ.setParameter(anyString(), any())).thenReturn(countStudentsQ);
        when(countStudentsQ.getSingleResult()).thenReturn(15L);

        Query countPendingQ = mock(Query.class);
        when(entityManager.createQuery(contains("COUNT(a)"))).thenReturn(countPendingQ);
        when(countPendingQ.setParameter(anyString(), any())).thenReturn(countPendingQ);
        when(countPendingQ.getSingleResult()).thenReturn(1L);

        TypedQuery<Object[]> pendingAttemptsQ = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("ORDER BY a.submittedAt ASC"), eq(Object[].class))).thenReturn(pendingAttemptsQ);
        when(pendingAttemptsQ.setParameter(anyString(), any())).thenReturn(pendingAttemptsQ);
        when(pendingAttemptsQ.setMaxResults(anyInt())).thenReturn(pendingAttemptsQ);
        when(pendingAttemptsQ.getResultList()).thenReturn(Collections.singletonList(new Object[]{UUID.randomUUID(), null, null, null}));

        Query skillQ = mock(Query.class);
        when(entityManager.createQuery(contains("AVG(p.listeningScore)"))).thenReturn(skillQ);
        when(skillQ.setParameter(anyString(), any())).thenReturn(skillQ);
        when(skillQ.getSingleResult()).thenReturn(new Object[]{8.5, 7.0, 5.5, 4.0});

        when(classroomRepository.findByTeacherId(teacherId)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/v1/teacher/dashboard/stats"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/teacher/dashboard/stats")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/teacher/dashboard/stats")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalClasses").value(2))
                .andExpect(jsonPath("$.data.tasks[0].title").value("Chấm bài: Bài tập"))
                .andExpect(jsonPath("$.data.tasks[0].className").value("Lớp học"))
                .andExpect(jsonPath("$.data.skills.length()").value(4));
    }
}
