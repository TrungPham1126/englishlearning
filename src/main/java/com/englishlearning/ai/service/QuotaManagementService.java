package com.englishlearning.ai.service;

import com.englishlearning.ai.entity.StudentAiQuota;

import java.util.UUID;

public interface QuotaManagementService {

    /**
     * Kiểm tra và trừ hạn ngạch sử dụng AI của học viên.
     */
    StudentAiQuota deductAiQuota(UUID studentId, int count);

    /**
     * Tiện ích trừ 1 lượt sử dụng AI mặc định.
     */
    void checkAndDeductQuota(UUID studentId);

    /**
     * Lấy hoặc khởi tạo hạn ngạch mặc định cho học viên.
     */
    StudentAiQuota getOrCreateQuota(UUID studentId);

    /**
     * Cập nhật giới hạn sử dụng AI hàng ngày của học viên.
     */
    StudentAiQuota updateDailyLimit(UUID studentId, int newLimit);
}
