import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAuthenticatedContext(): TrpcContext {
  return {
    user: { id: 1, openId: "smart-bus-test", name: "Test Rider", email: "test@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Smart Bus public data contracts", () => {
  it("returns a typed transit snapshot when the official feed is not configured", async () => {
    const previous = process.env.WBTC_VEHICLE_FEED_URL;
    delete process.env.WBTC_VEHICLE_FEED_URL;
    const result = await appRouter.createCaller(createPublicContext()).transit.snapshot();
    if (previous) process.env.WBTC_VEHICLE_FEED_URL = previous;
    expect(result.source).toBe("not-configured");
    expect(result.vehicles).toEqual([]);
    expect(result.checkedAt).toEqual(expect.any(Number));
  });

  it("exposes community messages as an array for the public rider chat", async () => {
    const result = await appRouter.createCaller(createPublicContext()).community.list({ route: undefined });
    expect(Array.isArray(result)).toBe(true);
  });

  it("exposes close-person group profiles only through the authenticated router", async () => {
    const result = await appRouter.createCaller(createAuthenticatedContext()).group.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
