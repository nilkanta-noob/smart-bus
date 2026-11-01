import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRoadRouteGeometry, positionAlongRoute } from "../client/src/lib/route-geometry";
import type { StopMarker } from "../client/src/lib/kolkata-stops";
import { getRouteStopSegments, getRouteStopsAndPath, resolveStop } from "../client/src/lib/kolkata-stops";
import { rankTripOptions, simulationAtElapsed } from "../client/src/lib/route-simulation";
import { WBTC_ROUTES } from "../client/src/wbtc-routes";

function encodePolyline(points: Array<{ lat: number; lng: number }>) {
  let previousLat = 0;
  let previousLng = 0;
  const output: string[] = [];
  const encodeValue = (value: number) => {
    let encoded = value < 0 ? ~(value << 1) : value << 1;
    while (encoded >= 0x20) {
      output.push(String.fromCharCode((0x20 | (encoded & 0x1f)) + 63));
      encoded >>= 5;
    }
    output.push(String.fromCharCode(encoded + 63));
  };
  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);
    encodeValue(lat - previousLat);
    encodeValue(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  }
  return output.join("");
}

describe("road route geometry", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("chunks long routes at 25 intermediates and stitches the shared stop once", async () => {
    const stops: StopMarker[] = Array.from({ length: 28 }, (_, index) => ({
      label: `Stop ${index}`,
      coord: { lat: 22 + index * 0.001, lng: 88 + index * 0.001 },
      kind: index === 0 ? "origin" : index === 27 ? "destination" : "stop",
      index,
    }));
    const requests: Array<{ origin: { lat: number; lng: number }; destination: { lat: number; lng: number }; intermediates: Array<{ lat: number; lng: number }> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as typeof requests[number];
      requests.push(request);
      const points = [request.origin, ...request.intermediates, request.destination];
      const legs = points.slice(1).map((point, index) => ({
        distanceMeters: 150,
        polyline: { encodedPolyline: encodePolyline([points[index], point]) },
      }));
      return new Response(JSON.stringify({ routes: [{ distanceMeters: legs.length * 150, legs }] }), { status: 200 });
    }));

    const { geometry, cached } = await getRoadRouteGeometry("LONG", stops);
    expect(cached).toBe(false);
    expect(requests).toHaveLength(2);
    expect(requests[0].intermediates).toHaveLength(25);
    expect(requests[1].intermediates).toHaveLength(0);
    expect(requests[0].destination).toEqual(requests[1].origin);
    expect(geometry.stopDistancesMeters).toHaveLength(stops.length);
    expect(geometry.path[0]).toEqual(stops[0].coord);
    expect(geometry.path[geometry.path.length - 1]).toEqual(stops[27].coord);

    const again = await getRoadRouteGeometry("LONG", stops);
    expect(again.cached).toBe(true);
    expect(requests).toHaveLength(2);
  });

  it("returns a local interpolated position and only travelled geometry", () => {
    const path = [{ lat: 22.5, lng: 88.3 }, { lat: 22.51, lng: 88.31 }, { lat: 22.52, lng: 88.32 }];
    const start = positionAlongRoute(path, 0);
    const middle = positionAlongRoute(path, 800);
    const end = positionAlongRoute(path, 100000);
    expect(start.travelledPath).toHaveLength(1);
    expect(middle.travelledPath.length).toBeGreaterThan(1);
    expect(middle.travelledPath.length).toBeLessThan(path.length);
    expect(end.position).toEqual(path[path.length - 1]);
    expect(end.travelledPath).toEqual(path);
    expect(middle.heading).toBeGreaterThanOrEqual(0);
    expect(middle.heading).toBeLessThan(360);
  });

  it("uses verified V1 coordinates only and reports the remaining stops", () => {
    const route = WBTC_ROUTES.find((candidate) => candidate.route === "V1");
    expect(route).toBeDefined();
    const resolved = getRouteStopsAndPath(route!.origin, route!.stops, route!.destination);
    expect(resolved.unresolvedStops.length).toBeGreaterThan(0);
    expect(resolved.stopMarkers.every((stop) => resolveStop(stop.label))).toBe(true);
    const partial = getRouteStopSegments(route!.origin, route!.stops, route!.destination);
    expect(partial.unresolvedStops).toContain(route!.origin);
  });

  it("resolves confirmed Subod spellings to the same verified stop", () => {
    expect(resolveStop("Subod Mallick Squre")).toEqual(resolveStop("Subodh Mallick Square"));
    expect(resolveStop("SUBODH MALLICK SQ.")).toEqual(resolveStop("Subodh Mallick Square"));
  });

  it("keeps mapped road sections separated by an unresolved stop", () => {
    const result = getRouteStopSegments("Esplanade", "Park street-Unknown Stop-Moulali.-Sealdah", "Sealdah");
    expect(result.unresolvedStops).toEqual(["Unknown Stop"]);
    expect(result.segments.map((segment) => segment.map((stop) => stop.label))).toEqual([["Esplanade", "Park street"], ["Moulali.", "Sealdah"]]);
  });

  it("derives fleet progress from elapsed session time and stop dwell", () => {
    const at10Seconds = simulationAtElapsed([0, 1000, 2000], 2000, 10);
    expect(at10Seconds.travelledMeters).toBeCloseTo(83.33, 1);
    const duringDwell = simulationAtElapsed([0, 1000, 2000], 2000, 123);
    expect(duringDwell.status).toBe("at-stop");
    expect(duringDwell.dwellRemainingSeconds).toBeCloseTo(2, 1);
    expect(simulationAtElapsed([0, 1000, 2000], 2000, 250).status).toBe("completed");
  });

  it("ranks journeys by bus wait plus in-vehicle time", () => {
    const ranked = rankTripOptions([{ route: "A", boardSeconds: 120, rideSeconds: 900, totalSeconds: 1020 }, { route: "B", boardSeconds: 360, rideSeconds: 480, totalSeconds: 840 }]);
    expect(ranked.map((option) => option.route)).toEqual(["B", "A"]);
  });
});
