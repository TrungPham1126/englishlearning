package com.englishlearning.curriculum.service;

import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.entity.*;
import com.englishlearning.curriculum.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CurriculumService {

    private final LessonRepository lessonRepository;
    private final ClassroomRepository classroomRepository;
    private final LessonDocumentRepository documentRepository;
    private final DocumentStorageService storageService;

    @Transactional
    public LessonResponse createLesson(LessonRequest request) {
        Classroom classroom = classroomRepository.findById(request.getClassId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lớp học"));

        Lesson lesson = Lesson.builder()
                .classroom(classroom)
                .title(request.getTitle())
                .objectives(request.getObjectives())
                .content(request.getContent())
                .orderIndex(request.getOrderIndex() != null ? request.getOrderIndex() : 0)
                .build();

        return mapToLessonResponse(lessonRepository.save(lesson));
    }

    public List<LessonResponse> getLessonsByClass(UUID classId) {
        return lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId)
                .stream().map(this::mapToLessonResponse).collect(Collectors.toList());
    }

    @Transactional
    public DocumentResponse uploadLessonDocument(UUID lessonId, MultipartFile file, String fileTypeStr) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bài học"));

        String fileUrl = storageService.uploadFile(file);
        DocumentType fileType = DocumentType.valueOf(fileTypeStr.toUpperCase());

        LessonDocument document = LessonDocument.builder()
                .lesson(lesson)
                .fileName(file.getOriginalFilename())
                .storageUrl(fileUrl)
                .fileType(fileType)
                .fileSizeBytes(file.getSize())
                .build();

        LessonDocument saved = documentRepository.save(document);

        return DocumentResponse.builder()
                .id(saved.getId())
                .lessonId(lesson.getId())
                .fileName(saved.getFileName())
                .fileUrl(saved.getStorageUrl())
                .fileSizeBytes(saved.getFileSizeBytes())
                .fileType(saved.getFileType().name())
                .build();
    }

    private LessonResponse mapToLessonResponse(Lesson lesson) {
        return LessonResponse.builder()
                .id(lesson.getId())
                .classId(lesson.getClassroom().getId())
                .title(lesson.getTitle())
                .objectives(lesson.getObjectives())
                .content(lesson.getContent())
                .orderIndex(lesson.getOrderIndex())
                .updatedAt(lesson.getUpdatedAt() != null ?
                        LocalDateTime.ofInstant(lesson.getUpdatedAt(), ZoneId.systemDefault()) : null)
                .build();
    }
}