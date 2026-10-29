package com.englishlearning.ai.service;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;

import java.util.UUID;

public interface ShadowingPracticeService {

    /**
     * Chấm bài luyện nói Shadowing đầy đủ và lưu kết quả đánh giá vào CSDL.
     */
    ShadowingEvaluationResponse practiceShadowing(
            UUID studentAnswerId,
            byte[] audioBytes,
            String filename,
            String referenceSentence
    );

    /**
     * Xử lý audio chunk thời gian thực phục vụ streaming WebSocket.
     */
    ShadowingEvaluationResponse processAudioChunk(
            String sessionId,
            byte[] audioChunk,
            String referenceText
    );
}
