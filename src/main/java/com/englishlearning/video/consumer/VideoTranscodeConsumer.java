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
import org.springframework.util.FileSystemUtils;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class VideoTranscodeConsumer {

    private static final Pattern FFMPEG_DURATION_PATTERN =
            Pattern.compile("Duration:\\s*(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d+))?");
    private static final int MAX_FFMPEG_LOG_LINES = 30;

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

    private record HlsVariant(
            String label,
            int height,
            String resolution,
            int bandwidth,
            String videoBitrate,
            String maxRate,
            String bufSize,
            String audioBitrate) {
    }

    private static final List<HlsVariant> HLS_VARIANTS = List.of(
            new HlsVariant("360p", 360, "640x360", 800000, "800k", "856k", "1200k", "96k"),
            new HlsVariant("480p", 480, "854x480", 1400000, "1400k", "1498k", "2100k", "128k"),
            new HlsVariant("720p", 720, "1280x720", 2800000, "2800k", "2996k", "4200k", "128k"),
            new HlsVariant("1080p", 1080, "1920x1080", 5000000, "5000k", "5350k", "7500k", "192k"));

    private List<String> buildMultiQualityFfmpegCommand(Path localRawPath, Path outputDir) {
        List<String> command = new ArrayList<>();
        command.add(ffmpegPath);
        command.add("-y");
        command.add("-i");
        command.add(localRawPath.toString());

        for (HlsVariant variant : HLS_VARIANTS) {
            String playlistPath = outputDir.resolve("stream_" + variant.label() + ".m3u8").toAbsolutePath().toString();
            String segmentPattern = outputDir.resolve("stream_" + variant.label() + "_%03d.ts").toAbsolutePath().toString();
            command.addAll(List.of(
                    "-map", "0:v:0",
                    "-map", "0:a:0?",
                    "-vf", "scale=-2:" + variant.height(),
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-pix_fmt", "yuv420p",
                    "-g", "48",
                    "-sc_threshold", "0",
                    "-b:v", variant.videoBitrate(),
                    "-maxrate", variant.maxRate(),
                    "-bufsize", variant.bufSize(),
                    "-c:a", "aac",
                    "-b:a", variant.audioBitrate(),
                    "-start_number", "0",
                    "-hls_time", "4",
                    "-hls_list_size", "0",
                    "-hls_segment_filename", segmentPattern,
                    "-f", "hls",
                    playlistPath));
        }
        return command;
    }

    private void writeMasterPlaylist(Path outputDir) throws IOException {
        StringBuilder master = new StringBuilder("#EXTM3U\n#EXT-X-VERSION:3\n");
        for (HlsVariant variant : HLS_VARIANTS) {
            master.append("#EXT-X-STREAM-INF:BANDWIDTH=")
                    .append(variant.bandwidth())
                    .append(",RESOLUTION=")
                    .append(variant.resolution())
                    .append(",NAME=\"")
                    .append(variant.label())
                    .append("\"\n")
                    .append("stream_")
                    .append(variant.label())
                    .append(".m3u8\n");
        }
        Files.writeString(outputDir.resolve("master.m3u8"), master.toString(), StandardCharsets.UTF_8);
    }

    private String resolveFfmpegExecutable() {
        List<String> candidates = new ArrayList<>();
        if (ffmpegPath != null && !ffmpegPath.isBlank()) {
            candidates.add(ffmpegPath.trim());
        }
        // Thử các binary tiêu chuẩn cross-platform (Linux, Mac, Windows)
        candidates.add("ffmpeg");
        candidates.add("ffmpeg.exe");
        candidates.add("/usr/bin/ffmpeg");
        candidates.add("/usr/local/bin/ffmpeg");
        candidates.add("/opt/homebrew/bin/ffmpeg");

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
                playableUrl = "/api/v1/videos/" + video.getId() + "/raw";

                if (Files.exists(localRawPath)) {
                    String rawPrefix = "raw/" + video.getId() + "/" + fileName;
                    try {
                        if (!isLocalOrDummyCloudUrl()) {
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

        if (playableUrl == null || playableUrl.isBlank()
                || playableUrl.contains("localhost:8080")
                || playableUrl.contains("127.0.0.1:8080")) {
            playableUrl = "/api/v1/videos/" + video.getId() + "/raw";
        }

        if (video.getStatus() != VideoStatus.APPROVED) {
            video.setStatus(VideoStatus.PENDING_REVIEW);
        }
        video.setHlsPlaylistUrl(playableUrl);
        video.setRejectionReason(null);
        videoRepository.save(video);
        log.info("[VIDEO_PIPELINE] Fallback thành công: Video ID {} (trạng thái {}) sẵn sàng chờ phát tại '{}'",
                video.getId(), video.getStatus(), playableUrl);
    }

    @RabbitListener(queues = "${app.rabbitmq.queues.video-transcode:video.transcode.queue}")
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

        Path localRawPath = resolveExistingLocalRawPath(video.getRawStorageUrl());
        if (localRawPath == null) {
            log.warn("[VIDEO_PIPELINE] Không tìm thấy file nguồn cục bộ '{}' cho video ID {}. Chuyển sang fallback.",
                    video.getRawStorageUrl(), videoId);
            handleFallbackToRaw(video);
            return;
        }

        video.setStatus(VideoStatus.PROCESSING);
        videoRepository.save(video);

        try {
            Path outputDir = Paths.get(uploadBaseDir, "hls", videoId.toString());
            Files.createDirectories(outputDir);

            ProcessBuilder processBuilder = new ProcessBuilder(buildMultiQualityFfmpegCommand(localRawPath, outputDir));
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

            Integer parsedDurationSeconds = null;
            Deque<String> recentFfmpegLines = new ArrayDeque<>(MAX_FFMPEG_LOG_LINES);
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (recentFfmpegLines.size() >= MAX_FFMPEG_LOG_LINES) {
                        recentFfmpegLines.removeFirst();
                    }
                    recentFfmpegLines.addLast(line);
                    if (parsedDurationSeconds == null) {
                        parsedDurationSeconds = parseDurationSeconds(line);
                    }
                }
            }

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                if (parsedDurationSeconds != null && parsedDurationSeconds > 0
                        && (video.getDurationSeconds() == null || video.getDurationSeconds() <= 0)) {
                    video.setDurationSeconds(parsedDurationSeconds);
                }

                writeMasterPlaylist(outputDir);
                if (isLocalOrDummyCloudUrl()) {
                    String localPlaylistUrl = "/api/v1/videos/" + videoId + "/hls/master.m3u8";
                    video.setStatus(VideoStatus.PENDING_REVIEW);
                    video.setHlsPlaylistUrl(localPlaylistUrl);
                    video.setRejectionReason(null);
                    videoRepository.save(video);
                    log.info("[VIDEO_PIPELINE] FFmpeg HLS hoàn tất tại máy chủ cục bộ ({}), giữ file local thay vì đẩy R2 dummy.", localPlaylistUrl);
                } else {
                    log.info("FFmpeg nén xong! Đang đẩy toàn bộ lên mây...");

                    String hlsPrefix = "hls/" + videoId;
                    String rawPrefix = "raw/" + videoId + "/" + localRawPath.getFileName().toString();

                    try {
                        // 1. Upload HLS lên mây (dừng ngay & dọn sạch nếu lỗi)
                        r2StorageService.uploadHlsFolder(hlsPrefix, outputDir);

                        // 2. Upload file gốc mp4 lên mây để lưu trữ/backup
                        String cloudRawUrl = r2StorageService.uploadFile(rawPrefix, localRawPath.toFile(), "video/mp4");

                        // 3. Lưu URL trên Cloudflare R2 và chuyển sang PENDING_REVIEW chờ admin duyệt
                        String playlistUrl = normalizePublicBaseUrl() + hlsPrefix + "/master.m3u8";
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
                }

                try {
                    UUID recipientId = resolveUploaderIdSafely(video);
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
                String tailOutput = String.join(" | ", recentFfmpegLines);
                log.warn("[VIDEO_PIPELINE] FFmpeg trả về mã lỗi {} cho video ID {}. Log cuối: {}. Tự động chuyển sang phát file gốc.",
                        exitCode, videoId, tailOutput);
                FileSystemUtils.deleteRecursively(outputDir);
                handleFallbackToRaw(video);
            }
        } catch (Exception e) {
            log.warn("[VIDEO_PIPELINE] Gặp lỗi kỹ thuật khi transcode video ID {} ({}). Tự động chuyển sang phát file gốc thay vì từ chối.", videoId, e.getMessage());
            handleFallbackToRaw(video);
        }
    }

    private boolean isLocalOrDummyCloudUrl() {
        return publicCloudUrl == null
                || publicCloudUrl.isBlank()
                || publicCloudUrl.contains("dummy")
                || publicCloudUrl.contains("localhost:8080")
                || publicCloudUrl.contains("127.0.0.1:8080");
    }

    private String normalizePublicBaseUrl() {
        String trimmed = publicCloudUrl.trim();
        return trimmed.endsWith("/") ? trimmed : trimmed + "/";
    }

    private Path resolveExistingLocalRawPath(String rawStorageUrl) {
        if (rawStorageUrl == null || rawStorageUrl.isBlank()
                || rawStorageUrl.startsWith("http://") || rawStorageUrl.startsWith("https://")) {
            return null;
        }
        try {
            Path path = Paths.get(rawStorageUrl);
            if (Files.exists(path) && Files.isRegularFile(path)) {
                return path;
            }
        } catch (InvalidPathException ignored) {
        }
        return null;
    }

    private Integer parseDurationSeconds(String line) {
        if (line == null) {
            return null;
        }
        Matcher matcher = FFMPEG_DURATION_PATTERN.matcher(line);
        if (!matcher.find()) {
            return null;
        }
        int hours = Integer.parseInt(matcher.group(1));
        int minutes = Integer.parseInt(matcher.group(2));
        int seconds = Integer.parseInt(matcher.group(3));
        int total = hours * 3600 + minutes * 60 + seconds;
        if (total == 0 && matcher.group(4) != null && !matcher.group(4).isEmpty()) {
            char firstFractionDigit = matcher.group(4).charAt(0);
            if (Character.isDigit(firstFractionDigit) && firstFractionDigit > '0') {
                return 1;
            }
        }
        return total;
    }

    private UUID resolveUploaderIdSafely(Video video) {
        if (video == null) {
            return null;
        }
        try {
            if (video.getUploadedBy() != null) {
                return video.getUploadedBy().getId();
            }
        } catch (Exception ignored) {
            // Bỏ qua nếu Hibernate lazy proxy chưa được khởi tạo ngoài transaction
        }
        if (video.getId() != null) {
            return videoRepository.findUploadedById(video.getId()).orElse(null);
        }
        return null;
    }
}
