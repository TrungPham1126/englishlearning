package com.englishlearning.video.repository;

import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VideoRepository extends JpaRepository<Video, UUID> {
    List<Video> findByStatus(VideoStatus status);

    List<Video> findByUploadedByIdOrderByCreatedAtDesc(UUID uploadedById);

    List<Video> findByUploadedByIdAndStatusOrderByCreatedAtDesc(UUID uploadedById, VideoStatus status);

    Optional<Video> findByLessonId(UUID lessonId);

    List<Video> findByLessonIdIn(Collection<UUID> lessonIds);

    @Query("SELECT v.uploadedBy.id FROM Video v WHERE v.id = :id")
    Optional<UUID> findUploadedById(@Param("id") UUID id);

    @Modifying
    @Query("DELETE FROM Video v WHERE v.id IN :ids")
    int deleteByIdIn(@Param("ids") Collection<UUID> ids);
}
