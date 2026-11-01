import type { Express } from "express";
import { ENV } from "./env";

const cache = new Map<string, { savedAt: number; result: unknown }>();
const MAX_CACHE = 1000;
const normalize = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const above = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + Number(a[i - 1] !== b[j - 1])); diagonal = above; }
  }
  return row[b.length];
}
function stopNameMatchScore(requested: string, formatted: string) {
  const target = normalize(requested).split(" ").filter((part) => part.length > 2 && !["kolkata", "west", "bengal", "india"].includes(part));
  const returned = new Set(normalize(formatted).split(" "));
  if (!target.length) return 0;
  const matches = target.filter((word) => Array.from(returned).some((candidate) => candidate.includes(word) || word.includes(candidate) || (Math.min(word.length, candidate.length) > 4 && editDistance(word, candidate) <= 1)));
  return /kolkata|howrah/i.test(formatted) ? matches.length / target.length : 0;
}
type Candidate = { latitude: number; longitude: number; placeId?: string; formattedAddress: string; score: number; source: "geocoding-v4" | "places-new" };
function candidateScore(name: string, formatted: string, lat?: number, lng?: number) {
  const score = stopNameMatchScore(name, formatted);
  return score >= 0.6 && Number.isFinite(lat) && Number.isFinite(lng) && lat! >= 22.2 && lat! <= 23.1 && lng! >= 87.8 && lng! <= 88.8 ? score : 0;
}
function ambiguousDistance(first: Candidate, second: Candidate) {
  return second.score >= first.score - 0.05 && Math.hypot((first.latitude - second.latitude) * 111, (first.longitude - second.longitude) * 102) > 0.5;
}

export function registerGeocodeProxy(app: Express) {
  app.post("/api/maps/geocode-stop", async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const context = req.body?.context && typeof req.body.context === "object" ? req.body.context as { previous?: { lat: number; lng: number }; next?: { lat: number; lng: number } } : {};
    if (!name || name.length > 140) return res.status(400).json({ error: "A stop name under 140 characters is required." });
    if (!ENV.googleMapsApiKey) return res.status(503).json({ error: "Google Maps geocoding is not configured." });
    const key = `${normalize(name)}:${[context.previous, context.next].map((point) => point && `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`).join("|")}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.savedAt < 30 * 24 * 60 * 60 * 1000) return res.json({ ...cached.result as object, cached: true });
    try {
      const address = `${name}, Kolkata, West Bengal, India`;
      const url = new URL(`https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address)}`);
      url.searchParams.set("regionCode", "IN");
      url.searchParams.set("languageCode", "en");
      const neighbors = [context.previous, context.next].filter((point): point is { lat: number; lng: number } => !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng));
      const center = neighbors.length ? { lat: neighbors.reduce((sum, point) => sum + point.lat, 0) / neighbors.length, lng: neighbors.reduce((sum, point) => sum + point.lng, 0) / neighbors.length } : { lat: 22.65, lng: 88.35 };
      const offsetLat = neighbors.length ? 0.06 : 0.45, offsetLng = neighbors.length ? 0.08 : 0.5;
      url.searchParams.set("locationBias.rectangle.low.latitude", String(center.lat - offsetLat));
      url.searchParams.set("locationBias.rectangle.low.longitude", String(center.lng - offsetLng));
      url.searchParams.set("locationBias.rectangle.high.latitude", String(center.lat + offsetLat));
      url.searchParams.set("locationBias.rectangle.high.longitude", String(center.lng + offsetLng));
      url.searchParams.set("key", ENV.googleMapsApiKey);
      const geocodeResponse = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const geocodePayload = geocodeResponse.ok ? await geocodeResponse.json() as { results?: Array<{ location?: { latitude?: number; longitude?: number }; placeId?: string; formattedAddress?: string }> } : null;
      const geocodeMatches: Candidate[] = (geocodePayload?.results || []).map((candidate) => ({ latitude: candidate.location?.latitude || 0, longitude: candidate.location?.longitude || 0, placeId: candidate.placeId, formattedAddress: candidate.formattedAddress || "", score: candidateScore(name, candidate.formattedAddress || "", candidate.location?.latitude, candidate.location?.longitude), source: "geocoding-v4" as const })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
      let candidates = geocodeMatches;
      let placesQuota = false;
      if (!geocodeMatches.length || (geocodeMatches[1] && ambiguousDistance(geocodeMatches[0], geocodeMatches[1]))) {
        const placesResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST", signal: AbortSignal.timeout(12000),
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": ENV.googleMapsApiKey, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location" },
          body: JSON.stringify({ textQuery: address, languageCode: "en", regionCode: "IN", locationBias: { rectangle: { low: { latitude: 22.2, longitude: 87.8 }, high: { latitude: 23.1, longitude: 88.8 } } } }),
        });
        const placesBody = await placesResponse.json() as { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }>; error?: { status?: string; message?: string } };
        const placesPayload = placesResponse.ok ? placesBody : null;
        placesQuota = placesResponse.status === 429 || (placesResponse.status === 403 && placesBody.error?.status === "RESOURCE_EXHAUSTED");
        const placeMatches: Candidate[] = (placesPayload?.places || []).map((place) => ({ latitude: place.location?.latitude || 0, longitude: place.location?.longitude || 0, placeId: place.id, formattedAddress: place.formattedAddress || place.displayName?.text || "", score: candidateScore(name, `${place.displayName?.text || ""} ${place.formattedAddress || ""}`, place.location?.latitude, place.location?.longitude), source: "places-new" as const })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
        if (placeMatches.length) candidates = placeMatches;
        else if (placesQuota) return res.status(429).json({ error: "Google Places demo quota is exhausted for today." });
        else if (!placesResponse.ok) {
          console.warn(`[Maps] Places API request was denied (${placesResponse.status}): ${placesBody.error?.status || placesBody.error?.message || "unknown error"}`);
          if (!geocodeResponse.ok && (geocodeResponse.status === 429 || geocodeResponse.status === 403)) return res.status(429).json({ error: "Google Geocoding quota is exhausted, and Places API is not available for this key." });
        }
      }
      const match = candidates[0];
      if (match && candidates[1] && ambiguousDistance(match, candidates[1])) return res.status(409).json({ error: `Google returned multiple plausible Kolkata matches for ${name}; this stop needs manual verification.` });
      if (!match) {
        if (!geocodeResponse.ok && (geocodeResponse.status === 429 || geocodeResponse.status === 403) && placesQuota) return res.status(429).json({ error: "Google Geocoding and Places demo quotas are exhausted for today." });
        return res.status(404).json({ error: `Google Geocoding and Places returned no confidently matching Kolkata result for ${name}.` });
      }
      const result = { latitude: match.latitude, longitude: match.longitude, placeId: match.placeId, formattedAddress: match.formattedAddress, source: match.source, verified: true, confidence: match.score };
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      cache.set(key, { savedAt: Date.now(), result });
      return res.json(result);
    } catch (error) {
      console.warn("[Maps] Geocoding request failed", error instanceof Error ? error.message : "unknown error");
      return res.status(502).json({ error: "Google Geocoding request failed." });
    }
  });
}
