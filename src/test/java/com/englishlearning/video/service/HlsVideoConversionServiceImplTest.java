package com.englishlearning.video.service;

import com.englishlearning.common.event.RabbitMqEventPublisher;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.service.impl.HlsVideoConversionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("HlsVideoConversionServiceImpl - Chuyển đổi video bài giảng sang chuẩn phân mảnh HLS")
class HlsVideoConversionServiceImplTest {

    @Mock
    private VideoRepository videoRepository;

    @Mock
    private RabbitMqEventPublisher rabbitMqEventPublisher;

    private HlsVideoConversionServiceImpl hlsVideoConversionService;

    private final UUID videoId = UUID.fromString("22222222-bbbb-cccc-dddd-222222222222");

    @BeforeEach
    void setUp() {
        hlsVideoConversionService = new HlsVideoConversionServiceImpl(videoRepository, rabbitMqEventPublisher);
    }

    @Test
    @DisplayName("Cập nhật trạng thái PROCESSING và phát sự kiện RabbitMQ khi yêu cầu transcode video")
    void should_PublishVideoTranscodingMessageToRabbitMq_when_TeacherUploadsLectureVideo() {
        // Given
        Video video = Video.builder()
                .id(videoId)
                .originalFileName("lecture_unit1.mp4")
                .status(VideoStatus.DRAFT)
                .build();

        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));
        when(videoRepository.save(any(Video.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        hlsVideoConversionService.requestVideoTranscoding(videoId);

        // Then
        ArgumentCaptor<Video> captor = ArgumentCaptor.forClass(Video.class);
        verify(videoRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(VideoStatus.PROCESSING);

        verify(rabbitMqEventPublisher, times(1)).publishVideoTranscodeEvent(eq(videoId));
    }

    @Test
    @DisplayName("Cập nhật trạng thái video sang READY và lưu link playlist HLS khi quá trình convert hoàn tất")
    void should_UpdateVideoStatusToReady_when_HlsTranscodingCompletes() {
        // Given
        Video video = Video.builder()
                .id(videoId)
                .status(VideoStatus.PROCESSING)
                .build();

        String hlsPlaylistUrl = "https://cdn.englishlearning.com/videos/hls/22222222-bbbb/master.m3u8";
        String rawCloudUrl = "https://cdn.englishlearning.com/videos/raw/22222222-bbbb/lecture_unit1.mp4";

        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));
        when(videoRepository.save(any(Video.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        Video updatedVideo = hlsVideoConversionService.completeHlsConversion(videoId, hlsPlaylistUrl, rawCloudUrl);

        // Then
        assertThat(updatedVideo).isNotNull();
        assertThat(updatedVideo.getStatus()).isEqualTo(VideoStatus.READY);
        assertThat(updatedVideo.getHlsPlaylistUrl()).isEqualTo(hlsPlaylistUrl);
        assertThat(updatedVideo.getRawStorageUrl()).isEqualTo(rawCloudUrl);
        assertThat(updatedVideo.getRejectionReason()).isNull();

        verify(videoRepository, times(1)).save(video);
    }
}
