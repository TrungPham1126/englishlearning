package com.englishlearning.video.service;

import com.englishlearning.video.dto.R2BucketSnapshot;
import com.englishlearning.video.dto.R2ObjectStream;

import java.io.File;
import java.nio.file.Path;
import java.util.Collection;
import java.util.Optional;

public interface R2StorageService {

    /**
     * Kiểm tra R2 đã được cấu hình hợp lệ (không phải dummy/placeholder) hay chưa.
     */
    boolean isConfigured();

    /**
     * Kiểm tra URL có thuộc bucket R2 công khai đang cấu hình hay không.
     */
    boolean isManagedPublicUrl(String urlOrKey);

    /**
     * Trích xuất R2 object key từ public URL hoặc key thô.
     */
    String extractObjectKey(String urlOrKey);

    /**
     * Mở stream đọc (hoặc HEAD) đối tượng trên R2, hỗ trợ byte-range request.
     */
    Optional<R2ObjectStream> openObjectStream(String key, String rangeHeader, boolean headOnly);

    /**
     * Upload một file đơn lẻ (raw video hoặc thumbnail hoặc file audio speaking)
     */
    String uploadFile(String key, File file, String contentType);

    /**
     * Upload toàn bộ thư mục HLS (master.m3u8 và các file .ts)
     */
    void uploadHlsFolder(String s3Prefix, Path localFolderPath);

    /**
     * Xóa một object trên R2 (hoặc file /uploads/... cục bộ nếu fallback). Trả về true nếu xóa thành công.
     */
    boolean deleteObjectByUrlOrKey(String urlOrKey);

    /**
     * Xóa hàng loạt objects theo danh sách URL hoặc key. Trả về số object đã xóa.
     */
    int deleteObjectsByUrlsOrKeys(Collection<String> urlsOrKeys);

    /**
     * Xóa toàn bộ objects dưới một prefix thư mục (ví dụ hls/video-id). Trả về số object đã xóa.
     */
    int deleteObjectsByPrefix(String prefix);

    /**
     * Thống kê dung lượng thực tế và số lượng object trên Cloudflare R2 bucket.
     */
    R2BucketSnapshot inspectBucketSnapshot();
}
