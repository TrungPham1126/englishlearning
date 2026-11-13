package com.englishlearning.analytics.service.impl;

import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.ai.repository.AiGeneratedExerciseRepository;
import com.englishlearning.analytics.dto.AdminDatabaseOverviewDto;
import com.englishlearning.analytics.dto.ClassroomDetailedReportDto;
import com.englishlearning.analytics.dto.ClassroomPurgeResultDto;
import com.englishlearning.analytics.dto.R2CostReportDto;
import com.englishlearning.analytics.service.AdminDatabaseService;
import com.englishlearning.analytics.service.ClassroomReportExcelExporter;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.ExerciseAudio;
import com.englishlearning.assignment.repository.AssignmentQuestionRepository;
import com.englishlearning.assignment.repository.AssignmentRepository;
import com.englishlearning.assignment.repository.ExerciseAudioRepository;
import com.englishlearning.assignment.repository.QuestionOptionRepository;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.classroom.dto.StudentProgressResponse;
import com.englishlearning.classroom.entity.ClassStatus;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.classroom.service.ClassroomService;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.curriculum.entity.DailyStudyPlan;
import com.englishlearning.curriculum.entity.GlobalResource;
import com.englishlearning.curriculum.entity.Lesson;
import com.englishlearning.curriculum.entity.LessonDocument;
import com.englishlearning.curriculum.repository.*;
import com.englishlearning.notification.repository.NotificationRepository;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import com.englishlearning.submission.repository.StudentAnswerRepository;
import com.englishlearning.system.service.AuditLogService;
import com.englishlearning.video.dto.R2BucketSnapshot;
import com.englishlearning.video.entity.Video;
import com.englishlearning.video.repository.VideoRepository;
import com.englishlearning.video.repository.VideoWatchHistoryRepository;
import com.englishlearning.video.service.R2StorageService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminDatabaseServiceImpl implements AdminDatabaseService {

    private static final double BYTES_PER_GB = 1024.0 * 1024.0 * 1024.0;
    private static final double BYTES_PER_MB = 1024.0 * 1024.0;
    private static final double FREE_STORAGE_GB = 10.0;
    private static final long FREE_CLASS_A_OPS = 1_000_000L;
    private static final long FREE_CLASS_B_OPS = 10_000_000L;
    private static final double STORAGE_USD_PER_GB = 0.015;
    private static final double CLASS_A_USD_PER_MILLION = 4.50;
    private static final double CLASS_B_USD_PER_MILLION = 0.36;
    private static final long EST_AUDIO_FILE_BYTES = 240_000L;
    private static final long EST_TTS_AUDIO_BYTES = 180_000L;
    private static final long EST_FALLBACK_VIDEO_BYTES = 15L * 1024L * 1024L;
    private static final long EST_FALLBACK_DOC_BYTES = 512_000L;
    private static final long EST_AVATAR_BYTES = 120_000L;

    private static final DateTimeFormatter VN_TIME_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final ClassroomRepository classroomRepository;
    private final ClassStudentRepository classStudentRepository;
    private final LessonRepository lessonRepository;
    private final LessonDocumentRepository lessonDocumentRepository;
    private final GrammarTopicRepository grammarTopicRepository;
    private final VocabularyItemRepository vocabularyItemRepository;
    private final StudentVocabularyProgressRepository studentVocabularyProgressRepository;
    private final DailyStudyPlanRepository dailyStudyPlanRepository;
    private final DailyPlanItemRepository dailyPlanItemRepository;
    private final StudentDailyProgressRepository studentDailyProgressRepository;
    private final AssignmentRepository assignmentRepository;
    private final AssignmentQuestionRepository assignmentQuestionRepository;
    private final QuestionOptionRepository questionOptionRepository;
    private final ExerciseAudioRepository exerciseAudioRepository;
    private final AssignmentAttemptRepository assignmentAttemptRepository;
    private final StudentAnswerRepository studentAnswerRepository;
    private final AiEvaluationRepository aiEvaluationRepository;
    private final AiGeneratedExerciseRepository aiGeneratedExerciseRepository;
    private final VideoRepository videoRepository;
    private final VideoWatchHistoryRepository videoWatchHistoryRepository;
    private final GlobalResourceRepository globalResourceRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ClassroomService classroomService;
    private final ClassroomReportExcelExporter excelExporter;
    private final R2StorageService r2StorageService;
    private final AuditLogService auditLogService;

    @Autowired(required = false)
    private EntityManager entityManager;

    @Value("${app.r2.usd-to-vnd-rate:25400}")
    private long usdToVndRate = 25400L;

    @Value("${app.r2.monthly-budget-usd:20.0}")
    private double monthlyBudgetUsd = 20.0;

    @Override
    @Transactional(readOnly = true)
    public AdminDatabaseOverviewDto getDatabaseOverview() {
        List<Classroom> classrooms = classroomRepository.findAll();
        classrooms.sort(Comparator.comparing(Classroom::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));

        List<AdminDatabaseOverviewDto.ClassroomDatabaseItemDto> items = new ArrayList<>();
        long completedCount = 0;
        long totalStudents = 0;
        long totalAssignments = 0;
        long totalExams = 0;
        long totalAttempts = 0;
        long totalAnswers = 0;
        long totalAiEvals = 0;
        long totalDailyProgress = 0;
        long totalAudioFiles = 0;
        long totalEstimatedKb = 0;

        for (Classroom classroom : classrooms) {
            AdminDatabaseOverviewDto.ClassroomDatabaseItemDto item = buildClassroomItem(classroom);
            items.add(item);

            if (classroom.getStatus() == ClassStatus.COMPLETED) {
                completedCount++;
            }
            totalStudents += item.getStudentCount();
            totalAssignments += item.getAssignmentCount();
            totalExams += item.getExamCount();
            totalAttempts += item.getAttemptCount();
            totalAnswers += item.getAnswerCount();
            totalAiEvals += item.getAiEvaluationCount();
            totalDailyProgress += item.getDailyProgressCount();
            totalAudioFiles += item.getSubmissionAudioCount();
            totalEstimatedKb += item.getEstimatedSubmissionKb();
        }

        return AdminDatabaseOverviewDto.builder()
                .totalClassrooms(classrooms.size())
                .completedClassrooms(completedCount)
                .totalEnrolledStudents(totalStudents)
                .totalAssignments(totalAssignments)
                .totalExams(totalExams)
                .totalAttempts(totalAttempts)
                .totalStudentAnswers(totalAnswers)
                .totalAiEvaluations(totalAiEvals)
                .totalDailyProgressRecords(totalDailyProgress)
                .totalSubmissionAudioFiles(totalAudioFiles)
                .estimatedSubmissionDataKb(totalEstimatedKb)
                .classrooms(items)
                .build();
    }

    @Override
    @Transactional
    public ClassroomPurgeResultDto purgeClassroomSubmissions(UUID classroomId, boolean force, UUID actorUserId, String ipAddress) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học với ID: " + classroomId));

        if (!force && classroom.getStatus() != ClassStatus.COMPLETED && classroom.getStatus() != ClassStatus.CANCELLED) {
            throw new BadRequestException(
                    "Chỉ khuyến nghị xóa dữ liệu làm bài cho lớp ĐÃ KẾT THÚC (COMPLETED) hoặc ĐÃ HỦY (CANCELLED). "
                            + "Vui lòng chuyển trạng thái lớp hoặc xác nhận xóa bắt buộc.");
        }

        List<UUID> lessonIds = extractLessonIds(classroomId);
        List<UUID> assignmentIds = collectAllAssignmentIdsForClass(classroomId, lessonIds);
        PurgeStats stats = purgeStudentWorkInternal(classroomId, lessonIds, assignmentIds);
        flushAndClear();

        long freedKb = (stats.deletedAttempts * 4L)
                + (stats.deletedAnswers * 2L)
                + (stats.deletedAiEvals * 6L)
                + (stats.deletedR2Files * 240L)
                + (stats.deletedDailyProgress * 1L);

        String metadata = String.format(
                "{\"force\":%s,\"deletedAttempts\":%d,\"deletedAnswers\":%d,\"deletedAiEvaluations\":%d,\"deletedDailyProgress\":%d,\"deletedR2Files\":%d}",
                force, stats.deletedAttempts, stats.deletedAnswers, stats.deletedAiEvals, stats.deletedDailyProgress, stats.deletedR2Files);
        recordSafeAudit(actorUserId, "PURGE_CLASSROOM_SUBMISSIONS", "Classroom", classroomId.toString(), ipAddress, metadata);

        String message = String.format(
                "Đã dọn sạch dữ liệu làm bài của lớp '%s': %d lượt nộp, %d câu trả lời, %d đánh giá AI, %d bản ghi tiến độ ngày và %d file audio R2.",
                classroom.getName(), stats.deletedAttempts, stats.deletedAnswers, stats.deletedAiEvals,
                stats.deletedDailyProgress, stats.deletedR2Files);

        return ClassroomPurgeResultDto.builder()
                .classroomId(classroomId)
                .classroomName(classroom.getName())
                .entireClassroomDeleted(false)
                .deletedAiEvaluations(stats.deletedAiEvals)
                .deletedStudentAnswers(stats.deletedAnswers)
                .deletedAttempts(stats.deletedAttempts)
                .deletedDailyProgress(stats.deletedDailyProgress)
                .deletedVideoWatchHistory(stats.deletedVideoWatch)
                .deletedVocabularyProgress(stats.deletedVocabProgress)
                .deletedR2MediaFiles(stats.deletedR2Files)
                .freedEstimatedKb(freedKb)
                .message(message)
                .executedAt(Instant.now())
                .build();
    }

    @Override
    @Transactional
    public ClassroomPurgeResultDto deleteClassroom(UUID classroomId, UUID actorUserId, String ipAddress) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học với ID: " + classroomId));
        String classroomName = classroom.getName();

        List<UUID> lessonIds = extractLessonIds(classroomId);
        List<UUID> assignmentIds = collectAllAssignmentIdsForClass(classroomId, lessonIds);

        // 1. Dọn toàn bộ dữ liệu làm bài và tiến độ học viên + audio speaking R2
        PurgeStats stats = purgeStudentWorkInternal(classroomId, lessonIds, assignmentIds);

        // 2. Xóa lộ trình học tập theo ngày
        List<UUID> planIds = extractDailyPlanIds(classroomId);
        if (!planIds.isEmpty()) {
            dailyPlanItemRepository.deleteByDailyPlanIdIn(planIds);
        }
        if (!assignmentIds.isEmpty()) {
            dailyPlanItemRepository.deleteByAssignmentIdIn(assignmentIds);
        }
        if (!planIds.isEmpty()) {
            dailyStudyPlanRepository.deleteByIdIn(planIds);
        }

        // Thu thập các URL nằm trong Kho học liệu dùng chung để tránh xóa nhầm file dùng chung
        Set<String> protectedGlobalUrls = globalResourceRepository.findAll().stream()
                .map(GlobalResource::getStorageUrl)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // 3. Xóa bài tập / đề thi, câu hỏi, lựa chọn và audio bài nghe R2
        int deletedClassMediaFiles = 0;
        if (!assignmentIds.isEmpty()) {
            deletedClassMediaFiles += deleteAssignmentsCascade(assignmentIds, protectedGlobalUrls);
        }

        // 4. Xóa bài giảng, video (raw + HLS), tài liệu, từ vựng, ngữ pháp
        if (!lessonIds.isEmpty()) {
            deletedClassMediaFiles += deleteLessonsCascade(lessonIds, protectedGlobalUrls);
        }

        // 5. Xóa thông báo thuộc lớp, danh sách ghi danh và bản ghi lớp học
        notificationRepository.deleteByClassroomId(classroomId);
        classStudentRepository.deleteByClassroomId(classroomId);
        flushAndClear();
        classroomRepository.deleteClassroomRowById(classroomId);

        long totalR2Deleted = stats.deletedR2Files + deletedClassMediaFiles;
        long freedKb = (stats.deletedAttempts * 4L)
                + (stats.deletedAnswers * 2L)
                + (stats.deletedAiEvals * 6L)
                + (totalR2Deleted * 512L);

        String metadata = String.format(
                "{\"classroomName\":\"%s\",\"deletedAttempts\":%d,\"deletedLessons\":%d,\"deletedAssignments\":%d,\"deletedR2Files\":%d}",
                classroomName.replace("\"", "'"), stats.deletedAttempts, lessonIds.size(), assignmentIds.size(), totalR2Deleted);
        recordSafeAudit(actorUserId, "DELETE_CLASSROOM", "Classroom", classroomId.toString(), ipAddress, metadata);

        return ClassroomPurgeResultDto.builder()
                .classroomId(classroomId)
                .classroomName(classroomName)
                .entireClassroomDeleted(true)
                .deletedAiEvaluations(stats.deletedAiEvals)
                .deletedStudentAnswers(stats.deletedAnswers)
                .deletedAttempts(stats.deletedAttempts)
                .deletedDailyProgress(stats.deletedDailyProgress)
                .deletedVideoWatchHistory(stats.deletedVideoWatch)
                .deletedVocabularyProgress(stats.deletedVocabProgress)
                .deletedR2MediaFiles(totalR2Deleted)
                .freedEstimatedKb(freedKb)
                .message(String.format("Đã xóa vĩnh viễn lớp học '%s' cùng %d lượt làm bài và %d file lưu trữ liên quan.",
                        classroomName, stats.deletedAttempts, totalR2Deleted))
                .executedAt(Instant.now())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public ClassroomDetailedReportDto getClassroomDetailedReport(UUID classroomId) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học với ID: " + classroomId));

        List<Lesson> lessons = lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classroomId);
        List<DailyStudyPlan> plans = dailyStudyPlanRepository.findByClassroomId(classroomId);
        List<Assignment> assignments = assignmentRepository.findByClassroomId(classroomId);
        List<AssignmentAttempt> attempts = assignmentAttemptRepository.findAllByClassroomIdWithDetails(classroomId);
        List<StudentProgressResponse> studentProgresses = classroomService.getClassStudentsProgress(classroomId);

        Map<UUID, List<AssignmentAttempt>> attemptsByStudentId = attempts.stream()
                .filter(a -> a.getStudent() != null && a.getStatus() != AttemptStatus.IN_PROGRESS)
                .collect(Collectors.groupingBy(a -> a.getStudent().getId()));

        List<ClassroomDetailedReportDto.StudentReportRowDto> studentRows = new ArrayList<>();
        double sumAvgScore = 0.0;
        int scoredStudentCount = 0;
        double sumCompletion = 0.0;

        for (StudentProgressResponse sp : studentProgresses) {
            List<AssignmentAttempt> studentAttempts = attemptsByStudentId.getOrDefault(sp.getStudentId(), Collections.emptyList());
            long examCount = studentAttempts.stream()
                    .filter(a -> a.getAssignment() != null && Boolean.TRUE.equals(a.getAssignment().getIsExam()))
                    .count();
            long cheatingFlags = studentAttempts.stream()
                    .filter(a -> Boolean.TRUE.equals(a.getIsCheatingFlagged()))
                    .count();

            double avgScore = sp.getAverageScore() != null ? sp.getAverageScore() : 0.0;
            int completionRate = sp.getCompletionRate() != null ? sp.getCompletionRate() : 0;
            sumCompletion += completionRate;
            if (!studentAttempts.isEmpty() && avgScore > 0) {
                sumAvgScore += avgScore;
                scoredStudentCount++;
            }

            studentRows.add(ClassroomDetailedReportDto.StudentReportRowDto.builder()
                    .studentId(sp.getStudentId())
                    .fullName(sp.getFullName())
                    .email(sp.getEmail())
                    .phone(sp.getPhone())
                    .enrolledAt(sp.getEnrolledAt())
                    .completedTasks(sp.getCompletedTasks() != null ? sp.getCompletedTasks() : 0)
                    .totalTasks(sp.getTotalTasks() != null ? sp.getTotalTasks() : 0)
                    .completionRate(completionRate)
                    .averageScore(avgScore)
                    .totalAttempts(studentAttempts.size())
                    .examAttempts(examCount)
                    .cheatingFlags(cheatingFlags)
                    .totalStudyMinutes(sp.getTotalStudyMinutes() != null ? sp.getTotalStudyMinutes() : 0)
                    .classification(classifyScore(avgScore, studentAttempts.size()))
                    .build());
        }

        List<ClassroomDetailedReportDto.AttemptReportRowDto> submissionRows = new ArrayList<>();
        long completedAttemptsCount = 0;
        long cheatingFlaggedCount = 0;

        for (AssignmentAttempt att : attempts) {
            if (att.getStatus() == AttemptStatus.IN_PROGRESS) {
                continue;
            }
            if (att.getStatus() == AttemptStatus.COMPLETED) {
                completedAttemptsCount++;
            }
            if (Boolean.TRUE.equals(att.getIsCheatingFlagged())) {
                cheatingFlaggedCount++;
            }

            User studentUser = att.getStudent() != null ? att.getStudent().getUser() : null;
            String stName = studentUser != null ? studentUser.getFullName() : "Học viên";
            String stEmail = studentUser != null ? studentUser.getEmail() : "-";
            Assignment ass = att.getAssignment();

            submissionRows.add(ClassroomDetailedReportDto.AttemptReportRowDto.builder()
                    .attemptId(att.getId())
                    .studentName(stName)
                    .studentEmail(stEmail)
                    .assignmentTitle(ass != null ? ass.getTitle() : "-")
                    .skillType(ass != null && ass.getSkillType() != null ? ass.getSkillType().name() : "-")
                    .exam(ass != null && Boolean.TRUE.equals(ass.getIsExam()))
                    .attemptNumber(att.getAttemptNumber() != null ? att.getAttemptNumber() : 1)
                    .status(att.getStatus() != null ? att.getStatus().name() : "-")
                    .submittedAt(att.getSubmittedAt() != null ? VN_TIME_FMT.format(att.getSubmittedAt()) : "-")
                    .durationSeconds(att.getDurationSeconds())
                    .totalScore(att.getTotalScore())
                    .violationCount(att.getViolationCount() != null ? att.getViolationCount() : 0)
                    .cheatingFlagged(Boolean.TRUE.equals(att.getIsCheatingFlagged()))
                    .cheatingReason(att.getCheatingReason())
                    .teacherFeedback(att.getTeacherFeedback())
                    .build());
        }

        User teacherUser = classroom.getTeacher() != null ? classroom.getTeacher().getUser() : null;
        int examDefCount = (int) assignments.stream().filter(a -> Boolean.TRUE.equals(a.getIsExam())).count();
        int practiceDefCount = assignments.size() - examDefCount;
        double classAvg = scoredStudentCount > 0 ? Math.round((sumAvgScore / scoredStudentCount) * 100.0) / 100.0 : 0.0;
        double avgCompletion = !studentRows.isEmpty() ? Math.round((sumCompletion / studentRows.size()) * 10.0) / 10.0 : 0.0;

        return ClassroomDetailedReportDto.builder()
                .classroomId(classroom.getId())
                .classroomName(classroom.getName())
                .description(classroom.getDescription())
                .level(classroom.getLevel() != null ? classroom.getLevel().name() : "-")
                .status(classroom.getStatus() != null ? classroom.getStatus().name() : "-")
                .teacherName(teacherUser != null ? teacherUser.getFullName() : "Chưa phân công")
                .teacherEmail(teacherUser != null ? teacherUser.getEmail() : "-")
                .startDate(classroom.getStartDate() != null ? classroom.getStartDate().toString() : "-")
                .endDate(classroom.getEndDate() != null ? classroom.getEndDate().toString() : "-")
                .generatedAt(Instant.now())
                .totalStudents(studentRows.size())
                .totalLessons(lessons.size())
                .totalDailyPlans(plans.size())
                .totalAssignments(practiceDefCount)
                .totalExams(examDefCount)
                .totalAttempts(submissionRows.size())
                .completedAttempts(completedAttemptsCount)
                .flaggedCheatingAttempts(cheatingFlaggedCount)
                .classAverageScore(classAvg)
                .averageCompletionRate(avgCompletion)
                .students(studentRows)
                .submissions(submissionRows)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportClassroomReportExcel(UUID classroomId) {
        ClassroomDetailedReportDto report = getClassroomDetailedReport(classroomId);
        return excelExporter.export(report);
    }

    @Override
    public byte[] exportClassroomReportExcel(ClassroomDetailedReportDto report) {
        return excelExporter.export(report);
    }

    @Override
    @Transactional(readOnly = true)
    public R2CostReportDto getR2CostReport() {
        R2BucketSnapshot snapshot = r2StorageService.inspectBucketSnapshot();

        long effectiveObjects;
        long effectiveBytes;
        List<R2BucketSnapshot.R2PrefixStat> rawCategories;
        List<R2BucketSnapshot.R2ObjectItem> rawLargest;
        String sourceMode;

        if (snapshot.isLiveConnected()) {
            sourceMode = "LIVE_R2";
            effectiveObjects = snapshot.getTotalObjects();
            effectiveBytes = snapshot.getTotalBytes();
            rawCategories = snapshot.getPrefixStats() != null ? snapshot.getPrefixStats() : Collections.emptyList();
            rawLargest = snapshot.getLargestObjects() != null ? snapshot.getLargestObjects() : Collections.emptyList();
        } else {
            sourceMode = "DATABASE_ESTIMATE";
            DbMediaEstimate est = estimateDatabaseMediaBreakdown();
            effectiveObjects = est.totalObjects;
            effectiveBytes = est.totalBytes;
            rawCategories = est.prefixStats;
            rawLargest = est.largestObjects;
        }

        double totalStorageGb = effectiveBytes / BYTES_PER_GB;
        double billableStorageGb = Math.max(0.0, totalStorageGb - FREE_STORAGE_GB);
        double freeTierUsagePct = Math.min(100.0, Math.round((totalStorageGb / FREE_STORAGE_GB) * 1000.0) / 10.0);

        // Class A: PutObject + ListObjects (DeleteObject miễn phí trên R2)
        long classAOps = snapshot.getTrackedPutOps() + snapshot.getTrackedListOps();
        long classBOps = snapshot.getTrackedGetOps();
        long billableClassAOps = Math.max(0L, classAOps - FREE_CLASS_A_OPS);
        long billableClassBOps = Math.max(0L, classBOps - FREE_CLASS_B_OPS);

        double storageCostUsd = roundUsd(billableStorageGb * STORAGE_USD_PER_GB);
        double classACostUsd = roundUsd((billableClassAOps / 1_000_000.0) * CLASS_A_USD_PER_MILLION);
        double classBCostUsd = roundUsd((billableClassBOps / 1_000_000.0) * CLASS_B_USD_PER_MILLION);
        double totalPayableUsd = roundUsd(storageCostUsd + classACostUsd + classBCostUsd);

        double grossEquivalentUsd = roundUsd(
                (totalStorageGb * STORAGE_USD_PER_GB)
                        + ((classAOps / 1_000_000.0) * CLASS_A_USD_PER_MILLION)
                        + ((classBOps / 1_000_000.0) * CLASS_B_USD_PER_MILLION));

        long payableVnd = Math.round(totalPayableUsd * usdToVndRate);
        long grossVnd = Math.round(grossEquivalentUsd * usdToVndRate);

        List<R2CostReportDto.R2CategoryBreakdownDto> categoryBreakdowns = rawCategories.stream()
                .map(c -> {
                    double sizeMb = Math.round((c.getTotalBytes() / BYTES_PER_MB) * 100.0) / 100.0;
                    double sharePct = effectiveBytes > 0
                            ? Math.round((c.getTotalBytes() * 1000.0) / effectiveBytes) / 10.0
                            : 0.0;
                    double catGrossUsd = roundUsd((c.getTotalBytes() / BYTES_PER_GB) * STORAGE_USD_PER_GB);
                    return R2CostReportDto.R2CategoryBreakdownDto.builder()
                            .categoryKey(c.getCategoryKey())
                            .label(c.getCategoryLabel())
                            .prefix(c.getPrefix())
                            .objectCount(c.getObjectCount())
                            .totalBytes(c.getTotalBytes())
                            .sizeMb(sizeMb)
                            .sharePercent(sharePct)
                            .estimatedGrossStorageUsd(catGrossUsd)
                            .build();
                })
                .toList();

        List<R2CostReportDto.R2LargestObjectDto> largestDtos = rawLargest.stream()
                .map(o -> R2CostReportDto.R2LargestObjectDto.builder()
                        .key(o.getKey())
                        .category(o.getCategory())
                        .sizeBytes(o.getSizeBytes())
                        .sizeMb(Math.round((o.getSizeBytes() / BYTES_PER_MB) * 100.0) / 100.0)
                        .lastModified(o.getLastModified())
                        .build())
                .toList();

        return R2CostReportDto.builder()
                .bucketName(snapshot.getBucketName())
                .endpoint(snapshot.getEndpoint())
                .publicUrl(snapshot.getPublicUrl())
                .liveConnected(snapshot.isLiveConnected())
                .dataSourceMode(sourceMode)
                .statusMessage(snapshot.getStatusNote())
                .totalObjects(effectiveObjects)
                .totalBytes(effectiveBytes)
                .totalStorageGb(Math.round(totalStorageGb * 10000.0) / 10000.0)
                .freeStorageGb(FREE_STORAGE_GB)
                .billableStorageGb(Math.round(billableStorageGb * 10000.0) / 10000.0)
                .freeTierUsagePercent(freeTierUsagePct)
                .classAOps(classAOps)
                .freeClassAOps(FREE_CLASS_A_OPS)
                .billableClassAOps(billableClassAOps)
                .classBOps(classBOps)
                .freeClassBOps(FREE_CLASS_B_OPS)
                .billableClassBOps(billableClassBOps)
                .deleteOps(snapshot.getTrackedDeleteOps())
                .storageCostUsd(storageCostUsd)
                .classACostUsd(classACostUsd)
                .classBCostUsd(classBCostUsd)
                .egressCostUsd(0.0)
                .totalPayableUsd(totalPayableUsd)
                .totalPayableVnd(payableVnd)
                .grossEquivalentUsd(grossEquivalentUsd)
                .grossEquivalentVnd(grossVnd)
                .monthlyBudgetUsd(monthlyBudgetUsd)
                .usdToVndRate(usdToVndRate)
                .categoryBreakdowns(categoryBreakdowns)
                .largestObjects(largestDtos)
                .generatedAt(Instant.now())
                .build();
    }

    private AdminDatabaseOverviewDto.ClassroomDatabaseItemDto buildClassroomItem(Classroom classroom) {
        UUID classroomId = classroom.getId();
        List<ClassStudent> enrollments = classStudentRepository.findByClassroomId(classroomId);
        List<UUID> studentIds = enrollments.stream()
                .map(cs -> cs.getStudent().getId())
                .distinct()
                .toList();

        List<Lesson> lessons = lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classroomId);
        List<UUID> lessonIds = lessons.stream().map(Lesson::getId).toList();
        List<DailyStudyPlan> plans = dailyStudyPlanRepository.findByClassroomId(classroomId);
        List<UUID> planIds = plans.stream().map(DailyStudyPlan::getId).toList();
        List<Assignment> assignments = assignmentRepository.findByClassroomId(classroomId);
        List<AssignmentAttempt> attempts = assignmentAttemptRepository.findAllByClassroomIdWithDetails(classroomId);

        long examCount = assignments.stream().filter(a -> Boolean.TRUE.equals(a.getIsExam())).count();
        long practiceCount = assignments.size() - examCount;
        long answerCount = studentAnswerRepository.countByClassroomId(classroomId);
        long aiEvalCount = aiEvaluationRepository.countByClassroomId(classroomId);
        long audioCount = studentAnswerRepository.countAudioResponsesByClassroomId(classroomId);
        long dailyProgressCount = planIds.isEmpty() ? 0L : studentDailyProgressRepository.countByDailyPlanIdIn(planIds);

        List<UUID> videoIds = lessonIds.isEmpty()
                ? Collections.emptyList()
                : videoRepository.findByLessonIdIn(lessonIds).stream().map(Video::getId).toList();
        long videoWatchCount = (videoIds.isEmpty() || studentIds.isEmpty())
                ? 0L
                : videoWatchHistoryRepository.countByVideoIdInAndStudentIdIn(videoIds, studentIds);

        long cheatingFlags = attempts.stream().filter(a -> Boolean.TRUE.equals(a.getIsCheatingFlagged())).count();
        OptionalDouble avgOpt = attempts.stream()
                .filter(a -> a.getTotalScore() != null && a.getStatus() == AttemptStatus.COMPLETED)
                .mapToDouble(AssignmentAttempt::getTotalScore)
                .average();
        double avgScore = avgOpt.isPresent() ? Math.round(avgOpt.getAsDouble() * 10.0) / 10.0 : 0.0;

        long estKb = (attempts.size() * 4L)
                + (answerCount * 2L)
                + (aiEvalCount * 6L)
                + (audioCount * 240L)
                + dailyProgressCount
                + videoWatchCount;

        User teacherUser = classroom.getTeacher() != null ? classroom.getTeacher().getUser() : null;
        boolean eligibleClean = classroom.getStatus() == ClassStatus.COMPLETED
                || classroom.getStatus() == ClassStatus.CANCELLED;

        return AdminDatabaseOverviewDto.ClassroomDatabaseItemDto.builder()
                .id(classroomId)
                .name(classroom.getName())
                .level(classroom.getLevel() != null ? classroom.getLevel().name() : "-")
                .status(classroom.getStatus() != null ? classroom.getStatus().name() : "-")
                .teacherName(teacherUser != null ? teacherUser.getFullName() : "Chưa phân công")
                .startDate(classroom.getStartDate() != null ? classroom.getStartDate().toString() : "-")
                .endDate(classroom.getEndDate() != null ? classroom.getEndDate().toString() : "-")
                .studentCount(enrollments.size())
                .lessonCount(lessons.size())
                .dailyPlanCount(plans.size())
                .assignmentCount(practiceCount)
                .examCount(examCount)
                .attemptCount(attempts.size())
                .answerCount(answerCount)
                .aiEvaluationCount(aiEvalCount)
                .dailyProgressCount(dailyProgressCount)
                .videoWatchCount(videoWatchCount)
                .submissionAudioCount(audioCount)
                .cheatingFlagCount(cheatingFlags)
                .averageScore(avgScore)
                .estimatedSubmissionKb(estKb)
                .eligibleForCleanPurge(eligibleClean)
                .build();
    }

    private PurgeStats purgeStudentWorkInternal(UUID classroomId, List<UUID> lessonIds, List<UUID> assignmentIds) {
        PurgeStats stats = new PurgeStats();

        if (!assignmentIds.isEmpty()) {
            List<UUID> attemptIds = assignmentAttemptRepository.findIdsByAssignmentIdIn(assignmentIds);
            if (!attemptIds.isEmpty()) {
                List<String> studentAudioUrls = studentAnswerRepository.findAudioUrlsByAttemptIdIn(attemptIds);
                List<UUID> answerIds = studentAnswerRepository.findIdsByAttemptIdIn(attemptIds);

                if (!answerIds.isEmpty()) {
                    stats.deletedAiEvals = aiEvaluationRepository.deleteByStudentAnswerIdIn(answerIds);
                }
                stats.deletedAnswers = studentAnswerRepository.deleteByAttemptIdIn(attemptIds);
                stats.deletedAttempts = assignmentAttemptRepository.deleteByIdIn(attemptIds);
                stats.deletedR2Files = r2StorageService.deleteObjectsByUrlsOrKeys(studentAudioUrls);
            }
        }

        List<UUID> planIds = extractDailyPlanIds(classroomId);
        if (!planIds.isEmpty()) {
            stats.deletedDailyProgress = studentDailyProgressRepository.deleteByDailyPlanIdIn(planIds);
        }

        List<UUID> studentIds = classStudentRepository.findByClassroomId(classroomId).stream()
                .map(cs -> cs.getStudent().getId())
                .distinct()
                .toList();

        if (!lessonIds.isEmpty() && !studentIds.isEmpty()) {
            List<UUID> videoIds = videoRepository.findByLessonIdIn(lessonIds).stream()
                    .map(Video::getId)
                    .toList();
            if (!videoIds.isEmpty()) {
                stats.deletedVideoWatch = videoWatchHistoryRepository.deleteByVideoIdInAndStudentIdIn(videoIds, studentIds);
            }

            List<UUID> vocabIds = vocabularyItemRepository.findIdsByLessonIdIn(lessonIds);
            if (!vocabIds.isEmpty()) {
                stats.deletedVocabProgress = studentVocabularyProgressRepository.deleteByVocabularyIdInAndStudentIdIn(vocabIds, studentIds);
            }
        }

        return stats;
    }

    private int deleteAssignmentsCascade(List<UUID> assignmentIds, Set<String> protectedUrls) {
        Set<String> mediaToDelete = new LinkedHashSet<>();

        List<Assignment> assignments = assignmentRepository.findAllById(assignmentIds);
        for (Assignment a : assignments) {
            if (a.getAudioUrl() != null && !protectedUrls.contains(a.getAudioUrl())) {
                mediaToDelete.add(a.getAudioUrl());
            }
        }

        List<ExerciseAudio> audios = exerciseAudioRepository.findByAssignmentIdIn(assignmentIds);
        for (ExerciseAudio ea : audios) {
            if (ea.getUrl() != null && !protectedUrls.contains(ea.getUrl())) {
                mediaToDelete.add(ea.getUrl());
            }
        }
        exerciseAudioRepository.deleteByAssignmentIdIn(assignmentIds);

        List<UUID> questionIds = assignmentQuestionRepository.findIdsByAssignmentIdIn(assignmentIds);
        if (!questionIds.isEmpty()) {
            questionOptionRepository.deleteByQuestionIdIn(questionIds);
            assignmentQuestionRepository.deleteByIdIn(questionIds);
        }
        assignmentRepository.deleteByIdIn(assignmentIds);

        return r2StorageService.deleteObjectsByUrlsOrKeys(mediaToDelete);
    }

    private int deleteLessonsCascade(List<UUID> lessonIds, Set<String> protectedUrls) {
        int deletedFiles = 0;

        aiGeneratedExerciseRepository.deleteByLessonIdIn(lessonIds);

        List<Video> videos = videoRepository.findByLessonIdIn(lessonIds);
        if (!videos.isEmpty()) {
            List<UUID> videoIds = videos.stream().map(Video::getId).toList();
            videoWatchHistoryRepository.deleteByVideoIdIn(videoIds);

            for (Video v : videos) {
                if (v.getRawStorageUrl() != null && !protectedUrls.contains(v.getRawStorageUrl())) {
                    if (r2StorageService.deleteObjectByUrlOrKey(v.getRawStorageUrl())) {
                        deletedFiles++;
                    }
                }
                if (v.getThumbnailUrl() != null && !protectedUrls.contains(v.getThumbnailUrl())) {
                    if (r2StorageService.deleteObjectByUrlOrKey(v.getThumbnailUrl())) {
                        deletedFiles++;
                    }
                }
                if (v.getHlsPlaylistUrl() != null && !protectedUrls.contains(v.getHlsPlaylistUrl())) {
                    String hlsPrefix = extractHlsPrefix(v.getHlsPlaylistUrl());
                    if (hlsPrefix != null) {
                        deletedFiles += r2StorageService.deleteObjectsByPrefix(hlsPrefix);
                    }
                }
            }
            videoRepository.deleteByIdIn(videoIds);
        }

        List<LessonDocument> docs = lessonDocumentRepository.findByLessonIdIn(lessonIds);
        List<String> docUrls = docs.stream()
                .map(LessonDocument::getStorageUrl)
                .filter(url -> url != null && !protectedUrls.contains(url))
                .toList();
        lessonDocumentRepository.deleteByLessonIdIn(lessonIds);
        deletedFiles += r2StorageService.deleteObjectsByUrlsOrKeys(docUrls);

        List<UUID> vocabIds = vocabularyItemRepository.findIdsByLessonIdIn(lessonIds);
        if (!vocabIds.isEmpty()) {
            studentVocabularyProgressRepository.deleteByVocabularyIdIn(vocabIds);
            vocabularyItemRepository.deleteByIdIn(vocabIds);
        }

        grammarTopicRepository.deleteByLessonIdIn(lessonIds);
        lessonRepository.deleteByIdIn(lessonIds);
        return deletedFiles;
    }

    private DbMediaEstimate estimateDatabaseMediaBreakdown() {
        List<Video> videos = videoRepository.findAll();
        long videoBytes = 0L;
        for (Video v : videos) {
            videoBytes += (v.getSizeBytes() != null && v.getSizeBytes() > 0)
                    ? v.getSizeBytes()
                    : EST_FALLBACK_VIDEO_BYTES;
        }

        long speakingCount = studentAnswerRepository.countAllAudioResponses();
        long speakingBytes = speakingCount * EST_AUDIO_FILE_BYTES;

        long exerciseAudioCount = exerciseAudioRepository.count();
        long assignmentAudioCount = assignmentRepository.findAll().stream()
                .filter(a -> a.getAudioUrl() != null && !a.getAudioUrl().isBlank())
                .count();
        long ttsTotalCount = exerciseAudioCount + assignmentAudioCount;
        long ttsBytes = ttsTotalCount * EST_TTS_AUDIO_BYTES;

        List<LessonDocument> docs = lessonDocumentRepository.findAll();
        List<GlobalResource> globals = globalResourceRepository.findAll();
        long docBytes = 0L;
        for (LessonDocument d : docs) {
            docBytes += (d.getFileSizeBytes() != null && d.getFileSizeBytes() > 0)
                    ? d.getFileSizeBytes()
                    : EST_FALLBACK_DOC_BYTES;
        }
        for (GlobalResource gr : globals) {
            docBytes += (gr.getSizeBytes() != null && gr.getSizeBytes() > 0)
                    ? gr.getSizeBytes()
                    : EST_FALLBACK_DOC_BYTES;
        }

        long avatarCount = userRepository.findAll().stream()
                .filter(u -> u.getAvatarUrl() != null && !u.getAvatarUrl().isBlank())
                .count();
        long avatarBytes = avatarCount * EST_AVATAR_BYTES;

        List<R2BucketSnapshot.R2PrefixStat> stats = List.of(
                R2BucketSnapshot.R2PrefixStat.builder()
                        .categoryKey("videos")
                        .categoryLabel("Video bài giảng & HLS (Ước tính DB)")
                        .prefix("videos/ | hls/")
                        .objectCount(videos.size())
                        .totalBytes(videoBytes)
                        .build(),
                R2BucketSnapshot.R2PrefixStat.builder()
                        .categoryKey("speaking")
                        .categoryLabel("Audio Speaking học viên (Ước tính DB)")
                        .prefix("speaking/")
                        .objectCount(speakingCount)
                        .totalBytes(speakingBytes)
                        .build(),
                R2BucketSnapshot.R2PrefixStat.builder()
                        .categoryKey("audio")
                        .categoryLabel("Audio bài nghe & TTS (Ước tính DB)")
                        .prefix("audio/")
                        .objectCount(ttsTotalCount)
                        .totalBytes(ttsBytes)
                        .build(),
                R2BucketSnapshot.R2PrefixStat.builder()
                        .categoryKey("documents")
                        .categoryLabel("Tài liệu & Kho học liệu (Ước tính DB)")
                        .prefix("documents/")
                        .objectCount((long) docs.size() + globals.size())
                        .totalBytes(docBytes)
                        .build(),
                R2BucketSnapshot.R2PrefixStat.builder()
                        .categoryKey("avatars")
                        .categoryLabel("Ảnh đại diện người dùng (Ước tính DB)")
                        .prefix("avatars/")
                        .objectCount(avatarCount)
                        .totalBytes(avatarBytes)
                        .build()
        );

        long totalObj = videos.size() + speakingCount + ttsTotalCount + docs.size() + globals.size() + avatarCount;
        long totalBytes = videoBytes + speakingBytes + ttsBytes + docBytes + avatarBytes;

        List<R2BucketSnapshot.R2ObjectItem> topVideos = videos.stream()
                .sorted(Comparator.comparingLong((Video v) -> v.getSizeBytes() != null ? v.getSizeBytes() : EST_FALLBACK_VIDEO_BYTES).reversed())
                .limit(5)
                .map(v -> R2BucketSnapshot.R2ObjectItem.builder()
                        .key(v.getOriginalFileName() != null ? v.getOriginalFileName() : "video-" + v.getId())
                        .category("Video bài giảng")
                        .sizeBytes(v.getSizeBytes() != null && v.getSizeBytes() > 0 ? v.getSizeBytes() : EST_FALLBACK_VIDEO_BYTES)
                        .lastModified(v.getCreatedAt())
                        .build())
                .toList();

        return new DbMediaEstimate(totalObj, totalBytes, stats, topVideos);
    }

    private List<UUID> extractLessonIds(UUID classroomId) {
        return lessonRepository.findByClassroomIdOrderByOrderIndexAsc(classroomId).stream()
                .map(Lesson::getId)
                .toList();
    }

    private List<UUID> extractDailyPlanIds(UUID classroomId) {
        return dailyStudyPlanRepository.findByClassroomId(classroomId).stream()
                .map(DailyStudyPlan::getId)
                .toList();
    }

    private List<UUID> collectAllAssignmentIdsForClass(UUID classroomId, List<UUID> lessonIds) {
        Set<UUID> ids = new LinkedHashSet<>();
        assignmentRepository.findByClassroomId(classroomId).forEach(a -> ids.add(a.getId()));
        if (!lessonIds.isEmpty()) {
            assignmentRepository.findByLessonIdIn(lessonIds).forEach(a -> ids.add(a.getId()));
        }
        return new ArrayList<>(ids);
    }

    private String extractHlsPrefix(String hlsPlaylistUrl) {
        int idx = hlsPlaylistUrl.indexOf("hls/");
        if (idx < 0) {
            return null;
        }
        int lastSlash = hlsPlaylistUrl.lastIndexOf('/');
        if (lastSlash <= idx) {
            return null;
        }
        return hlsPlaylistUrl.substring(idx, lastSlash + 1);
    }

    private String classifyScore(double averageScore, long totalAttempts) {
        if (totalAttempts == 0 || averageScore <= 0) {
            return "Chưa có điểm";
        }
        if (averageScore >= 8.5) {
            return "Xuất sắc";
        }
        if (averageScore >= 7.5) {
            return "Giỏi";
        }
        if (averageScore >= 6.0) {
            return "Khá";
        }
        if (averageScore >= 5.0) {
            return "Trung bình";
        }
        return "Cần cố gắng";
    }

    private double roundUsd(double val) {
        return Math.round(val * 10000.0) / 10000.0;
    }

    private void flushAndClear() {
        if (entityManager != null) {
            entityManager.flush();
            entityManager.clear();
        }
    }

    private void recordSafeAudit(UUID userId, String action, String entityName, String entityId, String ip, String meta) {
        try {
            auditLogService.recordAuditLog(userId, action, entityName, entityId, ip, meta);
        } catch (Exception ex) {
            log.warn("[AUDIT] Không thể ghi nhật ký {} cho {}:{}: {}", action, entityName, entityId, ex.getMessage());
        }
    }

    private static class PurgeStats {
        long deletedAiEvals = 0;
        long deletedAnswers = 0;
        long deletedAttempts = 0;
        long deletedDailyProgress = 0;
        long deletedVideoWatch = 0;
        long deletedVocabProgress = 0;
        long deletedR2Files = 0;
    }

    private record DbMediaEstimate(
            long totalObjects,
            long totalBytes,
            List<R2BucketSnapshot.R2PrefixStat> prefixStats,
            List<R2BucketSnapshot.R2ObjectItem> largestObjects) {
    }
}
