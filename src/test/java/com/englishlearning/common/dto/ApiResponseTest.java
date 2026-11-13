package com.englishlearning.common.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ApiResponse - Kiểm thử wrapper phản hồi chuẩn API")
class ApiResponseTest {

    @Test
    @DisplayName("success(data): Trả về status 200, message 'Success' và payload")
    void success_withDataOnly_returns200AndDefaultMessage() {
        // Given
        String payload = "sample-payload";

        // When
        ApiResponse<String> response = ApiResponse.success(payload);

        // Then
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getMessage()).isEqualTo("Success");
        assertThat(response.getData()).isEqualTo("sample-payload");
    }

    @Test
    @DisplayName("success(message, data): Trả về status 200, message tùy chỉnh và payload")
    void success_withCustomMessageAndData_returns200AndCustomMessage() {
        // When
        ApiResponse<Integer> response = ApiResponse.success("Tạo mới thành công", 42);

        // Then
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getMessage()).isEqualTo("Tạo mới thành công");
        assertThat(response.getData()).isEqualTo(42);
    }

    @Test
    @DisplayName("success(message, null): Cho phép data null mà vẫn giữ status 200")
    void success_withNullData_setsNullData() {
        // When
        ApiResponse<Void> response = ApiResponse.success("Đã xóa", null);

        // Then
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getMessage()).isEqualTo("Đã xóa");
        assertThat(response.getData()).isNull();
    }

    @Test
    @DisplayName("error(status, message): Trả về mã lỗi, thông điệp và data null")
    void error_withStatusAndMessage_returnsErrorResponse() {
        // When
        ApiResponse<Object> response = ApiResponse.error(403, "Không có quyền truy cập");

        // Then
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getMessage()).isEqualTo("Không có quyền truy cập");
        assertThat(response.getData()).isNull();
    }

    @Test
    @DisplayName("NoArgsConstructor, AllArgsConstructor và Builder hoạt động chính xác")
    void constructorsAndBuilder_workCorrectly() {
        // When
        ApiResponse<String> empty = new ApiResponse<>();
        empty.setStatus(201);
        empty.setMessage("Created");
        empty.setData("item");

        ApiResponse<String> built = ApiResponse.<String>builder()
                .status(202)
                .message("Accepted")
                .data("queued")
                .build();

        // Then
        assertThat(empty.getStatus()).isEqualTo(201);
        assertThat(empty.getMessage()).isEqualTo("Created");
        assertThat(empty.getData()).isEqualTo("item");

        assertThat(built.getStatus()).isEqualTo(202);
        assertThat(built.getMessage()).isEqualTo("Accepted");
        assertThat(built.getData()).isEqualTo("queued");
    }
}
