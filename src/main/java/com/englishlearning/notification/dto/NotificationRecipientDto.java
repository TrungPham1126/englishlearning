package com.englishlearning.notification.dto;

import lombok.*;
import java.io.Serializable;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationRecipientDto implements Serializable {
    private UUID id;
    private String fullName;
    private String email;
    private String role;
    private String avatarUrl;
}
