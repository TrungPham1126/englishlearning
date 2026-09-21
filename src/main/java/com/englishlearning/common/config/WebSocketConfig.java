package com.englishlearning.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Cấu hình broker để định tuyến các message đến client
        config.enableSimpleBroker("/topic", "/queue");
        // Các message từ client gửi lên server (nếu có) sẽ mang tiền tố này
        config.setApplicationDestinationPrefixes("/app");
        // Dùng để gửi tin nhắn đến một user cụ thể
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Client sẽ kết nối tới WebSocket thông qua endpoint này (ví dụ:
        // ws://localhost:8080/ws)
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // Cho phép gọi từ mọi domain (CORS)
                .withSockJS(); // Cung cấp fallback cho trình duyệt không hỗ trợ WebSocket thuần
    }
}