package com.englishlearning.auth.config;

import com.englishlearning.common.dto.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.InsufficientAuthenticationException;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("JwtAuthenticationEntryPoint - Kiểm thử phản hồi 401 JSON khi chưa xác thực")
class JwtAuthenticationEntryPointTest {

    private final JwtAuthenticationEntryPoint entryPoint = new JwtAuthenticationEntryPoint();

    @Test
    @DisplayName("commence: Ghi mã 401 Unauthorized, Content-Type application/json và ErrorResponse đầy đủ")
    void commence_whenUnauthenticatedRequest_writes401JsonErrorResponse() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/admin/users");
        MockHttpServletResponse response = new MockHttpServletResponse();
        InsufficientAuthenticationException authException =
                new InsufficientAuthenticationException("Full authentication is required");

        // When
        entryPoint.commence(request, response, authException);

        // Then
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
        assertThat(response.getCharacterEncoding()).isEqualTo("UTF-8");

        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        ErrorResponse body = mapper.readValue(response.getContentAsString(), ErrorResponse.class);

        assertThat(body.getStatus()).isEqualTo(401);
        assertThat(body.getError()).isEqualTo("Unauthorized");
        assertThat(body.getMessage())
                .isEqualTo("Bạn cần đăng nhập để truy cập tài nguyên này: Full authentication is required");
        assertThat(body.getPath()).isEqualTo("/api/v1/admin/users");
        assertThat(body.getTimestamp()).isNotNull();
    }
}
