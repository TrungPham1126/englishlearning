package com.englishlearning.video.service;

import java.io.File;
import java.nio.file.Path;

public interface R2StorageService {

    /**
     * Upload một file đơn lẻ (raw video hoặc thumbnail)
     */
    String uploadFile(String key, File file, String contentType);

    /**
     * Upload toàn bộ thư mục HLS (master.m3u8 và các file .ts)
     */
    void uploadHlsFolder(String s3Prefix, Path localFolderPath);
}
