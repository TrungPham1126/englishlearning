package com.englishlearning.ai.service;

import com.englishlearning.ai.entity.AiGeneratedExercise;
import com.englishlearning.assignment.entity.Assignment;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface AiLabService {

    JsonNode evaluateSpeakingTopic(String questionTopic, MultipartFile audioFile, UUID studentAnswerId);

    JsonNode evaluateWriting(String topic, String essayText, UUID studentAnswerId);

    AiGeneratedExercise generateQuizFromContent(String lessonContent, String targetCefr, int questionCount,
            UUID teacherId, UUID lessonId);

    AiGeneratedExercise generateQuizFromContent(String lessonContent, String targetCefr, int questionCount,
            UUID teacherId, UUID lessonId, String exerciseType);

    AiGeneratedExercise generateQuizFromContent(String lessonContent, String targetCefr, int questionCount,
            UUID teacherId, UUID lessonId, String exerciseType, String skillType);

    Assignment publishExerciseToAssignment(UUID exerciseId, UUID classroomId);

    JsonNode evaluateReadingShortAnswer(String passage, String question, String studentAnswer, String expectedAnswer);
}
