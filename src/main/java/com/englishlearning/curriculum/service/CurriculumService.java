package com.englishlearning.curriculum.service;

import com.englishlearning.curriculum.dto.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface CurriculumService {

    LessonResponse createLesson(LessonRequest request);

    List<LessonResponse> getLessonsByClass(UUID classId);

    LessonDetailResponse getLessonDetail(UUID lessonId);

    LessonResponse updateLesson(UUID lessonId, LessonUpdateRequest request);

    void deleteLesson(UUID lessonId);

    DocumentResponse uploadLessonDocument(UUID lessonId, MultipartFile file, String fileTypeStr);

    List<DocumentResponse> getDocumentsByLesson(UUID lessonId);

    DocumentResponse updateDocument(UUID documentId, DocumentUpdateRequest request);

    DocumentResponse replaceDocumentFile(UUID documentId, MultipartFile file, String fileName, String fileTypeStr);

    void deleteDocument(UUID documentId);

    List<GrammarTopicResponse> getGrammarTopicsByLesson(UUID lessonId);

    GrammarTopicResponse addGrammarTopic(UUID lessonId, GrammarTopicRequest request);

    GrammarTopicResponse updateGrammarTopic(UUID topicId, GrammarTopicRequest request);

    void deleteGrammarTopic(UUID topicId);
}
