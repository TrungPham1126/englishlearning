package com.englishlearning.video.dto;

import java.io.IOException;
import java.io.InputStream;

/**
 * Luồng đối tượng được tải từ Cloudflare R2 (hỗ trợ cả full stream, byte-range 206, HEAD và 416).
 */
public record R2ObjectStream(
        InputStream inputStream,
        long contentLength,
        long totalContentLength,
        String contentRange,
        String contentType,
        boolean partial,
        boolean rangeNotSatisfiable
) {
    public static R2ObjectStream notSatisfiable(long totalContentLength, String contentType) {
        String rangeHeader = totalContentLength >= 0 ? "bytes */" + totalContentLength : null;
        return new R2ObjectStream(null, 0L, totalContentLength, rangeHeader, contentType, false, true);
    }

    public void closeQuietly() {
        if (inputStream != null) {
            try {
                inputStream.close();
            } catch (IOException ignored) {
                // Bỏ qua lỗi khi đóng stream dự phòng
            }
        }
    }
}
