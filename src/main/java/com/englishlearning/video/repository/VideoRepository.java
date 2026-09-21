package com.englishlearning.video.repository;

import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VideoRepository extends JpaRepository<Video, UUID> {
    List<Video> findByStatus(VideoStatus status);

    // Thêm hàm này để tìm video theo lessonId
    Optional<Video> findByLessonId(UUID lessonId);
}