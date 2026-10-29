package com.englishlearning.submission.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmissionRequest {
    @NotNull
    private UUID assignmentId;

    @NotNull
    private List<AnswerDto> answers;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnswerDto {
        @NotNull
        private UUID questionId;
        private UUID selectedOptionId;
        private String textAnswer;
    }
}
