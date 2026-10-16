package com.englishlearning.ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TtsRequest {

    @NotBlank(message = "Nội dung văn bản không được để trống")
    private String text;

    @Builder.Default
    private String voice = "af_heart";

    @Builder.Default
    private Double speed = 1.0;
}

