package com.englishlearning.curriculum.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LessonDetailResponse {
    private UUID id;
    private UUID classId;
    private String title;
    private String objectives;
    private String content;
    private Integer orderIndex;
    private LocalDateTime updatedAt;
    private List<DocumentResponse> documents;
    private List<VocabularyResponse> vocabularies;
    private List<GrammarTopicResponse> grammarTopics;

    private boolean completed;
    private int progressPercentage;
    private int watchedSeconds;

    @JsonProperty("isCompleted")
    public boolean getIsCompleted() {
        return completed;
    }
}
