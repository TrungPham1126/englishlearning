package com.englishlearning.common.event;

import com.englishlearning.common.config.RabbitMqConfig;
import com.englishlearning.video.dto.VideoTranscodeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("RabbitMqEventPublisher - Bắn sự kiện bất đồng bộ qua RabbitMQ")
class RabbitMqEventPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    private RabbitMqEventPublisher rabbitMqEventPublisher;

    private final UUID sampleVideoId = UUID.fromString("11111111-aaaa-bbbb-cccc-111111111111");

    @BeforeEach
    void setUp() {
        rabbitMqEventPublisher = new RabbitMqEventPublisher(rabbitTemplate);
    }

    @Test
    @DisplayName("Bắn message yêu cầu transcode video vào đúng Exchange và Routing Key của RabbitMQ")
    void should_PublishVideoTranscodingMessageToRabbitMq_when_TeacherUploadsLectureVideo() {
        // When
        rabbitMqEventPublisher.publishVideoTranscodeEvent(sampleVideoId);

        // Then
        ArgumentCaptor<VideoTranscodeMessage> captor = ArgumentCaptor.forClass(VideoTranscodeMessage.class);
        verify(rabbitTemplate, times(1)).convertAndSend(
                eq(RabbitMqConfig.VIDEO_EXCHANGE),
                eq(RabbitMqConfig.VIDEO_TRANSCODE_ROUTING_KEY),
                captor.capture()
        );

        VideoTranscodeMessage message = captor.getValue();
        assertThat(message.getVideoId()).isEqualTo(sampleVideoId);
    }

    @Test
    @DisplayName("Ném IllegalArgumentException khi Video ID truyền vào là null")
    void should_ThrowIllegalArgumentException_when_VideoIdIsNull() {
        // When & Then
        assertThatThrownBy(() -> rabbitMqEventPublisher.publishVideoTranscodeEvent(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Video ID không được để trống");
    }
}
