package com.englishlearning.curriculum.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.util.UUID;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LessonResponse {
    private UUID id;
    private UUID classId;
    private String title;
    private String objectives;
    private String content;
    private Integer orderIndex;
    private LocalDateTime updatedAt;

    private boolean completed;
    private int progressPercentage;
    private int watchedSeconds;

    @JsonProperty("isCompleted")
    public boolean getIsCompleted() {
        return completed;
    }
}
