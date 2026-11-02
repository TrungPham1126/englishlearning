package com.englishlearning.submission.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
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

        @JsonAlias({"answerText", "textResponse"})
        private String textAnswer;

        private String answerText;

        public String getTextAnswer() {
            if (textAnswer != null && !textAnswer.isBlank()) {
                return textAnswer;
            }
            return answerText;
        }

        public String getAnswerText() {
            return getTextAnswer();
        }
    }
}
