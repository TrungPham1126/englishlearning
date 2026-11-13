package com.englishlearning.curriculum.service;

import com.englishlearning.video.service.R2UsageTracker;
import com.englishlearning.curriculum.service.impl.DocumentStorageServiceImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DocumentStorageServiceImpl - Lưu trữ tài liệu & âm thanh R2 + Local Fallback")
class DocumentStorageServiceImplTest {

    @Mock
    private S3Client s3Client;

    private R2UsageTracker r2UsageTracker;
    private DocumentStorageServiceImpl storageService;
    private final List<Path> createdLocalFiles = new ArrayList<>();

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        r2UsageTracker = new R2UsageTracker();
        storageService = new DocumentStorageServiceImpl(s3Client);
        ReflectionTestUtils.setField(storageService, "r2UsageTracker", r2UsageTracker);
        ReflectionTestUtils.setField(storageService, "bucketName", "english-bucket");
        ReflectionTestUtils.setField(storageService, "publicUrl", "https://cdn.english.test");
    }

    @AfterEach
    void cleanUpLocalFiles() throws IOException {
        for (Path p : createdLocalFiles) {
            Files.deleteIfExists(p);
        }
    }

    @Test
    @DisplayName("uploadFile - Tải file hợp lệ lên R2, giữ extension và tăng R2 put counter")
    void uploadFile_validFile_uploadsToR2AndTracksMetric() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "lesson_notes.pdf", "application/pdf", "pdf-bytes".getBytes(StandardCharsets.UTF_8));
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());

        String url = storageService.uploadFile(file);

        assertThat(url).startsWith("https://cdn.english.test/documents/").endsWith(".pdf");
        assertThat(r2UsageTracker.getPutOps()).isEqualTo(1L);

        ArgumentCaptor<PutObjectRequest> reqCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(reqCaptor.capture(), any(RequestBody.class));
        assertThat(reqCaptor.getValue().bucket()).isEqualTo("english-bucket");
        assertThat(reqCaptor.getValue().contentType()).isEqualTo("application/pdf");
    }

    @Test
    @DisplayName("uploadFile - File null, rỗng, IOException hoặc lỗi S3 đều xử lý đúng exception")
    void uploadFile_emptyNullOrErrors_throwsException() throws IOException {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]);
        assertThatThrownBy(() -> storageService.uploadFile(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storageService.uploadFile(emptyFile)).isInstanceOf(IllegalArgumentException.class);

        MultipartFile brokenIoFile = mock(MultipartFile.class);
        when(brokenIoFile.isEmpty()).thenReturn(false);
        when(brokenIoFile.getOriginalFilename()).thenReturn("noext");
        when(brokenIoFile.getContentType()).thenReturn("application/octet-stream");
        when(brokenIoFile.getInputStream()).thenThrow(new IOException("Stream closed"));
        assertThatThrownBy(() -> storageService.uploadFile(brokenIoFile))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Lỗi IO");

        MockMultipartFile valid = new MockMultipartFile("file", "doc.docx", "application/msword", new byte[]{1, 2});
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(new RuntimeException("S3 timeout"));
        assertThatThrownBy(() -> storageService.uploadFile(valid))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Cloud Storage");
    }

    @Test
    @DisplayName("uploadAudioFile - Chọn contentType mặc định theo đuôi .wav/.mp3 và fallback local khi R2 lỗi")
    void uploadAudioFile_r2SuccessAndLocalFallback_worksAndCleansUp() {
        MockMultipartFile wavFile = new MockMultipartFile("file", "sample.wav", null, new byte[]{1, 2, 3, 4});
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());

        String r2Url = storageService.uploadAudioFile(wavFile);
        assertThat(r2Url).startsWith("https://cdn.english.test/audio/").endsWith(".wav");

        ArgumentCaptor<PutObjectRequest> reqCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(reqCaptor.capture(), any(RequestBody.class));
        assertThat(reqCaptor.getValue().contentType()).isEqualTo("audio/wav");

        // Fallback local khi S3 throw
        MockMultipartFile mp3File = new MockMultipartFile("file", "clip.mp3", "   ", new byte[]{5, 6, 7});
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(new RuntimeException("R2 unavailable"));

        String localUrl = storageService.uploadAudioFile(mp3File);
        assertThat(localUrl).startsWith("/uploads/audio/").endsWith(".mp3");
        Path localPath = Paths.get("." + localUrl);
        createdLocalFiles.add(localPath);
        assertThat(Files.exists(localPath)).isTrue();
    }

    @Test
    @DisplayName("uploadAudioFile - Audio null hoặc rỗng ném IllegalArgumentException")
    void uploadAudioFile_nullOrEmpty_throwsIllegalArgument() {
        MockMultipartFile empty = new MockMultipartFile("file", "a.mp3", "audio/mpeg", new byte[0]);
        assertThatThrownBy(() -> storageService.uploadAudioFile(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storageService.uploadAudioFile(empty)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("storeAudioFile - Upload file vật lý thành công và fallback local khi S3 lỗi")
    void storeAudioFile_validAndFallbackAndMissing_handledCorrectly() throws IOException {
        File missing = tempDir.resolve("missing.mp3").toFile();
        assertThatThrownBy(() -> storageService.storeAudioFile(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storageService.storeAudioFile(missing)).isInstanceOf(IllegalArgumentException.class);

        Path audioPath = tempDir.resolve("voice.wav");
        Files.write(audioPath, new byte[]{10, 20, 30});
        File sourceFile = audioPath.toFile();

        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());
        String r2Url = storageService.storeAudioFile(sourceFile);
        assertThat(r2Url).startsWith("https://cdn.english.test/audio/").endsWith(".wav");

        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(new RuntimeException("R2 error"));
        String localUrl = storageService.storeAudioFile(sourceFile);
        assertThat(localUrl).startsWith("/uploads/audio/").endsWith(".wav");
        Path localPath = Paths.get("." + localUrl);
        createdLocalFiles.add(localPath);
        assertThat(Files.exists(localPath)).isTrue();
    }

    @Test
    @DisplayName("storeAudioBytes - Upload byte[] lên R2, ném lỗi nếu rỗng, và fallback local khi R2 lỗi")
    void storeAudioBytes_allBranches() {
        assertThatThrownBy(() -> storageService.storeAudioBytes(null, "a.wav", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storageService.storeAudioBytes(new byte[0], "a.wav", null))
                .isInstanceOf(IllegalArgumentException.class);

        byte[] data = "RIFFaudio".getBytes(StandardCharsets.UTF_8);
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());

        String r2Url = storageService.storeAudioBytes(data, "speech.mp3", "");
        assertThat(r2Url).startsWith("https://cdn.english.test/audio/").endsWith(".mp3");

        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(new RuntimeException("Network error"));
        String localUrl = storageService.storeAudioBytes(data, "noext", "audio/wav");
        assertThat(localUrl).startsWith("/uploads/audio/");
        Path localPath = Paths.get("." + localUrl);
        createdLocalFiles.add(localPath);
        assertThat(Files.exists(localPath)).isTrue();
    }

    @Test
    @DisplayName("deleteFileByUrl - Xóa object trên R2, file local /uploads/ và bỏ qua URL null/lỗi")
    void deleteFileByUrl_r2AndLocalAndNull() throws IOException {
        storageService.deleteFileByUrl(null);
        storageService.deleteFileByUrl("   ");
        verifyNoInteractions(s3Client);

        storageService.deleteFileByUrl("https://cdn.english.test/audio/clip123.mp3");
        ArgumentCaptor<DeleteObjectRequest> deleteCaptor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(deleteCaptor.capture());
        assertThat(deleteCaptor.getValue().bucket()).isEqualTo("english-bucket");
        assertThat(deleteCaptor.getValue().key()).isEqualTo("audio/clip123.mp3");
        assertThat(r2UsageTracker.getDeleteOps()).isEqualTo(1L);

        Path uploadAudioDir = Paths.get("uploads", "audio");
        Files.createDirectories(uploadAudioDir);
        Path tempLocal = Files.createTempFile(uploadAudioDir, "testdel_", ".wav");
        createdLocalFiles.add(tempLocal);
        String localUrl = "/uploads/audio/" + tempLocal.getFileName().toString();

        storageService.deleteFileByUrl(localUrl);
        assertThat(Files.exists(tempLocal)).isFalse();
    }
}
