package com.englishlearning.video.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.File;
import java.nio.file.Path;

@Service
@RequiredArgsConstructor
@Slf4j
public class R2StorageService {

    private final S3Client s3Client;

    // Đã đổi sang đọc từ app.secrets.storage.*
    @Value("${app.secrets.storage.bucket-name}")
    private String bucketName;

    @Value("${app.secrets.storage.public-url}")
    private String publicUrl;

    /**
     * Upload một file đơn lẻ (raw video hoặc thumbnail)
     */
    public String uploadFile(String key, File file, String contentType) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(contentType)
                .build();

        s3Client.putObject(request, RequestBody.fromFile(file));
        return publicUrl + "/" + key;
    }

    /**
     * Upload toàn bộ thư mục HLS (master.m3u8 và các file .ts)
     */
    public void uploadHlsFolder(String s3Prefix, Path localFolderPath) {
        File folder = localFolderPath.toFile();
        log.info(">>> [R2-UPLOAD] Đang kiểm tra thư mục HLS tại: {}", folder.getAbsolutePath());
        log.info(">>> [R2-UPLOAD] Thư mục tồn tại: {}, Là thư mục: {}", folder.exists(), folder.isDirectory());

        File[] files = folder.listFiles();
        if (files == null || files.length == 0) {
            log.error(">>> [R2-UPLOAD] KHÔNG TÌM THẤY FILE NÀO trong thư mục: {}", folder.getAbsolutePath());
            return;
        }

        log.info(">>> [R2-UPLOAD] Tìm thấy {} files, bắt đầu upload lên R2 bucket: {}", files.length, bucketName);

        for (File f : files) {
            if (f.isFile()) {
                String key = s3Prefix + "/" + f.getName();
                String contentType = f.getName().endsWith(".m3u8")
                        ? "application/vnd.apple.mpegurl"
                        : "video/MP2T";
                try {
                    uploadFile(key, f, contentType);
                    log.info(">>> [R2-UPLOAD] Upload thành công: {}", key);
                } catch (Exception ex) {
                    log.error(">>> [R2-UPLOAD] LỖI KHI UPLOAD FILE {}: {}", key, ex.getMessage(), ex);
                }
            }
        }
    }
}