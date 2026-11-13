package com.englishlearning.video.service.impl;

import com.englishlearning.video.dto.R2BucketSnapshot;
import com.englishlearning.video.service.R2UsageTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("R2StorageServiceImpl - Upload HLS/File, Xóa theo key/prefix và Inspect Snapshot R2")
class R2StorageServiceImplTest {

    @Mock
    private S3Client s3Client;

    private R2UsageTracker r2UsageTracker;
    private R2StorageServiceImpl service;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        r2UsageTracker = new R2UsageTracker();
        service = new R2StorageServiceImpl(s3Client);
        ReflectionTestUtils.setField(service, "r2UsageTracker", r2UsageTracker);
        ReflectionTestUtils.setField(service, "bucketName", "englishlearning-media");
        ReflectionTestUtils.setField(service, "publicUrl", "https://cdn.example.com");
        ReflectionTestUtils.setField(service, "endpoint", "https://acct.r2.cloudflarestorage.com");
    }

    @Test
    @DisplayName("uploadFile đẩy file lên S3Client, tăng PutOps và trả về URL công khai")
    void should_UploadSingleFileAndRecordPutOp() throws IOException {
        Path rawFile = tempDir.resolve("sample.mp4");
        Files.writeString(rawFile, "video-bytes");
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());

        String url = service.uploadFile("raw/v1/sample.mp4", rawFile.toFile(), "video/mp4");

        assertThat(url).isEqualTo("https://cdn.example.com/raw/v1/sample.mp4");
        assertThat(r2UsageTracker.getPutOps()).isEqualTo(1L);

        ArgumentCaptor<PutObjectRequest> captor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(captor.capture(), any(RequestBody.class));
        assertThat(captor.getValue().bucket()).isEqualTo("englishlearning-media");
        assertThat(captor.getValue().key()).isEqualTo("raw/v1/sample.mp4");
        assertThat(captor.getValue().contentType()).isEqualTo("video/mp4");
    }

    @Test
    @DisplayName("uploadFile vẫn hoạt động bình thường khi r2UsageTracker không được inject")
    void should_UploadFileSuccessfully_when_UsageTrackerIsNull() throws IOException {
        ReflectionTestUtils.setField(service, "r2UsageTracker", null);
        Path rawFile = tempDir.resolve("no-tracker.mp4");
        Files.writeString(rawFile, "bytes");

        String url = service.uploadFile("videos/no-tracker.mp4", rawFile.toFile(), "video/mp4");

        assertThat(url).isEqualTo("https://cdn.example.com/videos/no-tracker.mp4");
        verify(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    @DisplayName("uploadHlsFolder bỏ qua khi thư mục rỗng hoặc không tồn tại")
    void should_SkipUploadHlsFolder_when_DirectoryEmptyOrMissing() {
        Path missing = tempDir.resolve("missing");
        service.uploadHlsFolder("hls/1", missing);

        service.uploadHlsFolder("hls/2", tempDir);
        verifyNoInteractions(s3Client);
    }

    @Test
    @DisplayName("uploadHlsFolder upload đủ m3u8/ts, bỏ qua thư mục con và chịu lỗi từng file")
    void should_UploadHlsFilesWithCorrectContentTypes_and_ContinueOnSingleFileError() throws IOException {
        Path hlsDir = tempDir.resolve("hls");
        Files.createDirectories(hlsDir.resolve("nested_dir"));
        Files.writeString(hlsDir.resolve("master.m3u8"), "#EXTM3U");
        Files.writeString(hlsDir.resolve("segment_000.ts"), "ts-data-0");
        Files.writeString(hlsDir.resolve("segment_001.ts"), "ts-data-1");

        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build())
                .thenThrow(new RuntimeException("Transient network glitch"))
                .thenReturn(PutObjectResponse.builder().build());

        service.uploadHlsFolder("hls/abc", hlsDir);

        ArgumentCaptor<PutObjectRequest> captor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client, times(3)).putObject(captor.capture(), any(RequestBody.class));

        List<PutObjectRequest> requests = captor.getAllValues();
        assertThat(requests)
                .extracting(PutObjectRequest::key)
                .containsExactlyInAnyOrder("hls/abc/master.m3u8", "hls/abc/segment_000.ts", "hls/abc/segment_001.ts");
        assertThat(requests)
                .filteredOn(r -> r.key().endsWith(".m3u8"))
                .singleElement()
                .extracting(PutObjectRequest::contentType)
                .isEqualTo("application/vnd.apple.mpegurl");
        assertThat(requests)
                .filteredOn(r -> r.key().endsWith(".ts"))
                .hasSize(2)
                .allMatch(r -> "video/MP2T".equals(r.contentType()));
        assertThat(r2UsageTracker.getPutOps()).isEqualTo(2L);
    }

    @Test
    @DisplayName("deleteObjectByUrlOrKey xử lý null/blank, file cục bộ /uploads/, cấu hình dummy và xóa thật trên R2")
    void should_DeleteLocalOrR2ObjectsSafely() throws IOException {
        assertThat(service.deleteObjectByUrlOrKey(null)).isFalse();
        assertThat(service.deleteObjectByUrlOrKey("   ")).isFalse();

        // File cục bộ /uploads/
        String testFileName = "r2-test-" + UUID.randomUUID() + ".tmp";
        Path uploadsRoot = Paths.get("uploads");
        Files.createDirectories(uploadsRoot);
        Path createdLocalFile = uploadsRoot.resolve(testFileName);
        Files.writeString(createdLocalFile, "temp");
        try {
            assertThat(service.deleteObjectByUrlOrKey("/uploads/" + testFileName)).isTrue();
            assertThat(Files.exists(createdLocalFile)).isFalse();
            assertThat(service.deleteObjectByUrlOrKey("/uploads/" + testFileName)).isFalse();
        } finally {
            Files.deleteIfExists(createdLocalFile);
        }

        // Chế độ dummy storage bỏ qua gọi S3
        ReflectionTestUtils.setField(service, "bucketName", "dummy_bucket");
        assertThat(service.deleteObjectByUrlOrKey("https://cdn.example.com/videos/a.mp4")).isFalse();
        verifyNoInteractions(s3Client);

        // Chế độ live S3 thành công & tăng DeleteOps
        ReflectionTestUtils.setField(service, "bucketName", "englishlearning-media");
        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenReturn(DeleteObjectResponse.builder().build())
                .thenThrow(new RuntimeException("S3 delete denied"));

        boolean deleted = service.deleteObjectByUrlOrKey("https://cdn.example.com/hls/vid1/master.m3u8");
        assertThat(deleted).isTrue();
        assertThat(r2UsageTracker.getDeleteOps()).isEqualTo(1L);

        ArgumentCaptor<DeleteObjectRequest> delCaptor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(delCaptor.capture());
        assertThat(delCaptor.getValue().key()).isEqualTo("hls/vid1/master.m3u8");

        // Lỗi từ S3 trả về false
        assertThat(service.deleteObjectByUrlOrKey("raw/fail.mp4")).isFalse();
    }

    @Test
    @DisplayName("deleteObjectsByUrlsOrKeys loại bỏ trùng lặp và đếm số object xóa thành công")
    void should_DeduplicateAndDeleteCollectionOfKeys() {
        assertThat(service.deleteObjectsByUrlsOrKeys(null)).isZero();
        assertThat(service.deleteObjectsByUrlsOrKeys(Collections.emptyList())).isZero();

        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenReturn(DeleteObjectResponse.builder().build());

        int count = service.deleteObjectsByUrlsOrKeys(List.of(
                "https://cdn.example.com/a.mp4",
                " https://cdn.example.com/a.mp4 ",
                "   ",
                "videos/b.mp4"
        ));

        assertThat(count).isEqualTo(2);
        verify(s3Client, times(2)).deleteObject(any(DeleteObjectRequest.class));
        assertThat(r2UsageTracker.getDeleteOps()).isEqualTo(2L);
    }

    @Test
    @DisplayName("deleteObjectsByPrefix duyệt phân trang continuationToken và xóa toàn bộ key theo prefix")
    void should_DeletePaginatedObjectsByPrefix() {
        assertThat(service.deleteObjectsByPrefix(null)).isZero();
        assertThat(service.deleteObjectsByPrefix(" ")).isZero();

        ListObjectsV2Response page1 = ListObjectsV2Response.builder()
                .contents(
                        S3Object.builder().key("hls/123/master.m3u8").build(),
                        S3Object.builder().key("hls/123/segment_000.ts").build()
                )
                .isTruncated(true)
                .nextContinuationToken("tok-2")
                .build();
        ListObjectsV2Response page2 = ListObjectsV2Response.builder()
                .contents(S3Object.builder().key("hls/123/segment_001.ts").build())
                .isTruncated(false)
                .build();

        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class)))
                .thenReturn(page1)
                .thenReturn(page2);
        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenReturn(DeleteObjectResponse.builder().build());

        int deleted = service.deleteObjectsByPrefix("/hls/123/");

        assertThat(deleted).isEqualTo(3);
        assertThat(r2UsageTracker.getListOps()).isEqualTo(2L);
        assertThat(r2UsageTracker.getDeleteOps()).isEqualTo(3L);

        ArgumentCaptor<ListObjectsV2Request> listCaptor = ArgumentCaptor.forClass(ListObjectsV2Request.class);
        verify(s3Client, times(2)).listObjectsV2(listCaptor.capture());
        assertThat(listCaptor.getAllValues().get(0).prefix()).isEqualTo("hls/123/");
        assertThat(listCaptor.getAllValues().get(0).continuationToken()).isNull();
        assertThat(listCaptor.getAllValues().get(1).continuationToken()).isEqualTo("tok-2");
    }

    @Test
    @DisplayName("inspectBucketSnapshot trả về trạng thái dummy khi chưa cấu hình bucket thật")
    void should_ReturnFallbackSnapshot_when_DummyStorageConfigured() {
        ReflectionTestUtils.setField(service, "endpoint", "https://dummy.r2.dev");
        r2UsageTracker.recordPut();

        R2BucketSnapshot snapshot = service.inspectBucketSnapshot();

        assertThat(snapshot.isLiveConnected()).isFalse();
        assertThat(snapshot.getTotalObjects()).isZero();
        assertThat(snapshot.getTrackedPutOps()).isEqualTo(1L);
        assertThat(snapshot.getStatusNote()).contains("dummy");
        verifyNoInteractions(s3Client);
    }

    @Test
    @DisplayName("inspectBucketSnapshot tổng hợp thống kê 6 nhóm prefix và top 10 tệp lớn nhất khi kết nối R2 live")
    void should_AggregateCategoriesAndTop10LargestObjects_when_InspectingLiveBucket() {
        List<S3Object> objects = new ArrayList<>();
        objects.add(S3Object.builder().key("videos/intro.mp4").size(5_000L).lastModified(Instant.now()).build());
        objects.add(S3Object.builder().key("hls/v1/master.m3u8").size(300L).lastModified(Instant.now()).build());
        objects.add(S3Object.builder().key("speaking/s1.wav").size(2_000L).build());
        objects.add(S3Object.builder().key("audio/tts1.mp3").size(1_500L).build());
        objects.add(S3Object.builder().key("documents/grammar.pdf").size(4_000L).build());
        objects.add(S3Object.builder().key("avatars/user1.png").size(800L).build());
        for (int i = 0; i < 6; i++) {
            objects.add(S3Object.builder().key("misc/file_" + i + ".bin").size(100L * (i + 1)).build());
        }

        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class)))
                .thenReturn(ListObjectsV2Response.builder().contents(objects).isTruncated(false).build());

        R2BucketSnapshot snapshot = service.inspectBucketSnapshot();

        assertThat(snapshot.isLiveConnected()).isTrue();
        assertThat(snapshot.getTotalObjects()).isEqualTo(12L);
        assertThat(snapshot.getTrackedListOps()).isEqualTo(1L);
        assertThat(snapshot.getLargestObjects()).hasSize(10);
        assertThat(snapshot.getLargestObjects().get(0).getKey()).isEqualTo("videos/intro.mp4");
        assertThat(snapshot.getPrefixStats()).hasSize(6);
        assertThat(snapshot.getPrefixStats())
                .filteredOn(s -> "videos".equals(s.getCategoryKey()))
                .singleElement()
                .satisfies(stat -> {
                    assertThat(stat.getObjectCount()).isEqualTo(2L);
                    assertThat(stat.getTotalBytes()).isEqualTo(5_300L);
                });
    }

    @Test
    @DisplayName("inspectBucketSnapshot xử lý lỗi ListObjectsV2 an toàn và trả về liveConnected=false")
    void should_ReturnErrorSnapshot_when_S3ListThrowsException() {
        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class)))
                .thenThrow(new IllegalStateException("Connection timeout"));

        R2BucketSnapshot snapshot = service.inspectBucketSnapshot();

        assertThat(snapshot.isLiveConnected()).isFalse();
        assertThat(snapshot.getStatusNote()).contains("IllegalStateException");
        assertThat(snapshot.getPrefixStats()).isEmpty();
    }

    @Test
    @DisplayName("extractKey trích xuất chính xác object key từ publicUrl, HTTPS URL bất kỳ và key thuần")
    void should_ExtractS3KeyProperlyFromDifferentFormats() {
        assertThat(service.extractKey(null)).isNull();
        assertThat(service.extractKey("  ")).isNull();
        assertThat(service.extractKey("https://cdn.example.com/hls/1/master.m3u8")).isEqualTo("hls/1/master.m3u8");
        assertThat(service.extractKey("https://other.host.dev/documents/guide.pdf")).isEqualTo("documents/guide.pdf");
        assertThat(service.extractKey("/avatars/u1.png")).isEqualTo("avatars/u1.png");
        assertThat(service.extractKey("https://bad uri with spaces")).isNull();
    }
}
