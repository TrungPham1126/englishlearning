package com.englishlearning.classroom.service;

import com.englishlearning.auth.entity.Student;
import com.englishlearning.auth.entity.Teacher;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.classroom.dto.*;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final ClassStudentRepository classStudentRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final UserRepository userRepository;

    @Transactional
    public ClassroomResponse createClassroom(CreateClassroomRequest req) {
        if (classroomRepository.existsByNameIgnoreCase(req.getName())) {
            throw new BadRequestException("Tên lớp học đã tồn tại");
        }

        Teacher teacher = null;
        if (req.getTeacherId() != null) {
            teacher = teacherRepository.findById(req.getTeacherId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin giảng viên"));
        }

        Classroom classroom = Classroom.builder()
                .name(req.getName())
                .description(req.getDescription())
                .level(req.getLevel())
                .status(ClassStatus.PLANNING)
                .startDate(req.getStartDate())
                .endDate(req.getEndDate())
                .maxStudents(req.getMaxStudents() != null ? req.getMaxStudents() : 30)
                .teacher(teacher)
                .build();

        classroom = classroomRepository.save(classroom);
        return mapToResponse(classroom, 0);
    }

    @Transactional
    public ClassroomResponse updateClassStatus(UUID classId, UpdateClassStatusRequest req) {
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học"));

        classroom.setStatus(req.getStatus());
        return mapToResponse(classroomRepository.save(classroom),
                classStudentRepository.countByClassroomIdAndIsActiveTrue(classId));
    }

    @Transactional
    public ClassroomResponse assignTeacher(UUID classId, AssignTeacherRequest req) {
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học"));

        Teacher teacher = teacherRepository.findById(req.getTeacherId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy giảng viên"));

        classroom.setTeacher(teacher);
        return mapToResponse(classroomRepository.save(classroom),
                classStudentRepository.countByClassroomIdAndIsActiveTrue(classId));
    }

    @Transactional
    public void enrollStudent(UUID classId, EnrollStudentRequest req) {
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học"));

        if (classroom.getStatus() != ClassStatus.OPEN && classroom.getStatus() != ClassStatus.PLANNING) {
            throw new BadRequestException(
                    "Lớp học hiện không nhận thêm học viên (trạng thái: " + classroom.getStatus() + ")");
        }

        long currentCount = classStudentRepository.countByClassroomIdAndIsActiveTrue(classId);
        if (classroom.getMaxStudents() != null && currentCount >= classroom.getMaxStudents()) {
            throw new BadRequestException("Lớp học đã đạt sĩ số tối đa (" + classroom.getMaxStudents() + " học viên)");
        }

        User user = userRepository.findByEmail(req.getStudentIdentifier())
                .or(() -> userRepository.findByPhone(req.getStudentIdentifier()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy tài khoản với email/SĐT: " + req.getStudentIdentifier()));

        Student student = studentRepository.findById(user.getId())
                .orElseGet(() -> studentRepository.save(Student.builder().user(user).build()));

        if (classStudentRepository.existsByClassroomIdAndStudentId(classId, student.getId())) {
            throw new BadRequestException("Học viên đã tham gia lớp học này trước đó");
        }

        ClassStudent classStudent = ClassStudent.builder()
                .classroom(classroom)
                .student(student)
                .isActive(true)
                .enrolledAt(Instant.now())
                .build();

        classStudentRepository.save(classStudent);
    }

    @Transactional(readOnly = true)
    public List<ClassroomResponse> getTeacherClasses(UUID teacherUserId) {
        return classroomRepository.findByTeacherId(teacherUserId).stream()
                .map(c -> mapToResponse(c, classStudentRepository.countByClassroomIdAndIsActiveTrue(c.getId())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MyCourseResponse> getStudentCourses(UUID studentUserId) {
        List<ClassStudent> enrollments = classStudentRepository.findActiveEnrollmentsWithClassroom(studentUserId);

        return enrollments.stream().map(enrollment -> {
            Classroom c = enrollment.getClassroom();
            String teacherName = "Chưa phân công";
            if (c.getTeacher() != null && c.getTeacher().getUser() != null) {
                teacherName = c.getTeacher().getUser().getFirstName() + " " + c.getTeacher().getUser().getLastName();
            }

            return MyCourseResponse.builder()
                    .classId(c.getId())
                    .className(c.getName())
                    .level(c.getLevel())
                    .status(c.getStatus())
                    .teacherName(teacherName)
                    .enrolledAt(enrollment.getEnrolledAt())
                    .progressPercentage(0.0)
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PageResponse<ClassroomResponse> getAllClassrooms(ClassStatus status, Pageable pageable) {
        Page<Classroom> page = (status != null)
                ? classroomRepository.findByStatus(status, pageable)
                : classroomRepository.findAll(pageable);

        Page<ClassroomResponse> mappedPage = page
                .map(c -> mapToResponse(c, classStudentRepository.countByClassroomIdAndIsActiveTrue(c.getId())));

        return PageResponse.from(mappedPage);
    }

    private ClassroomResponse mapToResponse(Classroom c, long currentCount) {
        String teacherName = "Chưa phân công";
        UUID teacherId = null;
        if (c.getTeacher() != null) {
            teacherId = c.getTeacher().getId();
            if (c.getTeacher().getUser() != null) {
                teacherName = c.getTeacher().getUser().getFirstName() + " " + c.getTeacher().getUser().getLastName();
            }
        }

        return ClassroomResponse.builder()
                .id(c.getId())
                .name(c.getName())
                .description(c.getDescription())
                .level(c.getLevel())
                .status(c.getStatus())
                .startDate(c.getStartDate())
                .endDate(c.getEndDate())
                .maxStudents(c.getMaxStudents())
                .currentStudentsCount(currentCount)
                .teacherId(teacherId)
                .teacherName(teacherName)
                .createdAt(c.getCreatedAt())
                .build();
    }

    @Transactional
    public void leaveClass(UUID classId, UUID studentId) {
        com.englishlearning.classroom.entity.ClassStudent enrollment = classStudentRepository
                .findByClassroomIdAndStudentId(classId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin ghi danh"));
        enrollment.setIsActive(false);
        classStudentRepository.save(enrollment);
    }
}