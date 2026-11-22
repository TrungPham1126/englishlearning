package com.englishlearning.video.controller;

import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.video.dto.R2ObjectStream;
import com.englishlearning.video.dto.VideoUploadResponse;
import com.englishlearning.video.dto.WatchProgressRequest;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.service.VideoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = VideoController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("VideoController - RBAC, Streaming HTTP Range & Bảo mật HLS")
class VideoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private VideoController videoController;

    @MockBean
    private VideoService videoService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @TempDir
    Path tempDir;

    private final UUID teacherId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID studentId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID lessonId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID videoId = UUID.fromString("44444444-4444-4444-4444-444444444444");

    @BeforeEach
    void setUp() throws Exception {
        ReflectionTestUtils.setField(videoController, "uploadBaseDir", tempDir.toString());
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User user = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@englishlearning.com")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(user);
    }

    @Test
    @DisplayName("Upload video hỗ trợ multipart field 'file'/'video', từ chối STUDENT/ẩn danh & validate thiếu tham số")
    void uploadVideo_enforcesRbacAndValidatesInputs() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "unit1.mp4", "video/mp4", "binary".getBytes());
        MockMultipartFile altFile = new MockMultipartFile("video", "unit2.mp4", "video/mp4", "binary2".getBytes());
        VideoUploadResponse resp = VideoUploadResponse.builder()
                .videoId(videoId)
                .status(VideoStatus.PROCESSING)
                .originalFileName("unit1.mp4")
                .message("Upload thành công")
                .build();

        when(videoService.uploadOriginalVideo(eq(lessonId), any(), eq(teacherId))).thenReturn(resp);

        // Chưa đăng nhập -> 401
        mockMvc.perform(multipart("/api/v1/videos").file(file).param("lessonId", lessonId.toString()))
                .andExpect(status().isUnauthorized());

        // Học sinh -> 403
        mockMvc.perform(multipart("/api/v1/videos").file(file).param("lessonId", lessonId.toString())
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isForbidden());

        // Thiếu file -> 400
        mockMvc.perform(multipart("/api/v1/videos").param("lessonId", lessonId.toString())
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("video")));

        // Thiếu lessonId -> 400
        mockMvc.perform(multipart("/api/v1/videos").file(altFile)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("lessonId")));

        // Giảng viên upload hợp lệ -> 200
        mockMvc.perform(multipart("/api/v1/videos").file(file).param("lessonId", lessonId.toString())
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.videoId").value(videoId.toString()))
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));
    }

    @Test
    @DisplayName("GET /{id}/raw phục vụ video MP4 với HTTP 206 Partial Content hỗ trợ header Range và 404 khi thiếu file")
    void serveRawVideo_supportsByteRangeStreamingAnd404() throws Exception {
        Path rawFile = tempDir.resolve("lecture.mp4");
        Files.write(rawFile, "0123456789ABCDEF".getBytes());
        Video video = Video.builder()
                .id(videoId)
                .originalFileName("lecture.mp4")
                .rawStorageUrl(rawFile.toAbsolutePath().toString())
                .build();

        when(videoService.getVideoById(videoId)).thenReturn(video);

        // Request có Range header (bytes=0-4)
        mockMvc.perform(get("/api/v1/videos/{id}/raw", videoId)
                        .header(HttpHeaders.RANGE, "bytes=0-4"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=86400"))
                .andExpect(content().contentType("video/mp4"))
                .andExpect(content().string("01234"));

        // Request không có Range header -> vẫn trả 206
        mockMvc.perform(get("/api/v1/videos/{id}/raw", videoId))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=86400"))
                .andExpect(content().string("0123456789ABCDEF"));

        // File cục bộ không còn nhưng rawStorageUrl là URL R2 -> 302 redirect
        when(videoService.getVideoById(videoId))
                .thenReturn(Video.builder().id(videoId).rawStorageUrl("https://cdn.example.com/raw/lecture.mp4").build());
        mockMvc.perform(get("/api/v1/videos/{id}/raw", videoId))
                .andExpect(status().isFound())
                .andExpect(header().string(HttpHeaders.LOCATION, "https://cdn.example.com/raw/lecture.mp4"));

        // File vật lý không tồn tại -> 404
        when(videoService.getVideoById(videoId))
                .thenReturn(Video.builder().id(videoId).rawStorageUrl(tempDir.resolve("missing.mp4").toString()).build());
        mockMvc.perform(get("/api/v1/videos/{id}/raw", videoId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /{id}/hls/{fileName} trả đúng Content-Type m3u8/ts và chặn path traversal")
    void serveHlsFile_servesPlaylistAndChunksAndBlocksTraversal() throws Exception {
        Path hlsDir = tempDir.resolve("hls").resolve(videoId.toString());
        Files.createDirectories(hlsDir);
        Files.writeString(hlsDir.resolve("master.m3u8"), "#EXTM3U\n#EXT-X-VERSION:3");
        Files.writeString(hlsDir.resolve("segment_000.ts"), "ts-chunk");

        mockMvc.perform(get("/api/v1/videos/{id}/hls/master.m3u8", videoId))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=60"))
                .andExpect(content().contentType("application/vnd.apple.mpegurl"))
                .andExpect(content().string(containsString("#EXTM3U")));

        mockMvc.perform(get("/api/v1/videos/{id}/hls/segment_000.ts", videoId))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=86400"))
                .andExpect(content().contentType("video/MP2T"));

        mockMvc.perform(get("/api/v1/videos/{id}/hls/notfound.m3u8", videoId))
                .andExpect(status().isNotFound());

        // Bỏ qua hoặc chặn tham số uploadDir giả mạo / traversal trong tên tệp
        mockMvc.perform(get("/api/v1/videos/{id}/hls/..master.m3u8", videoId))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Tiến độ xem video (POST/GET progress) chỉ cho STUDENT, chi tiết video trả 404 khi không tồn tại")
    void progressAndDetailEndpoints_enforcedProperly() throws Exception {
        WatchProgressRequest req = new WatchProgressRequest();
        req.setWatchedSeconds(60);
        req.setCompleted(false);

        CustomUserDetails student = userWithRole(studentId, RoleName.ROLE_STUDENT);
        CustomUserDetails teacher = userWithRole(teacherId, RoleName.ROLE_TEACHER);

        // POST progress: Teacher bị 403, Student thành công 200
        mockMvc.perform(post("/api/v1/videos/{id}/progress", videoId)
                        .with(user(teacher))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/videos/{id}/progress", videoId)
                        .with(user(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
        verify(videoService).updateWatchProgress(eq(studentId), eq(videoId), any(WatchProgressRequest.class));

        // GET progress
        when(videoService.getWatchProgress(studentId, videoId))
                .thenReturn(VideoWatchHistory.builder().watchedSeconds(60).completionPercentage(60.0f).isCompleted(false).build());
        mockMvc.perform(get("/api/v1/videos/{id}/progress", videoId).with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.watchedSeconds").value(60));

        // GET /{id} 404 & GET /lesson/{lessonId} null
        when(videoService.getVideoById(videoId)).thenThrow(new ResourceNotFoundException("Not found"));
        mockMvc.perform(get("/api/v1/videos/{id}", videoId).with(user(student)))
                .andExpect(status().isNotFound());

        when(videoService.getVideoByLessonId(lessonId)).thenReturn(null);
        mockMvc.perform(get("/api/v1/videos/lesson/{lessonId}", lessonId).with(user(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Bài học chưa có video"));
    }

    @Test
    @DisplayName("Review, Delete và lọc danh sách video theo trạng thái cho phép ADMIN/TEACHER, chặn STUDENT")
    void moderationEndpoints_allowAdminTeacherAndDenyStudent() throws Exception {
        CustomUserDetails student = userWithRole(studentId, RoleName.ROLE_STUDENT);
        CustomUserDetails teacher = userWithRole(teacherId, RoleName.ROLE_TEACHER);

        Video reviewed = Video.builder().id(videoId).status(VideoStatus.APPROVED).originalFileName("v.mp4").build();
        when(videoService.reviewVideo(videoId, teacherId, true, null)).thenReturn(reviewed);
        when(videoService.getVideosByStatus(VideoStatus.PENDING_REVIEW)).thenReturn(List.of(reviewed));

        mockMvc.perform(patch("/api/v1/videos/{id}/review", videoId).param("approved", "true")
                        .with(user(student)))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/videos/{id}/review", videoId).param("approved", "true")
                        .with(user(teacher)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        mockMvc.perform(get("/api/v1/videos").param("status", "PENDING_REVIEW").with(user(teacher)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(videoId.toString()));

        mockMvc.perform(delete("/api/v1/videos/{id}", videoId).with(user(teacher)))
                .andExpect(status().isOk());
        verify(videoService).deleteVideo(videoId);
    }

    @Test
    @DisplayName("GET /api/v1/videos/my-uploads cho phép TEACHER lọc theo trạng thái, chặn STUDENT (403) và anonymous (401)")
    void getMyUploadedVideos_enforcesRbacAndFiltersByStatus() throws Exception {
        CustomUserDetails teacher = userWithRole(teacherId, RoleName.ROLE_TEACHER);
        CustomUserDetails student = userWithRole(studentId, RoleName.ROLE_STUDENT);

        Video pendingVideo = Video.builder()
                .id(videoId)
                .status(VideoStatus.PENDING_REVIEW)
                .originalFileName("pending.mp4")
                .build();
        Video rejectedVideo = Video.builder()
                .id(UUID.randomUUID())
                .status(VideoStatus.REJECTED)
                .rejectionReason("Âm thanh nhỏ")
                .originalFileName("rejected.mp4")
                .build();

        when(videoService.getVideosByUploader(teacherId, null)).thenReturn(List.of(pendingVideo, rejectedVideo));
        when(videoService.getVideosByUploader(teacherId, VideoStatus.REJECTED)).thenReturn(List.of(rejectedVideo));

        mockMvc.perform(get("/api/v1/videos/my-uploads").with(user(teacher)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(videoId.toString()))
                .andExpect(jsonPath("$.data[1].status").value("REJECTED"));

        mockMvc.perform(get("/api/v1/videos/my-uploads")
                        .param("status", "REJECTED")
                        .with(user(teacher)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].rejectionReason").value("Âm thanh nhỏ"));

        mockMvc.perform(get("/api/v1/videos/my-uploads").with(user(student)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/videos/my-uploads"))
                .andExpect(status().isUnauthorized());

        verify(videoService).getVideosByUploader(teacherId, null);
        verify(videoService).getVideosByUploader(teacherId, VideoStatus.REJECTED);
    }

    @Test
    @DisplayName("GET/HEAD /{id}/hls/{fileName} proxy stream từ R2 khi vắng file local và hỗ trợ Range 206")
    void serveHlsFile_proxiesFromR2WhenLocalMissing_supportsRangeHeadAnd404() throws Exception {
        String playlist = "#EXTM3U\n#EXT-X-VERSION:3\nstream_360p.m3u8\n";
        when(videoService.openHlsStream(videoId, "master.m3u8", null, false))
                .thenReturn(Optional.of(new R2ObjectStream(
                        new ByteArrayInputStream(playlist.getBytes(StandardCharsets.UTF_8)),
                        playlist.length(),
                        playlist.length(),
                        null,
                        "application/vnd.apple.mpegurl",
                        false,
                        false)));

        mockMvc.perform(get("/api/v1/videos/{id}/hls/master.m3u8", videoId))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=60"))
                .andExpect(content().contentType("application/vnd.apple.mpegurl"))
                .andExpect(content().string(containsString("stream_360p.m3u8")));

        when(videoService.openHlsStream(videoId, "stream_360p_000.ts", "bytes=0-3", false))
                .thenReturn(Optional.of(new R2ObjectStream(
                        new ByteArrayInputStream("abcd".getBytes(StandardCharsets.UTF_8)),
                        4L,
                        10L,
                        "bytes 0-3/10",
                        "video/MP2T",
                        true,
                        false)));

        mockMvc.perform(get("/api/v1/videos/{id}/hls/stream_360p_000.ts", videoId)
                        .header(HttpHeaders.RANGE, "bytes=0-3"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 0-3/10"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "public, max-age=86400"))
                .andExpect(content().contentType("video/MP2T"))
                .andExpect(content().string("abcd"));

        when(videoService.openHlsStream(videoId, "stream_360p_000.ts", null, true))
                .thenReturn(Optional.of(new R2ObjectStream(null, 1024L, 1024L, null, "video/MP2T", false, false)));

        mockMvc.perform(head("/api/v1/videos/{id}/hls/stream_360p_000.ts", videoId)
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, containsString("Content-Range")))
                .andExpect(header().string(HttpHeaders.CONTENT_LENGTH, "1024"));

        when(videoService.openRawStream(
                org.mockito.ArgumentMatchers.argThat(v -> v != null && videoId.equals(v.getId())),
                org.mockito.ArgumentMatchers.isNull(),
                eq(true)))
                .thenReturn(Optional.of(new R2ObjectStream(null, 2048L, 2048L, null, "video/mp4", false, false)));
        when(videoService.getVideoById(videoId))
                .thenReturn(Video.builder().id(videoId).rawStorageUrl("https://pub-r2.example.dev/raw/" + videoId + "/lecture.mp4").build());

        mockMvc.perform(head("/api/v1/videos/{id}/raw", videoId)
                        .header(HttpHeaders.ORIGIN, "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"))
                .andExpect(header().string(HttpHeaders.CONTENT_LENGTH, "2048"));

        when(videoService.openHlsStream(videoId, "missing.ts", null, false)).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/v1/videos/{id}/hls/missing.ts", videoId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /{id}/raw proxy stream R2 cho MP4 đã đẩy lên mây với HTTP Range 206 và 416")
    void serveRawVideo_proxiesManagedR2StreamWithRangeAnd416() throws Exception {
        Video r2Video = Video.builder()
                .id(videoId)
                .rawStorageUrl("https://pub-r2.example.dev/raw/" + videoId + "/lecture.mp4")
                .build();
        when(videoService.getVideoById(videoId)).thenReturn(r2Video);
        when(videoService.openRawStream(r2Video, "bytes=0-3", false))
                .thenReturn(Optional.of(new R2ObjectStream(
                        new ByteArrayInputStream("1234".getBytes(StandardCharsets.UTF_8)),
                        4L,
                        10L,
                        "bytes 0-3/10",
                        "video/mp4",
                        true,
                        false)));

        mockMvc.perform(get("/api/v1/videos/{id}/raw", videoId)
                        .header(HttpHeaders.RANGE, "bytes=0-3"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 0-3/10"))
                .andExpect(content().contentType("video/mp4"))
                .andExpect(content().string("1234"));

        when(videoService.openRawStream(r2Video, "bytes=999-1000", false))
                .thenReturn(Optional.of(R2ObjectStream.notSatisfiable(10L, "video/mp4")));

        mockMvc.perform(get("/api/v1/videos/{id}/raw", videoId)
                        .header(HttpHeaders.RANGE, "bytes=999-1000"))
                .andExpect(status().isRequestedRangeNotSatisfiable())
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes */10"));
    }

    @Test
    @DisplayName("Streaming file local (raw & HLS): hỗ trợ HEAD, fallback thư mục raw, Range 206 và trả 416 khi vượt kích thước/file rỗng")
    void serveRawAndHlsLocalFiles_handlesHeadFallbackDirAndRange416() throws Exception {
        // 1. File đặt trong uploadBaseDir/raw/ vẫn tìm thấy khi rawStorageUrl trỏ sang thư mục cũ khác
        Path rawSubDir = tempDir.resolve("raw");
        Files.createDirectories(rawSubDir);
        Path movedRaw = rawSubDir.resolve("moved.mp4");
        Files.write(movedRaw, "0123456789".getBytes(StandardCharsets.UTF_8));

        Video movedVideo = Video.builder()
                .id(videoId)
                .rawStorageUrl("/old/missing/path/moved.mp4")
                .build();
        when(videoService.getVideoById(videoId)).thenReturn(movedVideo);

        mockMvc.perform(head("/api/v1/videos/{id}/raw", videoId))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.CONTENT_LENGTH, "10"));

        mockMvc.perform(get("/api/v1/videos/{id}/raw", videoId)
                        .header(HttpHeaders.RANGE, "bytes=50-60"))
                .andExpect(status().isRequestedRangeNotSatisfiable())
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes */10"));

        // File 0 byte -> 416
        Path emptyRaw = rawSubDir.resolve("empty.mp4");
        Files.write(emptyRaw, new byte[0]);
        when(videoService.getVideoById(videoId))
                .thenReturn(Video.builder().id(videoId).rawStorageUrl(emptyRaw.toString()).build());
        mockMvc.perform(get("/api/v1/videos/{id}/raw", videoId)
                        .header(HttpHeaders.RANGE, "bytes=0-1"))
                .andExpect(status().isRequestedRangeNotSatisfiable())
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes */0"));

        // 2. Local HLS file với Range hợp lệ (206), HEAD và Range vượt giới hạn (416)
        Path hlsDir = tempDir.resolve("hls").resolve(videoId.toString());
        Files.createDirectories(hlsDir);
        Files.writeString(hlsDir.resolve("stream_360p_000.ts"), "0123456789");

        mockMvc.perform(get("/api/v1/videos/{id}/hls/stream_360p_000.ts", videoId)
                        .header(HttpHeaders.RANGE, "bytes=2-5"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 2-5/10"))
                .andExpect(content().string("2345"));

        mockMvc.perform(head("/api/v1/videos/{id}/hls/stream_360p_000.ts", videoId)
                        .header(HttpHeaders.RANGE, "bytes=0-3"))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.CONTENT_LENGTH, "4"));

        mockMvc.perform(get("/api/v1/videos/{id}/hls/stream_360p_000.ts", videoId)
                        .header(HttpHeaders.RANGE, "bytes=100-200"))
                .andExpect(status().isRequestedRangeNotSatisfiable())
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes */10"));
    }

    @Test
    @DisplayName("PATCH /{id}/review từ chối kèm lý do bởi ADMIN & GET /lesson/{lessonId} trả về video khi tồn tại")
    void reviewRejectWithReasonAndGetVideoByLesson_returnsExpectedPayload() throws Exception {
        UUID adminId = UUID.randomUUID();
        CustomUserDetails admin = userWithRole(adminId, RoleName.ROLE_ADMIN);
        Video rejected = Video.builder()
                .id(videoId)
                .status(VideoStatus.REJECTED)
                .rejectionReason("Hình ảnh bị mờ")
                .build();
        when(videoService.reviewVideo(videoId, adminId, false, "Hình ảnh bị mờ")).thenReturn(rejected);

        mockMvc.perform(patch("/api/v1/videos/{id}/review", videoId)
                        .param("approved", "false")
                        .param("reason", "Hình ảnh bị mờ")
                        .with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.rejectionReason").value("Hình ảnh bị mờ"));

        Video lessonVideo = Video.builder().id(videoId).originalFileName("lesson1.mp4").build();
        when(videoService.getVideoByLessonId(lessonId)).thenReturn(lessonVideo);

        mockMvc.perform(get("/api/v1/videos/lesson/{lessonId}", lessonId).with(user(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(videoId.toString()))
                .andExpect(jsonPath("$.data.originalFileName").value("lesson1.mp4"));
    }
}
