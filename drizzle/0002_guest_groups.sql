CREATE TABLE `guestGroupInvitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guestGroupInvitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `guestGroupInvitations_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `guestGroupMemberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`memberUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guestGroupMemberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `guestGroupMemberships_owner_member_uq` UNIQUE(`ownerUserId`,`memberUserId`)
);
--> statement-breakpoint
CREATE TABLE `guestSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guestSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `guestSessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
