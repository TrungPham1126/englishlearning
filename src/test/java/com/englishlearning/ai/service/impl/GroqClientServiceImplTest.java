package com.englishlearning.ai.service.impl;

import com.englishlearning.ai.service.AiMonitoringService;
import com.englishlearning.ai.service.GroqClientService;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.common.config.AppProperties;
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
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.MultiValueMap;
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
@DisplayName("GroqClientServiceImpl - Whisper ASR & LLaMA JSON Chat Completion")
class GroqClientServiceImplTest {

    @Mock
    private AiMonitoringService aiMonitoringService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RestTemplate restTemplate;

    private AppProperties appProperties;
    private GroqClientServiceImpl service;

    @BeforeEach
    void setUp() {
        appProperties = new AppProperties();
        appProperties.getGroq().setApiKey("gsk-test");
        appProperties.getGroq().setChatUrl("https://api.groq.com/chat");
        appProperties.getGroq().setAudioUrl("https://api.groq.com/audio");
        service = new GroqClientServiceImpl(appProperties, new ObjectMapper(), aiMonitoringService, userRepository, restTemplate);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("transcribeAudio đọc văn bản từ Whisper MultipartFile và hỗ trợ chế độ verbose_json")
    void transcribeAudio_handlesStandardAndVerboseResponses() {
        MockMultipartFile file = new MockMultipartFile("audio", "speak.wav", "audio/wav", "wav".getBytes());
        when(restTemplate.postForEntity(eq("https://api.groq.com/audio"), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"text\":\"Hello IELTS\"}"))
                .thenReturn(ResponseEntity.ok("{\"text\":\"Hello\",\"words\":[{\"word\":\"Hello\"}]}"));

        String transcript = service.transcribeAudio(file);
        String verbose = service.transcribeAudioVerbose("wav".getBytes(), "speak.wav");

        assertThat(transcript).isEqualTo("Hello IELTS");
        assertThat(verbose).contains("\"words\"");
    }

    @Test
    @DisplayName("transcribeAudio và transcribeAudioVerbose ném BadRequestException khi Groq API lỗi")
    void transcribeAudio_wrapsErrorsInBadRequestException() {
        when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenThrow(new RuntimeException("Groq Whisper 502"));

        assertThatThrownBy(() -> service.transcribeAudio(new byte[]{1, 2}, "a.wav"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Groq Whisper");
        assertThatThrownBy(() -> service.transcribeAudioVerbose(new byte[]{1, 2}, "a.wav"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("chi tiết");
    }

    @Test
    @DisplayName("chatCompletionJson làm sạch markdown fence, ghi nhận token GROQ theo vai trò và clamp temperature")
    void chatCompletionJson_recordsUsageAndHandlesFailures() {
        UUID studentId = UUID.randomUUID();
        User st = User.builder()
                .id(studentId).email("st@english.com").password("h")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails details = new CustomUserDetails(st);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));

        String chatResp = """
                {
                  "choices": [{ "message": { "content": "```json\\n{\\"score\\": 8}\\n```" } }],
                  "usage": { "prompt_tokens": 200, "completion_tokens": 55 }
                }
                """;
        when(restTemplate.postForEntity(eq("https://api.groq.com/chat"), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(chatResp));

        String json = service.chatCompletionJson("System", "User essay");

        assertThat(json).isEqualTo("{\"score\": 8}");
        verify(aiMonitoringService).checkRateLimitAndQuota(studentId, false);
        verify(aiMonitoringService).recordTokenUsage(studentId, "STUDENT", 200L, 55L, "GROQ");

        // Fallback ước lượng token khi không có trường usage + explicit teacher flag
        UUID teacherId = UUID.randomUUID();
        when(restTemplate.postForEntity(eq("https://api.groq.com/chat"), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"choices\":[{\"message\":{\"content\":\"{}\"}}]}"));
        service.chatCompletionJson("Sys", "Prompt", 5.0, teacherId, true);
        verify(aiMonitoringService).recordTokenUsage(eq(teacherId), eq("TEACHER"), anyLong(), anyLong(), eq("GROQ"));

        // Preserve 429 & wrap RuntimeException
        doThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Limit"))
                .when(aiMonitoringService).checkRateLimitAndQuota(eq(teacherId), eq(true));
        assertThatThrownBy(() -> service.chatCompletionJson("Sys", "Prompt", 0.2, teacherId, true))
                .isInstanceOf(ResponseStatusException.class);

        reset(aiMonitoringService);
        when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                .thenThrow(new RuntimeException("Socket timeout"));
        assertThatThrownBy(() -> service.chatCompletionJson("Sys", "Prompt", 0.2, teacherId, true))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("GroqClientService.stripMarkdown xử lý chính xác null và markdown fence")
    void stripMarkdown_cleanlyStripsFences() {
        assertThat(GroqClientService.stripMarkdown(null)).isEqualTo("{}");
        assertThat(GroqClientService.stripMarkdown("```json\n{}\n```")).isEqualTo("{}");
        assertThat(GroqClientService.stripMarkdown("```\n{\"x\":1}\n```")).isEqualTo("{\"x\":1}");
    }

    @Test
    @DisplayName("transcribeAudio: filename null hoặc khoảng trắng mặc định gửi 'audio.wav'")
    @SuppressWarnings("unchecked")
    void transcribeAudio_blankFilenameDefaultsToAudioWav() {
        MockMultipartFile blankNameFile = new MockMultipartFile("audio", "   ", "audio/wav", "wav".getBytes());
        MockMultipartFile nullNameFile = new MockMultipartFile("audio", null, "audio/wav", "wav".getBytes());
        when(restTemplate.postForEntity(eq("https://api.groq.com/audio"), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"text\":\"ok\"}"));

        service.transcribeAudio(blankNameFile);
        service.transcribeAudio(nullNameFile);

        ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, times(2)).postForEntity(eq("https://api.groq.com/audio"), captor.capture(), eq(String.class));
        assertThat(((ByteArrayResource) captor.getAllValues().get(0).getBody().getFirst("file")).getFilename())
                .isEqualTo("audio.wav");
        assertThat(((ByteArrayResource) captor.getAllValues().get(1).getBody().getFirst("file")).getFilename())
                .isEqualTo("audio.wav");
    }

    @Test
    @DisplayName("chatCompletionJson: danh sách choices rỗng ném BadRequestException; phân giải String email principal ROLE_ADMIN & kẹp temperature âm")
    @SuppressWarnings("unchecked")
    void chatCompletionJson_emptyChoicesThrowsBadRequestAndResolvesEmailPrincipalWithClampedTemp() {
        when(restTemplate.postForEntity(eq("https://api.groq.com/chat"), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"choices\":[]}"));

        assertThatThrownBy(() -> service.chatCompletionJson("Sys", "Prompt", 0.2, UUID.randomUUID(), false))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("choices rỗng");

        UUID adminId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin@english.test", null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        when(userRepository.findByEmail("admin@english.test"))
                .thenReturn(Optional.of(User.builder().id(adminId).email("admin@english.test").build()));
        when(restTemplate.postForEntity(eq("https://api.groq.com/chat"), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("{\"choices\":[{\"message\":{\"content\":\"{}\"}}]}"));

        service.chatCompletionJson("Sys", "Prompt", -1.0);

        ArgumentCaptor<HttpEntity<Map<String, Object>>> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, times(2)).postForEntity(eq("https://api.groq.com/chat"), entityCaptor.capture(), eq(String.class));
        assertThat(entityCaptor.getAllValues().get(1).getBody().get("temperature")).isEqualTo(0.0);
        verify(aiMonitoringService).checkRateLimitAndQuota(adminId, true);
        verify(aiMonitoringService).recordTokenUsage(eq(adminId), eq("TEACHER"), anyLong(), anyLong(), eq("GROQ"));
    }

    @Test
    @DisplayName("openai/gpt-oss gửi reasoning_effort=low, max_completion_tokens=16384 và fallback sang llama-3.3 khi gặp 400 json_validate_failed")
    @SuppressWarnings("unchecked")
    void chatCompletionJson_configuresGptOssAndFallsBackOnJsonValidateFailed() {
        UUID teacherId = UUID.randomUUID();
        byte[] errBody = "{\"error\":{\"code\":\"json_validate_failed\"}}"
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
        org.springframework.web.client.HttpClientErrorException badReq =
                new org.springframework.web.client.HttpClientErrorException(
                        HttpStatus.BAD_REQUEST, "Bad Request", errBody, java.nio.charset.StandardCharsets.UTF_8);

        when(restTemplate.postForEntity(eq("https://api.groq.com/chat"), any(HttpEntity.class), eq(String.class)))
                .thenThrow(badReq)
                .thenReturn(ResponseEntity.ok("{\"choices\":[{\"message\":{\"content\":\"```json\\n{\\\"questions\\\":[{\\\"prompt\\\":\\\"OK\\\"}]}\\n```\"}}]}"));

        String res = service.chatCompletionJson("Sys", "Prompt", 0.3, teacherId, true);

        assertThat(res).isEqualTo("{\"questions\":[{\"prompt\":\"OK\"}]}");
        verify(aiMonitoringService, times(1)).checkRateLimitAndQuota(teacherId, true);

        ArgumentCaptor<HttpEntity<Map<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate, times(2)).postForEntity(eq("https://api.groq.com/chat"), captor.capture(), eq(String.class));

        Map<String, Object> firstBody = captor.getAllValues().get(0).getBody();
        assertThat(firstBody.get("model")).isEqualTo("openai/gpt-oss-120b");
        assertThat(firstBody.get("reasoning_effort")).isEqualTo("low");
        assertThat(firstBody.get("max_completion_tokens")).isEqualTo(16384);
        assertThat(firstBody).containsKey("response_format");

        Map<String, Object> secondBody = captor.getAllValues().get(1).getBody();
        assertThat(secondBody.get("model")).isEqualTo("llama-3.3-70b-versatile");
        assertThat(secondBody.get("max_tokens")).isEqualTo(8192);
        assertThat(secondBody).doesNotContainKey("response_format");
    }
}
