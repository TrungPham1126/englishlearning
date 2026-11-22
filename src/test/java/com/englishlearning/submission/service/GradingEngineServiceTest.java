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

    @Test
    @DisplayName("FILL_IN_BLANK: Hỗ trợ đa đáp án phân cách '/' hoặc '|', khoảng trắng thừa & Unicode NFC/NFD")
    void evaluateSubmission_fillInBlankMultiVariantWhitespaceAndUnicode() {
        UUID qSlash = UUID.randomUUID();
        UUID qPipe = UUID.randomUUID();
        UUID qUnicode = UUID.randomUUID();
        UUID qEmptyAns = UUID.randomUUID();

        // NFD decomposed "Việt Nam" in question, NFC composed in student answer
        String nfdVietnamese = java.text.Normalizer.normalize("Việt Nam", java.text.Normalizer.Form.NFD);

        List<AssignmentQuestion> questions = List.of(
                AssignmentQuestion.builder().id(qSlash).questionType(QuestionType.FILL_IN_BLANK)
                        .correctAnswer("color / colour").points(2.0).build(),
                AssignmentQuestion.builder().id(qPipe).questionType(QuestionType.FILL_IN_BLANK)
                        .correctAnswer("haven't | have not").points(2.0).build(),
                AssignmentQuestion.builder().id(qUnicode).questionType(QuestionType.FILL_IN_BLANK)
                        .correctAnswer(nfdVietnamese).points(2.0).build(),
                AssignmentQuestion.builder().id(qEmptyAns).questionType(QuestionType.FILL_IN_BLANK)
                        .correctAnswer("test").points(2.0).build()
        );

        List<SubmissionRequest.AnswerDto> answers = List.of(
                SubmissionRequest.AnswerDto.builder().questionId(qSlash).textAnswer("  COLOUR ").build(),
                SubmissionRequest.AnswerDto.builder().questionId(qPipe).textAnswer("Have   not").build(),
                SubmissionRequest.AnswerDto.builder().questionId(qUnicode).textAnswer("việt nam").build(),
                SubmissionRequest.AnswerDto.builder().questionId(qEmptyAns).textAnswer("   ").build()
        );

        GradingResult result = gradingEngineService.evaluateSubmission(questions, answers);

        assertThat(result.getCorrectnessPerQuestion().get(qSlash)).isTrue();
        assertThat(result.getCorrectnessPerQuestion().get(qPipe)).isTrue();
        assertThat(result.getCorrectnessPerQuestion().get(qUnicode)).isTrue();
        assertThat(result.getCorrectnessPerQuestion().get(qEmptyAns)).isFalse();
        assertThat(result.getTotalScore()).isEqualTo(6.0);
        assertThat(result.getScaledScore()).isEqualTo(7.5);
    }

    @Test
    @DisplayName("TRUE_FALSE & MULTIPLE_CHOICE: So khớp theo optionId hoặc text/label chuẩn hóa")
    void evaluateSubmission_trueFalseAndTextOptionFallback() {
        UUID tfById = UUID.randomUUID();
        UUID tfByText = UUID.randomUUID();
        UUID mcqByText = UUID.randomUUID();
        UUID tfTrueOpt = UUID.randomUUID();

        List<AssignmentQuestion> questions = List.of(
                AssignmentQuestion.builder().id(tfById).questionType(QuestionType.TRUE_FALSE).points(1.0)
                        .options(List.of(
                                QuestionOption.builder().id(tfTrueOpt).optionLabel("A").optionText("True").isCorrect(true).build(),
                                QuestionOption.builder().id(UUID.randomUUID()).optionLabel("B").optionText("False").isCorrect(false).build()
                        )).build(),
                AssignmentQuestion.builder().id(tfByText).questionType(QuestionType.TRUE_FALSE)
                        .correctAnswer("False").points(1.0).options(List.of()).build(),
                AssignmentQuestion.builder().id(mcqByText).questionType(QuestionType.MULTIPLE_CHOICE).points(2.0)
                        .options(List.of(
                                QuestionOption.builder().id(UUID.randomUUID()).optionLabel("A").optionText("Wrong").isCorrect(false).build(),
                                QuestionOption.builder().id(UUID.randomUUID()).optionLabel("B").optionText("Right choice").isCorrect(true).build()
                        )).build()
        );

        List<SubmissionRequest.AnswerDto> answers = List.of(
                SubmissionRequest.AnswerDto.builder().questionId(tfById).selectedOptionId(tfTrueOpt).build(),
                SubmissionRequest.AnswerDto.builder().questionId(tfByText).textAnswer(" false ").build(),
                SubmissionRequest.AnswerDto.builder().questionId(mcqByText).textAnswer("Right choice").build()
        );

        GradingResult result = gradingEngineService.evaluateSubmission(questions, answers);

        assertThat(result.getTotalScore()).isEqualTo(4.0);
        assertThat(result.getScaledScore()).isEqualTo(10.0);
    }

    @Test
    @DisplayName("MATCHING nâng cao: JSON map thành công/lỗi, peer QId & tính điểm từng phần (multi-pair partial scoring)")
    void evaluateSubmission_matchingJsonPartialAndEdgeCases() {
        UUID qMulti = UUID.randomUUID();
        UUID qMalformedJson = UUID.randomUUID();
        UUID qJsonPeer = UUID.randomUUID();
        UUID qAudio = UUID.randomUUID();

        // Multi-pair MATCHING (3 pairs total, worth 3.0 pts -> 2 correct pairs = 2.0 pts)
        AssignmentQuestion multiPairQ = AssignmentQuestion.builder()
                .id(qMulti)
                .questionType(QuestionType.MATCHING)
                .points(3.0)
                .options(List.of(
                        QuestionOption.builder().optionLabel("A").optionText("Apple").matchText("Táo").build(),
                        QuestionOption.builder().optionLabel("B").optionText("Book").matchText("Sách").build(),
                        QuestionOption.builder().optionLabel("C").optionText("Cat").matchText("Mèo").build()
                ))
                .build();

        AssignmentQuestion malformedJsonQ = AssignmentQuestion.builder()
                .id(qMalformedJson)
                .questionType(QuestionType.MATCHING)
                .correctAnswer("Táo")
                .points(2.0)
                .options(List.of())
                .build();

        AssignmentQuestion peerJsonQ = AssignmentQuestion.builder()
                .id(qJsonPeer)
                .questionType(QuestionType.MATCHING)
                .promptText("Feline")
                .correctAnswer("Mèo")
                .points(2.0)
                .options(List.of())
                .build();

        AssignmentQuestion audioQ = AssignmentQuestion.builder()
                .id(qAudio)
                .questionType(QuestionType.AUDIO_RESPONSE)
                .points(null) // defaults to 1.0
                .build();

        List<SubmissionRequest.AnswerDto> answers = List.of(
                SubmissionRequest.AnswerDto.builder().questionId(qMulti)
                        .textAnswer("{\"Apple\":\"Táo\",\"Book\":\"Sách\",\"Cat\":\"Chó\"}").build(),
                SubmissionRequest.AnswerDto.builder().questionId(qMalformedJson)
                        .textAnswer("{broken json").build(),
                SubmissionRequest.AnswerDto.builder().questionId(qJsonPeer)
                        .textAnswer("{\"Feline\":\"Mèo\"}").build()
        );

        GradingResult result = gradingEngineService.evaluateSubmission(
                List.of(multiPairQ, malformedJsonQ, peerJsonQ, audioQ), answers);

        assertThat(result.getEarnedPointsPerQuestion().get(qMulti)).isEqualTo(2.0);
        assertThat(result.getCorrectnessPerQuestion().get(qMulti)).isFalse();
        assertThat(result.getCorrectnessPerQuestion().get(qMalformedJson)).isFalse();
        assertThat(result.getCorrectnessPerQuestion().get(qJsonPeer)).isTrue();
        assertThat(result.isRequiresAiGrading()).isTrue();
        assertThat(result.getAiGradedQuestionIds()).containsExactly(qAudio);

        // Empty or null questions/answers boundary
        GradingResult emptyRes = gradingEngineService.evaluateSubmission(null, null);
        assertThat(emptyRes.getTotalScore()).isZero();
        assertThat(emptyRes.getScaledScore()).isZero();
        assertThat(emptyRes.isRequiresAiGrading()).isFalse();
    }

    @Test
    @DisplayName("evaluateSubmission_whenMcqAnsweredByOptionLabelOrUnanswered_gradesCorrectly")
    void evaluateSubmission_whenMcqAnsweredByOptionLabelOrUnanswered_gradesCorrectly() {
        UUID qLabelId = UUID.randomUUID();
        UUID qUnansweredId = UUID.randomUUID();
        UUID qWrongOptId = UUID.randomUUID();
        UUID optWrongId = UUID.randomUUID();

        List<AssignmentQuestion> questions = List.of(
                AssignmentQuestion.builder().id(qLabelId).questionType(QuestionType.MULTIPLE_CHOICE).points(2.0)
                        .options(List.of(
                                QuestionOption.builder().id(UUID.randomUUID()).optionLabel("A").optionText("First").isCorrect(false).build(),
                                QuestionOption.builder().id(UUID.randomUUID()).optionLabel("B").optionText("Second").isCorrect(true).build()
                        )).build(),
                AssignmentQuestion.builder().id(qUnansweredId).questionType(QuestionType.MULTIPLE_CHOICE).points(2.0)
                        .options(List.of(
                                QuestionOption.builder().id(UUID.randomUUID()).optionLabel("A").optionText("Only").isCorrect(true).build()
                        )).build(),
                AssignmentQuestion.builder().id(qWrongOptId).questionType(QuestionType.MULTIPLE_CHOICE).points(2.0)
                        .options(List.of(
                                QuestionOption.builder().id(UUID.randomUUID()).optionLabel("A").optionText("Correct").isCorrect(true).build(),
                                QuestionOption.builder().id(optWrongId).optionLabel("B").optionText("Wrong").isCorrect(false).build()
                        )).build()
        );

        List<SubmissionRequest.AnswerDto> answers = List.of(
                SubmissionRequest.AnswerDto.builder().questionId(qLabelId).textAnswer("  b  ").build(),
                SubmissionRequest.AnswerDto.builder().questionId(qWrongOptId).selectedOptionId(optWrongId).build()
        );

        GradingResult result = gradingEngineService.evaluateSubmission(questions, answers);

        assertThat(result.getCorrectnessPerQuestion().get(qLabelId)).isTrue();
        assertThat(result.getEarnedPointsPerQuestion().get(qLabelId)).isEqualTo(2.0);
        assertThat(result.getCorrectnessPerQuestion().get(qUnansweredId)).isFalse();
        assertThat(result.getEarnedPointsPerQuestion().get(qUnansweredId)).isZero();
        assertThat(result.getCorrectnessPerQuestion().get(qWrongOptId)).isFalse();
        assertThat(result.getTotalScore()).isEqualTo(2.0);
    }

    @Test
    @DisplayName("evaluateSubmission_whenTrueFalseMatchedByOptionTextCaseInsensitive_gradesCorrectly")
    void evaluateSubmission_whenTrueFalseMatchedByOptionTextCaseInsensitive_gradesCorrectly() {
        UUID qTfId = UUID.randomUUID();
        AssignmentQuestion tfQuestion = AssignmentQuestion.builder()
                .id(qTfId)
                .questionType(QuestionType.TRUE_FALSE)
                .correctAnswer(null)
                .points(1.5)
                .options(List.of(
                        QuestionOption.builder().id(UUID.randomUUID()).optionLabel("A").optionText("True").isCorrect(true).build(),
                        QuestionOption.builder().id(UUID.randomUUID()).optionLabel("B").optionText("False").isCorrect(false).build()
                ))
                .build();

        GradingResult correctRes = gradingEngineService.evaluateSubmission(
                List.of(tfQuestion),
                List.of(SubmissionRequest.AnswerDto.builder().questionId(qTfId).textAnswer("  TRUE ").build())
        );
        GradingResult wrongRes = gradingEngineService.evaluateSubmission(
                List.of(tfQuestion),
                List.of(SubmissionRequest.AnswerDto.builder().questionId(qTfId).textAnswer("False").build())
        );

        assertThat(correctRes.getCorrectnessPerQuestion().get(qTfId)).isTrue();
        assertThat(correctRes.getEarnedPointsPerQuestion().get(qTfId)).isEqualTo(1.5);
        assertThat(wrongRes.getCorrectnessPerQuestion().get(qTfId)).isFalse();
        assertThat(wrongRes.getEarnedPointsPerQuestion().get(qTfId)).isZero();
    }

    @Test
    @DisplayName("evaluateSubmission_whenFillInBlankHasMultipleVariantsPipeAndSlashWithBlankSegments_gradesCorrectly")
    void evaluateSubmission_whenFillInBlankHasMultipleVariantsPipeAndSlashWithBlankSegments_gradesCorrectly() {
        UUID q1Id = UUID.randomUUID();
        UUID q2Id = UUID.randomUUID();
        AssignmentQuestion q1 = AssignmentQuestion.builder()
                .id(q1Id)
                .questionType(QuestionType.FILL_IN_BLANK)
                .correctAnswer("don't | do not / ")
                .points(2.0)
                .build();
        AssignmentQuestion q2 = AssignmentQuestion.builder()
                .id(q2Id)
                .questionType(QuestionType.FILL_IN_BLANK)
                .correctAnswer("don't | do not / ")
                .points(2.0)
                .build();

        GradingResult result = gradingEngineService.evaluateSubmission(
                List.of(q1, q2),
                List.of(
                        SubmissionRequest.AnswerDto.builder().questionId(q1Id).textAnswer("  Do   not ").build(),
                        SubmissionRequest.AnswerDto.builder().questionId(q2Id).textAnswer("will not").build()
                )
        );

        assertThat(result.getCorrectnessPerQuestion().get(q1Id)).isTrue();
        assertThat(result.getEarnedPointsPerQuestion().get(q1Id)).isEqualTo(2.0);
        assertThat(result.getCorrectnessPerQuestion().get(q2Id)).isFalse();
        assertThat(result.getTotalScore()).isEqualTo(2.0);
    }

    @Test
    @DisplayName("evaluateSubmission_whenMultiPairMatchingAllMatchedByLabelOrIdOrMalformed_computesFullAndZeroScores")
    void evaluateSubmission_whenMultiPairMatchingAllMatchedByLabelOrIdOrMalformed_computesFullAndZeroScores() {
        UUID qAllMatchId = UUID.randomUUID();
        UUID qNonJsonId = UUID.randomUUID();
        UUID optBId = UUID.randomUUID();

        AssignmentQuestion multiQ1 = AssignmentQuestion.builder()
                .id(qAllMatchId)
                .questionType(QuestionType.MATCHING)
                .points(4.0)
                .options(List.of(
                        QuestionOption.builder().id(UUID.randomUUID()).optionLabel("A").optionText("Sun").matchText("Mặt trời").build(),
                        QuestionOption.builder().id(optBId).optionLabel("B").optionText("Moon").matchText("Mặt trăng").build()
                ))
                .build();

        AssignmentQuestion multiQ2 = AssignmentQuestion.builder()
                .id(qNonJsonId)
                .questionType(QuestionType.MATCHING)
                .points(2.0)
                .options(List.of(
                        QuestionOption.builder().optionLabel("A").optionText("One").matchText("Một").build(),
                        QuestionOption.builder().optionLabel("B").optionText("Two").matchText("Hai").build()
                ))
                .build();

        String labelAndUuidJson = "{\"A\":\"Mặt trời\",\"" + optBId + "\":\"Mặt trăng\"}";
        GradingResult result = gradingEngineService.evaluateSubmission(
                List.of(multiQ1, multiQ2),
                List.of(
                        SubmissionRequest.AnswerDto.builder().questionId(qAllMatchId).textAnswer(labelAndUuidJson).build(),
                        SubmissionRequest.AnswerDto.builder().questionId(qNonJsonId).textAnswer("plain text").build()
                )
        );

        assertThat(result.getEarnedPointsPerQuestion().get(qAllMatchId)).isEqualTo(4.0);
        assertThat(result.getCorrectnessPerQuestion().get(qAllMatchId)).isTrue();
        assertThat(result.getEarnedPointsPerQuestion().get(qNonJsonId)).isZero();
        assertThat(result.getCorrectnessPerQuestion().get(qNonJsonId)).isFalse();
    }

    @Test
    @DisplayName("evaluateSubmission_whenMatching1To1UsesJsonPeerUuidOrUnicodeNfdOrOptionMatchText_gradesCorrectly")
    void evaluateSubmission_whenMatching1To1UsesJsonPeerUuidOrUnicodeNfdOrOptionMatchText_gradesCorrectly() {
        UUID q1Id = UUID.randomUUID();
        UUID q2Id = UUID.randomUUID();
        UUID q3Id = UUID.randomUUID();
        UUID q4Id = UUID.randomUUID();

        String expectedNfc = "Sức bật";
        String submittedNfd = java.text.Normalizer.normalize("sức bật", java.text.Normalizer.Form.NFD);
        String eloquentNfd = java.text.Normalizer.normalize("Hùng biện", java.text.Normalizer.Form.NFD);

        AssignmentQuestion q1 = AssignmentQuestion.builder()
                .id(q1Id).questionType(QuestionType.MATCHING).promptText("Resilience")
                .correctAnswer(expectedNfc).points(1.0).options(List.of()).build();
        AssignmentQuestion q2 = AssignmentQuestion.builder()
                .id(q2Id).questionType(QuestionType.MATCHING).promptText("Bounce back")
                .correctAnswer(expectedNfc).points(1.0).options(List.of()).build();
        AssignmentQuestion q3 = AssignmentQuestion.builder()
                .id(q3Id).questionType(QuestionType.MATCHING).promptText("Adapt")
                .correctAnswer(submittedNfd).points(1.0).options(List.of()).build();
        AssignmentQuestion q4 = AssignmentQuestion.builder()
                .id(q4Id).questionType(QuestionType.MATCHING).promptText("Eloquent")
                .correctAnswer("").points(1.0)
                .options(List.of(QuestionOption.builder().id(UUID.randomUUID()).optionText("Eloquent").matchText("Hùng biện").isCorrect(true).build()))
                .build();

        List<SubmissionRequest.AnswerDto> answers = List.of(
                SubmissionRequest.AnswerDto.builder().questionId(q1Id).textAnswer("{\"" + q1Id + "\":\"" + q2Id + "\"}").build(),
                SubmissionRequest.AnswerDto.builder().questionId(q2Id).textAnswer("{\"" + q2Id + "\":\"" + q2Id + "\"}").build(),
                SubmissionRequest.AnswerDto.builder().questionId(q3Id).selectedOptionId(q1Id).build(),
                SubmissionRequest.AnswerDto.builder().questionId(q4Id).textAnswer(eloquentNfd).build()
        );

        GradingResult result = gradingEngineService.evaluateSubmission(List.of(q1, q2, q3, q4), answers);

        assertThat(result.getCorrectnessPerQuestion().get(q1Id)).isTrue();
        assertThat(result.getCorrectnessPerQuestion().get(q2Id)).isTrue();
        assertThat(result.getCorrectnessPerQuestion().get(q3Id)).isTrue();
        assertThat(result.getCorrectnessPerQuestion().get(q4Id)).isTrue();
        assertThat(result.getScaledScore()).isEqualTo(10.0);
    }

    @Test
    @DisplayName("evaluateSubmission_whenMixedObjectiveEssayAndAudioResponse_gradesObjectiveAndFlagsBothSubjectiveForAi")
    void evaluateSubmission_whenMixedObjectiveEssayAndAudioResponse_gradesObjectiveAndFlagsBothSubjectiveForAi() {
        UUID mcqId = UUID.randomUUID();
        UUID mcqCorrectOpt = UUID.randomUUID();
        UUID essayId = UUID.randomUUID();
        UUID audioId = UUID.randomUUID();

        List<AssignmentQuestion> questions = List.of(
                AssignmentQuestion.builder().id(mcqId).questionType(QuestionType.MULTIPLE_CHOICE).points(2.0)
                        .options(List.of(QuestionOption.builder().id(mcqCorrectOpt).isCorrect(true).build())).build(),
                AssignmentQuestion.builder().id(essayId).questionType(QuestionType.ESSAY).points(4.0).build(),
                AssignmentQuestion.builder().id(audioId).questionType(QuestionType.AUDIO_RESPONSE).points(4.0).build()
        );

        GradingResult result = gradingEngineService.evaluateSubmission(
                questions,
                List.of(
                        SubmissionRequest.AnswerDto.builder().questionId(mcqId).selectedOptionId(mcqCorrectOpt).build(),
                        SubmissionRequest.AnswerDto.builder().questionId(essayId).textAnswer("My essay").build(),
                        SubmissionRequest.AnswerDto.builder().questionId(audioId).textAnswer("/audio/ans.wav").build()
                )
        );

        assertThat(result.getTotalScore()).isEqualTo(2.0);
        assertThat(result.getMaxPossibleScore()).isEqualTo(10.0);
        assertThat(result.getScaledScore()).isEqualTo(2.0);
        assertThat(result.isRequiresAiGrading()).isTrue();
        assertThat(result.getAiGradedQuestionIds()).containsExactly(essayId, audioId);
    }

}
