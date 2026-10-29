package com.englishlearning.auth.service.impl;

import com.englishlearning.auth.dto.UserCreateByAdminRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.dto.UserUpdateRequest;
import com.englishlearning.auth.entity.*;
import com.englishlearning.auth.repository.RoleRepository;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.auth.service.AdminUserService;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminUserServiceImpl implements AdminUserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassStudentRepository classStudentRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserSummaryDto> getAllUsers(RoleName role, String keyword, Pageable pageable) {
        String safeKeyword = (keyword != null && !keyword.isBlank()) ? keyword.trim() : null;
        Page<UserSummaryDto> usersPage = userRepository.searchUsers(role, safeKeyword, pageable)
                .map(this::mapToUserSummaryDto);
        return PageResponse.from(usersPage);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserSummaryDto> getAllUsers(Pageable pageable) {
        return getAllUsers(null, null, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public UserSummaryDto getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng: " + userId));
        return mapToUserSummaryDto(user);
    }

    @Override
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

    @Override
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

            // ĐỒNG BỘ PROFILE STUDENT: Thêm mới nếu chưa có, xóa đi nếu bị hạ quyền
            if (request.getRoles().contains(RoleName.ROLE_STUDENT)) {
                if (!studentRepository.existsById(userId)) {
                    studentRepository.save(Student.builder().user(user).currentLevel(null).targetCefr("B2").build());
                }
            } else {
                studentRepository.findById(userId).ifPresent(studentRepository::delete);
            }

            // ĐỒNG BỘ PROFILE TEACHER: Thêm mới nếu chưa có, xóa đi nếu bị hạ quyền
            if (request.getRoles().contains(RoleName.ROLE_TEACHER)) {
                if (!teacherRepository.existsById(userId)) {
                    teacherRepository
                            .save(Teacher.builder().user(user).yearsOfExperience(0).specialization("General").build());
                }
            } else {
                teacherRepository.findById(userId).ifPresent(teacherRepository::delete);
            }
        }

        return mapToUserSummaryDto(userRepository.save(user));
    }

    @Override
    @Transactional
    public void toggleUserStatus(UUID userId, boolean isActive) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng: " + userId));
        user.setIsActive(isActive);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void deleteUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng: " + userId));

        // Kiểm tra an toàn: Nếu là giảng viên đang được gán phụ trách lớp học thì không cho xóa trực tiếp
        if (teacherRepository.existsById(userId)) {
            List<Classroom> assignedClasses = classroomRepository.findByTeacherId(userId);
            if (!assignedClasses.isEmpty()) {
                throw new BadRequestException("Không thể xóa giảng viên đang phụ trách " + assignedClasses.size() + " lớp học. Vui lòng phân công giảng viên khác trước khi xóa.");
            }
        }

        // SỬA LỖI SẬP API: Dọn dẹp bản ghi ghi danh lớp học và profile phụ trước khi xóa user
        if (studentRepository.existsById(userId)) {
            classStudentRepository.deleteByStudentId(userId);
            studentRepository.deleteById(userId);
        }
        teacherRepository.findById(userId).ifPresent(teacherRepository::delete);

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
                .isActive(user.getIsActive() != null ? user.getIsActive() : true)
                .roles(user.getRoles().stream().map(r -> r.getName().name()).toList())
                .build();
    }
}
