package com.englishlearning.auth.service;

import com.englishlearning.auth.dto.UserCreateByAdminRequest;
import com.englishlearning.auth.dto.UserSummaryDto;
import com.englishlearning.auth.dto.UserUpdateRequest;
import com.englishlearning.auth.entity.*;
import com.englishlearning.auth.repository.RoleRepository;
import com.englishlearning.auth.repository.StudentRepository;
import com.englishlearning.auth.repository.TeacherRepository;
import com.englishlearning.auth.repository.UserRepository;
import com.englishlearning.auth.service.impl.AdminUserServiceImpl;
import com.englishlearning.classroom.entity.Classroom;
import com.englishlearning.classroom.repository.ClassStudentRepository;
import com.englishlearning.classroom.repository.ClassroomRepository;
import com.englishlearning.common.dto.PageResponse;
import com.englishlearning.common.exception.BadRequestException;
import com.englishlearning.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminUserServiceImpl - Kiểm thử CRUD tài khoản, đồng bộ profile, khóa/mở khóa và tự bảo vệ Admin")
class AdminUserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private StudentRepository studentRepository;

    @Mock
    private TeacherRepository teacherRepository;

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private ClassStudentRepository classStudentRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminUserServiceImpl adminUserService;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // =========================================================================
    // GET USERS
    // =========================================================================

    @Test
    @DisplayName("getAllUsers(role, keyword, pageable): Trim từ khóa và trả về PageResponse ánh xạ UserSummaryDto")
    void getAllUsers_withRoleAndKeyword_trimsKeywordAndReturnsPageResponse() {
        // Given
        Pageable pageable = PageRequest.of(0, 10);
        User student = User.builder()
                .id(UUID.randomUUID())
                .email("an@elp.edu.vn")
                .firstName("An")
                .lastName("Nguyen")
                .isActive(null) // Fallback to true in mapper
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        Page<User> userPage = new PageImpl<>(List.of(student), pageable, 1);

        when(userRepository.searchUsers(RoleName.ROLE_STUDENT, "an", pageable)).thenReturn(userPage);

        // When
        PageResponse<UserSummaryDto> response = adminUserService.getAllUsers(RoleName.ROLE_STUDENT, "  an  ", pageable);

        // Then
        assertThat(response.getTotalElements()).isEqualTo(1);
        assertThat(response.getContent()).hasSize(1);
        assertThat(response.getContent().get(0).getEmail()).isEqualTo("an@elp.edu.vn");
        assertThat(response.getContent().get(0).getIsActive()).isTrue();
        assertThat(response.getContent().get(0).getRoles()).containsExactly("ROLE_STUDENT");
        verify(userRepository).searchUsers(RoleName.ROLE_STUDENT, "an", pageable);
    }

    @Test
    @DisplayName("getAllUsers(role, blankKeyword, pageable): Chuyển keyword toàn khoảng trắng thành null")
    void getAllUsers_withBlankKeyword_passesNullKeyword() {
        // Given
        Pageable pageable = PageRequest.of(0, 10);
        when(userRepository.searchUsers(null, null, pageable)).thenReturn(Page.empty(pageable));

        // When
        PageResponse<UserSummaryDto> response = adminUserService.getAllUsers(null, "   ", pageable);

        // Then
        assertThat(response.getContent()).isEmpty();
        verify(userRepository).searchUsers(null, null, pageable);
    }

    @Test
    @DisplayName("getAllUsers(pageable): Ủy quyền về hàm lọc với role=null và keyword=null")
    void getAllUsers_withPageableOnly_delegatesWithNullFilters() {
        // Given
        Pageable pageable = PageRequest.of(1, 20);
        when(userRepository.searchUsers(null, null, pageable)).thenReturn(Page.empty(pageable));

        // When
        PageResponse<UserSummaryDto> response = adminUserService.getAllUsers(pageable);

        // Then
        assertThat(response.getPageNumber()).isEqualTo(1);
        verify(userRepository).searchUsers(null, null, pageable);
    }

    @Test
    @DisplayName("getUserById: Trả về DTO khi tìm thấy user")
    void getUserById_whenUserExists_returnsDto() {
        // Given
        UUID id = UUID.randomUUID();
        User teacher = User.builder()
                .id(id)
                .email("teacher@elp.edu.vn")
                .firstName("Mai")
                .lastName("Le")
                .isActive(false)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build()))
                .build();
        when(userRepository.findById(id)).thenReturn(Optional.of(teacher));

        // When
        UserSummaryDto dto = adminUserService.getUserById(id);

        // Then
        assertThat(dto.getId()).isEqualTo(id);
        assertThat(dto.getIsActive()).isFalse();
        assertThat(dto.getRoles()).containsExactly("ROLE_TEACHER");
    }

    @Test
    @DisplayName("getUserById: Ném ResourceNotFoundException khi không tồn tại")
    void getUserById_whenMissing_throwsResourceNotFoundException() {
        UUID missingId = UUID.randomUUID();
        when(userRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.getUserById(missingId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Không tìm thấy người dùng: " + missingId);
    }

    // =========================================================================
    // CREATE USER
    // =========================================================================

    @Test
    @DisplayName("createUser: Tạo mới user mang cả ROLE_STUDENT và ROLE_TEACHER -> Tạo đủ cả 2 bảng profile phụ")
    void createUser_withStudentAndTeacherRoles_savesUserAndBothProfiles() {
        // Given
        UserCreateByAdminRequest request = UserCreateByAdminRequest.builder()
                .email("  DualUser@ELP.EDU.VN ")
                .password("AdminPass123")
                .firstName("Minh")
                .lastName("Vo")
                .phone("0909123456")
                .roles(Set.of(RoleName.ROLE_STUDENT, RoleName.ROLE_TEACHER))
                .build();

        Role studentRole = Role.builder().id(1).name(RoleName.ROLE_STUDENT).build();
        Role teacherRole = Role.builder().id(2).name(RoleName.ROLE_TEACHER).build();

        when(userRepository.existsByEmail("dualuser@elp.edu.vn")).thenReturn(false);
        when(roleRepository.findByName(RoleName.ROLE_STUDENT)).thenReturn(Optional.of(studentRole));
        when(roleRepository.findByName(RoleName.ROLE_TEACHER)).thenReturn(Optional.of(teacherRole));
        when(passwordEncoder.encode("AdminPass123")).thenReturn("$2a$encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        // When
        UserSummaryDto created = adminUserService.createUser(request);

        // Then
        assertThat(created.getEmail()).isEqualTo("dualuser@elp.edu.vn");
        assertThat(created.getRoles()).containsExactlyInAnyOrder("ROLE_STUDENT", "ROLE_TEACHER");

        ArgumentCaptor<Student> studentCaptor = ArgumentCaptor.forClass(Student.class);
        verify(studentRepository).save(studentCaptor.capture());
        assertThat(studentCaptor.getValue().getCurrentLevel()).isEqualTo("A1");
        assertThat(studentCaptor.getValue().getTargetCefr()).isEqualTo("B2");

        ArgumentCaptor<Teacher> teacherCaptor = ArgumentCaptor.forClass(Teacher.class);
        verify(teacherRepository).save(teacherCaptor.capture());
        assertThat(teacherCaptor.getValue().getSpecialization()).isEqualTo("General");
    }

    @Test
    @DisplayName("createUser: Tạo mới ADMIN -> Không tạo profile Student hay Teacher")
    void createUser_withAdminRoleOnly_doesNotCreateStudentOrTeacherProfile() {
        // Given
        UserCreateByAdminRequest request = UserCreateByAdminRequest.builder()
                .email("subadmin@elp.edu.vn")
                .password("AdminPass123")
                .firstName("Sub")
                .lastName("Admin")
                .roles(Set.of(RoleName.ROLE_ADMIN))
                .build();

        Role adminRole = Role.builder().id(3).name(RoleName.ROLE_ADMIN).build();
        when(userRepository.existsByEmail("subadmin@elp.edu.vn")).thenReturn(false);
        when(roleRepository.findByName(RoleName.ROLE_ADMIN)).thenReturn(Optional.of(adminRole));
        when(passwordEncoder.encode("AdminPass123")).thenReturn("$2a$encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserSummaryDto result = adminUserService.createUser(request);

        // Then
        assertThat(result.getRoles()).containsExactly("ROLE_ADMIN");
        verifyNoInteractions(studentRepository, teacherRepository);
    }

    @Test
    @DisplayName("createUser: Ném BadRequestException khi email đã tồn tại (kể cả viết hoa)")
    void createUser_whenEmailExists_throwsBadRequestException() {
        UserCreateByAdminRequest request = UserCreateByAdminRequest.builder()
                .email("DUP@ELP.EDU.VN")
                .password("AdminPass123")
                .firstName("Dup")
                .lastName("User")
                .roles(Set.of(RoleName.ROLE_STUDENT))
                .build();

        when(userRepository.existsByEmail("dup@elp.edu.vn")).thenReturn(true);

        assertThatThrownBy(() -> adminUserService.createUser(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Email đã tồn tại: DUP@ELP.EDU.VN");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("createUser: Ném ResourceNotFoundException khi role không tồn tại trong hệ thống")
    void createUser_whenRoleNotFound_throwsResourceNotFoundException() {
        UserCreateByAdminRequest request = UserCreateByAdminRequest.builder()
                .email("valid@elp.edu.vn")
                .password("AdminPass123")
                .firstName("Test")
                .lastName("User")
                .roles(Set.of(RoleName.ROLE_TEACHER))
                .build();

        when(userRepository.existsByEmail("valid@elp.edu.vn")).thenReturn(false);
        when(roleRepository.findByName(RoleName.ROLE_TEACHER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.createUser(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Role không tồn tại: ROLE_TEACHER");
    }

    // =========================================================================
    // UPDATE USER
    // =========================================================================

    @Test
    @DisplayName("updateUser: Đổi role từ Teacher sang Student -> Thêm profile Student và xóa profile Teacher")
    void updateUser_whenRoleSwitchedToStudent_createsStudentAndDeletesTeacher() {
        // Given
        UUID userId = UUID.randomUUID();
        User existing = User.builder()
                .id(userId)
                .email("user@elp.edu.vn")
                .firstName("Old")
                .lastName("Name")
                .isActive(true)
                .roles(new HashSet<>(Set.of(Role.builder().name(RoleName.ROLE_TEACHER).build())))
                .build();

        Role studentRole = Role.builder().id(1).name(RoleName.ROLE_STUDENT).build();
        Teacher existingTeacher = Teacher.builder().id(userId).user(existing).build();

        UserUpdateRequest request = UserUpdateRequest.builder()
                .firstName("New")
                .lastName("Student")
                .phone("0911223344")
                .isActive(false)
                .roles(Set.of(RoleName.ROLE_STUDENT))
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(roleRepository.findByName(RoleName.ROLE_STUDENT)).thenReturn(Optional.of(studentRole));
        when(studentRepository.existsById(userId)).thenReturn(false);
        when(teacherRepository.findById(userId)).thenReturn(Optional.of(existingTeacher));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserSummaryDto updated = adminUserService.updateUser(userId, request);

        // Then
        assertThat(updated.getFirstName()).isEqualTo("New");
        assertThat(updated.getLastName()).isEqualTo("Student");
        assertThat(updated.getIsActive()).isFalse();
        assertThat(updated.getRoles()).containsExactly("ROLE_STUDENT");

        verify(studentRepository).save(any(Student.class));
        verify(teacherRepository).delete(existingTeacher);
    }

    @Test
    @DisplayName("updateUser: Thêm role Teacher và hạ role Student -> Tạo Teacher nếu chưa có và xóa Student")
    void updateUser_whenRoleSwitchedToTeacher_createsTeacherAndDeletesStudent() {
        // Given
        UUID userId = UUID.randomUUID();
        User existing = User.builder()
                .id(userId)
                .email("promote@elp.edu.vn")
                .firstName("Cuong")
                .lastName("Le")
                .isActive(true)
                .roles(new HashSet<>(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build())))
                .build();

        Role teacherRole = Role.builder().id(2).name(RoleName.ROLE_TEACHER).build();
        Student existingStudent = Student.builder().id(userId).user(existing).build();

        UserUpdateRequest request = UserUpdateRequest.builder()
                .firstName("Cuong")
                .lastName("Le")
                .roles(Set.of(RoleName.ROLE_TEACHER))
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(roleRepository.findByName(RoleName.ROLE_TEACHER)).thenReturn(Optional.of(teacherRole));
        when(studentRepository.findById(userId)).thenReturn(Optional.of(existingStudent));
        when(teacherRepository.existsById(userId)).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserSummaryDto updated = adminUserService.updateUser(userId, request);

        // Then
        assertThat(updated.getRoles()).containsExactly("ROLE_TEACHER");
        verify(studentRepository).delete(existingStudent);
        verify(teacherRepository).save(any(Teacher.class));
    }

    @Test
    @DisplayName("updateUser: Khi roles = null hoặc rỗng -> Giữ nguyên roles và thông tin active hiện tại")
    void updateUser_whenRolesEmptyAndIsActiveNull_preservesRolesAndStatus() {
        // Given
        UUID userId = UUID.randomUUID();
        Role adminRole = Role.builder().id(3).name(RoleName.ROLE_ADMIN).build();
        User existing = User.builder()
                .id(userId)
                .email("admin@elp.edu.vn")
                .firstName("Root")
                .lastName("Admin")
                .isActive(true)
                .roles(Set.of(adminRole))
                .build();

        UserUpdateRequest request = UserUpdateRequest.builder()
                .firstName("Root Updated")
                .lastName("Admin")
                .isActive(null)
                .roles(Collections.emptySet())
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserSummaryDto updated = adminUserService.updateUser(userId, request);

        // Then
        assertThat(updated.getFirstName()).isEqualTo("Root Updated");
        assertThat(updated.getIsActive()).isTrue();
        assertThat(updated.getRoles()).containsExactly("ROLE_ADMIN");
        verifyNoInteractions(roleRepository, studentRepository, teacherRepository);
    }

    @Test
    @DisplayName("updateUser: Ném ResourceNotFoundException khi userId không tồn tại")
    void updateUser_whenUserNotFound_throwsResourceNotFoundException() {
        UUID missingId = UUID.randomUUID();
        when(userRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.updateUser(missingId, new UserUpdateRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // =========================================================================
    // TOGGLE STATUS & SELF-LOCK GUARD
    // =========================================================================

    @Test
    @DisplayName("toggleUserStatus: Admin khóa tài khoản của người dùng khác thành công")
    void toggleUserStatus_whenTargetIsOtherUser_updatesIsActiveAndSaves() {
        // Given
        UUID adminId = UUID.randomUUID();
        UUID targetUserId = UUID.randomUUID();
        authenticateAsAdmin(adminId);

        User targetUser = User.builder().id(targetUserId).email("student@elp.edu.vn").isActive(true).build();
        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(targetUser));

        // When
        adminUserService.toggleUserStatus(targetUserId, false);

        // Then
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getIsActive()).isFalse();
    }

    @Test
    @DisplayName("toggleUserStatus: Chặn Admin tự khóa chính mình -> Ném BadRequestException")
    void toggleUserStatus_whenAdminLocksSelf_throwsBadRequestException() {
        // Given
        UUID adminId = UUID.randomUUID();
        authenticateAsAdmin(adminId);

        // When / Then
        assertThatThrownBy(() -> adminUserService.toggleUserStatus(adminId, false))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Không thể tự khóa tài khoản của chính mình");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("toggleUserStatus: Admin mở khóa tài khoản (active = true) vẫn được phép ngay cả với id trùng")
    void toggleUserStatus_whenAdminEnablesStatus_succeeds() {
        // Given
        UUID adminId = UUID.randomUUID();
        authenticateAsAdmin(adminId);
        User admin = User.builder().id(adminId).email("admin@elp.edu.vn").isActive(false).build();
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));

        // When
        adminUserService.toggleUserStatus(adminId, true);

        // Then
        assertThat(admin.getIsActive()).isTrue();
        verify(userRepository).save(admin);
    }

    @Test
    @DisplayName("toggleUserStatus: Ném ResourceNotFoundException khi không tìm thấy user")
    void toggleUserStatus_whenUserNotFound_throwsResourceNotFoundException() {
        UUID missingId = UUID.randomUUID();
        when(userRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.toggleUserStatus(missingId, false))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // =========================================================================
    // DELETE USER & GUARDS
    // =========================================================================

    @Test
    @DisplayName("deleteUser: Chặn Admin tự xóa tài khoản của chính mình -> Ném BadRequestException")
    void deleteUser_whenAdminDeletesSelf_throwsBadRequestException() {
        // Given
        UUID adminId = UUID.randomUUID();
        authenticateAsAdmin(adminId);

        // When / Then
        assertThatThrownBy(() -> adminUserService.deleteUser(adminId))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Không thể tự xóa tài khoản của chính mình");

        verify(userRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteUser: Chặn xóa giảng viên đang phụ trách lớp học")
    void deleteUser_whenTeacherAssignedToClassrooms_throwsBadRequestException() {
        // Given
        UUID teacherId = UUID.randomUUID();
        User teacher = User.builder().id(teacherId).email("teacher@elp.edu.vn").build();

        when(userRepository.findById(teacherId)).thenReturn(Optional.of(teacher));
        when(teacherRepository.existsById(teacherId)).thenReturn(true);
        when(classroomRepository.findByTeacherId(teacherId))
                .thenReturn(List.of(Classroom.builder().id(UUID.randomUUID()).name("Class A").build()));

        // When / Then
        assertThatThrownBy(() -> adminUserService.deleteUser(teacherId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Không thể xóa giảng viên đang phụ trách 1 lớp học");

        verify(userRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteUser: Xóa sạch ghi danh lớp học và profile Student/Teacher trước khi xóa User")
    void deleteUser_whenStudentAndUnassignedTeacher_cleansUpAndDeletesUser() {
        // Given
        UUID targetId = UUID.randomUUID();
        User target = User.builder().id(targetId).email("cleanup@elp.edu.vn").build();
        Teacher teacherProfile = Teacher.builder().id(targetId).user(target).build();

        when(userRepository.findById(targetId)).thenReturn(Optional.of(target));
        when(teacherRepository.existsById(targetId)).thenReturn(true);
        when(classroomRepository.findByTeacherId(targetId)).thenReturn(Collections.emptyList());
        when(studentRepository.existsById(targetId)).thenReturn(true);
        when(teacherRepository.findById(targetId)).thenReturn(Optional.of(teacherProfile));

        // When
        adminUserService.deleteUser(targetId);

        // Then
        verify(classStudentRepository).deleteByStudentId(targetId);
        verify(studentRepository).deleteById(targetId);
        verify(teacherRepository).delete(teacherProfile);
        verify(userRepository).delete(target);
    }

    @Test
    @DisplayName("deleteUser: Ném ResourceNotFoundException khi userId không tồn tại")
    void deleteUser_whenUserNotFound_throwsResourceNotFoundException() {
        UUID missingId = UUID.randomUUID();
        when(userRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.deleteUser(missingId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    private void authenticateAsAdmin(UUID adminId) {
        User admin = User.builder()
                .id(adminId)
                .email("admin@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_ADMIN).build()))
                .build();
        CustomUserDetails details = new CustomUserDetails(admin);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities())
        );
    }
}
