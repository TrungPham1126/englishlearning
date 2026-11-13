package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.VocabularyItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface VocabularyItemRepository extends JpaRepository<VocabularyItem, UUID> {
    List<VocabularyItem> findByLessonId(UUID lessonId);

    @Query("SELECT v.id FROM VocabularyItem v WHERE v.lesson.id IN :lessonIds")
    List<UUID> findIdsByLessonIdIn(@Param("lessonIds") Collection<UUID> lessonIds);

    @Modifying
    @Query("DELETE FROM VocabularyItem v WHERE v.id IN :ids")
    int deleteByIdIn(@Param("ids") Collection<UUID> ids);
}
