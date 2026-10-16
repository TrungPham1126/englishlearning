package com.englishlearning.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TtsResponse implements Serializable {

    private static final long serialVersionUID = 1L;

    private String audioUrl;
    private String voice;
    private Double speed;
    private Double durationSeconds;
    private boolean cached;
}

