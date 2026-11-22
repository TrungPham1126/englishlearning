package com.englishlearning.analytics.service.impl;

import com.englishlearning.ai.entity.AiEvaluation;
import com.englishlearning.ai.entity.AiEvaluationType;
import com.englishlearning.ai.repository.AiEvaluationRepository;
import com.englishlearning.analytics.entity.StudentSkillProfile;
import com.englishlearning.analytics.repository.StudentSkillProfileRepository;
import com.englishlearning.assignment.entity.Assignment;
import com.englishlearning.assignment.entity.SkillType;
import com.englishlearning.auth.entity.Student;
import com.englishlearning.curriculum.repository.StudentVocabularyProgressRepository;
import com.englishlearning.submission.entity.AssignmentAttempt;
import com.englishlearning.submission.entity.AttemptStatus;
import com.englishlearning.submission.repository.AssignmentAttemptRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceImplTest {

    @Mock
    private StudentSkillProfileRepository profileRepository;

    @Mock
    private AssignmentAttemptRepository assignmentAttemptRepository;

    @Mock
    private AiEvaluationRepository aiEvaluationRepository;

    @Mock
    private StudentVocabularyProgressRepository studentVocabularyProgressRepository;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private AnalyticsServiceImpl analyticsService;

    private UUID studentId;
    private StudentSkillProfile profile;

    @BeforeEach
    void setUp() {
        studentId = UUID.randomUUID();
        profile = StudentSkillProfile.builder()
                .id(studentId)
                .listeningScore(0.0)
                .speakingScore(0.0)
                .readingScore(0.0)
                .writingScore(0.0)
                .grammarScore(0.0)
                .vocabularyScore(0.0)
                .pronunciationScore(0.0)
                .fluencyScore(0.0)
                .build();
    }

    @Test
    @DisplayName("getMyProfile tính toán chính xác điểm kỹ năng từ lịch sử làm bài thật (thang 0-100)")
    void getMyProfile_calculatesRealScores() {
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(profile));
        when(profileRepository.save(any(StudentSkillProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // 1. Mock AssignmentAttempt (thang 10: 8.5 -> 85.0%, 7.0 -> 70.0%)
        Assignment listeningAssignment = Assignment.builder().skillType(SkillType.LISTENING).build();
        AssignmentAttempt listeningAttempt = AssignmentAttempt.builder()
                .assignment(listeningAssignment)
                .totalScore(8.5)
                .status(AttemptStatus.COMPLETED)
                .build();

        Assignment readingAssignment = Assignment.builder().skillType(SkillType.READING).build();
        AssignmentAttempt readingAttempt = AssignmentAttempt.builder()
                .assignment(readingAssignment)
                .totalScore(7.0)
                .status(AttemptStatus.COMPLETED)
                .build();

        when(assignmentAttemptRepository.findCompletedAttemptsByStudentId(studentId))
                .thenReturn(List.of(listeningAttempt, readingAttempt));

        // 2. Mock AiEvaluation (thang 10: pronunciation=8.0 -> 80.0, fluency=7.5 -> 75.0, overallScore=8.2 -> 82.0)
        AiEvaluation aiEvalSpeaking = AiEvaluation.builder()
                .evalType(AiEvaluationType.SPEAKING)
                .pronunciationScore(8.0)
                .fluencyScore(7.5)
                .overallScore(8.2)
                .build();

        when(aiEvaluationRepository.findByStudentId(studentId))
                .thenReturn(List.of(aiEvalSpeaking));

        // 3. Mock StudentVocabularyProgress: 10 từ, 8 từ đã thuộc (mastered) -> 80%
        when(studentVocabularyProgressRepository.countByStudentId(studentId)).thenReturn(10L);
        when(studentVocabularyProgressRepository.countMasteredByStudentId(studentId)).thenReturn(8L);

        // Execute
        StudentSkillProfile result = analyticsService.getMyProfile(studentId);

        // Verify
        assertThat(result).isNotNull();
        assertThat(result.getListeningScore()).isEqualTo(85.0);
        assertThat(result.getReadingScore()).isEqualTo(70.0);
        assertThat(result.getPronunciationScore()).isEqualTo(80.0);
        assertThat(result.getFluencyScore()).isEqualTo(75.0);
        assertThat(result.getSpeakingScore()).isEqualTo(82.0);
        assertThat(result.getVocabularyScore()).isEqualTo(80.0);
        assertThat(result.getAiRecommendedPath()).isNotBlank();
    }

    @Test
    @DisplayName("getMyProfile tạo hồ sơ mới khi chưa có và làm mới lộ trình khởi động khi đã có điểm thực tế")
    void getMyProfile_createsNewProfileAndRefreshesStarterPath() {
        UUID newStudentId = UUID.randomUUID();
        Student student = Student.builder().id(newStudentId).build();
        when(profileRepository.findById(newStudentId)).thenReturn(Optional.empty());
        when(entityManager.getReference(Student.class, newStudentId)).thenReturn(student);
        when(assignmentAttemptRepository.findCompletedAttemptsByStudentId(newStudentId)).thenReturn(List.of());
        when(aiEvaluationRepository.findByStudentId(newStudentId)).thenReturn(List.of());
        when(studentVocabularyProgressRepository.countByStudentId(newStudentId)).thenReturn(0L);
        when(studentVocabularyProgressRepository.countMasteredByStudentId(newStudentId)).thenReturn(0L);
        when(profileRepository.save(any(StudentSkillProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        StudentSkillProfile created = analyticsService.getMyProfile(newStudentId);
        assertThat(created.getAiRecommendedPath()).contains("giai đoạn khởi động");

        // Khi profile cũ mang thông điệp giai đoạn khởi động nhưng nay đã có điểm thực tế -> phải refresh lộ trình
        StudentSkillProfile starterProfile = StudentSkillProfile.builder()
                .id(studentId)
                .aiRecommendedPath("Hồ sơ năng lực đang ở giai đoạn khởi động...")
                .build();
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(starterProfile));
        when(assignmentAttemptRepository.findCompletedAttemptsByStudentId(studentId)).thenReturn(List.of(
                AssignmentAttempt.builder().assignment(Assignment.builder().skillType(SkillType.GRAMMAR).build()).totalScore(8.5).build()
        ));
        when(aiEvaluationRepository.findByStudentId(studentId)).thenReturn(List.of());
        when(studentVocabularyProgressRepository.countByStudentId(studentId)).thenReturn(0L);
        when(studentVocabularyProgressRepository.countMasteredByStudentId(studentId)).thenReturn(0L);

        StudentSkillProfile refreshed = analyticsService.getMyProfile(studentId);
        assertThat(refreshed.getGrammarScore()).isEqualTo(85.0);
        assertThat(refreshed.getAiRecommendedPath()).doesNotContain("giai đoạn khởi động");
        assertThat(analyticsService.getStudentAnalytics((Long) null)).isNull();
        assertThat(analyticsService.getStudentAnalytics(studentId)).isEqualTo(refreshed);
    }

    @Test
    @DisplayName("updateSkillScore cộng dồn an toàn cả khi điểm ban đầu null, chặn trần 100 và bỏ qua skillType lạ")
    void updateSkillScore_handlesAllSixSkillsAndNullSafety() {
        StudentSkillProfile nullableProfile = StudentSkillProfile.builder()
                .id(studentId)
                .aiRecommendedPath("existing")
                .build(); // các field điểm đều null ban đầu
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(nullableProfile));
        when(assignmentAttemptRepository.findCompletedAttemptsByStudentId(studentId)).thenReturn(List.of());
        when(aiEvaluationRepository.findByStudentId(studentId)).thenReturn(List.of());
        when(studentVocabularyProgressRepository.countByStudentId(studentId)).thenReturn(0L);
        when(studentVocabularyProgressRepository.countMasteredByStudentId(studentId)).thenReturn(0L);
        when(profileRepository.save(any(StudentSkillProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        analyticsService.updateSkillScore(studentId, "listening", 15.0);
        analyticsService.updateSkillScore(studentId, "SPEAKING", 95.0);
        analyticsService.updateSkillScore(studentId, "SPEAKING", 20.0); // cap at 100.0
        analyticsService.updateSkillScore(studentId, "READING", 40.0);
        analyticsService.updateSkillScore(studentId, "WRITING", 50.0);
        analyticsService.updateSkillScore(studentId, "GRAMMAR", 60.0);
        analyticsService.updateSkillScore(studentId, "VOCABULARY", 70.0);

        assertThat(nullableProfile.getListeningScore()).isEqualTo(15.0);
        assertThat(nullableProfile.getSpeakingScore()).isEqualTo(100.0);
        assertThat(nullableProfile.getReadingScore()).isEqualTo(40.0);
        assertThat(nullableProfile.getWritingScore()).isEqualTo(50.0);
        assertThat(nullableProfile.getGrammarScore()).isEqualTo(60.0);
        assertThat(nullableProfile.getVocabularyScore()).isEqualTo(70.0);

        // Blank hoặc skillType không hợp lệ
        clearInvocations(profileRepository);
        analyticsService.updateSkillScore(studentId, "   ", 10.0);
        verifyNoInteractions(profileRepository);
        analyticsService.updateSkillScore(studentId, "UNKNOWN_SKILL", 10.0);
    }

    @Test
    @DisplayName("generateRecommendedPath phân nhánh chính xác: khởi động, lệch năng lực (100 & 10) và cân bằng")
    void generateRecommendedPath_coversStarterDisparityAndBalancedBranches() {
        StudentSkillProfile starter = StudentSkillProfile.builder().build();
        assertThat(analyticsService.generateRecommendedPath(starter)).contains("giai đoạn khởi động");

        StudentSkillProfile unbalanced100 = StudentSkillProfile.builder()
                .speakingScore(85.0).listeningScore(20.0).vocabularyScore(15.0)
                .readingScore(50.0).writingScore(50.0).grammarScore(50.0)
                .build();
        assertThat(analyticsService.generateRecommendedPath(unbalanced100)).contains("mất cân đối lớn");

        StudentSkillProfile balanced = StudentSkillProfile.builder()
                .listeningScore(72.0).speakingScore(68.0).readingScore(70.0)
                .writingScore(65.0).grammarScore(75.0).vocabularyScore(60.0)
                .build();
        assertThat(analyticsService.generateRecommendedPath(balanced))
                .contains("phát triển tốt")
                .contains("Từ vựng (Vocabulary)");

        // Nhánh thang 10 có độ lệch lớn (strongest <= 10.0, >= 7.0 và weakest <= 4.0) & null safety
        StudentSkillProfile unbalanced10 = StudentSkillProfile.builder()
                .readingScore(8.5).speakingScore(3.0).listeningScore(3.5)
                .writingScore(6.0).grammarScore(6.5).vocabularyScore(5.5)
                .build();
        assertThat(analyticsService.generateRecommendedPath(unbalanced10)).contains("mất cân đối lớn");
        assertThat(analyticsService.generateRecommendedPath(null)).contains("giai đoạn khởi động");
    }

    @Test
    @DisplayName("Đồng bộ Speaking/Writing khi không có AI eval, trộn 50/50 Vocabulary, cập nhật Pronunciation/Fluency và tra cứu theo Long userId")
    void syncRealSkillScores_blendsVocabAndAiWithAttemptsAndHandlesLongUserId() {
        when(profileRepository.findById(any(UUID.class))).thenReturn(Optional.of(profile));
        when(profileRepository.save(any(StudentSkillProfile.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. Khi chưa có AiEvaluation nhưng có bài tập Speaking (7.5 -> 75), Writing (6.0 -> 60), Vocabulary (9.0 -> 90)
        Assignment speakingAss = Assignment.builder().skillType(SkillType.SPEAKING).build();
        Assignment writingAss = Assignment.builder().skillType(SkillType.WRITING).build();
        Assignment vocabAss = Assignment.builder().skillType(SkillType.VOCABULARY).build();
        when(assignmentAttemptRepository.findCompletedAttemptsByStudentId(any(UUID.class))).thenReturn(List.of(
                AssignmentAttempt.builder().assignment(speakingAss).totalScore(7.5).build(),
                AssignmentAttempt.builder().assignment(writingAss).totalScore(6.0).build(),
                AssignmentAttempt.builder().assignment(vocabAss).totalScore(9.0).build()
        ));
        when(aiEvaluationRepository.findByStudentId(any(UUID.class))).thenReturn(List.of());
        // totalVocab = 10, mastered = 6 -> 60%. Kết hợp 50% với bài tập Vocab 90% -> 75.0
        when(studentVocabularyProgressRepository.countByStudentId(any(UUID.class))).thenReturn(10L);
        when(studentVocabularyProgressRepository.countMasteredByStudentId(any(UUID.class))).thenReturn(6L);

        StudentSkillProfile res1 = analyticsService.getStudentAnalytics(42L);
        assertThat(res1.getSpeakingScore()).isEqualTo(75.0);
        assertThat(res1.getWritingScore()).isEqualTo(60.0);
        assertThat(res1.getVocabularyScore()).isEqualTo(75.0);

        // 2. Khi totalVocab = 0 (chỉ có điểm bài tập Vocab 90%) và có cả AI Writing (8.0 -> 80) + bài tập Writing (6.0 -> 60) -> TB = 70.0
        when(studentVocabularyProgressRepository.countByStudentId(studentId)).thenReturn(0L);
        when(studentVocabularyProgressRepository.countMasteredByStudentId(studentId)).thenReturn(0L);
        when(aiEvaluationRepository.findByStudentId(studentId)).thenReturn(List.of(
                AiEvaluation.builder().evalType(AiEvaluationType.WRITING).overallScore(8.0).build()
        ));

        StudentSkillProfile res2 = analyticsService.getMyProfile(studentId);
        assertThat(res2.getWritingScore()).isEqualTo(70.0);
        assertThat(res2.getVocabularyScore()).isEqualTo(90.0);

        // 3. updateSkillScore hỗ trợ PRONUNCIATION, FLUENCY (có khoảng trắng) và chặn sàn 0.0
        analyticsService.updateSkillScore(studentId, " pronunciation ", 45.0);
        analyticsService.updateSkillScore(studentId, "fluency", 55.0);
        analyticsService.updateSkillScore(studentId, "PRONUNCIATION", -100.0);
        assertThat(profile.getPronunciationScore()).isEqualTo(0.0);
        assertThat(profile.getFluencyScore()).isEqualTo(55.0);
    }
}
