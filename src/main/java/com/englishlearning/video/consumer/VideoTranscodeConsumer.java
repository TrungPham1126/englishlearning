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
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
@Slf4j
public class VideoTranscodeConsumer {

    private final VideoRepository videoRepository;
    private final NotificationService notificationService;
    private final R2StorageService r2StorageService;

    @Value("${app.storage.upload-dir:uploads/videos}")
    private String uploadBaseDir;

    @Value("${app.secrets.storage.public-url:http://localhost:8080/uploads/videos}")
    private String publicCloudUrl;

    @Value("${app.video.ffmpeg-path:ffmpeg}")
    private String ffmpegPath;

    @Value("${app.video.hls-enabled:true}")
    private boolean hlsEnabled;

    private String resolveFfmpegExecutable() {
        String[] candidates = new String[] {
                ffmpegPath,
                "D:\\taixuong\\ffmpeg-8.0-full_build\\bin\\ffmpeg.exe",
                "D:\\HocTap_DoAn\\doanchuyennganh\\phonetics-service\\.venv\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg.exe"
        };
        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            try {
                Process process = new ProcessBuilder(candidate, "-version").start();
                boolean completed = process.waitFor(2, TimeUnit.SECONDS);
                if (completed && process.exitValue() == 0) {
                    return candidate;
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    public boolean isFfmpegAvailable() {
        if (!hlsEnabled) {
            return false;
        }
        String resolved = resolveFfmpegExecutable();
        if (resolved != null) {
            this.ffmpegPath = resolved;
            return true;
        }
        log.warn("[VIDEO_PIPELINE] Không tìm thấy FFmpeg tại '{}' hoặc chưa cài đặt vào PATH. Chế độ HLS tạm tắt, chuyển sang phát file trực tiếp.", ffmpegPath);
        return false;
    }

    @Transactional
    public void handleFallbackToRaw(Video video) {
        if (video == null) {
            return;
        }

        String rawUrl = video.getRawStorageUrl();
        String playableUrl = rawUrl;

        if (rawUrl != null && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
            try {
                Path localRawPath = Paths.get(rawUrl);
                String fileName = localRawPath.getFileName().toString();
                playableUrl = "http://localhost:8080/uploads/videos/raw/" + fileName;

                if (Files.exists(localRawPath)) {
                    String rawPrefix = "raw/" + video.getId() + "/" + fileName;
                    try {
                        if (publicCloudUrl != null && !publicCloudUrl.contains("dummy")) {
                            String cloudRawUrl = r2StorageService.uploadFile(rawPrefix, localRawPath.toFile(), "video/mp4");
                            if (cloudRawUrl != null && !cloudRawUrl.isBlank()) {
                                playableUrl = cloudRawUrl;
                                video.setRawStorageUrl(cloudRawUrl);
                                log.info("[VIDEO_PIPELINE] Đã upload file MP4 gốc lên R2 thành công cho video ID {}: {}", video.getId(), cloudRawUrl);
                            }
                        }
                    } catch (Exception r2Ex) {
                        log.warn("[VIDEO_PIPELINE] Không thể upload file MP4 gốc lên R2 ({}). Sử dụng đường dẫn phát cục bộ: {}", r2Ex.getMessage(), playableUrl);
                    }
                }
            } catch (Exception pathEx) {
                log.warn("[VIDEO_PIPELINE] Không thể phân giải đường dẫn raw '{}': {}", rawUrl, pathEx.getMessage());
            }
        }

        if (playableUrl == null || playableUrl.isBlank()) {
            playableUrl = "/api/v1/videos/" + video.getId() + "/raw";
        }

        video.setStatus(VideoStatus.APPROVED);
        video.setHlsPlaylistUrl(playableUrl);
        video.setRejectionReason(null);
        videoRepository.save(video);
        log.info("[VIDEO_PIPELINE] Fallback thành công: Video ID {} đã sẵn sàng phát trực tiếp tại '{}'", video.getId(), playableUrl);
    }

    @RabbitListener(queues = "${app.rabbitmq.queues.video-transcode:video.transcode.queue}")
    @Transactional
    public void processVideoTranscode(VideoTranscodeMessage message) {
        if (message == null || message.getVideoId() == null)
            return;
        UUID videoId = message.getVideoId();

        Video video = videoRepository.findById(videoId).orElse(null);
        if (video == null)
            return;

        if (!isFfmpegAvailable()) {
            handleFallbackToRaw(video);
            return;
        }

        video.setStatus(VideoStatus.PROCESSING);
        videoRepository.save(video);

        Path localRawPath = Paths.get(video.getRawStorageUrl()); // Lấy đường dẫn mp4 tạm trên máy

        try {
            Path outputDir = Paths.get(uploadBaseDir, "hls", videoId.toString());
            Files.createDirectories(outputDir);
            String m3u8Path = outputDir.resolve("master.m3u8").toAbsolutePath().toString();
            String segmentPattern = outputDir.resolve("segment_%03d.ts").toAbsolutePath().toString();

            ProcessBuilder processBuilder = new ProcessBuilder(
                    ffmpegPath, "-y", "-i", localRawPath.toString(),
                    "-profile:v", "baseline", "-level", "3.0", "-start_number", "0",
                    "-hls_time", "6", "-hls_list_size", "0",
                    "-hls_segment_filename", segmentPattern, "-f", "hls", m3u8Path);
            processBuilder.redirectErrorStream(true);

            Process process;
            try {
                process = processBuilder.start();
            } catch (IOException ioEx) {
                log.warn("[VIDEO_PIPELINE] Không thể thực thi lệnh FFmpeg cho video ID {} ({}). Tự động chuyển sang phát file gốc.", videoId, ioEx.getMessage());
                FileSystemUtils.deleteRecursively(outputDir);
                handleFallbackToRaw(video);
                return;
            }

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
                    video.setRejectionReason(null);
                    videoRepository.save(video);

                    // 4. QUAN TRỌNG: Xóa sạch file trên server cục bộ để giải phóng dung lượng
                    FileSystemUtils.deleteRecursively(outputDir); // Xóa folder HLS local
                    Files.deleteIfExists(localRawPath); // Xóa file mp4 local
                    log.info(">>> Đã dọn dẹp ổ cứng (xóa file local) cho video: {}", videoId);

                } catch (Exception e) {
                    log.error(">>> [R2-UPLOAD] LỖI UPLOAD / DỌN DẸP: ", e);
                    handleFallbackToRaw(video);
                }

                try {
                    UUID recipientId = (video.getUploadedBy() != null) ? video.getUploadedBy().getId() : null;
                    notificationService.sendSystemNotification(
                            recipientId,
                            "Video đã xử lý xong",
                            "Video đã nén, đưa lên R2 và giải phóng dung lượng máy chủ.",
                            "SYSTEM_ALERT",
                            "/videos/" + videoId);
                } catch (Exception notifyEx) {
                    log.warn("[VIDEO_PIPELINE] Không thể gửi thông báo hoàn tất xử lý video {}: {}", videoId, notifyEx.getMessage());
                }

            } else {
                log.warn("[VIDEO_PIPELINE] FFmpeg trả về mã lỗi {} cho video ID {}. Tự động chuyển sang phát file gốc.", exitCode, videoId);
                FileSystemUtils.deleteRecursively(outputDir);
                handleFallbackToRaw(video);
            }
        } catch (Exception e) {
            log.warn("[VIDEO_PIPELINE] Gặp lỗi kỹ thuật khi transcode video ID {} ({}). Tự động chuyển sang phát file gốc thay vì từ chối.", videoId, e.getMessage());
            handleFallbackToRaw(video);
        }
    }
}
