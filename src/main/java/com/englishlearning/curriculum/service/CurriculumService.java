package com.englishlearning.curriculum.service;

import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.common.exception.ResourceNotFoundException;
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
        private final GrammarTopicRepository grammarTopicRepository;
        private final VocabularyItemRepository vocabularyRepository;
        private final DocumentStorageService storageService;

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
                return lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId)
                                .stream().map(this::mapToLessonResponse).collect(Collectors.toList());
        }

        // 1. Xem chi tiết toàn diện bài học
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

        // Các hàm mapping
        private LessonResponse mapToLessonResponse(Lesson lesson) {
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
                                .build();
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