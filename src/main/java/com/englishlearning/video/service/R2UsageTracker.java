package com.englishlearning.video.service;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Bộ đếm thao tác Cloudflare R2 trong bộ nhớ (thread-safe) phục vụ quan sát Class A/Class B operations.
 */
@Component
public class R2UsageTracker {

    private final AtomicLong putOps = new AtomicLong(0);
    private final AtomicLong listOps = new AtomicLong(0);
    private final AtomicLong deleteOps = new AtomicLong(0);
    private final AtomicLong getOps = new AtomicLong(0);
    private volatile Instant trackingSince = Instant.now();

    public void recordPut() {
        putOps.incrementAndGet();
    }

    public void recordList() {
        listOps.incrementAndGet();
    }

    public void recordDelete() {
        deleteOps.incrementAndGet();
    }

    public void recordGet() {
        getOps.incrementAndGet();
    }

    public long getPutOps() {
        return putOps.get();
    }

    public long getListOps() {
        return listOps.get();
    }

    public long getDeleteOps() {
        return deleteOps.get();
    }

    public long getGetOps() {
        return getOps.get();
    }

    public Instant getTrackingSince() {
        return trackingSince;
    }
}
