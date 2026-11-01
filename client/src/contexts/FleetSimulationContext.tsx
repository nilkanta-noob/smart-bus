import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type FleetClock = { sessionStartedAt: number; elapsedSeconds: number; paused: boolean; speedKmh: number; setSpeedKmh: (speed: number) => void; togglePause: () => void; elapsedForRoute: (routeKey: string) => number; restartRoute: (routeKey: string) => void };
const FleetSimulationContext = createContext<FleetClock | null>(null);
const SESSION_KEY = "smartbus-fleet-session-start";

function getSessionStart() {
  const stored = Number(sessionStorage.getItem(SESSION_KEY));
  if (Number.isFinite(stored) && stored > 0) return stored;
  const startedAt = Date.now();
  sessionStorage.setItem(SESSION_KEY, String(startedAt));
  return startedAt;
}

export function FleetSimulationProvider({ children }: { children: ReactNode }) {
  const [sessionStartedAt] = useState(getSessionStart);
  const [now, setNow] = useState(Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedDuration, setPausedDuration] = useState(0);
  const [routeRestartElapsed, setRouteRestartElapsed] = useState<Record<string, number>>({});
  const [speedKmh, setSpeedKmh] = useState(30);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, []);
  const togglePause = () => {
    if (pausedAt === null) setPausedAt(Date.now());
    else { setPausedDuration((duration) => duration + Date.now() - pausedAt); setPausedAt(null); }
  };
  const elapsedSeconds = Math.max(0, ((pausedAt ?? now) - sessionStartedAt - pausedDuration) / 1000);
  const elapsedForRoute = (routeKey: string) => Math.max(0, elapsedSeconds - (routeRestartElapsed[routeKey] || 0));
  const restartRoute = (routeKey: string) => setRouteRestartElapsed((previous) => ({ ...previous, [routeKey]: elapsedSeconds }));
  const value = useMemo(() => ({ sessionStartedAt, elapsedSeconds, paused: pausedAt !== null, speedKmh, setSpeedKmh, togglePause, elapsedForRoute, restartRoute }), [sessionStartedAt, elapsedSeconds, pausedAt, speedKmh, togglePause, routeRestartElapsed]);
  return <FleetSimulationContext.Provider value={value}>{children}</FleetSimulationContext.Provider>;
}

export function useFleetSimulation() {
  const context = useContext(FleetSimulationContext);
  if (!context) throw new Error("useFleetSimulation must be used inside FleetSimulationProvider");
  return context;
}
