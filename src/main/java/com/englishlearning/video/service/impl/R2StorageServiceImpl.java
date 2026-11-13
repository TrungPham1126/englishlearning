package com.englishlearning.video.service.impl;

import com.englishlearning.video.dto.R2BucketSnapshot;
import com.englishlearning.video.service.R2StorageService;
import com.englishlearning.video.service.R2UsageTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class R2StorageServiceImpl implements R2StorageService {

    private final S3Client s3Client;

    @Autowired(required = false)
    private R2UsageTracker r2UsageTracker;

    // Đã đổi sang đọc từ app.secrets.storage.*
    @Value("${app.secrets.storage.bucket-name}")
    private String bucketName;

    @Value("${app.secrets.storage.public-url}")
    private String publicUrl;

    @Value("${app.secrets.storage.endpoint:}")
    private String endpoint;

    /**
     * Upload một file đơn lẻ (raw video hoặc thumbnail hoặc speaking audio)
     */
    @Override
    public String uploadFile(String key, File file, String contentType) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(contentType)
                .build();

        s3Client.putObject(request, RequestBody.fromFile(file));
        if (r2UsageTracker != null) {
            r2UsageTracker.recordPut();
        }
        return publicUrl + "/" + key;
    }

    /**
     * Upload toàn bộ thư mục HLS (master.m3u8 và các file .ts)
     */
    @Override
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

    @Override
    public boolean deleteObjectByUrlOrKey(String urlOrKey) {
        if (urlOrKey == null || urlOrKey.isBlank()) {
            return false;
        }
        String trimmed = urlOrKey.trim();

        // Xử lý file cục bộ fallback (/uploads/...)
        if (trimmed.startsWith("/uploads/")) {
            try {
                Path localPath = Paths.get("." + trimmed);
                return Files.deleteIfExists(localPath);
            } catch (Exception e) {
                log.warn("[R2-DELETE] Không thể xóa file cục bộ {}: {}", trimmed, e.getMessage());
                return false;
            }
        }

        String key = extractKey(trimmed);
        if (key == null || key.isBlank()) {
            return false;
        }

        if (isDummyStorageConfigured()) {
            log.debug("[R2-DELETE] Storage đang ở chế độ dummy, bỏ qua gọi R2 thực tế cho key: {}", key);
            return false;
        }

        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build());
            if (r2UsageTracker != null) {
                r2UsageTracker.recordDelete();
            }
            log.info("[R2-DELETE] Đã xóa object R2 thành công: {}", key);
            return true;
        } catch (Exception e) {
            log.warn("[R2-DELETE] Không thể xóa object R2 {}: {}", key, e.getMessage());
            return false;
        }
    }

    @Override
    public int deleteObjectsByUrlsOrKeys(Collection<String> urlsOrKeys) {
        if (urlsOrKeys == null || urlsOrKeys.isEmpty()) {
            return 0;
        }
        int deleted = 0;
        Set<String> seen = new HashSet<>();
        for (String item : urlsOrKeys) {
            if (item != null && !item.isBlank() && seen.add(item.trim())) {
                if (deleteObjectByUrlOrKey(item.trim())) {
                    deleted++;
                }
            }
        }
        return deleted;
    }

    @Override
    public int deleteObjectsByPrefix(String prefix) {
        if (prefix == null || prefix.isBlank() || isDummyStorageConfigured()) {
            return 0;
        }
        String normalizedPrefix = prefix.startsWith("/") ? prefix.substring(1) : prefix;
        int deletedCount = 0;
        try {
            String continuationToken = null;
            do {
                ListObjectsV2Request.Builder reqBuilder = ListObjectsV2Request.builder()
                        .bucket(bucketName)
                        .prefix(normalizedPrefix)
                        .maxKeys(500);
                if (continuationToken != null) {
                    reqBuilder.continuationToken(continuationToken);
                }
                ListObjectsV2Response listRes = s3Client.listObjectsV2(reqBuilder.build());
                if (r2UsageTracker != null) {
                    r2UsageTracker.recordList();
                }
                if (listRes != null && listRes.contents() != null) {
                    for (S3Object obj : listRes.contents()) {
                        if (deleteObjectByUrlOrKey(obj.key())) {
                            deletedCount++;
                        }
                    }
                }
                continuationToken = (listRes != null && Boolean.TRUE.equals(listRes.isTruncated()))
                        ? listRes.nextContinuationToken()
                        : null;
            } while (continuationToken != null);
        } catch (Exception e) {
            log.warn("[R2-DELETE] Không thể xóa prefix {}: {}", normalizedPrefix, e.getMessage());
        }
        return deletedCount;
    }

    @Override
    public R2BucketSnapshot inspectBucketSnapshot() {
        long putOps = r2UsageTracker != null ? r2UsageTracker.getPutOps() : 0L;
        long listOps = r2UsageTracker != null ? r2UsageTracker.getListOps() : 0L;
        long deleteOps = r2UsageTracker != null ? r2UsageTracker.getDeleteOps() : 0L;
        long getOps = r2UsageTracker != null ? r2UsageTracker.getGetOps() : 0L;

        if (isDummyStorageConfigured()) {
            return R2BucketSnapshot.builder()
                    .bucketName(bucketName != null ? bucketName : "dummy_bucket")
                    .endpoint(endpoint)
                    .publicUrl(publicUrl)
                    .liveConnected(false)
                    .statusNote("Đang dùng cấu hình Storage mặc định/dummy — hiển thị ước tính từ dữ liệu Media trong Database")
                    .totalObjects(0L)
                    .totalBytes(0L)
                    .trackedPutOps(putOps)
                    .trackedListOps(listOps)
                    .trackedDeleteOps(deleteOps)
                    .trackedGetOps(getOps)
                    .prefixStats(Collections.emptyList())
                    .largestObjects(Collections.emptyList())
                    .checkedAt(Instant.now())
                    .build();
        }

        try {
            Map<String, PrefixAccumulator> categoryMap = new LinkedHashMap<>();
            initCategory(categoryMap, "videos", "Video bài giảng & HLS", "videos/ | hls/");
            initCategory(categoryMap, "speaking", "Audio Speaking học viên", "speaking/");
            initCategory(categoryMap, "audio", "Audio bài nghe & TTS", "audio/");
            initCategory(categoryMap, "documents", "Tài liệu học tập", "documents/");
            initCategory(categoryMap, "avatars", "Ảnh đại diện người dùng", "avatars/");
            initCategory(categoryMap, "other", "Tệp tin khác", "other");

            List<R2BucketSnapshot.R2ObjectItem> allObjects = new ArrayList<>();
            long totalObjects = 0L;
            long totalBytes = 0L;

            String continuationToken = null;
            int safetyPages = 0;
            do {
                ListObjectsV2Request.Builder reqBuilder = ListObjectsV2Request.builder()
                        .bucket(bucketName)
                        .maxKeys(1000);
                if (continuationToken != null) {
                    reqBuilder.continuationToken(continuationToken);
                }
                ListObjectsV2Response response = s3Client.listObjectsV2(reqBuilder.build());
                if (r2UsageTracker != null) {
                    r2UsageTracker.recordList();
                }
                listOps = r2UsageTracker != null ? r2UsageTracker.getListOps() : listOps + 1;

                if (response != null && response.contents() != null) {
                    for (S3Object obj : response.contents()) {
                        long size = obj.size() != null ? obj.size() : 0L;
                        String key = obj.key() != null ? obj.key() : "";
                        String catKey = resolveCategoryKey(key);

                        totalObjects++;
                        totalBytes += size;
                        PrefixAccumulator acc = categoryMap.get(catKey);
                        acc.objectCount++;
                        acc.totalBytes += size;

                        allObjects.add(R2BucketSnapshot.R2ObjectItem.builder()
                                .key(key)
                                .category(acc.label)
                                .sizeBytes(size)
                                .lastModified(obj.lastModified())
                                .build());
                    }
                }
                continuationToken = (response != null && Boolean.TRUE.equals(response.isTruncated()))
                        ? response.nextContinuationToken()
                        : null;
                safetyPages++;
            } while (continuationToken != null && safetyPages < 20);

            List<R2BucketSnapshot.R2ObjectItem> largest = allObjects.stream()
                    .sorted(Comparator.comparingLong(R2BucketSnapshot.R2ObjectItem::getSizeBytes).reversed())
                    .limit(10)
                    .toList();

            List<R2BucketSnapshot.R2PrefixStat> stats = categoryMap.values().stream()
                    .map(acc -> R2BucketSnapshot.R2PrefixStat.builder()
                            .categoryKey(acc.key)
                            .categoryLabel(acc.label)
                            .prefix(acc.prefix)
                            .objectCount(acc.objectCount)
                            .totalBytes(acc.totalBytes)
                            .build())
                    .toList();

            return R2BucketSnapshot.builder()
                    .bucketName(bucketName)
                    .endpoint(endpoint)
                    .publicUrl(publicUrl)
                    .liveConnected(true)
                    .statusNote("Đã đồng bộ trực tiếp từ Cloudflare R2 Bucket (" + bucketName + ")")
                    .totalObjects(totalObjects)
                    .totalBytes(totalBytes)
                    .trackedPutOps(putOps)
                    .trackedListOps(listOps)
                    .trackedDeleteOps(deleteOps)
                    .trackedGetOps(getOps)
                    .prefixStats(stats)
                    .largestObjects(largest)
                    .checkedAt(Instant.now())
                    .build();
        } catch (Exception ex) {
            log.warn("[R2-INSPECT] Không thể kết nối R2 ListObjectsV2 cho bucket {}: {}", bucketName, ex.getMessage());
            return R2BucketSnapshot.builder()
                    .bucketName(bucketName)
                    .endpoint(endpoint)
                    .publicUrl(publicUrl)
                    .liveConnected(false)
                    .statusNote("Không thể truy vấn trực tiếp Cloudflare R2 (" + ex.getClass().getSimpleName() + ") — đang dùng ước tính từ Database")
                    .totalObjects(0L)
                    .totalBytes(0L)
                    .trackedPutOps(putOps)
                    .trackedListOps(listOps)
                    .trackedDeleteOps(deleteOps)
                    .trackedGetOps(getOps)
                    .prefixStats(Collections.emptyList())
                    .largestObjects(Collections.emptyList())
                    .checkedAt(Instant.now())
                    .build();
        }
    }

    String extractKey(String urlOrKey) {
        if (urlOrKey == null || urlOrKey.isBlank()) {
            return null;
        }
        String trimmed = urlOrKey.trim();
        if (publicUrl != null && !publicUrl.isBlank()) {
            String base = publicUrl.endsWith("/") ? publicUrl : publicUrl + "/";
            if (trimmed.startsWith(base)) {
                return trimmed.substring(base.length());
            }
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            try {
                java.net.URI uri = java.net.URI.create(trimmed);
                String path = uri.getPath();
                if (path != null && !path.isBlank()) {
                    return path.startsWith("/") ? path.substring(1) : path;
                }
            } catch (Exception ignored) {
                return null;
            }
        }
        return trimmed.startsWith("/") ? trimmed.substring(1) : trimmed;
    }

    private boolean isDummyStorageConfigured() {
        return bucketName == null
                || bucketName.isBlank()
                || "dummy_bucket".equalsIgnoreCase(bucketName)
                || (endpoint != null && endpoint.toLowerCase(Locale.ROOT).contains("dummy"));
    }

    private String resolveCategoryKey(String key) {
        String lower = key.toLowerCase(Locale.ROOT);
        if (lower.startsWith("videos/") || lower.startsWith("hls/") || lower.contains(".m3u8") || lower.contains(".ts") || lower.endsWith(".mp4")) {
            return "videos";
        }
        if (lower.startsWith("speaking/")) {
            return "speaking";
        }
        if (lower.startsWith("audio/")) {
            return "audio";
        }
        if (lower.startsWith("documents/") || lower.startsWith("resources/")) {
            return "documents";
        }
        if (lower.startsWith("avatars/")) {
            return "avatars";
        }
        return "other";
    }

    private void initCategory(Map<String, PrefixAccumulator> map, String key, String label, String prefix) {
        map.put(key, new PrefixAccumulator(key, label, prefix));
    }

    private static class PrefixAccumulator {
        final String key;
        final String label;
        final String prefix;
        long objectCount = 0L;
        long totalBytes = 0L;

        PrefixAccumulator(String key, String label, String prefix) {
            this.key = key;
            this.label = label;
            this.prefix = prefix;
        }
    }
}
