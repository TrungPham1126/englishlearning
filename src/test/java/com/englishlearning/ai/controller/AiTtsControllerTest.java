package com.englishlearning.ai.controller;

import com.englishlearning.ai.dto.TtsRequest;
import com.englishlearning.ai.dto.TtsResponse;
import com.englishlearning.ai.service.KokoroTtsClientService;
import com.englishlearning.assignment.dto.ExerciseAudioResponseDto;
import com.englishlearning.assignment.dto.KokoroVoiceDto;
import com.englishlearning.assignment.entity.AudioGenerationStatus;
import com.englishlearning.assignment.service.ExerciseAudioService;
import com.englishlearning.auth.config.JwtAuthenticationEntryPoint;
import com.englishlearning.auth.config.JwtAuthenticationFilter;
import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import com.englishlearning.common.config.SecurityConfig;
import com.englishlearning.common.exception.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AiTtsController.class)
@AutoConfigureMockMvc
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, GlobalExceptionHandler.class})
@DisplayName("AiTtsController - Tổng hợp TTS, Khôi phục Audio & Danh mục giọng Kokoro")
class AiTtsControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private ExerciseAudioService exerciseAudioService;
    @MockBean private KokoroTtsClientService kokoroTtsClientService;
    @MockBean private JwtService jwtService;
    @MockBean private UserDetailsService userDetailsService;
    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;

    private final UUID studentId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID teacherId = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @BeforeEach
    void setUp() throws Exception {
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(), any(), any());
    }

    private CustomUserDetails userWithRole(UUID id, RoleName roleName) {
        User u = User.builder()
                .id(id)
                .email(roleName.name().toLowerCase() + "@english.test")
                .password("pwd")
                .isActive(true)
                .roles(Set.of(Role.builder().name(roleName).build()))
                .build();
        return new CustomUserDetails(u);
    }

    @Test
    @DisplayName("POST /api/v1/ai/tts: chặn 401 khi chưa đăng nhập, trả 400 BadRequest khi text rỗng, trả 200 khi hợp lệ")
    void synthesizeSpeech_validatesTextAndReturnsAudio() throws Exception {
        mockMvc.perform(post("/api/v1/ai/tts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Hello\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/ai/tts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"   \"}")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Nội dung câu mẫu cần tạo âm thanh (text) không được để trống."));

        mockMvc.perform(post("/api/v1/ai/tts")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(kokoroTtsClientService);

        TtsRequest validReq = TtsRequest.builder().text("Practice daily").voice("af_heart").speed(1.0).build();
        TtsResponse res = TtsResponse.builder()
                .audioUrl("https://cdn.test/tts.wav").voice("af_heart").speed(1.0).durationSeconds(1.8).cached(false).build();
        when(kokoroTtsClientService.synthesizeSpeech(validReq)).thenReturn(res);

        mockMvc.perform(post("/api/v1/ai/tts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validReq))
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.audioUrl").value("https://cdn.test/tts.wav"));
    }

    @Test
    @DisplayName("POST /questions/{questionId}/repair: phân biệt STUDENT vs TEACHER và truyền customText/voice")
    void repairQuestionAudio_passesRoleFlagAndCustomParams() throws Exception {
        UUID questionId = UUID.randomUUID();
        ExerciseAudioResponseDto dto = ExerciseAudioResponseDto.builder()
                .questionId(questionId)
                .status(AudioGenerationStatus.READY)
                .url("https://cdn.test/repaired.wav")
                .build();

        when(exerciseAudioService.repairAudio(questionId, studentId, true, "Speak clearly.", "bm_george"))
                .thenReturn(dto);

        mockMvc.perform(post("/api/v1/ai/tts/questions/{questionId}/repair", questionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"  Speak clearly. \",\"voice\":\" bm_george \"}")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.url").value("https://cdn.test/repaired.wav"));

        when(exerciseAudioService.repairAudio(questionId, teacherId, false, null, null)).thenReturn(dto);

        mockMvc.perform(post("/api/v1/ai/tts/questions/{questionId}/repair", questionId)
                        .with(user(userWithRole(teacherId, RoleName.ROLE_TEACHER))))
                .andExpect(status().isOk());

        verify(exerciseAudioService).repairAudio(questionId, studentId, true, "Speak clearly.", "bm_george");
        verify(exerciseAudioService).repairAudio(questionId, teacherId, false, null, null);
    }

    @Test
    @DisplayName("GET /questions/{questionId}/status & /voices trả về đúng trạng thái audio và danh sách giọng Kokoro")
    void statusAndVoices_returnExpectedPayloads() throws Exception {
        UUID questionId = UUID.randomUUID();
        when(exerciseAudioService.getAudioStatus(questionId))
                .thenReturn(ExerciseAudioResponseDto.builder()
                        .questionId(questionId)
                        .status(AudioGenerationStatus.PROCESSING)
                        .build());

        mockMvc.perform(get("/api/v1/ai/tts/questions/{questionId}/status", questionId)
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"));

        when(exerciseAudioService.getKokoroVoices())
                .thenReturn(List.of(
                        KokoroVoiceDto.builder().id("af_heart").name("Heart").accent("US").isDefault(true).build()));

        mockMvc.perform(get("/api/v1/ai/tts/voices")
                        .with(user(userWithRole(studentId, RoleName.ROLE_STUDENT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value("af_heart"));
    }
}
