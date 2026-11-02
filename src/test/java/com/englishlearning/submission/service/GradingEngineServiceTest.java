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

    @Test
    @DisplayName("should_GradeMatchingQuestionsCorrectly_when_TextAnswerOrOptionOrQuestionIdMatches: Chấm điểm bài tập nối từ vựng (MATCHING) chính xác")
    void should_GradeMatchingQuestionsCorrectly_when_TextAnswerOrOptionOrQuestionIdMatches() {
        // Given
        UUID qMatch1Id = UUID.randomUUID();
        UUID qMatch2Id = UUID.randomUUID();
        UUID qMatch3Id = UUID.randomUUID();
        UUID qMatch4Id = UUID.randomUUID();

        UUID optCorrectId = UUID.randomUUID();
        UUID optWrongId = UUID.randomUUID();

        // Q1: Matching dạng Excel (không có QuestionOption), đúng qua textAnswer
        AssignmentQuestion q1 = AssignmentQuestion.builder()
                .id(qMatch1Id)
                .questionType(QuestionType.MATCHING)
                .promptText("Resilient")
                .correctAnswer("Kien cuong, phuc hoi nhanh")
                .points(2.0)
                .options(List.of())
                .build();

        // Q2: Matching đúng qua selectedOptionId == q.getId() (tự quy chiếu câu hỏi)
        AssignmentQuestion q2 = AssignmentQuestion.builder()
                .id(qMatch2Id)
                .questionType(QuestionType.MATCHING)
                .promptText("Persistent")
                .correctAnswer("Kien tri, ben bi")
                .points(2.0)
                .options(List.of())
                .build();

        // Q3: Matching có options và chọn đúng optionId
        AssignmentQuestion q3 = AssignmentQuestion.builder()
                .id(qMatch3Id)
                .questionType(QuestionType.MATCHING)
                .promptText("Versatile")
                .correctAnswer("Da nang, linh hoat")
                .points(2.0)
                .options(List.of(
                        QuestionOption.builder().id(optCorrectId).optionText("Da nang, linh hoat").isCorrect(true).build(),
                        QuestionOption.builder().id(optWrongId).optionText("Bao thu").isCorrect(false).build()
                ))
                .build();

        // Q4: Matching làm sai
        AssignmentQuestion q4 = AssignmentQuestion.builder()
                .id(qMatch4Id)
                .questionType(QuestionType.MATCHING)
                .promptText("Stubborn")
                .correctAnswer("Uong nganh, buong binh")
                .points(2.0)
                .options(List.of())
                .build();

        List<AssignmentQuestion> questions = List.of(q1, q2, q3, q4);

        List<SubmissionRequest.AnswerDto> answers = List.of(
                // Q1: Gửi textAnswer chuẩn (kèm khoảng trắng), selectedOptionId có thể là ID ngẫu nhiên nhưng vẫn chấm đúng
                SubmissionRequest.AnswerDto.builder().questionId(qMatch1Id).textAnswer("  kien cuong, phuc hoi nhanh  ").build(),
                // Q2: Gửi selectedOptionId bằng đúng ID câu hỏi
                SubmissionRequest.AnswerDto.builder().questionId(qMatch2Id).selectedOptionId(qMatch2Id).build(),
                // Q3: Gửi selectedOptionId khớp optCorrectId
                SubmissionRequest.AnswerDto.builder().questionId(qMatch3Id).selectedOptionId(optCorrectId).build(),
                // Q4: Làm sai nghĩa
                SubmissionRequest.AnswerDto.builder().questionId(qMatch4Id).textAnswer("Sai hoan toan").build()
        );

        // When
        GradingResult result = gradingEngineService.evaluateSubmission(questions, answers);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getTotalScore()).isEqualTo(6.0); // 2 + 2 + 2 = 6.0
        assertThat(result.getMaxPossibleScore()).isEqualTo(8.0);
        assertThat(result.getScaledScore()).isEqualTo(7.5); // (6/8)*10 = 7.5

        assertThat(result.getCorrectnessPerQuestion().get(qMatch1Id)).isTrue();
        assertThat(result.getCorrectnessPerQuestion().get(qMatch2Id)).isTrue();
        assertThat(result.getCorrectnessPerQuestion().get(qMatch3Id)).isTrue();
        assertThat(result.getCorrectnessPerQuestion().get(qMatch4Id)).isFalse();
    }

    @Test
    @DisplayName("should_GradeAllMatchingQuestions100Percent_when_EachQuestionHasBothSelectedOptionIdAndTextAnswer: Cham 10.0 pts (100 percent) khi hoc sinh noi dung 5/5 cap tu - nghia")
    void should_GradeAllMatchingQuestions100Percent_when_EachQuestionHasBothSelectedOptionIdAndTextAnswer() {
        // Given: 5 cau hoi MATCHING nhu thuc te
        UUID q1 = UUID.randomUUID();
        UUID q2 = UUID.randomUUID();
        UUID q3 = UUID.randomUUID();
        UUID q4 = UUID.randomUUID();
        UUID q5 = UUID.randomUUID();

        List<AssignmentQuestion> questions = List.of(
                AssignmentQuestion.builder().id(q1).promptText("mother /mʌðər/").correctAnswer("Female parent").questionType(QuestionType.MATCHING).points(1.0).options(List.of()).build(),
                AssignmentQuestion.builder().id(q2).promptText("father /fɑːðər/").correctAnswer("Male parent").questionType(QuestionType.MATCHING).points(1.0).options(List.of()).build(),
                AssignmentQuestion.builder().id(q3).promptText("bed /bed/").correctAnswer("Furniture for sleeping").questionType(QuestionType.MATCHING).points(1.0).options(List.of()).build(),
                AssignmentQuestion.builder().id(q4).promptText("kitchen /ˈkɪtʃɪn/").correctAnswer("Room where food is prepared").questionType(QuestionType.MATCHING).points(1.0).options(List.of()).build(),
                AssignmentQuestion.builder().id(q5).promptText("breakfast /ˈbrekfəst/").correctAnswer("First meal of the day").questionType(QuestionType.MATCHING).points(1.0).options(List.of()).build()
        );

        // Hoc sinh gui selectedOptionId kem textAnswer / answerText
        List<SubmissionRequest.AnswerDto> answers = List.of(
                SubmissionRequest.AnswerDto.builder().questionId(q1).selectedOptionId(UUID.randomUUID()).textAnswer("Female parent").build(),
                SubmissionRequest.AnswerDto.builder().questionId(q2).selectedOptionId(q2).textAnswer("Male parent").build(),
                SubmissionRequest.AnswerDto.builder().questionId(q3).selectedOptionId(UUID.randomUUID()).answerText("Furniture for sleeping").build(),
                SubmissionRequest.AnswerDto.builder().questionId(q4).selectedOptionId(UUID.randomUUID()).textAnswer("Room where food is prepared").build(),
                SubmissionRequest.AnswerDto.builder().questionId(q5).selectedOptionId(UUID.randomUUID()).textAnswer("First meal of the day").build()
        );

        // When
        GradingResult result = gradingEngineService.evaluateSubmission(questions, answers);

        // Then: Phai dat tron ven 5.0 / 5.0 (Quy doi thang 10: 10.0 pts)
        assertThat(result.getTotalScore()).isEqualTo(5.0);
        assertThat(result.getMaxPossibleScore()).isEqualTo(5.0);
        assertThat(result.getScaledScore()).isEqualTo(10.0);
        assertThat(result.getCorrectnessPerQuestion().values()).allMatch(Boolean::booleanValue);
    }

}
