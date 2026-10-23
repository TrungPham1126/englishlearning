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
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final AuthenticationManager authenticationManager;
    private final com.englishlearning.classroom.repository.ClassStudentRepository classStudentRepository;

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

    @Transactional
    public UserSummaryDto updateProfile(UUID userId, com.englishlearning.auth.dto.UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Not found"));
        if (request.getFirstName() != null)
            user.setFirstName(request.getFirstName());
        if (request.getLastName() != null)
            user.setLastName(request.getLastName());
        if (request.getPhone() != null)
            user.setPhone(request.getPhone());
        if (request.getAvatarUrl() != null)
            user.setAvatarUrl(request.getAvatarUrl());
        userRepository.save(user);

        if (user.getRoles().stream().anyMatch(r -> r.getName().name().equals("ROLE_STUDENT"))) {
            studentRepository.findById(userId).ifPresent(student -> {
                if (request.getTargetCefr() != null)
                    student.setTargetCefr(request.getTargetCefr());
                studentRepository.save(student);
            });
        }
        return mapToUserSummaryDto(user);
    }

    @Transactional
    public UserSummaryDto updateAvatar(UUID userId, org.springframework.web.multipart.MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Vui lòng chọn file ảnh hợp lệ");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BadRequestException("Chỉ chấp nhận các định dạng file ảnh (JPEG, PNG, WEBP, GIF)");
        }

        if (file.getSize() > 5 * 1024 * 1024) {
            throw new BadRequestException("Dung lượng ảnh tối đa là 5MB");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin tài khoản"));

        try {
            java.nio.file.Path uploadDir = java.nio.file.Paths.get("uploads", "avatars");
            if (!java.nio.file.Files.exists(uploadDir)) {
                java.nio.file.Files.createDirectories(uploadDir);
            }

            String originalFilename = file.getOriginalFilename();
            String extension = ".jpg";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
            }

            String fileName = "avatar_" + userId + "_" + System.currentTimeMillis() + extension;
            java.nio.file.Path targetPath = uploadDir.resolve(fileName);
            java.nio.file.Files.copy(file.getInputStream(), targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            String avatarUrl = "/uploads/avatars/" + fileName;
            user.setAvatarUrl(avatarUrl);
            userRepository.save(user);

            log.info("Cập nhật avatar thành công cho user {}: {}", userId, avatarUrl);
            return mapToUserSummaryDto(user);
        } catch (java.io.IOException e) {
            log.error("Lỗi khi lưu ảnh đại diện: ", e);
            throw new RuntimeException("Không thể lưu file ảnh: " + e.getMessage(), e);
        }
    }


    private UserSummaryDto mapToUserSummaryDto(User user) {
        UserSummaryDto dto = UserSummaryDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .roles(user.getRoles().stream().map(r -> r.getName().name()).toList())
                .build();
                
        if (dto.getRoles().contains("ROLE_STUDENT")) {
            java.util.List<com.englishlearning.classroom.entity.ClassStudent> activeEnrollments =
                    classStudentRepository.findActiveEnrollmentsWithClassroom(user.getId());
            String classLevel = null;
            if (!activeEnrollments.isEmpty()) {
                com.englishlearning.classroom.entity.Classroom c = activeEnrollments.get(0).getClassroom();
                if (c != null && c.getLevel() != null) {
                    classLevel = c.getLevel().name();
                }
            }
            dto.setCurrentLevel(classLevel);
            final String finalClassLevel = classLevel;
            studentRepository.findById(user.getId()).ifPresent(student -> {
                dto.setTargetCefr(student.getTargetCefr());
                if ((finalClassLevel == null && student.getCurrentLevel() != null) ||
                    (finalClassLevel != null && !finalClassLevel.equals(student.getCurrentLevel()))) {
                    student.setCurrentLevel(finalClassLevel);
                    studentRepository.save(student);
                }
            });
        }
        return dto;
    }
}