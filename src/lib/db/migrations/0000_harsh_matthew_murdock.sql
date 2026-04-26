CREATE TABLE `architectures` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`level` text NOT NULL,
	`parent_architecture_id` text,
	`version` integer NOT NULL,
	`state` text DEFAULT 'Draft' NOT NULL,
	`title` text NOT NULL,
	`canonical` text NOT NULL,
	`llm_model` text,
	`generation_cost_usd` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`approved_at` integer,
	`approved_by` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `architectures_project_level_version_idx` ON `architectures` (`project_id`,`level`,`version`);--> statement-breakpoint
CREATE INDEX `architectures_parent_idx` ON `architectures` (`parent_architecture_id`);--> statement-breakpoint
CREATE TABLE `citations` (
	`id` text PRIMARY KEY NOT NULL,
	`architecture_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`snippet` text NOT NULL,
	`retrieved_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`used_in_decision_id` text,
	FOREIGN KEY (`architecture_id`) REFERENCES `architectures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_in_decision_id`) REFERENCES `decisions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `citations_architecture_idx` ON `citations` (`architecture_id`);--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`architecture_id` text NOT NULL,
	`question` text NOT NULL,
	`chosen` text NOT NULL,
	`rationale` text NOT NULL,
	`status` text DEFAULT 'Proposed' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`architecture_id`) REFERENCES `architectures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `decisions_architecture_idx` ON `decisions` (`architecture_id`);--> statement-breakpoint
CREATE TABLE `generated_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`architecture_id` text NOT NULL,
	`kind` text NOT NULL,
	`storage_path` text NOT NULL,
	`content_hash` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`architecture_id`) REFERENCES `architectures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generated_artifacts_architecture_idx` ON `generated_artifacts` (`architecture_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `generated_artifacts_kind_hash_idx` ON `generated_artifacts` (`architecture_id`,`kind`,`content_hash`);--> statement-breakpoint
CREATE TABLE `manual_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`architecture_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`field` text NOT NULL,
	`value` text NOT NULL,
	`pinned` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`architecture_id`) REFERENCES `architectures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `manual_edits_architecture_idx` ON `manual_edits` (`architecture_id`);--> statement-breakpoint
CREATE INDEX `manual_edits_target_idx` ON `manual_edits` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`problem_statement` text,
	`owner_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `projects_workspace_idx` ON `projects` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`architecture_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`decision` text NOT NULL,
	`comments` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`architecture_id`) REFERENCES `architectures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `reviews_architecture_idx` ON `reviews` (`architecture_id`);--> statement-breakpoint
CREATE TABLE `user_llm_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`nonce` text NOT NULL,
	`base_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_llm_keys_user_provider_label_idx` ON `user_llm_keys` (`user_id`,`provider`,`label`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`default_workspace_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`added_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_org_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_clerk_org_id_idx` ON `workspaces` (`clerk_org_id`);