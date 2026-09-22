package com.englishlearning.classroom.dto;

import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStatus;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Builder
public class MyCourseResponse {
    private UUID classId;
    private String className;
    private ClassLevel level;
    private ClassStatus status;
    private String teacherName;
    private Instant enrolledAt;
    private double progressPercentage;
}