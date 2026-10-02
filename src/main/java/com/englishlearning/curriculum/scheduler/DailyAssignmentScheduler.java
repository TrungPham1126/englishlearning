package com.englishlearning.curriculum.scheduler;

import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DailyAssignmentScheduler {

    private final DailyStudyPlanRepository dailyStudyPlanRepository;

    /**
     * Tự động quét và mở khóa bài tập của ngày mới vào đúng 00:00:00 mỗi đêm
     */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void unlockDailyAssignments() {
        LocalDate today = LocalDate.now();
        log.info("[DAILY-SCHEDULER] Bắt đầu quét mở khóa bài tập cho ngày: {}", today);

        // Tìm tất cả các DAY có lịch trùng ngày hôm nay mà chưa mở khóa
        List<DailyStudyPlan> todayPlans = dailyStudyPlanRepository.findByScheduledDateAndIsUnlockedFalse(today);

        if (todayPlans.isEmpty()) {
            log.info("[DAILY-SCHEDULER] Không có kế hoạch bài tập nào cần mở khóa hôm nay.");
            return;
        }

        for (DailyStudyPlan plan : todayPlans) {
            plan.setIsUnlocked(true);
        }

        dailyStudyPlanRepository.saveAll(todayPlans);
        log.info("[DAILY-SCHEDULER] Đã mở khóa thành công {} kế hoạch ngày (DAY) cho các lớp học.", todayPlans.size());
    }
}