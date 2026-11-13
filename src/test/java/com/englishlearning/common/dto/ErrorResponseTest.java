package com.englishlearning.common.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ErrorResponse - Kiểm thử DTO chi tiết lỗi")
class ErrorResponseTest {

    @Test
    @DisplayName("Builder: Khởi tạo đầy đủ timestamp, status, error, message, path và validationErrors")
    void builder_withAllFields_populatesFieldsCorrectly() {
        // Given
        Instant now = Instant.parse("2026-01-15T10:00:00Z");
        Map<String, String> validationErrors = Map.of("email", "Email không đúng định dạng");

        // When
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(now)
                .status(400)
                .error("Bad Request")
                .message("Validation failed")
                .path("/api/v1/auth/login")
                .validationErrors(validationErrors)
                .build();

        // Then
        assertThat(response.getTimestamp()).isEqualTo(now);
        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(response.getError()).isEqualTo("Bad Request");
        assertThat(response.getMessage()).isEqualTo("Validation failed");
        assertThat(response.getPath()).isEqualTo("/api/v1/auth/login");
        assertThat(response.getValidationErrors()).containsEntry("email", "Email không đúng định dạng");
    }

    @Test
    @DisplayName("NoArgsConstructor và Setters cập nhật đúng giá trị")
    void noArgsAndSetters_updateFieldsCorrectly() {
        // Given
        Instant now = Instant.now();
        ErrorResponse response = new ErrorResponse();

        // When
        response.setTimestamp(now);
        response.setStatus(500);
        response.setError("Internal Server Error");
        response.setMessage("Unexpected failure");
        response.setPath("/api/v1/test");
        response.setValidationErrors(null);

        // Then
        assertThat(response.getTimestamp()).isEqualTo(now);
        assertThat(response.getStatus()).isEqualTo(500);
        assertThat(response.getError()).isEqualTo("Internal Server Error");
        assertThat(response.getMessage()).isEqualTo("Unexpected failure");
        assertThat(response.getPath()).isEqualTo("/api/v1/test");
        assertThat(response.getValidationErrors()).isNull();
    }
}
