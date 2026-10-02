package com.englishlearning.analytics.repository;

import com.englishlearning.analytics.entity.StudentSkillProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface StudentSkillProfileRepository extends JpaRepository<StudentSkillProfile, UUID> {
    // Không cần viết thêm hàm vì tìm theo ID (chính là student_id do dùng @MapsId)
    // đã có sẵn trong JpaRepository
}