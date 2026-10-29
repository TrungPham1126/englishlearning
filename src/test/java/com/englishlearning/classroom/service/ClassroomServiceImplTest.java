package com.englishlearning.classroom.service;

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
                entityManager
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
        ClassroomResponse response = classroomService.createClassroom(req);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(classId);
        assertThat(response.getName()).isEqualTo("IELTS Intensive Speaking B2");
        assertThat(response.getJoinCode()).isNotBlank();
        assertThat(response.getJoinCode()).startsWith("ENG-");

        ArgumentCaptor<Classroom> captor = ArgumentCaptor.forClass(Classroom.class);
        verify(classroomRepository, times(1)).save(captor.capture());
        Classroom savedClass = captor.getValue();
        assertThat(savedClass.getJoinCode()).isNotNull();
        assertThat(savedClass.getStatus()).isEqualTo(ClassStatus.PLANNING);
    }

    @Test
    @DisplayName("Ghi danh học viên vào lớp thành công khi mã tham gia (Join Code) hợp lệ")
    void should_EnrollStudentSuccessfully_when_JoinCodeIsValid() {
        // Given
        Classroom classroom = Classroom.builder()
                .id(classId)
                .name("IELTS Foundation A2")
                .status(ClassStatus.OPEN)
                .level(ClassLevel.A2)
                .maxStudents(30)
                .joinCode(joinCode)
                .build();

        Student student = new Student();
        student.setId(studentId);

        when(classroomRepository.findByJoinCode(joinCode)).thenReturn(Optional.of(classroom));
        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(false);
        when(classStudentRepository.countByClassroomIdAndIsActiveTrue(classId)).thenReturn(10L);
        when(studentRepository.findById(studentId)).thenReturn(Optional.of(student));

        // When
        classroomService.enrollStudentByJoinCode(joinCode, studentId);

        // Then
        ArgumentCaptor<ClassStudent> captor = ArgumentCaptor.forClass(ClassStudent.class);
        verify(classStudentRepository, times(1)).save(captor.capture());
        ClassStudent enrollment = captor.getValue();
        assertThat(enrollment.getClassroom().getId()).isEqualTo(classId);
        assertThat(enrollment.getStudent().getId()).isEqualTo(studentId);
        assertThat(enrollment.getIsActive()).isTrue();

        verify(studentRepository, times(1)).save(student);
        assertThat(student.getCurrentLevel()).isEqualTo("A2");
    }

    @Test
    @DisplayName("Chặn ghi danh trùng lặp và ném BadRequestException khi học viên đã ở trong lớp")
    void should_PreventDuplicateStudentEnrollment_when_StudentAlreadyEnrolled() {
        // Given
        Classroom classroom = Classroom.builder()
                .id(classId)
                .status(ClassStatus.OPEN)
                .joinCode(joinCode)
                .build();

        when(classroomRepository.findByJoinCode(joinCode)).thenReturn(Optional.of(classroom));
        when(classStudentRepository.existsByClassroomIdAndStudentId(classId, studentId)).thenReturn(true);

        // When & Then
        assertThatThrownBy(() -> classroomService.enrollStudentByJoinCode(joinCode, studentId))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Học viên đã tham gia lớp học này rồi");

        verify(classStudentRepository, never()).save(any(ClassStudent.class));
    }
}
