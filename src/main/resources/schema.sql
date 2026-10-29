-- ====================================================================
-- ENGLISH LEARNING SYSTEM - UNIFIED DATABASE INITIALIZATION & SEED SCRIPT
-- Standard: MySQL 8.0+ / MariaDB 10.4+
-- Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- Total Entities: 32 (Matching ERD Hinh 2.10 & JPA Entity Annotations)
-- Generated at: 2026-10-26T23:30:00+07:00
-- ====================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ====================================================================
-- ENGLISH LEARNING SYSTEM - UNIFIED MASTER SCHEMA DDL
-- Charset: utf8mb4 | Collation: utf8mb4_unicode_ci | 32 Entities
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `refresh_tokens`;
DROP TABLE IF EXISTS `learning_sessions`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `teachers`;
DROP TABLE IF EXISTS `classes`;
DROP TABLE IF EXISTS `class_students`;
DROP TABLE IF EXISTS `lessons`;
DROP TABLE IF EXISTS `lesson_documents`;
DROP TABLE IF EXISTS `videos`;
DROP TABLE IF EXISTS `video_watch_histories`;
DROP TABLE IF EXISTS `grammar_topics`;
DROP TABLE IF EXISTS `vocabulary_items`;
DROP TABLE IF EXISTS `student_vocabulary_progress`;
DROP TABLE IF EXISTS `assignments`;
DROP TABLE IF EXISTS `assignment_questions`;
DROP TABLE IF EXISTS `question_options`;
DROP TABLE IF EXISTS `exercise_audios`;
DROP TABLE IF EXISTS `assignment_attempts`;
DROP TABLE IF EXISTS `student_answers`;
DROP TABLE IF EXISTS `ai_evaluations`;
DROP TABLE IF EXISTS `student_skill_profiles`;
DROP TABLE IF EXISTS `student_ai_quotas`;
DROP TABLE IF EXISTS `daily_study_plans`;
DROP TABLE IF EXISTS `daily_plan_items`;
DROP TABLE IF EXISTS `student_daily_progress`;
DROP TABLE IF EXISTS `ai_generated_exercises`;
DROP TABLE IF EXISTS `global_resources`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `audit_logs`;

CREATE TABLE `users` (
`is_active` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
`id` int(11) NOT NULL AUTO_INCREMENT,
  `description` varchar(255) DEFAULT NULL,
  `name` enum('ROLE_ADMIN','ROLE_TEACHER','ROLE_STUDENT') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_ofx66keruapi6vyqpv6f2or37` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_roles` (
`role_id` int(11) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  PRIMARY KEY (`role_id`,`user_id`),
  KEY `FKhfh9dx7w3ubf1co1vdev94g3f` (`user_id`),
  CONSTRAINT `FKh8ciramu9cc9q3qcqiv4ue8a6` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `FKhfh9dx7w3ubf1co1vdev94g3f` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `refresh_tokens` (
`revoked` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `expiry_date` datetime(6) NOT NULL,
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `token` varchar(500) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_ghpmfn23vmxfu3spu3lfg4r2d` (`token`),
  KEY `FK1lih5y2npsf8u5o3vhdb9y0os` (`user_id`),
  CONSTRAINT `FK1lih5y2npsf8u5o3vhdb9y0os` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `learning_sessions` (
`session_duration_seconds` int(11) DEFAULT NULL,
  `login_at` datetime(6) NOT NULL,
  `logout_at` datetime(6) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKc0jfn5lt5ifwhwu8mfb5xm92q` (`user_id`),
  CONSTRAINT `FKc0jfn5lt5ifwhwu8mfb5xm92q` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `students` (
`current_level` varchar(10) DEFAULT NULL,
  `target_cefr` varchar(10) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK7xqmtv7r2eb5axni3jm0a80su` FOREIGN KEY (`id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `teachers` (
`years_of_experience` int(11) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `bio` text DEFAULT NULL,
  `specialization` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `FKpavufmal5lbtc60csriy8sx3` FOREIGN KEY (`id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `classes` (
`end_date` date DEFAULT NULL,
  `max_students` int(11) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `id` varchar(36) NOT NULL,
  `teacher_id` varchar(36) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `level` enum('BEGINNER','A1','A2','B1','B2','C1','C2','IELTS_PREP','TOEIC_PREP') NOT NULL,
  `status` enum('PLANNING','OPEN','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK8td8h5k21lq8jax2h6oobm9l0` (`teacher_id`),
  CONSTRAINT `FK8td8h5k21lq8jax2h6oobm9l0` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `class_students` (
`is_active` bit(1) NOT NULL,
  `enrolled_at` datetime(6) NOT NULL,
  `class_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `student_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKmlgryo6uwpxaqw05f9bylctop` (`class_id`,`student_id`),
  KEY `FK8x4jwkaf3emayhwuqidfr5w0c` (`student_id`),
  CONSTRAINT `FK8x4jwkaf3emayhwuqidfr5w0c` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `FKjuh9br5vimkw71ko8qyswp3ci` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lessons` (
`order_index` int(11) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `class_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` text DEFAULT NULL,
  `objectives` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKg0m63rprnplb9sf2bu2cbriq6` (`class_id`),
  CONSTRAINT `FKg0m63rprnplb9sf2bu2cbriq6` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lesson_documents` (
`created_at` datetime(6) NOT NULL,
  `file_size_bytes` bigint(20) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `lesson_id` varchar(36) NOT NULL,
  `storage_url` varchar(1000) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_type` enum('PDF','DOCX','PPTX','IMAGE','AUDIO') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKivbwcag296hton24n8esol7h1` (`lesson_id`),
  CONSTRAINT `FKivbwcag296hton24n8esol7h1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `videos` (
`duration_seconds` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `size_bytes` bigint(20) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `id` varchar(36) NOT NULL,
  `lesson_id` varchar(36) NOT NULL,
  `reviewed_by` varchar(36) DEFAULT NULL,
  `uploaded_by` varchar(36) NOT NULL,
  `hls_playlist_url` varchar(1000) DEFAULT NULL,
  `raw_storage_url` varchar(1000) DEFAULT NULL,
  `thumbnail_url` varchar(1000) DEFAULT NULL,
  `original_file_name` varchar(255) NOT NULL,
  `rejection_reason` text DEFAULT NULL,
  `status` enum('DRAFT','PROCESSING','PENDING_REVIEW','APPROVED','REJECTED','ARCHIVED') NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_pbymvgv9plu1y0awsd8fbieco` (`lesson_id`),
  KEY `FKhnlf7pbfu0ippjvy0wt22uyf6` (`reviewed_by`),
  KEY `FKlvskenwmpt236rsqlmd3kaw0n` (`uploaded_by`),
  CONSTRAINT `FKeut3lv873fab335b20mkjx1kn` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`),
  CONSTRAINT `FKhnlf7pbfu0ippjvy0wt22uyf6` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `FKlvskenwmpt236rsqlmd3kaw0n` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `video_watch_histories` (
`completion_percentage` float NOT NULL,
  `is_completed` bit(1) NOT NULL,
  `watched_seconds` int(11) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `id` varchar(36) NOT NULL,
  `student_id` varchar(36) NOT NULL,
  `video_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKito4j44muxf0n260v35ur17ds` (`video_id`,`student_id`),
  KEY `FKr1ujcn521uxfj222ptaiujrte` (`student_id`),
  CONSTRAINT `FKc0yx3g93qgxeccg63e6wo7lhb` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`),
  CONSTRAINT `FKr1ujcn521uxfj222ptaiujrte` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `grammar_topics` (
`id` varchar(36) NOT NULL,
  `lesson_id` varchar(36) NOT NULL,
  `title` varchar(150) NOT NULL,
  `examples` text DEFAULT NULL,
  `formula` text DEFAULT NULL,
  `rule_summary` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKita0gktpbxoeuj8qtchtsb8a6` (`lesson_id`),
  CONSTRAINT `FKita0gktpbxoeuj8qtchtsb8a6` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vocabulary_items` (
`id` varchar(36) NOT NULL,
  `lesson_id` varchar(36) NOT NULL,
  `part_of_speech` varchar(50) DEFAULT NULL,
  `ipa` varchar(100) DEFAULT NULL,
  `word` varchar(100) NOT NULL,
  `audio_url` varchar(1000) DEFAULT NULL,
  `image_url` varchar(1000) DEFAULT NULL,
  `antonyms` text DEFAULT NULL,
  `example_sentence` text DEFAULT NULL,
  `meaning` text NOT NULL,
  `synonyms` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKdr99cbsv4ueaahx1dyfyxendm` (`lesson_id`),
  CONSTRAINT `FKdr99cbsv4ueaahx1dyfyxendm` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_vocabulary_progress` (
`id` varchar(36) NOT NULL,
  `ease_factor` double NOT NULL,
  `interval_days` int(11) NOT NULL,
  `next_review_at` datetime(6) NOT NULL,
  `repetitions` int(11) NOT NULL,
  `stage` enum('NEW','LEARNING','REVIEWING','MASTERED') NOT NULL,
  `student_id` varchar(36) NOT NULL,
  `vocabulary_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK1aox4dv4tl427x4ifteh6t1ei` (`student_id`,`vocabulary_id`),
  KEY `FKjpprhveud34dmdytnbf9xjk46` (`vocabulary_id`),
  CONSTRAINT `FK5pfg20jkgilwluixwftuxs3ae` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `FKjpprhveud34dmdytnbf9xjk46` FOREIGN KEY (`vocabulary_id`) REFERENCES `vocabulary_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assignments` (
`max_attempts` int(11) DEFAULT NULL,
  `pass_score` double DEFAULT NULL,
  `time_limit_minutes` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `due_date` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `class_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `lesson_id` varchar(36) DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `skill_type` enum('LISTENING','SPEAKING','READING','WRITING','VOCABULARY','GRAMMAR') NOT NULL,
  `audio_url` varchar(1000) DEFAULT NULL,
  `listening_script` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK15vvra255mh2h6merxffxmb2t` (`class_id`),
  KEY `FKj6l7dcv3gjrabhqjqsdolg78l` (`lesson_id`),
  CONSTRAINT `FK15vvra255mh2h6merxffxmb2t` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`),
  CONSTRAINT `FKj6l7dcv3gjrabhqjqsdolg78l` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assignment_questions` (
`order_index` int(11) NOT NULL,
  `points` double NOT NULL,
  `assignment_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `media_url` varchar(1000) DEFAULT NULL,
  `correct_answer` text DEFAULT NULL,
  `explanation` text DEFAULT NULL,
  `prompt_text` text NOT NULL,
  `transcript` text DEFAULT NULL,
  `question_type` enum('MULTIPLE_CHOICE','TRUE_FALSE','FILL_IN_BLANK','MATCHING','AUDIO_RESPONSE','ESSAY') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKhfepd59o3qem909sjpa4fblra` (`assignment_id`),
  CONSTRAINT `FKhfepd59o3qem909sjpa4fblra` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `question_options` (
`is_correct` bit(1) NOT NULL,
  `option_label` varchar(10) NOT NULL,
  `id` varchar(36) NOT NULL,
  `question_id` varchar(36) NOT NULL,
  `option_text` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKnxgjp3cfovw9yaud90tayhxqs` (`question_id`),
  CONSTRAINT `FKnxgjp3cfovw9yaud90tayhxqs` FOREIGN KEY (`question_id`) REFERENCES `assignment_questions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exercise_audios` (
`id` varchar(36) NOT NULL,
  `assignment_id` varchar(36) NOT NULL,
  `content_hash` varchar(64) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `duration_ms` bigint(20) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `exercise_type` enum('SHADOWING','LISTENING') NOT NULL,
  `generated_by` enum('SYSTEM','TEACHER','STUDENT_REPAIR') NOT NULL,
  `is_active` bit(1) NOT NULL,
  `question_id` varchar(36) NOT NULL,
  `segments` longtext DEFAULT NULL,
  `status` enum('PENDING','PROCESSING','READY','FAILED','BROKEN') NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `url` varchar(1000) DEFAULT NULL,
  `version` int(11) NOT NULL,
  `voice_config` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ex_audio_question` (`question_id`,`is_active`),
  KEY `idx_ex_audio_assignment` (`assignment_id`),
  KEY `idx_ex_audio_hash` (`content_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assignment_attempts` (
`attempt_number` int(11) NOT NULL,
  `duration_seconds` int(11) DEFAULT NULL,
  `total_score` double DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `started_at` datetime(6) NOT NULL,
  `submitted_at` datetime(6) DEFAULT NULL,
  `assignment_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `student_id` varchar(36) NOT NULL,
  `teacher_feedback` text DEFAULT NULL,
  `status` enum('IN_PROGRESS','SUBMITTED','GRADING','COMPLETED','TIMED_OUT') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKll9wi7lj5khvyfwgt6t90u3my` (`assignment_id`),
  KEY `FKfv22kpbca4eswfkvwxp9jdq23` (`student_id`),
  CONSTRAINT `FKfv22kpbca4eswfkvwxp9jdq23` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `FKll9wi7lj5khvyfwgt6t90u3my` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_answers` (
`earned_points` double DEFAULT NULL,
  `is_correct` bit(1) DEFAULT NULL,
  `attempt_id` varchar(36) NOT NULL,
  `id` varchar(36) NOT NULL,
  `question_id` varchar(36) NOT NULL,
  `audio_response_url` varchar(1000) DEFAULT NULL,
  `eval_feedback` text DEFAULT NULL,
  `text_response` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK6qaq0l42m1vh06v4k32xc24c9` (`attempt_id`),
  KEY `FKj6hr1ggn01u68c9vrrx5hx3co` (`question_id`),
  CONSTRAINT `FK6qaq0l42m1vh06v4k32xc24c9` FOREIGN KEY (`attempt_id`) REFERENCES `assignment_attempts` (`id`),
  CONSTRAINT `FKj6hr1ggn01u68c9vrrx5hx3co` FOREIGN KEY (`question_id`) REFERENCES `assignment_questions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ai_evaluations` (
`coherence_score` double DEFAULT NULL,
  `fluency_score` double DEFAULT NULL,
  `grammar_score` double DEFAULT NULL,
  `overall_score` double DEFAULT NULL,
  `pronunciation_score` double DEFAULT NULL,
  `tokens_used` int(11) DEFAULT NULL,
  `vocabulary_score` double DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `estimated_cefr` varchar(10) DEFAULT NULL,
  `id` varchar(36) NOT NULL,
  `student_answer_id` varchar(36) NOT NULL,
  `corrected_text` text DEFAULT NULL,
  `mistakes_json` text DEFAULT NULL,
  `stt_transcript` text DEFAULT NULL,
  `suggestions_json` text DEFAULT NULL,
  `eval_type` enum('SPEAKING','WRITING','COMPREHENSIVE_PROFILE') NOT NULL,
  `evaluation_engine` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_c43emcipga48d5kjvdkv0giw0` (`student_answer_id`),
  CONSTRAINT `FKfvanygjcswto8qxrj3s1pbgcq` FOREIGN KEY (`student_answer_id`) REFERENCES `student_answers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_skill_profiles` (
`grammar_score` double DEFAULT NULL,
  `listening_score` double DEFAULT NULL,
  `reading_score` double DEFAULT NULL,
  `speaking_score` double DEFAULT NULL,
  `vocabulary_score` double DEFAULT NULL,
  `writing_score` double DEFAULT NULL,
  `updated_at` datetime(6) NOT NULL,
  `id` varchar(36) NOT NULL,
  `ai_recommended_path` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `FKg00dwh67mvi1q0t8r1dg1bmb9` FOREIGN KEY (`id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_ai_quotas` (
`id` varchar(36) NOT NULL,
  `daily_limit` int(11) NOT NULL,
  `is_blocked` bit(1) NOT NULL,
  `last_reset_date` date NOT NULL,
  `used_today` int(11) NOT NULL,
  `student_id` varchar(36) NOT NULL,
  `completion_tokens_used` bigint(20) NOT NULL,
  `estimated_cost_usd` double NOT NULL,
  `prompt_tokens_used` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_k6tdsu47x0o4mo55abm885mf3` (`student_id`),
  CONSTRAINT `FK9t1d1driwmj9f02x9xkx55nb3` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `daily_study_plans` (
`id` varchar(36) NOT NULL,
  `day_number` int(11) NOT NULL,
  `estimated_minutes` int(11) DEFAULT NULL,
  `is_unlocked` bit(1) DEFAULT NULL,
  `scheduled_date` date NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `classroom_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKl72uafmdx9x2r3haxh32bliu8` (`classroom_id`),
  CONSTRAINT `FKl72uafmdx9x2r3haxh32bliu8` FOREIGN KEY (`classroom_id`) REFERENCES `classes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `daily_plan_items` (
`id` varchar(36) NOT NULL,
  `item_type` varchar(255) DEFAULT NULL,
  `order_index` int(11) DEFAULT NULL,
  `section_name` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `assignment_id` varchar(36) DEFAULT NULL,
  `daily_plan_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKdjytn1f6jh93mivwrxtd8lfjh` (`assignment_id`),
  KEY `FKhx86iplgu64gr7ft94abjp59k` (`daily_plan_id`),
  CONSTRAINT `FKdjytn1f6jh93mivwrxtd8lfjh` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`),
  CONSTRAINT `FKhx86iplgu64gr7ft94abjp59k` FOREIGN KEY (`daily_plan_id`) REFERENCES `daily_study_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `student_daily_progress` (
`id` varchar(36) NOT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `completed_items_count` int(11) DEFAULT NULL,
  `is_completed` bit(1) DEFAULT NULL,
  `total_items_count` int(11) DEFAULT NULL,
  `daily_plan_id` varchar(36) NOT NULL,
  `student_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKt3hbqhi6npxbyj1ujmklb2t98` (`daily_plan_id`),
  KEY `FKrjx6agaofohunhio7q25kckty` (`student_id`),
  CONSTRAINT `FKrjx6agaofohunhio7q25kckty` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `FKt3hbqhi6npxbyj1ujmklb2t98` FOREIGN KEY (`daily_plan_id`) REFERENCES `daily_study_plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ai_generated_exercises` (
`question_count` int(11) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `target_cefr` varchar(10) NOT NULL,
  `exercise_type` varchar(30) NOT NULL,
  `id` varchar(36) NOT NULL,
  `lesson_id` varchar(36) DEFAULT NULL,
  `teacher_id` varchar(36) NOT NULL,
  `raw_response_json` text NOT NULL,
  `status` enum('PENDING_GENERATION','READY_FOR_REVIEW','PUBLISHED','REJECTED') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKc3156o9mg3fr0ug5rki3b139c` (`lesson_id`),
  KEY `FKi5i7iou32samlfsgwb6ma67sx` (`teacher_id`),
  CONSTRAINT `FKc3156o9mg3fr0ug5rki3b139c` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`),
  CONSTRAINT `FKi5i7iou32samlfsgwb6ma67sx` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `global_resources` (
`id` varchar(36) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `name` varchar(255) NOT NULL,
  `resource_type` enum('DOC','VIDEO','EXAM') NOT NULL,
  `size_bytes` bigint(20) DEFAULT NULL,
  `storage_url` varchar(1000) NOT NULL,
  `used_count` int(11) DEFAULT NULL,
  `uploaded_by` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKswo3t2bxb41jaq2h66qv6n9o2` (`uploaded_by`),
  CONSTRAINT `FKswo3t2bxb41jaq2h66qv6n9o2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
`is_read` bit(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `id` varchar(36) NOT NULL,
  `recipient_id` varchar(36) NOT NULL,
  `title` varchar(200) NOT NULL,
  `target_url` varchar(500) DEFAULT NULL,
  `message` text NOT NULL,
  `type` enum('NEW_ASSIGNMENT','DEADLINE_REMINDER','VIDEO_APPROVED','VIDEO_REJECTED','NEW_GRADE','ANNOUNCEMENT','SYSTEM_ALERT') NOT NULL,
  `classroom_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKqqnsjxlwleyjbxlmm213jaj3f` (`recipient_id`),
  CONSTRAINT `FKqqnsjxlwleyjbxlmm213jaj3f` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
`created_at` datetime(6) NOT NULL,
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_name` varchar(100) DEFAULT NULL,
  `entity_id` varchar(255) DEFAULT NULL,
  `metadata_json` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKjs4iimve3y0xssbtve5ysyef0` (`user_id`),
  CONSTRAINT `FKjs4iimve3y0xssbtve5ysyef0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
