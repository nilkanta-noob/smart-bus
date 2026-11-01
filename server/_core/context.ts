import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { GUEST_COOKIE_NAME, resolveMemoryGuestSession } from "./guestSession";
import { resolveDatabaseGuestSession } from "../db";
import { parse as parseCookieHeader } from "cookie";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const cookies = parseCookieHeader(opts.req.headers.cookie || "");
  let user: User | null = await resolveDatabaseGuestSession(cookies[GUEST_COOKIE_NAME]) || resolveMemoryGuestSession(cookies[GUEST_COOKIE_NAME]);
  if (!user) {
    try { user = await sdk.authenticateRequest(opts.req); }
    catch { user = null; }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
