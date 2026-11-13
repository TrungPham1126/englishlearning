package com.englishlearning.system.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.system.AuditLog;
import com.englishlearning.system.repository.AuditLogRepository;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AuditLogController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AuditLogController - Kiểm thử truy vấn lịch sử hệ thống & phân quyền ADMIN")
class AuditLogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuditLogRepository auditLogRepository;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(invocation -> {
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("GET /api/v1/admin/audit-logs: ADMIN nhận danh sách phân trang sắp xếp createdAt DESC và fallback 'System'")
    void getAuditLogs_asAdmin_returns200PagedDtos() throws Exception {
        UUID adminId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        User admin = User.builder().id(adminId).email("admin@elp.edu.vn").build();

        AuditLog userLog = AuditLog.builder()
                .id(UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"))
                .user(admin)
                .action("CREATE")
                .entityName("Course")
                .entityId("course-1")
                .ipAddress("127.0.0.1")
                .metadataJson("{\"method\":\"createCourse\"}")
                .createdAt(Instant.parse("2026-05-01T10:00:00Z"))
                .build();

        AuditLog systemLog = AuditLog.builder()
                .id(UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc"))
                .user(null)
                .action("CLEANUP")
                .entityName("RefreshToken")
                .ipAddress("Unknown")
                .createdAt(Instant.parse("2026-05-01T09:00:00Z"))
                .build();

        when(auditLogRepository.findAll(any(Pageable.class)))
                .thenAnswer(inv -> {
                    Pageable p = inv.getArgument(0);
                    return new PageImpl<>(List.of(userLog, systemLog), p, 2);
                });

        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Tải lịch sử hệ thống thành công"))
                .andExpect(jsonPath("$.data.pageNumber").value(0))
                .andExpect(jsonPath("$.data.pageSize").value(20))
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.content[0].userId").value(adminId.toString()))
                .andExpect(jsonPath("$.data.content[0].userName").value("admin@elp.edu.vn"))
                .andExpect(jsonPath("$.data.content[0].action").value("CREATE"))
                .andExpect(jsonPath("$.data.content[1].userId").isEmpty())
                .andExpect(jsonPath("$.data.content[1].userName").value("System"));

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(auditLogRepository).findAll(pageableCaptor.capture());
        Pageable captured = pageableCaptor.getValue();
        assertThat(captured.getSort().getOrderFor("createdAt").getDirection()).isEqualTo(Sort.Direction.DESC);
    }

    @Test
    @WithMockUser(roles = {"TEACHER"})
    @DisplayName("GET /api/v1/admin/audit-logs: TEACHER không có quyền ADMIN -> Trả về 403 Forbidden")
    void getAuditLogs_asTeacher_returns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        verifyNoInteractions(auditLogRepository);
    }

    @Test
    @WithMockUser(roles = {"STUDENT"})
    @DisplayName("GET /api/v1/admin/audit-logs: STUDENT -> Trả về 403 Forbidden")
    void getAuditLogs_asStudent_returns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("GET /api/v1/admin/audit-logs: Chưa đăng nhập -> Trả về 401 Unauthorized")
    void getAuditLogs_unauthenticated_returns401Unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit-logs"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }
}
