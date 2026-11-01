import { WBTC_ROUTES } from "@/wbtc-routes";
import { getOrderedStops, getRouteStopsAndPath, getStopLocationRecord, resolveStop } from "@/lib/kolkata-stops";

export type SelectedStop = { stopId: string; name: string; latitude?: number; longitude?: number };
export type StopSuggestion = SelectedStop & { aliases: string[] };

export const normalizeStopName = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");

// Only spelling and abbreviation variants whose coordinate registry entries are co-located.
const VERIFIED_ALIASES: Record<string, string[]> = {
  "subodh mallick square": ["subod mallick square", "subod mallick squre", "subodh mallick sq", "subodh malick square", "subodh mullick square"],
  "esplanade": ["dharmatala", "espl"],
  "bbd bag": ["bbd bagh", "b b d bag", "b b d bagh"],
  "ballygunge station": ["ballygunge stn"],
  "rashbehari": ["rashbehari xing", "rashbehari avenue"],
  "girish park": ["grish park"],
  "baguiati": ["baguihati"],
  "kaikhali": ["koikhali", "koikhali"],
  "chhingrighata": ["chingrighata", "chingrihata"],
};

const aliasToCanonical = new Map<string, string>();
Object.entries(VERIFIED_ALIASES).forEach(([canonical, aliases]) => {
  aliasToCanonical.set(normalizeStopName(canonical), normalizeStopName(canonical));
  aliases.forEach((alias) => aliasToCanonical.set(normalizeStopName(alias), normalizeStopName(canonical)));
});

/** Resolve the official spelling, verified aliases, and normalized name to one stable ID. */
export function resolveStopReference(stopName: string): StopSuggestion | null {
  const key = normalizeStopName(stopName);
  if (!key) return null;
  const canonicalKey = aliasToCanonical.get(key) || key;
  const stop = WBTC_STOP_INDEX.find((candidate) => normalizeStopName(candidate.name) === canonicalKey || candidate.aliases.some((alias) => normalizeStopName(alias) === key));
  return stop || null;
}

export function getVerifiedStopAliasGroups() {
  return Object.entries(VERIFIED_ALIASES).map(([canonical, aliases]) => ({ canonical, aliases: [...aliases] }));
}

const routeStopsLegacy = (route: { origin: string; destination: string; stops: string }) => [
  route.origin.trim(),
  ...(route.stops || "").split(/[-–—,;/]/).map((stop) => stop.replace(/^via\s*:?\s*/i, "").trim()).filter(Boolean),
  route.destination.trim(),
];

const routeStops = (route: { origin: string; destination: string; stops: string }) => getOrderedStops(route.origin, route.stops, route.destination);

export const WBTC_STOP_INDEX: StopSuggestion[] = (() => {
  const canonical = new Map<string, StopSuggestion>();
  WBTC_ROUTES.forEach((route) => routeStops(route).forEach((name) => {
    const rawKey = normalizeStopName(name);
    const key = aliasToCanonical.get(rawKey) || rawKey;
    if (!key) return;
    const existing = canonical.get(key);
    if (!existing) {
      const canonicalName = key === rawKey ? name : Object.keys(VERIFIED_ALIASES).find((candidate) => normalizeStopName(candidate) === key) || name;
      canonical.set(key, { stopId: key.replace(/\s/g, "-"), name: canonicalName, aliases: [] });
    }
    if (rawKey !== key) canonical.get(key)?.aliases.push(name);
  }));
  return Array.from(canonical.values()).map((stop) => {
    const aliases = VERIFIED_ALIASES[normalizeStopName(stop.name)] || [];
    const coordinate = resolveStop(stop.name);
    return { ...stop, aliases, latitude: coordinate?.lat, longitude: coordinate?.lng };
  }).sort((a, b) => a.name.localeCompare(b.name));
})();

export function searchWbtcStops(query: string): StopSuggestion[] {
  const q = normalizeStopName(query);
  if (!q) return [];
  return WBTC_STOP_INDEX.map((stop) => {
    const canonical = normalizeStopName(stop.name);
    const aliases = stop.aliases.map(normalizeStopName);
    const rank = canonical === q ? 0 : canonical.startsWith(q) ? 1 : aliases.some((alias) => alias.startsWith(q)) ? 2 : canonical.includes(q) ? 3 : aliases.some((alias) => alias.includes(q)) ? 4 : 99;
    return { stop, rank };
  }).filter(({ rank }) => rank < 99)
    .sort((a, b) => a.rank - b.rank || a.stop.name.localeCompare(b.stop.name))
    .map(({ stop }) => stop);
}

export function stopById(stopId: string): StopSuggestion | undefined {
  return WBTC_STOP_INDEX.find((stop) => stop.stopId === stopId);
}

export function getStopResolutionReport() {
  const allStops = new Map<string, string>();
  WBTC_ROUTES.forEach((route) => {
    const data = getRouteStopsAndPath(route.origin, route.stops, route.destination);
    data.orderedStops.forEach((name) => allStops.set(normalizeStopName(name), name));
  });
  const records = Array.from(allStops.values()).map((name) => ({ name, coord: resolveStop(name), verified: getStopLocationRecord(name)?.verified === true }));
  const unresolvedStops = records.filter((record) => !record.coord).map((record) => record.name);
  return { totalUniqueStops: allStops.size, unresolvedStops, unresolvedCount: unresolvedStops.length, resolvedCount: records.filter((record) => record.coord).length, verifiedCount: records.filter((record) => record.verified).length, unverifiedCoordinateCount: records.filter((record) => record.coord && !record.verified).length };
}

export function matchingRoutes(originId: string, destinationId: string) {
  const origin = stopById(originId) || resolveStopReference(originId);
  const destination = stopById(destinationId) || resolveStopReference(destinationId);
  if (!origin || !destination || originId === destinationId) return [];
  const aliasesFor = (stop: StopSuggestion) => new Set([normalizeStopName(stop.name), ...stop.aliases.map(normalizeStopName), ...(VERIFIED_ALIASES[normalizeStopName(stop.name)] || []).map(normalizeStopName)]);
  const originNames = aliasesFor(origin);
  const destinationNames = aliasesFor(destination);
  const results: Array<{ route: (typeof WBTC_ROUTES)[number]; originMatched: string; destMatched: string; stopsBetween: number; isReversed: boolean; directionText: string; originIndex: number; destinationIndex: number }> = [];
  WBTC_ROUTES.forEach((route) => {
    const stops = routeStops(route);
    const indices = (names: Set<string>) => stops.flatMap((name, index) => names.has(normalizeStopName(name)) ? [index] : []);
    for (const oi of indices(originNames)) for (const di of indices(destinationNames)) {
      if (oi === di) continue;
      const reversed = oi > di;
      // A return trip is valid only when the dataset contains this route in that direction.
      if (reversed) continue;
      results.push({ route, originMatched: stops[oi], destMatched: stops[di], stopsBetween: di - oi, isReversed: false, directionText: `${route.origin} → ${route.destination}`, originIndex: oi, destinationIndex: di });
    }
  });
  return results.sort((a, b) => a.stopsBetween - b.stopsBetween || a.route.route.localeCompare(b.route.route));
}

export type TripRouteDiagnostic = { route: string; code: "ORIGIN_NOT_FOUND" | "DESTINATION_NOT_FOUND" | "WRONG_STOP_ORDER" };
export function diagnoseTripRoutes(originId: string, destinationId: string): TripRouteDiagnostic[] {
  const origin = stopById(originId) || resolveStopReference(originId);
  const destination = stopById(destinationId) || resolveStopReference(destinationId);
  if (!origin) return WBTC_ROUTES.map((route) => ({ route: route.route, code: "ORIGIN_NOT_FOUND" }));
  if (!destination) return WBTC_ROUTES.map((route) => ({ route: route.route, code: "DESTINATION_NOT_FOUND" }));
  const aliasesFor = (stop: StopSuggestion) => new Set([normalizeStopName(stop.name), ...stop.aliases.map(normalizeStopName), ...(VERIFIED_ALIASES[normalizeStopName(stop.name)] || []).map(normalizeStopName)]);
  const originNames = aliasesFor(origin), destinationNames = aliasesFor(destination);
  const diagnostics: TripRouteDiagnostic[] = [];
  WBTC_ROUTES.forEach((route) => {
    const stops = routeStops(route);
    const from = stops.flatMap((name, index) => originNames.has(normalizeStopName(name)) ? [index] : []);
    const to = stops.flatMap((name, index) => destinationNames.has(normalizeStopName(name)) ? [index] : []);
    if (!from.length) diagnostics.push({ route: route.route, code: "ORIGIN_NOT_FOUND" });
    else if (!to.length) diagnostics.push({ route: route.route, code: "DESTINATION_NOT_FOUND" });
    else if (!from.some((originIndex) => to.some((destinationIndex) => originIndex < destinationIndex))) diagnostics.push({ route: route.route, code: "WRONG_STOP_ORDER" });
  });
  return diagnostics;
}
