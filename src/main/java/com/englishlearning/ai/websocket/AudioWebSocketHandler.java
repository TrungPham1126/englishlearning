package com.englishlearning.ai.websocket;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.service.ShadowingPracticeService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.nio.ByteBuffer;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class AudioWebSocketHandler extends BinaryWebSocketHandler {

    private final ShadowingPracticeService shadowingPracticeService;
    private final ObjectMapper objectMapper;

    private final Map<String, String> sessionReferenceTextMap = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("[WebSocket] Kết nối mới được thiết lập: SessionId = {}", session.getId());
        sessionReferenceTextMap.put(session.getId(), "Hello world");
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode rootNode = objectMapper.readTree(message.getPayload());
            if (rootNode != null && rootNode.hasNonNull("referenceText")) {
                String refText = rootNode.get("referenceText").asText();
                if (!refText.isBlank()) {
                    String trimmed = refText.trim();
                    sessionReferenceTextMap.put(session.getId(), trimmed);
                    log.info("[WebSocket] Cập nhật referenceText cho session {}: '{}'", session.getId(), trimmed);
                }
            }
        } catch (Exception ex) {
            log.warn("[WebSocket] Không thể parse TextMessage metadata: {}", ex.getMessage());
        }
    }

    @Override
    public void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        ByteBuffer buffer = message.getPayload();
        byte[] audioBytes = new byte[buffer.remaining()];
        buffer.get(audioBytes);

        String referenceText = sessionReferenceTextMap.getOrDefault(session.getId(), "Hello world");

        log.debug("[WebSocket] Nhận chunk audio ({} bytes) từ session {}", audioBytes.length, session.getId());

        ShadowingEvaluationResponse response = shadowingPracticeService.processAudioChunk(
                session.getId(),
                audioBytes,
                referenceText
        );

        String jsonPayload = objectMapper.writeValueAsString(response);
        if (session.isOpen()) {
            session.sendMessage(new TextMessage(jsonPayload));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("[WebSocket] Đóng kết nối session {}. Lý do: {}", session.getId(), status);
        sessionReferenceTextMap.remove(session.getId());
    }

    public void setReferenceTextForSession(String sessionId, String referenceText) {
        if (sessionId == null || referenceText == null || referenceText.isBlank()) {
            return;
        }
        sessionReferenceTextMap.put(sessionId, referenceText.trim());
    }
}
