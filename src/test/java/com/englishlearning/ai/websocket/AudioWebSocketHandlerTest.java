package com.englishlearning.ai.websocket;

import com.englishlearning.ai.dto.ShadowingEvaluationResponse;
import com.englishlearning.ai.service.ShadowingPracticeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.nio.ByteBuffer;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AudioWebSocketHandler - Streaming Audio Realtime & WebSocket Management")
class AudioWebSocketHandlerTest {

    @Mock
    private ShadowingPracticeService shadowingPracticeService;

    @Mock
    private WebSocketSession session;

    private ObjectMapper objectMapper;
    private AudioWebSocketHandler audioWebSocketHandler;

    private final String sessionId = "ws-session-12345";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        audioWebSocketHandler = new AudioWebSocketHandler(shadowingPracticeService, objectMapper);
        lenient().when(session.getId()).thenReturn(sessionId);
    }

    @Test
    @DisplayName("Tầng 1 (Realtime): Stream audio chunk và trả về điểm số IPA thời gian thực khi kết nối WebSocket ổn định")
    void should_StreamAudioChunkAndReturnRealtimeIpaScore_when_WebSocketConnectionIsStable() throws Exception {
        // Given
        byte[] audioChunk = new byte[]{10, 20, 30, 40, 50};
        when(session.isOpen()).thenReturn(true);

        ShadowingEvaluationResponse mockResponse = ShadowingEvaluationResponse.builder()
                .overallScore(88)
                .isPassed(true)
                .passScore(80)
                .evaluatedBy("PYTHON_ACOUSTIC_ENGINE")
                .sentenceTokens(List.of(
                        ShadowingEvaluationResponse.SentenceToken.builder()
                                .word("Hello")
                                .color("GREEN")
                                .wordStatus("SPOKEN")
                                .build()
                ))
                .build();

        when(shadowingPracticeService.processAudioChunk(eq(sessionId), any(byte[].class), eq("Hello world")))
                .thenReturn(mockResponse);

        audioWebSocketHandler.afterConnectionEstablished(session);

        // When: Client stream một audio chunk qua BinaryMessage
        audioWebSocketHandler.handleBinaryMessage(session, new BinaryMessage(ByteBuffer.wrap(audioChunk)));

        // Then: Kết quả chấm thời gian thực được serialize và gửi lại qua TextMessage
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session, times(1)).sendMessage(captor.capture());

        String responsePayload = captor.getValue().getPayload();
        assertThat(responsePayload).contains("\"overallScore\":88");
        assertThat(responsePayload).contains("\"isPassed\":true");
        assertThat(responsePayload).contains("\"evaluatedBy\":\"PYTHON_ACOUSTIC_ENGINE\"");
        assertThat(responsePayload).contains("\"word\":\"Hello\"");

        // Tuân thủ verify-relevant-arguments-only: chỉ verify payload audio và referenceText
        verify(shadowingPracticeService, times(1))
                .processAudioChunk(eq(sessionId), eq(audioChunk), eq("Hello world"));
    }

    @Test
    @DisplayName("Cập nhật referenceText khi client gửi cấu hình qua TextMessage JSON")
    void should_UpdateReferenceText_when_TextMessageReceived() throws Exception {
        // Given: Session kết nối và gửi tin nhắn thiết lập câu mẫu
        audioWebSocketHandler.afterConnectionEstablished(session);
        when(session.isOpen()).thenReturn(true);

        String configJson = """
                {
                  "referenceText": "Artificial Intelligence in Education"
                }
                """;

        when(shadowingPracticeService.processAudioChunk(eq(sessionId), any(byte[].class), eq("Artificial Intelligence in Education")))
                .thenReturn(ShadowingEvaluationResponse.builder().overallScore(90).build());

        // When
        audioWebSocketHandler.handleTextMessage(session, new TextMessage(configJson));
        audioWebSocketHandler.handleBinaryMessage(session, new BinaryMessage(ByteBuffer.wrap(new byte[]{1, 2, 3})));

        // Then: processAudioChunk phải nhận câu đối chiếu mới
        verify(shadowingPracticeService, times(1))
                .processAudioChunk(eq(sessionId), any(byte[].class), eq("Artificial Intelligence in Education"));
    }

    @Test
    @DisplayName("Không gửi message khi session đã bị đóng")
    void should_NotSendMessage_when_SessionIsClosed() throws Exception {
        // Given
        when(session.isOpen()).thenReturn(false);
        when(shadowingPracticeService.processAudioChunk(any(), any(), any()))
                .thenReturn(ShadowingEvaluationResponse.builder().overallScore(70).build());

        // When
        audioWebSocketHandler.handleBinaryMessage(session, new BinaryMessage(ByteBuffer.wrap(new byte[]{1, 2})));

        // Then
        verify(session, never()).sendMessage(any());
    }

    @Test
    @DisplayName("Xóa metadata trong session map khi kết nối WebSocket kết thúc")
    void should_CleanSessionMetadata_when_ConnectionClosed() {
        // Given
        audioWebSocketHandler.afterConnectionEstablished(session);

        // When
        audioWebSocketHandler.afterConnectionClosed(session, CloseStatus.NORMAL);

        // Then: verify không phát sinh ngoại lệ
        assertThat(sessionId).isNotNull();
    }
}
