package com.englishlearning.curriculum.service.impl;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassroomRepository;
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
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học"));

        String fileUrl = storageService.uploadFile(file);
        DocumentType fileType = DocumentType.valueOf(fileTypeStr.toUpperCase());

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
    public void deleteDocument(UUID documentId) {
        LessonDocument doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu"));
        documentRepository.delete(doc);
    }

    // 5. Quản lý Grammar Topic
    public List<GrammarTopicResponse> getGrammarTopicsByLesson(UUID lessonId) {
        return grammarTopicRepository.findByLessonId(lessonId).stream()
                .map(this::mapToGrammarResponse).collect(Collectors.toList());
    }

    @Transactional
    public GrammarTopicResponse addGrammarTopic(UUID lessonId, GrammarTopicRequest request) {
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

        LessonProgressData(boolean completed, int progressPercentage, int watchedSeconds) {
            this.completed = completed;
            this.progressPercentage = progressPercentage;
            this.watchedSeconds = watchedSeconds;
        }
    }

    private LessonProgressData computeLessonProgress(UUID lessonId, UUID studentId) {
        if (studentId == null) {
            return new LessonProgressData(false, 0, 0);
        }

        // 1. Kiểm tra Video của bài học
        Optional<Video> videoOpt = videoRepository.findByLessonId(lessonId);
        boolean hasVideo = videoOpt.isPresent();
        int watchedSeconds = 0;
        float videoPercent = 0.0f;
        boolean videoCompleted = false;

        if (hasVideo) {
            Video video = videoOpt.get();
            Optional<VideoWatchHistory> historyOpt = watchHistoryRepository.findByStudentIdAndVideoId(studentId, video.getId());
            if (historyOpt.isPresent()) {
                VideoWatchHistory history = historyOpt.get();
                watchedSeconds = history.getWatchedSeconds() != null ? history.getWatchedSeconds() : 0;
                videoPercent = history.getCompletionPercentage() != null ? history.getCompletionPercentage() : 0.0f;
                videoCompleted = Boolean.TRUE.equals(history.getIsCompleted());

                if (!videoCompleted && video.getDurationSeconds() != null && video.getDurationSeconds() > 0) {
                    videoPercent = ((float) watchedSeconds / video.getDurationSeconds()) * 100.0f;
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
            boolean done = attempts.stream().anyMatch(a -> a.getStatus() != AttemptStatus.IN_PROGRESS);
            if (done) {
                completedAssignmentsCount++;
            }
        }

        // 3. Tính toán tổng hợp % tiến độ và trạng thái hoàn thành
        int progressPercentage = 0;
        boolean completed = false;

        if (hasVideo && hasAssignments) {
            double vRate = videoCompleted ? 100.0 : Math.min(100.0, videoPercent);
            double aRate = (completedAssignmentsCount * 100.0) / assignments.size();
            progressPercentage = (int) Math.round((vRate + aRate) / 2.0);
            completed = videoCompleted && (completedAssignmentsCount == assignments.size());
        } else if (hasVideo) {
            progressPercentage = (int) Math.min(100, Math.round(videoPercent));
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

        return new LessonProgressData(completed, progressPercentage, watchedSeconds);
    }

    // Các hàm mapping
    private LessonResponse mapToLessonResponse(Lesson lesson, LessonProgressData progress) {
        return LessonResponse.builder()
                .id(lesson.getId())
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
