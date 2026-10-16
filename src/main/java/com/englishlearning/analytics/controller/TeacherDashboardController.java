package com.englishlearning.analytics.controller;

import com.englishlearning.analytics.dto.TeacherDashboardResponse;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.dto.ApiResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/teacher/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class TeacherDashboardController {

    private final EntityManager entityManager;

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<TeacherDashboardResponse>> getStats(
            @AuthenticationPrincipal CustomUserDetails user) {
        UUID teacherId = user.getId();

        // 1. Tổng số lớp học
        Long totalClasses = (Long) entityManager
                .createQuery("SELECT COUNT(c) FROM Classroom c WHERE c.teacher.id = :tId")
                .setParameter("tId", teacherId)
                .getSingleResult();

        // 2. Tổng học viên
        Long totalStudents = (Long) entityManager.createQuery(
                "SELECT COUNT(cs) FROM ClassStudent cs WHERE cs.classroom.teacher.id = :tId AND cs.isActive = true")
                .setParameter("tId", teacherId)
                .getSingleResult();

        // 3. Số bài đang chờ chấm
        Long pendingGrading = (Long) entityManager.createQuery(
                "SELECT COUNT(a) FROM AssignmentAttempt a WHERE a.assignment.classroom.teacher.id = :tId AND a.status = :status")
                .setParameter("tId", teacherId)
                .setParameter("status", com.englishlearning.submission.entity.AttemptStatus.SUBMITTED)
                .getSingleResult();

        // 4. Lấy danh sách việc cần làm (Bài nộp mới nhất)
        List<Object[]> pendingAttempts = entityManager.createQuery(
                "SELECT a.id, a.assignment.title, a.assignment.classroom.name, a.submittedAt " +
                        "FROM AssignmentAttempt a WHERE a.assignment.classroom.teacher.id = :tId AND a.status = :status ORDER BY a.submittedAt ASC",
                Object[].class)
                .setParameter("tId", teacherId)
                .setParameter("status", com.englishlearning.submission.entity.AttemptStatus.SUBMITTED)
                .setMaxResults(3)
                .getResultList();

        List<TeacherDashboardResponse.PendingTask> tasks = new ArrayList<>();
        for (Object[] row : pendingAttempts) {
            tasks.add(TeacherDashboardResponse.PendingTask.builder()
                    .id(row[0].toString())
                    .title("Chấm bài: " + row[1].toString())
                    .className(row[2].toString())
                    .due("Chờ chấm")
                    .type("GRADING")
                    .build());
        }

        if (tasks.isEmpty()) {
            tasks.add(TeacherDashboardResponse.PendingTask.builder()
                    .id("default-1")
                    .title("Khởi tạo bộ đề trắc nghiệm bằng AI")
                    .className("AI Quiz Lab")
                    .due("Gợi ý")
                    .type("AI_REVIEW")
                    .build());
        }

        // 5. Thống kê tỷ lệ hoàn thành thực tế từ dữ liệu bài nộp
        Double avgCompletionRate = 0.0;
        try {
            Long totalAttempts = (Long) entityManager.createQuery(
                    "SELECT COUNT(a) FROM AssignmentAttempt a WHERE a.assignment.classroom.teacher.id = :tId")
                    .setParameter("tId", teacherId)
                    .getSingleResult();
            Long totalGradedAttempts = (Long) entityManager.createQuery(
                    "SELECT COUNT(a) FROM AssignmentAttempt a WHERE a.assignment.classroom.teacher.id = :tId AND a.status = :status")
                    .setParameter("tId", teacherId)
                    .setParameter("status", com.englishlearning.submission.entity.AttemptStatus.COMPLETED)
                    .getSingleResult();
            if (totalAttempts != null && totalAttempts > 0) {
                avgCompletionRate = Math.round(((double) totalGradedAttempts / totalAttempts * 100.0) * 10.0) / 10.0;
            }
        } catch (Exception ignored) {
        }

        // 6. Thống kê điểm kỹ năng thực tế của học sinh trong các lớp của giáo viên
        List<TeacherDashboardResponse.SkillAnalysis> skills = new ArrayList<>();
        try {
            Object[] skillAverages = (Object[]) entityManager.createQuery(
                    "SELECT COALESCE(AVG(p.listeningScore), 0.0), COALESCE(AVG(p.readingScore), 0.0), " +
                    "COALESCE(AVG(p.writingScore), 0.0), COALESCE(AVG(p.speakingScore), 0.0) " +
                    "FROM StudentSkillProfile p WHERE p.student.id IN " +
                    "(SELECT cs.student.id FROM ClassStudent cs WHERE cs.classroom.teacher.id = :tId AND cs.isActive = true)")
                    .setParameter("tId", teacherId)
                    .getSingleResult();

            double listening = Math.round(((Number) skillAverages[0]).doubleValue() * 10.0) / 10.0;
            double reading = Math.round(((Number) skillAverages[1]).doubleValue() * 10.0) / 10.0;
            double writing = Math.round(((Number) skillAverages[2]).doubleValue() * 10.0) / 10.0;
            double speaking = Math.round(((Number) skillAverages[3]).doubleValue() * 10.0) / 10.0;

            double lScore = Math.min(10.0, listening);
            double rScore = Math.min(10.0, reading);
            double wScore = Math.min(10.0, writing);
            double sScore = Math.min(10.0, speaking);

            skills.add(TeacherDashboardResponse.SkillAnalysis.builder()
                    .skill("Listening (Nghe)")
                    .score(lScore)
                    .status(lScore >= 8 ? "Rất tốt" : lScore >= 6.5 ? "Tốt" : lScore >= 5 ? "Trung bình" : "Cần rèn luyện")
                    .barColor("bg-emerald-500").build());

            skills.add(TeacherDashboardResponse.SkillAnalysis.builder()
                    .skill("Reading (Đọc)")
                    .score(rScore)
                    .status(rScore >= 8 ? "Rất tốt" : rScore >= 6.5 ? "Khá" : rScore >= 5 ? "Trung bình" : "Cần rèn luyện")
                    .barColor("bg-blue-500").build());

            skills.add(TeacherDashboardResponse.SkillAnalysis.builder()
                    .skill("Writing (Viết)")
                    .score(wScore)
                    .status(wScore >= 8 ? "Rất tốt" : wScore >= 6.5 ? "Khá" : wScore >= 5 ? "Cần cải thiện" : "Điểm yếu")
                    .barColor("bg-amber-500").build());

            skills.add(TeacherDashboardResponse.SkillAnalysis.builder()
                    .skill("Speaking (Nói)")
                    .score(sScore)
                    .status(sScore >= 8 ? "Rất tốt" : sScore >= 6.5 ? "Khá" : sScore >= 5 ? "Cần cải thiện" : "Điểm yếu lớn")
                    .barColor("bg-rose-500").build());
        } catch (Exception e) {
            skills = List.of(
                    TeacherDashboardResponse.SkillAnalysis.builder().skill("Listening (Nghe)").score(0.0).status("Chưa có dữ liệu").barColor("bg-emerald-500").build(),
                    TeacherDashboardResponse.SkillAnalysis.builder().skill("Reading (Đọc)").score(0.0).status("Chưa có dữ liệu").barColor("bg-blue-500").build(),
                    TeacherDashboardResponse.SkillAnalysis.builder().skill("Writing (Viết)").score(0.0).status("Chưa có dữ liệu").barColor("bg-amber-500").build(),
                    TeacherDashboardResponse.SkillAnalysis.builder().skill("Speaking (Nói)").score(0.0).status("Chưa có dữ liệu").barColor("bg-rose-500").build());
        }

        TeacherDashboardResponse response = TeacherDashboardResponse.builder()
                .totalClasses(totalClasses != null ? totalClasses : 0)
                .totalStudents(totalStudents != null ? totalStudents : 0)
                .pendingGrading(pendingGrading != null ? pendingGrading : 0)
                .avgCompletionRate(avgCompletionRate)
                .skills(skills)
                .tasks(tasks)
                .build();

        return ResponseEntity.ok(ApiResponse.success(response));
    }
}