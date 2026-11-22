package com.englishlearning.video.service;

import com.englishlearning.video.dto.R2ObjectStream;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.entity.VideoWatchHistory;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VideoService {

    VideoUploadResponse uploadOriginalVideo(UUID lessonId, MultipartFile file, UUID uploadedByUserId);

    Video getVideoById(UUID videoId);

    Optional<R2ObjectStream> openHlsStream(UUID videoId, String fileName, String rangeHeader, boolean headOnly);

    Optional<R2ObjectStream> openRawStream(Video video, String rangeHeader, boolean headOnly);

    void updateWatchProgress(UUID studentId, UUID videoId, WatchProgressRequest request);

    Video getVideoByLessonId(UUID lessonId);

    VideoWatchHistory getWatchProgress(UUID studentId, UUID videoId);

    Video reviewVideo(UUID videoId, UUID reviewerId, boolean isApproved, String rejectionReason);

    void deleteVideo(UUID videoId);

    List<Video> getVideosByStatus(VideoStatus status);

    List<Video> getVideosByUploader(UUID uploaderId, VideoStatus status);
}
