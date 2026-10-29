package com.englishlearning.common.event;

import com.englishlearning.common.config.RabbitMqConfig;
import com.englishlearning.video.dto.VideoTranscodeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class RabbitMqEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Bắn event yêu cầu chuyển đổi định dạng HLS bất đồng bộ cho video.
     */
    public void publishVideoTranscodeEvent(UUID videoId) {
        if (videoId == null) {
            throw new IllegalArgumentException("Video ID không được để trống khi phát sự kiện transcode.");
        }

        VideoTranscodeMessage message = VideoTranscodeMessage.builder()
                .videoId(videoId)
                .build();

        log.info("[RabbitMQ] Đẩy message chuyển đổi HLS cho video ID: {} vào exchange: {}, routingKey: {}",
                videoId, RabbitMqConfig.VIDEO_EXCHANGE, RabbitMqConfig.VIDEO_TRANSCODE_ROUTING_KEY);

        rabbitTemplate.convertAndSend(
                RabbitMqConfig.VIDEO_EXCHANGE,
                RabbitMqConfig.VIDEO_TRANSCODE_ROUTING_KEY,
                message
        );
    }

    /**
     * Bắn event thông báo hệ thống tới người dùng.
     */
    public void publishNotificationEvent(UUID recipientId, String title, String message, String type, String link) {
        Map<String, Object> payload = Map.of(
                "recipientId", recipientId != null ? recipientId.toString() : "",
                "title", title != null ? title : "",
                "message", message != null ? message : "",
                "type", type != null ? type : "SYSTEM_ALERT",
                "link", link != null ? link : ""
        );

        rabbitTemplate.convertAndSend(
                RabbitMqConfig.NOTIFICATION_EXCHANGE,
                RabbitMqConfig.NOTIFICATION_ROUTING_KEY,
                payload
        );
    }

    /**
     * Bắn event tùy chỉnh tổng quát.
     */
    public void publishEvent(String exchange, String routingKey, Object payload) {
        rabbitTemplate.convertAndSend(exchange, routingKey, payload);
    }
}
