package com.englishlearning.common.config;

import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Cấu hình broker để định tuyến các message đến client (/topic cho broadcast, /queue cho user cụ thể)
        config.enableSimpleBroker("/topic", "/queue");
        // Các message từ client gửi lên server mang tiền tố /app
        config.setApplicationDestinationPrefixes("/app");
        // Dùng để gửi tin nhắn đến một user cụ thể qua convertAndSendToUser
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint hỗ trợ cả WebSocket thuần và SockJS fallback
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader == null || authHeader.isBlank()) {
                        authHeader = accessor.getFirstNativeHeader("token");
                    }
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        authHeader = authHeader.substring(7);
                    }

                    if (authHeader != null && !authHeader.isBlank()) {
                        try {
                            String email = jwtService.extractUsername(authHeader);
                            if (email != null) {
                                UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                                if (jwtService.isTokenValid(authHeader, userDetails)) {
                                    // Gán Principal.name bằng userId.toString() để khớp hoàn toàn với convertAndSendToUser(userId, ...)
                                    String principalName = (userDetails instanceof CustomUserDetails customUser)
                                            ? customUser.getId().toString()
                                            : userDetails.getUsername();

                                    UsernamePasswordAuthenticationToken authentication =
                                            new UsernamePasswordAuthenticationToken(
                                                    principalName,
                                                    null,
                                                    userDetails.getAuthorities()
                                            );
                                    accessor.setUser(authentication);
                                    log.info("WebSocket STOMP authenticated user ID: {}", principalName);
                                }
                            }
                        } catch (Exception ex) {
                            log.warn("WebSocket STOMP authentication failed: {}", ex.getMessage());
                        }
                    }
                }
                return message;
            }
        });
    }
}
