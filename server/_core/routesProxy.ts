import type { Express } from "express";
import { ENV } from "./env";

type Point = { lat: number; lng: number };
type RouteRequest = { origin: Point; destination: Point; intermediates: Point[] };
type CachedResponse = { expiresAt: number; body: unknown };

const responseCache = new Map<string, CachedResponse>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Point;
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
    point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
}

function pointToWaypoint(point: Point) {
  return { location: { latLng: { latitude: point.lat, longitude: point.lng } } };
}

export function registerRoutesProxy(app: Express) {
  app.post("/api/maps/compute-routes", async (req, res) => {
    const input = req.body as Partial<RouteRequest>;
    if (!isPoint(input?.origin) || !isPoint(input?.destination) ||
        !Array.isArray(input?.intermediates) || input.intermediates.length > 25 ||
        !input.intermediates.every(isPoint)) {
      res.status(400).json({ error: "Provide valid origin, destination, and up to 25 ordered intermediate waypoints." });
      return;
    }
    const apiKey = (req.headers["x-goog-api-key"] as string) ||
                   (req.headers["x-google-maps-api-key"] as string) ||
                   process.env.GOOGLE_MAPS_API_KEY ||
                   process.env.VITE_GOOGLE_MAPS_API_KEY ||
                   ENV.googleMapsApiKey;

    if (!apiKey) {
      res.status(503).json({ error: "Google Maps API Key is not configured for Compute Routes." });
      return;
    }

    const key = JSON.stringify(input);
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      responseCache.delete(key);
      responseCache.set(key, cached);
      res.set("X-Route-Cache", "HIT").json(cached.body);
      return;
    }

    try {
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: pointToWaypoint(input.origin),
          destination: pointToWaypoint(input.destination),
          intermediates: input.intermediates.map(pointToWaypoint),
          travelMode: "DRIVE",
          computeAlternativeRoutes: false,
          optimizeWaypointOrder: false,
          polylineQuality: "HIGH_QUALITY",
          units: "METRIC",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const status = response.status === 429 ? 429 : response.status;
        const detail = (body as { error?: { message?: string; status?: string } }).error;
        const quota = response.status === 429 || detail?.status === "RESOURCE_EXHAUSTED";
        res.status(status).json({
          error: quota
            ? "Google Maps Demo Key daily quota is exhausted. Try again tomorrow."
            : detail?.message || "Google Compute Routes could not calculate this path.",
          code: detail?.status || response.status,
        });
        return;
      }

      responseCache.set(key, { body, expiresAt: Date.now() + CACHE_TTL_MS });
      while (responseCache.size > MAX_CACHE_ENTRIES) {
        const oldest = responseCache.keys().next().value;
        if (oldest === undefined) break;
        responseCache.delete(oldest);
      }
      res.set("Cache-Control", "private, max-age=86400").set("X-Route-Cache", "MISS").json(body);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      res.status(502).json({ error: timedOut ? "Google Compute Routes timed out. Retry the route." : "Could not reach Google Compute Routes." });
    }
  });
}
