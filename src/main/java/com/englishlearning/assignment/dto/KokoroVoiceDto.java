package com.englishlearning.assignment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KokoroVoiceDto {
    private String id;
    private String name;
    private String accent;
    private String gender;
    private String description;
    private String pipeline;
    private Boolean isDefault;
}

