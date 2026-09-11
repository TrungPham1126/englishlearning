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
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final AuthenticationManager authenticationManager;

    @Transactional
    public UserSummaryDto register(RegistrationRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email đã được sử dụng: " + request.getEmail());
        }

        // Quyết định Role (Mặc định là STUDENT nếu không truyền hoặc đăng ký tự do)
        RoleName assignedRole = (request.getRole() == RoleName.ROLE_TEACHER)
                ? RoleName.ROLE_TEACHER
                : RoleName.ROLE_STUDENT;

        Role role = roleRepository.findByName(assignedRole)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy vai trò: " + assignedRole));

        Set<Role> roles = new HashSet<>();
        roles.add(role);

        User user = User.builder()
                .email(request.getEmail().toLowerCase().trim())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .phone(request.getPhone())
                .isActive(true)
                .roles(roles)
                .build();

        User savedUser = userRepository.save(user);

        // Khởi tạo bảng hồ sơ tương ứng theo nghiệp vụ thiết kế
        if (assignedRole == RoleName.ROLE_STUDENT) {
            Student student = Student.builder()
                    .user(savedUser)
                    .currentLevel("A1")
                    .targetCefr("B2")
                    .build();
            studentRepository.save(student);
        } else if (assignedRole == RoleName.ROLE_TEACHER) {
            Teacher teacher = Teacher.builder()
                    .user(savedUser)
                    .yearsOfExperience(0)
                    .specialization("English Communication")
                    .build();
            teacherRepository.save(teacher);
        }

        return mapToUserSummaryDto(savedUser);
    }

    @Transactional
    public record AuthResult(AuthResponse response, String rawRefreshToken) {
    }

    @Transactional
    public AuthResult login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("Email hoặc mật khẩu không chính xác"));

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String accessToken = jwtService.generateAccessToken(userDetails);
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken(accessToken)
                .expiresIn(jwtService.getExpirationTime() / 1000)
                .user(mapToUserSummaryDto(user))
                .build();

        return new AuthResult(authResponse, refreshToken.getToken());
    }

    @Transactional
    public AuthResult refreshToken(String oldTokenString) {
        RefreshToken validToken = refreshTokenService.verifyExpiration(oldTokenString);
        User user = validToken.getUser();

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String newAccessToken = jwtService.generateAccessToken(userDetails);

        // Cơ chế Refresh Token Rotation: Xoá token cũ, sinh token mới
        RefreshToken newRefreshToken = refreshTokenService.createRefreshToken(user);

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken(newAccessToken)
                .expiresIn(jwtService.getExpirationTime() / 1000)
                .user(mapToUserSummaryDto(user))
                .build();

        return new AuthResult(authResponse, newRefreshToken.getToken());
    }

    @Transactional
    public void logout(String refreshTokenString) {
        if (refreshTokenString != null && !refreshTokenString.isBlank()) {
            refreshTokenService.revokeToken(refreshTokenString);
        }
    }

    @Transactional(readOnly = true)
    public UserSummaryDto getCurrentUserProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin tài khoản"));
        return mapToUserSummaryDto(user);
    }

    private UserSummaryDto mapToUserSummaryDto(User user) {
        return UserSummaryDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .roles(user.getRoles().stream().map(r -> r.getName().name()).toList())
                .build();
    }
}