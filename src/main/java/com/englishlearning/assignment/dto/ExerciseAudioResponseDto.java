package com.englishlearning.assignment.dto;

import com.englishlearning.assignment.entity.AudioGeneratedBy;
import com.englishlearning.assignment.entity.AudioGenerationStatus;
import com.englishlearning.assignment.entity.ExerciseAudioType;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExerciseAudioResponseDto {
    private UUID id;
    private ExerciseAudioType exerciseType;
    private UUID assignmentId;
    private UUID questionId;
    private AudioGenerationStatus status;
    private String url;
    private Long durationMs;
    private Integer version;
    private AudioGeneratedBy generatedBy;
    private String errorMessage;
    private List<DialogueSegmentDto> segments;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DialogueSegmentDto {
        private String speaker;
        private String voice;
        private String text;
        private Integer startMs;
        private Integer endMs;
    }
}

