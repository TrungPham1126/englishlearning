package com.englishlearning.submission.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
public class SubmissionRequest {
    @NotNull
    private UUID assignmentId;

    @NotNull
    private List<AnswerDto> answers;

    @Data
    public static class AnswerDto {
        @NotNull
        private UUID questionId;
        private UUID selectedOptionId;
        private String textAnswer;
    }
}