package com.englishlearning.submission.repository;

import com.englishlearning.submission.entity.StudentAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;

@Repository
public interface StudentAnswerRepository extends JpaRepository<StudentAnswer, UUID> {
}