package com.englishlearning.video.repository;

import com.englishlearning.video.entity.VideoWatchHistory;
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
public interface VideoWatchHistoryRepository extends JpaRepository<VideoWatchHistory, UUID> {
    Optional<VideoWatchHistory> findByStudentIdAndVideoId(UUID studentId, UUID videoId);

    List<VideoWatchHistory> findByStudentId(UUID studentId);

    Optional<VideoWatchHistory> findByStudentIdAndVideo_LessonId(UUID studentId, UUID lessonId);

    List<VideoWatchHistory> findByStudentIdAndIsCompletedTrue(UUID studentId);

    long countByVideoIdIn(Collection<UUID> videoIds);

    long countByVideoIdInAndStudentIdIn(Collection<UUID> videoIds, Collection<UUID> studentIds);

    @Modifying
    @Query("DELETE FROM VideoWatchHistory vwh WHERE vwh.video.id IN :videoIds")
    int deleteByVideoIdIn(@Param("videoIds") Collection<UUID> videoIds);

    @Modifying
    @Query("DELETE FROM VideoWatchHistory vwh WHERE vwh.video.id IN :videoIds AND vwh.student.id IN :studentIds")
    int deleteByVideoIdInAndStudentIdIn(@Param("videoIds") Collection<UUID> videoIds, @Param("studentIds") Collection<UUID> studentIds);
}
