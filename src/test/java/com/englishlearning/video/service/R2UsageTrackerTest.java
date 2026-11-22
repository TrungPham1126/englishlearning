package com.englishlearning.video.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("R2UsageTracker - Đếm thao tác R2 an toàn luồng")
class R2UsageTrackerTest {

    @Test
    @DisplayName("Khởi tạo các bộ đếm bằng 0 và trackingSince khác null")
    void should_InitializeAllCountersAtZero() {
        Instant before = Instant.now();
        R2UsageTracker tracker = new R2UsageTracker();
        Instant after = Instant.now();

        assertThat(tracker.getPutOps()).isZero();
        assertThat(tracker.getListOps()).isZero();
        assertThat(tracker.getDeleteOps()).isZero();
        assertThat(tracker.getGetOps()).isZero();
        assertThat(tracker.getTrackingSince())
                .isNotNull()
                .isAfterOrEqualTo(before)
                .isBeforeOrEqualTo(after);
    }

    @Test
    @DisplayName("Tăng chính xác từng bộ đếm PUT, LIST, DELETE, GET")
    void should_IncrementIndividualOperationCounters() {
        R2UsageTracker tracker = new R2UsageTracker();

        tracker.recordPut();
        tracker.recordPut();
        tracker.recordList();
        tracker.recordDelete();
        tracker.recordDelete();
        tracker.recordDelete();
        tracker.recordGet();

        assertThat(tracker.getPutOps()).isEqualTo(2L);
        assertThat(tracker.getListOps()).isEqualTo(1L);
        assertThat(tracker.getDeleteOps()).isEqualTo(3L);
        assertThat(tracker.getGetOps()).isEqualTo(1L);
    }

    @Test
    @DisplayName("Đảm bảo tính nguyên tử khi nhiều luồng ghi nhận đồng thời")
    void should_MaintainAccuracyUnderConcurrentUpdates() throws Exception {
        R2UsageTracker tracker = new R2UsageTracker();
        int threads = 8;
        int incrementsPerThread = 250;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);

        List<Callable<Void>> tasks = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            tasks.add(() -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                for (int j = 0; j < incrementsPerThread; j++) {
                    tracker.recordPut();
                    tracker.recordList();
                    tracker.recordDelete();
                    tracker.recordGet();
                }
                return null;
            });
        }

        List<Future<Void>> futures = new ArrayList<>();
        for (Callable<Void> task : tasks) {
            futures.add(executor.submit(task));
        }
        ready.await(5, TimeUnit.SECONDS);
        start.countDown();
        for (Future<Void> future : futures) {
            future.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        long expected = (long) threads * incrementsPerThread;
        assertThat(tracker.getPutOps()).isEqualTo(expected);
        assertThat(tracker.getListOps()).isEqualTo(expected);
        assertThat(tracker.getDeleteOps()).isEqualTo(expected);
        assertThat(tracker.getGetOps()).isEqualTo(expected);
    }

    @Test
    @DisplayName("Các bộ đếm PUT, LIST, DELETE, GET hoàn toàn độc lập và giữ nguyên mốc trackingSince")
    void should_KeepCountersIsolatedAndPreserveTrackingSinceTimestamp() {
        R2UsageTracker tracker = new R2UsageTracker();
        Instant initialSince = tracker.getTrackingSince();

        tracker.recordGet();
        assertThat(tracker.getGetOps()).isEqualTo(1L);
        assertThat(tracker.getPutOps()).isZero();
        assertThat(tracker.getListOps()).isZero();
        assertThat(tracker.getDeleteOps()).isZero();
        assertThat(tracker.getTrackingSince()).isEqualTo(initialSince);
    }
}
