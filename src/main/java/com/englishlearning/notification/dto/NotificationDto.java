package com.englishlearning.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDto implements Serializable {
    private UUID recipientUserId;
    private UUID classroomId;
    private String title;
    private String message;
    private String content;
    @Builder.Default
    private String notificationType = "ANNOUNCEMENT";
    private String redirectUrl;
    private String targetUrl;
    private String targetAudience;

    public String getEffectiveMessage() {
        if (message != null && !message.trim().isEmpty()) {
            return message.trim();
        }
        if (content != null && !content.trim().isEmpty()) {
            return content.trim();
        }
        return "";
    }
}