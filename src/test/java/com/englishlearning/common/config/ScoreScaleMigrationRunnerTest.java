package com.englishlearning.common.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScoreScaleMigrationRunnerTest {

    @Mock
    private ObjectProvider<JdbcTemplate> jdbcTemplateProvider;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("run thực thi đủ 4 câu lệnh chuẩn hóa điểm legacy khi JdbcTemplate khả dụng")
    void run_executesFourMigrationUpdates() {
        when(jdbcTemplateProvider.getIfAvailable()).thenReturn(jdbcTemplate);
        when(jdbcTemplate.update(anyString())).thenReturn(1);

        ScoreScaleMigrationRunner runner = new ScoreScaleMigrationRunner(jdbcTemplateProvider);
        runner.run(new DefaultApplicationArguments());

        verify(jdbcTemplate).update(contains("UPDATE assignment_attempts"));
        verify(jdbcTemplate).update(contains("UPDATE assignments"));
        verify(jdbcTemplate).update(contains("UPDATE student_answers"));
        verify(jdbcTemplate).update(contains("UPDATE ai_evaluations"));
    }

    @Test
    @DisplayName("run bỏ qua an toàn khi JdbcTemplate không tồn tại trong context (ví dụ WebMvcTest)")
    void run_noOpWhenJdbcTemplateMissing() {
        when(jdbcTemplateProvider.getIfAvailable()).thenReturn(null);

        ScoreScaleMigrationRunner runner = new ScoreScaleMigrationRunner(jdbcTemplateProvider);
        runner.run(new DefaultApplicationArguments());

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @DisplayName("run tiếp tục chuẩn hóa các bảng còn lại nếu 1 bảng gặp lỗi SQL")
    void run_continuesWhenSingleUpdateFails() {
        when(jdbcTemplateProvider.getIfAvailable()).thenReturn(jdbcTemplate);
        when(jdbcTemplate.update(contains("UPDATE assignment_attempts")))
                .thenThrow(new RuntimeException("Table not ready"));
        when(jdbcTemplate.update(contains("UPDATE assignments"))).thenReturn(0);
        when(jdbcTemplate.update(contains("UPDATE student_answers"))).thenReturn(2);
        when(jdbcTemplate.update(contains("UPDATE ai_evaluations"))).thenReturn(0);

        ScoreScaleMigrationRunner runner = new ScoreScaleMigrationRunner(jdbcTemplateProvider);
        runner.run(new DefaultApplicationArguments());

        verify(jdbcTemplate, times(4)).update(anyString());
    }
}
