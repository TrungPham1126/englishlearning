package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.VocabularyItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface VocabularyItemRepository extends JpaRepository<VocabularyItem, UUID> {
    List<VocabularyItem> findByLessonId(UUID lessonId);
}