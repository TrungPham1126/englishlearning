package com.englishlearning.video.consumer;

import com.englishlearning.auth.entity.User;
import com.englishlearning.notification.service.NotificationService;
import com.englishlearning.video.dto.VideoTranscodeMessage;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.service.R2StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("VideoTranscodeConsumer - Xử lý Transcode HLS FFmpeg & R2 Fallback")
class VideoTranscodeConsumerTest {

    @Mock
    private VideoRepository videoRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private R2StorageService r2StorageService;

    @InjectMocks
    private VideoTranscodeConsumer consumer;

    @TempDir
    Path tempDir;

    private final UUID videoId = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    private final UUID uploaderId = UUID.fromString("11111111-2222-3333-4444-555555555555");

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(consumer, "uploadBaseDir", tempDir.toString());
        ReflectionTestUtils.setField(consumer, "publicCloudUrl", "https://cdn.example.com");
        ReflectionTestUtils.setField(consumer, "ffmpegPath", "nonexistent-ffmpeg-binary");
        ReflectionTestUtils.setField(consumer, "hlsEnabled", true);
    }

    private Path createFakeFfmpegScript(int exitCode) throws IOException {
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        Path script;
        if (isWindows) {
            script = tempDir.resolve("fake-ffmpeg-" + exitCode + ".cmd");
            Files.writeString(script, "@echo off\r\necho ffmpeg version 6.0\r\nexit /b " + exitCode + "\r\n");
        } else {
            script = tempDir.resolve("fake-ffmpeg-" + exitCode + ".sh");
            Files.writeString(script, "#!/bin/sh\necho ffmpeg version 6.0\nexit " + exitCode + "\n");
            script.toFile().setExecutable(true);
        }
        return script;
    }

    @Test
    @DisplayName("isFfmpegAvailable trả về false khi hlsEnabled=false và true khi trỏ tới executable hợp lệ")
    void should_CheckFfmpegAvailabilityProperly() throws IOException {
        ReflectionTestUtils.setField(consumer, "hlsEnabled", false);
        assertThat(consumer.isFfmpegAvailable()).isFalse();

        ReflectionTestUtils.setField(consumer, "hlsEnabled", true);
        Path fakeOk = createFakeFfmpegScript(0);
        ReflectionTestUtils.setField(consumer, "ffmpegPath", fakeOk.toAbsolutePath().toString());
        assertThat(consumer.isFfmpegAvailable()).isTrue();
    }

    @Test
    @DisplayName("handleFallbackToRaw bỏ qua video null và upload file gốc lên R2 khi tồn tại file cục bộ & R2 thật")
    void should_UploadRawFileToR2OnFallback_when_LocalFileExistsAndCloudIsReal() throws IOException {
        consumer.handleFallbackToRaw(null);
        verifyNoInteractions(videoRepository, r2StorageService);

        Path rawFile = tempDir.resolve("lecture.mp4");
        Files.writeString(rawFile, "mp4-content");
        Video video = Video.builder()
                .id(videoId)
                .rawStorageUrl(rawFile.toAbsolutePath().toString())
                .rejectionReason("FFmpeg missing")
                .status(VideoStatus.REJECTED)
                .build();

        when(r2StorageService.uploadFile(eq("raw/" + videoId + "/lecture.mp4"), any(), eq("video/mp4")))
                .thenReturn("https://cdn.example.com/raw/" + videoId + "/lecture.mp4");

        consumer.handleFallbackToRaw(video);

        assertThat(video.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(video.getHlsPlaylistUrl()).isEqualTo("https://cdn.example.com/raw/" + videoId + "/lecture.mp4");
        assertThat(video.getRawStorageUrl()).isEqualTo("https://cdn.example.com/raw/" + videoId + "/lecture.mp4");
        assertThat(video.getRejectionReason()).isNull();
        verify(videoRepository).save(video);
    }

    @Test
    @DisplayName("handleFallbackToRaw chuyển sang endpoint /raw cục bộ khi R2 lỗi hoặc URL là localhost:8080")
    void should_FallbackToRelativeRawUrl_when_R2UploadFailsOrUrlWasLocalhost() throws IOException {
        Path rawFile = tempDir.resolve("broken.mp4");
        Files.writeString(rawFile, "mp4-content");
        Video video = Video.builder()
                .id(videoId)
                .rawStorageUrl(rawFile.toAbsolutePath().toString())
                .status(VideoStatus.PROCESSING)
                .build();

        when(r2StorageService.uploadFile(any(), any(), any()))
                .thenThrow(new RuntimeException("R2 unreachable"));

        consumer.handleFallbackToRaw(video);

        assertThat(video.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(video.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + videoId + "/raw");
        verify(videoRepository).save(video);

        Video localhostVideo = Video.builder()
                .id(videoId)
                .rawStorageUrl("http://localhost:8080/uploads/videos/v.mp4")
                .status(VideoStatus.DRAFT)
                .build();
        consumer.handleFallbackToRaw(localhostVideo);
        assertThat(localhostVideo.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(localhostVideo.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + videoId + "/raw");
    }

    @Test
    @DisplayName("processVideoTranscode bỏ qua message rỗng hoặc video không tồn tại trong DB")
    void should_IgnoreInvalidMessageOrMissingVideo() {
        consumer.processVideoTranscode(null);
        consumer.processVideoTranscode(new VideoTranscodeMessage());

        when(videoRepository.findById(videoId)).thenReturn(Optional.empty());
        consumer.processVideoTranscode(VideoTranscodeMessage.builder().videoId(videoId).build());

        verify(videoRepository, never()).save(any());
        verifyNoInteractions(r2StorageService, notificationService);
    }

    @Test
    @DisplayName("processVideoTranscode chuyển về raw fallback khi FFmpeg tắt (hlsEnabled=false)")
    void should_TriggerRawFallback_when_HlsDisabled() {
        ReflectionTestUtils.setField(consumer, "hlsEnabled", false);
        Video video = Video.builder()
                .id(videoId)
                .rawStorageUrl("https://cdn.example.com/raw/v1.mp4")
                .status(VideoStatus.DRAFT)
                .build();
        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));

        consumer.processVideoTranscode(VideoTranscodeMessage.builder().videoId(videoId).build());

        assertThat(video.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(video.getHlsPlaylistUrl()).isEqualTo("https://cdn.example.com/raw/v1.mp4");
        verify(videoRepository).save(video);
    }

    @Test
    @DisplayName("processVideoTranscode nén HLS thành công -> upload R2 -> PENDING_REVIEW -> xóa file local & gửi thông báo")
    void should_CompleteHlsTranscodeUploadToR2AndCleanLocalFiles_when_FfmpegExitsZero() throws IOException {
        Path fakeOk = createFakeFfmpegScript(0);
        ReflectionTestUtils.setField(consumer, "ffmpegPath", fakeOk.toAbsolutePath().toString());

        Path rawFile = tempDir.resolve("input.mp4");
        Files.writeString(rawFile, "raw-video-payload");
        User uploader = User.builder().id(uploaderId).email("teacher@example.com").password("h").build();
        Video video = Video.builder()
                .id(videoId)
                .rawStorageUrl(rawFile.toAbsolutePath().toString())
                .uploadedBy(uploader)
                .status(VideoStatus.DRAFT)
                .build();

        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));
        when(r2StorageService.uploadFile(eq("raw/" + videoId + "/input.mp4"), any(), eq("video/mp4")))
                .thenReturn("https://cdn.example.com/raw/" + videoId + "/input.mp4");

        consumer.processVideoTranscode(VideoTranscodeMessage.builder().videoId(videoId).build());

        assertThat(video.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(video.getHlsPlaylistUrl()).isEqualTo("https://cdn.example.com/hls/" + videoId + "/master.m3u8");
        assertThat(video.getRawStorageUrl()).isEqualTo("https://cdn.example.com/raw/" + videoId + "/input.mp4");
        assertThat(Files.exists(rawFile)).isFalse();
        assertThat(Files.exists(tempDir.resolve("hls").resolve(videoId.toString()))).isFalse();

        verify(r2StorageService).uploadHlsFolder(eq("hls/" + videoId), any());
        verify(notificationService).sendSystemNotification(
                eq(uploaderId), contains("xử lý xong"), any(), eq("SYSTEM_ALERT"), eq("/videos/" + videoId));
    }

    @Test
    @DisplayName("processVideoTranscode tạo master.m3u8 đa chất lượng (360p, 480p, 720p, 1080p) ở chế độ local")
    void should_GenerateMultiQualityMasterPlaylist_when_LocalHlsTranscodeSucceeds() throws IOException {
        Path fakeOk = createFakeFfmpegScript(0);
        ReflectionTestUtils.setField(consumer, "ffmpegPath", fakeOk.toAbsolutePath().toString());
        ReflectionTestUtils.setField(consumer, "publicCloudUrl", "http://localhost:8080/uploads/videos");

        Path rawFile = tempDir.resolve("lesson.mp4");
        Files.writeString(rawFile, "raw-video-payload");
        Video video = Video.builder()
                .id(videoId)
                .rawStorageUrl(rawFile.toAbsolutePath().toString())
                .status(VideoStatus.DRAFT)
                .build();

        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));

        consumer.processVideoTranscode(VideoTranscodeMessage.builder().videoId(videoId).build());

        Path masterPlaylist = tempDir.resolve("hls").resolve(videoId.toString()).resolve("master.m3u8");
        assertThat(Files.exists(masterPlaylist)).isTrue();
        String content = Files.readString(masterPlaylist);
        assertThat(content)
                .contains("#EXTM3U")
                .contains("stream_360p.m3u8")
                .contains("stream_480p.m3u8")
                .contains("stream_720p.m3u8")
                .contains("stream_1080p.m3u8")
                .contains("RESOLUTION=640x360")
                .contains("RESOLUTION=1280x720")
                .contains("RESOLUTION=1920x1080");
        assertThat(video.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + videoId + "/hls/master.m3u8");
        assertThat(video.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        verifyNoInteractions(r2StorageService);
    }

    @Test
    @DisplayName("processVideoTranscode fallback về raw PENDING_REVIEW khi R2 upload lỗi giữa chừng hoặc FFmpeg thoát mã khác 0")
    void should_FallbackToRaw_when_R2UploadThrowsOrFfmpegExitsNonZero() throws IOException {
        // Case 1: FFmpeg OK nhưng R2 upload lỗi
        Path fakeOk = createFakeFfmpegScript(0);
        ReflectionTestUtils.setField(consumer, "ffmpegPath", fakeOk.toAbsolutePath().toString());
        Path rawFile = tempDir.resolve("vid-r2-err.mp4");
        Files.writeString(rawFile, "bytes");

        Video v1 = Video.builder()
                .id(videoId)
                .rawStorageUrl(rawFile.toAbsolutePath().toString())
                .status(VideoStatus.DRAFT)
                .build();
        when(videoRepository.findById(videoId)).thenReturn(Optional.of(v1));
        doThrow(new RuntimeException("R2 write error")).when(r2StorageService).uploadHlsFolder(any(), any());
        when(r2StorageService.uploadFile(any(), any(), eq("video/mp4")))
                .thenReturn("https://cdn.example.com/raw/fallback.mp4");

        consumer.processVideoTranscode(VideoTranscodeMessage.builder().videoId(videoId).build());

        assertThat(v1.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(v1.getHlsPlaylistUrl()).isEqualTo("https://cdn.example.com/raw/fallback.mp4");
        verify(notificationService).sendSystemNotification(eq(null), any(), any(), eq("SYSTEM_ALERT"), any());

        // Case 2: Script giả lập ở Bước 1 check `-version` pass, nhưng cần test exit code != 0 riêng khi ffmpeg trả 1
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        Path conditionalFfmpeg;
        if (isWindows) {
            conditionalFfmpeg = tempDir.resolve("conditional-ffmpeg.cmd");
            Files.writeString(conditionalFfmpeg, "@echo off\r\nif \"%1\"==\"-version\" (exit /b 0) else (exit /b 1)\r\n");
        } else {
            conditionalFfmpeg = tempDir.resolve("conditional-ffmpeg.sh");
            Files.writeString(conditionalFfmpeg, "#!/bin/sh\nif [ \"$1\" = \"-version\" ]; then exit 0; else exit 1; fi\n");
            conditionalFfmpeg.toFile().setExecutable(true);
        }
        ReflectionTestUtils.setField(consumer, "ffmpegPath", conditionalFfmpeg.toAbsolutePath().toString());
        ReflectionTestUtils.setField(consumer, "publicCloudUrl", "https://dummy.r2.dev");

        Video v2 = Video.builder()
                .id(videoId)
                .rawStorageUrl(rawFile.toAbsolutePath().toString())
                .status(VideoStatus.DRAFT)
                .build();
        when(videoRepository.findById(videoId)).thenReturn(Optional.of(v2));

        consumer.processVideoTranscode(VideoTranscodeMessage.builder().videoId(videoId).build());

        assertThat(v2.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(v2.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + videoId + "/raw");
    }

    @Test
    @DisplayName("processVideoTranscode trích xuất Duration từ log FFmpeg và fallback an toàn khi thiếu file nguồn")
    void should_ParseFfmpegDurationAndHandleMissingRawFileSafely() throws IOException {
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        Path durationFfmpeg;
        if (isWindows) {
            durationFfmpeg = tempDir.resolve("duration-ffmpeg.cmd");
            Files.writeString(durationFfmpeg,
                    "@echo off\r\necho ffmpeg version 7.1\r\necho   Duration: 00:01:23.45, start: 0.000000\r\nexit /b 0\r\n");
        } else {
            durationFfmpeg = tempDir.resolve("duration-ffmpeg.sh");
            Files.writeString(durationFfmpeg,
                    "#!/bin/sh\necho 'ffmpeg version 7.1'\necho '  Duration: 00:01:23.45, start: 0.000000'\nexit 0\n");
            durationFfmpeg.toFile().setExecutable(true);
        }

        ReflectionTestUtils.setField(consumer, "ffmpegPath", durationFfmpeg.toAbsolutePath().toString());
        ReflectionTestUtils.setField(consumer, "publicCloudUrl", "http://127.0.0.1:8080/uploads/videos");

        Path rawFile = tempDir.resolve("timed.mp4");
        Files.writeString(rawFile, "raw-bytes");
        Video timedVideo = Video.builder()
                .id(videoId)
                .rawStorageUrl(rawFile.toAbsolutePath().toString())
                .status(VideoStatus.DRAFT)
                .build();
        when(videoRepository.findById(videoId)).thenReturn(Optional.of(timedVideo));

        consumer.processVideoTranscode(VideoTranscodeMessage.builder().videoId(videoId).build());

        assertThat(timedVideo.getDurationSeconds()).isEqualTo(83);
        assertThat(timedVideo.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(timedVideo.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + videoId + "/hls/master.m3u8");

        // File nguồn cục bộ không còn tồn tại -> chuyển sang fallback PENDING_REVIEW, không ném ngoại lệ
        UUID missingId = UUID.randomUUID();
        Video missingRawVideo = Video.builder()
                .id(missingId)
                .rawStorageUrl(tempDir.resolve("deleted.mp4").toString())
                .status(VideoStatus.DRAFT)
                .build();
        when(videoRepository.findById(missingId)).thenReturn(Optional.of(missingRawVideo));

        consumer.processVideoTranscode(VideoTranscodeMessage.builder().videoId(missingId).build());

        assertThat(missingRawVideo.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(missingRawVideo.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + missingId + "/raw");
    }

    @Test
    @DisplayName("Tra cứu fallback uploaderId khi lazy proxy lỗi, làm tròn thời lượng < 1s lên 1s và giữ nguyên trạng thái APPROVED khi fallback")
    void should_FallbackUploaderLookupRoundSubSecondDurationAndPreserveApprovedStatus() throws IOException {
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        Path subSecFfmpeg;
        if (isWindows) {
            subSecFfmpeg = tempDir.resolve("subsec-ffmpeg.cmd");
            Files.writeString(subSecFfmpeg,
                    "@echo off\r\necho ffmpeg version 7.1\r\necho   Duration: 00:00:00.50, start: 0.000000\r\nexit /b 0\r\n");
        } else {
            subSecFfmpeg = tempDir.resolve("subsec-ffmpeg.sh");
            Files.writeString(subSecFfmpeg,
                    "#!/bin/sh\necho 'ffmpeg version 7.1'\necho '  Duration: 00:00:00.50, start: 0.000000'\nexit 0\n");
            subSecFfmpeg.toFile().setExecutable(true);
        }
        ReflectionTestUtils.setField(consumer, "ffmpegPath", subSecFfmpeg.toAbsolutePath().toString());
        ReflectionTestUtils.setField(consumer, "publicCloudUrl", "http://localhost:8080/uploads/videos");

        Path rawFile = tempDir.resolve("short.mp4");
        Files.writeString(rawFile, "raw-bytes");

        User brokenProxy = mock(User.class);
        when(brokenProxy.getId()).thenThrow(new RuntimeException("LazyInitializationException"));

        Video video = Video.builder()
                .id(videoId)
                .rawStorageUrl(rawFile.toAbsolutePath().toString())
                .uploadedBy(brokenProxy)
                .status(VideoStatus.DRAFT)
                .build();
        when(videoRepository.findById(videoId)).thenReturn(Optional.of(video));
        when(videoRepository.findUploadedById(videoId)).thenReturn(Optional.of(uploaderId));
        doThrow(new RuntimeException("Notification service offline"))
                .when(notificationService).sendSystemNotification(eq(uploaderId), any(), any(), any(), any());

        consumer.processVideoTranscode(VideoTranscodeMessage.builder().videoId(videoId).build());

        assertThat(video.getDurationSeconds()).isEqualTo(1);
        assertThat(video.getStatus()).isEqualTo(VideoStatus.PENDING_REVIEW);
        verify(videoRepository).findUploadedById(videoId);
        verify(notificationService).sendSystemNotification(
                eq(uploaderId), contains("xử lý xong"), any(), eq("SYSTEM_ALERT"), eq("/videos/" + videoId));

        // handleFallbackToRaw giữ nguyên APPROVED nếu video đã được duyệt trước đó
        Video approvedVideo = Video.builder()
                .id(videoId)
                .rawStorageUrl("http://localhost:8080/uploads/v.mp4")
                .status(VideoStatus.APPROVED)
                .build();
        consumer.handleFallbackToRaw(approvedVideo);
        assertThat(approvedVideo.getStatus()).isEqualTo(VideoStatus.APPROVED);
        assertThat(approvedVideo.getHlsPlaylistUrl()).isEqualTo("/api/v1/videos/" + videoId + "/raw");
    }
}
