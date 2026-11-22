package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.AiMonitoringService;
import com.englishlearning.ai.service.GeminiClientService;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.exception.BadRequestException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("GeminiClientServiceImpl - Gọi API Text/Multimodal, Token Usage & Strip Markdown")
class GeminiClientServiceImplTest {

    @Mock
    private AiMonitoringService aiMonitoringService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RestTemplate restTemplate;

    private GeminiClientServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new GeminiClientServiceImpl(new ObjectMapper(), aiMonitoringService, userRepository, restTemplate);
        ReflectionTestUtils.setField(service, "geminiApiKey", "test-api-key");
        ReflectionTestUtils.setField(service, "geminiBaseUrl", "https://generativelanguage.googleapis.com/v1beta");
        ReflectionTestUtils.setField(service, "geminiModel", "gemini-2.5-flash");
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("generateWithSystemInstruction làm sạch markdown fence, ghi token thật từ usageMetadata và xác định đúng Student")
    void generateWithSystemInstruction_stripsMarkdownAndRecordsMetadataTokens() {
        UUID studentId = UUID.randomUUID();
        User studentUser = User.builder()
                .id(studentId).email("st@english.com").password("h")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails principal = new CustomUserDetails(studentUser);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));

        String responseBody = """
                {
                  "candidates": [{
                    "content": { "parts": [{ "text": "```json\\n{\\"overallScore\\": 90}\\n```" }] }
                  }],
                  "usageMetadata": {
                    "promptTokenCount": 120,
                    "candidatesTokenCount": 45
                  }
                }
                """;
        when(restTemplate.postForEntity(contains("gemini-2.5-flash:generateContent?key=test-api-key"), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(responseBody));

        String result = service.generateWithSystemInstruction("System rule", "User essay");

        assertThat(result).isEqualTo("{\"overallScore\": 90}");
        verify(aiMonitoringService).checkRateLimitAndQuota(studentId, false);
        verify(aiMonitoringService).recordTokenUsage(studentId, "STUDENT", 120L, 45L, "GEMINI");
    }

    @Test
    @DisplayName("evaluateAudioWithInstruction mã hóa audio Base64 và ước lượng token khi thiếu usageMetadata")
    void evaluateAudioWithInstruction_encodesAudioAndFallsBackTokenCount() {
        UUID teacherId = UUID.randomUUID();
        User teacherUser = User.builder()
                .id(teacherId).email("teacher@english.com").password("h")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        CustomUserDetails principal = new CustomUserDetails(teacherUser);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));

        String responseBody = """
                {
                  "candidates": [{
                    "content": { "parts": [{ "text": "{\\"ok\\":true}" }] }
                  }]
                }
                """;
        @SuppressWarnings("unchecked")
        ArgumentCaptor<HttpEntity<Map<String, Object>>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        when(restTemplate.postForEntity(anyString(), entityCaptor.capture(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(responseBody));

        String out = service.evaluateAudioWithInstruction("System", new byte[100], "audio/wav", "Check speech");

        assertThat(out).isEqualTo("{\"ok\":true}");
        assertThat(entityCaptor.getValue().getBody()).containsKey("contents");
        verify(aiMonitoringService).checkRateLimitAndQuota(teacherId, true);
        verify(aiMonitoringService).recordTokenUsage(eq(teacherId), eq("TEACHER"), anyLong(), anyLong(), eq("GEMINI"));
    }

    @Test
    @DisplayName("Giữ nguyên ResponseStatusException (429) và bọc lỗi RestTemplate khác vào BadRequestException")
    void executeRequest_preserves429AndWrapsOtherErrorsInBadRequestException() {
        doThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Rate limited"))
                .when(aiMonitoringService).checkRateLimitAndQuota(any(), anyBoolean());

        assertThatThrownBy(() -> service.generateWithSystemInstruction("S", "U", 0.5, UUID.randomUUID(), false))
                .isInstanceOf(ResponseStatusException.class);

        reset(aiMonitoringService);
        when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenThrow(new RuntimeException("Upstream 503"));

        assertThatThrownBy(() -> service.generateWithSystemInstruction("S", "U", 0.5, UUID.randomUUID(), true))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Gemini AI API");
    }

    @Test
    @DisplayName("stripMarkdown chuẩn hóa chuỗi null và các markdown code fence")
    void stripMarkdown_handlesAllFormats() {
        assertThat(GeminiClientService.stripMarkdown(null)).isEqualTo("{}");
        assertThat(GeminiClientService.stripMarkdown("```json\n{\"a\":1}\n```")).isEqualTo("{\"a\":1}");
        assertThat(GeminiClientService.stripMarkdown("```\n{\"b\":2}\n```")).isEqualTo("{\"b\":2}");
        assertThat(GeminiClientService.stripMarkdown("  {\"c\":3}  ")).isEqualTo("{\"c\":3}");
    }

    @Test
    @DisplayName("executeRequest: candidates hoặc parts rỗng ném BadRequestException có thông báo rõ ràng")
    void generateWithSystemInstruction_emptyCandidatesOrPartsThrowsBadRequest() {
        when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"candidates\":[]}"))
                .thenReturn(ResponseEntity.ok("{\"candidates\":[{\"content\":{\"parts\":[]}}]}"));

        assertThatThrownBy(() -> service.generateWithSystemInstruction("Sys", "Prompt", 0.2, UUID.randomUUID(), false))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("candidates/parts");

        assertThatThrownBy(() -> service.generateWithSystemInstruction("Sys", "Prompt", 0.2, UUID.randomUUID(), false))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("candidates/parts");
    }

    @Test
    @DisplayName("Phân giải String email principal (ROLE_ADMIN), ngữ cảnh ẩn danh, prompt null & kẹp temperature [-0.5->0.0, 3.0->1.5]")
    @SuppressWarnings("unchecked")
    void generateWithSystemInstruction_resolvesEmailPrincipalAnonymousContextNullPromptsAndClampsTemp() {
        UUID adminId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin@english.test", null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        when(userRepository.findByEmail("admin@english.test"))
                .thenReturn(Optional.of(User.builder().id(adminId).email("admin@english.test").build()));
        when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"{}\"}]}}]}"));

        service.generateWithSystemInstruction(null, null, -0.5);

        ArgumentCaptor<HttpEntity<Map<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(anyString(), captor.capture(), eq(String.class));
        Map<String, Object> genCfg1 = (Map<String, Object>) captor.getValue().getBody().get("generationConfig");
        assertThat(genCfg1.get("temperature")).isEqualTo(0.0);
        verify(aiMonitoringService).recordTokenUsage(eq(adminId), eq("TEACHER"), eq(1L), anyLong(), eq("GEMINI"));

        // Ngữ cảnh ẩn danh (anonymous) + temperature > 1.5 + evaluateAudioWithInstruction với prompt null
        SecurityContextHolder.clearContext();
        service.generateWithSystemInstruction("Sys", "User", 3.0);
        service.evaluateAudioWithInstruction(null, new byte[40], "audio/wav", null);

        ArgumentCaptor<HttpEntity<Map<String, Object>>> allCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, times(3)).postForEntity(anyString(), allCaptor.capture(), eq(String.class));
        Map<String, Object> genCfg2 = (Map<String, Object>) allCaptor.getAllValues().get(1).getBody().get("generationConfig");
        assertThat(genCfg2.get("temperature")).isEqualTo(1.5);
        verify(aiMonitoringService, times(2)).recordTokenUsage(isNull(), eq("STUDENT"), anyLong(), anyLong(), eq("GEMINI"));
    }
}
