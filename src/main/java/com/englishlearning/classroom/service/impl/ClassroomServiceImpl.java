package com.englishlearning.classroom.service.impl;

import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.repository.AssignmentRepository;
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
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.StudentDailyProgress;
import com.englishlearning.curriculum.repository.DailyPlanItemRepository;
import com.englishlearning.curriculum.repository.DailyStudyPlanRepository;
import com.englishlearning.curriculum.repository.LessonRepository;
import com.englishlearning.curriculum.repository.StudentDailyProgressRepository;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.video.entity.VideoWatchHistory;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClassroomServiceImpl implements ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final ClassStudentRepository classStudentRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final UserRepository userRepository;
    private final EntityManager entityManager;
    private final DailyStudyPlanRepository dailyStudyPlanRepository;
    private final DailyPlanItemRepository dailyPlanItemRepository;
    private final StudentDailyProgressRepository studentDailyProgressRepository;
    private final VideoWatchHistoryRepository videoWatchHistoryRepository;
    private final AssignmentRepository assignmentRepository;
    private final AssignmentAttemptRepository assignmentAttemptRepository;
    private final LessonRepository lessonRepository;

    @Override
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

        String joinCode = generateUniqueJoinCode();

        Classroom classroom = Classroom.builder()
                .name(req.getName())
                .description(req.getDescription())
                .level(req.getLevel())
                .status(ClassStatus.PLANNING)
                .startDate(req.getStartDate())
                .endDate(req.getEndDate())
                .maxStudents(req.getMaxStudents() != null ? req.getMaxStudents() : 30)
                .joinCode(joinCode)
                .teacher(teacher)
                .build();

        classroom = classroomRepository.save(classroom);
        log.info("Tạo lớp học mới thành công: {} với mã tham gia: {}", classroom.getName(), joinCode);
        return mapToResponse(classroom, 0);
    }

    @Override
    @Transactional
    public void enrollStudentByJoinCode(String joinCode, UUID studentId) {
        if (joinCode == null || joinCode.isBlank()) {
            throw new BadRequestException("Mã tham gia lớp học không được để trống");
        }

        Classroom classroom = classroomRepository.findByJoinCode(joinCode.trim().toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học với mã tham gia: " + joinCode));

        if (classroom.getStatus() != ClassStatus.OPEN && classroom.getStatus() != ClassStatus.PLANNING) {
            throw new BadRequestException("Lớp học hiện không nhận thêm học viên (trạng thái: " + classroom.getStatus() + ")");
        }

        if (classStudentRepository.existsByClassroomIdAndStudentId(classroom.getId(), studentId)) {
            throw new BadRequestException("Học viên đã tham gia lớp học này rồi");
        }

        long currentCount = classStudentRepository.countByClassroomIdAndIsActiveTrue(classroom.getId());
        if (classroom.getMaxStudents() != null && currentCount >= classroom.getMaxStudents()) {
            throw new BadRequestException("Lớp học đã đạt tối đa (" + classroom.getMaxStudents() + " học viên)");
        }

        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin học viên"));

        ClassStudent classStudent = ClassStudent.builder()
                .classroom(classroom)
                .student(student)
                .isActive(true)
                .enrolledAt(Instant.now())
                .build();
        classStudentRepository.save(classStudent);

        if (classroom.getLevel() != null) {
            student.setCurrentLevel(classroom.getLevel().name());
            studentRepository.save(student);
        }
        log.info("Học sinh {} tham gia lớp {} qua mã {} thành công", studentId, classroom.getId(), joinCode);
    }

    private String generateUniqueJoinCode() {
        String code;
        int attempts = 0;
        do {
            code = "ENG-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            attempts++;
            if (attempts > 10) {
                code = "ENG-" + System.currentTimeMillis() % 1000000;
                break;
            }
        } while (classroomRepository.existsByJoinCode(code));
        return code;
    }

    @Override
    @Transactional
    public ClassroomResponse updateClassStatus(UUID classId, UpdateClassStatusRequest req) {
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học"));
        classroom.setStatus(req.getStatus());
        return mapToResponse(classroomRepository.save(classroom),
                classStudentRepository.countByClassroomIdAndIsActiveTrue(classId));
    }

    @Override
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

    @Override
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
            throw new BadRequestException("Lớp học đã đạt tối đa (" + classroom.getMaxStudents() + " học viên)");
        }
        User user = userRepository.findByEmail(req.getStudentIdentifier())
                .or(() -> userRepository.findByPhone(req.getStudentIdentifier()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy tài khoản học viên với email/SĐT: " + req.getStudentIdentifier()));

        Student student = studentRepository.findById(user.getId())
                .orElseGet(() -> studentRepository.save(Student.builder().user(user).build()));
        if (classStudentRepository.existsByClassroomIdAndStudentId(classId, student.getId())) {
            throw new BadRequestException("Học viên đã tham gia lớp học này rồi");
        }
        ClassStudent classStudent = ClassStudent.builder()
                .classroom(classroom)
                .student(student)
                .isActive(true)
                .enrolledAt(Instant.now())
                .build();
        classStudentRepository.save(classStudent);

        student.setCurrentLevel(classroom.getLevel() != null ? classroom.getLevel().name() : null);
        studentRepository.save(student);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ClassroomResponse> getTeacherClasses(UUID teacherUserId) {
        return classroomRepository.findByTeacherId(teacherUserId).stream()
                .map(c -> mapToResponse(c, classStudentRepository.countByClassroomIdAndIsActiveTrue(c.getId())))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ClassroomResponse getClassroomById(UUID classId) {
        Classroom classroom = classroomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học"));
        return mapToResponse(classroom, classStudentRepository.countByClassroomIdAndIsActiveTrue(classId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyCourseResponse> getStudentCourses(UUID studentUserId) {
        List<ClassStudent> enrollments = classStudentRepository.findActiveEnrollmentsWithClassroom(studentUserId);
        if (enrollments.isEmpty()) {
            return Collections.emptyList();
        }

        // Lấy toàn bộ bài nộp hoàn thành của học sinh
        List<AssignmentAttempt> completedAttempts = assignmentAttemptRepository.findCompletedAttemptsByStudentId(studentUserId);
        Set<UUID> submittedAssignmentIds = completedAttempts.stream()
                .filter(a -> a.getAssignment() != null)
                .map(a -> a.getAssignment().getId())
                .collect(Collectors.toSet());

        // Lấy tiến độ các ngày học của học sinh
        List<StudentDailyProgress> studentProgresses = studentDailyProgressRepository.findByStudentId(studentUserId);
        Map<UUID, StudentDailyProgress> progressByPlanId = studentProgresses.stream()
                .filter(p -> p.getDailyPlan() != null)
                .collect(Collectors.toMap(p -> p.getDailyPlan().getId(), p -> p, (p1, p2) -> p1));

        // Lấy lịch sử xem video đã hoàn thành của học sinh
        List<VideoWatchHistory> completedVideos = videoWatchHistoryRepository.findByStudentIdAndIsCompletedTrue(studentUserId);
        Set<UUID> completedLessonIdsByVideo = completedVideos.stream()
                .filter(v -> v.getVideo() != null && v.getVideo().getLesson() != null)
                .map(v -> v.getVideo().getLesson().getId())
                .collect(Collectors.toSet());

        return enrollments.stream().map(enrollment -> {
            Classroom c = enrollment.getClassroom();
            String teacherName = "Chưa phân công";
            if (c.getTeacher() != null && c.getTeacher().getUser() != null) {
                teacherName = c.getTeacher().getUser().getFirstName() + " " + c.getTeacher().getUser().getLastName();
            }

            // 1. Danh sách Assignment của lớp
            List<Assignment> classAssignments = assignmentRepository.findByClassroomId(c.getId());

            // 2. Danh sách DailyStudyPlan và DailyPlanItem của lớp
            List<DailyStudyPlan> plans = dailyStudyPlanRepository.findByClassroomIdWithItems(c.getId());
            int totalDailyPlanItems = plans.stream()
                    .mapToInt(p -> p.getItems() != null ? p.getItems().size() : 0)
                    .sum();

            // 3. Danh sách Lesson của lớp
            List<Lesson> lessons = lessonRepository.findByClassroomIdOrderByOrderIndexAsc(c.getId());
            int totalLessons = lessons.size();

            // 4. Tính totalTasks = Tổng số Assignment + Tổng số DailyPlanItem (hoặc tổng số Lesson nếu chưa có bài tập/kế hoạch)
            int totalTasks = classAssignments.size() + totalDailyPlanItems;
            if (totalTasks == 0 && totalLessons > 0) {
                totalTasks = totalLessons;
            }

            // 5. Tính completedTasks:
            // - Số bài tập đã nộp (AssignmentAttempt SUBMITTED / GRADING / COMPLETED)
            long completedAssignmentsCount = classAssignments.stream()
                    .filter(a -> submittedAssignmentIds.contains(a.getId()))
                    .count();

            // - Số DailyPlanItem đã hoàn thành (StudentDailyProgress completed = true hoặc số items hoàn thành)
            int completedPlanItemsCount = 0;
            for (DailyStudyPlan plan : plans) {
                StudentDailyProgress prog = progressByPlanId.get(plan.getId());
                if (prog != null) {
                    if (Boolean.TRUE.equals(prog.getIsCompleted())) {
                        completedPlanItemsCount += (plan.getItems() != null ? plan.getItems().size() : 0);
                    } else if (prog.getCompletedItemsCount() != null) {
                        completedPlanItemsCount += prog.getCompletedItemsCount();
                    }
                }
            }

            int completedTasks = (int) (completedAssignmentsCount + completedPlanItemsCount);

            // 6. Tính completedLessons:
            // Số Lesson mà học sinh đã xem xong video (VideoWatchHistory.isCompleted = true)
            // hoặc đã hoàn thành bài tập gắn với lesson đó
            Set<UUID> completedLessonIdsByAssignment = classAssignments.stream()
                    .filter(a -> a.getLesson() != null && submittedAssignmentIds.contains(a.getId()))
                    .map(a -> a.getLesson().getId())
                    .collect(Collectors.toSet());

            int completedLessons = 0;
            for (Lesson lesson : lessons) {
                if (completedLessonIdsByVideo.contains(lesson.getId()) || completedLessonIdsByAssignment.contains(lesson.getId())) {
                    completedLessons++;
                }
            }

            if (classAssignments.isEmpty() && totalDailyPlanItems == 0 && totalLessons > 0) {
                completedTasks = completedLessons;
            }

            // 7. Tính progressPercentage = totalTasks == 0 ? 0.0 : Math.min(100.0, Math.round((completedTasks * 1000.0) / totalTasks) / 10.0)
            double progressPercentage = totalTasks == 0
                    ? 0.0
                    : Math.min(100.0, Math.round((completedTasks * 1000.0) / totalTasks) / 10.0);

            return MyCourseResponse.builder()
                    .classId(c.getId())
                    .className(c.getName())
                    .level(c.getLevel())
                    .status(c.getStatus())
                    .teacherName(teacherName)
                    .enrolledAt(enrollment.getEnrolledAt())
                    .progressPercentage(progressPercentage)
                    .completedLessons(completedLessons)
                    .totalLessons(totalLessons)
                    .completedTasks(completedTasks)
                    .totalTasks(totalTasks)
                    .build();
        }).collect(Collectors.toList());
    }

    @Override
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
                .joinCode(c.getJoinCode())
                .currentStudentsCount(currentCount)
                .teacherId(teacherId)
                .teacherName(teacherName)
                .createdAt(c.getCreatedAt())
                .build();
    }

    @Override
    @Transactional
    public void leaveClass(UUID classId, UUID studentId) {
        ClassStudent enrollment = classStudentRepository
                .findByClassroomIdAndStudentId(classId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin ghi danh"));
        enrollment.setIsActive(false);
        classStudentRepository.save(enrollment);

        List<ClassStudent> remaining = classStudentRepository.findActiveEnrollmentsWithClassroom(studentId);
        String newLevel = null;
        if (!remaining.isEmpty()) {
            Classroom c = remaining.get(0).getClassroom();
            if (c != null && c.getLevel() != null) {
                newLevel = c.getLevel().name();
            }
        }
        final String finalLevel = newLevel;
        studentRepository.findById(studentId).ifPresent(s -> {
            s.setCurrentLevel(finalLevel);
            studentRepository.save(s);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<StudentProgressResponse> getClassStudentsProgress(UUID classId) {
        List<Object[]> results = entityManager.createQuery(
                "SELECT s.id, u.firstName, u.lastName, u.email, u.phone, cs.enrolledAt " +
                        "FROM ClassStudent cs " +
                        "LEFT JOIN cs.student s " +
                        "LEFT JOIN s.user u " +
                        "WHERE cs.classroom.id = :classId AND cs.isActive = true",
                Object[].class)
                .setParameter("classId", classId)
                .getResultList();

        List<DailyStudyPlan> plans = dailyStudyPlanRepository.findByClassroomIdWithItems(classId);
        List<Assignment> classAssignments = assignmentRepository.findByClassroomId(classId);
        List<Lesson> classLessons = lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classId);

        int totalPlanItems = plans.stream()
                .mapToInt(p -> p.getItems() != null ? p.getItems().size() : 0)
                .sum();
        int totalClassTasks = classAssignments.size() + totalPlanItems;
        if (totalClassTasks == 0 && !classLessons.isEmpty()) {
            totalClassTasks = classLessons.size();
        }

        List<UUID> studentIds = new ArrayList<>();
        for (Object[] row : results) {
            if (row[0] != null)
                studentIds.add((UUID) row[0]);
        }

        final List<StudentDailyProgress> allProgress = studentIds.isEmpty()
                ? Collections.emptyList()
                : studentDailyProgressRepository.findByStudentIdIn(studentIds);

        final List<AssignmentAttempt> allAttempts = studentIds.isEmpty()
                ? Collections.emptyList()
                : entityManager.createQuery(
                        "SELECT a FROM AssignmentAttempt a JOIN FETCH a.assignment WHERE a.student.id IN :studentIds AND a.status IN ('SUBMITTED', 'GRADING', 'COMPLETED')",
                        AssignmentAttempt.class)
                        .setParameter("studentIds", studentIds)
                        .getResultList();

        List<StudentProgressResponse> responseList = new ArrayList<>();

        for (Object[] row : results) {
            UUID studentId = row[0] != null ? (UUID) row[0] : null;
            if (studentId == null)
                continue;
            final UUID currentStudentId = studentId;

            String fName = row[1] != null ? row[1].toString() : "";
            String lName = row[2] != null ? row[2].toString() : "";
            String fullName = (fName + " " + lName).trim();
            if (fullName.isEmpty())
                fullName = "Học viên ẩn danh";

            String email = row[3] != null ? row[3].toString() : "N/A";
            String phone = row[4] != null ? row[4].toString() : "N/A";
            String enrolledAt = row[5] != null ? row[5].toString() : "N/A";

            List<StudentProgressResponse.DailyProgressDetail> dailyProgressDetails = new ArrayList<>();
            int totalStudyMinutes = 0;
            double totalScoreSum = 0.0;
            int scoredAttemptsCount = 0;

            for (DailyStudyPlan plan : plans) {
                int planTotalItems = plan.getItems() != null ? plan.getItems().size() : 0;
                int planCompletedTasks = 0;
                int planDurationSeconds = 0;
                double planScoreSum = 0.0;
                int planScoredCount = 0;

                StudentDailyProgress progress = allProgress.stream()
                        .filter(p -> p.getStudent().getId().equals(currentStudentId)
                                && p.getDailyPlan().getId().equals(plan.getId()))
                        .findFirst().orElse(null);

                if (progress != null && Boolean.TRUE.equals(progress.getIsCompleted())) {
                    planCompletedTasks = planTotalItems;
                    planDurationSeconds = plan.getEstimatedMinutes() != null ? plan.getEstimatedMinutes() * 60
                            : 30 * 60;
                } else if (plan.getItems() != null) {
                    for (var item : plan.getItems()) {
                        if (item.getAssignment() != null) {
                            UUID assignId = item.getAssignment().getId();
                            AssignmentAttempt attempt = allAttempts.stream()
                                    .filter(a -> a.getStudent().getId().equals(currentStudentId)
                                            && a.getAssignment().getId().equals(assignId))
                                    .findFirst().orElse(null);
                            if (attempt != null) {
                                planCompletedTasks++;
                                if (attempt.getDurationSeconds() != null) {
                                    planDurationSeconds += attempt.getDurationSeconds();
                                }
                                if (attempt.getTotalScore() != null) {
                                    planScoreSum += attempt.getTotalScore();
                                    planScoredCount++;
                                }
                            }
                        } else {
                            if (progress != null && progress.getCompletedItemsCount() != null
                                    && progress.getCompletedItemsCount() > 0) {
                                planCompletedTasks++;
                            }
                        }
                    }
                }

                totalStudyMinutes += (planDurationSeconds / 60);
                totalScoreSum += planScoreSum;
                scoredAttemptsCount += planScoredCount;

                double planAvgScore = planScoredCount > 0 ? (planScoreSum / planScoredCount) : 0.0;
                planAvgScore = Math.round(planAvgScore * 10.0) / 10.0;

                dailyProgressDetails.add(StudentProgressResponse.DailyProgressDetail.builder()
                        .date("Day " + plan.getDayNumber())
                        .completedTasks(planCompletedTasks)
                        .studyMinutes(planDurationSeconds > 0 ? planDurationSeconds / 60 : 0)
                        .score(planAvgScore)
                        .build());
            }

            // Tính tổng số bài tập đã nộp của học sinh
            long submittedAssignmentsCount = classAssignments.stream()
                    .filter(a -> allAttempts.stream()
                            .anyMatch(att -> att.getStudent().getId().equals(currentStudentId) && att.getAssignment().getId().equals(a.getId())))
                    .count();

            // Tính số nhiệm vụ lộ trình ngày đã hoàn thành
            int completedPlanItems = 0;
            for (DailyStudyPlan plan : plans) {
                StudentDailyProgress progress = allProgress.stream()
                        .filter(p -> p.getStudent().getId().equals(currentStudentId)
                                && p.getDailyPlan().getId().equals(plan.getId()))
                        .findFirst().orElse(null);
                if (progress != null) {
                    if (Boolean.TRUE.equals(progress.getIsCompleted())) {
                        completedPlanItems += (plan.getItems() != null ? plan.getItems().size() : 0);
                    } else if (progress.getCompletedItemsCount() != null) {
                        completedPlanItems += progress.getCompletedItemsCount();
                    }
                }
            }

            int studentTotalCompletedTasks = (int) (submittedAssignmentsCount + completedPlanItems);
            if (classAssignments.isEmpty() && totalPlanItems == 0 && !classLessons.isEmpty()) {
                // Nếu chưa có bài tập hay lộ trình ngày, tính theo số bài học hoàn thành
                studentTotalCompletedTasks = 0;
            }

            // Tính chính xác attendanceRate (tiến độ tổng hợp của học sinh trong lớp)
            int attendanceRate = totalClassTasks > 0
                    ? (int) Math.min(100, Math.round(((double) studentTotalCompletedTasks / totalClassTasks) * 100))
                    : 0;

            double averageScore = scoredAttemptsCount > 0 ? (totalScoreSum / scoredAttemptsCount) : 0.0;
            averageScore = Math.round(averageScore * 10.0) / 10.0;

            responseList.add(StudentProgressResponse.builder()
                    .studentId(studentId)
                    .fullName(fullName)
                    .email(email)
                    .phone(phone)
                    .enrolledAt(enrolledAt)
                    .completedTasks(studentTotalCompletedTasks)
                    .totalTasks(totalClassTasks)
                    .completionRate(attendanceRate)
                    .attendanceRate(attendanceRate)
                    .attendanceScore(attendanceRate)
                    .averageScore(averageScore)
                    .weaknesses(new ArrayList<>())
                    .totalStudyMinutes(totalStudyMinutes)
                    .dailyProgressDetails(dailyProgressDetails)
                    .build());
        }

        return responseList;
    }
}
