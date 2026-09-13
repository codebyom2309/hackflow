CREATE TABLE `accounts` (
	`userId` varchar(36) NOT NULL,
	`type` varchar(255) NOT NULL,
	`provider` varchar(255) NOT NULL,
	`providerAccountId` varchar(255) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` int,
	`token_type` varchar(255),
	`scope` varchar(255),
	`id_token` text,
	`session_state` varchar(255),
	CONSTRAINT `accounts_provider_providerAccountId_pk` PRIMARY KEY(`provider`,`providerAccountId`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`priority` enum('LOW','NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL',
	`target_role` enum('ALL','PARTICIPANT','COORDINATOR','JUDGE') DEFAULT 'ALL',
	`created_by` varchar(36) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` varchar(36) NOT NULL,
	`team_id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`checked_in_by` varchar(36) NOT NULL,
	`check_in_method` enum('QR_SCAN','MANUAL','JUDGE_SCAN') NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`checked_in_at` timestamp DEFAULT (now()),
	`undone_at` timestamp,
	`undone_by` varchar(36),
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(50) NOT NULL,
	`entity_id` varchar(36),
	`details` json,
	`ip_address` varchar(45),
	`user_agent` varchar(512),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificate_templates` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('PARTICIPANT','WINNER','RUNNER_UP','FINALIST','SPECIAL','VOLUNTEER','JUDGE','COORDINATOR') NOT NULL,
	`background_css` text,
	`background_image_url` varchar(512),
	`field_layout` json,
	`dimensions` json,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `certificate_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`team_id` varchar(36) NOT NULL,
	`recipient_name` varchar(255) NOT NULL,
	`recipient_email` varchar(255),
	`type` enum('PARTICIPANT','WINNER','RUNNER_UP','FINALIST','SPECIAL','VOLUNTEER','JUDGE','COORDINATOR') NOT NULL,
	`verification_code` varchar(64) NOT NULL,
	`template_id` varchar(36),
	`file_key` varchar(512),
	`generated_at` timestamp,
	`downloaded_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_verification_code_unique` UNIQUE(`verification_code`),
	CONSTRAINT `idx_certificates_verification` UNIQUE(`verification_code`)
);
--> statement-breakpoint
CREATE TABLE `desks` (
	`id` varchar(36) NOT NULL,
	`room_id` varchar(36) NOT NULL,
	`desk_number` int NOT NULL,
	`capacity` int NOT NULL DEFAULT 4,
	`is_allocated` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `desks_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_desk` UNIQUE(`room_id`,`desk_number`)
);
--> statement-breakpoint
CREATE TABLE `evaluation_criteria` (
	`id` varchar(36) NOT NULL,
	`round_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`max_points` int NOT NULL,
	`weight` decimal(5,2) NOT NULL DEFAULT '1.00',
	`display_order` int NOT NULL DEFAULT 0,
	`is_required` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evaluation_criteria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_memberships` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`role` enum('ORGANIZER','COORDINATOR','JUDGE','PARTICIPANT') NOT NULL,
	`invitation_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_membership` UNIQUE(`user_id`,`event_id`,`role`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` varchar(36) NOT NULL,
	`organizer_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`min_team_size` int NOT NULL DEFAULT 1,
	`max_team_size` int NOT NULL DEFAULT 5,
	`max_teams` int,
	`winners_count` int NOT NULL DEFAULT 3,
	`registration_method` enum('NATIVE','EXTERNAL') NOT NULL DEFAULT 'NATIVE',
	`external_form_url` varchar(512),
	`form_schema` json,
	`registration_opens` timestamp,
	`registration_closes` timestamp,
	`event_starts` timestamp,
	`event_ends` timestamp,
	`status` enum('DRAFT','REGISTRATION_OPEN','REGISTRATION_CLOSED','EVENT_READY','ROUND_ACTIVE','EVENT_COMPLETED') NOT NULL DEFAULT 'DRAFT',
	`active_round_id` varchar(36),
	`qr_secret` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `judge_assignments` (
	`id` varchar(36) NOT NULL,
	`judge_id` varchar(36) NOT NULL,
	`team_id` varchar(36) NOT NULL,
	`round_id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `judge_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_judge_team_round` UNIQUE(`judge_id`,`team_id`,`round_id`)
);
--> statement-breakpoint
CREATE TABLE `judgment_corrections` (
	`id` varchar(36) NOT NULL,
	`judgment_id` varchar(36) NOT NULL,
	`original_score` int NOT NULL,
	`corrected_score` int NOT NULL,
	`corrected_by` varchar(36) NOT NULL,
	`reason` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `judgment_corrections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `judgment_scores` (
	`id` varchar(36) NOT NULL,
	`team_id` varchar(36) NOT NULL,
	`judge_id` varchar(36) NOT NULL,
	`round_id` varchar(36) NOT NULL,
	`criteria_id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`score` int NOT NULL,
	`idempotency_key` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `judgment_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_judgment` UNIQUE(`team_id`,`judge_id`,`round_id`,`criteria_id`)
);
--> statement-breakpoint
CREATE TABLE `role_invitations` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`role` enum('COORDINATOR','JUDGE') NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_by` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`max_uses` int DEFAULT 1,
	`use_count` int NOT NULL DEFAULT 0,
	`is_revoked` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `role_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`room_number` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_room` UNIQUE(`event_id`,`room_number`)
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`round_number` int NOT NULL,
	`title` varchar(255),
	`starts_at` timestamp,
	`ends_at` timestamp,
	`problem_reveal_at` timestamp,
	`submission_deadline` timestamp,
	`problem_statements` json,
	`shortlist_count` int,
	`retain_desks` boolean NOT NULL DEFAULT true,
	`status` enum('DRAFT','SUBMISSION_OPEN','SUBMISSION_LOCKED','JUDGING','RESULTS_PENDING','RESULTS_PUBLISHED') NOT NULL DEFAULT 'DRAFT',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rounds_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_round_number` UNIQUE(`event_id`,`round_number`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`sessionToken` varchar(255) NOT NULL,
	`userId` varchar(36) NOT NULL,
	`expires` timestamp NOT NULL,
	CONSTRAINT `sessions_sessionToken` PRIMARY KEY(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `shortlists` (
	`id` varchar(36) NOT NULL,
	`team_id` varchar(36) NOT NULL,
	`round_id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`calculated_rank` int NOT NULL,
	`final_rank` int,
	`total_score` decimal(10,2) NOT NULL,
	`is_advancing` boolean NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `shortlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_shortlist` UNIQUE(`team_id`,`round_id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` varchar(36) NOT NULL,
	`team_id` varchar(36) NOT NULL,
	`round_id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`github_url` varchar(512),
	`ppt_file_key` varchar(512),
	`ppt_filename` varchar(255),
	`ppt_file_size` int,
	`problem_statement_id` varchar(36),
	`is_locked` boolean NOT NULL DEFAULT false,
	`submitted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_submission` UNIQUE(`team_id`,`round_id`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` varchar(36) NOT NULL,
	`team_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(20),
	`is_leader` boolean NOT NULL DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_member_email_team` UNIQUE(`team_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`leader_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`member_count` int NOT NULL,
	`desk_id` varchar(36),
	`status` enum('REGISTERED','WAITLISTED','CHECKED_IN','ACTIVE','SHORTLISTED','ELIMINATED','FINALIST','WINNER') NOT NULL DEFAULT 'REGISTERED',
	`qr_token` varchar(255) NOT NULL,
	`form_responses` json,
	`project_name` varchar(255),
	`project_description` text,
	`leader_email` varchar(255),
	`leader_phone` varchar(20),
	`college` varchar(255),
	`theme` varchar(255),
	`problem_statement` text,
	`current_round_id` varchar(36),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `teams_qr_token_unique` UNIQUE(`qr_token`),
	CONSTRAINT `uq_team_name` UNIQUE(`event_id`,`name`),
	CONSTRAINT `uq_team_leader` UNIQUE(`event_id`,`leader_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255),
	`email` varchar(255) NOT NULL,
	`emailVerified` timestamp,
	`image` varchar(512),
	`provider` varchar(50) NOT NULL DEFAULT 'google',
	`provider_id` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires` timestamp NOT NULL,
	CONSTRAINT `verification_tokens_identifier_token_pk` PRIMARY KEY(`identifier`,`token`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_checked_in_by_users_id_fk` FOREIGN KEY (`checked_in_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificate_templates` ADD CONSTRAINT `certificate_templates_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `desks` ADD CONSTRAINT `desks_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evaluation_criteria` ADD CONSTRAINT `evaluation_criteria_round_id_rounds_id_fk` FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_memberships` ADD CONSTRAINT `event_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_memberships` ADD CONSTRAINT `event_memberships_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_organizer_id_users_id_fk` FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judge_assignments` ADD CONSTRAINT `judge_assignments_judge_id_users_id_fk` FOREIGN KEY (`judge_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judge_assignments` ADD CONSTRAINT `judge_assignments_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judge_assignments` ADD CONSTRAINT `judge_assignments_round_id_rounds_id_fk` FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judge_assignments` ADD CONSTRAINT `judge_assignments_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judgment_corrections` ADD CONSTRAINT `judgment_corrections_judgment_id_judgment_scores_id_fk` FOREIGN KEY (`judgment_id`) REFERENCES `judgment_scores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judgment_corrections` ADD CONSTRAINT `judgment_corrections_corrected_by_users_id_fk` FOREIGN KEY (`corrected_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judgment_scores` ADD CONSTRAINT `judgment_scores_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judgment_scores` ADD CONSTRAINT `judgment_scores_judge_id_users_id_fk` FOREIGN KEY (`judge_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judgment_scores` ADD CONSTRAINT `judgment_scores_round_id_rounds_id_fk` FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judgment_scores` ADD CONSTRAINT `judgment_scores_criteria_id_evaluation_criteria_id_fk` FOREIGN KEY (`criteria_id`) REFERENCES `evaluation_criteria`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `judgment_scores` ADD CONSTRAINT `judgment_scores_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_invitations` ADD CONSTRAINT `role_invitations_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_invitations` ADD CONSTRAINT `role_invitations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rounds` ADD CONSTRAINT `rounds_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortlists` ADD CONSTRAINT `shortlists_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortlists` ADD CONSTRAINT `shortlists_round_id_rounds_id_fk` FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortlists` ADD CONSTRAINT `shortlists_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_round_id_rounds_id_fk` FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_leader_id_users_id_fk` FOREIGN KEY (`leader_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_desk_id_desks_id_fk` FOREIGN KEY (`desk_id`) REFERENCES `desks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_announcements_event` ON `announcements` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_attendance_team` ON `attendance_records` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_attendance_event` ON `attendance_records` (`event_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_audit_event` ON `audit_logs` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `idx_cert_templates_event` ON `certificate_templates` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_cert_templates_type` ON `certificate_templates` (`event_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_certificates_team` ON `certificates` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_certificates_event` ON `certificates` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_desks_room` ON `desks` (`room_id`);--> statement-breakpoint
CREATE INDEX `idx_desks_available` ON `desks` (`room_id`,`is_allocated`,`capacity`);--> statement-breakpoint
CREATE INDEX `idx_criteria_round` ON `evaluation_criteria` (`round_id`);--> statement-breakpoint
CREATE INDEX `idx_membership_event_role` ON `event_memberships` (`event_id`,`role`);--> statement-breakpoint
CREATE INDEX `idx_membership_user` ON `event_memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_events_slug` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_events_organizer` ON `events` (`organizer_id`);--> statement-breakpoint
CREATE INDEX `idx_events_status` ON `events` (`status`);--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_judge` ON `judge_assignments` (`judge_id`,`round_id`);--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_team` ON `judge_assignments` (`team_id`,`round_id`);--> statement-breakpoint
CREATE INDEX `idx_judge_assignments_event` ON `judge_assignments` (`event_id`,`round_id`);--> statement-breakpoint
CREATE INDEX `idx_corrections_judgment` ON `judgment_corrections` (`judgment_id`);--> statement-breakpoint
CREATE INDEX `idx_judgment_team_round` ON `judgment_scores` (`team_id`,`round_id`);--> statement-breakpoint
CREATE INDEX `idx_judgment_judge` ON `judgment_scores` (`judge_id`,`round_id`);--> statement-breakpoint
CREATE INDEX `idx_judgment_event_round` ON `judgment_scores` (`event_id`,`round_id`);--> statement-breakpoint
CREATE INDEX `idx_invitation_token` ON `role_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invitation_event` ON `role_invitations` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_rooms_event` ON `rooms` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_rounds_event` ON `rounds` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_shortlist_round` ON `shortlists` (`round_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `idx_shortlist_rank` ON `shortlists` (`event_id`,`round_id`,`final_rank`);--> statement-breakpoint
CREATE INDEX `idx_submissions_round` ON `submissions` (`round_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `idx_members_team` ON `team_members` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_teams_event` ON `teams` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_teams_desk` ON `teams` (`desk_id`);--> statement-breakpoint
CREATE INDEX `idx_teams_status` ON `teams` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_teams_qr` ON `teams` (`qr_token`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_provider` ON `users` (`provider`,`provider_id`);