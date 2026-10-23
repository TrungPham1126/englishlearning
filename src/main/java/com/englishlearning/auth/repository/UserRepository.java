package com.englishlearning.auth.repository;

import com.englishlearning.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);

    Optional<User> findByPhone(String phone);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    @org.springframework.data.jpa.repository.Query(
        "SELECT DISTINCT u FROM User u LEFT JOIN u.roles r WHERE " +
        "(:role IS NULL OR r.name = :role) AND " +
        "(:keyword IS NULL OR :keyword = '' OR " +
        "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
        "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
        "LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
        "LOWER(u.phone) LIKE LOWER(CONCAT('%', :keyword, '%')))"
    )
    org.springframework.data.domain.Page<User> searchUsers(
        @org.springframework.data.repository.query.Param("role") com.englishlearning.auth.entity.RoleName role,
        @org.springframework.data.repository.query.Param("keyword") String keyword,
        org.springframework.data.domain.Pageable pageable
    );

    @org.springframework.data.jpa.repository.Query(
        "SELECT DISTINCT u FROM User u LEFT JOIN u.roles r WHERE " +
        "(u.isActive IS NULL OR u.isActive = true) AND " +
        "(:role IS NULL OR r.name = :role)"
    )
    java.util.List<User> findActiveUsersByRole(
        @org.springframework.data.repository.query.Param("role") com.englishlearning.auth.entity.RoleName role
    );
}