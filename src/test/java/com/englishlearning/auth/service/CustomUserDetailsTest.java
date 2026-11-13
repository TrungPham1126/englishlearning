package com.englishlearning.auth.service;

import com.englishlearning.auth.entity.Role;
import com.englishlearning.auth.entity.RoleName;
import com.englishlearning.auth.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("CustomUserDetails - Kiểm thử ánh xạ User sang Spring Security UserDetails")
class CustomUserDetailsTest {

    @Test
    @DisplayName("User active có nhiều vai trò -> Kích hoạt đầy đủ cờ bảo mật và danh sách GrantedAuthority")
    void constructor_withActiveUserAndMultipleRoles_setsEnabledAndAuthorities() {
        // Given
        UUID userId = UUID.randomUUID();
        Role adminRole = Role.builder().id(1).name(RoleName.ROLE_ADMIN).build();
        Role teacherRole = Role.builder().id(2).name(RoleName.ROLE_TEACHER).build();
        User user = User.builder()
                .id(userId)
                .email("admin@elp.edu.vn")
                .password("$2a$10$encoded")
                .isActive(true)
                .roles(Set.of(adminRole, teacherRole))
                .build();

        // When
        CustomUserDetails details = new CustomUserDetails(user);

        // Then
        assertThat(details.getUser()).isSameAs(user);
        assertThat(details.getId()).isEqualTo(userId);
        assertThat(details.getEmail()).isEqualTo("admin@elp.edu.vn");
        assertThat(details.getUsername()).isEqualTo("admin@elp.edu.vn");
        assertThat(details.getPassword()).isEqualTo("$2a$10$encoded");
        assertThat(details.isEnabled()).isTrue();
        assertThat(details.isAccountNonLocked()).isTrue();
        assertThat(details.isAccountNonExpired()).isTrue();
        assertThat(details.isCredentialsNonExpired()).isTrue();
        assertThat(details.getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_TEACHER");
    }

    @Test
    @DisplayName("User bị khóa (isActive = false) -> isEnabled() và isAccountNonLocked() trả về false")
    void constructor_withInactiveUser_disablesAndLocksAccount() {
        // Given
        User lockedUser = User.builder()
                .id(UUID.randomUUID())
                .email("locked@elp.edu.vn")
                .password("hash")
                .isActive(false)
                .roles(Set.of(Role.builder().name(RoleName.ROLE_STUDENT).build()))
                .build();

        // When
        CustomUserDetails details = new CustomUserDetails(lockedUser);

        // Then
        assertThat(details.isEnabled()).isFalse();
        assertThat(details.isAccountNonLocked()).isFalse();
        assertThat(details.isAccountNonExpired()).isTrue();
        assertThat(details.isCredentialsNonExpired()).isTrue();
    }

    @Test
    @DisplayName("User có isActive = null và roles = null -> Không lỗi NPE, tài khoản bị khóa và authorities rỗng")
    void constructor_withNullIsActiveAndNullRoles_defaultsSafeDisabledAndEmptyAuthorities() {
        // Given
        User incompleteUser = User.builder()
                .id(UUID.randomUUID())
                .email("incomplete@elp.edu.vn")
                .password("hash")
                .isActive(null)
                .roles(null)
                .build();

        // When
        CustomUserDetails details = new CustomUserDetails(incompleteUser);

        // Then
        assertThat(details.isEnabled()).isFalse();
        assertThat(details.isAccountNonLocked()).isFalse();
        assertThat(details.getAuthorities()).isEmpty();
    }
}
