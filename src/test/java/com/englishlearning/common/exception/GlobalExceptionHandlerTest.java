package com.englishlearning.common.exception;

import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.service.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = GlobalExceptionHandlerTest.TestExceptionController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({GlobalExceptionHandlerTest.TestExceptionController.class, GlobalExceptionHandler.class})
@DisplayName("GlobalExceptionHandler - Kiểm thử ánh xạ Exception sang HTTP status & JSON ErrorResponse")
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @RestController
    @RequestMapping("/test/exceptions")
    static class TestExceptionController {

        @GetMapping("/not-found")
        public void notFound() {
            throw new ResourceNotFoundException("Không tìm thấy bản ghi");
        }

        @GetMapping("/bad-request")
        public void badRequest() {
            throw new BadRequestException("Yêu cầu không hợp lệ");
        }

        @GetMapping("/invalid-file")
        public void invalidFile() {
            throw new InvalidFileFormatException("Chỉ chấp nhận file Excel (.xlsx, .xls)");
        }

        @GetMapping("/unauthorized")
        public void unauthorized() {
            throw new UnauthorizedException("Token không hợp lệ");
        }

        @GetMapping("/bad-credentials")
        public void badCredentials() {
            throw new BadCredentialsException("Raw internal details");
        }

        @GetMapping("/disabled")
        public void disabled() {
            throw new DisabledException("Tài khoản đã bị khóa");
        }

        @GetMapping("/no-resource")
        public void noResource() throws NoResourceFoundException {
            throw new NoResourceFoundException(HttpMethod.GET, "uploads/videos/missing.mp4");
        }

        @GetMapping("/forbidden")
        public void forbidden() {
            throw new ForbiddenException("Bị cấm truy cập");
        }

        @GetMapping("/access-denied")
        public void accessDenied() {
            throw new AccessDeniedException("Role insufficient");
        }

        @GetMapping("/max-upload")
        public void maxUpload() {
            throw new MaxUploadSizeExceededException(524288000L);
        }

        @GetMapping("/quota-exceeded")
        public void quotaExceeded() {
            throw new QuotaExceededException("Đã vượt hạn mức sử dụng AI hôm nay");
        }

        @GetMapping("/generic")
        public void generic() {
            throw new IllegalStateException("Unexpected internal state error");
        }

        @PostMapping("/validation")
        public void validation(@Valid @RequestBody ValidationPayload payload) {
        }
    }

    @Data
    static class ValidationPayload {
        @NotBlank(message = "Email bắt buộc")
        @Email(message = "Email không đúng định dạng")
        private String email;

        @NotBlank(message = "Tên bắt buộc")
        private String name;
    }

    @Test
    @DisplayName("ResourceNotFoundException -> HTTP 404 Not Found với ErrorResponse chuẩn")
    void handleResourceNotFound_returns404() throws Exception {
        mockMvc.perform(get("/test/exceptions/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Không tìm thấy bản ghi"))
                .andExpect(jsonPath("$.path").value("/test/exceptions/not-found"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("BadRequestException -> HTTP 400 Bad Request")
    void handleBadRequest_returns400() throws Exception {
        mockMvc.perform(get("/test/exceptions/bad-request"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Yêu cầu không hợp lệ"))
                .andExpect(jsonPath("$.path").value("/test/exceptions/bad-request"));
    }

    @Test
    @DisplayName("InvalidFileFormatException -> HTTP 400 Bad Request")
    void handleInvalidFileFormat_returns400() throws Exception {
        mockMvc.perform(get("/test/exceptions/invalid-file"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Chỉ chấp nhận file Excel (.xlsx, .xls)"))
                .andExpect(jsonPath("$.path").value("/test/exceptions/invalid-file"));
    }

    @Test
    @DisplayName("UnauthorizedException -> HTTP 401 Unauthorized")
    void handleUnauthorized_returns401() throws Exception {
        mockMvc.perform(get("/test/exceptions/unauthorized"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.message").value("Token không hợp lệ"))
                .andExpect(jsonPath("$.path").value("/test/exceptions/unauthorized"));
    }

    @Test
    @DisplayName("BadCredentialsException -> HTTP 401 với message chuẩn 'Invalid email or password'")
    void handleBadCredentials_returns401WithStandardMessage() throws Exception {
        mockMvc.perform(get("/test/exceptions/bad-credentials"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    @DisplayName("DisabledException (AuthenticationException) -> HTTP 401 Unauthorized")
    void handleDisabledAuthenticationException_returns401() throws Exception {
        mockMvc.perform(get("/test/exceptions/disabled"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.message").value("Tài khoản đã bị khóa"));
    }

    @Test
    @DisplayName("ForbiddenException -> HTTP 403 Forbidden")
    void handleForbidden_returns403() throws Exception {
        mockMvc.perform(get("/test/exceptions/forbidden"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").value("Bị cấm truy cập"));
    }

    @Test
    @DisplayName("AccessDeniedException -> HTTP 403 Forbidden với thông điệp phân quyền")
    void handleAccessDenied_returns403() throws Exception {
        mockMvc.perform(get("/test/exceptions/access-denied"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").value("Access denied: You do not have permission for this resource"));
    }

    @Test
    @DisplayName("MaxUploadSizeExceededException -> HTTP 413 Payload Too Large")
    void handleMaxUploadSizeExceeded_returns413() throws Exception {
        mockMvc.perform(get("/test/exceptions/max-upload"))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.status").value(413))
                .andExpect(jsonPath("$.error").value("Payload Too Large"))
                .andExpect(jsonPath("$.message").value("Dung lượng video vượt quá giới hạn cho phép (tối đa 500MB)."));
    }

    @Test
    @DisplayName("QuotaExceededException -> HTTP 429 Too Many Requests")
    void handleQuotaExceeded_returns429() throws Exception {
        mockMvc.perform(get("/test/exceptions/quota-exceeded"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.error").value("Too Many Requests"))
                .andExpect(jsonPath("$.message").value("Đã vượt hạn mức sử dụng AI hôm nay"));
    }

    @Test
    @DisplayName("MethodArgumentNotValidException -> HTTP 400 cùng map validationErrors")
    void handleValidationException_returns400WithFieldErrors() throws Exception {
        String invalidBody = """
                {
                  "email": "invalid-email-format",
                  "name": ""
                }
                """;

        mockMvc.perform(post("/test/exceptions/validation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.validationErrors.email").value("Email không đúng định dạng"))
                .andExpect(jsonPath("$.validationErrors.name").value("Tên bắt buộc"));
    }

    @Test
    @DisplayName("NoResourceFoundException -> HTTP 404 Not Found thay vì 500")
    void handleNoResourceFound_returns404() throws Exception {
        mockMvc.perform(get("/test/exceptions/no-resource"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"));
    }

    @Test
    @DisplayName("Exception tổng quát chưa xử lý -> HTTP 500 Internal Server Error")
    void handleGenericException_returns500() throws Exception {
        mockMvc.perform(get("/test/exceptions/generic"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.error").value("Internal Server Error"))
                .andExpect(jsonPath("$.message").value("Unexpected internal state error"));
    }
}
