package com.englishlearning.curriculum.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskItemDto {
    private UUID id;
    private String title; // "1. TỪ VỰNG TRỌNG ĐIỂM 2"
    private String itemType; // VOCABULARY, LISTENING, READING, SHADOWING
    private Integer orderIndex;
    private UUID assignmentId; // ID bài test để học sinh bấm vào làm bài
    private Boolean isDone; // Trạng thái đã hoàn thành mục này
}