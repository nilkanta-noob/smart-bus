import { COOKIE_NAME } from "@shared/const";
import { ONE_YEAR_MS } from "@shared/const";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { GUEST_COOKIE_NAME, createMemoryGuestSession } from "./_core/guestSession";
import { updateMemoryGuestName } from "./_core/guestSession";
import { TRPCError } from "@trpc/server";
import {
  addCommunityMessage,
  addCloseContact,
  acceptGuestGroupInvitation,
  boardBus,
  completeBoarding,
  getActiveBoarding,
  getProfile,
  createGuestGroupInvitation,
  createDatabaseGuestSession,
  listCommunityMessages,
  listCloseContacts,
  registerPushSubscription,
  revokeGuestGroupInvitation,
  saveProfile,
  updateCloseContact,
} from "./db";

const profileInput = z.object({
  displayName: z.string().trim().max(120).optional(),
  homeStop: z.string().trim().max(160).optional(),
  preferredTheme: z.enum(["light", "dark"]).optional(),
  notificationsEnabled: z.number().int().min(0).max(1).optional(),
});
const messageTimes = new Map<number, number[]>();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    guestBootstrap: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) return ctx.user;
      const name = `Guest-${randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
      const { getDb, upsertUser, getUserByOpenId } = await import("./db");
      const db = await getDb();
      const forwardedProto = String(ctx.req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
      const secure = ENV.isProduction || ctx.req.secure || forwardedProto === "https";
      if (db) {
        const openId = `guest_${randomUUID()}`;
        await upsertUser({ openId, name, loginMethod: "guest", lastSignedIn: new Date() });
        const user = await getUserByOpenId(openId);
        if (user) {
          if (ENV.cookieSecret && ENV.appId) {
            const token = await sdk.createSessionToken(openId, { name, expiresInMs: ONE_YEAR_MS });
            ctx.res.cookie(COOKIE_NAME, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: ONE_YEAR_MS });
          } else {
            const token = await createDatabaseGuestSession(user.id);
            if (!token) throw new Error("Guest session storage is unavailable");
            ctx.res.cookie(GUEST_COOKIE_NAME, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: ONE_YEAR_MS });
          }
          return user;
        }
      }
      const { token, user } = createMemoryGuestSession(name);
      ctx.res.cookie(GUEST_COOKIE_NAME, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: ONE_YEAR_MS });
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  transit: router({
    snapshot: publicProcedure.query(async () => {
      const feedUrl = process.env.WBTC_VEHICLE_FEED_URL;
      if (!feedUrl) return { source: "not-configured" as const, checkedAt: Date.now(), vehicles: [] };
      try {
        const response = await fetch(feedUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as any;
        const raw = Array.isArray(payload) ? payload : payload.vehicles ?? payload.data ?? [];
        const vehicles = raw.map((item: any, index: number) => ({
          id: String(item.id ?? item.vehicle_id ?? item.vehicle?.id ?? index),
          route: String(item.route ?? item.route_id ?? item.trip?.route_id ?? "WBTC"),
          lat: Number(item.lat ?? item.latitude ?? item.position?.latitude),
          lng: Number(item.lng ?? item.lon ?? item.longitude ?? item.position?.longitude),
          bearing: Number(item.bearing ?? item.heading ?? item.position?.bearing),
          speed: Number(item.speed ?? item.position?.speed),
          updatedAt: item.updated_at ?? item.timestamp ?? new Date().toISOString(),
        })).filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
        return { source: "official-feed" as const, checkedAt: Date.now(), vehicles };
      } catch (error) {
        console.warn("[Transit] WBTC feed unavailable", error);
        return { source: "error" as const, checkedAt: Date.now(), vehicles: [] };
      }
    }),
  }),
  profile: router({
    get: protectedProcedure.query(({ ctx }) => getProfile(ctx.user.id)),
    save: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
      if (input.displayName && ctx.user.loginMethod === "guest") updateMemoryGuestName(ctx.user.id, input.displayName);
      return saveProfile(ctx.user.id, input);
    }),
  }),
  boarding: router({
    current: protectedProcedure.query(({ ctx }) => getActiveBoarding(ctx.user.id)),
    board: protectedProcedure.input(z.object({ route: z.string().min(1).max(32), vehicleId: z.string().max(100).optional(), boardedStop: z.string().max(160).optional(), destinationStop: z.string().max(160).optional() })).mutation(({ ctx, input }) => boardBus(ctx.user.id, input)),
    complete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => completeBoarding(ctx.user.id, input.id)),
  }),
  community: router({
    list: publicProcedure.input(z.object({ route: z.string().optional() }).optional()).query(({ input }) => listCommunityMessages(input?.route)),
    send: protectedProcedure.input(z.object({ body: z.string().trim().min(1).max(500), route: z.string().trim().max(32).nullable().optional() })).mutation(({ ctx, input }) => {
      const now = Date.now();
      const previous = (messageTimes.get(ctx.user.id) || []).filter((time) => now - time < 30_000);
      if (previous.length >= 5) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please wait before sending another rider update." });
      previous.push(now); messageTimes.set(ctx.user.id, previous);
      return addCommunityMessage(ctx.user.id, { body: input.body, route: input.route?.trim() || undefined, displayName: ctx.user.name || "Guest rider" });
    }),
  }),
  push: router({
    register: protectedProcedure.input(z.object({ endpoint: z.string().url(), p256dh: z.string().optional(), auth: z.string().optional() })).mutation(({ ctx, input }) => registerPushSubscription(ctx.user.id, input)),
  }),
  group: router({
    list: protectedProcedure.query(({ ctx }) => listCloseContacts(ctx.user.id)),
    add: protectedProcedure.input(z.object({ displayName: z.string().trim().min(1).max(120), email: z.string().email().optional(), relation: z.string().trim().max(80).optional() })).mutation(({ ctx, input }) => addCloseContact(ctx.user.id, input)),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), route: z.string().trim().max(32).optional(), boardingStatus: z.enum(["unknown", "waiting", "boarded"]).optional(), lat: z.number().optional(), lng: z.number().optional(), locationSharing: z.number().int().min(0).max(1).optional() })).mutation(({ ctx, input }) => updateCloseContact(ctx.user.id, input)),
    createInvite: protectedProcedure.mutation(({ ctx }) => createGuestGroupInvitation(ctx.user.id)),
    acceptInvite: protectedProcedure.input(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) })).mutation(async ({ ctx, input }) => {
      const accepted = await acceptGuestGroupInvitation(ctx.user.id, input.token);
      if (!accepted) throw new TRPCError({ code: "BAD_REQUEST", message: "This invite is invalid, expired, or revoked." });
      return { accepted: true };
    }),
    revokeInvite: protectedProcedure.input(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) })).mutation(({ ctx, input }) => revokeGuestGroupInvitation(ctx.user.id, input.token)),
  }),
});

export type AppRouter = typeof appRouter;
