package com.englishlearning.curriculum.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SectionGroupDto {
    private String sectionName; // "A. LISTENING & READING (Bắt buộc)"
    private List<TaskItemDto> items;
}