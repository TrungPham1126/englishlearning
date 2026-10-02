package com.englishlearning.curriculum.dto;

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
}