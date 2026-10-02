package com.englishlearning.curriculum.service;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.dto.VocabularyResponse;
import com.englishlearning.curriculum.entity.SpacedRepetitionStage;
import com.englishlearning.curriculum.entity.StudentVocabularyProgress;
import com.englishlearning.curriculum.entity.VocabularyItem;
import com.englishlearning.curriculum.repository.StudentVocabularyProgressRepository;
import com.englishlearning.curriculum.repository.VocabularyItemRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SrsService {
    private final StudentVocabularyProgressRepository progressRepository;
    private final VocabularyItemRepository vocabularyRepository;
    private final EntityManager entityManager;

    public PageResponse<VocabularyResponse> getDueVocabularies(UUID studentId, int limit) {
        return PageResponse.from(progressRepository.findDueCards(studentId, Instant.now(), PageRequest.of(0, limit))
                .map(p -> VocabularyResponse.builder()
                        .id(p.getVocabulary().getId())
                        .word(p.getVocabulary().getWord())
                        .meaning(p.getVocabulary().getMeaning())
                        .ipa(p.getVocabulary().getIpa())
                        .exampleSentence(p.getVocabulary().getExampleSentence())
                        .partOfSpeech(p.getVocabulary().getPartOfSpeech())
                        .build()));
    }

    @Transactional
    public void reviewVocabulary(UUID studentId, UUID vocabularyId, int grade) {
        // grade: 0 (Again), 1 (Hard), 2 (Good), 3 (Easy) - Dựa trên thuật toán
        // SuperMemo SM-2
        StudentVocabularyProgress progress = progressRepository.findByStudentIdAndVocabularyId(studentId, vocabularyId)
                .orElseGet(() -> StudentVocabularyProgress.builder()
                        .student(entityManager.getReference(Student.class, studentId))
                        .vocabulary(entityManager.getReference(VocabularyItem.class, vocabularyId))
                        .build());

        int repetitions = progress.getRepetitions();
        double easeFactor = progress.getEaseFactor();
        int interval = progress.getIntervalDays();

        if (grade < 1) { // Fail (Again)
            repetitions = 0;
            interval = 1;
        } else { // Pass
            if (repetitions == 0) {
                interval = 1;
            } else if (repetitions == 1) {
                interval = 6;
            } else {
                interval = (int) Math.round(interval * easeFactor);
            }
            repetitions++;
        }

        easeFactor = easeFactor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02));
        if (easeFactor < 1.3)
            easeFactor = 1.3;

        progress.setRepetitions(repetitions);
        progress.setEaseFactor(easeFactor);
        progress.setIntervalDays(interval);
        progress.setNextReviewAt(Instant.now().plus(interval, ChronoUnit.DAYS));

        if (interval > 21) {
            progress.setStage(SpacedRepetitionStage.MASTERED);
        } else if (interval > 5) {
            progress.setStage(SpacedRepetitionStage.REVIEWING);
        } else {
            progress.setStage(SpacedRepetitionStage.LEARNING);
        }

        progressRepository.save(progress);
    }
}