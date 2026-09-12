CREATE TABLE `saved_event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_slug` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_event_user_slug_idx` ON `saved_event` (`user_id`,`event_slug`);--> statement-breakpoint
CREATE INDEX `saved_event_user_idx` ON `saved_event` (`user_id`);