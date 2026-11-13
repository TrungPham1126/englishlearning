package com.englishlearning.video.service;

import com.englishlearning.video.dto.R2BucketSnapshot;

import java.io.File;
import java.nio.file.Path;
import java.util.Collection;

public interface R2StorageService {

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
