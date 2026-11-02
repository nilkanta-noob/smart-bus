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

async function computeOSRMRouteFallback(origin: Point, destination: Point, intermediates: Point[]) {
  const waypoints = [origin, ...intermediates, destination];
  const coordsStr = waypoints.map((pt) => `${pt.lng.toFixed(6)},${pt.lat.toFixed(6)}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = (await res.json()) as any;
  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates) throw new Error("No OSRM geometry");

  const coords: Array<{ lat: number; lng: number }> = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => ({ lat, lng })
  );

  const legs = (route.legs || []).map((leg: any, idx: number) => {
    const startIdx = Math.floor((idx / (route.legs.length || 1)) * coords.length);
    const endIdx = Math.floor(((idx + 1) / (route.legs.length || 1)) * coords.length);
    const legCoords = coords.slice(startIdx, Math.max(endIdx + 1, startIdx + 2));
    return {
      distanceMeters: Math.round(leg.distance || 0),
      polyline: {
        encodedPolyline: encodePolyline(legCoords.length >= 2 ? legCoords : coords),
      },
    };
  });

  return {
    routes: [
      {
        distanceMeters: Math.round(route.distance || 0),
        duration: `${Math.round(route.duration || 0)}s`,
        polyline: { encodedPolyline: encodePolyline(coords) },
        legs,
      },
    ],
  };
}

export function registerRoutesProxy(app: Express) {
  app.get("/api/maps/config", (_req, res) => {
    const rawKey =
      (process.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
      (process.env.GOOGLE_MAPS_API_KEY as string) ||
      ENV.googleMapsApiKey ||
      "";
    const apiKey = rawKey.trim();
    res.json({
      configured: apiKey.length > 0,
      apiKey,
    });
  });

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

    const key = JSON.stringify(input);
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      responseCache.delete(key);
      responseCache.set(key, cached);
      res.set("X-Route-Cache", "HIT").json(cached.body);
      return;
    }

    if (apiKey) {
      try {
        const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          signal: AbortSignal.timeout(15000),
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

        if (response.ok) {
          const body = await response.json();
          responseCache.set(key, { body, expiresAt: Date.now() + CACHE_TTL_MS });
          while (responseCache.size > MAX_CACHE_ENTRIES) {
            const oldest = responseCache.keys().next().value;
            if (oldest === undefined) break;
            responseCache.delete(oldest);
          }
          res.set("Cache-Control", "private, max-age=86400").set("X-Route-Cache", "MISS").json(body);
          return;
        }
      } catch (err) {
        console.warn("[RoutesProxy] Google Compute Routes failed, falling back to OSRM:", err);
      }
    }

    // High-performance real road routing fallback via OSRM
    try {
      const osrmBody = await computeOSRMRouteFallback(input.origin, input.destination, input.intermediates);
      responseCache.set(key, { body: osrmBody, expiresAt: Date.now() + CACHE_TTL_MS });
      res.set("Cache-Control", "private, max-age=86400").set("X-Route-Cache", "OSRM").json(osrmBody);
    } catch (fallbackError) {
      console.error("[RoutesProxy] Both Google and OSRM routing failed:", fallbackError);
      res.status(502).json({ error: "Could not compute road path for this route." });
    }
  });
}
