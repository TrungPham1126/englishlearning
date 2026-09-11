package com.englishlearning.auth.dto;

import com.englishlearning.auth.entity.RoleName;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserUpdateRequest {
    @NotBlank(message = "Tên không được để trống")
    private String firstName;

    @NotBlank(message = "Họ không được để trống")
    private String lastName;

    private String phone;
    private Boolean isActive;
    private Set<RoleName> roles;
}