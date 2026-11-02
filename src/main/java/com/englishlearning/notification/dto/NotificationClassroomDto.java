package com.englishlearning.notification.dto;

import lombok.*;
import java.io.Serializable;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationClassroomDto implements Serializable {
    private UUID id;
    private String name;
    private String joinCode;
    private String teacherName;
    private int studentCount;
}
