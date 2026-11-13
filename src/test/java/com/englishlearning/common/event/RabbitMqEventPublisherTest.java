package com.englishlearning.common.event;

import com.englishlearning.common.config.RabbitMqConfig;
import com.englishlearning.video.dto.VideoTranscodeMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
@DisplayName("RabbitMqEventPublisher - Kiểm thử phát sự kiện RabbitMQ và xử lý lỗi Broker")
class RabbitMqEventPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private RabbitMqEventPublisher eventPublisher;

    @Test
    @DisplayName("Bắn sự kiện chuyển đổi HLS hợp lệ tới Exchange và RoutingKey chính xác")
    void should_PublishVideoTranscodeEvent_when_VideoIdIsValid() {
        // Given
        UUID videoId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

        // When
        eventPublisher.publishVideoTranscodeEvent(videoId);

        // Then
        ArgumentCaptor<VideoTranscodeMessage> messageCaptor = ArgumentCaptor.forClass(VideoTranscodeMessage.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMqConfig.VIDEO_EXCHANGE),
                eq(RabbitMqConfig.VIDEO_TRANSCODE_ROUTING_KEY),
                messageCaptor.capture()
        );

        VideoTranscodeMessage capturedMessage = messageCaptor.getValue();
        assertThat(capturedMessage).isNotNull();
        assertThat(capturedMessage.getVideoId()).isEqualTo(videoId);
    }

    @Test
    @DisplayName("Ném ngoại lệ IllegalArgumentException và không gọi RabbitTemplate nếu videoId là null")
    void should_ThrowException_when_VideoIdIsNull() {
        // When & Then
        assertThatThrownBy(() -> eventPublisher.publishVideoTranscodeEvent(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Video ID không được để trống khi phát sự kiện transcode.");

        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    @DisplayName("publishVideoTranscodeEvent: Lan truyền AmqpException khi RabbitMQ broker không phản hồi")
    void publishVideoTranscodeEvent_whenBrokerFails_throwsAmqpException() {
        // Given
        UUID videoId = UUID.randomUUID();
        doThrow(new AmqpException("Broker connection refused"))
                .when(rabbitTemplate)
                .convertAndSend(eq(RabbitMqConfig.VIDEO_EXCHANGE), eq(RabbitMqConfig.VIDEO_TRANSCODE_ROUTING_KEY), any(VideoTranscodeMessage.class));

        // When & Then
        assertThatThrownBy(() -> eventPublisher.publishVideoTranscodeEvent(videoId))
                .isInstanceOf(AmqpException.class)
                .hasMessage("Broker connection refused");
    }

    @Test
    @DisplayName("publishNotificationEvent: Phát Map payload đầy đủ tới NOTIFICATION_EXCHANGE")
    @SuppressWarnings("unchecked")
    void publishNotificationEvent_withAllFields_sendsPayloadToNotificationExchange() {
        // Given
        UUID recipientId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

        // When
        eventPublisher.publishNotificationEvent(
                recipientId,
                "Bài tập mới",
                "Giáo viên vừa giao bài tập phát âm",
                "NEW_ASSIGNMENT",
                "/student/assignments/1"
        );

        // Then
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMqConfig.NOTIFICATION_EXCHANGE),
                eq(RabbitMqConfig.NOTIFICATION_ROUTING_KEY),
                payloadCaptor.capture()
        );

        Map<String, Object> payload = payloadCaptor.getValue();
        assertThat(payload)
                .containsEntry("recipientId", recipientId.toString())
                .containsEntry("title", "Bài tập mới")
                .containsEntry("message", "Giáo viên vừa giao bài tập phát âm")
                .containsEntry("type", "NEW_ASSIGNMENT")
                .containsEntry("link", "/student/assignments/1");
    }

    @Test
    @DisplayName("publishNotificationEvent: Thay thế tham số null bằng giá trị mặc định an toàn")
    @SuppressWarnings("unchecked")
    void publishNotificationEvent_withNullFields_usesSafeDefaults() {
        // When
        eventPublisher.publishNotificationEvent(null, null, null, null, null);

        // Then
        ArgumentCaptor<Map<String, Object>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMqConfig.NOTIFICATION_EXCHANGE),
                eq(RabbitMqConfig.NOTIFICATION_ROUTING_KEY),
                payloadCaptor.capture()
        );

        Map<String, Object> payload = payloadCaptor.getValue();
        assertThat(payload)
                .containsEntry("recipientId", "")
                .containsEntry("title", "")
                .containsEntry("message", "")
                .containsEntry("type", "SYSTEM_ALERT")
                .containsEntry("link", "");
    }

    @Test
    @DisplayName("publishNotificationEvent: Ném AmqpException khi broker sập")
    void publishNotificationEvent_whenBrokerDown_propagatesAmqpException() {
        // Given
        doThrow(new AmqpException("Channel closed"))
                .when(rabbitTemplate)
                .convertAndSend(eq(RabbitMqConfig.NOTIFICATION_EXCHANGE), eq(RabbitMqConfig.NOTIFICATION_ROUTING_KEY), any(Map.class));

        // When & Then
        assertThatThrownBy(() -> eventPublisher.publishNotificationEvent(UUID.randomUUID(), "Title", "Msg", "ANNOUNCEMENT", "/"))
                .isInstanceOf(AmqpException.class)
                .hasMessage("Channel closed");
    }

    @Test
    @DisplayName("publishEvent: Ủy quyền đúng exchange, routingKey và payload tùy chỉnh cho RabbitTemplate")
    void publishEvent_withCustomParameters_delegatesToRabbitTemplate() {
        // Given
        Map<String, String> customPayload = Map.of("event", "USER_LOCKED");

        // When
        eventPublisher.publishEvent("custom.exchange", "custom.key", customPayload);

        // Then
        verify(rabbitTemplate).convertAndSend("custom.exchange", "custom.key", customPayload);
    }

    @Test
    @DisplayName("publishEvent: Lan truyền ngoại lệ khi gửi event tùy chỉnh thất bại")
    void publishEvent_whenBrokerFails_propagatesException() {
        // Given
        doThrow(new AmqpException("Timeout"))
                .when(rabbitTemplate).convertAndSend("custom.exchange", "custom.key", "payload");

        // When & Then
        assertThatThrownBy(() -> eventPublisher.publishEvent("custom.exchange", "custom.key", "payload"))
                .isInstanceOf(AmqpException.class)
                .hasMessage("Timeout");
    }
}
