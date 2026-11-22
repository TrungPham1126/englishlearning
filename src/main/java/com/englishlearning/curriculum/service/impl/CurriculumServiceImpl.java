package com.englishlearning.curriculum.service.impl;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.*;
import com.englishlearning.curriculum.entity.*;
import com.englishlearning.curriculum.repository.*;
import com.englishlearning.curriculum.service.CurriculumService;
import com.englishlearning.notification.dto.NotificationDto;
import com.englishlearning.notification.service.NotificationService;
import com.englishlearning.curriculum.service.DocumentStorageService;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CurriculumServiceImpl implements CurriculumService {

    private final LessonRepository lessonRepository;
    private final NotificationService notificationService;
    private final ClassroomRepository classroomRepository;
    private final LessonDocumentRepository documentRepository;
    private final GrammarTopicRepository grammarTopicRepository;
    private final VocabularyItemRepository vocabularyRepository;
    private final DocumentStorageService storageService;
    private final VideoRepository videoRepository;
    private final VideoWatchHistoryRepository watchHistoryRepository;
    private final AssignmentRepository assignmentRepository;
    private final AssignmentAttemptRepository attemptRepository;

    @Transactional
    public LessonResponse createLesson(LessonRequest request) {
        Classroom classroom = classroomRepository.findById(request.getClassId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học"));

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
        UUID studentId = getCurrentStudentId();
        return lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId)
                .stream().map(lesson -> {
                    LessonProgressData progress = computeLessonProgress(lesson.getId(), studentId);
                    return mapToLessonResponse(lesson, progress);
                }).collect(Collectors.toList());
    }

    // 1. Xem chi tiết toàn diện bài học kèm tiến độ thực tế
    public LessonDetailResponse getLessonDetail(UUID lessonId) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học"));

        List<DocumentResponse> docs = documentRepository.findByLessonId(lessonId).stream()
                .map(this::mapToDocumentResponse).collect(Collectors.toList());

        List<VocabularyResponse> vocabs = vocabularyRepository.findByLessonId(lessonId).stream()
                .map(v -> VocabularyResponse.builder()
                        .id(v.getId())
                        .lessonId(lessonId)
                        .word(v.getWord())
                        .meaning(v.getMeaning())
                        .ipa(v.getIpa())
                        .audioUrl(v.getAudioUrl())
                        .exampleSentence(v.getExampleSentence())
                        .partOfSpeech(v.getPartOfSpeech())
                        .build())
                .collect(Collectors.toList());

        List<GrammarTopicResponse> grammars = grammarTopicRepository.findByLessonId(lessonId).stream()
                .map(this::mapToGrammarResponse).collect(Collectors.toList());

        UUID studentId = getCurrentStudentId();
        LessonProgressData progress = computeLessonProgress(lessonId, studentId);

        return LessonDetailResponse.builder()
                .id(lesson.getId())
                .classId(lesson.getClassroom().getId())
                .title(lesson.getTitle())
                .objectives(lesson.getObjectives())
                .content(lesson.getContent())
                .orderIndex(lesson.getOrderIndex())
                .updatedAt(lesson.getUpdatedAt() != null
                        ? LocalDateTime.ofInstant(lesson.getUpdatedAt(), ZoneId.systemDefault())
                        : null)
                .documents(docs)
                .vocabularies(vocabs)
                .grammarTopics(grammars)
                .completed(progress.completed)
                .progressPercentage(progress.progressPercentage)
                .watchedSeconds(progress.watchedSeconds)
                .build();
    }

    // 2. Chỉnh sửa thông tin bài học
    @Transactional
    public LessonResponse updateLesson(UUID lessonId, LessonUpdateRequest request) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học"));

        lesson.setTitle(request.getTitle());
        lesson.setObjectives(request.getObjectives());
        lesson.setContent(request.getContent());
        if (request.getOrderIndex() != null) {
            lesson.setOrderIndex(request.getOrderIndex());
        }

        return mapToLessonResponse(lessonRepository.save(lesson));
    }

    // 3. Xóa bài học
    @Transactional
    public void deleteLesson(UUID lessonId) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học"));
        lessonRepository.delete(lesson);
    }

    // 4. Upload tài liệu
    @Transactional
    public DocumentResponse uploadLessonDocument(UUID lessonId, MultipartFile file, String fileTypeStr) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File tài liệu không được để trống");
        }
        DocumentType fileType = parseDocumentType(fileTypeStr);
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học"));

        String fileUrl = storageService.uploadFile(file);

        LessonDocument document = LessonDocument.builder()
                .lesson(lesson)
                .fileName(file.getOriginalFilename())
                .storageUrl(fileUrl)
                .fileType(fileType)
                .fileSizeBytes(file.getSize())
                .build();

        return mapToDocumentResponse(documentRepository.save(document));
    }

    public List<DocumentResponse> getDocumentsByLesson(UUID lessonId) {
        return documentRepository.findByLessonId(lessonId).stream()
                .map(this::mapToDocumentResponse).collect(Collectors.toList());
    }

    @Transactional
    public DocumentResponse updateDocument(UUID documentId, DocumentUpdateRequest request) {
        if (request == null || request.getFileName() == null || request.getFileName().isBlank()) {
            throw new BadRequestException("Tên tài liệu không được để trống");
        }
        LessonDocument doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu"));

        doc.setFileName(request.getFileName().trim());
        if (request.getFileType() != null && !request.getFileType().isBlank()) {
            doc.setFileType(parseDocumentType(request.getFileType()));
        }

        return mapToDocumentResponse(documentRepository.save(doc));
    }

    @Transactional
    public DocumentResponse replaceDocumentFile(UUID documentId, MultipartFile file, String fileName, String fileTypeStr) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File tài liệu thay thế không được để trống");
        }

        LessonDocument doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu"));

        String resolvedName = (fileName != null && !fileName.isBlank())
                ? fileName.trim()
                : (file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()
                        ? file.getOriginalFilename()
                        : doc.getFileName());

        DocumentType resolvedType = (fileTypeStr != null && !fileTypeStr.isBlank())
                ? parseDocumentType(fileTypeStr)
                : inferDocumentTypeFromFilename(
                        file.getOriginalFilename() != null ? file.getOriginalFilename() : resolvedName,
                        doc.getFileType());

        String oldUrl = doc.getStorageUrl();
        String newUrl = storageService.uploadFile(file);

        doc.setFileName(resolvedName);
        doc.setStorageUrl(newUrl);
        doc.setFileType(resolvedType);
        doc.setFileSizeBytes(file.getSize());

        LessonDocument saved = documentRepository.save(doc);

        if (oldUrl != null && !oldUrl.isBlank() && !oldUrl.equals(newUrl)) {
            try {
                storageService.deleteFileByUrl(oldUrl);
            } catch (Exception ex) {
                log.warn("Không thể xóa file tài liệu cũ {}: {}", oldUrl, ex.getMessage());
            }
        }

        return mapToDocumentResponse(saved);
    }

    @Transactional
    public void deleteDocument(UUID documentId) {
        LessonDocument doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu"));
        String storageUrl = doc.getStorageUrl();
        documentRepository.delete(doc);
        if (storageUrl != null && !storageUrl.isBlank()) {
            try {
                storageService.deleteFileByUrl(storageUrl);
            } catch (Exception ex) {
                log.warn("Không thể xóa file tài liệu khỏi storage {}: {}", storageUrl, ex.getMessage());
            }
        }
    }

    private DocumentType parseDocumentType(String fileTypeStr) {
        if (fileTypeStr == null || fileTypeStr.isBlank()) {
            throw new BadRequestException("Loại tài liệu không được để trống");
        }
        try {
            return DocumentType.valueOf(fileTypeStr.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Loại tài liệu không hợp lệ: " + fileTypeStr);
        }
    }

    private DocumentType inferDocumentTypeFromFilename(String filename, DocumentType fallback) {
        if (filename != null) {
            String lower = filename.trim().toLowerCase();
            if (lower.endsWith(".pdf")) {
                return DocumentType.PDF;
            }
            if (lower.endsWith(".doc") || lower.endsWith(".docx") || lower.endsWith(".txt")) {
                return DocumentType.DOCX;
            }
            if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) {
                return DocumentType.PPTX;
            }
            if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
                    || lower.endsWith(".webp") || lower.endsWith(".gif")) {
                return DocumentType.IMAGE;
            }
            if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".m4a")
                    || lower.endsWith(".ogg") || lower.endsWith(".aac")) {
                return DocumentType.AUDIO;
            }
        }
        return fallback != null ? fallback : DocumentType.PDF;
    }

    // 5. Quản lý Grammar Topic
    public List<GrammarTopicResponse> getGrammarTopicsByLesson(UUID lessonId) {
        return grammarTopicRepository.findByLessonId(lessonId).stream()
                .map(this::mapToGrammarResponse).collect(Collectors.toList());
    }

    @Transactional
    public GrammarTopicResponse addGrammarTopic(UUID lessonId, GrammarTopicRequest request) {
        if (request == null || request.getTitle() == null || request.getTitle().isBlank()
                || request.getRuleSummary() == null || request.getRuleSummary().isBlank()) {
            throw new BadRequestException("Tiêu đề và tóm tắt ngữ pháp không được để trống");
        }
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học"));

        GrammarTopic topic = GrammarTopic.builder()
                .lesson(lesson)
                .title(request.getTitle())
                .ruleSummary(request.getRuleSummary())
                .formula(request.getFormula())
                .examples(request.getExamples())
                .build();

        return mapToGrammarResponse(grammarTopicRepository.save(topic));
    }

    @Transactional
    public GrammarTopicResponse updateGrammarTopic(UUID topicId, GrammarTopicRequest request) {
        if (request == null || request.getTitle() == null || request.getTitle().isBlank()
                || request.getRuleSummary() == null || request.getRuleSummary().isBlank()) {
            throw new BadRequestException("Tiêu đề và tóm tắt ngữ pháp không được để trống");
        }
        GrammarTopic topic = grammarTopicRepository.findById(topicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chủ điểm ngữ pháp"));

        topic.setTitle(request.getTitle().trim());
        topic.setRuleSummary(request.getRuleSummary().trim());
        topic.setFormula(request.getFormula() != null ? request.getFormula().trim() : null);
        topic.setExamples(request.getExamples() != null ? request.getExamples().trim() : null);

        return mapToGrammarResponse(grammarTopicRepository.save(topic));
    }

    @Transactional
    public void deleteGrammarTopic(UUID topicId) {
        GrammarTopic topic = grammarTopicRepository.findById(topicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chủ điểm ngữ pháp"));
        grammarTopicRepository.delete(topic);
    }

    private UUID getCurrentStudentId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof CustomUserDetails userDetails) {
                boolean isStudent = userDetails.getAuthorities().stream()
                        .anyMatch(a -> a.getAuthority().contains("STUDENT"));
                if (isStudent) {
                    return userDetails.getId();
                }
            }
        } catch (Exception e) {
            log.debug("Không tìm thấy thông tin học viên đang đăng nhập: {}", e.getMessage());
        }
        return null;
    }

    private static class LessonProgressData {
        final boolean completed;
        final int progressPercentage;
        final int watchedSeconds;
        final boolean hasVideo;
        final Video video;

        LessonProgressData(boolean completed, int progressPercentage, int watchedSeconds, boolean hasVideo, Video video) {
            this.completed = completed;
            this.progressPercentage = progressPercentage;
            this.watchedSeconds = watchedSeconds;
            this.hasVideo = hasVideo;
            this.video = video;
        }
    }

    private LessonProgressData computeLessonProgress(UUID lessonId, UUID studentId) {
        // 1. Kiểm tra Video của bài học (trả chính xác hasVideo + video metadata ngay cả với teacher/guest)
        Optional<Video> videoOpt = (lessonId != null) ? videoRepository.findByLessonId(lessonId) : Optional.empty();
        Video lessonVideo = videoOpt.orElse(null);
        boolean hasVideo = lessonVideo != null;

        if (studentId == null) {
            return new LessonProgressData(false, 0, 0, hasVideo, lessonVideo);
        }

        int watchedSeconds = 0;
        float videoPercent = 0.0f;
        boolean videoCompleted = false;

        if (hasVideo) {
            Optional<VideoWatchHistory> historyOpt = watchHistoryRepository.findByStudentIdAndVideoId(studentId, lessonVideo.getId());
            if (historyOpt.isPresent()) {
                VideoWatchHistory history = historyOpt.get();
                watchedSeconds = history.getWatchedSeconds() != null ? history.getWatchedSeconds() : 0;
                videoPercent = history.getCompletionPercentage() != null ? history.getCompletionPercentage() : 0.0f;
                videoCompleted = Boolean.TRUE.equals(history.getIsCompleted());

                if (!videoCompleted && lessonVideo.getDurationSeconds() != null && lessonVideo.getDurationSeconds() > 0) {
                    videoPercent = ((float) watchedSeconds / lessonVideo.getDurationSeconds()) * 100.0f;
                    if (videoPercent >= 80.0f) {
                        videoCompleted = true;
                    }
                }
            }
        }

        // 2. Kiểm tra Assignments của bài học
        List<Assignment> assignments = assignmentRepository.findByLessonId(lessonId);
        boolean hasAssignments = !assignments.isEmpty();
        int completedAssignmentsCount = 0;

        for (Assignment assignment : assignments) {
            List<AssignmentAttempt> attempts = attemptRepository.findByStudentIdAndAssignmentId(studentId, assignment.getId());
            boolean done = attempts != null && attempts.stream()
                    .anyMatch(a -> a != null && a.getStatus() != null && a.getStatus() != AttemptStatus.IN_PROGRESS);
            if (done) {
                completedAssignmentsCount++;
            }
        }

        // 3. Tính toán tổng hợp % tiến độ và trạng thái hoàn thành
        int progressPercentage = 0;
        boolean completed = false;

        if (hasVideo && hasAssignments) {
            double vRate = videoCompleted ? 100.0 : Math.max(0.0, Math.min(100.0, videoPercent));
            double aRate = (completedAssignmentsCount * 100.0) / assignments.size();
            progressPercentage = (int) Math.round((vRate + aRate) / 2.0);
            completed = videoCompleted && (completedAssignmentsCount == assignments.size());
        } else if (hasVideo) {
            progressPercentage = (int) Math.max(0, Math.min(100, Math.round(videoPercent)));
            completed = videoCompleted;
        } else if (hasAssignments) {
            progressPercentage = (int) Math.round((completedAssignmentsCount * 100.0) / assignments.size());
            completed = completedAssignmentsCount == assignments.size();
        } else {
            progressPercentage = 0;
            completed = false;
        }

        if (completed) {
            progressPercentage = 100;
        } else if (progressPercentage >= 100) {
            completed = true;
        }

        return new LessonProgressData(completed, progressPercentage, watchedSeconds, hasVideo, lessonVideo);
    }

    // Các hàm mapping
    private LessonResponse mapToLessonResponse(Lesson lesson, LessonProgressData progress) {
        UUID lessonId = lesson.getId();
        Video lessonVideo = (progress != null)
                ? progress.video
                : (lessonId != null ? videoRepository.findByLessonId(lessonId).orElse(null) : null);
        boolean hasVideo = (progress != null) ? progress.hasVideo : (lessonVideo != null);
        List<LessonDocument> docs = (lessonId != null) ? documentRepository.findByLessonId(lessonId) : null;
        List<VocabularyItem> vocabs = (lessonId != null) ? vocabularyRepository.findByLessonId(lessonId) : null;
        List<GrammarTopic> grammars = (lessonId != null) ? grammarTopicRepository.findByLessonId(lessonId) : null;

        return LessonResponse.builder()
                .id(lessonId)
                .classId(lesson.getClassroom().getId())
                .title(lesson.getTitle())
                .objectives(lesson.getObjectives())
                .content(lesson.getContent())
                .orderIndex(lesson.getOrderIndex())
                .updatedAt(lesson.getUpdatedAt() != null
                        ? LocalDateTime.ofInstant(lesson.getUpdatedAt(), ZoneId.systemDefault())
                        : null)
                .completed(progress != null && progress.completed)
                .progressPercentage(progress != null ? progress.progressPercentage : 0)
                .watchedSeconds(progress != null ? progress.watchedSeconds : 0)
                .hasVideo(hasVideo)
                .videoId(lessonVideo != null ? lessonVideo.getId() : null)
                .videoStatus((lessonVideo != null && lessonVideo.getStatus() != null) ? lessonVideo.getStatus().name() : null)
                .videoRejectionReason(lessonVideo != null ? lessonVideo.getRejectionReason() : null)
                .documentsCount(docs != null ? docs.size() : 0)
                .vocabulariesCount(vocabs != null ? vocabs.size() : 0)
                .grammarTopicsCount(grammars != null ? grammars.size() : 0)
                .build();
    }

    private LessonResponse mapToLessonResponse(Lesson lesson) {
        return mapToLessonResponse(lesson, null);
    }

    private DocumentResponse mapToDocumentResponse(LessonDocument doc) {
        return DocumentResponse.builder()
                .id(doc.getId())
                .lessonId(doc.getLesson().getId())
                .fileName(doc.getFileName())
                .fileUrl(doc.getStorageUrl())
                .fileSizeBytes(doc.getFileSizeBytes())
                .fileType(doc.getFileType().name())
                .createdAt(doc.getCreatedAt() != null
                        ? LocalDateTime.ofInstant(doc.getCreatedAt(), ZoneId.systemDefault())
                        : null)
                .build();
    }

    private GrammarTopicResponse mapToGrammarResponse(GrammarTopic topic) {
        return GrammarTopicResponse.builder()
                .id(topic.getId())
                .lessonId(topic.getLesson().getId())
                .title(topic.getTitle())
                .ruleSummary(topic.getRuleSummary())
                .formula(topic.getFormula())
                .examples(topic.getExamples())
                .build();
    }
}
