import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, double, uniqueIndex } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), displayName: varchar("displayName", { length: 120 }), homeStop: varchar("homeStop", { length: 160 }), preferredTheme: mysqlEnum("preferredTheme", ["light", "dark"]).default("dark").notNull(), notificationsEnabled: int("notificationsEnabled").default(1).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const boardingSessions = mysqlTable("boardingSessions", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), route: varchar("route", { length: 32 }).notNull(), vehicleId: varchar("vehicleId", { length: 100 }), boardedStop: varchar("boardedStop", { length: 160 }), destinationStop: varchar("destinationStop", { length: 160 }), status: mysqlEnum("status", ["active", "completed"]).default("active").notNull(), boardedAt: timestamp("boardedAt").defaultNow().notNull(), completedAt: timestamp("completedAt"),
});

export const communityMessages = mysqlTable("communityMessages", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), route: varchar("route", { length: 32 }), body: text("body").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const pushSubscriptions = mysqlTable("pushSubscriptions", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), endpoint: varchar("endpoint", { length: 768 }).notNull().unique(), p256dh: text("p256dh"), auth: text("auth"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const closeContacts = mysqlTable("closeContacts", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), displayName: varchar("displayName", { length: 120 }).notNull(), email: varchar("email", { length: 320 }), relation: varchar("relation", { length: 80 }), route: varchar("route", { length: 32 }), boardingStatus: mysqlEnum("boardingStatus", ["unknown", "waiting", "boarded"]).default("unknown").notNull(), lat: double("lat"), lng: double("lng"), locationSharing: int("locationSharing").default(0).notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const guestGroupMemberships = mysqlTable("guestGroupMemberships", {
  id: int("id").autoincrement().primaryKey(), ownerUserId: int("ownerUserId").notNull(), memberUserId: int("memberUserId").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ ownerMemberUnique: uniqueIndex("guestGroupMemberships_owner_member_uq").on(table.ownerUserId, table.memberUserId) }));

export const guestGroupInvitations = mysqlTable("guestGroupInvitations", {
  id: int("id").autoincrement().primaryKey(), ownerUserId: int("ownerUserId").notNull(), tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(), expiresAt: timestamp("expiresAt").notNull(), revokedAt: timestamp("revokedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const guestSessions = mysqlTable("guestSessions", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(), expiresAt: timestamp("expiresAt").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type BoardingSession = typeof boardingSessions.$inferSelect;
export type CommunityMessage = typeof communityMessages.$inferSelect;
export type CloseContact = typeof closeContacts.$inferSelect;
