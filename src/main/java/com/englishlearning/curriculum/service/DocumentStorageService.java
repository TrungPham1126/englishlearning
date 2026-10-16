package com.englishlearning.curriculum.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentStorageService {

    private final S3Client s3Client;

    // Đã đổi sang đọc từ app.secrets.storage.*
    @Value("${app.secrets.storage.bucket-name}")
    private String bucketName;

    @Value("${app.secrets.storage.public-url}")
    private String publicUrl;

    public String uploadFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File tải lên không được để trống");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }

        String uniqueFileName = "documents/" + UUID.randomUUID() + extension;

        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(uniqueFileName)
                    .contentType(file.getContentType())
                    .build();

            log.info("Đang upload tài liệu lên bucket: {} với key: {}", bucketName, uniqueFileName);
            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            log.info("Upload tài liệu thành công: {}", uniqueFileName);

            // Trả về full URL để frontend dùng luôn
            return publicUrl + "/" + uniqueFileName;

        } catch (IOException e) {
            log.error("Lỗi đọc luồng file khi upload lên R2: {}", e.getMessage(), e);
            throw new RuntimeException("Lỗi IO khi upload tài liệu lên Cloud: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Lỗi S3 Client khi upload tài liệu lên R2: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể upload tài liệu lên Cloud Storage: " + e.getMessage(), e);
        }
    }

    public String uploadAudioFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File audio tải lên không được để trống");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = ".mp3";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }

        String uniqueFileName = "audio/" + UUID.randomUUID() + extension;
        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = extension.equalsIgnoreCase(".wav") ? "audio/wav" : "audio/mpeg";
        }

        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(uniqueFileName)
                    .contentType(contentType)
                    .build();

            log.info("Đang upload audio lên bucket: {} với key: {}", bucketName, uniqueFileName);
            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            log.info("Upload audio thành công: {}", uniqueFileName);

            return publicUrl + "/" + uniqueFileName;

        } catch (Exception e) {
            log.warn("Lỗi upload audio lên R2: {}. Sử dụng fallback lưu trữ cục bộ...", e.getMessage());
            try {
                java.nio.file.Path localDir = java.nio.file.Paths.get("uploads", "audio");
                if (!java.nio.file.Files.exists(localDir)) {
                    java.nio.file.Files.createDirectories(localDir);
                }
                String localFileName = UUID.randomUUID() + extension;
                java.nio.file.Path targetPath = localDir.resolve(localFileName);
                file.transferTo(targetPath.toFile());
                log.info("Đã lưu audio cục bộ thành công: {}", targetPath.toAbsolutePath());
                return "/uploads/audio/" + localFileName;
            } catch (Exception localEx) {
                log.error("Lỗi fallback lưu audio cục bộ: {}", localEx.getMessage(), localEx);
                throw new RuntimeException("Không thể tải lên file audio: " + e.getMessage(), e);
            }
        }
    }

    public String storeAudioFile(java.io.File sourceFile) {
        if (sourceFile == null || !sourceFile.exists()) {
            throw new IllegalArgumentException("File audio nguồn không tồn tại");
        }
        String extension = ".mp3";
        String name = sourceFile.getName();
        if (name.contains(".")) {
            extension = name.substring(name.lastIndexOf("."));
        }
        String uniqueFileName = "audio/" + UUID.randomUUID() + extension;
        String contentType = extension.equalsIgnoreCase(".wav") ? "audio/wav" : "audio/mpeg";

        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(uniqueFileName)
                    .contentType(contentType)
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromFile(sourceFile));
            log.info("Upload audio thành công lên R2: {}", uniqueFileName);
            return publicUrl + "/" + uniqueFileName;
        } catch (Exception e) {
            log.warn("Lỗi upload audio lên R2: {}. Sử dụng fallback lưu trữ cục bộ...", e.getMessage());
            try {
                java.nio.file.Path localDir = java.nio.file.Paths.get("uploads", "audio");
                if (!java.nio.file.Files.exists(localDir)) {
                    java.nio.file.Files.createDirectories(localDir);
                }
                String localFileName = UUID.randomUUID() + extension;
                java.nio.file.Path targetPath = localDir.resolve(localFileName);
                java.nio.file.Files.copy(sourceFile.toPath(), targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                log.info("Đã lưu audio cục bộ thành công: {}", targetPath.toAbsolutePath());
                return "/uploads/audio/" + localFileName;
            } catch (Exception localEx) {
                log.error("Lỗi fallback lưu audio cục bộ: {}", localEx.getMessage(), localEx);
                throw new RuntimeException("Không thể lưu file audio: " + localEx.getMessage(), localEx);
            }
        }
    }

    public String storeAudioBytes(byte[] audioBytes, String filename, String contentType) {
        if (audioBytes == null || audioBytes.length == 0) {
            throw new IllegalArgumentException("Dữ liệu audio bytes không được để trống");
        }
        String extension = ".wav";
        if (filename != null && filename.contains(".")) {
            extension = filename.substring(filename.lastIndexOf("."));
        }
        String uniqueFileName = "audio/" + UUID.randomUUID() + extension;
        String effectiveContentType = (contentType != null && !contentType.isBlank())
                ? contentType
                : (extension.equalsIgnoreCase(".wav") ? "audio/wav" : "audio/mpeg");

        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(uniqueFileName)
                    .contentType(effectiveContentType)
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(audioBytes));
            log.info("Upload audio bytes thành công lên R2: {} (kích thước: {} bytes)", uniqueFileName, audioBytes.length);
            return publicUrl + "/" + uniqueFileName;
        } catch (Exception e) {
            log.warn("Lỗi upload audio bytes lên R2: {}. Sử dụng fallback lưu trữ cục bộ...", e.getMessage());
            try {
                java.nio.file.Path localDir = java.nio.file.Paths.get("uploads", "audio");
                if (!java.nio.file.Files.exists(localDir)) {
                    java.nio.file.Files.createDirectories(localDir);
                }
                String localFileName = UUID.randomUUID() + extension;
                java.nio.file.Path targetPath = localDir.resolve(localFileName);
                java.nio.file.Files.write(targetPath, audioBytes);
                log.info("Đã lưu audio bytes cục bộ thành công: {}", targetPath.toAbsolutePath());
                return "/uploads/audio/" + localFileName;
            } catch (Exception localEx) {
                log.error("Lỗi fallback lưu audio bytes cục bộ: {}", localEx.getMessage(), localEx);
                throw new RuntimeException("Không thể lưu audio bytes: " + localEx.getMessage(), localEx);
            }
        }
    }

    public void deleteFileByUrl(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }
        try {
            if (fileUrl.startsWith(publicUrl + "/")) {
                String key = fileUrl.substring((publicUrl + "/").length());
                software.amazon.awssdk.services.s3.model.DeleteObjectRequest deleteRequest =
                        software.amazon.awssdk.services.s3.model.DeleteObjectRequest.builder()
                                .bucket(bucketName)
                                .key(key)
                                .build();
                s3Client.deleteObject(deleteRequest);
                log.info("Đã xóa file cũ khỏi Cloud Storage: {}", key);
            } else if (fileUrl.startsWith("/uploads/")) {
                java.nio.file.Path localPath = java.nio.file.Paths.get("." + fileUrl);
                java.nio.file.Files.deleteIfExists(localPath);
                log.info("Đã xóa file audio cục bộ cũ: {}", localPath.toAbsolutePath());
            }
        } catch (Exception e) {
            log.warn("Không thể xóa file cũ {}: {}", fileUrl, e.getMessage());
        }
    }
}