package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.LessonDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface LessonDocumentRepository extends JpaRepository<LessonDocument, UUID> {
    List<LessonDocument> findByLessonId(UUID lessonId);

    List<LessonDocument> findByLessonIdIn(Collection<UUID> lessonIds);

    @Modifying
    @Query("DELETE FROM LessonDocument ld WHERE ld.lesson.id IN :lessonIds")
    int deleteByLessonIdIn(@Param("lessonIds") Collection<UUID> lessonIds);
}
