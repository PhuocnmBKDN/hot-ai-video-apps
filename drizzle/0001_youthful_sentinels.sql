CREATE TABLE `deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`receipt_key` text,
	`receipt_hash` text,
	`reference` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_once` ON `deposits` (`receipt_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `deposit_reference_once` ON `deposits` (`reference`);--> statement-breakpoint
CREATE TABLE `wallet_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_source_once` ON `wallet_ledger` (`kind`,`source_id`);