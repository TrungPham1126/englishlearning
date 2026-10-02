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
            log.error("Lỗi S3 Client khi upload lên R2: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể upload tài liệu lên Cloud Storage: " + e.getMessage(), e);
        }
    }
}