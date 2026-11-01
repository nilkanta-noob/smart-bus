CREATE TABLE `closeContacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`email` varchar(320),
	`relation` varchar(80),
	`route` varchar(32),
	`boardingStatus` enum('unknown','waiting','boarded') NOT NULL DEFAULT 'unknown',
	`lat` double,
	`lng` double,
	`locationSharing` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `closeContacts_id` PRIMARY KEY(`id`)
);
