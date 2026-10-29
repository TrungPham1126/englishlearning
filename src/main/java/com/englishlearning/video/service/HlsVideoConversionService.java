package com.englishlearning.video.service;

import com.englishlearning.video.entity.Video;

import java.util.UUID;

public interface HlsVideoConversionService {

    /**
     * Yêu cầu chuyển đổi video bài giảng sang chuẩn phân mảnh HLS (.m3u8 và .ts) qua RabbitMQ.
     */
    void requestVideoTranscoding(UUID videoId);

    /**
     * Cập nhật trạng thái video sang READY sau khi quá trình chuyển đổi HLS hoàn tất.
     */
    Video completeHlsConversion(UUID videoId, String hlsPlaylistUrl, String rawStorageUrl);
}
