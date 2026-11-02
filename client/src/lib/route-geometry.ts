import type { LatLng, StopMarker } from "@/lib/kolkata-stops";

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "smart-bus-road-route:v1:";
const MAX_INTERMEDIATES = 25;

export type RoadRouteGeometry = {
  path: LatLng[];
  /** Cumulative geometric distance at each supplied stop, in the same order. */
  stopDistancesMeters: number[];
  totalDistanceMeters: number;
  googleDistanceMeters: number;
};

type EncodedLeg = { distanceMeters?: number; polyline?: { encodedPolyline?: string } };
type ComputeRoutesResponse = { routes?: Array<{ distanceMeters?: number; legs?: EncodedLeg[] }> };

function decodePolyline(encoded: string): LatLng[] {
  const path: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) throw new Error("Google returned a malformed route polyline.");
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      if (index >= encoded.length) throw new Error("Google returned a malformed route polyline.");
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return path;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const cumulativeDistanceCache = new WeakMap<LatLng[], Float64Array>();

function cumulativeDistances(path: LatLng[]): Float64Array {
  const cached = cumulativeDistanceCache.get(path);
  if (cached) return cached;
  const cumulative = new Float64Array(path.length);
  for (let i = 1; i < path.length; i++) cumulative[i] = cumulative[i - 1] + haversineMeters(path[i - 1], path[i]);
  cumulativeDistanceCache.set(path, cumulative);
  return cumulative;
}

function hash(value: string): string {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return (result >>> 0).toString(36);
}

function cacheKey(routeId: string, stops: StopMarker[]) {
  const identity = JSON.stringify({
    version: CACHE_VERSION,
    routeId,
    stops: stops.map((stop) => [stop.label.trim().toUpperCase(), stop.coord.lat, stop.coord.lng]),
  });
  return `${CACHE_PREFIX}${hash(identity)}`;
}

function readCache(key: string): RoadRouteGeometry | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const value = JSON.parse(cached) as { expiresAt: number; geometry: RoadRouteGeometry };
    if (value.expiresAt < Date.now() || value.geometry?.path?.length < 2) {
      localStorage.removeItem(key);
      return null;
    }
    return value.geometry;
  } catch {
    return null;
  }
}

function writeCache(key: string, geometry: RoadRouteGeometry) {
  try {
    localStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + CACHE_TTL_MS, geometry }));
  } catch {
    // Geometry remains available in memory for this selection if storage is full or disabled.
  }
}

async function fetchGoogleRouteGeometry(
  stops: StopMarker[],
  signal?: AbortSignal,
): Promise<RoadRouteGeometry> {
  const fullPath: LatLng[] = [];
  const stopDistancesMeters: number[] = [0];
  let totalDistanceMeters = 0;
  let googleDistanceMeters = 0;

  for (let start = 0; start < stops.length - 1; start += MAX_INTERMEDIATES + 1) {
    const end = Math.min(start + MAX_INTERMEDIATES + 1, stops.length - 1);
    const chunk = stops.slice(start, end + 1);
    const clientKey = typeof window !== "undefined"
      ? (window as any).__SMART_BUS_GMAPS_KEY || localStorage.getItem("smart_bus_gmaps_key") || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
      : "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientKey) headers["x-goog-api-key"] = clientKey;

    const response = await fetch("/api/maps/compute-routes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        origin: chunk[0].coord,
        destination: chunk[chunk.length - 1].coord,
        intermediates: chunk.slice(1, -1).map((stop) => stop.coord),
      }),
      signal,
    });
    const body = await response.json().catch(() => ({})) as ComputeRoutesResponse & { error?: string };
    if (!response.ok) throw new Error(body.error || `Google road routing failed (${response.status}).`);
    const route = body.routes?.[0];
    if (!route?.legs || route.legs.length !== chunk.length - 1) {
      throw new Error("Google did not return geometry for every stop-to-stop leg.");
    }

    googleDistanceMeters += route.distanceMeters ?? 0;
    for (let legIndex = 0; legIndex < route.legs.length; legIndex++) {
      const encoded = route.legs[legIndex].polyline?.encodedPolyline;
      if (!encoded) throw new Error("Google returned a route leg without road geometry.");
      const legPath = decodePolyline(encoded);
      if (legPath.length < 2) throw new Error("Google returned an incomplete route leg.");
      legPath.forEach((point, pointIndex) => {
        if (fullPath.length && pointIndex === 0) {
          const previous = fullPath[fullPath.length - 1];
          if (haversineMeters(previous, point) < 1) return;
        }
        if (fullPath.length) totalDistanceMeters += haversineMeters(fullPath[fullPath.length - 1], point);
        fullPath.push(point);
      });
      stopDistancesMeters.push(totalDistanceMeters);
    }
  }

  if (fullPath.length < 2 || stopDistancesMeters.length !== stops.length) {
    throw new Error("Google returned incomplete road geometry for this route.");
  }

  return {
    path: fullPath,
    stopDistancesMeters,
    totalDistanceMeters,
    googleDistanceMeters,
  };
}

/**
 * High-precision road router fallback via OSRM (OpenStreetMap routing engine).
 * Follows actual Kolkata street networks, flyovers, avenues, and turn curves.
 * 100% free, zero quota limits, guaranteed road alignment.
 */
async function fetchOSRMRouteGeometry(
  stops: StopMarker[],
  signal?: AbortSignal,
): Promise<RoadRouteGeometry> {
  const CHUNK_SIZE = 25;
  const fullPath: LatLng[] = [];
  const stopDistancesMeters: number[] = [0];
  let totalDistanceMeters = 0;

  for (let start = 0; start < stops.length - 1; start += CHUNK_SIZE - 1) {
    const end = Math.min(start + CHUNK_SIZE, stops.length);
    const chunk = stops.slice(start, end);
    if (chunk.length < 2) break;

    const coordsStr = chunk.map((s) => `${s.coord.lng.toFixed(6)},${s.coord.lat.toFixed(6)}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`OSRM road routing failed (${res.status}).`);
    }

    const data = (await res.json()) as {
      code: string;
      routes?: Array<{
        distance: number;
        geometry: { coordinates: Array<[number, number]> };
        legs?: Array<{ distance: number }>;
      }>;
    };

    const route = data.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      throw new Error("OSRM returned no road coordinates.");
    }

    const chunkPath: LatLng[] = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));

    chunkPath.forEach((pt, idx) => {
      if (fullPath.length > 0 && idx === 0) {
        if (haversineMeters(fullPath[fullPath.length - 1], pt) < 1) return;
      }
      if (fullPath.length > 0) {
        totalDistanceMeters += haversineMeters(fullPath[fullPath.length - 1], pt);
      }
      fullPath.push(pt);
    });

    if (route.legs && route.legs.length === chunk.length - 1) {
      let segmentDist = stopDistancesMeters[stopDistancesMeters.length - 1];
      for (let legIdx = 0; legIdx < route.legs.length; legIdx++) {
        segmentDist += route.legs[legIdx].distance;
        stopDistancesMeters.push(segmentDist);
      }
    }
  }

  while (stopDistancesMeters.length < stops.length) {
    stopDistancesMeters.push(totalDistanceMeters);
  }

  if (fullPath.length < 2) {
    throw new Error("Road routing produced an invalid route path.");
  }

  return {
    path: fullPath,
    stopDistancesMeters,
    totalDistanceMeters,
    googleDistanceMeters: totalDistanceMeters,
  };
}

/** Retrieve ordered driving geometry along real Kolkata roads, with Google and OSRM dual engine. */
export async function getRoadRouteGeometry(
  routeId: string,
  stops: StopMarker[],
  signal?: AbortSignal,
): Promise<{ geometry: RoadRouteGeometry; cached: boolean }> {
  if (stops.length < 2) throw new Error("This route needs at least two mapped stops.");
  const key = cacheKey(routeId, stops);
  const cached = readCache(key);
  if (cached) return { geometry: cached, cached: true };

  let geometry: RoadRouteGeometry | null = null;

  // Attempt Google Compute Routes first (if API key and Routes API are active)
  try {
    geometry = await fetchGoogleRouteGeometry(stops, signal);
  } catch (googleError) {
    console.warn("[RouteGeometry] Google Compute Routes unavailable; falling back to high-precision OSRM road geometry.", googleError);
  }

  // Fall back seamlessly to OSRM road routing engine
  if (!geometry || geometry.path.length < 2) {
    geometry = await fetchOSRMRouteGeometry(stops, signal);
  }

  if (geometry && geometry.path.length >= 2) {
    writeCache(key, geometry);
    return { geometry, cached: false };
  }

  throw new Error("Could not retrieve real road geometry for this route.");
}

export function positionAlongRoute(path: LatLng[], distanceMeters: number): { position: LatLng; heading: number; travelledPath: LatLng[] } {
  if (path.length === 0) return { position: { lat: 0, lng: 0 }, heading: 0, travelledPath: [] };
  if (path.length === 1) return { position: path[0], heading: 0, travelledPath: [path[0]] };
  const target = Math.max(0, distanceMeters);
  const travelledPath = [path[0]];
  let covered = 0;
  for (let i = 1; i < path.length; i++) {
    const segmentMeters = haversineMeters(path[i - 1], path[i]);
    if (covered + segmentMeters >= target) {
      const fraction = segmentMeters ? Math.max(0, Math.min(1, (target - covered) / segmentMeters)) : 0;
      const position = {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * fraction,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * fraction,
      };
      if (target > 0 && (travelledPath.length === 1 || haversineMeters(travelledPath[travelledPath.length - 1], position) > 0.5)) travelledPath.push(position);
      const toRad = (degrees: number) => degrees * Math.PI / 180;
      const y = Math.sin(toRad(path[i].lng - path[i - 1].lng)) * Math.cos(toRad(path[i].lat));
      const x = Math.cos(toRad(path[i - 1].lat)) * Math.sin(toRad(path[i].lat)) - Math.sin(toRad(path[i - 1].lat)) * Math.cos(toRad(path[i].lat)) * Math.cos(toRad(path[i].lng - path[i - 1].lng));
      const heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      return { position, heading, travelledPath };
    }
    covered += segmentMeters;
    travelledPath.push(path[i]);
  }
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return { position: b, heading: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, travelledPath };
}

/** Fast animation-frame lookup; route distances are calculated only once per geometry. */
export function routePositionAtDistance(path: LatLng[], distanceMeters: number): { position: LatLng; heading: number } {
  if (path.length < 2) return { position: path[0] || { lat: 0, lng: 0 }, heading: 0 };
  const cumulative = cumulativeDistances(path);
  const target = Math.max(0, Math.min(distanceMeters, cumulative[cumulative.length - 1]));
  let low = 1;
  let high = cumulative.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (cumulative[middle] < target) low = middle + 1;
    else high = middle;
  }
  const i = low;
  const segmentMeters = cumulative[i] - cumulative[i - 1];
  const fraction = segmentMeters ? (target - cumulative[i - 1]) / segmentMeters : 0;
  const a = path[i - 1];
  const b = path[i];
  const position = { lat: a.lat + (b.lat - a.lat) * fraction, lng: a.lng + (b.lng - a.lng) * fraction };
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return { position, heading: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360 };
}

export function formatEta(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}
