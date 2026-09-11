package com.englishlearning.auth.service;

import com.englishlearning.auth.dto.UserCreateByAdminRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.dto.UserUpdateRequest;
import com.englishlearning.auth.entity.*;
import com.englishlearning.auth.repository.RoleRepository;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public PageResponse<UserSummaryDto> getAllUsers(Pageable pageable) {
        Page<UserSummaryDto> usersPage = userRepository.findAll(pageable)
                .map(this::mapToUserSummaryDto);
        return PageResponse.from(usersPage);
    }

    @Transactional(readOnly = true)
    public UserSummaryDto getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng: " + userId));
        return mapToUserSummaryDto(user);
    }

    @Transactional
    public UserSummaryDto createUser(UserCreateByAdminRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email đã tồn tại: " + request.getEmail());
        }

        Set<Role> roles = new HashSet<>();
        for (RoleName roleName : request.getRoles()) {
            Role role = roleRepository.findByName(roleName)
                    .orElseThrow(() -> new ResourceNotFoundException("Role không tồn tại: " + roleName));
            roles.add(role);
        }

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

        // Tạo profile tương ứng theo role
        if (request.getRoles().contains(RoleName.ROLE_STUDENT)) {
            studentRepository.save(Student.builder().user(savedUser).currentLevel("A1").targetCefr("B2").build());
        }
        if (request.getRoles().contains(RoleName.ROLE_TEACHER)) {
            teacherRepository
                    .save(Teacher.builder().user(savedUser).yearsOfExperience(0).specialization("General").build());
        }

        return mapToUserSummaryDto(savedUser);
    }

    @Transactional
    public UserSummaryDto updateUser(UUID userId, UserUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng: " + userId));

        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setPhone(request.getPhone());
        if (request.getIsActive() != null) {
            user.setIsActive(request.getIsActive());
        }

        if (request.getRoles() != null && !request.getRoles().isEmpty()) {
            Set<Role> roles = new HashSet<>();
            for (RoleName roleName : request.getRoles()) {
                Role role = roleRepository.findByName(roleName)
                        .orElseThrow(() -> new ResourceNotFoundException("Role không tồn tại: " + roleName));
                roles.add(role);
            }
            user.setRoles(roles);
        }

        return mapToUserSummaryDto(userRepository.save(user));
    }

    @Transactional
    public void toggleUserStatus(UUID userId, boolean isActive) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng: " + userId));
        user.setIsActive(isActive);
        userRepository.save(user);
    }

    @Transactional
    public void deleteUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng: " + userId));

        // Xóa profiles phụ trước
        studentRepository.deleteById(userId);
        teacherRepository.deleteById(userId);
        userRepository.delete(user);
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