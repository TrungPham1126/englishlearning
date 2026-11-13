package com.englishlearning.curriculum.repository;

import com.englishlearning.curriculum.entity.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface LessonRepository extends JpaRepository<Lesson, UUID> {
    List<Lesson> findByClassroomIdOrderByOrderIndexAsc(UUID classroomId);

    @Modifying
    @Query("DELETE FROM Lesson l WHERE l.id IN :ids")
    int deleteByIdIn(@Param("ids") Collection<UUID> ids);
}
