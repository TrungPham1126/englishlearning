package com.englishlearning.submission.service;

import com.englishlearning.assignment.entity.AssignmentQuestion;
import com.englishlearning.assignment.entity.QuestionOption;
import com.englishlearning.assignment.entity.QuestionType;
import com.englishlearning.submission.dto.GradingResult;
import com.englishlearning.submission.dto.SubmissionRequest;
import com.englishlearning.submission.service.impl.GradingEngineServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit Test cho GradingEngineService (UC_STU_01: CBT Auto-Grading Engine)
 * Tuân thủ JUnit 5, AssertJ, no-logic-in-tests, cleanly-create-test-data.
 */
class GradingEngineServiceTest {

    private GradingEngineServiceImpl gradingEngineService;

    @BeforeEach
    void setUp() {
        gradingEngineService = new GradingEngineServiceImpl();
    }

    @Test
    @DisplayName("should_CalculateExactScore_when_SubmittingCbtMultipleChoiceAndFillInBlank: Tính điểm chính xác cho cả trắc nghiệm và điền từ")
    void should_CalculateExactScore_when_SubmittingCbtMultipleChoiceAndFillInBlank() {
        // Given
        UUID q1Id = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID q2Id = UUID.fromString("22222222-2222-2222-2222-222222222222");
        UUID q3Id = UUID.fromString("33333333-3333-3333-3333-333333333333");
        UUID q4Id = UUID.fromString("44444444-4444-4444-4444-444444444444");

        UUID opt1CorrectId = UUID.randomUUID();
        UUID opt1WrongId = UUID.randomUUID();

        // Q1: Multiple choice (2.0 điểm) - Chọn đúng
        AssignmentQuestion q1 = AssignmentQuestion.builder()
                .id(q1Id)
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .points(2.0)
                .options(List.of(
                        QuestionOption.builder().id(opt1CorrectId).isCorrect(true).build(),
                        QuestionOption.builder().id(opt1WrongId).isCorrect(false).build()
                ))
                .build();

        // Q2: Multiple choice (2.0 điểm) - Chọn sai
        UUID opt2CorrectId = UUID.randomUUID();
        UUID opt2WrongId = UUID.randomUUID();
        AssignmentQuestion q2 = AssignmentQuestion.builder()
                .id(q2Id)
                .questionType(QuestionType.MULTIPLE_CHOICE)
                .points(2.0)
                .options(List.of(
                        QuestionOption.builder().id(opt2CorrectId).isCorrect(true).build(),
                        QuestionOption.builder().id(opt2WrongId).isCorrect(false).build()
                ))
                .build();

        // Q3: Fill in blank (2.0 điểm) - Điền đúng (trim & không phân biệt hoa thường)
        AssignmentQuestion q3 = AssignmentQuestion.builder()
                .id(q3Id)
                .questionType(QuestionType.FILL_IN_BLANK)
                .points(2.0)
                .correctAnswer("Sustainable")
                .build();

        // Q4: Fill in blank (2.0 điểm) - Điền sai
        AssignmentQuestion q4 = AssignmentQuestion.builder()
                .id(q4Id)
                .questionType(QuestionType.FILL_IN_BLANK)
                .points(2.0)
                .correctAnswer("Pollution")
                .build();

        List<AssignmentQuestion> questions = List.of(q1, q2, q3, q4);

        // Học sinh trả lời:
        // Q1: Chọn opt1CorrectId (Đúng -> +2.0)
        // Q2: Chọn opt2WrongId (Sai -> +0.0)
        // Q3: Điền "  sustainable  " (Đúng -> +2.0)
        // Q4: Điền "Traffic" (Sai -> +0.0)
        List<SubmissionRequest.AnswerDto> answers = List.of(
                SubmissionRequest.AnswerDto.builder().questionId(q1Id).selectedOptionId(opt1CorrectId).build(),
                SubmissionRequest.AnswerDto.builder().questionId(q2Id).selectedOptionId(opt2WrongId).build(),
                SubmissionRequest.AnswerDto.builder().questionId(q3Id).textAnswer("  sustainable  ").build(),
                SubmissionRequest.AnswerDto.builder().questionId(q4Id).textAnswer("Traffic").build()
        );

        // When
        GradingResult result = gradingEngineService.evaluateSubmission(questions, answers);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getTotalScore()).isEqualTo(4.0); // 2.0 + 2.0 = 4.0
        assertThat(result.getMaxPossibleScore()).isEqualTo(8.0); // 4 câu * 2.0 = 8.0
        assertThat(result.getScaledScore()).isEqualTo(5.0); // (4.0 / 8.0) * 10.0 = 5.0
        assertThat(result.isRequiresAiGrading()).isFalse();

        assertThat(result.getEarnedPointsPerQuestion().get(q1Id)).isEqualTo(2.0);
        assertThat(result.getCorrectnessPerQuestion().get(q1Id)).isTrue();

        assertThat(result.getEarnedPointsPerQuestion().get(q2Id)).isEqualTo(0.0);
        assertThat(result.getCorrectnessPerQuestion().get(q2Id)).isFalse();

        assertThat(result.getEarnedPointsPerQuestion().get(q3Id)).isEqualTo(2.0);
        assertThat(result.getCorrectnessPerQuestion().get(q3Id)).isTrue();

        assertThat(result.getEarnedPointsPerQuestion().get(q4Id)).isEqualTo(0.0);
        assertThat(result.getCorrectnessPerQuestion().get(q4Id)).isFalse();
    }

    @Test
    @DisplayName("should_IdentifySubjectiveQuestionsRequiringAiGrading_when_AudioOrEssayPresent: Nhận diện câu hỏi tự luận cần AI chấm")
    void should_IdentifySubjectiveQuestionsRequiringAiGrading_when_AudioOrEssayPresent() {
        // Given
        UUID essayId = UUID.randomUUID();
        AssignmentQuestion essayQ = AssignmentQuestion.builder()
                .id(essayId)
                .questionType(QuestionType.ESSAY)
                .points(10.0)
                .build();

        // When
        GradingResult result = gradingEngineService.evaluateSubmission(List.of(essayQ), List.of());

        // Then
        assertThat(result.isRequiresAiGrading()).isTrue();
        assertThat(result.getAiGradedQuestionIds()).containsExactly(essayId);
    }
}
