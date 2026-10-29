package com.englishlearning.curriculum.service.impl;

import com.englishlearning.curriculum.service.*;

import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.VocabularyRequest;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.VocabularyItem;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.repository.VocabularyItemRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VocabularyServiceImpl implements VocabularyService {

    private final VocabularyItemRepository vocabularyRepository;
    private final LessonRepository lessonRepository;
    private final DictionaryLookupService dictionaryLookupService;

    @Transactional
    public VocabularyResponse addVocabulary(UUID lessonId, VocabularyRequest request) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học"));

        String cleanWord = request.getWord() != null ? request.getWord().trim() : "";
        DictionaryLookupService.DictionaryEntryDto info = dictionaryLookupService.lookup(cleanWord);

        // Ưu tiên dữ liệu giáo viên nhập, nếu bỏ trống thì dùng dữ liệu tự động cào
        String ipa = (request.getIpa() != null && !request.getIpa().isBlank())
                ? request.getIpa().trim()
                : (info != null ? info.getIpa() : "");

        String meaning = (request.getMeaning() != null && !request.getMeaning().isBlank())
                ? request.getMeaning().trim()
                : (info != null ? info.getMeaning() : "");

        String partOfSpeech = (request.getPartOfSpeech() != null && !request.getPartOfSpeech().isBlank())
                ? request.getPartOfSpeech().trim()
                : (info != null ? info.getPartOfSpeech() : "noun");

        String exampleSentence = (request.getExampleSentence() != null && !request.getExampleSentence().isBlank())
                ? request.getExampleSentence().trim()
                : (info != null ? info.getExampleSentence() : "");

        String audioUrl = info != null ? info.getAudioUrl() : null;

        VocabularyItem vocabulary = VocabularyItem.builder()
                .lesson(lesson)
                .word(cleanWord)
                .meaning(meaning)
                .ipa(ipa)
                .audioUrl(audioUrl)
                .exampleSentence(exampleSentence)
                .partOfSpeech(partOfSpeech)
                .build();

        return mapToResponse(vocabularyRepository.save(vocabulary));
    }

    public List<VocabularyResponse> getVocabulariesByLesson(UUID lessonId) {
        return vocabularyRepository.findByLessonId(lessonId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public VocabularyResponse updateVocabulary(UUID id, VocabularyRequest request) {
        VocabularyItem item = vocabularyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy từ vựng"));

        String cleanWord = request.getWord() != null ? request.getWord().trim() : item.getWord();
        item.setWord(cleanWord);

        // Nếu IPA hoặc Audio đang trống, tự động bổ sung
        if (request.getIpa() != null && !request.getIpa().isBlank()) {
            item.setIpa(request.getIpa().trim());
        } else if (item.getIpa() == null || item.getIpa().isBlank()) {
            DictionaryLookupService.DictionaryEntryDto info = dictionaryLookupService.lookup(cleanWord);
            if (info != null) {
                item.setIpa(info.getIpa());
                if (item.getAudioUrl() == null || item.getAudioUrl().isBlank()) {
                    item.setAudioUrl(info.getAudioUrl());
                }
            }
        }

        if (request.getMeaning() != null && !request.getMeaning().isBlank()) {
            item.setMeaning(request.getMeaning().trim());
        }
        if (request.getExampleSentence() != null && !request.getExampleSentence().isBlank()) {
            item.setExampleSentence(request.getExampleSentence().trim());
        }
        if (request.getPartOfSpeech() != null && !request.getPartOfSpeech().isBlank()) {
            item.setPartOfSpeech(request.getPartOfSpeech().trim());
        }

        return mapToResponse(vocabularyRepository.save(item));
    }

    @Transactional
    public void deleteVocabulary(UUID id) {
        VocabularyItem item = vocabularyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy từ vựng"));
        vocabularyRepository.delete(item);
    }

    private VocabularyResponse mapToResponse(VocabularyItem item) {
        return VocabularyResponse.builder()
                .id(item.getId())
                .lessonId(item.getLesson().getId())
                .word(item.getWord())
                .meaning(item.getMeaning())
                .ipa(item.getIpa())
                .audioUrl(item.getAudioUrl())
                .exampleSentence(item.getExampleSentence())
                .partOfSpeech(item.getPartOfSpeech())
                .build();
    }
}