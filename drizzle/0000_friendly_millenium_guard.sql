CREATE TABLE `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`object_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episode_number` ON `episodes` (`series_id`,`number`);--> statement-breakpoint
CREATE TABLE `grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`series_id` text NOT NULL,
	`order_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_grant` ON `grants` (`user_id`,`series_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`series_id` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`reference` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_bank_reference` ON `orders` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_pending_order` ON `orders` (`user_id`,`series_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE TABLE `series` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`genre` text NOT NULL,
	`total` integer NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
