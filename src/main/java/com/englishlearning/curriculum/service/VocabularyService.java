package com.englishlearning.curriculum.service;

import com.englishlearning.curriculum.dto.VocabularyRequest;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.VocabularyItem;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.repository.VocabularyItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VocabularyService {
    private final VocabularyItemRepository vocabularyRepository;
    private final LessonRepository lessonRepository;

    @Transactional
    public VocabularyResponse addVocabulary(UUID lessonId, VocabularyRequest request) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bài học"));

        VocabularyItem vocabulary = VocabularyItem.builder()
                .lesson(lesson)
                .word(request.getWord())
                .meaning(request.getMeaning())
                .ipa(request.getIpa())
                .exampleSentence(request.getExampleSentence())
                .partOfSpeech(request.getPartOfSpeech())
                .build();

        VocabularyItem saved = vocabularyRepository.save(vocabulary);
        return mapToResponse(saved);
    }

    public List<VocabularyResponse> getVocabulariesByLesson(UUID lessonId) {
        return vocabularyRepository.findByLessonId(lessonId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private VocabularyResponse mapToResponse(VocabularyItem item) {
        return VocabularyResponse.builder()
                .id(item.getId())
                .lessonId(item.getLesson().getId())
                .word(item.getWord())
                .meaning(item.getMeaning())
                .ipa(item.getIpa())
                .exampleSentence(item.getExampleSentence())
                .partOfSpeech(item.getPartOfSpeech())
                .build();
    }
}