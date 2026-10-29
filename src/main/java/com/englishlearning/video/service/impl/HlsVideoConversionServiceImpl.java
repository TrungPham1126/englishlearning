package com.englishlearning.video.service.impl;

import com.englishlearning.common.event.RabbitMqEventPublisher;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.service.HlsVideoConversionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class HlsVideoConversionServiceImpl implements HlsVideoConversionService {

    private final VideoRepository videoRepository;
    private final RabbitMqEventPublisher rabbitMqEventPublisher;

    @Override
    @Transactional
    public void requestVideoTranscoding(UUID videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy video với ID: " + videoId));

        video.setStatus(VideoStatus.PROCESSING);
        videoRepository.save(video);

        log.info("Khởi tạo yêu cầu chuyển đổi HLS cho video ID: {}", videoId);
        rabbitMqEventPublisher.publishVideoTranscodeEvent(videoId);
    }

    @Override
    @Transactional
    public Video completeHlsConversion(UUID videoId, String hlsPlaylistUrl, String rawStorageUrl) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy video với ID: " + videoId));

        log.info("Hoàn tất chuyển đổi HLS cho video ID: {}. Playlist URL: {}", videoId, hlsPlaylistUrl);
        video.setStatus(VideoStatus.READY);
        video.setHlsPlaylistUrl(hlsPlaylistUrl);
        video.setRawStorageUrl(rawStorageUrl);
        video.setRejectionReason(null);

        return videoRepository.save(video);
    }
}
