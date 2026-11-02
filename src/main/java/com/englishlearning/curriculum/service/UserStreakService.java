package com.englishlearning.curriculum.service;

import java.time.LocalDate;
import java.util.UUID;

public interface UserStreakService {
    int updateStreakOnPlanCompletion(UUID studentId, LocalDate completionDate);
    int recordActivity(UUID studentId);
    int getCurrentStreak(UUID studentId);
}
