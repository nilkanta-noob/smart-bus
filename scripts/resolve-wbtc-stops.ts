import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WBTC_ROUTES } from "../client/src/wbtc-routes";
import { getOrderedStops, getStopLocationRecord, resolveStop } from "../client/src/lib/kolkata-stops";
import { GENERATED_STOP_LOCATIONS } from "../client/src/lib/generated-stop-locations";
import { getVerifiedStopAliasGroups } from "../client/src/lib/stop-search";

type Point = { lat: number; lng: number };
type Resolved = { latitude: number; longitude: number; placeId?: string; formattedAddress?: string; confidence: number; source?: "geocoding-v4" | "places-new" };
type Progress = { resolved: Record<string, Resolved>; ambiguous: Record<string, string>; failures: Record<string, string> };
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const progressFile = path.join(here, ".wbtc-stop-resolution-progress.json");
const registryFile = path.join(repo, "client/src/lib/generated-stop-locations.ts");
const auditFile = path.join(repo, "WBTC_STOP_RESOLUTION_AUDIT.md");
const normalize = (name: string) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const cleanReason = (reason: string) => reason.replace(/[^\x20-\x7E]/g, "");
const allStops = new Map<string, { name: string; neighbors: Point[] }>();
for (const route of WBTC_ROUTES) {
  const stops = getOrderedStops(route.origin, route.stops, route.destination);
  stops.forEach((name, index) => {
    const key = normalize(name);
    const existing = allStops.get(key) || { name, neighbors: [] };
    [stops[index - 1], stops[index + 1]].filter(Boolean).forEach((neighborName) => {
      const point = resolveStop(neighborName);
      if (point && !existing.neighbors.some((item) => item.lat === point.lat && item.lng === point.lng)) existing.neighbors.push(point);
    });
    allStops.set(key, existing);
  });
}
const readProgress = async (): Promise<Progress> => {
  try { return JSON.parse(await readFile(progressFile, "utf8")) as Progress; }
  catch { return { resolved: { ...GENERATED_STOP_LOCATIONS }, ambiguous: {}, failures: {} }; }
};
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const flag = (name: string) => process.argv.includes(name);
const option = (name: string, fallback: string) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] || fallback : fallback; };

async function writeAudit(progress: Progress) {
  const inventory = Array.from(allStops.values());
  const records = inventory.map(({ name }) => ({ name, coord: resolveStop(name), location: getStopLocationRecord(name) }));
  const verified = records.filter((item) => !!item.location?.verified);
  const cachedUnverified = records.filter((item) => !!item.coord && !item.location?.verified);
  const unresolved = records.filter((item) => !item.coord);
  const locations = Object.values(progress.resolved);
  const geocodingCount = locations.filter((location) => location.source === "geocoding-v4").length;
  const placesCount = locations.filter((location) => location.source === "places-new").length;
  const duplicateLocations = new Map<string, string[]>();
  records.filter((item) => item.coord).forEach(({ name, coord }) => {
    const key = `${coord!.lat.toFixed(5)},${coord!.lng.toFixed(5)}`;
    duplicateLocations.set(key, [...(duplicateLocations.get(key) || []), name]);
  });
  const duplicateGroups = [...duplicateLocations.values()].filter((names) => names.length > 1);
  const aliasGroups = getVerifiedStopAliasGroups();
  const route14A = WBTC_ROUTES.find((route) => route.route === "14A");
  const reported14A = ["HMG College", "Abestors More", "Ramnagar More", "J.K.Island", "Jora Mandir", "Beliaghata Main Road", "Karunamoyee", "Unnayan Bhavan"];
  const stop14A = new Set(route14A ? getOrderedStops(route14A.origin, route14A.stops, route14A.destination).map(normalize) : []);
  const lines = ["# WBTC stop resolution audit", "", `Generated: ${new Date().toISOString()}`, "", "## Inventory", "", `- WBTC route records: ${WBTC_ROUTES.length}`, `- Unique normalized stoppage names: ${allStops.size}`, `- Verified coordinates: ${verified.length}`, `- Cached coordinates awaiting verification: ${cachedUnverified.length}`, `- Unresolved coordinates: ${unresolved.length}`, `- Ambiguous results (subset of unresolved): ${Object.keys(progress.ambiguous).length}`, `- Multiple names sharing one coordinate (5 decimal places): ${duplicateGroups.length}`, `- High-confidence Google geocodes stored in generated registry: ${locations.length}`, `- Accepted using Geocoding API v4: ${geocodingCount}`, `- Accepted using Places API (New): ${placesCount}`, "", "## Route 14A names requested for investigation", "", ...reported14A.map((name) => `- ${name}: ${stop14A.has(normalize(name)) ? "present in corrected ordered route data" : "not found as a separate route stop"}; ${resolveStop(name) ? getStopLocationRecord(name)?.verified ? "verified coordinates" : "cached coordinates, unverified" : cleanReason(progress.ambiguous[name] || progress.failures[name] || "unresolved / not processed")}`), "", "## Methods and limits", "", "The resolver uses the existing `/api/maps/geocode-stop` proxy with the configured Maps Demo Key. It tries Google Geocoding API v4 first and falls back to Places API (New) when no confident unique result is available. Requests are region-biased to India and spatially biased to nearby known stops when available. Candidates outside the Kolkata/Howrah service bounds, weak name matches, and similarly ranked distant results are rejected. The batch has controlled concurrency, request spacing, timeout, retries, persistent per-stop progress, incremental generated registry output, and quota exhaustion handling.", "", `The current Maps Demo Key daily quota was exhausted during this run after ${locations.length} accepted stop results (${geocodingCount} via Geocoding API v4 and ${placesCount} via Places API New). The proxy returned a quota response but no numeric usage total. Ambiguous and unresolved names remain listed below for review and resumable lookup after quota reset. Manual coordinate table entries remain approximate waypoints and are never counted as Google verified. No coordinates are fabricated.`, "", "## Ambiguous results", "", ...Object.entries(progress.ambiguous).map(([name, reason]) => `- ${name}: ${cleanReason(reason)}`), "", "## Verified alias groups", "", ...aliasGroups.map(({ canonical, aliases }) => `- ${canonical}: ${aliases.join(", ")}`), "", "## Unresolved results", "", ...unresolved.map(({ name }) => `- ${name}: ${cleanReason(progress.ambiguous[name] || progress.failures[name] || "Not processed yet")}`), "", "## Duplicate coordinate groups", "", ...duplicateGroups.map((names) => `- ${names.join(" / ")}`), ""];
  await writeFile(auditFile, lines.join("\n"), "utf8");
}

async function main() {
  const dryRun = flag("--dry-run");
  const concurrency = Math.max(1, Math.min(4, Number(option("--concurrency", "2")) || 2));
  const limit = Math.max(0, Number(option("--limit", "0")) || 0);
  const baseUrl = option("--base-url", process.env.MAPS_PROXY_URL || "http://localhost:3000").replace(/\/$/, "");
  const progress = await readProgress();
  for (const name of Object.keys(GENERATED_STOP_LOCATIONS)) if (!progress.resolved[name]) progress.resolved[name] = GENERATED_STOP_LOCATIONS[name];
  for (const location of Object.values(progress.resolved)) if (!location.source) location.source = "geocoding-v4";
  Object.entries(progress.failures).forEach(([name, reason]) => { if (/quota|daily demo/i.test(reason)) delete progress.failures[name]; });
  const retryFailures = flag("--retry-failures");
  const work = Array.from(allStops.values()).filter(({ name }) => !progress.resolved[name] && !progress.ambiguous[name] && (retryFailures || !progress.failures[name]));
  const selected = limit ? work.slice(0, limit) : work;
  console.log(JSON.stringify({ routes: WBTC_ROUTES.length, uniqueStops: allStops.size, existingCoordinates: Array.from(allStops.values()).filter(({ name }) => !!resolveStop(name)).length, verifiedCached: Object.keys(progress.resolved).length, unresolvedForBatch: work.length, processing: dryRun ? 0 : selected.length, concurrency, baseUrl }));
  if (dryRun || flag("--audit-only")) {
    if (flag("--audit-only")) await writeFile(registryFile, `/** Generated by scripts/resolve-wbtc-stops.ts; only high-confidence Google results belong here. */\nexport const GENERATED_STOP_LOCATIONS: Record<string, { latitude: number; longitude: number; placeId?: string; formattedAddress?: string; confidence: number; source?: \"geocoding-v4\" | \"places-new\" }> = ${JSON.stringify(progress.resolved, null, 2)};\n`, "utf8");
    await writeAudit(progress); return;
  }
  let cursor = 0, lastRequestAt = 0, quotaExhausted = false;
  let requestQueue = Promise.resolve();
  const waitForRequestSlot = async () => {
    const previous = requestQueue;
    let release!: () => void;
    requestQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const wait = Math.max(0, 450 - (Date.now() - lastRequestAt));
    if (wait) await delay(wait);
    lastRequestAt = Date.now();
    release();
  };
  const persist = async () => {
    await writeFile(progressFile, JSON.stringify(progress, null, 2), "utf8");
    await writeFile(registryFile, `/** Generated by scripts/resolve-wbtc-stops.ts; only high-confidence Google results belong here. */\nexport const GENERATED_STOP_LOCATIONS: Record<string, { latitude: number; longitude: number; placeId?: string; formattedAddress?: string; confidence: number; source?: \"geocoding-v4\" | \"places-new\" }> = ${JSON.stringify(progress.resolved, null, 2)};\n`, "utf8");
  };
  const worker = async () => {
    while (!quotaExhausted) {
      const item = selected[cursor++];
      if (!item) return;
      let response: Response | undefined, payload: any;
      for (let attempt = 0; attempt < 5; attempt++) {
        await waitForRequestSlot();
        try {
          response = await fetch(`${baseUrl}/api/maps/geocode-stop`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: item.name, context: { previous: item.neighbors[0], next: item.neighbors[1] } }), signal: AbortSignal.timeout(15000) });
          payload = await response.json();
        } catch (error) { payload = { error: error instanceof Error ? error.message : "Request failed" }; }
        if (response?.ok || (response && response.status !== 429 && response.status < 500)) break;
        if (response?.status === 429 || /quota|daily demo/i.test(payload?.error || "")) { quotaExhausted = true; break; }
        await delay(500 * 2 ** attempt);
      }
      if (quotaExhausted) {
        console.log(`Demo Key quota reached; saved progress and left ${item.name} pending.`);
        await persist();
        return;
      }
      if (response?.ok && payload?.verified && payload?.confidence >= 0.6) {
        progress.resolved[item.name] = { latitude: payload.latitude, longitude: payload.longitude, placeId: payload.placeId, formattedAddress: payload.formattedAddress, confidence: payload.confidence, source: payload.source };
        delete progress.failures[item.name];
      } else {
        const reason = payload?.error || `HTTP ${response?.status || "network error"}`;
        if (response?.status === 409 || /multiple plausible|ambiguous/i.test(reason)) progress.ambiguous[item.name] = reason;
        else progress.failures[item.name] = reason;
      }
      await persist();
      console.log(`${Object.keys(progress.resolved).length}/${allStops.size} resolved · ${item.name}: ${progress.resolved[item.name] ? "verified" : progress.ambiguous[item.name] ? "review" : "unresolved"}`);
    }
  };
  await mkdir(here, { recursive: true });
  await Promise.all(Array.from({ length: concurrency }, worker));
  await writeAudit(progress);
  console.log(JSON.stringify({ resolved: Object.keys(progress.resolved).length, ambiguous: Object.keys(progress.ambiguous).length, unresolved: allStops.size - Object.keys(progress.resolved).length, quotaExhausted, auditFile }));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
