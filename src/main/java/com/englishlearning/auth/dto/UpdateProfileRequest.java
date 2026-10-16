package com.englishlearning.auth.dto;

import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String firstName;
    private String lastName;
    private String phone;
    private String targetCefr;
    private String currentLevel;
}

