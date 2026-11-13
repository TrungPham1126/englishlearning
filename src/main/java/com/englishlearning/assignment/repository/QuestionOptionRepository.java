package com.englishlearning.assignment.repository;

import com.englishlearning.assignment.entity.QuestionOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.UUID;

@Repository
public interface QuestionOptionRepository extends JpaRepository<QuestionOption, UUID> {

    @Modifying
    @Query("DELETE FROM QuestionOption qo WHERE qo.question.id IN :questionIds")
    int deleteByQuestionIdIn(@Param("questionIds") Collection<UUID> questionIds);
}
