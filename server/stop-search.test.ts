import { describe, expect, it } from "vitest";
import { WBTC_ROUTES } from "../client/src/wbtc-routes";
import { WBTC_STOP_INDEX, diagnoseTripRoutes, matchingRoutes, resolveStopReference, searchWbtcStops } from "../client/src/lib/stop-search";

describe("WBTC stop search and ordered route matching", () => {
  it("indexes the complete stop directory and returns canonical IDs for suggestions", () => {
    const result = searchWbtcStops("Esplanade");
    expect(WBTC_STOP_INDEX.length).toBeGreaterThan(100);
    expect(result[0]?.stopId).toBeTruthy();
    expect(resolveStopReference(result[0].name)?.stopId).toBe(result[0].stopId);
  });

  it("finds ordered route matches without requiring map geometry", () => {
    const route = WBTC_ROUTES.find((item) => item.route === "V1");
    expect(route).toBeDefined();
    const first = resolveStopReference(route!.origin)!;
    const last = resolveStopReference(route!.destination)!;
    const matches = matchingRoutes(first.stopId, last.stopId);
    expect(matches.some((match) => match.route.route === "V1")).toBe(true);
    expect(matches.every((match) => match.originIndex < match.destinationIndex)).toBe(true);
  });

  it("returns all routes for a shared journey and the only route for a route-specific journey", () => {
    const esplanade = resolveStopReference("Esplanade")!;
    const howrah = resolveStopReference("Howrah")!;
    expect(matchingRoutes(esplanade.stopId, howrah.stopId).length).toBeGreaterThan(1);
    const origin = resolveStopReference("Bichalighat")!;
    const destination = resolveStopReference("Bikash Bhavan")!;
    expect(matchingRoutes(origin.stopId, destination.stopId).map((match) => match.route.route)).toEqual(["14A"]);
  });

  it("resolves confirmed spelling aliases to the same canonical planner stop", () => {
    expect(resolveStopReference("Subod Mallick Squre")?.stopId).toBe(resolveStopReference("Subodh Mallick Square")?.stopId);
  });

  it("does not treat a route journey in reverse stop order as valid", () => {
    const route = WBTC_ROUTES.find((item) => item.route === "V1")!;
    const origin = resolveStopReference(route.destination)!;
    const destination = resolveStopReference(route.origin)!;
    expect(matchingRoutes(origin.stopId, destination.stopId).some((match) => match.route.route === "V1")).toBe(false);
    expect(diagnoseTripRoutes(origin.stopId, destination.stopId).find((item) => item.route === "V1")?.code).toBe("WRONG_STOP_ORDER");
  });

  it("keeps Karunamoyee and Unnayan Bhavan as separate Route 14A stops", () => {
    const route = WBTC_ROUTES.find((item) => item.route === "14A")!;
    const matches = matchingRoutes(resolveStopReference("Karunamoyee")?.stopId || "", resolveStopReference("Unnayan Bhavan")?.stopId || "");
    expect(route.stops).toContain("Karunamoyee-Unnayan Bhavan");
    expect(matches.some((match) => match.route.route === "14A")).toBe(true);
  });
});
