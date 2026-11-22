package com.englishlearning.curriculum.controller;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.ForbiddenException;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.service.DailyStudyPlanService;
import com.englishlearning.curriculum.service.UserStreakService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = DailyStudyPlanController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("DailyStudyPlanController - Lộ trình học hàng ngày & Ma trận tiến độ")
class DailyStudyPlanControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DailyStudyPlanService dailyStudyPlanService;

    @MockBean
    private UserStreakService userStreakService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID studentId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID teacherId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID classId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID planId = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private final UUID itemId = UUID.fromString("55555555-5555-5555-5555-555555555555");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User u = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@test.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("GET /student-overview - Trích studentId từ CustomUserDetails, 403 khi không thuộc lớp, 401 khi chưa đăng nhập")
    void getStudentOverview_allBranches() throws Exception {
        DailyHomeworkOverviewResponse overview = DailyHomeworkOverviewResponse.builder()
                .completionPercentage(50)
                .totalDays(2)
                .completedDays(1)
                .days(List.of(DaySummaryDto.builder().id(planId).dayNumber(1).title("DAY 1").build()))
                .currentSelectedDay(DayDetailDto.builder().id(planId).dayNumber(1).title("DAY 1").build())
                .build();

        when(dailyStudyPlanService.getStudentDailyOverview(classId, studentId, planId)).thenReturn(overview);

        mockMvc.perform(get("/api/v1/curriculum/daily-plans/classrooms/{classroomId}/student-overview", classId)
                        .param("selectedDayId", planId.toString())
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.completionPercentage").value(50))
                .andExpect(jsonPath("$.data.currentSelectedDay.dayNumber").value(1));

        // Principal không có getId() -> fallback studentId = null
        when(dailyStudyPlanService.getStudentDailyOverview(classId, null, null)).thenReturn(overview);
        mockMvc.perform(get("/api/v1/curriculum/daily-plans/classrooms/{classroomId}/student-overview", classId)
                        .with(user("plainTeacher").roles("TEACHER")))
                .andExpect(status().isOk());

        // Chưa thuộc lớp -> 403 ForbiddenException
        when(dailyStudyPlanService.getStudentDailyOverview(classId, studentId, null))
                .thenThrow(new ForbiddenException("Học viên không thuộc lớp học này"));
        mockMvc.perform(get("/api/v1/curriculum/daily-plans/classrooms/{classroomId}/student-overview", classId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        // Chưa đăng nhập -> 401 Unauthorized
        mockMvc.perform(get("/api/v1/curriculum/daily-plans/classrooms/{classroomId}/student-overview", classId))
                .andExpect(status().isUnauthorized());

        // GET /my-streak -> 200 cho học viên và 401 khi chưa đăng nhập
        StudentStreakResponse streakResponse = StudentStreakResponse.builder()
                .currentStreak(6)
                .lastActiveDate(LocalDate.of(2026, 11, 18))
                .hasHomeworkToday(false)
                .completedToday(false)
                .todayCompletedTasks(0)
                .todayTotalTasks(0)
                .build();
        when(userStreakService.getStreakSummary(studentId)).thenReturn(streakResponse);

        mockMvc.perform(get("/api/v1/curriculum/daily-plans/my-streak")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentStreak").value(6))
                .andExpect(jsonPath("$.data.hasHomeworkToday").value(false));

        mockMvc.perform(get("/api/v1/curriculum/daily-plans/my-streak"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST/PUT/DELETE/GET daily plans & items - Phân quyền TEACHER vs STUDENT và validate request")
    void teacherPlanAndItemManagement_allEndpoints() throws Exception {
        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(planId)
                .dayNumber(1)
                .title("DAY 1")
                .scheduledDate(LocalDate.of(2026, 11, 13))
                .isUnlocked(true)
                .build();
        when(dailyStudyPlanService.createDailyPlan(any(CreateDailyPlanRequest.class))).thenReturn(plan);
        when(dailyStudyPlanService.updateDailyPlan(eq(planId), any(UpdateDailyPlanRequest.class))).thenReturn(plan);
        when(dailyStudyPlanService.getPlansByClassroom(classId)).thenReturn(List.of(plan));

        String createJson = """
                {
                  "classroomId": "33333333-3333-3333-3333-333333333333",
                  "dayNumber": 1,
                  "scheduledDate": "2026-11-13",
                  "title": "DAY 1",
                  "estimatedMinutes": 30
                }
                """;

        mockMvc.perform(post("/api/v1/curriculum/daily-plans")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.dayNumber").value(1));

        // STUDENT không được tạo plan -> 403
        mockMvc.perform(post("/api/v1/curriculum/daily-plans")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson))
                .andExpect(status().isForbidden());

        // Validation 400
        mockMvc.perform(post("/api/v1/curriculum/daily-plans")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.classroomId").exists());

        mockMvc.perform(put("/api/v1/curriculum/daily-plans/{planId}", planId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "DAY 1 Edited" }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/curriculum/daily-plans/classrooms/{classroomId}", classId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(planId.toString()));

        when(dailyStudyPlanService.getAssignmentsByDailyPlan(planId))
                .thenReturn(List.of(Assignment.builder().id(UUID.randomUUID()).title("HW 1").build()));
        mockMvc.perform(get("/api/v1/curriculum/daily-plans/{planId}/assignments", planId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].title").value("HW 1"));

        DailyPlanItem savedItem = DailyPlanItem.builder()
                .id(itemId)
                .sectionName("CORE")
                .title("1. Vocab")
                .itemType("VOCABULARY")
                .orderIndex(1)
                .build();
        when(dailyStudyPlanService.addPlanItem(eq(planId), any(CreatePlanItemRequest.class))).thenReturn(savedItem);

        mockMvc.perform(post("/api/v1/curriculum/daily-plans/{planId}/items", planId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sectionName": "CORE",
                                  "title": "1. Vocab",
                                  "itemType": "VOCABULARY",
                                  "orderIndex": 1
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(itemId.toString()));

        doNothing().when(dailyStudyPlanService).deletePlanItem(itemId);
        mockMvc.perform(delete("/api/v1/curriculum/daily-plans/items/{itemId}", itemId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isOk());

        doNothing().when(dailyStudyPlanService).deleteDailyPlan(planId);
        mockMvc.perform(delete("/api/v1/curriculum/daily-plans/{planId}", planId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isOk());

        // Progress matrix: TEACHER OK, STUDENT 403
        DailyProgressStatResponse stat = DailyProgressStatResponse.builder()
                .studentId(studentId.toString())
                .studentName("Nguyen An")
                .overallRate(100)
                .days(List.of(DailyProgressStatResponse.DayStat.builder().dayNumber(1).rate(100).minutes(30).build()))
                .build();
        when(dailyStudyPlanService.getDailyProgressStatsMatrix(classId)).thenReturn(List.of(stat));

        mockMvc.perform(get("/api/v1/curriculum/daily-plans/classrooms/{classroomId}/progress-stats", classId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].overallRate").value(100));

        mockMvc.perform(get("/api/v1/curriculum/daily-plans/classrooms/{classroomId}/progress-stats", classId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("getMyStreak_whenNonCustomUserDetailsPrincipal_returnsEmptySummary200")
    void getMyStreak_whenNonCustomUserDetailsPrincipal_returnsEmptySummary200() throws Exception {
        mockMvc.perform(get("/api/v1/curriculum/daily-plans/my-streak")
                        .with(user("plain-user").roles("STUDENT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentStreak").value(0))
                .andExpect(jsonPath("$.data.hasHomeworkToday").value(false))
                .andExpect(jsonPath("$.data.completedToday").value(false))
                .andExpect(jsonPath("$.data.todayCompletedTasks").value(0))
                .andExpect(jsonPath("$.data.todayTotalTasks").value(0));

        verifyNoInteractions(userStreakService);
    }

    @Test
    @DisplayName("getMyStreak_whenTeacherAuthenticated_returns200")
    void getMyStreak_whenTeacherAuthenticated_returns200() throws Exception {
        StudentStreakResponse streakResponse = StudentStreakResponse.builder()
                .currentStreak(2)
                .hasHomeworkToday(true)
                .completedToday(true)
                .todayCompletedTasks(1)
                .todayTotalTasks(1)
                .build();
        when(userStreakService.getStreakSummary(teacherId)).thenReturn(streakResponse);

        mockMvc.perform(get("/api/v1/curriculum/daily-plans/my-streak")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentStreak").value(2))
                .andExpect(jsonPath("$.data.completedToday").value(true));

        verify(userStreakService).getStreakSummary(teacherId);
    }

    @Test
    @DisplayName("createDailyPlan_whenClassroomNotFound_returns404")
    void createDailyPlan_whenClassroomNotFound_returns404() throws Exception {
        when(dailyStudyPlanService.createDailyPlan(any(CreateDailyPlanRequest.class)))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy lớp học"));

        mockMvc.perform(post("/api/v1/curriculum/daily-plans")
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "classroomId": "33333333-3333-3333-3333-333333333333",
                                  "dayNumber": 1,
                                  "scheduledDate": "2026-11-13",
                                  "title": "DAY 1"
                                }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("updateDailyPlan_whenStudentRole_returns403")
    void updateDailyPlan_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(put("/api/v1/curriculum/daily-plans/{planId}", planId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "Attempt" }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(dailyStudyPlanService);
    }

    @Test
    @DisplayName("updateDailyPlan_whenPlanNotFound_returns404")
    void updateDailyPlan_whenPlanNotFound_returns404() throws Exception {
        when(dailyStudyPlanService.updateDailyPlan(eq(planId), any(UpdateDailyPlanRequest.class)))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy kế hoạch học tập"));

        mockMvc.perform(put("/api/v1/curriculum/daily-plans/{planId}", planId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "title": "Updated" }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("deleteDailyPlan_whenStudentRole_returns403")
    void deleteDailyPlan_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(delete("/api/v1/curriculum/daily-plans/{planId}", planId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(dailyStudyPlanService);
    }

    @Test
    @DisplayName("deleteDailyPlan_whenPlanNotFound_returns404")
    void deleteDailyPlan_whenPlanNotFound_returns404() throws Exception {
        doThrow(new ResourceNotFoundException("Không tìm thấy ngày học"))
                .when(dailyStudyPlanService).deleteDailyPlan(planId);

        mockMvc.perform(delete("/api/v1/curriculum/daily-plans/{planId}", planId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("addPlanItem_whenStudentRole_returns403")
    void addPlanItem_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/curriculum/daily-plans/{planId}/items", planId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sectionName": "CORE",
                                  "title": "1. Vocab",
                                  "itemType": "VOCABULARY",
                                  "orderIndex": 1
                                }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(dailyStudyPlanService);
    }

    @Test
    @DisplayName("addPlanItem_whenInvalidRequestMissingFields_returns400")
    void addPlanItem_whenInvalidRequestMissingFields_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/curriculum/daily-plans/{planId}/items", planId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.sectionName").exists())
                .andExpect(jsonPath("$.validationErrors.title").exists())
                .andExpect(jsonPath("$.validationErrors.itemType").exists())
                .andExpect(jsonPath("$.validationErrors.orderIndex").exists());

        verifyNoInteractions(dailyStudyPlanService);
    }

    @Test
    @DisplayName("addPlanItem_whenPlanNotFound_returns404")
    void addPlanItem_whenPlanNotFound_returns404() throws Exception {
        when(dailyStudyPlanService.addPlanItem(eq(planId), any(CreatePlanItemRequest.class)))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy ngày học"));

        mockMvc.perform(post("/api/v1/curriculum/daily-plans/{planId}/items", planId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sectionName": "CORE",
                                  "title": "1. Vocab",
                                  "itemType": "VOCABULARY",
                                  "orderIndex": 1
                                }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("deletePlanItem_whenStudentRole_returns403")
    void deletePlanItem_whenStudentRole_returns403() throws Exception {
        mockMvc.perform(delete("/api/v1/curriculum/daily-plans/items/{itemId}", itemId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT)))
                        .with(csrf()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(dailyStudyPlanService);
    }

    @Test
    @DisplayName("deletePlanItem_whenItemNotFound_returns404")
    void deletePlanItem_whenItemNotFound_returns404() throws Exception {
        doThrow(new ResourceNotFoundException("Không tìm thấy mục bài tập"))
                .when(dailyStudyPlanService).deletePlanItem(itemId);

        mockMvc.perform(delete("/api/v1/curriculum/daily-plans/items/{itemId}", itemId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER)))
                        .with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("getAssignmentsByDailyPlan_whenPlanNotFound_returns404")
    void getAssignmentsByDailyPlan_whenPlanNotFound_returns404() throws Exception {
        when(dailyStudyPlanService.getAssignmentsByDailyPlan(planId))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy ngày học"));

        mockMvc.perform(get("/api/v1/curriculum/daily-plans/{planId}/assignments", planId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isNotFound());
    }
}
