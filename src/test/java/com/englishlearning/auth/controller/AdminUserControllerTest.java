package com.englishlearning.auth.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.dto.UserCreateByAdminRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.dto.UserUpdateRequest;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.service.AdminUserService;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.ResourceNotFoundException;
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
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminUserController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AdminUserController - Kiểm thử CRUD quản trị User & phân quyền @PreAuthorize ADMIN")
class AdminUserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminUserService adminUserService;

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
    @DisplayName("GET /api/v1/admin/users: ADMIN lọc theo role + keyword + sort asc -> Trả về 200 PageResponse")
    void getAllUsers_asAdminWithFiltersAndAscSort_returns200() throws Exception {
        UUID userId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        UserSummaryDto userDto = UserSummaryDto.builder()
                .id(userId)
                .email("alice@elp.edu.vn")
                .firstName("Alice")
                .lastName("Tran")
                .isActive(true)
                .roles(List.of("ROLE_STUDENT"))
                .build();

        PageResponse<UserSummaryDto> page = PageResponse.<UserSummaryDto>builder()
                .content(List.of(userDto))
                .pageNumber(1)
                .pageSize(5)
                .totalElements(6)
                .totalPages(2)
                .last(true)
                .build();

        when(adminUserService.getAllUsers(eq(RoleName.ROLE_STUDENT), eq("alice"), any(Pageable.class)))
                .thenReturn(page);

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("role", "ROLE_STUDENT")
                        .param("keyword", "alice")
                        .param("page", "1")
                        .param("size", "5")
                        .param("sortBy", "email")
                        .param("direction", "asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.content[0].email").value("alice@elp.edu.vn"))
                .andExpect(jsonPath("$.data.totalElements").value(6));

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(adminUserService).getAllUsers(eq(RoleName.ROLE_STUDENT), eq("alice"), pageableCaptor.capture());
        Pageable captured = pageableCaptor.getValue();
        assertThat(captured.getPageNumber()).isEqualTo(1);
        assertThat(captured.getPageSize()).isEqualTo(5);
        assertThat(captured.getSort().getOrderFor("email").getDirection()).isEqualTo(Sort.Direction.ASC);
    }

    @Test
    @WithMockUser(roles = {"STUDENT"})
    @DisplayName("GET /api/v1/admin/users: STUDENT gọi API quản trị -> Trả về 403 Forbidden")
    void getAllUsers_asStudent_returns403Forbidden() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        verifyNoInteractions(adminUserService);
    }

    @Test
    @DisplayName("GET /api/v1/admin/users: Chưa đăng nhập -> Trả về 401 Unauthorized")
    void getAllUsers_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("GET /api/v1/admin/users/{id}: Tìm thấy user -> Trả về 200 OK")
    void getUserById_asAdmin_returns200() throws Exception {
        UUID id = UUID.fromString("44444444-4444-4444-4444-444444444444");
        UserSummaryDto summary = UserSummaryDto.builder()
                .id(id)
                .email("teacher@elp.edu.vn")
                .roles(List.of("ROLE_TEACHER"))
                .build();
        when(adminUserService.getUserById(id)).thenReturn(summary);

        mockMvc.perform(get("/api/v1/admin/users/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.email").value("teacher@elp.edu.vn"));
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("GET /api/v1/admin/users/{id}: Không tìm thấy -> GlobalExceptionHandler trả về 404 Not Found")
    void getUserById_whenNotFound_returns404() throws Exception {
        UUID missingId = UUID.fromString("55555555-5555-5555-5555-555555555555");
        when(adminUserService.getUserById(missingId))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy người dùng: " + missingId));

        mockMvc.perform(get("/api/v1/admin/users/{id}", missingId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("POST /api/v1/admin/users: ADMIN tạo user hợp lệ -> Trả về 201 Created")
    void createUser_asAdminWithValidBody_returns201Created() throws Exception {
        UserSummaryDto created = UserSummaryDto.builder()
                .id(UUID.fromString("66666666-6666-6666-6666-666666666666"))
                .email("newteacher@elp.edu.vn")
                .firstName("Quynh")
                .lastName("Anh")
                .roles(List.of("ROLE_TEACHER"))
                .isActive(true)
                .build();
        when(adminUserService.createUser(any(UserCreateByAdminRequest.class))).thenReturn(created);

        String validCreateJson = """
                {
                  "email": "newteacher@elp.edu.vn",
                  "password": "Password123!",
                  "firstName": "Quynh",
                  "lastName": "Anh",
                  "phone": "0912345678",
                  "roles": ["ROLE_TEACHER"]
                }
                """;

        mockMvc.perform(post("/api/v1/admin/users")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validCreateJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Tạo tài khoản thành công"))
                .andExpect(jsonPath("$.data.email").value("newteacher@elp.edu.vn"));
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("POST /api/v1/admin/users: Request thiếu password ngắn + roles rỗng -> Trả về 400 Validation failed")
    void createUser_whenInvalidPayload_returns400ValidationErrors() throws Exception {
        String invalidCreateJson = """
                {
                  "email": "bad-email",
                  "password": "123",
                  "firstName": "",
                  "lastName": "",
                  "roles": []
                }
                """;

        mockMvc.perform(post("/api/v1/admin/users")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidCreateJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.validationErrors.email").exists())
                .andExpect(jsonPath("$.validationErrors.password").exists())
                .andExpect(jsonPath("$.validationErrors.roles").exists());
    }

    @Test
    @WithMockUser(roles = {"TEACHER"})
    @DisplayName("POST /api/v1/admin/users: TEACHER gọi API tạo tài khoản -> Trả về 403 Forbidden")
    void createUser_asTeacher_returns403Forbidden() throws Exception {
        String validJson = """
                {
                  "email": "s@elp.edu.vn",
                  "password": "Password123!",
                  "firstName": "A",
                  "lastName": "B",
                  "roles": ["ROLE_STUDENT"]
                }
                """;

        mockMvc.perform(post("/api/v1/admin/users")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validJson))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("PUT /api/v1/admin/users/{id}: Cập nhật user thành công -> Trả về 200 OK")
    void updateUser_asAdminWithValidBody_returns200() throws Exception {
        UUID id = UUID.fromString("77777777-7777-7777-7777-777777777777");
        UserSummaryDto updated = UserSummaryDto.builder()
                .id(id)
                .email("u@elp.edu.vn")
                .firstName("Huy")
                .lastName("Hoang")
                .isActive(true)
                .roles(List.of("ROLE_TEACHER"))
                .build();
        when(adminUserService.updateUser(eq(id), any(UserUpdateRequest.class))).thenReturn(updated);

        String updateJson = """
                {
                  "firstName": "Huy",
                  "lastName": "Hoang",
                  "phone": "0988777666",
                  "isActive": true,
                  "roles": ["ROLE_TEACHER"]
                }
                """;

        mockMvc.perform(put("/api/v1/admin/users/{id}", id)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Cập nhật thành công"))
                .andExpect(jsonPath("$.data.firstName").value("Huy"));
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("PATCH /api/v1/admin/users/{id}/status: Khóa và mở khóa tài khoản trả về message tương ứng")
    void toggleStatus_asAdmin_locksAndUnlocksAccount() throws Exception {
        UUID id = UUID.fromString("88888888-8888-8888-8888-888888888888");

        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", id)
                        .param("active", "false")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã khóa tài khoản"));

        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", id)
                        .param("active", "true")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Đã kích hoạt tài khoản"));

        verify(adminUserService).toggleUserStatus(id, false);
        verify(adminUserService).toggleUserStatus(id, true);
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("PATCH /api/v1/admin/users/{id}/status: Tự khóa chính mình -> Trả về 400 Bad Request")
    void toggleStatus_whenAdminLocksSelf_returns400() throws Exception {
        UUID adminId = UUID.fromString("99999999-9999-9999-9999-999999999999");
        doThrow(new BadRequestException("Không thể tự khóa tài khoản của chính mình"))
                .when(adminUserService).toggleUserStatus(adminId, false);

        mockMvc.perform(patch("/api/v1/admin/users/{id}/status", adminId)
                        .param("active", "false")
                        .with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Không thể tự khóa tài khoản của chính mình"));
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    @DisplayName("DELETE /api/v1/admin/users/{id}: Xóa user thành công -> Trả về 200 OK")
    void deleteUser_asAdmin_returns200() throws Exception {
        UUID id = UUID.fromString("aaaaaaaa-1111-2222-3333-444444444444");

        mockMvc.perform(delete("/api/v1/admin/users/{id}", id)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Xóa tài khoản thành công"));

        verify(adminUserService).deleteUser(id);
    }
}
