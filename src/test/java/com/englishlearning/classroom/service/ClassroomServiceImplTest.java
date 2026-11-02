package com.englishlearning.classroom.service;

import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.classroom.dto.ClassroomResponse;
import com.englishlearning.classroom.dto.CreateClassroomRequest;
import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.classroom.service.impl.ClassroomServiceImpl;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ClassroomServiceImpl - Quản lý lớp học & Mã tham gia lớp (Join Code)")
class ClassroomServiceImplTest {

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private ClassStudentRepository classStudentRepository;

    @Mock
    private TeacherRepository teacherRepository;

    @Mock
    private StudentRepository studentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private DailyStudyPlanRepository dailyStudyPlanRepository;

    @Mock
    private DailyPlanItemRepository dailyPlanItemRepository;

    @Mock
    private StudentDailyProgressRepository studentDailyProgressRepository;

    @Mock
    private VideoWatchHistoryRepository videoWatchHistoryRepository;

    @Mock
    private AssignmentRepository assignmentRepository;

    @Mock
    private AssignmentAttemptRepository assignmentAttemptRepository;

    @Mock
    private LessonRepository lessonRepository;

    private ClassroomServiceImpl classroomService;

    private final UUID teacherId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID classId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID studentId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final String joinCode = "ENG-ABC123";

    @BeforeEach
    void setUp() {
        classroomService = new ClassroomServiceImpl(
                classroomRepository,
                classStudentRepository,
                teacherRepository,
                studentRepository,
                userRepository,
                entityManager,
                dailyStudyPlanRepository,
                dailyPlanItemRepository,
                studentDailyProgressRepository,
                videoWatchHistoryRepository,
                assignmentRepository,
                assignmentAttemptRepository,
                lessonRepository
        );
    }

    @Test
    @DisplayName("Tạo lớp học thành công và tự động sinh mã Join Code duy nhất")
    void should_CreateClassroomAndGenerateUniqueJoinCode_when_TeacherCreatesClass() {
        // Given
        CreateClassroomRequest req = CreateClassroomRequest.builder()
                .name("IELTS Intensive Speaking B2")
                .description("Lớp luyện nói chuyên sâu B2")
                .level(ClassLevel.B2)
                .teacherId(teacherId)
                .startDate(LocalDate.of(2026, 11, 1))
                .endDate(LocalDate.of(2027, 2, 1))
                .maxStudents(25)
                .build();

        Teacher teacher = new Teacher();
        teacher.setId(teacherId);

        when(classroomRepository.existsByNameIgnoreCase("IELTS Intensive Speaking B2")).thenReturn(false);
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(teacher));
        when(classroomRepository.existsByJoinCode(any())).thenReturn(false);

        when(classroomRepository.save(any(Classroom.class))).thenAnswer(invocation -> {
            Classroom c = invocation.getArgument(0);
            c.setId(classId);
            return c;
        });

        // When
        ClassroomResponse resp = classroomService.createClassroom(req);

        // Then
        assertThat(resp).isNotNull();
        assertThat(resp.getName()).isEqualTo("IELTS Intensive Speaking B2");
        assertThat(resp.getJoinCode()).isNotNull();
        assertThat(resp.getJoinCode()).startsWith("ENG-");
        assertThat(resp.getStatus()).isEqualTo(ClassStatus.PLANNING);

        verify(classroomRepository, times(1)).save(any(Classroom.class));
    }

    @Test
    @DisplayName("Học sinh nhập mã Join Code hợp lệ -> Tham gia lớp học thành công")
    void should_EnrollStudentSuccessfully_when_ValidJoinCodeProvided() {
        // Given
        Classroom classroom = Classroom.builder()
                .id(classId)
                .name("English Grammar Master")
                .status(ClassStatus.OPEN)
                .level(ClassLevel.B1)
                .maxStudents(30)
                .joinCode(joinCode)
                .build();

        Student student = Student.builder()
                .id(studentId)
                .build();

        when(classroomRepository.findByJoinCode(joinCode)).thenReturn(Optional.of(classroom));
        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(false);
        when(classStudentRepository.countByClassroomIdAndIsActiveTrue(classId)).thenReturn(10L);
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));

        // When
        classroomService.enrollStudentByJoinCode(joinCode, studentId);

        // Then
        ArgumentCaptor<ClassStudent> captor = ArgumentCaptor.forClass(ClassStudent.class);
        verify(classStudentRepository).save(captor.capture());
        ClassStudent saved = captor.getValue();
        assertThat(saved.getClassroom().getId()).isEqualTo(classId);
        assertThat(saved.getStudent().getId()).isEqualTo(studentId);
        assertThat(saved.getIsActive()).isTrue();

        verify(studentRepository).save(argThat(s -> "B1".equals(s.getCurrentLevel())));
    }

    @Test
    @DisplayName("Quăng BadRequestException khi học sinh đã ở trong lớp học rồi")
    void should_ThrowBadRequestException_when_StudentAlreadyEnrolled() {
        // Given
        Classroom classroom = Classroom.builder()
                .id(classId)
                .name("English Grammar Master")
                .status(ClassStatus.OPEN)
                .joinCode(joinCode)
                .build();

        when(classroomRepository.findByJoinCode(joinCode)).thenReturn(Optional.of(classroom));
        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(true);

        // When & Then
        assertThatThrownBy(() -> classroomService.enrollStudentByJoinCode(joinCode, studentId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Học viên đã tham gia lớp học này rồi");

        verify(classStudentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Quăng BadRequestException khi lớp học đã đầy sĩ số (maxStudents)")
    void should_ThrowBadRequestException_when_ClassroomIsFull() {
        // Given
        Classroom classroom = Classroom.builder()
                .id(classId)
                .name("English Grammar Master")
                .status(ClassStatus.OPEN)
                .maxStudents(20)
                .joinCode(joinCode)
                .build();

        when(classroomRepository.findByJoinCode(joinCode)).thenReturn(Optional.of(classroom));
        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(false);
        when(classStudentRepository.countByClassroomIdAndIsActiveTrue(classId)).thenReturn(20L); // Đã đủ 20

        // When & Then
        assertThatThrownBy(() -> classroomService.enrollStudentByJoinCode(joinCode, studentId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Lớp học đã đạt tối đa");

        verify(classStudentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Quăng BadRequestException khi lớp học ở trạng thái COMPLETED")
    void should_ThrowBadRequestException_when_ClassroomIsClosed() {
        // Given
        Classroom classroom = Classroom.builder()
                .id(classId)
                .name("English Grammar Master")
                .status(ClassStatus.COMPLETED)
                .joinCode(joinCode)
                .build();

        when(classroomRepository.findByJoinCode(joinCode)).thenReturn(Optional.of(classroom));

        // When & Then
        assertThatThrownBy(() -> classroomService.enrollStudentByJoinCode(joinCode, studentId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Lớp học hiện không nhận thêm học viên");

        verify(classStudentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Tính toán tiến độ khóa học thật từ Database trong getStudentCourses()")
    void should_CalculateRealCourseProgress_when_StudentChecksEnrolledCourses() {
        // Given
        Classroom classroom = Classroom.builder()
                .id(classId)
                .name("IELTS Intensive")
                .status(ClassStatus.OPEN)
                .level(ClassLevel.B2)
                .build();

        ClassStudent enrollment = ClassStudent.builder()
                .classroom(classroom)
                .student(Student.builder().id(studentId).build())
                .isActive(true)
                .build();

        when(classStudentRepository.findActiveEnrollmentsWithClassroom(studentId))
                .thenReturn(java.util.List.of(enrollment));

        // 2 bài tập của lớp
        UUID assign1Id = UUID.randomUUID();
        UUID assign2Id = UUID.randomUUID();
        com.englishlearning.assignment.entity.Assignment a1 = com.englishlearning.assignment.entity.Assignment.builder()
                .id(assign1Id)
                .classroom(classroom)
                .build();
        com.englishlearning.assignment.entity.Assignment a2 = com.englishlearning.assignment.entity.Assignment.builder()
                .id(assign2Id)
                .classroom(classroom)
                .build();
        when(assignmentRepository.findByClassroomId(classId)).thenReturn(java.util.List.of(a1, a2));

        // Học sinh đã nộp a1
        AssignmentAttempt attempt = AssignmentAttempt.builder()
                .id(UUID.randomUUID())
                .assignment(a1)
                .student(Student.builder().id(studentId).build())
                .status(com.englishlearning.submission.entity.AttemptStatus.SUBMITTED)
                .build();
        when(assignmentAttemptRepository.findCompletedAttemptsByStudentId(studentId))
                .thenReturn(java.util.List.of(attempt));

        // 1 DailyStudyPlan có 2 items, chưa hoàn thành plan nhưng xong 1 item
        UUID planId = UUID.randomUUID();
        com.englishlearning.curriculum.entity.DailyPlanItem item1 = com.englishlearning.curriculum.entity.DailyPlanItem.builder().id(UUID.randomUUID()).build();
        com.englishlearning.curriculum.entity.DailyPlanItem item2 = com.englishlearning.curriculum.entity.DailyPlanItem.builder().id(UUID.randomUUID()).build();
        DailyStudyPlan plan = DailyStudyPlan.builder()
                .id(planId)
                .classroom(classroom)
                .items(java.util.List.of(item1, item2))
                .build();
        when(dailyStudyPlanRepository.findByClassroomIdWithItems(classId)).thenReturn(java.util.List.of(plan));

        StudentDailyProgress progress = StudentDailyProgress.builder()
                .dailyPlan(plan)
                .isCompleted(false)
                .completedItemsCount(1)
                .build();
        when(studentDailyProgressRepository.findByStudentId(studentId)).thenReturn(java.util.List.of(progress));

        // 2 Lesson của lớp, đã xem xong video lesson 1
        UUID lesson1Id = UUID.randomUUID();
        UUID lesson2Id = UUID.randomUUID();
        com.englishlearning.curriculum.entity.Lesson l1 = com.englishlearning.curriculum.entity.Lesson.builder().id(lesson1Id).build();
        com.englishlearning.curriculum.entity.Lesson l2 = com.englishlearning.curriculum.entity.Lesson.builder().id(lesson2Id).build();
        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId)).thenReturn(java.util.List.of(l1, l2));

        com.englishlearning.video.entity.Video video1 = com.englishlearning.video.entity.Video.builder()
                .id(UUID.randomUUID())
                .lesson(l1)
                .build();
        VideoWatchHistory watchHistory = VideoWatchHistory.builder()
                .video(video1)
                .isCompleted(true)
                .build();
        when(videoWatchHistoryRepository.findByStudentIdAndIsCompletedTrue(studentId)).thenReturn(java.util.List.of(watchHistory));

        // When
        java.util.List<com.englishlearning.classroom.dto.MyCourseResponse> courses = classroomService.getStudentCourses(studentId);

        // Then
        assertThat(courses).hasSize(1);
        com.englishlearning.classroom.dto.MyCourseResponse course = courses.get(0);

        // totalTasks = 2 assignments + 2 daily plan items = 4
        assertThat(course.getTotalTasks()).isEqualTo(4);
        // completedTasks = 1 assignment nộp + 1 daily item xong = 2
        assertThat(course.getCompletedTasks()).isEqualTo(2);
        // completedLessons = 1 (l1 xem xong video)
        assertThat(course.getCompletedLessons()).isEqualTo(1);
        // progressPercentage = (2 / 4) * 100 = 50.0%
        assertThat(course.getProgressPercentage()).isEqualTo(50.0);
    }
}
