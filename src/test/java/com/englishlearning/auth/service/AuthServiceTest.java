package com.englishlearning.auth.service;

import com.englishlearning.auth.dto.*;
import com.englishlearning.auth.entity.*;
import com.englishlearning.auth.repository.RoleRepository;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.auth.service.impl.AuthServiceImpl;
import com.englishlearning.classroom.entity.ClassLevel;
import com.englishlearning.classroom.entity.ClassStudent;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import com.englishlearning.common.exception.UnauthorizedException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit Test toàn diện cho AuthServiceImpl (login, refresh, logout, register, profile, updateAvatar).
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

    @Mock
    private com.englishlearning.curriculum.service.UserStreakService userStreakService;

    @InjectMocks
    private AuthServiceImpl authService;

    private final List<UUID> createdAvatarUserIds = new ArrayList<>();

    @AfterEach
    void cleanupGeneratedAvatarFiles() throws IOException {
        Path avatarDir = Paths.get("uploads", "avatars");
        if (!createdAvatarUserIds.isEmpty() && Files.exists(avatarDir)) {
            for (UUID uid : createdAvatarUserIds) {
                String prefix = "avatar_" + uid + "_";
                try (Stream<Path> files = Files.list(avatarDir)) {
                    files.filter(p -> p.getFileName().toString().startsWith(prefix))
                            .forEach(p -> {
                                try {
                                    Files.deleteIfExists(p);
                                } catch (IOException ignored) {
                                }
                            });
                }
            }
        }
        createdAvatarUserIds.clear();
    }

    // =========================================================================
    // LOGIN
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
        when(jwtService.getExpirationTime()).thenReturn(1800000L);
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
        assertThat(response.getExpiresIn()).isEqualTo(1800L);
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
    @DisplayName("login: Sử dụng trực tiếp CustomUserDetails từ Authentication principal mà không truy vấn DB lại")
    void login_whenPrincipalIsCustomUserDetails_reusesPrincipalWithoutExtraDbLookup() {
        // Given
        UUID userId = UUID.randomUUID();
        User activeTeacher = User.builder()
                .id(userId)
                .email("teacher@elp.edu.vn")
                .password("hashed")
                .firstName("Lan")
                .lastName("Pham")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        CustomUserDetails principal = new CustomUserDetails(activeTeacher);

        LoginRequest request = LoginRequest.builder()
                .email("teacher@elp.edu.vn")
                .password("Password123!")
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        when(jwtService.generateAccessToken(principal)).thenReturn("teacher.access.jwt");
        when(jwtService.getExpirationTime()).thenReturn(900000L);
        when(refreshTokenService.createRefreshToken(activeTeacher)).thenReturn(
                RefreshToken.builder().token("teacher-refresh-token").user(activeTeacher).build()
        );

        // When
        AuthService.AuthResult result = authService.login(request);

        // Then
        assertThat(result.response().getAccessToken()).isEqualTo("teacher.access.jwt");
        assertThat(result.response().getExpiresIn()).isEqualTo(900L);
        assertThat(result.rawRefreshToken()).isEqualTo("teacher-refresh-token");
        verify(userRepository, never()).findByEmail(anyString());
    }

    @Test
    @DisplayName("login: Ném DisabledException khi tài khoản bị khóa ở tầng AuthenticationManager")
    void login_whenAccountDisabledInAuthManager_throwsDisabledException() {
        // Given
        LoginRequest request = LoginRequest.builder()
                .email("locked@elp.edu.vn")
                .password("Password123!")
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new DisabledException("User account is disabled"));

        // When / Then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(DisabledException.class);

        verify(jwtService, never()).generateAccessToken(any());
        verify(refreshTokenService, never()).createRefreshToken(any());
    }

    @Test
    @DisplayName("login: Ném UnauthorizedException nếu user trả về có isActive = false")
    void login_whenAuthenticatedUserIsInactive_throwsUnauthorizedException() {
        // Given
        User lockedUser = User.builder()
                .id(UUID.randomUUID())
                .email("locked@elp.edu.vn")
                .password("hash")
                .isActive(false)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails lockedPrincipal = new CustomUserDetails(lockedUser);

        LoginRequest request = LoginRequest.builder()
                .email("locked@elp.edu.vn")
                .password("Password123!")
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken(lockedPrincipal, null, lockedPrincipal.getAuthorities()));

        // When / Then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Tài khoản đã bị khóa hoặc vô hiệu hóa");

        verify(jwtService, never()).generateAccessToken(any());
        verify(refreshTokenService, never()).createRefreshToken(any());
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
    // REFRESH TOKEN
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
                .isActive(true)
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
    @DisplayName("refreshToken: Chặn user đã bị khóa (isActive = false) làm mới access token")
    void refreshToken_whenUserIsInactive_throwsUnauthorizedExceptionAndBlocksRotation() {
        // Given
        String tokenStr = "still-valid-token-of-locked-user";
        User lockedUser = User.builder()
                .id(UUID.randomUUID())
                .email("locked@elp.edu.vn")
                .isActive(false)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        RefreshToken token = RefreshToken.builder()
                .token(tokenStr)
                .user(lockedUser)
                .revoked(false)
                .build();

        when(refreshTokenService.verifyExpiration(tokenStr)).thenReturn(token);

        // When / Then
        assertThatThrownBy(() -> authService.refreshToken(tokenStr))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Tài khoản đã bị khóa hoặc vô hiệu hóa");

        verify(refreshTokenService).revokeToken(tokenStr);
        verify(jwtService, never()).generateAccessToken(any());
        verify(refreshTokenService, never()).createRefreshToken(any());
    }

    @Test
    @DisplayName("refreshToken: Chặn an toàn khi token gắn user null")
    void refreshToken_whenTokenUserIsNull_throwsUnauthorizedException() {
        // Given
        String tokenStr = "orphan-refresh-token";
        RefreshToken token = RefreshToken.builder()
                .token(tokenStr)
                .user(null)
                .revoked(false)
                .build();

        when(refreshTokenService.verifyExpiration(tokenStr)).thenReturn(token);

        // When / Then
        assertThatThrownBy(() -> authService.refreshToken(tokenStr))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Tài khoản đã bị khóa hoặc vô hiệu hóa");

        verify(refreshTokenService).revokeToken(tokenStr);
        verify(jwtService, never()).generateAccessToken(any());
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
    // LOGOUT
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
    // REGISTRATION
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
        verify(teacherRepository, never()).save(any());
    }

    @Test
    @DisplayName("register: Khi role = ROLE_TEACHER thì tạo hồ sơ Teacher với specialization mặc định")
    void register_whenRoleIsTeacher_createsTeacherProfile() {
        // Given
        RegistrationRequest request = RegistrationRequest.builder()
                .email("NewTeacher@ELP.EDU.VN ")
                .password("Password@123")
                .firstName("Thu")
                .lastName("Hoang")
                .role(RoleName.ROLE_TEACHER)
                .build();

        Role teacherRole = Role.builder().id(2).name(RoleName.ROLE_TEACHER).build();
        when(userRepository.existsByEmail("newteacher@elp.edu.vn")).thenReturn(false);
        when(roleRepository.findByName(RoleName.ROLE_TEACHER)).thenReturn(Optional.of(teacherRole));
        when(passwordEncoder.encode("Password@123")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        // When
        UserSummaryDto result = authService.register(request);

        // Then
        assertThat(result.getEmail()).isEqualTo("newteacher@elp.edu.vn");
        assertThat(result.getRoles()).containsExactly("ROLE_TEACHER");

        ArgumentCaptor<Teacher> teacherCaptor = ArgumentCaptor.forClass(Teacher.class);
        verify(teacherRepository).save(teacherCaptor.capture());
        assertThat(teacherCaptor.getValue().getSpecialization()).isEqualTo("English Communication");
        assertThat(teacherCaptor.getValue().getYearsOfExperience()).isEqualTo(0);
        verify(studentRepository, never()).save(any());
    }

    @Test
    @DisplayName("register: Khi role = null hoặc ROLE_ADMIN tự đăng ký -> Mặc định gán ROLE_STUDENT")
    void register_whenRoleNull_defaultsToStudent() {
        // Given
        RegistrationRequest request = RegistrationRequest.builder()
                .email("default@elp.edu.vn")
                .password("Password@123")
                .firstName("Binh")
                .lastName("Tran")
                .role(null)
                .build();

        Role studentRole = Role.builder().id(1).name(RoleName.ROLE_STUDENT).build();
        when(userRepository.existsByEmail("default@elp.edu.vn")).thenReturn(false);
        when(roleRepository.findByName(RoleName.ROLE_STUDENT)).thenReturn(Optional.of(studentRole));
        when(passwordEncoder.encode("Password@123")).thenReturn("encoded");

        UUID savedId = UUID.randomUUID();
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(savedId);
            return u;
        });
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(savedId)).thenReturn(Collections.emptyList());
        when(studentRepository.findById(savedId)).thenReturn(Optional.empty());

        // When
        UserSummaryDto result = authService.register(request);

        // Then
        assertThat(result.getRoles()).containsExactly("ROLE_STUDENT");
        verify(studentRepository).save(any(Student.class));
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

    @Test
    @DisplayName("register: Chuẩn hóa chữ hoa + khoảng trắng ở email trước khi kiểm tra trùng lặp")
    void register_whenDuplicateEmailHasDifferentCasingOrSpaces_throwsBadRequestException() {
        // Given
        RegistrationRequest request = RegistrationRequest.builder()
                .email("  EXISTING@ELP.EDU.VN ")
                .password("Password123")
                .build();

        when(userRepository.existsByEmail("existing@elp.edu.vn")).thenReturn(true);

        // When / Then
        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Email đã được sử dụng");
    }

    @Test
    @DisplayName("register: Ném ResourceNotFoundException nếu role không tìm thấy trong DB")
    void register_whenRoleMissingInDb_throwsResourceNotFoundException() {
        // Given
        RegistrationRequest request = RegistrationRequest.builder()
                .email("new@elp.edu.vn")
                .password("Password123")
                .role(RoleName.ROLE_STUDENT)
                .build();

        when(userRepository.existsByEmail("new@elp.edu.vn")).thenReturn(false);
        when(roleRepository.findByName(RoleName.ROLE_STUDENT)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy vai trò: ROLE_STUDENT");
    }

    // =========================================================================
    // PROFILE & AVATAR
    // =========================================================================

    @Test
    @DisplayName("getCurrentUserProfile: Trả về UserSummaryDto và đồng bộ currentLevel theo lớp học active của Student")
    void getCurrentUserProfile_whenStudentEnrolledInClassroom_syncsCurrentLevel() {
        // Given
        UUID userId = UUID.randomUUID();
        User studentUser = User.builder()
                .id(userId)
                .email("student@elp.edu.vn")
                .firstName("An")
                .lastName("Nguyen")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();

        Classroom classroom = Classroom.builder()
                .id(UUID.randomUUID())
                .name("IELTS Intermediate")
                .level(ClassLevel.B1)
                .build();
        ClassStudent enrollment = ClassStudent.builder()
                .id(UUID.randomUUID())
                .classroom(classroom)
                .isActive(true)
                .build();

        Student student = Student.builder()
                .id(userId)
                .user(studentUser)
                .currentLevel("A1")
                .targetCefr("B2")
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(studentUser));
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(userId)).thenReturn(List.of(enrollment));
        when(studentRepository.findById(userId)).thenReturn(Optional.of(student));
        when(userStreakService.getCurrentStreak(userId)).thenReturn(7);

        // When
        UserSummaryDto result = authService.getCurrentUserProfile(userId);

        // Then
        assertThat(result.getCurrentLevel()).isEqualTo("B1");
        assertThat(result.getTargetCefr()).isEqualTo("B2");
        assertThat(result.getCurrentStreak()).isEqualTo(7);

        ArgumentCaptor<Student> studentCaptor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository).save(studentCaptor.capture());
        assertThat(studentCaptor.getValue().getCurrentLevel()).isEqualTo("B1");
    }

    @Test
    @DisplayName("getCurrentUserProfile: Ném ResourceNotFoundException khi userId không tồn tại")
    void getCurrentUserProfile_whenUserNotFound_throwsResourceNotFoundException() {
        // Given
        UUID missingId = UUID.randomUUID();
        when(userRepository.findById(missingId)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> authService.getCurrentUserProfile(missingId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy thông tin tài khoản");
    }

    @Test
    @DisplayName("updateProfile: Cập nhật họ tên, SĐT, avatarUrl của User và targetCefr của Student")
    void updateProfile_whenStudentProvided_updatesUserAndTargetCefr() {
        // Given
        UUID userId = UUID.randomUUID();
        User studentUser = User.builder()
                .id(userId)
                .email("student@elp.edu.vn")
                .firstName("Old")
                .lastName("Name")
                .phone("0900000000")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        Student student = Student.builder()
                .id(userId)
                .user(studentUser)
                .currentLevel(null)
                .targetCefr("B1")
                .build();

        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFirstName("Minh");
        request.setLastName("Nguyen");
        request.setPhone("0912345678");
        request.setAvatarUrl("/uploads/avatars/new.png");
        request.setTargetCefr("C1");

        when(userRepository.findById(userId)).thenReturn(Optional.of(studentUser));
        when(studentRepository.findById(userId)).thenReturn(Optional.of(student));
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(userId)).thenReturn(Collections.emptyList());

        // When
        UserSummaryDto updated = authService.updateProfile(userId, request);

        // Then
        assertThat(updated.getFirstName()).isEqualTo("Minh");
        assertThat(updated.getLastName()).isEqualTo("Nguyen");
        assertThat(updated.getPhone()).isEqualTo("0912345678");
        assertThat(updated.getAvatarUrl()).isEqualTo("/uploads/avatars/new.png");
        assertThat(updated.getTargetCefr()).isEqualTo("C1");

        verify(userRepository).save(studentUser);
        verify(studentRepository).save(student);
    }

    @Test
    @DisplayName("updateProfile: Không truy vấn StudentRepository khi tài khoản là Teacher")
    void updateProfile_whenTeacherProvided_doesNotTouchStudentRepository() {
        // Given
        UUID userId = UUID.randomUUID();
        User teacherUser = User.builder()
                .id(userId)
                .email("teacher@elp.edu.vn")
                .firstName("Old")
                .lastName("Teacher")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();

        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFirstName("Updated");

        when(userRepository.findById(userId)).thenReturn(Optional.of(teacherUser));

        // When
        UserSummaryDto updated = authService.updateProfile(userId, request);

        // Then
        assertThat(updated.getFirstName()).isEqualTo("Updated");
        assertThat(updated.getLastName()).isEqualTo("Teacher");
        verify(userRepository).save(teacherUser);
        verifyNoInteractions(studentRepository);
    }

    @Test
    @DisplayName("updateProfile: Ném ResourceNotFoundException khi userId không tồn tại")
    void updateProfile_whenUserNotFound_throwsResourceNotFoundException() {
        // Given
        UUID missingId = UUID.randomUUID();
        when(userRepository.findById(missingId)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> authService.updateProfile(missingId, new UpdateProfileRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("updateAvatar: Lưu file ảnh hợp lệ, cập nhật avatarUrl và trả về UserSummaryDto")
    void updateAvatar_whenValidImageFile_savesFileAndUpdatesUser() {
        // Given
        UUID userId = UUID.randomUUID();
        createdAvatarUserIds.add(userId);
        User teacher = User.builder()
                .id(userId)
                .email("teacher@elp.edu.vn")
                .firstName("Hoa")
                .lastName("Le")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();

        MockMultipartFile validPng = new MockMultipartFile(
                "file",
                "portrait.PNG",
                "IMAGE/PNG",
                new byte[]{1, 2, 3, 4, 5}
        );

        when(userRepository.findById(userId)).thenReturn(Optional.of(teacher));

        // When
        UserSummaryDto dto = authService.updateAvatar(userId, validPng);

        // Then
        assertThat(dto.getAvatarUrl()).startsWith("/uploads/avatars/avatar_" + userId + "_").endsWith(".png");
        verify(userRepository).save(teacher);
    }

    @Test
    @DisplayName("updateAvatar: Từ chối khi file null hoặc rỗng (0 byte)")
    void updateAvatar_whenFileNullOrEmpty_throwsBadRequestException() {
        // Given
        UUID userId = UUID.randomUUID();
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);

        // When / Then
        assertThatThrownBy(() -> authService.updateAvatar(userId, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Vui lòng chọn file ảnh hợp lệ");

        assertThatThrownBy(() -> authService.updateAvatar(userId, emptyFile))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Vui lòng chọn file ảnh hợp lệ");

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("updateAvatar: Từ chối khi Content-Type không phải ảnh (application/pdf)")
    void updateAvatar_whenInvalidContentType_throwsBadRequestException() {
        // Given
        UUID userId = UUID.randomUUID();
        MockMultipartFile pdfFile = new MockMultipartFile("file", "doc.pdf", "application/pdf", "pdf-bytes".getBytes());

        // When / Then
        assertThatThrownBy(() -> authService.updateAvatar(userId, pdfFile))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Chỉ chấp nhận các định dạng file ảnh (JPEG, PNG, WEBP, GIF)");

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("updateAvatar: Từ chối khi kích thước ảnh vượt quá 5MB")
    void updateAvatar_whenFileExceeds5MB_throwsBadRequestException() {
        // Given
        UUID userId = UUID.randomUUID();
        byte[] oversized = new byte[5 * 1024 * 1024 + 1];
        MockMultipartFile oversizedFile = new MockMultipartFile("file", "big.jpg", "image/jpeg", oversized);

        // When / Then
        assertThatThrownBy(() -> authService.updateAvatar(userId, oversizedFile))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Dung lượng ảnh tối đa là 5MB");

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("updateAvatar: Ném ResourceNotFoundException khi không tìm thấy user")
    void updateAvatar_whenUserNotFound_throwsResourceNotFoundException() {
        // Given
        UUID missingId = UUID.randomUUID();
        MockMultipartFile validFile = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[]{1, 2});
        when(userRepository.findById(missingId)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> authService.updateAvatar(missingId, validFile))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy thông tin tài khoản");
    }

    @Test
    @DisplayName("register: Yêu cầu ROLE_ADMIN tự đăng ký phải bị hạ về ROLE_STUDENT và tạo hồ sơ Student")
    void register_adminRoleRequested_defaultsToStudentRole() {
        // Given
        RegistrationRequest request = RegistrationRequest.builder()
                .email("attacker@elp.edu.vn")
                .password("Password@123")
                .firstName("Hack")
                .lastName("Attempt")
                .role(RoleName.ROLE_ADMIN)
                .build();

        Role studentRole = Role.builder().id(1).name(RoleName.ROLE_STUDENT).build();
        when(userRepository.existsByEmail("attacker@elp.edu.vn")).thenReturn(false);
        when(roleRepository.findByName(RoleName.ROLE_STUDENT)).thenReturn(Optional.of(studentRole));
        when(passwordEncoder.encode("Password@123")).thenReturn("encoded-pass");

        UUID savedId = UUID.randomUUID();
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(savedId);
            return u;
        });
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(savedId)).thenReturn(Collections.emptyList());
        when(studentRepository.findById(savedId)).thenReturn(Optional.empty());

        // When
        UserSummaryDto result = authService.register(request);

        // Then
        assertThat(result.getRoles()).containsExactly("ROLE_STUDENT");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getRoles())
                .extracting(Role::getName)
                .containsExactly(RoleName.ROLE_STUDENT);

        ArgumentCaptor<Student> studentCaptor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository).save(studentCaptor.capture());
        assertThat(studentCaptor.getValue().getCurrentLevel()).isEqualTo("A1");
        assertThat(studentCaptor.getValue().getTargetCefr()).isEqualTo("B2");
        verify(teacherRepository, never()).save(any());
    }

    @Test
    @DisplayName("register: Request null hoặc email rỗng phải ném BadRequestException")
    void register_nullOrBlankEmail_throwsBadRequestException() {
        // Given
        RegistrationRequest blankEmailRequest = RegistrationRequest.builder()
                .email("   ")
                .password("Password@123")
                .build();

        // When & Then
        assertThatThrownBy(() -> authService.register(null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Email không được để trống");
        assertThatThrownBy(() -> authService.register(blankEmailRequest))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Email không được để trống");

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("login: Chuẩn hóa chữ hoa và khoảng trắng ở email trước khi xác thực AuthenticationManager")
    void login_emailWithUppercaseAndSpaces_normalizesBeforeAuthenticating() {
        // Given
        LoginRequest request = LoginRequest.builder()
                .email("  Student@ELP.EDU.VN ")
                .password("Password123!")
                .build();

        UUID userId = UUID.randomUUID();
        User activeUser = User.builder()
                .id(userId)
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        CustomUserDetails principal = new CustomUserDetails(activeUser);

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        when(jwtService.generateAccessToken(principal)).thenReturn("normalized.access.token");
        when(jwtService.getExpirationTime()).thenReturn(1800000L);
        when(refreshTokenService.createRefreshToken(activeUser))
                .thenReturn(RefreshToken.builder().token("refresh-token").user(activeUser).build());

        // When
        AuthService.AuthResult result = authService.login(request);

        // Then
        assertThat(result.response().getAccessToken()).isEqualTo("normalized.access.token");
        ArgumentCaptor<UsernamePasswordAuthenticationToken> authCaptor =
                ArgumentCaptor.forClass(UsernamePasswordAuthenticationToken.class);
        verify(authenticationManager).authenticate(authCaptor.capture());
        assertThat(authCaptor.getValue().getPrincipal()).isEqualTo("student@elp.edu.vn");
    }

    @Test
    @DisplayName("login: Principal là UserDetails chuẩn (không phải CustomUserDetails) vẫn tra DB theo email chuẩn hóa")
    void login_standardUserDetailsPrincipal_loadsUserAndReturnsTokens() {
        // Given
        LoginRequest request = LoginRequest.builder()
                .email("teacher@elp.edu.vn")
                .password("Password123!")
                .build();

        UserDetails standardPrincipal = new org.springframework.security.core.userdetails.User(
                "  Teacher@ELP.EDU.VN ",
                "hash",
                List.of()
        );
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .email("teacher@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken(standardPrincipal, null, standardPrincipal.getAuthorities()));
        when(userRepository.findByEmail("teacher@elp.edu.vn")).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(any(UserDetails.class))).thenReturn("teacher.jwt.token");
        when(jwtService.getExpirationTime()).thenReturn(1800000L);
        when(refreshTokenService.createRefreshToken(user))
                .thenReturn(RefreshToken.builder().token("teacher-refresh").user(user).build());

        // When
        AuthService.AuthResult result = authService.login(request);

        // Then
        assertThat(result.response().getAccessToken()).isEqualTo("teacher.jwt.token");
        assertThat(result.rawRefreshToken()).isEqualTo("teacher-refresh");
        verify(userRepository).findByEmail("teacher@elp.edu.vn");
    }

    @Test
    @DisplayName("login: Tài khoản có isActive = null bị chặn bằng UnauthorizedException")
    void login_userWithNullIsActive_throwsUnauthorizedException() {
        // Given
        User nullActiveUser = User.builder()
                .id(UUID.randomUUID())
                .email("null-active@elp.edu.vn")
                .password("hash")
                .isActive(null)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        CustomUserDetails principal = new CustomUserDetails(nullActiveUser);

        LoginRequest request = LoginRequest.builder()
                .email("null-active@elp.edu.vn")
                .password("Password123!")
                .build();

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));

        // When & Then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Tài khoản đã bị khóa hoặc vô hiệu hóa");

        verify(jwtService, never()).generateAccessToken(any());
        verify(refreshTokenService, never()).createRefreshToken(any());
    }

    @Test
    @DisplayName("login: Ném LockedException khi tài khoản bị khóa ở tầng AuthenticationManager")
    void login_accountLockedInAuthManager_throwsLockedException() {
        // Given
        LoginRequest request = LoginRequest.builder()
                .email("locked@elp.edu.vn")
                .password("Password123!")
                .build();
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new LockedException("User account is locked"));

        // When & Then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(LockedException.class)
                .hasMessage("User account is locked");

        verify(jwtService, never()).generateAccessToken(any());
        verify(refreshTokenService, never()).createRefreshToken(any());
    }

    @Test
    @DisplayName("refreshToken: Token đã bị thu hồi ném UnauthorizedException và không xoay vòng token")
    void refreshToken_revokedToken_throwsUnauthorizedException() {
        // Given
        String revokedToken = "revoked-token-string";
        when(refreshTokenService.verifyExpiration(revokedToken))
                .thenThrow(new UnauthorizedException("Refresh token đã bị thu hồi"));

        // When & Then
        assertThatThrownBy(() -> authService.refreshToken(revokedToken))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token đã bị thu hồi");

        verify(jwtService, never()).generateAccessToken(any());
        verify(refreshTokenService, never()).createRefreshToken(any());
    }

    @Test
    @DisplayName("refreshToken: Cấu hình @Transactional(noRollbackFor = UnauthorizedException.class) để giữ thao tác thu hồi/xóa token")
    void refreshToken_hasNoRollbackForUnauthorizedExceptionAnnotation() throws NoSuchMethodException {
        // Given
        Method method = AuthServiceImpl.class.getMethod("refreshToken", String.class);
        Transactional transactional = method.getAnnotation(Transactional.class);

        // Then
        assertThat(transactional).isNotNull();
        assertThat(transactional.noRollbackFor()).contains(UnauthorizedException.class);
    }

    @Test
    @DisplayName("getCurrentUserProfile: Student không còn lớp active nhưng vẫn còn currentLevel cũ thì đồng bộ về null")
    void getCurrentUserProfile_studentWithNoEnrollmentAndExistingLevel_clearsCurrentLevel() {
        // Given
        UUID userId = UUID.randomUUID();
        User studentUser = User.builder()
                .id(userId)
                .email("student@elp.edu.vn")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        Student student = Student.builder()
                .id(userId)
                .user(studentUser)
                .currentLevel("B1")
                .targetCefr("C1")
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(studentUser));
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(userId)).thenReturn(Collections.emptyList());
        when(studentRepository.findById(userId)).thenReturn(Optional.of(student));
        when(userStreakService.getCurrentStreak(userId)).thenReturn(3);

        // When
        UserSummaryDto result = authService.getCurrentUserProfile(userId);

        // Then
        assertThat(result.getCurrentLevel()).isNull();
        assertThat(result.getTargetCefr()).isEqualTo("C1");

        ArgumentCaptor<Student> studentCaptor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository).save(studentCaptor.capture());
        assertThat(studentCaptor.getValue().getCurrentLevel()).isNull();
    }

    @Test
    @DisplayName("getCurrentUserProfile: Student đã khớp currentLevel với lớp học active thì không ghi lại DB")
    void getCurrentUserProfile_studentWithMatchingClassroomLevel_doesNotSaveStudentAgain() {
        // Given
        UUID userId = UUID.randomUUID();
        User studentUser = User.builder()
                .id(userId)
                .email("student@elp.edu.vn")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        Classroom classroom = Classroom.builder()
                .id(UUID.randomUUID())
                .name("IELTS Foundation")
                .level(ClassLevel.B1)
                .build();
        ClassStudent enrollment = ClassStudent.builder()
                .id(UUID.randomUUID())
                .classroom(classroom)
                .isActive(true)
                .build();
        Student student = Student.builder()
                .id(userId)
                .user(studentUser)
                .currentLevel("B1")
                .targetCefr("B2")
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(studentUser));
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(userId)).thenReturn(List.of(enrollment));
        when(studentRepository.findById(userId)).thenReturn(Optional.of(student));
        when(userStreakService.getCurrentStreak(userId)).thenReturn(5);

        // When
        UserSummaryDto result = authService.getCurrentUserProfile(userId);

        // Then
        assertThat(result.getCurrentLevel()).isEqualTo("B1");
        assertThat(result.getIsActive()).isTrue();
        verify(studentRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateProfile: Giữ nguyên các trường cũ khi request chỉ cập nhật một phần (các field còn lại null)")
    void updateProfile_partialNullFields_preservesExistingValues() {
        // Given
        UUID userId = UUID.randomUUID();
        User studentUser = User.builder()
                .id(userId)
                .email("student@elp.edu.vn")
                .firstName("OriginalFirst")
                .lastName("OriginalLast")
                .phone("0901234567")
                .avatarUrl("/uploads/avatars/existing.png")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        Student student = Student.builder()
                .id(userId)
                .user(studentUser)
                .currentLevel(null)
                .targetCefr("B2")
                .build();

        UpdateProfileRequest partialRequest = new UpdateProfileRequest();
        partialRequest.setFirstName("NewFirst");

        when(userRepository.findById(userId)).thenReturn(Optional.of(studentUser));
        when(studentRepository.findById(userId)).thenReturn(Optional.of(student));
        when(classStudentRepository.findActiveEnrollmentsWithClassroom(userId)).thenReturn(Collections.emptyList());

        // When
        UserSummaryDto updated = authService.updateProfile(userId, partialRequest);

        // Then
        assertThat(updated.getFirstName()).isEqualTo("NewFirst");
        assertThat(updated.getLastName()).isEqualTo("OriginalLast");
        assertThat(updated.getPhone()).isEqualTo("0901234567");
        assertThat(updated.getAvatarUrl()).isEqualTo("/uploads/avatars/existing.png");
        assertThat(updated.getTargetCefr()).isEqualTo("B2");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getLastName()).isEqualTo("OriginalLast");
    }

    @Test
    @DisplayName("updateAvatar: Từ chối SVG (image/svg+xml) để ngăn Stored XSS")
    void updateAvatar_svgContentType_throwsBadRequestException() {
        // Given
        UUID userId = UUID.randomUUID();
        MockMultipartFile svgFile = new MockMultipartFile(
                "file",
                "xss.svg",
                "image/svg+xml",
                "<svg onload='alert(1)'/>".getBytes()
        );

        // When & Then
        assertThatThrownBy(() -> authService.updateAvatar(userId, svgFile))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Chỉ chấp nhận các định dạng file ảnh (JPEG, PNG, WEBP, GIF)");

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("updateAvatar: Từ chối tên file chứa path traversal hoặc phần mở rộng nguy hiểm")
    void updateAvatar_pathTraversalOrDisallowedExtension_throwsBadRequestException() {
        // Given
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .email("teacher@elp.edu.vn")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        MockMultipartFile traversalFile = new MockMultipartFile(
                "file",
                "../../evil.png",
                "image/png",
                new byte[]{1, 2, 3}
        );
        MockMultipartFile disguisedScriptFile = new MockMultipartFile(
                "file",
                "shell.jsp",
                "image/png",
                new byte[]{1, 2, 3}
        );

        // When & Then
        assertThatThrownBy(() -> authService.updateAvatar(userId, traversalFile))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Tên file ảnh không hợp lệ");
        assertThatThrownBy(() -> authService.updateAvatar(userId, disguisedScriptFile))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Chỉ chấp nhận các định dạng file ảnh (JPEG, PNG, WEBP, GIF)");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateAvatar: Tên file không có phần mở rộng phải suy ra đúng đuôi từ Content-Type")
    void updateAvatar_filenameWithoutExtension_derivesExtensionFromContentType() {
        // Given
        UUID userId = UUID.randomUUID();
        createdAvatarUserIds.add(userId);
        User teacher = User.builder()
                .id(userId)
                .email("teacher@elp.edu.vn")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        MockMultipartFile noExtWebp = new MockMultipartFile(
                "file",
                "avatar",
                "image/webp",
                new byte[]{1, 2, 3, 4}
        );
        when(userRepository.findById(userId)).thenReturn(Optional.of(teacher));

        // When
        UserSummaryDto dto = authService.updateAvatar(userId, noExtWebp);

        // Then
        assertThat(dto.getAvatarUrl()).startsWith("/uploads/avatars/avatar_" + userId + "_").endsWith(".webp");
        verify(userRepository).save(teacher);
    }

    @Test
    @DisplayName("updateAvatar: Ném RuntimeException khi ghi file gặp IOException")
    void updateAvatar_ioExceptionWhileCopying_throwsRuntimeException() {
        // Given
        UUID userId = UUID.randomUUID();
        User teacher = User.builder()
                .id(userId)
                .email("teacher@elp.edu.vn")
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        MockMultipartFile failingFile = new MockMultipartFile("file", "avatar.png", "image/png", new byte[]{1, 2, 3}) {
            @Override
            public InputStream getInputStream() throws IOException {
                throw new IOException("Disk full");
            }
        };
        when(userRepository.findById(userId)).thenReturn(Optional.of(teacher));

        // When & Then
        assertThatThrownBy(() -> authService.updateAvatar(userId, failingFile))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Không thể lưu file ảnh");

        verify(userRepository, never()).save(any());
    }
}
