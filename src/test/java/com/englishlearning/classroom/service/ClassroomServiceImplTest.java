package com.englishlearning.classroom.service;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.classroom.dto.*;
import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.classroom.service.impl.ClassroomServiceImpl;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.DailyPlanItem;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
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

    @Test
    @DisplayName("createClassroom - Tên lớp trùng, sĩ số <= 0, endDate < startDate hoặc teacher không tồn tại đều ném exception")
    void createClassroom_invalidInputs_throwsAppropriateExceptions() {
        CreateClassroomRequest dupReq = CreateClassroomRequest.builder()
                .name("IELTS A")
                .level(ClassLevel.B1)
                .build();
        when(classroomRepository.existsByNameIgnoreCase("IELTS A")).thenReturn(true);
        assertThatThrownBy(() -> classroomService.createClassroom(dupReq))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Tên lớp học đã tồn tại");

        CreateClassroomRequest badCapReq = CreateClassroomRequest.builder()
                .name("IELTS B")
                .level(ClassLevel.B1)
                .maxStudents(0)
                .build();
        when(classroomRepository.existsByNameIgnoreCase("IELTS B")).thenReturn(false);
        assertThatThrownBy(() -> classroomService.createClassroom(badCapReq))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Sĩ số tối đa");

        CreateClassroomRequest badDateReq = CreateClassroomRequest.builder()
                .name("IELTS C")
                .level(ClassLevel.B1)
                .startDate(LocalDate.of(2026, 5, 10))
                .endDate(LocalDate.of(2026, 5, 1))
                .build();
        when(classroomRepository.existsByNameIgnoreCase("IELTS C")).thenReturn(false);
        assertThatThrownBy(() -> classroomService.createClassroom(badDateReq))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Ngày kết thúc");

        CreateClassroomRequest missingTeacherReq = CreateClassroomRequest.builder()
                .name("IELTS D")
                .level(ClassLevel.B1)
                .teacherId(teacherId)
                .build();
        when(classroomRepository.existsByNameIgnoreCase("IELTS D")).thenReturn(false);
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> classroomService.createClassroom(missingTeacherReq))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Không tìm thấy thông tin giảng viên");
    }

    @Test
    @DisplayName("createClassroom - Không truyền teacherId/maxStudents dùng mặc định 30 và fallback sinh Join Code khi trùng > 10 lần")
    void createClassroom_defaultsAndJoinCodeFallback_succeeds() {
        CreateClassroomRequest req = CreateClassroomRequest.builder()
                .name("Foundation A1")
                .level(ClassLevel.A1)
                .build();
        when(classroomRepository.existsByNameIgnoreCase("Foundation A1")).thenReturn(false);
        when(classroomRepository.existsByJoinCode(anyString())).thenReturn(true);
        when(classroomRepository.save(any(Classroom.class))).thenAnswer(inv -> {
            Classroom c = inv.getArgument(0);
            c.setId(classId);
            return c;
        });

        ClassroomResponse resp = classroomService.createClassroom(req);

        assertThat(resp.getMaxStudents()).isEqualTo(30);
        assertThat(resp.getTeacherId()).isNull();
        assertThat(resp.getTeacherName()).isEqualTo("Chưa phân công");
        assertThat(resp.getJoinCode()).startsWith("ENG-");
        verify(classroomRepository, times(10)).existsByJoinCode(anyString());
    }

    @Test
    @DisplayName("enrollStudentByJoinCode - JoinCode rỗng, không tồn tại, PLANNING được phép, hoặc classroom.level == null")
    void enrollStudentByJoinCode_edgeCases_handledCorrectly() {
        assertThatThrownBy(() -> classroomService.enrollStudentByJoinCode("   ", studentId))
                .isInstanceOf(BadRequestException.class);

        when(classroomRepository.findByJoinCode("BADCODE")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> classroomService.enrollStudentByJoinCode(" badcode ", studentId))
                .isInstanceOf(ResourceNotFoundException.class);

        Classroom planningNoLevel = Classroom.builder()
                .id(classId)
                .status(ClassStatus.PLANNING)
                .level(null)
                .maxStudents(null)
                .joinCode("ENG-PLAN")
                .build();
        Student student = Student.builder().id(studentId).currentLevel("B1").build();

        when(classroomRepository.findByJoinCode("ENG-PLAN")).thenReturn(Optional.of(planningNoLevel));
        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(false);
        when(classStudentRepository.countByClassroomIdAndIsActiveTrue(classId)).thenReturn(5L);
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));

        classroomService.enrollStudentByJoinCode(" eng-plan ", studentId);

        verify(classStudentRepository).save(any(ClassStudent.class));
        assertThat(student.getCurrentLevel()).isEqualTo("B1");
        verify(studentRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateClassStatus & assignTeacher - Cập nhật thành công và báo 404 khi thiếu lớp/giảng viên")
    void updateStatusAndAssignTeacher_allBranches() {
        User teacherUser = User.builder().id(teacherId).firstName("Nguyen").lastName(null).build();
        Teacher teacher = Teacher.builder().id(teacherId).user(teacherUser).build();
        Classroom classroom = Classroom.builder()
                .id(classId)
                .name("Speaking Pro")
                .status(ClassStatus.PLANNING)
                .level(ClassLevel.B2)
                .build();

        UpdateClassStatusRequest statusReq = new UpdateClassStatusRequest();
        statusReq.setStatus(ClassStatus.IN_PROGRESS);
        when(classroomRepository.findById(classId)).thenReturn(Optional.of(classroom));
        when(classroomRepository.save(any(Classroom.class))).thenAnswer(inv -> inv.getArgument(0));
        when(classStudentRepository.countByClassroomIdAndIsActiveTrue(classId)).thenReturn(12L);

        ClassroomResponse statusResp = classroomService.updateClassStatus(classId, statusReq);
        assertThat(statusResp.getStatus()).isEqualTo(ClassStatus.IN_PROGRESS);
        assertThat(statusResp.getCurrentStudentsCount()).isEqualTo(12L);

        AssignTeacherRequest assignReq = new AssignTeacherRequest();
        assignReq.setTeacherId(teacherId);
        when(teacherRepository.findById(teacherId)).thenReturn(Optional.of(teacher));

        ClassroomResponse teacherResp = classroomService.assignTeacher(classId, assignReq);
        assertThat(teacherResp.getTeacherId()).isEqualTo(teacherId);
        assertThat(teacherResp.getTeacherName()).isEqualTo("Nguyen");

        UUID missingId = UUID.randomUUID();
        when(classroomRepository.findById(missingId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> classroomService.updateClassStatus(missingId, statusReq))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> classroomService.assignTeacher(missingId, assignReq))
                .isInstanceOf(ResourceNotFoundException.class);

        when(teacherRepository.findById(teacherId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> classroomService.assignTeacher(classId, assignReq))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("enrollStudent - Ghi danh qua SĐT (tạo mới Student profile nếu chưa có) và các nhánh lỗi")
    void enrollStudent_byPhoneAndEdgeCases() {
        Classroom classroom = Classroom.builder()
                .id(classId)
                .name("TOEIC Intensive")
                .status(ClassStatus.OPEN)
                .level(ClassLevel.TOEIC_PREP)
                .maxStudents(2)
                .build();
        User user = User.builder().id(studentId).phone("0901234567").email("st@test.com").build();

        EnrollStudentRequest req = new EnrollStudentRequest();
        req.setStudentIdentifier(" 0901234567 ");

        when(classroomRepository.findById(classId)).thenReturn(Optional.of(classroom));
        when(classStudentRepository.countByClassroomIdAndIsActiveTrue(classId)).thenReturn(1L);
        when(userRepository.findByEmail("0901234567")).thenReturn(Optional.empty());
        when(userRepository.findByPhone("0901234567")).thenReturn(Optional.of(user));
        when(studentRepository.findById(studentId)).thenReturn(Optional.empty());
        when(studentRepository.save(any(Student.class))).thenAnswer(inv -> {
            Student s = inv.getArgument(0);
            if (s.getId() == null) s.setId(studentId);
            return s;
        });
        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(false);

        classroomService.enrollStudent(classId, req);

        verify(classStudentRepository).save(any(ClassStudent.class));
        ArgumentCaptor<Student> studentCaptor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository, times(2)).save(studentCaptor.capture());
        assertThat(studentCaptor.getAllValues().get(1).getCurrentLevel()).isEqualTo("TOEIC_PREP");

        // User không tồn tại
        req.setStudentIdentifier("missing@test.com");
        when(userRepository.findByEmail("missing@test.com")).thenReturn(Optional.empty());
        when(userRepository.findByPhone("missing@test.com")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> classroomService.enrollStudent(classId, req))
                .isInstanceOf(ResourceNotFoundException.class);

        // Lớp đã đóng (CANCELLED)
        classroom.setStatus(ClassStatus.CANCELLED);
        assertThatThrownBy(() -> classroomService.enrollStudent(classId, req))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("getTeacherClasses, getClassroomById, getAllClassrooms & leaveClass - Xử lý đầy đủ")
    void queriesAndLeaveClass_allBranches() {
        User tUser = User.builder().id(teacherId).firstName("Tran").lastName("Hung").build();
        Teacher t = Teacher.builder().id(teacherId).user(tUser).build();
        Classroom c1 = Classroom.builder().id(classId).name("Class 1").status(ClassStatus.OPEN).teacher(t).build();
        Classroom c2 = Classroom.builder().id(UUID.randomUUID()).name("Class 2").status(ClassStatus.COMPLETED).build();

        when(classroomRepository.findByTeacherId(teacherId)).thenReturn(List.of(c1));
        when(classStudentRepository.countByClassroomIdAndIsActiveTrue(classId)).thenReturn(8L);
        assertThat(classroomService.getTeacherClasses(teacherId)).hasSize(1);
        assertThat(classroomService.getTeacherClasses(teacherId).get(0).getTeacherName()).isEqualTo("Tran Hung");

        when(classroomRepository.findById(classId)).thenReturn(Optional.of(c1));
        assertThat(classroomService.getClassroomById(classId).getName()).isEqualTo("Class 1");

        Pageable pageable = PageRequest.of(0, 10);
        Page<Classroom> openPage = new PageImpl<>(List.of(c1), pageable, 1);
        when(classroomRepository.findByStatus(ClassStatus.OPEN, pageable)).thenReturn(openPage);
        PageResponse<ClassroomResponse> filtered = classroomService.getAllClassrooms(ClassStatus.OPEN, pageable);
        assertThat(filtered.getTotalElements()).isEqualTo(1);

        Page<Classroom> allPage = new PageImpl<>(List.of(c1, c2), pageable, 2);
        when(classroomRepository.findAll(pageable)).thenReturn(allPage);
        PageResponse<ClassroomResponse> unfiltered = classroomService.getAllClassrooms(null, pageable);
        assertThat(unfiltered.getContent()).hasSize(2);

        // leaveClass -> cập nhật level từ lớp còn lại hoặc null nếu hết lớp
        ClassStudent cs = ClassStudent.builder()
                .classroom(c1)
                .student(Student.builder().id(studentId).build())
                .isActive(true)
                .build();
        Student s = Student.builder().id(studentId).currentLevel("B2").build();
        Classroom remainingClass = Classroom.builder().id(UUID.randomUUID()).level(ClassLevel.C1).build();
        ClassStudent remainingCs = ClassStudent.builder().classroom(remainingClass).student(s).isActive(true).build();

        when(classStudentRepository.findByClassroomIdAndStudentId(classId, studentId)).thenReturn(Optional.of(cs));
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(studentId)).thenReturn(List.of(remainingCs));
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(s));

        classroomService.leaveClass(classId, studentId);

        assertThat(cs.getIsActive()).isFalse();
        assertThat(s.getCurrentLevel()).isEqualTo("C1");

        when(classStudentRepository.findByClassroomIdAndStudentId(classId, studentId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> classroomService.leaveClass(classId, studentId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getStudentCourses - Lesson fallback khi lớp chỉ có bài học, và list rỗng khi chưa ghi danh")
    void getStudentCourses_emptyAndLessonOnlyFallback() {
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(studentId)).thenReturn(Collections.emptyList());
        assertThat(classroomService.getStudentCourses(studentId)).isEmpty();

        Classroom c = Classroom.builder()
                .id(classId)
                .name("Pronunciation Core")
                .level(ClassLevel.A2)
                .status(ClassStatus.OPEN)
                .build();
        ClassStudent enrollment = ClassStudent.builder()
                .classroom(c)
                .student(Student.builder().id(studentId).build())
                .isActive(true)
                .enrolledAt(Instant.now())
                .build();

        Lesson l1 = Lesson.builder().id(UUID.randomUUID()).build();
        Lesson l2 = Lesson.builder().id(UUID.randomUUID()).build();
        Video v1 = Video.builder().id(UUID.randomUUID()).lesson(l1).build();
        VideoWatchHistory history = VideoWatchHistory.builder().video(v1).isCompleted(true).build();

        when(classStudentRepository.findActiveEnrollmentsWithClassroom(studentId)).thenReturn(List.of(enrollment));
        when(assignmentAttemptRepository.findCompletedAttemptsByStudentId(studentId)).thenReturn(Collections.emptyList());
        when(studentDailyProgressRepository.findByStudentId(studentId)).thenReturn(Collections.emptyList());
        when(videoWatchHistoryRepository.findByStudentIdAndIsCompletedTrue(studentId)).thenReturn(List.of(history));
        when(assignmentRepository.findByClassroomId(classId)).thenReturn(Collections.emptyList());
        when(dailyStudyPlanRepository.findByClassroomIdWithItems(classId)).thenReturn(Collections.emptyList());
        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId)).thenReturn(List.of(l1, l2));

        List<MyCourseResponse> courses = classroomService.getStudentCourses(studentId);
        assertThat(courses).hasSize(1);
        assertThat(courses.get(0).getTotalLessons()).isEqualTo(2);
        assertThat(courses.get(0).getCompletedLessons()).isEqualTo(1);
        assertThat(courses.get(0).getTotalTasks()).isEqualTo(2);
        assertThat(courses.get(0).getCompletedTasks()).isEqualTo(1);
        assertThat(courses.get(0).getProgressPercentage()).isEqualTo(50.0);
    }

    @Test
    @DisplayName("getClassStudentsProgress - Tổng hợp điểm trung bình, số phút học và daily details")
    @SuppressWarnings("unchecked")
    void getClassStudentsProgress_aggregatesScoresAndDailyProgress() {
        TypedQuery<Object[]> rosterQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("FROM ClassStudent cs"), eq(Object[].class))).thenReturn(rosterQuery);
        when(rosterQuery.setParameter("classId", classId)).thenReturn(rosterQuery);
        Object[] studentRow = new Object[]{studentId, "", "", "st@test.com", "0909", Instant.parse("2026-10-01T00:00:00Z")};
        when(rosterQuery.getResultList()).thenReturn(Collections.singletonList(studentRow));

        UUID planAssignId = UUID.randomUUID();
        UUID extraAssignId = UUID.randomUUID();
        Assignment planAssign = Assignment.builder().id(planAssignId).build();
        Assignment extraAssign = Assignment.builder().id(extraAssignId).build();

        DailyPlanItem planItem = DailyPlanItem.builder().id(UUID.randomUUID()).assignment(planAssign).build();
        DailyStudyPlan day1 = DailyStudyPlan.builder()
                .id(UUID.randomUUID())
                .dayNumber(1)
                .estimatedMinutes(20)
                .items(List.of(planItem))
                .build();

        when(dailyStudyPlanRepository.findByClassroomIdWithItems(classId)).thenReturn(List.of(day1));
        when(assignmentRepository.findByClassroomId(classId)).thenReturn(List.of(planAssign, extraAssign));
        when(lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId)).thenReturn(Collections.emptyList());

        Student student = Student.builder().id(studentId).build();
        StudentDailyProgress progress = StudentDailyProgress.builder()
                .student(student)
                .dailyPlan(day1)
                .isCompleted(true)
                .completedItemsCount(1)
                .build();
        when(studentDailyProgressRepository.findByStudentIdIn(List.of(studentId))).thenReturn(List.of(progress));

        TypedQuery<AssignmentAttempt> attemptQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("FROM AssignmentAttempt a"), eq(AssignmentAttempt.class))).thenReturn(attemptQuery);
        when(attemptQuery.setParameter("studentIds", List.of(studentId))).thenReturn(attemptQuery);

        AssignmentAttempt a1 = AssignmentAttempt.builder()
                .student(student)
                .assignment(planAssign)
                .status(AttemptStatus.COMPLETED)
                .totalScore(8.0)
                .durationSeconds(300)
                .build();
        AssignmentAttempt a2 = AssignmentAttempt.builder()
                .student(student)
                .assignment(extraAssign)
                .status(AttemptStatus.COMPLETED)
                .totalScore(9.5)
                .durationSeconds(600)
                .build();
        when(attemptQuery.getResultList()).thenReturn(List.of(a1, a2));

        List<StudentProgressResponse> result = classroomService.getClassStudentsProgress(classId);

        assertThat(result).hasSize(1);
        StudentProgressResponse sp = result.get(0);
        assertThat(sp.getFullName()).isEqualTo("Học viên ẩn danh");
        assertThat(sp.getTotalTasks()).isEqualTo(3); // 2 assignments + 1 plan item
        assertThat(sp.getCompletedTasks()).isEqualTo(3); // 2 submitted + 1 completed plan item
        assertThat(sp.getCompletionRate()).isEqualTo(100);
        assertThat(sp.getAverageScore()).isEqualTo(8.8); // round((8.0 + 9.5) / 2 * 10) / 10
        assertThat(sp.getTotalStudyMinutes()).isEqualTo(20); // max(300s, 20*60s) / 60 = 20
        assertThat(sp.getDailyProgressDetails()).hasSize(1);
        assertThat(sp.getDailyProgressDetails().get(0).getDate()).isEqualTo("Day 1");
    }
}
