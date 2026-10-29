package com.englishlearning.auth.service;

import com.englishlearning.auth.dto.AuthResponse;
import com.englishlearning.auth.dto.LoginRequest;
import com.englishlearning.auth.dto.RegistrationRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.entity.*;
import com.englishlearning.auth.repository.RoleRepository;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.auth.service.impl.AuthServiceImpl;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.UnauthorizedException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Collections;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit Test cho Tầng Xác thực & Quản lý phiên người dùng (UC_AUTH_01)
 * Tuân thủ JUnit 5, Mockito, AssertJ, no-logic-in-tests, cleanly-create-test-data.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private StudentRepository studentRepository;

    @Mock
    private TeacherRepository teacherRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private ClassStudentRepository classStudentRepository;

    @InjectMocks
    private AuthServiceImpl authService;

    // =========================================================================
    // UC_AUTH_01: ĐĂNG NHẬP VÀ PHÁT HÀNH CẶP TOKEN (LOGIN)
    // =========================================================================

    @Test
    @DisplayName("should_AuthenticateAndReturnTokens_when_CredentialsAreValid: Cấp phát Access Token và Refresh Token khi đăng nhập đúng")
    void should_AuthenticateAndReturnTokens_when_CredentialsAreValid() {
        // Given
        String email = "learner@elp.edu.vn";
        String rawPassword = "SecurePassword123";
        LoginRequest request = LoginRequest.builder()
                .email(email)
                .password(rawPassword)
                .build();

        UUID userId = UUID.randomUUID();
        Role studentRole = Role.builder().name(RoleName.ROLE_STUDENT).build();
        User user = User.builder()
                .id(userId)
                .email(email)
                .password("$2a$10$hashedPasswordValue")
                .firstName("Nam")
                .lastName("Nguyen")
                .isActive(true)
                .roles(Set.of(studentRole))
                .build();

        RefreshToken refreshToken = RefreshToken.builder()
                .id(UUID.randomUUID())
                .token("uuid-refresh-token-valid-string")
                .user(user)
                .expiryDate(Instant.now().plusSeconds(604800))
                .revoked(false)
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken(email, rawPassword));
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(any(UserDetails.class))).thenReturn("header.payload.access-token-signature");
        when(jwtService.getExpirationTime()).thenReturn(1800000L); // 30 phút
        when(refreshTokenService.createRefreshToken(user)).thenReturn(refreshToken);
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(userId)).thenReturn(Collections.emptyList());
        when(studentRepository.findById(userId)).thenReturn(Optional.empty());

        // When
        AuthService.AuthResult result = authService.login(request);

        // Then
        assertThat(result).isNotNull();
        AuthResponse response = result.response();
        assertThat(response.getAccessToken()).isEqualTo("header.payload.access-token-signature");
        assertThat(response.getTokenType()).isEqualTo("Bearer");
        assertThat(response.getExpiresIn()).isEqualTo(1800L); // 1800000 / 1000 = 1800 giây
        assertThat(result.rawRefreshToken()).isEqualTo("uuid-refresh-token-valid-string");

        UserSummaryDto userSummary = response.getUser();
        assertThat(userSummary.getId()).isEqualTo(userId);
        assertThat(userSummary.getEmail()).isEqualTo(email);
        assertThat(userSummary.getRoles()).containsExactly("ROLE_STUDENT");

        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(userRepository).findByEmail(email);
        verify(jwtService).generateAccessToken(any(UserDetails.class));
        verify(refreshTokenService).createRefreshToken(user);
    }

    @Test
    @DisplayName("should_ThrowBadCredentialsException_when_PasswordIsIncorrect: Ném lỗi BadCredentialsException khi sai mật khẩu")
    void should_ThrowBadCredentialsException_when_PasswordIsIncorrect() {
        // Given
        LoginRequest request = LoginRequest.builder()
                .email("learner@elp.edu.vn")
                .password("WrongPassword")
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Tài khoản hoặc mật khẩu không chính xác"));

        // When / Then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Tài khoản hoặc mật khẩu không chính xác");

        verify(userRepository, never()).findByEmail(anyString());
        verify(jwtService, never()).generateAccessToken(any());
        verify(refreshTokenService, never()).createRefreshToken(any());
    }

    @Test
    @DisplayName("should_ThrowBadRequestException_when_UserNotFoundAfterAuthentication: Báo lỗi khi xác thực thành công nhưng không tìm thấy User")
    void should_ThrowBadRequestException_when_UserNotFoundAfterAuthentication() {
        // Given
        LoginRequest request = LoginRequest.builder()
                .email("ghost@elp.edu.vn")
                .password("Password123")
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Email hoặc mật khẩu không chính xác");

        verify(jwtService, never()).generateAccessToken(any());
        verify(refreshTokenService, never()).createRefreshToken(any());
    }

    // =========================================================================
    // UC_AUTH_01: LÀM MỚI TOKEN VÀ REFRESH TOKEN ROTATION
    // =========================================================================

    @Test
    @DisplayName("should_RotateRefreshTokenSuccessfully_when_RefreshTokenIsValid: Thu hồi Refresh Token cũ và phát hành cặp token mới")
    void should_RotateRefreshTokenSuccessfully_when_RefreshTokenIsValid() {
        // Given
        String oldRefreshTokenString = "valid-old-refresh-token";
        UUID userId = UUID.randomUUID();
        Role teacherRole = Role.builder().name(RoleName.ROLE_TEACHER).build();
        User user = User.builder()
                .id(userId)
                .email("teacher@elp.edu.vn")
                .firstName("Huong")
                .lastName("Tran")
                .roles(Set.of(teacherRole))
                .build();

        RefreshToken oldToken = RefreshToken.builder()
                .token(oldRefreshTokenString)
                .user(user)
                .revoked(false)
                .build();

        RefreshToken newRotatedToken = RefreshToken.builder()
                .token("new-rotated-refresh-token-uuid")
                .user(user)
                .revoked(false)
                .build();

        when(refreshTokenService.verifyExpiration(oldRefreshTokenString)).thenReturn(oldToken);
        when(jwtService.generateAccessToken(any(UserDetails.class))).thenReturn("new.access.token.jwt");
        when(jwtService.getExpirationTime()).thenReturn(1800000L);
        when(refreshTokenService.createRefreshToken(user)).thenReturn(newRotatedToken);

        // When
        AuthService.AuthResult result = authService.refreshToken(oldRefreshTokenString);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.response().getAccessToken()).isEqualTo("new.access.token.jwt");
        assertThat(result.rawRefreshToken()).isEqualTo("new-rotated-refresh-token-uuid");
        assertThat(result.response().getUser().getEmail()).isEqualTo("teacher@elp.edu.vn");

        verify(refreshTokenService).verifyExpiration(oldRefreshTokenString);
        verify(refreshTokenService).createRefreshToken(user);
    }

    @Test
    @DisplayName("should_ThrowTokenExpiredException_when_RefreshTokenExpiredOrRevoked: Chặn làm mới khi token đã hết hạn hoặc bị thu hồi")
    void should_ThrowTokenExpiredException_when_RefreshTokenExpiredOrRevoked() {
        // Given
        String invalidRefreshToken = "expired-or-revoked-token-string";
        when(refreshTokenService.verifyExpiration(invalidRefreshToken))
                .thenThrow(new UnauthorizedException("Refresh token đã hết hạn. Vui lòng đăng nhập lại"));

        // When / Then
        assertThatThrownBy(() -> authService.refreshToken(invalidRefreshToken))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token đã hết hạn. Vui lòng đăng nhập lại");

        verify(jwtService, never()).generateAccessToken(any());
        verify(refreshTokenService, never()).createRefreshToken(any());
    }

    // =========================================================================
    // UC_AUTH_01: ĐĂNG XUẤT VÀ THU HỒI TOKEN (LOGOUT & BLACKLIST)
    // =========================================================================

    @Test
    @DisplayName("should_BlacklistTokenAndClearSession_when_UserLogsOut: Thu hồi Refresh Token khi người dùng đăng xuất")
    void should_BlacklistTokenAndClearSession_when_UserLogsOut() {
        // Given
        String tokenToRevoke = "active-session-refresh-token";

        // When
        authService.logout(tokenToRevoke);

        // Then
        verify(refreshTokenService).revokeToken(tokenToRevoke);
    }

    @Test
    @DisplayName("should_DoNothing_when_LogoutWithNullOrBlankToken: Không thực thi khi token đăng xuất rỗng")
    void should_DoNothing_when_LogoutWithNullOrBlankToken() {
        // When
        authService.logout(null);
        authService.logout("   ");

        // Then
        verify(refreshTokenService, never()).revokeToken(anyString());
    }

    // =========================================================================
    // UC_AUTH_01: ĐĂNG KÝ HỌC VIÊN MỚI (REGISTRATION)
    // =========================================================================

    @Test
    @DisplayName("should_RegisterNewStudent_when_ValidRegistrationRequest: Đăng ký thành công học viên mới với level A1 và target B2")
    void should_RegisterNewStudent_when_ValidRegistrationRequest() {
        // Given
        RegistrationRequest request = RegistrationRequest.builder()
                .email("newstudent@elp.edu.vn")
                .password("Password@123")
                .firstName("Minh")
                .lastName("Le")
                .phone("0987654321")
                .role(RoleName.ROLE_STUDENT)
                .build();

        Role studentRole = Role.builder().id(1).name(RoleName.ROLE_STUDENT).build();
        when(userRepository.existsByEmail("newstudent@elp.edu.vn")).thenReturn(false);
        when(roleRepository.findByName(RoleName.ROLE_STUDENT)).thenReturn(Optional.of(studentRole));
        when(passwordEncoder.encode("Password@123")).thenReturn("$2a$10$encodedPasswordHash");

        User savedUser = User.builder()
                .id(UUID.randomUUID())
                .email("newstudent@elp.edu.vn")
                .firstName("Minh")
                .lastName("Le")
                .phone("0987654321")
                .roles(Set.of(studentRole))
                .isActive(true)
                .build();
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(savedUser.getId())).thenReturn(Collections.emptyList());
        when(studentRepository.findById(savedUser.getId())).thenReturn(Optional.empty());

        // When
        UserSummaryDto result = authService.register(request);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getEmail()).isEqualTo("newstudent@elp.edu.vn");
        assertThat(result.getRoles()).containsExactly("ROLE_STUDENT");

        ArgumentCaptor<Student> studentCaptor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository).save(studentCaptor.capture());
        Student createdStudent = studentCaptor.getValue();
        assertThat(createdStudent.getCurrentLevel()).isEqualTo("A1");
        assertThat(createdStudent.getTargetCefr()).isEqualTo("B2");
    }

    @Test
    @DisplayName("should_ThrowBadRequestException_when_EmailAlreadyInUse: Ném BadRequestException khi email đã tồn tại")
    void should_ThrowBadRequestException_when_EmailAlreadyInUse() {
        // Given
        RegistrationRequest request = RegistrationRequest.builder()
                .email("existing@elp.edu.vn")
                .password("Password123")
                .build();

        when(userRepository.existsByEmail("existing@elp.edu.vn")).thenReturn(true);

        // When / Then
        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Email đã được sử dụng: existing@elp.edu.vn");

        verify(userRepository, never()).save(any());
        verify(studentRepository, never()).save(any());
    }
}
