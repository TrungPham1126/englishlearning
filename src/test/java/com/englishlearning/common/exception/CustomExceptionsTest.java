package com.englishlearning.common.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("CustomExceptions - Kiểm thử message, cause và @ResponseStatus cho 6 ngoại lệ")
class CustomExceptionsTest {

    @Test
    @DisplayName("BadRequestException: Mang thông điệp và @ResponseStatus(400 BAD_REQUEST)")
    void badRequestException_hasExpectedMessageAndStatus() {
        BadRequestException ex = new BadRequestException("Dữ liệu đầu vào không hợp lệ");
        ResponseStatus status = BadRequestException.class.getAnnotation(ResponseStatus.class);

        assertThat(ex.getMessage()).isEqualTo("Dữ liệu đầu vào không hợp lệ");
        assertThat(status).isNotNull();
        assertThat(status.value()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("UnauthorizedException: Mang thông điệp và @ResponseStatus(401 UNAUTHORIZED)")
    void unauthorizedException_hasExpectedMessageAndStatus() {
        UnauthorizedException ex = new UnauthorizedException("Chưa xác thực");
        ResponseStatus status = UnauthorizedException.class.getAnnotation(ResponseStatus.class);

        assertThat(ex.getMessage()).isEqualTo("Chưa xác thực");
        assertThat(status).isNotNull();
        assertThat(status.value()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("ForbiddenException: Mang thông điệp và @ResponseStatus(403 FORBIDDEN)")
    void forbiddenException_hasExpectedMessageAndStatus() {
        ForbiddenException ex = new ForbiddenException("Không có quyền truy cập");
        ResponseStatus status = ForbiddenException.class.getAnnotation(ResponseStatus.class);

        assertThat(ex.getMessage()).isEqualTo("Không có quyền truy cập");
        assertThat(status).isNotNull();
        assertThat(status.value()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("ResourceNotFoundException: Mang thông điệp và @ResponseStatus(404 NOT_FOUND)")
    void resourceNotFoundException_hasExpectedMessageAndStatus() {
        ResourceNotFoundException ex = new ResourceNotFoundException("Không tìm thấy tài nguyên");
        ResponseStatus status = ResourceNotFoundException.class.getAnnotation(ResponseStatus.class);

        assertThat(ex.getMessage()).isEqualTo("Không tìm thấy tài nguyên");
        assertThat(status).isNotNull();
        assertThat(status.value()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("InvalidFileFormatException: Hỗ trợ 2 constructor và @ResponseStatus(400 BAD_REQUEST)")
    void invalidFileFormatException_hasExpectedConstructorsAndStatus() {
        Throwable cause = new IllegalArgumentException("Bad magic bytes");
        InvalidFileFormatException ex1 = new InvalidFileFormatException("Sai định dạng file");
        InvalidFileFormatException ex2 = new InvalidFileFormatException("File hỏng", cause);
        ResponseStatus status = InvalidFileFormatException.class.getAnnotation(ResponseStatus.class);

        assertThat(ex1.getMessage()).isEqualTo("Sai định dạng file");
        assertThat(ex2.getMessage()).isEqualTo("File hỏng");
        assertThat(ex2.getCause()).isSameAs(cause);
        assertThat(status).isNotNull();
        assertThat(status.value()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("QuotaExceededException: Hỗ trợ 2 constructor và @ResponseStatus(429 TOO_MANY_REQUESTS)")
    void quotaExceededException_hasExpectedConstructorsAndStatus() {
        Throwable cause = new IllegalStateException("Limit reached");
        QuotaExceededException ex1 = new QuotaExceededException("Hết lượt sử dụng AI hôm nay");
        QuotaExceededException ex2 = new QuotaExceededException("Quá giới hạn", cause);
        ResponseStatus status = QuotaExceededException.class.getAnnotation(ResponseStatus.class);

        assertThat(ex1.getMessage()).isEqualTo("Hết lượt sử dụng AI hôm nay");
        assertThat(ex2.getMessage()).isEqualTo("Quá giới hạn");
        assertThat(ex2.getCause()).isSameAs(cause);
        assertThat(status).isNotNull();
        assertThat(status.value()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }
}
