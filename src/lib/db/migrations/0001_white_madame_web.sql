CREATE TABLE `findings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`scan_id` text,
	`pillar` text NOT NULL,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`confidence` text DEFAULT 'medium' NOT NULL,
	`title` text NOT NULL,
	`description_md` text NOT NULL,
	`suggested_fix_md` text,
	`evidence` text DEFAULT '[]' NOT NULL,
	`links` text DEFAULT '[]' NOT NULL,
	`score` integer,
	`dedupe_key` text NOT NULL,
	`assignee_id` text,
	`architecture_id` text,
	`first_seen_scan_id` text,
	`last_seen_scan_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`architecture_id`) REFERENCES `architectures`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `findings_project_idx` ON `findings` (`project_id`);--> statement-breakpoint
CREATE INDEX `findings_scan_idx` ON `findings` (`scan_id`);--> statement-breakpoint
CREATE INDEX `findings_pillar_severity_idx` ON `findings` (`pillar`,`severity`);--> statement-breakpoint
CREATE UNIQUE INDEX `findings_project_dedupe_idx` ON `findings` (`project_id`,`dedupe_key`);--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`label` text,
	`commit_sha` text,
	`branch_ref` text,
	`triggered_by_user_id` text,
	`summary` text,
	`error` text,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`triggered_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scans_project_idx` ON `scans` (`project_id`);--> statement-breakpoint
CREATE INDEX `scans_project_kind_idx` ON `scans` (`project_id`,`kind`);