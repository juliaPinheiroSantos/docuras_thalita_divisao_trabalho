CREATE TABLE `login_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone` text NOT NULL,
	`password_hash` text,
	`password_salt` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_login_credentials_phone` ON `login_credentials` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_login_credentials_user_id` ON `login_credentials` (`user_id`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `credential_id` text REFERENCES login_credentials(id);--> statement-breakpoint
CREATE INDEX `idx_sessions_credential_id` ON `sessions` (`credential_id`);