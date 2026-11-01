import { randomBytes } from "node:crypto";
import type { User } from "../../drizzle/schema";

export const GUEST_COOKIE_NAME = "smartbus_guest_session";
const sessions = new Map<string, { user: User; expiresAt: number }>();
let nextId = 0;

export function createMemoryGuestSession(name: string) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const user = {
    id: -(++nextId), openId: `guest_mem_${randomBytes(16).toString("hex")}`, name, email: null,
    loginMethod: "guest", role: "user" as const, createdAt: now, updatedAt: now, lastSignedIn: now,
  } as User;
  sessions.set(token, { user, expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 });
  return { token, user };
}

export function resolveMemoryGuestSession(token?: string) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) { sessions.delete(token); return null; }
  return session.user;
}

export function updateMemoryGuestName(userId: number, name: string) {
  sessions.forEach((session) => { if (session.user.id === userId) session.user.name = name; });
}
