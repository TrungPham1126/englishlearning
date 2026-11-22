package com.englishlearning.auth.config;

import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.service.CustomUserDetails;
import com.englishlearning.auth.service.JwtService;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.SignatureException;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Collections;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthenticationFilter - Kiểm thử phân tích Bearer token và nạp SecurityContext")
class JwtAuthenticationFilterTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private UserDetailsService userDetailsService;

    @Mock
    private FilterChain filterChain;

    @InjectMocks
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Không có header Authorization -> Bỏ qua xác thực JWT và chuyển tiếp FilterChain")
    void doFilterInternal_whenNoAuthHeader_continuesChainWithoutAuthentication() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(jwtService, userDetailsService);
    }

    @Test
    @DisplayName("Header Authorization không bắt đầu bằng 'Bearer ' -> Bỏ qua và chuyển tiếp")
    void doFilterInternal_whenNonBearerHeader_continuesChainWithoutAuthentication() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/avatar");
        request.addHeader("Authorization", "Basic dXNlcjpwYXNz");
        MockHttpServletResponse response = new MockHttpServletResponse();

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(jwtService, userDetailsService);
    }

    @Test
    @DisplayName("Bearer token hợp lệ và user đang active -> Thiết lập SecurityContextHolder thành công")
    void doFilterInternal_whenValidTokenAndActiveUser_setsSecurityContext() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer valid.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        User activeUser = User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails userDetails = new CustomUserDetails(activeUser);

        when(jwtService.extractUsername("valid.jwt.token")).thenReturn("student@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("student@elp.edu.vn")).thenReturn(userDetails);
        when(jwtService.isTokenValid("valid.jwt.token", userDetails)).thenReturn(true);

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isSameAs(userDetails);
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                .extracting(Object::toString)
                .containsExactly("ROLE_STUDENT");
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Bearer token hợp lệ nhưng user đã bị khóa (isActive = false) -> Từ chối nạp SecurityContext")
    void doFilterInternal_whenUserIsInactive_doesNotAuthenticate() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer still-unexpired.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        User lockedUser = User.builder()
                .id(UUID.randomUUID())
                .email("locked@elp.edu.vn")
                .password("hash")
                .isActive(false)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails lockedDetails = new CustomUserDetails(lockedUser);

        when(jwtService.extractUsername("still-unexpired.jwt.token")).thenReturn("locked@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("locked@elp.edu.vn")).thenReturn(lockedDetails);

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(jwtService, never()).isTokenValid(anyString(), any());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Token không hợp lệ (isTokenValid = false) -> Không nạp SecurityContext")
    void doFilterInternal_whenTokenInvalid_doesNotSetAuthentication() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer mismatched.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        User activeUser = User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of())
                .build();
        UserDetails userDetails = new CustomUserDetails(activeUser);

        when(jwtService.extractUsername("mismatched.jwt.token")).thenReturn("student@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("student@elp.edu.vn")).thenReturn(userDetails);
        when(jwtService.isTokenValid("mismatched.jwt.token", userDetails)).thenReturn(false);

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("SecurityContext đã có Authentication -> Không tải lại UserDetails")
    void doFilterInternal_whenAlreadyAuthenticated_preservesExistingAuthentication() throws Exception {
        // Given
        UsernamePasswordAuthenticationToken existingAuth =
                new UsernamePasswordAuthenticationToken("already@elp.edu.vn", null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(existingAuth);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer valid.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(jwtService.extractUsername("valid.jwt.token")).thenReturn("already@elp.edu.vn");

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isSameAs(existingAuth);
        verifyNoInteractions(userDetailsService);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("extractUsername trả về null -> Bỏ qua loadUserByUsername và tiếp tục FilterChain")
    void doFilterInternal_whenExtractedUsernameIsNull_continuesChain() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer subjectless.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(jwtService.extractUsername("subjectless.jwt.token")).thenReturn(null);

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(userDetailsService);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("JWT hết hạn hoặc sai định dạng -> Bắt ngoại lệ an toàn và vẫn cho qua FilterChain")
    void doFilterInternal_whenJwtExtractionThrowsException_catchesAndContinuesChain() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer expired.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(jwtService.extractUsername("expired.jwt.token"))
                .thenThrow(new ExpiredJwtException(null, null, "JWT expired"));

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Header 'Bearer   ' chỉ chứa khoảng trắng -> Bỏ qua xác thực JWT và tiếp tục FilterChain")
    void doFilterInternal_blankBearerToken_skipsValidationAndContinuesChain() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer    ");
        MockHttpServletResponse response = new MockHttpServletResponse();

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(jwtService, userDetailsService);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Header Bearer có khoảng trắng thừa quanh token -> Trim token và xác thực thành công")
    void doFilterInternal_bearerWithExtraWhitespace_trimsTokenAndAuthenticates() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer   valid.jwt.token  ");
        MockHttpServletResponse response = new MockHttpServletResponse();

        User activeUser = User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails userDetails = new CustomUserDetails(activeUser);

        when(jwtService.extractUsername("valid.jwt.token")).thenReturn("student@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("student@elp.edu.vn")).thenReturn(userDetails);
        when(jwtService.isTokenValid("valid.jwt.token", userDetails)).thenReturn(true);

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isSameAs(userDetails);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("User có enabled = true nhưng accountLocked = true -> Không nạp SecurityContext")
    void doFilterInternal_accountLockedUser_doesNotAuthenticate() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer valid.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        UserDetails lockedUser = org.springframework.security.core.userdetails.User
                .withUsername("locked@elp.edu.vn")
                .password("hash")
                .authorities("ROLE_STUDENT")
                .accountLocked(true)
                .disabled(false)
                .build();

        when(jwtService.extractUsername("valid.jwt.token")).thenReturn("locked@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("locked@elp.edu.vn")).thenReturn(lockedUser);

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(jwtService, never()).isTokenValid(anyString(), any());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("User bị accountExpired hoặc credentialsExpired -> Không nạp SecurityContext")
    void doFilterInternal_accountExpiredOrCredentialsExpired_doesNotAuthenticate() throws Exception {
        // Given: accountExpired = true
        MockHttpServletRequest expiredAccReq = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        expiredAccReq.addHeader("Authorization", "Bearer token-acc-expired");
        MockHttpServletResponse expiredAccResp = new MockHttpServletResponse();

        UserDetails expiredAccountUser = org.springframework.security.core.userdetails.User
                .withUsername("acc-exp@elp.edu.vn")
                .password("hash")
                .authorities("ROLE_STUDENT")
                .accountExpired(true)
                .build();
        when(jwtService.extractUsername("token-acc-expired")).thenReturn("acc-exp@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("acc-exp@elp.edu.vn")).thenReturn(expiredAccountUser);

        // When
        jwtAuthenticationFilter.doFilter(expiredAccReq, expiredAccResp, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(jwtService, never()).isTokenValid(eq("token-acc-expired"), any());

        // Given: credentialsExpired = true
        MockHttpServletRequest expiredCredReq = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        expiredCredReq.addHeader("Authorization", "Bearer token-cred-expired");
        MockHttpServletResponse expiredCredResp = new MockHttpServletResponse();

        UserDetails expiredCredUser = org.springframework.security.core.userdetails.User
                .withUsername("cred-exp@elp.edu.vn")
                .password("hash")
                .authorities("ROLE_STUDENT")
                .credentialsExpired(true)
                .build();
        when(jwtService.extractUsername("token-cred-expired")).thenReturn("cred-exp@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("cred-exp@elp.edu.vn")).thenReturn(expiredCredUser);

        // When
        jwtAuthenticationFilter.doFilter(expiredCredReq, expiredCredResp, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(jwtService, never()).isTokenValid(eq("token-cred-expired"), any());
        verify(filterChain, times(2)).doFilter(any(), any());
    }

    @Test
    @DisplayName("UserDetailsService trả về null -> Bỏ qua an toàn và tiếp tục FilterChain")
    void doFilterInternal_userDetailsServiceReturnsNull_continuesChainWithoutAuthentication() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer valid.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(jwtService.extractUsername("valid.jwt.token")).thenReturn("ghost@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("ghost@elp.edu.vn")).thenReturn(null);

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(jwtService, never()).isTokenValid(anyString(), any());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("User không tồn tại trong DB (UsernameNotFoundException) -> Bắt ngoại lệ và tiếp tục FilterChain")
    void doFilterInternal_userNotFound_catchesAndContinuesChain() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer orphan.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(jwtService.extractUsername("orphan.jwt.token")).thenReturn("deleted@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("deleted@elp.edu.vn"))
                .thenThrow(new UsernameNotFoundException("Không tìm thấy người dùng"));

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Token sai cấu trúc (MalformedJwtException) -> Bắt ngoại lệ và tiếp tục FilterChain")
    void doFilterInternal_malformedJwt_catchesAndContinuesChain() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer bad-token-format");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(jwtService.extractUsername("bad-token-format"))
                .thenThrow(new MalformedJwtException("Malformed JWT"));

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(userDetailsService);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Token bị giả mạo chữ ký (SignatureException) -> Bắt ngoại lệ và tiếp tục FilterChain")
    void doFilterInternal_tamperedJwtSignature_catchesAndContinuesChain() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer tampered.jwt.sig");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(jwtService.extractUsername("tampered.jwt.sig"))
                .thenThrow(new SignatureException("Invalid signature"));

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(userDetailsService);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("isTokenValid ném ExpiredJwtException sau khi tải UserDetails -> Bắt ngoại lệ và tiếp tục FilterChain")
    void doFilterInternal_isTokenValidThrowsExpiredJwtException_catchesAndContinuesChain() throws Exception {
        // Given
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.addHeader("Authorization", "Bearer borderline-expired.jwt.token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        User activeUser = User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails userDetails = new CustomUserDetails(activeUser);

        when(jwtService.extractUsername("borderline-expired.jwt.token")).thenReturn("student@elp.edu.vn");
        when(userDetailsService.loadUserByUsername("student@elp.edu.vn")).thenReturn(userDetails);
        when(jwtService.isTokenValid("borderline-expired.jwt.token", userDetails))
                .thenThrow(new ExpiredJwtException(null, null, "Token expired during validation"));

        // When
        jwtAuthenticationFilter.doFilter(request, response, filterChain);

        // Then
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }
}
