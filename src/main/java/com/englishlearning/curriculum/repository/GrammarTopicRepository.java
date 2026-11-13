package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.GrammarTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface GrammarTopicRepository extends JpaRepository<GrammarTopic, UUID> {
    List<GrammarTopic> findByLessonId(UUID lessonId);

    @Modifying
    @Query("DELETE FROM GrammarTopic gt WHERE gt.lesson.id IN :lessonIds")
    int deleteByLessonIdIn(@Param("lessonIds") Collection<UUID> lessonIds);
}
