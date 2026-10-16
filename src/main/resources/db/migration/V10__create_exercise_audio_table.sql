-- Migration: V10__create_exercise_audio_table.sql
-- Table: exercise_audios
-- Stores pre-generated and self-healed Kokoro-82M neural TTS audio for Shadowing and Listening exercises

CREATE TABLE IF NOT EXISTS `exercise_audios` (
    `id` VARCHAR(36) NOT NULL,
    `exercise_type` VARCHAR(30) NOT NULL COMMENT 'SHADOWING or LISTENING',
    `assignment_id` VARCHAR(36) NOT NULL,
    `question_id` VARCHAR(36) NOT NULL,
    `content_hash` VARCHAR(64) NOT NULL COMMENT 'SHA-256 of normalized text + voice config + model version',
    `voice_config` TEXT NULL COMMENT 'JSON configuration of assigned Kokoro voices and speeds',
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, PROCESSING, READY, FAILED, BROKEN',
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Only one active record per question',
    `url` VARCHAR(1000) NULL COMMENT 'Persistent audio URL (Cloudflare R2, S3 or local static)',
    `duration_ms` BIGINT NULL COMMENT 'Total audio duration in milliseconds',
    `segments` LONGTEXT NULL COMMENT 'JSON array of dialogue turns with millisecond timestamps for live transcript highlighting',
    `version` INT NOT NULL DEFAULT 1 COMMENT 'Incremented upon each self-healing repair',
    `generated_by` VARCHAR(30) NOT NULL DEFAULT 'SYSTEM' COMMENT 'SYSTEM, TEACHER, STUDENT_REPAIR',
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_ex_audio_question` (`question_id`, `is_active`),
    INDEX `idx_ex_audio_assignment` (`assignment_id`),
    INDEX `idx_ex_audio_hash` (`content_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

