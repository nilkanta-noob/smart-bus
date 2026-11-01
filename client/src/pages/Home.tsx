import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { GoogleKolkataMap } from "@/components/Map";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  BusFront,
  Check,
  CheckCircle2,
  Copy,
  ChevronRight,
  Clock3,
  CircleHelp,
  Compass,
  Crosshair,
  Gauge,
  Heart,
  Info,
  Layers3,
  Link2,
  MessagesSquare,
  LocateFixed,
  MapPin,
  Menu,
  Moon,
  Navigation,
  MapPinned,
  Plus,
  UserPlus,
  BellRing,
  CircleCheck,
  ArrowUpRight,
  RefreshCw,
  Radio,
  Route as RouteIcon,
  Search,
  Share2,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Users,
  X,
  Send,
  UserRound,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  WBTC_ROUTES,
  normalizeRoute,
  isACRoute,
  getRouteStopsCount,
  searchRoutes,
  type WBTCRoute,
} from "@/wbtc-routes";
import { getOrderedStops, getRouteStopsAndPath, getStopLocationRecord, resolveStopWithGoogle, type StopMarker, type LatLng } from "@/lib/kolkata-stops";
import { formatEta, getRoadRouteGeometry, type RoadRouteGeometry } from "@/lib/route-geometry";
import { DEFAULT_SIMULATION_SPEED_KMH, STOP_DWELL_SECONDS, type SimulationRuntime } from "@/lib/route-simulation";
import { toast } from "sonner";
import { useFleetSimulation } from "@/contexts/FleetSimulationContext";
import { StopAutocomplete } from "@/components/StopAutocomplete";
import { RouteTagAutocomplete } from "@/components/RouteTagAutocomplete";
import { diagnoseTripRoutes, getStopResolutionReport, matchingRoutes, type SelectedStop } from "@/lib/stop-search";
import { rankTripOptions, simulationAtElapsed } from "@/lib/route-simulation";
import { clearGuestAvatar, loadGuestAvatarUrl, loadGuestProfile, saveGuestAvatar, saveGuestProfile } from "@/lib/guest-profile";

type Tab = "home" | "search" | "trip" | "community" | "favorites" | "notifications" | "settings";
type Bus = {
  id: string;
  route: string;
  name: string;
  ac: boolean;
  location: string;
  nextStop: string;
  speed: number;
  eta: number;
  occupancy: "Low" | "Medium" | "High";
  color: string;
  x: number;
  y: number;
  status: "On time" | "Delayed";
  statusTone: "mint" | "amber";
  direction: string;
};

const buses: Bus[] = [
  { id: "v1-102", route: "V1", name: "Tollygunge → Airport", ac: false, location: "Park Street Crossing", nextStop: "Esplanade", speed: 24, eta: 3, occupancy: "Medium", color: "#ff6b62", x: 52, y: 48, status: "On time", statusTone: "mint", direction: "Towards Airport" },
  { id: "ac47-308", route: "AC47", name: "Howrah → Salt Lake", ac: true, location: "A.J.C. Bose Road", nextStop: "Maidan", speed: 18, eta: 6, occupancy: "High", color: "#45d9d0", x: 34, y: 35, status: "Delayed", statusTone: "amber", direction: "Towards Salt Lake" },
  { id: "ac58-211", route: "AC58", name: "New Town → Esplanade", ac: true, location: "EM Bypass", nextStop: "Science City", speed: 31, eta: 5, occupancy: "Low", color: "#a88bff", x: 71, y: 26, status: "On time", statusTone: "mint", direction: "Towards Esplanade" },
  { id: "ac35-172", route: "AC35", name: "Tollygunge → New Town", ac: true, location: "Rabindra Sadan", nextStop: "Park Street", speed: 14, eta: 8, occupancy: "Medium", color: "#ffbd67", x: 23, y: 67, status: "On time", statusTone: "mint", direction: "Towards New Town" },
  { id: "ac24-089", route: "AC24", name: "Patuli → Howrah", ac: true, location: "Esplanade Metro", nextStop: "B.B.D. Bagh", speed: 21, eta: 2, occupancy: "Low", color: "#6b9cff", x: 58, y: 56, status: "On time", statusTone: "mint", direction: "Towards Howrah" },
];

const notices = [
  { icon: "bell", title: "V1 arriving in 3 minutes", detail: "Park Street Crossing", time: "2m ago", tone: "coral" },
  { icon: "bus", title: "AC47 delayed by 8 minutes", detail: "Traffic near Salt Lake", time: "14m ago", tone: "amber" },
  { icon: "check", title: "AC24 reached Esplanade", detail: "Next stop: B.B.D. Bagh", time: "26m ago", tone: "mint" },
];

type LiveVehicle = { id: string; route: string; lat: number; lng: number; bearing?: number; speed?: number; updatedAt?: string };

const KOLKATA_CENTER = { lat: 22.5726, lng: 88.3639 };
const routeCoordinates: Record<string, Array<{ lat: number; lng: number }>> = {
  V1: [{ lat: 22.5005, lng: 88.3498 }, { lat: 22.534, lng: 88.364 }, { lat: 22.556, lng: 88.351 }, { lat: 22.5726, lng: 88.3639 }, { lat: 22.645, lng: 88.423 }],
  AC24: [{ lat: 22.466, lng: 88.397 }, { lat: 22.51, lng: 88.365 }, { lat: 22.544, lng: 88.352 }, { lat: 22.5726, lng: 88.3639 }, { lat: 22.585, lng: 88.34 }],
  AC47: [{ lat: 22.59, lng: 88.31 }, { lat: 22.56, lng: 88.35 }, { lat: 22.5726, lng: 88.3639 }, { lat: 22.59, lng: 88.4 }, { lat: 22.61, lng: 88.43 }],
  AC58: [{ lat: 22.62, lng: 88.48 }, { lat: 22.6, lng: 88.43 }, { lat: 22.5726, lng: 88.3639 }, { lat: 22.56, lng: 88.35 }],
  AC35: [{ lat: 22.49, lng: 88.32 }, { lat: 22.52, lng: 88.35 }, { lat: 22.5726, lng: 88.3639 }, { lat: 22.6, lng: 88.43 }],
};

function haversineMeters(a: LatLng, b: LatLng) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat), dLng = radians(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

const navItems: Array<{ id: Tab; label: string; icon: typeof Compass }> = [
  { id: "home", label: "Live map", icon: Compass },
  { id: "search", label: "Search buses", icon: Search },
  { id: "trip", label: "Plan trip", icon: RouteIcon },
  { id: "community", label: "Community", icon: MessagesSquare },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

function initials(name?: string | null) {
  const parts = (name || "Smart Bus").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "SB";
}

function StatusPill({ children, tone = "mint" }: { children: React.ReactNode; tone?: "mint" | "amber" | "blue" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function EmptySearch({ query }: { query: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Search size={22} /></div>
      <p>No buses match “{query}”</p>
      <span>Try a route number like AC-24, or a stop like Esplanade, Howrah, or Garia.</span>
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { elapsedSeconds, elapsedForRoute, restartRoute, paused: fleetPaused, togglePause: toggleFleetPause, speedKmh: simulationSpeed, setSpeedKmh: setSimulationSpeed } = useFleetSimulation();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedId, setSelectedId] = useState("v1-102");
  const [favorites, setFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("smartbus-favorites") || "null") || ["v1-102", "ac24-089"]; } catch { return ["v1-102", "ac24-089"]; } });
  const [query, setQuery] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [tick, setTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [followBus, setFollowBus] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "ready" | "denied" | "unavailable" | "timeout">("idle");
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);
  const [liveFeedState, setLiveFeedState] = useState<"not-configured" | "loading" | "connected" | "error">("not-configured");
  const [showAllLiveOnMap, setShowAllLiveOnMap] = useState(false);
  const [tripOrigin, setTripOrigin] = useState("");
  const [tripDestination, setTripDestination] = useState("");
  const [tripOriginStop, setTripOriginStop] = useState<SelectedStop | null>(null);
  const [tripDestinationStop, setTripDestinationStop] = useState<SelectedStop | null>(null);
  const [communityDraft, setCommunityDraft] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(typeof Notification === "undefined" ? "default" : Notification.permission);
  const [profileName, setProfileName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [homeStop, setHomeStop] = useState("");
  const [isBoarded, setIsBoarded] = useState(false);
  const [infoPanel, setInfoPanel] = useState<"about" | "privacy" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupRelation, setGroupRelation] = useState("");
  const [chatRouteTag, setChatRouteTag] = useState("");
  const [activeContactId, setActiveContactId] = useState<number | null>(null);
  const [showBusSheet, setShowBusSheet] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [timetableLoading, setTimetableLoading] = useState(true);

  // ── Selected Route & Geospatial Visualization State ──────────────────────
  const [selectedWBTCRoute, setSelectedWBTCRoute] = useState<WBTCRoute | null>(null);
  const [isRouteReversed, setIsRouteReversed] = useState(false);
  const [focusedStop, setFocusedStop] = useState<StopMarker | null>(null);
  const [roadGeometry, setRoadGeometry] = useState<RoadRouteGeometry | null>(null);
  const [roadGeometryStatus, setRoadGeometryStatus] = useState<"idle" | "loading" | "ready" | "partial" | "error">("idle");
  const [partialRoutePaths, setPartialRoutePaths] = useState<LatLng[][]>([]);
  const [roadGeometryError, setRoadGeometryError] = useState("");
  const [routeRetry, setRouteRetry] = useState(0);
  const [stopRegistryVersion, setStopRegistryVersion] = useState(0);
  const attemptedStopLookups = useRef(new Set<string>());
  const [simulationView, setSimulationView] = useState<SimulationRuntime>({
    travelledMeters: 0,
    currentStopIndex: 0,
    dwellRemainingSeconds: 0,
    status: "paused",
    speedKmh: DEFAULT_SIMULATION_SPEED_KMH,
  });
  const simulationRuntimeRef = useRef<SimulationRuntime>({ ...simulationView });

  const transitQuery = trpc.transit.snapshot.useQuery(undefined, { refetchInterval: 15000, retry: false });
  const communityQuery = trpc.community.list.useQuery({ route: undefined }, { refetchInterval: 15000, retry: false });
  const profileQuery = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const boardingQuery = trpc.boarding.current.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const saveProfileMutation = trpc.profile.save.useMutation({ onSuccess: () => { profileQuery.refetch(); toast.success("Profile saved"); } });
  const boardMutation = trpc.boarding.board.useMutation({ onSuccess: () => { boardingQuery.refetch(); setIsBoarded(true); toast.success("Ride tracking started", { description: "Smart Bus will keep your selected bus in focus." }); } });
  const completeBoardingMutation = trpc.boarding.complete.useMutation({ onSuccess: () => { boardingQuery.refetch(); setIsBoarded(false); toast.success("Ride tracking stopped"); } });
  const sendCommunityMutation = trpc.community.send.useMutation({ onSuccess: () => { setCommunityDraft(""); communityQuery.refetch(); } });
  const registerPushMutation = trpc.push.register.useMutation();
  const groupQuery = trpc.group.list.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 10000, retry: false });
  const addContactMutation = trpc.group.add.useMutation({ onSuccess: () => { setGroupName(""); setGroupRelation(""); groupQuery.refetch(); toast.success("Close person added", { description: "Their profile is now in your Smart Bus group." }); } });
  const updateContactMutation = trpc.group.update.useMutation({ onSuccess: () => groupQuery.refetch() });
  const createInviteMutation = trpc.group.createInvite.useMutation({ onSuccess: ({ token, expiresAt }) => { setInviteLink(`${window.location.origin}/join/${token}`); setShowInvitePanel(true); toast.success("Invite link created", { description: `Expires ${new Date(expiresAt).toLocaleString()}.` }); } });
  const acceptInviteMutation = trpc.group.acceptInvite.useMutation({ onSuccess: () => { void groupQuery.refetch(); setPendingInviteToken(null); toast.success("You joined the Smart Bus group"); window.history.replaceState({}, "", "/"); }, onError: (error) => toast.error(error.message) });
  const revokeInviteMutation = trpc.group.revokeInvite.useMutation({ onSuccess: () => { setInviteLink(""); toast.success("Invite link revoked"); } });
  useEffect(() => {
    const token = window.location.pathname.match(/^\/join\/([a-f0-9]{64})$/i)?.[1];
    if (token) { setPendingInviteToken(token); setActiveTab("community"); }
  }, []);

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 850);
    return () => window.clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    const guestProfile = loadGuestProfile();
    setProfileName(guestProfile.displayName);
    try { const preferences = JSON.parse(localStorage.getItem("smartbus-guest-preferences") || "null"); if (preferences) { if (preferences.preferredTheme) setDarkMode(preferences.preferredTheme === "dark"); if (typeof preferences.notificationsEnabled === "boolean") setNotificationsEnabled(preferences.notificationsEnabled); setHomeStop(preferences.homeStop || ""); } } catch { /* use default preferences */ }
    void loadGuestAvatarUrl().then(setAvatarUrl);
    return () => { if (avatarUrl) URL.revokeObjectURL(avatarUrl); };
  }, []);

  useEffect(() => { try { localStorage.setItem("smartbus-favorites", JSON.stringify(favorites)); } catch { /* keep favorites for this session */ } }, [favorites]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimetableLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    return () => document.documentElement.classList.remove("dark");
  }, [darkMode]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      setLastUpdated("Just now");
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = buses.find((bus) => bus.id === selectedId) ?? buses[0];
  const activeBuses = useMemo(() => buses.map((bus, index) => ({
    ...bus,
    x: bus.x + Math.sin((tick + index) * 0.55) * 0.8,
    y: bus.y + Math.cos((tick + index) * 0.4) * 0.7,
    speed: bus.speed + ((tick + index) % 3 === 0 ? 1 : 0),
    eta: Math.max(1, bus.eta - (tick % 10 === 0 ? 1 : 0)),
  })), [tick]);

  const filteredBuses = useMemo(() => {
    return activeBuses.filter((bus) =>
      `${bus.route} ${bus.name} ${bus.location} ${bus.nextStop}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [activeBuses, query]);

  // Search WBTC directory
  const searchedWBTCRoutes = useMemo(() => {
    return searchRoutes(query);
  }, [query]);

  // Trip planner results with travel direction awareness
  const tripPlanResults = useMemo(() => tripOriginStop?.stopId && tripDestinationStop?.stopId
    ? matchingRoutes(tripOriginStop.stopId, tripDestinationStop.stopId)
    : [], [tripOriginStop, tripDestinationStop]);
  useEffect(() => {
    if (!import.meta.env.DEV || !tripOriginStop?.stopId || !tripDestinationStop?.stopId || tripPlanResults.length) return;
    const diagnostics = diagnoseTripRoutes(tripOriginStop.stopId, tripDestinationStop.stopId);
    const counts = diagnostics.reduce<Record<string, number>>((summary, item) => { summary[item.code] = (summary[item.code] || 0) + 1; return summary; }, {});
    console.debug("[Trip Planner] No ordered WBTC matches", { originId: tripOriginStop.stopId, destinationId: tripDestinationStop.stopId, counts, routeDiagnostics: diagnostics });
  }, [tripOriginStop, tripDestinationStop, tripPlanResults]);
  type TripCandidate = ReturnType<typeof matchingRoutes>[number] & { geometry?: RoadRouteGeometry; originMarkerIndex?: number; destinationMarkerIndex?: number; geometryError?: string; boardSeconds?: number; rideSeconds?: number; totalSeconds?: number; availability: "available" | "passed" | "unavailable" };
  const [tripGeometryCandidates, setTripGeometryCandidates] = useState<TripCandidate[]>([]);
  const [tripGeometryLoading, setTripGeometryLoading] = useState(false);
  const [tripGeometryError, setTripGeometryError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!tripPlanResults.length) { setTripGeometryCandidates([]); setTripGeometryLoading(false); setTripGeometryError(""); return; }
    setTripGeometryCandidates([]); setTripGeometryLoading(true);
    setTripGeometryError("");
    const candidates: TripCandidate[] = tripPlanResults.map((candidate) => ({ ...candidate, availability: "unavailable" as const, geometryError: "Road geometry is being checked." }));
    let cursor = 0;
    const worker = async () => {
      while (!cancelled) {
        const resultIndex = cursor++;
        const result = tripPlanResults[resultIndex];
        if (!result) return;
        try {
          let data = getRouteStopsAndPath(result.route.origin, result.route.stops, result.route.destination);
          if (data.unresolvedStops.length) {
            candidates[resultIndex] = { ...result, availability: "unavailable", geometryError: `${data.unresolvedStops.length} stop${data.unresolvedStops.length === 1 ? "" : "s"} missing verified coordinates` };
            continue;
          }
          const { geometry } = await getRoadRouteGeometry(`${normalizeRoute(result.route.route)}:forward`, data.stopMarkers);
          if (cancelled) return;
          const originMarkerIndex = data.stopMarkers.findIndex((stop) => stop.index >= result.originIndex);
          const destinationMarkerIndex = data.stopMarkers.findIndex((stop) => stop.index >= result.destinationIndex);
          if (originMarkerIndex < 0 || destinationMarkerIndex <= originMarkerIndex) {
            candidates[resultIndex] = { ...result, availability: "unavailable", geometryError: "Selected stops are not represented in route geometry" };
            continue;
          }
          candidates[resultIndex] = { ...result, geometry, originMarkerIndex, destinationMarkerIndex, availability: "available" };
        } catch (error) {
          candidates[resultIndex] = { ...result, availability: "unavailable", geometryError: error instanceof Error ? error.message : "Road geometry request failed" };
          setTripGeometryError((previous) => previous || (error instanceof Error ? error.message : "Some route geometry requests failed."));
        }
      }
    };
    setTripGeometryCandidates(candidates);
    void Promise.all([worker(), worker()]).then(() => { if (!cancelled) { setTripGeometryCandidates([...candidates]); setTripGeometryLoading(false); } });
    return () => { cancelled = true; };
  }, [tripPlanResults]);

  const rankedTripPlanResults = useMemo(() => tripGeometryCandidates.map((candidate): TripCandidate => {
    if (!candidate.geometry || candidate.originMarkerIndex == null || candidate.destinationMarkerIndex == null) return { ...candidate, availability: "unavailable" };
    const { geometry, originMarkerIndex, destinationMarkerIndex } = candidate;
    const routeElapsed = elapsedForRoute(`${normalizeRoute(candidate.route.route)}:forward`);
    const runtime = simulationAtElapsed(geometry.stopDistancesMeters, geometry.totalDistanceMeters, routeElapsed, simulationSpeed);
    const originDistance = geometry.stopDistancesMeters[originMarkerIndex];
    const destinationDistance = geometry.stopDistancesMeters[destinationMarkerIndex];
    if (originDistance < runtime.travelledMeters - 1) return { ...candidate, availability: "passed" };
    const metersPerSecond = simulationSpeed * 1000 / 3600;
    const currentDwell = runtime.status === "at-stop" ? runtime.dwellRemainingSeconds : 0;
    const boardSeconds = Math.max(0, originDistance - runtime.travelledMeters) / metersPerSecond + Math.max(0, originMarkerIndex - runtime.currentStopIndex - 1) * STOP_DWELL_SECONDS + (originMarkerIndex > runtime.currentStopIndex ? currentDwell : 0);
    const rideSeconds = Math.max(0, destinationDistance - originDistance) / metersPerSecond + Math.max(0, destinationMarkerIndex - originMarkerIndex - 1) * STOP_DWELL_SECONDS;
    return { ...candidate, availability: "available", boardSeconds, rideSeconds, totalSeconds: boardSeconds + rideSeconds };
  }), [tripGeometryCandidates, elapsedSeconds, elapsedForRoute, simulationSpeed]);
  const rankedJourneyOptions = useMemo(() => [...rankTripOptions(rankedTripPlanResults.filter((candidate): candidate is TripCandidate & { totalSeconds: number } => candidate.totalSeconds != null)), ...rankedTripPlanResults.filter((candidate) => candidate.totalSeconds == null)], [rankedTripPlanResults]);

  useEffect(() => {
    if (!transitQuery.data) return;
    setLiveVehicles((transitQuery.data.vehicles || []) as LiveVehicle[]);
    setLiveFeedState(transitQuery.data.source === "official-feed" ? "connected" : transitQuery.data.source === "error" ? "error" : "not-configured");
  }, [transitQuery.data]);

  useEffect(() => {
    if (boardingQuery.data) setIsBoarded(true);
  }, [boardingQuery.data]);

  const previousGroupBoarding = useRef<Record<number, string>>({});
  useEffect(() => {
    (groupQuery.data || []).forEach((person) => {
      const previous = previousGroupBoarding.current[person.id];
      if (previous && previous !== "boarded" && person.boardingStatus === "boarded" && person.route) notifyBoarding(person.displayName, person.route);
      previousGroupBoarding.current[person.id] = person.boardingStatus;
    });
  }, [groupQuery.data]);

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setProfileName(profile.displayName || user?.name || "");
    setHomeStop(profile.homeStop || "");
    if (profile.preferredTheme) setDarkMode(profile.preferredTheme === "dark");
    setNotificationsEnabled(profile.notificationsEnabled === 1);
  }, [profileQuery.data, user?.name]);

  // ── Unified Active Route & Geospatial Representation ────────────────────
  const currentRouteObj = useMemo<WBTCRoute | null>(() => {
    if (selectedWBTCRoute) return selectedWBTCRoute;
    return WBTC_ROUTES.find((r) => normalizeRoute(r.route) === normalizeRoute(selected.route)) || null;
  }, [selectedWBTCRoute, selected.route]);
  const routeSimulationKey = currentRouteObj ? `${normalizeRoute(currentRouteObj.route)}:${isRouteReversed ? "reverse" : "forward"}` : normalizeRoute(selected.route);
  const routeElapsedSeconds = elapsedForRoute(routeSimulationKey);

  const routeGeoData = useMemo(() => {
    if (!currentRouteObj) {
      return {
        path: [] as LatLng[],
        stopMarkers: [] as StopMarker[],
        orderedStops: [] as string[],
        resolvedCount: 0,
        totalCount: 0,
        unresolvedStops: [] as string[],
      };
    }
    const origin = isRouteReversed ? currentRouteObj.destination : currentRouteObj.origin;
    const dest = isRouteReversed ? currentRouteObj.origin : currentRouteObj.destination;
    // The bus demo can use the project's cached approximate waypoints to keep
    // simulation available while Google verification is completed. Trip Planner
    // deliberately keeps its default verified-only behavior.
    return getRouteStopsAndPath(origin, currentRouteObj.stops, dest, false);
  }, [currentRouteObj, isRouteReversed, stopRegistryVersion]);
  const stopResolutionReport = useMemo(() => getStopResolutionReport(), [stopRegistryVersion]);

  const nearestRouteStop = useMemo(() => {
    if (!userLocation || !routeGeoData.stopMarkers.length) return null;
    return routeGeoData.stopMarkers.map((stop) => ({ stop, distanceMeters: haversineMeters(userLocation, stop.coord) })).sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null;
  }, [userLocation, routeGeoData.stopMarkers]);
  const nearestStopArrival = useMemo(() => {
    if (!nearestRouteStop || !roadGeometry) return null;
    const stopIndex = routeGeoData.stopMarkers.indexOf(nearestRouteStop.stop);
    const stopDistance = roadGeometry.stopDistancesMeters[stopIndex];
    if (stopDistance < simulationView.travelledMeters - 1) {
      const upcomingIndex = Math.min(simulationView.currentStopIndex + 1, routeGeoData.stopMarkers.length - 1);
      const upcomingDistance = roadGeometry.stopDistancesMeters[upcomingIndex];
      const currentDwell = simulationView.status === "at-stop" || (simulationView.status === "paused" && simulationView.pausedFromStatus === "at-stop") ? simulationView.dwellRemainingSeconds : 0;
      const seconds = Math.max(0, upcomingDistance - simulationView.travelledMeters) / Math.max(1, simulationSpeed * 1000 / 3600) + Math.max(0, upcomingIndex - simulationView.currentStopIndex - 1) * STOP_DWELL_SECONDS + currentDwell;
      return { passed: true, upcoming: routeGeoData.stopMarkers[upcomingIndex], seconds };
    }
    const currentDwell = simulationView.status === "at-stop" || (simulationView.status === "paused" && simulationView.pausedFromStatus === "at-stop") ? simulationView.dwellRemainingSeconds : 0;
    const seconds = Math.max(0, stopDistance - simulationView.travelledMeters) / Math.max(1, simulationSpeed * 1000 / 3600) + Math.max(0, stopIndex - simulationView.currentStopIndex - 1) * STOP_DWELL_SECONDS + (stopIndex > simulationView.currentStopIndex ? currentDwell : 0);
    return { passed: false, upcoming: nearestRouteStop.stop, seconds };
  }, [nearestRouteStop, roadGeometry, routeGeoData.stopMarkers, simulationView, simulationSpeed]);

  useEffect(() => {
    if (!currentRouteObj) {
      setRoadGeometry(null);
      setPartialRoutePaths([]);
      setRoadGeometryStatus("idle");
      setRoadGeometryError("");
      return;
    }
    setRoadGeometry(null);
    setPartialRoutePaths([]);
    setRoadGeometryStatus("loading");
    setRoadGeometryError("");
    const controller = new AbortController();
    if (routeGeoData.stopMarkers.length < 2) {
      setRoadGeometryStatus("error");
      setRoadGeometryError("This route needs at least two mapped stops to create road geometry.");
      return () => controller.abort();
    }
    getRoadRouteGeometry(`${normalizeRoute(currentRouteObj.route)}:${isRouteReversed ? "reverse" : "forward"}:waypoints-v2`, routeGeoData.stopMarkers, controller.signal)
      .then(({ geometry }) => {
        if (controller.signal.aborted) return;
        setRoadGeometry(geometry);
        const approximate = routeGeoData.stopMarkers.filter((stop) => getStopLocationRecord(stop.label)?.verified !== true).length;
        setRoadGeometryStatus(routeGeoData.unresolvedStops.length || approximate ? "partial" : "ready");
        setRoadGeometryError(routeGeoData.unresolvedStops.length
          ? `Simulation is running on Google road geometry between ${routeGeoData.stopMarkers.length} cached waypoints; ${routeGeoData.unresolvedStops.length} WBTC stops have no saved coordinates yet.`
          : approximate
            ? `Simulation is using cached approximate coordinates for ${approximate} stop${approximate === 1 ? "" : "s"}. Google road geometry is fetched once and movement stays local.`
            : "");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRoadGeometryStatus("error");
        setRoadGeometryError(error instanceof Error ? error.message : "Could not retrieve Google road geometry.");
      });
    return () => controller.abort();
  }, [currentRouteObj, isRouteReversed, routeGeoData, routeRetry]);

  useEffect(() => {
    if (!roadGeometry) return;
    const runtime = simulationAtElapsed(roadGeometry.stopDistancesMeters, roadGeometry.totalDistanceMeters, routeElapsedSeconds, simulationSpeed);
    if (fleetPaused && runtime.status !== "completed") { runtime.pausedFromStatus = runtime.status as "running" | "at-stop"; runtime.status = "paused"; }
    simulationRuntimeRef.current = runtime;
    setSimulationView(runtime);
  }, [roadGeometry, routeGeoData.stopMarkers.length, routeElapsedSeconds, simulationSpeed, fleetPaused]);

  useEffect(() => {
    simulationRuntimeRef.current.speedKmh = simulationSpeed;
    setSimulationView((previous) => ({ ...previous, speedKmh: simulationSpeed }));
  }, [simulationSpeed]);

  const toggleSimulationPause = toggleFleetPause;
  const resetSimulation = () => { restartRoute(routeSimulationKey); if (roadGeometry) { const reset = simulationAtElapsed(roadGeometry.stopDistancesMeters, roadGeometry.totalDistanceMeters, 0, simulationSpeed); simulationRuntimeRef.current = reset; setSimulationView(reset); } };
  const retryRouteAndResolveStops = async () => {
    if (!currentRouteObj) return;
    const names = getOrderedStops(
      isRouteReversed ? currentRouteObj.destination : currentRouteObj.origin,
      currentRouteObj.stops,
      isRouteReversed ? currentRouteObj.origin : currentRouteObj.destination,
    );
    const unverified = names.filter((name) => getStopLocationRecord(name)?.verified !== true);
    let resolvedAny = false;
    let quotaReached = false;
    for (const name of unverified) {
      try {
        resolvedAny = (await resolveStopWithGoogle(name)) || resolvedAny;
      } catch (error) {
        if (/quota|daily demo/i.test(error instanceof Error ? error.message : "")) { quotaReached = true; break; }
      }
    }
    if (resolvedAny) setStopRegistryVersion((version) => version + 1);
    if (quotaReached) toast.error("Google Maps daily quota is exhausted. Cached route simulation is still available; retry after the quota resets.");
    setRouteRetry((value) => value + 1);
  };

  const simulationEta = useMemo(() => {
    if (!roadGeometry || routeGeoData.stopMarkers.length < 2) return null;
    const finalIndex = routeGeoData.stopMarkers.length - 1;
    const currentIndex = Math.min(simulationView.currentStopIndex, finalIndex);
    const nextIndex = Math.min(currentIndex + 1, finalIndex);
    const metersPerSecond = Math.max(1, (simulationSpeed * 1000) / 3600);
    const distanceToNext = Math.max(0, (roadGeometry.stopDistancesMeters[nextIndex] ?? roadGeometry.totalDistanceMeters) - simulationView.travelledMeters);
    const remainingDistance = Math.max(0, roadGeometry.totalDistanceMeters - simulationView.travelledMeters);
    const dwellNow = simulationView.status === "at-stop" || (simulationView.status === "paused" && simulationView.pausedFromStatus === "at-stop")
      ? simulationView.dwellRemainingSeconds
      : 0;
    const remainingIntermediateStops = Math.max(0, finalIndex - currentIndex - 1);
    return {
      currentStop: routeGeoData.stopMarkers[currentIndex]?.label || "Starting point",
      nextStop: routeGeoData.stopMarkers[nextIndex]?.label || "Destination",
      nextSeconds: simulationView.status === "completed" ? 0 : dwellNow + distanceToNext / metersPerSecond,
      destinationSeconds: simulationView.status === "completed" ? 0 : remainingDistance / metersPerSecond + dwellNow + remainingIntermediateStops * STOP_DWELL_SECONDS,
    };
  }, [roadGeometry, routeGeoData.stopMarkers, simulationView, simulationSpeed]);

  // Shared Route Selection Handlers
  const handleSelectWBTCRoute = (route: WBTCRoute) => {
    setSelectedWBTCRoute(route);
    setIsRouteReversed(false);
    setFocusedStop(null);
    setShowAllLiveOnMap(false);
    const demoMatch = activeBuses.find((b) => normalizeRoute(b.route) === normalizeRoute(route.route));
    if (demoMatch) setSelectedId(demoMatch.id);
    setActiveTab("home");
    toast.success(`Route ${route.route} selected`, {
      description: `${route.origin} → ${route.destination} visualized on Google Maps`,
    });
  };

  const handleSelectTripRoute = (result: ReturnType<typeof matchingRoutes>[number]) => {
    setSelectedWBTCRoute(result.route);
    setIsRouteReversed(result.isReversed);
    setFocusedStop(null);
    setShowAllLiveOnMap(false);
    const demoMatch = activeBuses.find((b) => normalizeRoute(b.route) === normalizeRoute(result.route.route));
    if (demoMatch) setSelectedId(demoMatch.id);
    setActiveTab("home");
    toast.success(`Trip route ${result.route.route} selected`, {
      description: `${result.directionText} (${result.stopsBetween} stops)`,
    });
  };

  const handleSelectRouteByName = (routeName: string) => {
    const wbtc = WBTC_ROUTES.find((r) => normalizeRoute(r.route) === normalizeRoute(routeName));
    if (wbtc) {
      handleSelectWBTCRoute(wbtc);
    } else {
      const demoMatch = activeBuses.find((b) => normalizeRoute(b.route) === normalizeRoute(routeName));
      if (demoMatch) {
        setSelectedId(demoMatch.id);
        setActiveTab("home");
      }
    }
  };

  const selectedLiveVehicle = liveVehicles.find((vehicle) => normalizeRoute(vehicle.route) === normalizeRoute(selected.route));
  const selectedIsStopped = Boolean(selectedLiveVehicle && (selectedLiveVehicle.speed ?? 0) <= 1);

  const handleBoardBus = () => {
    boardMutation.mutate({ route: selected.route, vehicleId: selectedLiveVehicle?.id || selected.id, boardedStop: selected.location, destinationStop: selected.nextStop });
  };

  const handlePushPermission = async () => {
    if (!("Notification" in window)) { toast.error("Push notifications are not supported in this browser"); return; }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setNotificationsEnabled(true);
      toast.success("Push permission enabled", { description: "Smart Bus can now alert you about arrivals and delays." });
      if (isAuthenticated && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        const subscription = await registration?.pushManager.getSubscription().catch(() => null);
        if (subscription) registerPushMutation.mutate({ endpoint: subscription.endpoint, p256dh: "", auth: "" });
      }
    } else toast("Notifications remain off", { description: "You can enable them later from browser settings." });
  };

  const saveUserProfile = () => {
    const guestProfile = saveGuestProfile(profileName || user?.name || "Guest rider");
    setProfileName(guestProfile.displayName);
    localStorage.setItem("smartbus-guest-preferences", JSON.stringify({ homeStop, preferredTheme: darkMode ? "dark" : "light", notificationsEnabled }));
    if (isAuthenticated) saveProfileMutation.mutate({ displayName: guestProfile.displayName, homeStop, preferredTheme: darkMode ? "dark" : "light", notificationsEnabled: notificationsEnabled ? 1 : 0 });
    else toast.success("Guest profile saved on this device");
  };

  const handleGuestAvatar = async (file?: File) => {
    if (!file) return;
    try {
      await saveGuestAvatar(file);
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      setAvatarUrl(await loadGuestAvatarUrl());
      toast.success("Profile picture saved on this device");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save this image"); }
  };
  const restoreGuestAvatar = async () => { await clearGuestAvatar(); if (avatarUrl) URL.revokeObjectURL(avatarUrl); setAvatarUrl(null); };

  const addClosePerson = () => {
    if (!groupName.trim()) { toast.error("Enter a name first"); return; }
    addContactMutation.mutate({ displayName: groupName.trim(), relation: groupRelation.trim() || undefined });
  };

  const generateInviteLink = () => {
    createInviteMutation.mutate();
  };

  const copyInviteLink = async () => {
    if (!inviteLink) { generateInviteLink(); return; }
    await navigator.clipboard?.writeText(inviteLink).catch(() => undefined);
    toast.success("Invite link copied", { description: "The link expires after 24 hours and requires an explicit accept action." });
  };

  const toggleContactLocation = (contactId: number, enabled: boolean) => {
    updateContactMutation.mutate({ id: contactId, locationSharing: enabled ? 1 : 0 });
    toast(enabled ? "Location sharing enabled" : "Location sharing paused", { description: "You can change this consent any time." });
  };

  const requestUserLocation = () => {
    if (!navigator.geolocation) { setLocationStatus("unavailable"); toast.error("This browser does not provide geolocation"); return; }
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition((position) => {
      setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocationStatus("ready");
      toast.success("Your location is shown on this device only");
    }, (error) => {
      setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.TIMEOUT ? "timeout" : "unavailable");
      toast.error(error.code === error.PERMISSION_DENIED ? "Location permission was denied" : error.code === error.TIMEOUT ? "Location lookup timed out" : "Your current location is unavailable");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  };

  const updateManualBus = (contactId: number, route: string) => {
    setActiveContactId(contactId);
    updateContactMutation.mutate({ id: contactId, route: route || undefined, boardingStatus: route ? "boarded" : "waiting" });
    toast.success(route ? "Boarded bus updated" : "Bus cleared", { description: "Your group will see this status on the next refresh." });
  };

  const notifyBoarding = (name: string, route: string) => {
    if (notificationPermission === "granted" && notificationsEnabled) new Notification(`${name} boarded ${route}`, { body: "Smart Bus group update" });
    toast(`${name} boarded ${route}`, { description: "Group boarding notification" });
  };

  const toggleFavorite = (id: string) => {
    setFavorites((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
    toast.success(favorites.includes(id) ? "Removed from favorites" : "Added to favorites", { description: "Your route list is up to date." });
  };

  const refresh = () => {
    setIsRefreshing(true);
    window.setTimeout(() => {
      setTick((value) => value + 1);
      setLastUpdated("Just now");
      setIsRefreshing(false);
      toast.success("Live positions refreshed", { description: "All active buses are up to date." });
    }, 550);
  };

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "home") setQuery("");
  };

  return (
    <div className={`app-shell ${darkMode ? "dark-shell" : "light-shell"}`}>
      <AnimatePresence>{showSplash && (
        <motion.div className="splash-screen" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <div className="splash-glow" />
          <div className="splash-brand"><span className="brand-mark"><BusFront size={22} /></span><span>Smart <span className="text-cyan">Bus</span></span></div>
          <div className="skyline"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <p>Mapping Kolkata in motion</p>
          <div className="loading-track"><span /></div>
        </motion.div>
      )}</AnimatePresence>

      {!isOnline && <div className="offline-banner"><Info size={15} /> You’re offline · Showing the last known bus positions</div>}

      <aside className="desktop-rail">
        <div className="rail-brand"><span className="brand-mark"><BusFront size={20} /></span><span>Smart <span className="text-cyan">Bus</span></span></div>
        <div className="network-status"><span className="live-dot" /> WBTC network <span className="network-count">{WBTC_ROUTES.length}</span></div>
        <nav className="rail-nav" aria-label="Main navigation">
          <p className="rail-label">Workspace</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`rail-link ${activeTab === id ? "active" : ""}`} onClick={() => selectTab(id)}>
              <Icon size={18} strokeWidth={activeTab === id ? 2.4 : 1.9} /><span>{label}</span>{id === "notifications" && <span className="nav-badge">3</span>}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="rider-card"><div className="avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initials(profileName || user?.name)}</div><div><strong>{profileName || user?.name || "Guest rider"}</strong><span>Guest profile · saved on this device</span></div><ChevronRight size={15} /></div>
          <button type="button" className="help-link" onClick={() => toast("Smart Bus Help", { description: "131 verified WBTC city bus routes with full Google Maps visualization." })}><CircleHelp size={17} /> Help & feedback</button>
        </div>
      </aside>

      <main className="app-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><BusFront size={18} /></span><span>Smart <span className="text-cyan">Bus</span></span></div>
          <div className="location-heading"><span className="eyebrow"><span className="live-dot" /> KOLKATA TRANSIT DISCOVERY</span><h1>{activeTab === "home" ? `Welcome, ${(user?.name || "rider").split(" ")[0]}` : navItems.find((item) => item.id === activeTab)?.label}</h1></div>
          <div className="topbar-actions"><button type="button" className="icon-button only-desktop" aria-label="Toggle theme" onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button type="button" className="profile-button" onClick={() => selectTab("settings")}><span className="avatar small">{initials(user?.name || profileName)}</span><ChevronRight size={15} /></button><button type="button" className="mobile-menu icon-button" onClick={() => toast("Menu", { description: "Use the navigation bar below to switch views." })}><Menu size={19} /></button></div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === "home" && <motion.div key="home" className="home-layout" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <section className="map-card">
              <div className="map-toolbar">
                <div className="map-title">
                  <div className="map-title-icon"><Navigation size={16} /></div>
                  <div>
                    <strong>
                      {currentRouteObj ? `Route ${currentRouteObj.route} · ${isRouteReversed ? `${currentRouteObj.destination} → ${currentRouteObj.origin}` : `${currentRouteObj.origin} → ${currentRouteObj.destination}`}` : "Smart Bus Kolkata Map"}
                    </strong>
                    <span>
                      {currentRouteObj
                        ? roadGeometryStatus === "loading" ? "Requesting Google road geometry…"
                          : roadGeometryStatus === "ready" ? `${routeGeoData.stopMarkers.length} stops · road-following path`
                            : roadGeometryStatus === "partial" ? `${partialRoutePaths.length} road sections · missing stops shown`
                            : roadGeometryStatus === "error" ? `${routeGeoData.stopMarkers.length} stops · road path unavailable`
                              : "Preparing route"
                        : "Select a route to display its road path and stops"}
                    </span>
                  </div>
                </div>
                <div className="map-actions">
                  <button className="map-action-button" type="button" onClick={() => toast("Map layers", { description: "Traffic and transit layers are loaded." })}><Layers3 size={16} /><span>Layers</span></button>
                  <button className="map-action-button" type="button" onClick={() => { setShowAllLiveOnMap((value) => !value); toast(showAllLiveOnMap ? "Focused route mode" : "Showing all live vehicle markers"); }}><Crosshair size={16} /><span>{showAllLiveOnMap ? "Focused" : "All buses"}</span></button>
                  <button className="map-action-button" type="button" onClick={refresh} aria-label="Refresh buses"><RefreshCw size={16} className={isRefreshing ? "spin" : ""} /><span>Refresh</span></button>
                </div>
              </div>

              <div className="map-stage real-map-stage google-map-shell">
                <GoogleKolkataMap
                  vehicles={liveVehicles}
                  selectedRoute={currentRouteObj ? currentRouteObj.route : selected.route}
                  showAll={showAllLiveOnMap}
                  userLocation={userLocation}
                  follow={followBus}
                  darkMode={darkMode}
                  onBusClick={(route) => handleSelectRouteByName(route)}
                  routePath={roadGeometry?.path}
                  routePaths={partialRoutePaths.length ? partialRoutePaths : undefined}
                  stopMarkers={routeGeoData.stopMarkers}
                  activeStop={focusedStop}
                  onStopClick={(stop) => setFocusedStop(stop)}
                  travelledMeters={simulationView.travelledMeters}
                  simulationRuntime={roadGeometry ? simulationRuntimeRef : undefined}
                />

                {/* Selected Route Top Banner */}
                {currentRouteObj && (
                  <div className="route-map-banner">
                    <div className="route-map-banner-info">
                      <span className="route-map-banner-token">{currentRouteObj.route}</span>
                      <div className="route-map-banner-copy">
                        <strong>{isRouteReversed ? `${currentRouteObj.destination} → ${currentRouteObj.origin}` : `${currentRouteObj.origin} → ${currentRouteObj.destination}`}</strong>
                        <span>
                          {isACRoute(currentRouteObj.route) ? "AC City Service" : "Non-AC Service"} · {routeGeoData.stopMarkers.length} mapped stops · road path approximate
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="route-map-clear-btn"
                      onClick={() => {
                        setSelectedWBTCRoute(null);
                        setIsRouteReversed(false);
                        setFocusedStop(null);
                        toast("Route overlay cleared", { description: "Returned to city view." });
                      }}
                    >
                      <X size={13} /> Clear route
                    </button>
                  </div>
                )}

                {/* Horizontal Stop Carousel */}
                {routeGeoData.stopMarkers.length > 0 && (
                  <div className="route-stop-carousel">
                    {routeGeoData.stopMarkers.map((marker) => (
                      <button
                        key={`${marker.label}-${marker.index}`}
                        type="button"
                        className={`route-stop-chip ${focusedStop?.index === marker.index ? "active" : ""}`}
                        onClick={() => {
                          setFocusedStop(marker);
                          toast(marker.label, {
                            description: marker.kind === "origin" ? "Starting Terminal" : marker.kind === "destination" ? "Final Terminal" : `Stoppage #${marker.index + 1}`
                          });
                        }}
                      >
                        <span className={`dot dot-${marker.kind}`} />
                        <span>{marker.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="real-map-badge google-badge"><span className="live-dot" /> GOOGLE MAPS <span>·</span> WBTC TRANSIT</div>
                <div className="real-map-status">
                  <BusFront size={14} /> {currentRouteObj ? roadGeometryStatus === "ready" ? `Route ${currentRouteObj.route} road path` : roadGeometryStatus === "partial" ? `Route ${currentRouteObj.route} partial road path` : roadGeometryStatus === "loading" ? "Loading road path" : "Road path unavailable" : `${WBTC_ROUTES.length} official routes available`}
                  <span className="proto-label" style={{ marginLeft: 8 }}>{currentRouteObj ? "DEMO SIMULATION" : "Prototype"}</span>
                </div>
                <button type="button" className="locate-button" aria-label="Center on my location" onClick={() => navigator.geolocation?.getCurrentPosition((position) => { setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); toast.success("Location found", { description: "Your position is shown on Google Maps." }); }, () => toast.error("Location unavailable", { description: "Allow location access in your browser to show your position." }))}><LocateFixed size={18} /></button>
                <div className="real-map-legend">
                  <span><i className="legend-bus">🟢</i> Origin</span>
                  <span><i className="legend-bus">🔴</i> Destination</span>
                  <span><i className="legend-dot" /> Stop</span>
                  <span>Traffic + Transit</span>
                </div>
              </div>

              {/* Quick Route Selector Strip */}
              <div className="route-strip">
                <div>
                  <span className="eyebrow">POPULAR WBTC CORRIDORS</span>
                  <strong>{currentRouteObj ? `Selected: Route ${currentRouteObj.route}` : "Tap any route to draw polyline & all stops on Google Maps"}</strong>
                </div>
                <div className="route-chips">
                  {WBTC_ROUTES.slice(0, 15).map((route) => (
                    <button
                      key={route.route}
                      type="button"
                      className={`route-chip ${currentRouteObj?.route === route.route ? "selected" : ""}`}
                      onClick={() => handleSelectWBTCRoute(route)}
                    >
                      <span style={{ background: isACRoute(route.route) ? "#45d9d0" : "#438fff" }} />
                      {route.route}
                    </button>
                  ))}
                  <button type="button" className="route-chip" onClick={() => setActiveTab("search")}>
                    + More routes ({WBTC_ROUTES.length})
                  </button>
                </div>
              </div>
            </section>

            {/* Right Details Panel */}
            <aside className="details-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">ROUTE INFORMATION</span>
                  <h2>
                    {currentRouteObj ? currentRouteObj.route : selected.route}
                    <span className="route-name"> · {currentRouteObj ? (isACRoute(currentRouteObj.route) ? "AC" : "Non-AC") : (selected.ac ? "AC" : "Non-AC")}</span>
                  </h2>
                </div>
                <button
                  type="button"
                  className="favorite-button"
                  onClick={() => toggleFavorite(selected.id)}
                  aria-label="Toggle favorite"
                >
                  {favorites.includes(selected.id) ? <Heart size={18} fill="currentColor" /> : <Heart size={18} />}
                </button>
              </div>

              <div className="selected-route">
                <div className="route-identity" style={{ background: isACRoute(currentRouteObj?.route || selected.route) ? "#45d9d0" : selected.color }}>
                  <BusFront size={22} />
                </div>
                <div>
                  <strong>
                    {currentRouteObj
                      ? (isRouteReversed ? `${currentRouteObj.destination} → ${currentRouteObj.origin}` : `${currentRouteObj.origin} → ${currentRouteObj.destination}`)
                      : selected.name}
                  </strong>
                  <span><MapPin size={13} /> {routeGeoData.stopMarkers.length} mapped stoppages</span>
                </div>
                <StatusPill tone="mint">WBTC Route</StatusPill>
              </div>

              <div className="arrival-card">
                <div className="arrival-top">
                  <div>
                    <span className="eyebrow">ESTIMATED INTERVAL</span>
                    <strong>{selected.eta} <small>min</small></strong>
                  </div>
                  <div className="arrival-orbit"><span /><span /><Navigation size={16} /></div>
                </div>
                <div className="progress-track"><span style={{ width: `${Math.min(90, 28 + selected.eta * 8)}%`, background: selected.color }} /></div>
                <div className="arrival-meta">
                  <span>From · {currentRouteObj?.origin || selected.location}</span>
                  <span>To · {currentRouteObj?.destination || selected.nextStop}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <span className="proto-label">Illustrative interval · Live vehicle tracking requires official GPS feed</span>
                </div>
              </div>

              {currentRouteObj && (
                <section className="simulation-card" aria-label="Demo bus route simulation">
                  <div className="simulation-heading">
                    <div><span className="eyebrow">DEMO BUS</span><strong>{currentRouteObj.route} · SIMULATION</strong></div>
                    <StatusPill tone={simulationView.status === "running" ? "mint" : simulationView.status === "completed" ? "blue" : "amber"}>
                      {roadGeometryStatus === "loading" ? "ROUTE LOADING" : roadGeometryStatus === "error" ? "ROUTE ERROR" : roadGeometryStatus === "partial" ? simulationView.status === "paused" ? "PAUSED · PARTIAL MAP" : simulationView.status === "running" || simulationView.status === "at-stop" ? "SIMULATING · PARTIAL MAP" : "PARTIAL MAP" : simulationView.status === "running" ? "SIMULATING" : simulationView.status === "paused" ? "PAUSED" : simulationView.status === "at-stop" ? "AT STOP" : "COMPLETED"}
                    </StatusPill>
                  </div>
                  {roadGeometryStatus === "loading" && <p className="simulation-message">Getting road-following geometry from Google Maps…</p>}
                  {(roadGeometryStatus === "error" || roadGeometryStatus === "partial") && (
                    <div className="simulation-error"><span>{roadGeometryError}</span><button type="button" onClick={() => { attemptedStopLookups.current.clear(); void retryRouteAndResolveStops(); }}>Resolve stops & retry</button></div>
                  )}
                  {(roadGeometryStatus === "ready" || roadGeometryStatus === "partial") && roadGeometry && simulationEta && (
                    <>
                      <div className="simulation-readout">
                        <div><span>Current stop</span><strong>{simulationEta.currentStop}</strong></div>
                        <div><span>Next stop · ETA</span><strong>{simulationEta.nextStop} · {formatEta(simulationEta.nextSeconds)}</strong></div>
                        <div><span>Destination · ETA</span><strong>{isRouteReversed ? currentRouteObj.origin : currentRouteObj.destination} · {formatEta(simulationEta.destinationSeconds)}</strong></div>
                        <div><span>Speed</span><strong>{simulationView.status === "at-stop" || (simulationView.status === "paused" && simulationView.pausedFromStatus === "at-stop") ? 0 : simulationSpeed} km/h</strong></div>
                      </div>
                      {simulationView.status === "at-stop" && <p className="simulation-message">At stop · resuming in {Math.ceil(simulationView.dwellRemainingSeconds)}s</p>}
                      <div className="simulation-controls">
                        <button type="button" className="simulation-primary" onClick={simulationView.status === "completed" ? resetSimulation : toggleSimulationPause}>
                          {simulationView.status === "completed" ? "Restart simulation" : simulationView.status === "paused" ? "Resume" : "Pause"}
                        </button>
                        <button type="button" className="simulation-secondary" onClick={resetSimulation}>Reset</button>
                      </div>
                      <div className="simulation-speeds" aria-label="Simulation speed">
                        <span>Simulation speed</span>
                        {[20, 30, 40].map((speed) => (
                          <button key={speed} type="button" className={simulationSpeed === speed ? "active" : ""} onClick={() => setSimulationSpeed(speed)}>{speed}</button>
                        ))}
                        <small>km/h</small>
                      </div>
                      <p className="simulation-disclaimer">DEMO SIMULATION · Not live GPS tracking. Google road path is approximate based on the listed WBTC stops.</p>
                    </>
                  )}
                </section>
              )}

              {currentRouteObj && <section className="simulation-card location-card" aria-label="Nearest route stop">
                <div className="simulation-heading"><div><span className="eyebrow">YOUR LOCATION</span><strong>Nearest stop on {currentRouteObj.route}</strong></div><button type="button" className="simulation-secondary" onClick={requestUserLocation}>{locationStatus === "ready" ? "Refresh" : locationStatus === "requesting" ? "Finding…" : "Allow location"}</button></div>
                {nearestRouteStop && <div className="location-result"><strong>{nearestRouteStop.stop.label}</strong><span>{nearestRouteStop.distanceMeters < 1000 ? `${Math.round(nearestRouteStop.distanceMeters)} m` : `${(nearestRouteStop.distanceMeters / 1000).toFixed(1)} km`} straight-line distance</span>
                  {nearestStopArrival && <span>{nearestStopArrival.passed ? `Bus has already passed this stop · next: ${nearestStopArrival.upcoming.label} in ${formatEta(nearestStopArrival.seconds)}` : `Simulated bus ETA: ${formatEta(nearestStopArrival.seconds)}`}</span>}
                </div>}
                {!nearestRouteStop && <p className="simulation-message">{locationStatus === "denied" ? "Location access was denied. Allow it in your browser settings, then retry." : locationStatus === "timeout" ? "Location lookup timed out. Retry when you have a clearer signal." : locationStatus === "unavailable" ? "Location is unavailable. Check browser permissions and retry." : "Your location stays in this browser and is never sent to the server."}</p>}
              </section>}

              <div className="boarding-card">
                <div>
                  <span className="eyebrow">RIDE TRACKING</span>
                  <strong>{isBoarded ? "You’re tracking this ride" : "Are you on this bus?"}</strong>
                  <span>{isBoarded ? "Your ride status is active." : "Tap below to keep this bus route in focus."}</span>
                </div>
                {isBoarded ? (
                  <button type="button" className="board-button active" onClick={() => boardingQuery.data && completeBoardingMutation.mutate({ id: boardingQuery.data.id })}>
                    <CheckCircle2 size={15} /> Stop tracking
                  </button>
                ) : (
                  <button type="button" className="board-button" onClick={handleBoardBus}>
                    <BusFront size={15} /> I’ve boarded
                  </button>
                )}
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <Gauge size={17} />
                  <span>Stoppages</span>
                  <strong>{routeGeoData.orderedStops.length || getRouteStopsCount(currentRouteObj || WBTC_ROUTES[0])}</strong>
                </div>
                <div className="stat-card">
                  <Users size={17} />
                  <span>Service</span>
                  <strong className="occupancy-text">{isACRoute(currentRouteObj?.route || selected.route) ? "AC Express" : "Standard"}</strong>
                </div>
                <div className="stat-card">
                  <Zap size={17} />
                  <span>Geometry</span>
                  <strong>{routeGeoData.path.length} pts</strong>
                </div>
                <div className="stat-card">
                  <ShieldCheck size={17} />
                  <span>Verified</span>
                  <strong>WBTC</strong>
                </div>
              </div>

              <div className="panel-divider" />

              {/* Complete Stop Sequence List */}
              <div className="timeline-card">
                <div className="timeline-heading">
                  <div>
                    <span className="eyebrow">ORDERED SEQUENCE ({routeGeoData.orderedStops.length} STOPS)</span>
                    <strong>{currentRouteObj ? currentRouteObj.route : selected.route} stop sequence</strong>
                  </div>
                  <Clock3 size={16} />
                </div>
                <div className="timeline-list">
                  {routeGeoData.orderedStops.map((stop, index) => {
                    const isStart = index === 0;
                    const isEnd = index === routeGeoData.orderedStops.length - 1;
                    const isFocused = focusedStop?.label.toLowerCase() === stop.toLowerCase();
                    return (
                      <div
                        className={`timeline-stop ${isFocused ? "current" : ""}`}
                        key={`${stop}-${index}`}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          const matchedMarker = routeGeoData.stopMarkers.find((m) => m.label.toLowerCase() === stop.toLowerCase()) || null;
                          setFocusedStop(matchedMarker);
                          toast(stop, {
                            description: isStart ? "Starting Terminal" : isEnd ? "Final Terminal" : `Stoppage #${index + 1} · centered on map`
                          });
                        }}
                      >
                        <span className="timeline-dot" style={{ background: isStart ? "#10b981" : isEnd ? "#ff6b62" : "#45d9d0" }} />
                        <div>
                          <strong>{stop}</strong>
                          <span>{isStart ? "Origin terminal" : isEnd ? "Destination terminal" : `Stoppage #${index + 1} · tap to view on map`}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="panel-divider" />
              <div className="follow-row">
                <div className="follow-icon"><Crosshair size={17} /></div>
                <div><strong>Follow this route</strong><span>Keep map centered on route path</span></div>
                <button type="button" className={`toggle ${followBus ? "on" : ""}`} onClick={() => { setFollowBus((value) => !value); toast(followBus ? "Follow mode off" : "Follow mode on"); }}><span /></button>
              </div>
              <button type="button" className="route-detail-button" onClick={() => { setActiveTab("search"); setQuery(currentRouteObj?.route || selected.route); }}>
                Search more routes in directory <ChevronRight size={16} />
              </button>
            </aside>
          </motion.div>}

          {/* ── Search Buses Tab ─────────────────────────────────────────── */}
          {activeTab === "search" && <motion.div key="search" className="content-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <div className="content-hero">
              <div>
                <span className="eyebrow">OFFICIAL WBTC ROUTE DIRECTORY</span>
                <h2>Find Any Kolkata City Bus</h2>
                <p>Search all {WBTC_ROUTES.length} intra-city routes by route number (e.g. AC-24, V1), origin, destination, or stoppage.</p>
              </div>
              <div className="hero-orb"><Search size={26} /></div>
            </div>

            <div className="search-field large">
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search AC-24, V1, Esplanade, Howrah, Garia to Salt Lake..."
                autoFocus
              />
              <kbd>⌘ K</kbd>
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
            </div>

            <div className="result-header">
              <span>{searchedWBTCRoutes.length} matching routes found</span>
              <span className="live-copy"><span className="live-dot" /> Verified WBTC publication</span>
            </div>

            {searchedWBTCRoutes.length === 0 ? (
              <EmptySearch query={query} />
            ) : (
              <div className="bus-list">
                {searchedWBTCRoutes.map((route, index) => {
                  const isAC = isACRoute(route.route);
                  const stopsCount = getRouteStopsCount(route);
                  return (
                    <motion.div
                      key={`${route.sl}-${route.route}`}
                      className="bus-list-card"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(0.2, index * 0.02) }}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleSelectWBTCRoute(route)}
                    >
                      <div className="bus-list-color" style={{ background: isAC ? "#45d9d0" : "#438fff" }}>
                        <BusFront size={21} />
                      </div>
                      <div className="bus-list-copy">
                        <div>
                          <strong>{route.route}</strong>
                          {isAC ? <span className="route-badge-ac">AC</span> : <span className="route-badge-nonac">NON-AC</span>}
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>{stopsCount} stoppages</span>
                        </div>
                        <span style={{ fontWeight: 600, color: "#edf5ff" }}>{route.origin} → {route.destination}</span>
                        <small><MapPin size={12} /> {route.stops || "Official intra-city service"}</small>
                      </div>
                      <button
                        type="button"
                        className="primary-action"
                        style={{ padding: "6px 12px", fontSize: 11, borderRadius: 10, flexShrink: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectWBTCRoute(route);
                        }}
                      >
                        View on map <ChevronRight size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <div className="catalog-heading" style={{ marginTop: 28 }}>
              <span>Official WBTC city bus publication</span>
              <a href="https://wbtconline.in/wbtc-city-bus-routes" target="_blank" rel="noreferrer">
                wbtconline.in · {WBTC_ROUTES.length} routes
              </a>
            </div>
          </motion.div>}

          {/* ── Plan Trip Tab ────────────────────────────────────────────── */}
          {activeTab === "trip" && <motion.div key="trip" className="content-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <div className="content-hero compact">
              <div>
                <span className="eyebrow">ORDER-AWARE ROUTE FINDER</span>
                <h2>Plan your Kolkata journey</h2>
                <p>Find WBTC routes serving both your pickup and destination in the correct travel order.</p>
              </div>
              <div className="hero-orb violet-orb"><RouteIcon size={23} /></div>
            </div>

            <div className="trip-planner-card">
              <StopAutocomplete kind="origin" value={tripOrigin} onClear={() => setTripOriginStop(null)} onSelect={(stop) => { setTripOrigin(stop.name); setTripOriginStop(stop.stopId ? stop : null); }} />
              <div className="trip-line" />
              <StopAutocomplete kind="destination" value={tripDestination} onClear={() => setTripDestinationStop(null)} onSelect={(stop) => { setTripDestination(stop.name); setTripDestinationStop(stop.stopId ? stop : null); }} />
              {(tripOrigin && !tripOriginStop?.stopId || tripDestination && !tripDestinationStop?.stopId) && <p className="trip-validation">Choose a WBTC stop from the suggestions to plan a trip.</p>}
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  if (tripPlanResults.length > 0) {
                    toast.success(`${tripPlanResults.length} matching journey options found`, {
                      description: "Select a route below to highlight its path on Google Maps.",
                    });
                  } else {
                    toast.error("No direct route found", {
                      description: "Try searching major transit nodes like Esplanade, Howrah, Garia, or Salt Lake.",
                    });
                  }
                }}
              >
                <Search size={16} /> Find connecting routes
              </button>
            </div>

            {/* Trip Results */}
            <div className="trip-results">
              <div className="result-header">
                <span>
                  {tripOriginStop?.stopId && tripDestinationStop?.stopId
                    ? `${tripPlanResults.length} routes match${tripGeometryLoading ? " · checking road geometry" : ""} from ${tripOrigin} to ${tripDestination}`
                    : `Enter origin & destination to find ordered routes (${WBTC_ROUTES.length} available)`}
                </span>
                <span className="live-copy"><span className="live-dot" /> Direction-verified</span>
              </div>

              {rankedJourneyOptions.length > 0 ? (
                rankedJourneyOptions.map((result) => {
                  const isAC = isACRoute(result.route.route);
                  return (
                    <button
                      type="button"
                      className="trip-result-card"
                      key={`${result.route.sl}-${result.route.route}-${result.isReversed}`}
                      onClick={() => handleSelectTripRoute(result)}
                    >
                      <span className="route-token" style={{ background: isAC ? "#45d9d0" : "#438fff" }}>
                        {result.route.route}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong>{result.directionText}</strong>
                          {isAC ? <span className="route-badge-ac">AC</span> : <span className="route-badge-nonac">NON-AC</span>}
                        </div>
                        <span>
                          Board at <b>{result.originMatched}</b> → Alight at <b>{result.destMatched}</b> · {result.stopsBetween} stops in order
                        </span>
                        {result.availability === "available" && result.totalSeconds != null ? <span>Wait {Math.ceil(result.boardSeconds! / 60)} min + ride {Math.ceil(result.rideSeconds! / 60)} min · <b>{Math.ceil(result.totalSeconds / 60)} min total</b></span> : <span>{result.availability === "passed" ? "The simulated vehicle has already passed this boarding stop." : result.geometryError || "Journey estimate unavailable."}</span>}
                      </div>
                      <span className="primary-action" style={{ padding: "5px 10px", fontSize: 10, borderRadius: 8 }}>
                        View on map <ChevronRight size={14} />
                      </span>
                    </button>
                  );
                })
              ) : tripOriginStop?.stopId && tripDestinationStop?.stopId ? (
                <div className="empty-state">
                  <div className="empty-icon"><RouteIcon size={22} /></div>
                  <p>{tripGeometryLoading ? "Checking matching route geometry…" : tripPlanResults.length ? tripGeometryError || "Matching routes are available, but their road geometry could not be estimated yet." : "No WBTC route serves these stops in this direction."}</p>
                  <span>{tripPlanResults.length ? "Route matches come from the ordered WBTC stop list independently from map geometry." : "Try selecting canonical WBTC stops from the suggestions."}</span>
                </div>
              ) : (
                /* Recommended popular routes when no origin/destination is typed yet */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0" }}>Suggested popular Kolkata routes:</p>
                  {WBTC_ROUTES.slice(0, 6).map((route) => (
                    <button
                      type="button"
                      className="trip-result-card"
                      key={route.route}
                      onClick={() => handleSelectWBTCRoute(route)}
                    >
                      <span className="route-token" style={{ background: isACRoute(route.route) ? "#45d9d0" : "#438fff" }}>
                        {route.route}
                      </span>
                      <div style={{ flex: 1 }}>
                        <strong>{route.origin} → {route.destination}</strong>
                        <span>{route.stops || "Official WBTC Intra-City Route"}</span>
                      </div>
                      <span className="primary-action" style={{ padding: "5px 10px", fontSize: 10, borderRadius: 8 }}>
                        View on map <ChevronRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Official WBTC Timetable card */}
            {timetableLoading ? (
              <div className="timetable-card timetable-skeleton" aria-label="Loading timetable">
                <div className="skeleton-line wide" />
                <div className="skeleton-line medium" />
                <div className="skeleton-block" />
                <div className="skeleton-line short" />
              </div>
            ) : (
              <div className="timetable-card">
                <div className="timetable-heading">
                  <div>
                    <span className="eyebrow">OFFICIAL WBTC INTRA-CITY PUBLICATION</span>
                    <strong>Verified Route Directory · {WBTC_ROUTES.length} routes</strong>
                  </div>
                  <Clock3 size={17} />
                </div>
                <p>
                  Smart Bus cross-references all 131 official WBTC intra-city bus services published in the official route sheet. All routes include full stop sequences and Google Maps polyline visualization.
                </p>
                <div className="timetable-facts">
                  <span><CircleCheck size={14} /> 100% Verified Routes</span>
                  <span><BellRing size={14} /> Google Maps Integrated</span>
                </div>
                <a href="https://wbtconline.in/assets/pdf/INTRA_CITY_RTS_Latest-small.pdf" target="_blank" rel="noreferrer" className="official-link">
                  Open official WBTC intra-city route publication PDF <ArrowUpRight size={14} />
                </a>
              </div>
            )}
          </motion.div>}

          {/* ── Community Tab ────────────────────────────────────────────── */}
          {activeTab === "community" && <motion.div key="community" className="content-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <div className="content-hero compact">
              <div><span className="eyebrow">RIDERS TOGETHER</span><h2>Community & group</h2><p>Chat with riders, add close people, and see shared boarding updates.</p></div>
              <div className="hero-orb coral-orb"><MessagesSquare size={23} /></div>
            </div>
            <div className="group-card">
              <div className="community-header group-heading">
                <div><strong>My close people</strong><span>Private group profiles · location sharing is opt-in</span></div>
                <button type="button" className="profile-action" onClick={generateInviteLink}><Link2 size={15} /> Invite friends</button>
                <button type="button" className="profile-action" onClick={() => document.getElementById("group-name")?.focus()}><UserPlus size={15} /> Add person</button>
              </div>
              {pendingInviteToken && <div className="invite-panel invite-accept-panel">
                <div><span className="eyebrow">GROUP INVITATION</span><strong>Someone invited your guest profile to their Smart Bus group</strong><small>Your guest nickname may be visible to its members. Joining is optional.</small></div>
                <div className="invite-link-row">
                  <button type="button" className="primary-action" disabled={!isAuthenticated || acceptInviteMutation.isPending} onClick={() => acceptInviteMutation.mutate({ token: pendingInviteToken })}>{acceptInviteMutation.isPending ? "Joining…" : "Accept invitation"}</button>
                  <button type="button" className="secondary-action" onClick={() => { setPendingInviteToken(null); window.history.replaceState({}, "", "/"); }}>Decline</button>
                </div>
              </div>}
              <AnimatePresence>
                {showInvitePanel && (
                  <motion.div className="invite-panel" initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0, y: -6 }}>
                    <div><span className="eyebrow">PRIVATE INVITE</span><strong>Bring trusted people into your group</strong><small>Invite links do not share location until each person consents.</small></div>
                    <div className="invite-link-row">
                      <input readOnly value={inviteLink} placeholder="Generate a secure invite link" />
                      <button type="button" onClick={copyInviteLink} aria-label="Copy invite link"><Copy size={15} /></button>
                      <button type="button" onClick={() => navigator.share?.({ title: "Join my Smart Bus group", url: inviteLink }).catch(() => undefined)} aria-label="Share invite link"><Share2 size={15} /></button>
                    </div>
                    <button type="button" className="text-button" onClick={() => { const token = inviteLink.split("/").pop(); if (token && /^[a-f0-9]{64}$/i.test(token)) revokeInviteMutation.mutate({ token }); generateInviteLink(); }}>Revoke and create a new link</button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="group-add-row">
                <input id="group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Name · e.g. Maa, Arjun" />
                <input value={groupRelation} onChange={(event) => setGroupRelation(event.target.value)} placeholder="Relation" />
                <button type="button" aria-label="Add close person" onClick={addClosePerson}><Plus size={17} /></button>
              </div>
              {!isAuthenticated ? (
                <div className="group-empty"><UserPlus size={20} /><strong>Opening your guest group…</strong><span>Your Close People group is private to this browser session.</span></div>
              ) : (
                <>
                  <div className="group-live-summary"><span><span className="live-dot" /> {groupQuery.data?.filter((person) => person.locationSharing && person.lat && person.lng).length || 0} sharing live location</span><span>{groupQuery.data?.filter((person) => person.boardingStatus === "boarded").length || 0} boarded now</span></div>
                  <div className="group-people">
                    {(groupQuery.data || []).map((person) => (
                      <div className={`group-person ${activeContactId === person.id ? "active" : ""}`} key={person.id} onClick={() => setActiveContactId(person.id)}>
                        <div className="avatar">{initials(person.displayName)}</div>
                        <div className="group-person-copy">
                          <strong>{person.displayName}</strong>
                          <span>{person.relation || "Close person"}{person.locationSharing && person.lat ? " · live location" : ""}</span>
                          {person.route && <small><BusFront size={11} /> {person.route} · {person.boardingStatus === "boarded" ? "Boarded" : "Waiting"}</small>}
                        </div>
                        <div className="group-person-actions">
                          <StatusPill tone={person.boardingStatus === "boarded" ? "mint" : person.boardingStatus === "waiting" ? "amber" : "blue"}>{person.boardingStatus === "boarded" ? "On bus" : person.boardingStatus === "waiting" ? "Waiting" : "Unknown"}</StatusPill>
                          <button type="button" className={`consent-toggle ${person.locationSharing ? "enabled" : ""}`} aria-label={`${person.locationSharing ? "Pause" : "Enable"} location sharing for ${person.displayName}`} onClick={(event) => { event.stopPropagation(); toggleContactLocation(person.id, !person.locationSharing); }}><LocateFixed size={13} /></button>
                          <button type="button" aria-label={`Chat with ${person.displayName}`} onClick={(event) => { event.stopPropagation(); toast(`Chat with ${person.displayName}`, { description: "Use the rider chat below to send an update." }); }}><MessagesSquare size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {groupQuery.data?.length ? (
                    <div className="group-map-wrap">
                      <GoogleKolkataMap vehicles={(groupQuery.data || []).filter((person) => person.locationSharing && person.lat && person.lng).map((person) => ({ id: String(person.id), route: person.displayName, lat: person.lat as number, lng: person.lng as number, speed: 0 }))} selectedRoute="" showAll userLocation={userLocation} follow={false} darkMode={darkMode} onBusClick={(name) => toast(`Live location · ${name}`)} />
                    </div>
                  ) : (
                    <div className="group-empty compact-empty"><MapPinned size={20} /><strong>No group profiles yet</strong><span>Add a close person above to start sharing location and bus status.</span></div>
                  )}
                </>
              )}
            </div>

            <div className="community-card">
              <div className="community-header">
                <div><strong>Live rider chat</strong><span>Share useful stop updates · {chatRouteTag ? `tagged ${chatRouteTag}` : "route tag optional"}</span></div>
                <StatusPill tone={liveVehicles.length ? "mint" : "blue"}>{liveVehicles.length ? "GPS connected" : "Route updates"}</StatusPill>
              </div>
              <div className="boarded-route-picker"><RouteTagAutocomplete value={chatRouteTag} onChange={setChatRouteTag} /></div>
              <div className="community-messages">
                {(communityQuery.data || []).length ? communityQuery.data?.map((message) => (
                  <div className="community-message" key={message.id}>
                    <div className="avatar tiny">{message.userId === user?.id && avatarUrl ? <img src={avatarUrl} alt="Your profile" /> : initials(message.userName)}</div>
                    <div>
                      <div><strong>{message.userName || "Smart Bus rider"}</strong>{message.route && <span className="route-tag">{message.route}</span>}</div>
                      <p>{message.body}</p>
                      <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                    </div>
                  </div>
                )) : (
                  <div className="empty-state compact-empty"><div className="empty-icon"><MessagesSquare size={22} /></div><p>No rider updates yet</p><span>Be the first to share what’s happening on your bus.</span></div>
                )}
              </div>
              <div className="community-composer">
                <input value={communityDraft} onChange={(event) => setCommunityDraft(event.target.value)} placeholder="Share a useful rider update..." maxLength={500} />
                <button type="button" aria-label="Send community message" disabled={!communityDraft.trim() || sendCommunityMutation.isPending} onClick={() => { if (!communityDraft.trim()) return; sendCommunityMutation.mutate({ body: communityDraft.trim(), route: chatRouteTag || null }); }}><Send size={17} /></button>
              </div>
            </div>
          </motion.div>}

          {/* ── Favorites Tab ────────────────────────────────────────────── */}
          {activeTab === "favorites" && <motion.div key="favorites" className="content-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <div className="content-hero compact">
              <div><span className="eyebrow">YOUR SHORTLIST</span><h2>Favorites</h2><p>Quick access to the routes you ride most.</p></div>
              <div className="hero-orb coral-orb"><Heart size={23} fill="currentColor" /></div>
            </div>
            <div className="favorites-summary">
              <div><span className="eyebrow">SAVED ROUTES</span><strong>{favorites.length}</strong></div>
              <div className="summary-divider" />
              <div><span className="eyebrow">ACTIVE BUSES</span><strong>{buses.length}</strong></div>
              <button type="button" onClick={() => setActiveTab("search")}><Search size={16} /> Find a bus</button>
            </div>
            {favorites.length === 0 ? (
              <div className="empty-state"><div className="empty-icon"><Heart size={22} /></div><p>Your favorites are empty</p><span>Save routes to see them here.</span></div>
            ) : (
              <div className="favorites-grid">
                {activeBuses.filter((bus) => favorites.includes(bus.id)).map((bus) => (
                  <button
                    type="button"
                    key={bus.id}
                    className="favorite-route-card"
                    onClick={() => {
                      setSelectedId(bus.id);
                      handleSelectRouteByName(bus.route);
                    }}
                  >
                    <div className="favorite-card-top">
                      <span className="route-token" style={{ background: bus.color }}>{bus.route}</span>
                      <Heart size={16} fill="currentColor" className="heart-filled" />
                    </div>
                    <strong>{bus.name}</strong>
                    <span className="favorite-location"><MapPin size={13} /> {bus.location}</span>
                    <div className="favorite-card-bottom">
                      <span>Tap to view route on map</span>
                      <StatusPill tone={bus.statusTone}>{bus.status}</StatusPill>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>}

          {/* ── Notifications Tab ────────────────────────────────────────── */}
          {activeTab === "notifications" && <motion.div key="notifications" className="content-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <div className="content-hero compact">
              <div><span className="eyebrow">STAY IN THE LOOP</span><h2>Notifications</h2><p>Transit moments that matter to your journey.</p></div>
              <div className="hero-orb amber-orb"><Bell size={23} fill="currentColor" /></div>
            </div>
            <div className="notification-setting">
              <div className="setting-icon"><Bell size={17} /></div>
              <div><strong>Arrival alerts</strong><span>{notificationPermission === "granted" ? "Browser permission granted · alerts are ready." : "Get notified when a favorite bus is close."}</span></div>
              <button type="button" className={`toggle ${notificationsEnabled ? "on" : ""}`} onClick={() => { setNotificationsEnabled((value) => !value); toast(notificationsEnabled ? "Notifications paused" : "Notifications enabled"); }}><span /></button>
            </div>
            <button type="button" className="permission-action" onClick={handlePushPermission}>
              <Bell size={16} /> {notificationPermission === "granted" ? "Permission enabled" : "Enable real browser notifications"}<ChevronRight size={15} />
            </button>
            <div className="notice-list">
              {notices.map((notice, index) => (
                <div className="notice-card" key={notice.title}>
                  <div className={`notice-icon ${notice.tone}`}>{notice.icon === "bell" ? <Bell size={17} /> : notice.icon === "bus" ? <BusFront size={17} /> : <ShieldCheck size={17} />}</div>
                  <div><strong>{notice.title}</strong><span>{notice.detail}</span></div>
                  <time>{notice.time}</time>
                  {index === 0 && <span className="unread-dot" />}
                </div>
              ))}
            </div>
          </motion.div>}

          {/* ── Settings Tab ─────────────────────────────────────────────── */}
          {activeTab === "settings" && <motion.div key="settings" className="content-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <div className="content-hero compact">
              <div><span className="eyebrow">MAKE IT YOURS</span><h2>Settings</h2><p>Control your live transit experience and rider account.</p></div>
              <div className="hero-orb violet-orb"><Settings size={23} /></div>
            </div>
            <div className="profile-card">
              <div className="profile-avatar">{avatarUrl ? <img src={avatarUrl} alt="Guest profile" /> : <span>{initials(profileName || user?.name)}</span>}</div>
              <div className="profile-copy"><span className="eyebrow">GUEST PROFILE</span><strong>{profileName || user?.name || "Guest rider"}</strong><span>Nickname and profile picture stay on this device.</span></div>
              <label className="profile-action"><UserRound size={15} /> Change picture<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { void handleGuestAvatar(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
            </div>
            <div className="settings-card">
              <div className="settings-section">
                <span className="settings-label">RIDER PROFILE</span>
                <label className="profile-field"><span>Display name</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder={user?.name || "Your name"} /></label>
                {avatarUrl && <button type="button" className="profile-action" onClick={() => void restoreGuestAvatar()}>Restore initials avatar</button>}
                <label className="profile-field"><span>Home stop</span><input value={homeStop} onChange={(event) => setHomeStop(event.target.value)} placeholder="Esplanade, Garia..." /></label>
                <button type="button" className="primary-action full" onClick={saveUserProfile}><Check size={16} /> Save rider profile</button>
              </div>
              <div className="settings-section">
                <span className="settings-label">PREFERENCES</span>
                <div className="setting-row">
                  <div className="setting-icon"><Moon size={17} /></div>
                  <div><strong>Appearance</strong><span>{darkMode ? "Midnight mode" : "Daylight mode"}</span></div>
                  <button type="button" className={`toggle ${darkMode ? "on" : ""}`} onClick={() => setDarkMode((value) => !value)}><span /></button>
                </div>
                <div className="setting-row">
                  <div className="setting-icon"><Bell size={17} /></div>
                  <div><strong>Push notifications</strong><span>{notificationPermission === "granted" ? "Browser permission granted" : "Permission not enabled"}</span></div>
                  <button type="button" className="permission-pill button-pill" onClick={handlePushPermission}>{notificationPermission === "granted" ? "Enabled" : "Allow"}</button>
                </div>
                <div className="setting-row">
                  <div className="setting-icon"><LocateFixed size={17} /></div>
                  <div><strong>Location access</strong><span>Used to show nearby buses</span></div>
                  <button type="button" className="permission-pill button-pill" onClick={requestUserLocation}>{locationStatus === "ready" ? "Refresh" : locationStatus === "requesting" ? "Finding…" : "Allow"}</button>
                </div>
              </div>
              <div className="settings-section">
                <span className="settings-label">WBTC STOP COORDINATES</span>
                <div className="setting-row"><div className="setting-icon"><MapPinned size={17} /></div><div><strong>{stopResolutionReport.verifiedCount} verified · {stopResolutionReport.unverifiedCoordinateCount} approximate · {stopResolutionReport.unresolvedCount} unmapped</strong><span>Google-verified stop locations are cached in the project; run the resumable WBTC resolver to complete the directory.</span></div></div>
                {stopResolutionReport.unresolvedCount > 0 && <details className="unresolved-stop-report"><summary>{stopResolutionReport.unresolvedCount} names still need route-time lookup or review</summary><p>{stopResolutionReport.unresolvedStops.join(" · ")}</p></details>}
              </div>
              <div className="settings-section">
                <span className="settings-label">ABOUT</span>
                <button type="button" className="link-row" onClick={() => setInfoPanel("about")}><div className="setting-icon"><Sparkles size={17} /></div><div><strong>About Smart Bus</strong><span>Kolkata WBTC Bus Discovery Application</span></div><ChevronRight size={17} /></button>
                <button type="button" className="link-row" onClick={() => setInfoPanel("privacy")}><div className="setting-icon"><ShieldCheck size={17} /></div><div><strong>Privacy & safety</strong><span>Guest identity is device-level; location sharing stays opt-in</span></div><ChevronRight size={17} /></button>
              </div>
            </div>
          </motion.div>}
        </AnimatePresence>
      </main>

      {/* ── Mobile Bus Sheet ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBusSheet && activeTab === "home" && (
          <motion.div className="bus-sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBusSheet(false)}>
            <motion.section className="bus-bottom-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 34 }} onClick={(event) => event.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-heading">
                <div>
                  <span className="eyebrow">ROUTE DETAILS</span>
                  <h2>{currentRouteObj ? currentRouteObj.route : selected.route} <span>· {isACRoute(currentRouteObj?.route || selected.route) ? "AC" : "Non-AC"}</span></h2>
                </div>
                <button type="button" className="icon-button" aria-label="Close bus details" onClick={() => setShowBusSheet(false)}><X size={17} /></button>
              </div>
              <div className="sheet-route-row">
                <div className="route-token" style={{ background: isACRoute(currentRouteObj?.route || selected.route) ? "#45d9d0" : selected.color }}>
                  {currentRouteObj ? currentRouteObj.route : selected.route}
                </div>
                <div>
                  <strong>{currentRouteObj ? (isRouteReversed ? `${currentRouteObj.destination} → ${currentRouteObj.origin}` : `${currentRouteObj.origin} → ${currentRouteObj.destination}`) : selected.name}</strong>
                  <span><MapPin size={12} /> {routeGeoData.stopMarkers.length} mapped stops</span>
                </div>
                <StatusPill tone="mint">WBTC Route</StatusPill>
              </div>
              <div className="sheet-metrics">
                <div><span>Origin</span><strong>{currentRouteObj?.origin || "Kolkata"}</strong></div>
                <div><span>Destination</span><strong>{currentRouteObj?.destination || "Kolkata"}</strong></div>
                <div><span>Stops</span><strong>{routeGeoData.orderedStops.length}</strong></div>
              </div>
              <div className="sheet-actions">
                <button type="button" className="primary-action" onClick={() => { setShowBusSheet(false); }}>
                  <Navigation size={15} /> View on Map
                </button>
                <button type="button" className="secondary-action" onClick={() => { setShowBusSheet(false); setActiveTab("search"); setQuery(currentRouteObj?.route || selected.route); }}>
                  Search route <ChevronRight size={15} />
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Info Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {infoPanel && (
          <motion.div className="info-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setInfoPanel(null)}>
            <motion.section className="info-modal" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} onClick={(event) => event.stopPropagation()}>
              <div className="info-modal-head">
                <div><span className="eyebrow">SMART BUS</span><h2>{infoPanel === "about" ? "About Smart Bus" : "Privacy & safety"}</h2></div>
                <button type="button" className="icon-button" onClick={() => setInfoPanel(null)}><X size={17} /></button>
              </div>
              {infoPanel === "about" ? (
                <div className="info-modal-copy">
                  <p>Smart Bus is a Kolkata-first transit companion for WBTC route discovery, Google Maps polyline visualization, order-aware trip planning, and rider updates.</p>
                  <h3>Key Features</h3>
                  <ul>
                    <li>131 official WBTC intra-city bus routes matching the official publication.</li>
                    <li>Full Google Maps polyline routing and stop markers for every route.</li>
                    <li>Order-aware trip planner matching routes in forward and return directions.</li>
                    <li>Interactive stop list: click any stop to center and inspect on the map.</li>
                    <li>Prototype mode: Real-time vehicle tracking will activate when official WBTC GPS feeds are connected.</li>
                  </ul>
                  <p className="muted-note">Source of truth: West Bengal Transport Corporation (WBTC) official city bus publication.</p>
                </div>
              ) : (
                <div className="info-modal-copy">
                  <p>Smart Bus keeps control of your location and sharing choices with you.</p>
                  <h3>Your controls</h3>
                  <ul>
                    <li>Browser location is requested only when you tap the location control.</li>
                    <li>Close-person location sharing is opt-in and can be turned off per person.</li>
                    <li>Boarded-bus status is shared only with your Smart Bus group and chat context.</li>
                    <li>Push notifications require explicit browser permission.</li>
                  </ul>
                  <p className="muted-note">Do not share sensitive personal information in public rider updates.</p>
                </div>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.filter(({ id }) => ["home", "search", "trip", "community", "settings"].includes(id)).map(({ id, label, icon: Icon }) => (
          <button type="button" key={id} className={activeTab === id ? "active" : ""} onClick={() => selectTab(id)}>
            <span className="mobile-nav-icon"><Icon size={19} strokeWidth={activeTab === id ? 2.5 : 1.9} />{id === "notifications" && <i />}</span>
            <span>{label === "Live map" ? "Map" : label === "Search buses" ? "Search" : label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
