import { afterEach, describe, expect, it } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import { GUEST_COOKIE_NAME } from "./_core/guestSession";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type CookieRecord = { name: string; value: string; options: Record<string, unknown> };
function anonymousContext() {
  const cookies: CookieRecord[] = [];
  const ctx: TrpcContext = { user: null, req: { protocol: "http", headers: {} } as TrpcContext["req"], res: { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) } as TrpcContext["res"] };
  return { ctx, cookies };
}
const previousDatabaseUrl = process.env.DATABASE_URL;
afterEach(() => { if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDatabaseUrl; });

describe("automatic guest access and private groups", () => {
  it("issues an unpredictable HttpOnly guest cookie without OAuth", async () => {
    delete process.env.DATABASE_URL;
    const { ctx, cookies } = anonymousContext();
    const guest = await appRouter.createCaller(ctx).auth.guestBootstrap();
    expect(guest.loginMethod).toBe("guest");
    expect(guest.name).toMatch(/^Guest-/);
    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe(GUEST_COOKIE_NAME);
    expect(cookies[0].value).toHaveLength(64);
    expect(cookies[0].options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookies[0].name).not.toBe(COOKIE_NAME);
  });

  it("keeps guest group data private and requires acceptance of an expiring invite", async () => {
    delete process.env.DATABASE_URL;
    const owner = await appRouter.createCaller(anonymousContext().ctx).auth.guestBootstrap();
    const ownerCaller = appRouter.createCaller({ ...anonymousContext().ctx, user: owner });
    const contact = await ownerCaller.group.add({ displayName: "Maa", relation: "Family" });
    const invitation = await ownerCaller.group.createInvite();
    expect(invitation.token).toMatch(/^[a-f0-9]{64}$/);

    const member = await appRouter.createCaller(anonymousContext().ctx).auth.guestBootstrap();
    const memberCaller = appRouter.createCaller({ ...anonymousContext().ctx, user: member });
    await memberCaller.group.acceptInvite({ token: invitation.token });
    expect((await memberCaller.group.list()).map((row) => row.id)).toContain(contact.id);

    const stranger = await appRouter.createCaller(anonymousContext().ctx).auth.guestBootstrap();
    const strangerCaller = appRouter.createCaller({ ...anonymousContext().ctx, user: stranger });
    expect(await strangerCaller.group.list()).toHaveLength(0);
    await ownerCaller.group.revokeInvite({ token: invitation.token });
    await expect(strangerCaller.group.acceptInvite({ token: invitation.token })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts untagged and manually tagged chat messages without creating a boarding", async () => {
    delete process.env.DATABASE_URL;
    const guest = await appRouter.createCaller(anonymousContext().ctx).auth.guestBootstrap();
    const caller = appRouter.createCaller({ ...anonymousContext().ctx, user: guest });
    const untagged = await caller.community.send({ body: "Waiting at the stop" });
    const tagged = await caller.community.send({ body: "AC-37 is delayed", route: "AC-37" });
    const explicitlyNull = await caller.community.send({ body: "Walking to the next stop", route: null });
    expect(untagged.route).toBeNull();
    expect(tagged.route).toBe("AC-37");
    expect(explicitlyNull.route).toBeNull();
    expect(await caller.boarding.current()).toBeFalsy();
  });
});
