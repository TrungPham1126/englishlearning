package com.englishlearning.auth.service;

import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import com.englishlearning.auth.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit Test cho UserDetailsServiceImpl:
 * Kiểm tra tải thông tin người dùng cho Spring Security Context.
 */
@ExtendWith(MockitoExtension.class)
class UserDetailsServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserDetailsServiceImpl userDetailsService;

    @Test
    @DisplayName("should_LoadUserByUsernameSuccessfully_when_UserExists: Tải UserDetails và quyền hạn chính xác khi tìm thấy email")
    void should_LoadUserByUsernameSuccessfully_when_UserExists() {
        // Given
        String email = "teacher@elp.edu.vn";
        UUID userId = UUID.randomUUID();
        Role teacherRole = Role.builder().name(RoleName.ROLE_TEACHER).build();
        User user = User.builder()
                .id(userId)
                .email(email)
                .password("$2a$10$hashedPassword")
                .firstName("Mai")
                .lastName("Nguyen")
                .isActive(true)
                .roles(Set.of(teacherRole))
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));

        // When
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);

        // Then
        assertThat(userDetails).isInstanceOf(CustomUserDetails.class);
        CustomUserDetails customDetails = (CustomUserDetails) userDetails;
        assertThat(customDetails.getId()).isEqualTo(userId);
        assertThat(userDetails.getUsername()).isEqualTo(email);
        assertThat(userDetails.getPassword()).isEqualTo("$2a$10$hashedPassword");
        assertThat(userDetails.isEnabled()).isTrue();
        assertThat(userDetails.isAccountNonLocked()).isTrue();
        assertThat(userDetails.getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_TEACHER");

        verify(userRepository).findByEmail(email);
    }

    @Test
    @DisplayName("loadUserByUsername: User bị khóa (isActive = false) trả về CustomUserDetails bị vô hiệu hóa")
    void loadUserByUsername_whenUserIsInactive_returnsDisabledCustomUserDetails() {
        // Given
        String email = "locked@elp.edu.vn";
        User lockedUser = User.builder()
                .id(UUID.randomUUID())
                .email(email)
                .password("$2a$10$hashedPassword")
                .isActive(false)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(lockedUser));

        // When
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);

        // Then
        assertThat(userDetails.isEnabled()).isFalse();
        assertThat(userDetails.isAccountNonLocked()).isFalse();
        verify(userRepository).findByEmail(email);
    }

    @Test
    @DisplayName("should_ThrowUsernameNotFoundException_when_UserDoesNotExist: Báo lỗi khi email không tồn tại trong hệ thống")
    void should_ThrowUsernameNotFoundException_when_UserDoesNotExist() {
        // Given
        String nonExistentEmail = "unknown@elp.edu.vn";
        when(userRepository.findByEmail(nonExistentEmail)).thenReturn(Optional.empty());

        // When / Then
        assertThatThrownBy(() -> userDetailsService.loadUserByUsername(nonExistentEmail))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessageContaining("Không tìm thấy người dùng với email: " + nonExistentEmail);

        verify(userRepository).findByEmail(nonExistentEmail);
    }

    @Test
    @DisplayName("loadUserByUsername: Chuẩn hóa chữ hoa và khoảng trắng ở email trước khi truy vấn DB")
    void loadUserByUsername_emailWithUppercaseAndWhitespace_normalizesBeforeLookup() {
        // Given
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("student@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();
        when(userRepository.findByEmail("student@elp.edu.vn")).thenReturn(Optional.of(user));

        // When
        UserDetails details = userDetailsService.loadUserByUsername("  Student@ELP.EDU.VN ");

        // Then
        assertThat(details.getUsername()).isEqualTo("student@elp.edu.vn");
        verify(userRepository).findByEmail("student@elp.edu.vn");
    }

    @Test
    @DisplayName("loadUserByUsername: Email null hoặc rỗng -> Ném UsernameNotFoundException mà không query DB")
    void loadUserByUsername_nullOrBlankEmail_throwsUsernameNotFoundExceptionWithoutDbLookup() {
        assertThatThrownBy(() -> userDetailsService.loadUserByUsername(null))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessage("Email không được để trống");

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("   "))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessage("Email không được để trống");

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("loadUserByUsername: User có isActive = null và roles = null -> Trả về tài khoản bị vô hiệu hóa với authorities rỗng")
    void loadUserByUsername_userWithNullIsActiveAndNullRoles_returnsDisabledWithEmptyAuthorities() {
        // Given
        User incompleteUser = User.builder()
                .id(UUID.randomUUID())
                .email("incomplete@elp.edu.vn")
                .password("hash")
                .isActive(null)
                .roles(null)
                .build();
        when(userRepository.findByEmail("incomplete@elp.edu.vn")).thenReturn(Optional.of(incompleteUser));

        // When
        UserDetails details = userDetailsService.loadUserByUsername("incomplete@elp.edu.vn");

        // Then
        assertThat(details.isEnabled()).isFalse();
        assertThat(details.isAccountNonLocked()).isFalse();
        assertThat(details.getAuthorities()).isEmpty();
    }

    @Test
    @DisplayName("loadUserByUsername: User có nhiều role -> Ánh xạ đầy đủ tất cả GrantedAuthority")
    void loadUserByUsername_userWithMultipleRoles_mapsAllGrantedAuthorities() {
        // Given
        User multiRoleUser = User.builder()
                .id(UUID.randomUUID())
                .email("multi@elp.edu.vn")
                .password("hash")
                .isActive(true)
                .roles(Set.of(
                        Role.builder().name(RoleName.ROLE_ADMIN).build(),
                        Role.builder().name(RoleName.ROLE_TEACHER).build()
                ))
                .build();
        when(userRepository.findByEmail("multi@elp.edu.vn")).thenReturn(Optional.of(multiRoleUser));

        // When
        UserDetails details = userDetailsService.loadUserByUsername("multi@elp.edu.vn");

        // Then
        assertThat(details.getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_TEACHER");
    }
}
