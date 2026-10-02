package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.DailyPlanItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DailyPlanItemRepository extends JpaRepository<DailyPlanItem, UUID> {
    List<DailyPlanItem> findByDailyPlanIdOrderByOrderIndexAsc(UUID dailyPlanId);
}