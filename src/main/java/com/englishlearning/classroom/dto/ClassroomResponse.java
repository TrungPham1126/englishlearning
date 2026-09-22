package com.englishlearning.classroom.dto;

import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStatus;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter
@Setter
@Builder
public class ClassroomResponse {
    private UUID id;
    private String name;
    private String description;
    private ClassLevel level;
    private ClassStatus status;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer maxStudents;
    private long currentStudentsCount;
    private UUID teacherId;
    private String teacherName;
    private Instant createdAt;
}