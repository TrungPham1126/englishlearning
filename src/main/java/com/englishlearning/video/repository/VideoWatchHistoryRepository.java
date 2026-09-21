package com.englishlearning.video.repository;

import com.englishlearning.video.entity.VideoWatchHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface VideoWatchHistoryRepository extends JpaRepository<VideoWatchHistory, UUID> {
    Optional<VideoWatchHistory> findByStudentIdAndVideoId(UUID studentId, UUID videoId);
}