package com.englishlearning.analytics.service;

import com.englishlearning.analytics.dto.AdminDashboardStats;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.video.entity.VideoStatus;
import com.englishlearning.video.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {
    private final UserRepository userRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final ClassroomRepository classroomRepository;
    private final LessonRepository lessonRepository;
    private final VideoRepository videoRepository;
    private final AssignmentRepository assignmentRepository;

    @Transactional(readOnly = true)
    public AdminDashboardStats getDashboardStats() {
        long pendingVideosCount = videoRepository.findByStatus(VideoStatus.PENDING_REVIEW).size();

        return AdminDashboardStats.builder()
                .totalUsers(userRepository.count())
                .totalTeachers(teacherRepository.count())
                .totalStudents(studentRepository.count())
                .totalClasses(classroomRepository.count())
                .totalLessons(lessonRepository.count())
                .totalVideos(videoRepository.count())
                .pendingVideos(pendingVideosCount)
                .totalAssignments(assignmentRepository.count())
                .build();
    }
}