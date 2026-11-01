import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { ENV } from "./_core/env";
import {
  boardingSessions,
  closeContacts,
  CloseContact,
  communityMessages,
  guestGroupInvitations,
  guestGroupMemberships,
  guestSessions,
  InsertUser,
  pushSubscriptions,
  userProfiles,
  UserProfile,
  users,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let nextMemoryId = 0;
const guestProfiles = new Map<number, UserProfile>();
const guestBoardings = new Map<number, Record<string, any>>();
const guestMessages: Array<Record<string, any>> = [];
const guestContacts = new Map<number, Array<Record<string, any>>>();
const guestMemberships = new Map<number, Set<number>>();
const guestInvitations = new Map<string, { ownerUserId: number; expiresAt: number; revoked: boolean }>();

const invitationHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createGuestGroupInvitation(ownerUserId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const db = await getDb();
  if (!db) guestInvitations.set(token, { ownerUserId, expiresAt: expiresAt.getTime(), revoked: false });
  else await db.insert(guestGroupInvitations).values({ ownerUserId, tokenHash: invitationHash(token), expiresAt });
  return { token, expiresAt };
}

export async function acceptGuestGroupInvitation(memberUserId: number, token: string) {
  const db = await getDb();
  if (!db) {
    const invite = guestInvitations.get(token);
    if (!invite || invite.revoked || invite.expiresAt <= Date.now() || invite.ownerUserId === memberUserId) return false;
    const members = guestMemberships.get(memberUserId) || new Set<number>(); members.add(invite.ownerUserId); guestMemberships.set(memberUserId, members); return true;
  }
  const rows = await db.select().from(guestGroupInvitations).where(and(eq(guestGroupInvitations.tokenHash, invitationHash(token)), gt(guestGroupInvitations.expiresAt, new Date()), isNull(guestGroupInvitations.revokedAt))).limit(1);
  const invite = rows[0];
  if (!invite || invite.ownerUserId === memberUserId) return false;
  await db.insert(guestGroupMemberships).values({ ownerUserId: invite.ownerUserId, memberUserId }).onDuplicateKeyUpdate({ set: { memberUserId } });
  return true;
}

export async function revokeGuestGroupInvitation(ownerUserId: number, token: string) {
  const db = await getDb();
  if (!db) { const invite = guestInvitations.get(token); if (!invite || invite.ownerUserId !== ownerUserId) return false; invite.revoked = true; return true; }
  await db.update(guestGroupInvitations).set({ revokedAt: new Date() }).where(and(eq(guestGroupInvitations.ownerUserId, ownerUserId), eq(guestGroupInvitations.tokenHash, invitationHash(token)), isNull(guestGroupInvitations.revokedAt)));
  return true;
}

async function groupOwnerIds(userId: number) {
  const db = await getDb();
  if (!db) return [userId, ...Array.from(guestMemberships.get(userId) || [])];
  const memberships = await db.select({ ownerUserId: guestGroupMemberships.ownerUserId }).from(guestGroupMemberships).where(eq(guestGroupMemberships.memberUserId, userId));
  return [userId, ...memberships.map((membership) => membership.ownerUserId)];
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createDatabaseGuestSession(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const token = randomBytes(32).toString("hex");
  await db.insert(guestSessions).values({ userId, tokenHash: invitationHash(token), expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) });
  return token;
}

export async function resolveDatabaseGuestSession(token?: string) {
  const db = await getDb();
  if (!db || !token) return null;
  const sessions = await db.select().from(guestSessions).where(and(eq(guestSessions.tokenHash, invitationHash(token)), gt(guestSessions.expiresAt, new Date()))).limit(1);
  const session = sessions[0];
  if (!session) return null;
  const usersFound = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return usersFound[0] || null;
}

export async function getProfile(userId: number) {
  const db = await getDb();
  if (!db) return guestProfiles.get(userId);
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function saveProfile(userId: number, patch: { displayName?: string; homeStop?: string; preferredTheme?: "light" | "dark"; notificationsEnabled?: number }) {
  const db = await getDb();
  if (!db) {
    const current = guestProfiles.get(userId);
    const now = new Date();
    const saved: UserProfile = { id: current?.id ?? --nextMemoryId, userId, displayName: patch.displayName ?? current?.displayName ?? null, homeStop: patch.homeStop ?? current?.homeStop ?? null, preferredTheme: patch.preferredTheme ?? current?.preferredTheme ?? "dark", notificationsEnabled: patch.notificationsEnabled ?? current?.notificationsEnabled ?? 1, createdAt: current?.createdAt ?? now, updatedAt: now };
    guestProfiles.set(userId, saved);
    return saved;
  }
  const current = await getProfile(userId);
  if (current) {
    await db.update(userProfiles).set({ ...patch, updatedAt: new Date() }).where(eq(userProfiles.userId, userId));
  } else {
    await db.insert(userProfiles).values({ userId, ...patch });
  }
  if (patch.displayName) await db.update(users).set({ name: patch.displayName }).where(eq(users.id, userId));
  return getProfile(userId);
}

export async function getActiveBoarding(userId: number) {
  const db = await getDb();
  if (!db) { const record = guestBoardings.get(userId); return record?.status === "active" ? record : undefined; }
  const result = await db.select().from(boardingSessions).where(and(eq(boardingSessions.userId, userId), eq(boardingSessions.status, "active"))).orderBy(desc(boardingSessions.boardedAt)).limit(1);
  return result[0];
}

export async function boardBus(userId: number, input: { route: string; vehicleId?: string; boardedStop?: string; destinationStop?: string }) {
  const db = await getDb();
  if (!db) {
    const existing = guestBoardings.get(userId);
    if (existing) Object.assign(existing, { status: "completed", completedAt: new Date() });
    guestBoardings.set(userId, { id: --nextMemoryId, userId, ...input, status: "active", boardedAt: new Date() });
    return guestBoardings.get(userId);
  }
  await db.update(boardingSessions).set({ status: "completed", completedAt: new Date() }).where(and(eq(boardingSessions.userId, userId), eq(boardingSessions.status, "active")));
  await db.insert(boardingSessions).values({ userId, ...input, status: "active" });
  return getActiveBoarding(userId);
}

export async function completeBoarding(userId: number, id: number) {
  const db = await getDb();
  if (!db) { const record = guestBoardings.get(userId); if (record?.id === id) Object.assign(record, { status: "completed", completedAt: new Date() }); return getActiveBoarding(userId); }
  await db.update(boardingSessions).set({ status: "completed", completedAt: new Date() }).where(and(eq(boardingSessions.id, id), eq(boardingSessions.userId, userId)));
  return getActiveBoarding(userId);
}

export async function listCommunityMessages(route?: string) {
  const db = await getDb();
  if (!db) return guestMessages.filter((message) => !route || message.route === route).slice(-60);
  const query = db.select({ id: communityMessages.id, userId: communityMessages.userId, route: communityMessages.route, body: communityMessages.body, createdAt: communityMessages.createdAt, userName: users.name }).from(communityMessages).leftJoin(users, eq(users.id, communityMessages.userId)).orderBy(desc(communityMessages.createdAt)).limit(60);
  const rows = route ? await query.where(eq(communityMessages.route, route)) : await query;
  return rows.reverse().map((row) => ({ ...row, userName: row.userName || "Guest rider" }));
}

export async function addCommunityMessage(userId: number, input: { body: string; route?: string; displayName?: string }) {
  const db = await getDb();
  if (!db) {
    const row = { id: --nextMemoryId, userId, userName: input.displayName || "Guest rider", route: input.route || null, body: input.body.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim(), createdAt: new Date() };
    guestMessages.push(row);
    return row;
  }
  const safeBody = input.body.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  await db.insert(communityMessages).values({ userId, body: safeBody, route: input.route?.trim() || null });
  const rows = await db.select({ id: communityMessages.id, userId: communityMessages.userId, route: communityMessages.route, body: communityMessages.body, createdAt: communityMessages.createdAt, userName: users.name }).from(communityMessages).leftJoin(users, eq(users.id, communityMessages.userId)).where(eq(communityMessages.userId, userId)).orderBy(desc(communityMessages.createdAt)).limit(1);
  return rows[0];
}

export async function registerPushSubscription(userId: number, input: { endpoint: string; p256dh?: string; auth?: string }) {
  const db = await getDb();
  if (!db) return { success: true } as const;
  await db.insert(pushSubscriptions).values({ userId, ...input }).onDuplicateKeyUpdate({ set: { userId, p256dh: input.p256dh, auth: input.auth } });
  return { success: true } as const;
}

export async function listCloseContacts(userId: number): Promise<Array<CloseContact & { groupOwnerId: number }>> {
  const db = await getDb();
  const owners = await groupOwnerIds(userId);
  if (!db) return owners.flatMap((ownerId) => (guestContacts.get(ownerId) || []).map((row) => ({ ...row, groupOwnerId: ownerId, ...(row.locationSharing ? {} : { lat: null, lng: null }) }))) as Array<CloseContact & { groupOwnerId: number }>;
  const rows = await db.select().from(closeContacts).where(inArray(closeContacts.userId, owners)).orderBy(desc(closeContacts.updatedAt));
  return rows.map((row) => ({ ...row, groupOwnerId: row.userId, ...(row.locationSharing ? {} : { lat: null, lng: null }) }));
}

export async function addCloseContact(userId: number, input: { displayName: string; email?: string; relation?: string }) {
  const db = await getDb();
  if (!db) {
    const records = guestContacts.get(userId) || [];
    const row = { id: --nextMemoryId, userId, ...input, route: null, boardingStatus: "unknown", lat: null, lng: null, locationSharing: 0, createdAt: new Date(), updatedAt: new Date() };
    records.unshift(row); guestContacts.set(userId, records); return row;
  }
  await db.insert(closeContacts).values({ userId, ...input, boardingStatus: "unknown", locationSharing: 0 });
  const rows = await db.select().from(closeContacts).where(eq(closeContacts.userId, userId)).orderBy(desc(closeContacts.createdAt)).limit(1);
  return rows[0];
}

export async function updateCloseContact(userId: number, input: { id: number; route?: string; boardingStatus?: "unknown" | "waiting" | "boarded"; lat?: number; lng?: number; locationSharing?: number }) {
  const db = await getDb();
  if (!db) {
    const ownerIds = await groupOwnerIds(userId);
    const row = ownerIds.flatMap((ownerId) => guestContacts.get(ownerId) || []).find((contact) => contact.id === input.id);
    if (!row) return undefined;
    Object.assign(row, { route: input.route, boardingStatus: input.boardingStatus, ...(input.locationSharing === 0 ? { locationSharing: 0, lat: null, lng: null } : { ...(input.locationSharing === undefined ? {} : { locationSharing: input.locationSharing }), ...(input.lat === undefined ? {} : { lat: input.lat }), ...(input.lng === undefined ? {} : { lng: input.lng }) }), updatedAt: new Date() });
    return row.locationSharing ? row : { ...row, lat: null, lng: null };
  }
  const { id, locationSharing, lat, lng, route, boardingStatus } = input;
  const existing = await db.select().from(closeContacts).where(eq(closeContacts.id, id)).limit(1);
  const rowToUpdate = existing[0];
  if (!rowToUpdate) return undefined;
  const owners = await groupOwnerIds(userId);
  if (!owners.includes(rowToUpdate.userId)) return undefined;
  const sharingPatch = locationSharing === 0 ? { locationSharing: 0, lat: null, lng: null } : { ...(locationSharing === undefined ? {} : { locationSharing }), ...(lat === undefined ? {} : { lat }), ...(lng === undefined ? {} : { lng }) };
  await db.update(closeContacts).set({ route, boardingStatus, ...sharingPatch, updatedAt: new Date() }).where(and(eq(closeContacts.id, id), eq(closeContacts.userId, rowToUpdate.userId)));
  const rows = await db.select().from(closeContacts).where(and(eq(closeContacts.id, id), eq(closeContacts.userId, rowToUpdate.userId))).limit(1);
  const row = rows[0];
  return row && !row.locationSharing ? { ...row, lat: null, lng: null } : row;
}
