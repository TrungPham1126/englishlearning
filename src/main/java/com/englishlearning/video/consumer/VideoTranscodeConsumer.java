package com.englishlearning.video.consumer;

import com.englishlearning.notification.service.NotificationService;
import com.englishlearning.video.dto.VideoTranscodeMessage;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.service.R2StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.FileSystemUtils;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class VideoTranscodeConsumer {

    private final VideoRepository videoRepository;
    private final NotificationService notificationService;
    private final R2StorageService r2StorageService;

    @Value("${app.storage.upload-dir:uploads/videos}")
    private String uploadBaseDir;

    @Value("${cloud.aws.s3.public-url:}")
    private String publicCloudUrl;

    @RabbitListener(queues = "${app.rabbitmq.queues.video-transcode:video.transcode.queue}")
    @Transactional
    public void processVideoTranscode(VideoTranscodeMessage message) {
        if (message == null || message.getVideoId() == null)
            return;
        UUID videoId = message.getVideoId();

        Video video = videoRepository.findById(videoId).orElse(null);
        if (video == null)
            return;

        video.setStatus(VideoStatus.PROCESSING);
        videoRepository.save(video);

        Path localRawPath = Paths.get(video.getRawStorageUrl()); // Lấy đường dẫn mp4 tạm trên máy

        try {
            Path outputDir = Paths.get(uploadBaseDir, "hls", videoId.toString());
            Files.createDirectories(outputDir);
            String m3u8Path = outputDir.resolve("master.m3u8").toAbsolutePath().toString();
            String segmentPattern = outputDir.resolve("segment_%03d.ts").toAbsolutePath().toString();

            ProcessBuilder processBuilder = new ProcessBuilder(
                    "ffmpeg", "-y", "-i", localRawPath.toString(),
                    "-profile:v", "baseline", "-level", "3.0", "-start_number", "0",
                    "-hls_time", "6", "-hls_list_size", "0",
                    "-hls_segment_filename", segmentPattern, "-f", "hls", m3u8Path);
            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                while (reader.readLine() != null) {
                } // Xóa buffer
            }

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                log.info("FFmpeg nén xong! Đang đẩy toàn bộ lên mây...");

                String hlsPrefix = "hls/" + videoId;
                String rawPrefix = "raw/" + videoId + "/" + localRawPath.getFileName().toString();

                try {
                    // 1. Upload HLS lên mây
                    r2StorageService.uploadHlsFolder(hlsPrefix, outputDir);

                    // 2. Upload file gốc mp4 lên mây để lưu trữ/backup
                    String cloudRawUrl = r2StorageService.uploadFile(rawPrefix, localRawPath.toFile(), "video/mp4");

                    // 3. Đổi URL trong Database trỏ thẳng ra public link của Cloudflare R2
                    String playlistUrl = publicCloudUrl + "/" + hlsPrefix + "/master.m3u8";
                    video.setStatus(VideoStatus.PENDING_REVIEW);
                    video.setHlsPlaylistUrl(playlistUrl);
                    video.setRawStorageUrl(cloudRawUrl); // Đổi link raw từ C:\... thành link R2
                    videoRepository.save(video);

                    // 4. QUAN TRỌNG: Xóa sạch file trên server cục bộ để giải phóng dung lượng
                    FileSystemUtils.deleteRecursively(outputDir); // Xóa folder HLS local
                    Files.deleteIfExists(localRawPath); // Xóa file mp4 local
                    log.info(">>> Đã dọn dẹp ổ cứng (xóa file local) cho video: {}", videoId);

                } catch (Exception e) {
                    log.error(">>> [R2-UPLOAD] LỖI UPLOAD / DỌN DẸP: ", e);
                }

                UUID recipientId = (video.getUploadedBy() != null) ? video.getUploadedBy().getId() : null;
                notificationService.sendSystemNotification(
                        recipientId,
                        "Video đã xử lý xong",
                        "Video đã nén, đưa lên R2 và giải phóng dung lượng máy chủ.",
                        "SYSTEM_ALERT",
                        "/videos/" + videoId);

            } else {
                video.setStatus(VideoStatus.REJECTED);
                video.setRejectionReason("Lỗi xử lý FFmpeg (exit code: " + exitCode + ")");
                videoRepository.save(video);

                // Nếu FFmpeg lỗi, vẫn xóa file raw gốc trên máy để tránh rác
                Files.deleteIfExists(localRawPath);
            }
        } catch (Exception e) {
            log.error("Lỗi khi transcode video ID {}: ", videoId, e);
            video.setStatus(VideoStatus.REJECTED);
            video.setRejectionReason(e.getMessage());
            videoRepository.save(video);
            try {
                Files.deleteIfExists(localRawPath);
            } catch (Exception ignored) {
            }
        }
    }
}