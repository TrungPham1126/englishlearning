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
import static org.mockito.Mockito.when;

/**
 * Unit Test cho UserDetailsServiceImpl (CustomUserDetailsService)
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
        assertThat(userDetails).isNotNull();
        assertThat(userDetails.getUsername()).isEqualTo(email);
        assertThat(userDetails.getPassword()).isEqualTo("$2a$10$hashedPassword");
        assertThat(userDetails.isEnabled()).isTrue();
        assertThat(userDetails.getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_TEACHER");

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
}
