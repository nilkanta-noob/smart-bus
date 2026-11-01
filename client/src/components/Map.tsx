/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { cn } from "@/lib/utils";
import type { LatLng, StopMarker } from "@/lib/kolkata-stops";
import { positionAlongRoute, routePositionAtDistance } from "@/lib/route-geometry";
import type { SimulationRuntime } from "@/lib/route-simulation";

declare global {
  interface Window { google?: typeof google; }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY as string | undefined;
const FORGE_BASE_URL = (import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev").replace(/\/+$/, "");
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;
let mapsPromise: Promise<typeof google> | null = null;

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;
  mapsPromise = (async () => {
    if (GOOGLE_MAPS_API_KEY) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.dataset.smartBusGoogleMaps = "true";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&v=weekly&libraries=marker,places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Google Maps JavaScript API failed to load"));
        document.head.appendChild(script);
      });
      if (!window.google?.maps) throw new Error("Google Maps API did not initialize");
      return window.google;
    }

    const url = `${MAPS_PROXY_URL}/maps/api/js?key=${encodeURIComponent(API_KEY || "")}&v=weekly&libraries=marker,places,geocoding,geometry`;
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error(`Google Maps proxy returned ${response.status}`);
    const code = await response.text();
    const script = document.createElement("script");
    script.dataset.smartBusGoogleMaps = "true";
    script.textContent = code;
    document.head.appendChild(script);
    if (!window.google?.maps) throw new Error("Google Maps API did not initialize");
    return window.google;
  })();
  return mapsPromise;
}

export type GoogleBusPoint = {
  id: string;
  route: string;
  lat: number;
  lng: number;
  bearing?: number;
  speed?: number;
};

export type { StopMarker };

export function GoogleKolkataMap({
  vehicles,
  selectedRoute,
  showAll,
  userLocation,
  follow,
  darkMode,
  onBusClick,
  onReady,
  routePath,
  routePaths,
  stopMarkers,
  routeColor,
  activeStop,
  onStopClick,
  travelledMeters = 0,
  simulationRuntime,
}: {
  vehicles: GoogleBusPoint[];
  selectedRoute: string;
  showAll: boolean;
  userLocation: { lat: number; lng: number } | null;
  follow: boolean;
  darkMode: boolean;
  onBusClick: (route: string) => void;
  onReady?: (map: google.maps.Map) => void;
  /** Ordered array of lat/lng for the selected route polyline */
  routePath?: LatLng[];
  /** Independent mapped portions of a route with unresolved stop gaps. */
  routePaths?: LatLng[][];
  /** Labelled stop markers to render along the route */
  stopMarkers?: StopMarker[];
  /** Hex colour for the polyline (default: #45d9d0) */
  routeColor?: string;
  /** Currently focused stop from the route list */
  activeStop?: StopMarker | null;
  /** Callback when a stop marker is clicked on the map */
  onStopClick?: (stop: StopMarker) => void;
  travelledMeters?: number;
  simulationRuntime?: RefObject<SimulationRuntime>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);
  const transitRef = useRef<google.maps.TransitLayer | null>(null);
  const fullRoutePolylineRef = useRef<google.maps.Polyline[]>([]);
  const travelledPolylineRef = useRef<google.maps.Polyline | null>(null);
  const simulatedBusMarkerRef = useRef<any>(null);
  const simulatedBusContentRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const stopMarkersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // ── Map initialisation ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      if (cancelled || !container.current || mapRef.current) return;
      const map = new g.maps.Map(container.current, {
        center: { lat: 22.5726, lng: 88.3639 },
        zoom: 12,
        minZoom: 10,
        maxZoom: 18,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        clickableIcons: false,
        // This public sample map ID is supported by Google's no-cost Maps Demo Key.
        mapId: "DEMO_MAP_ID",
        styles: darkMode ? [
          { elementType: "geometry", stylers: [{ color: "#1b2b3b" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#c8d7e5" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1b2b3b" }] },
        ] : undefined,
      });
      mapRef.current = map;
      setMapReady(true);
      trafficRef.current = new g.maps.TrafficLayer();
      transitRef.current = new g.maps.TransitLayer();
      onReady?.(map);
    }).catch(() => {
      // Keep the map area useful when the Google Maps proxy is not configured
      // (common for local development) or is temporarily unavailable.
      setMapLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, [darkMode, onReady]);

  // ── Bus vehicle markers ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    const g = window.google;
    markersRef.current.forEach((marker) => { marker.map = null; });
    markersRef.current = [];
    const visible = showAll
      ? vehicles
      : vehicles.filter((vehicle) =>
          vehicle.route.replace(/[^a-z0-9]/gi, "").toUpperCase() ===
          selectedRoute.replace(/[^a-z0-9]/gi, "").toUpperCase()
        ).slice(0, 1);
    visible.forEach((vehicle) => {
      const content = document.createElement("button");
      content.type = "button";
      content.className = `google-bus-marker ${(vehicle.speed ?? 0) <= 1 ? "stopped" : "moving"}`;
      content.innerHTML = `<span>🚌</span><b>${vehicle.route}</b>`;
      content.title = `${vehicle.route} ${(vehicle.speed ?? 0) <= 1 ? "stopped" : "live"}`;
      content.addEventListener("click", () => onBusClick(vehicle.route));
      const Marker = (g.maps.marker as any)?.AdvancedMarkerElement;
      if (Marker) {
        const marker = new Marker({ map, position: { lat: vehicle.lat, lng: vehicle.lng }, content, title: vehicle.route });
        markersRef.current.push(marker);
      } else {
        const marker = new (g.maps as any).Marker({ map, position: { lat: vehicle.lat, lng: vehicle.lng }, label: vehicle.route, title: vehicle.route });
        marker.addListener("click", () => onBusClick(vehicle.route));
        markersRef.current.push(marker);
      }
    });
    if (userMarkerRef.current) { userMarkerRef.current.map = null; userMarkerRef.current = null; }
    if (userLocation) {
      const dot = document.createElement("div");
      dot.className = "google-user-marker";
      const Marker = (g.maps.marker as any)?.AdvancedMarkerElement;
      if (Marker) {
        userMarkerRef.current = new Marker({ map, position: userLocation, content: dot, title: "Your location" });
      } else {
        userMarkerRef.current = new (g.maps as any).Marker({ map, position: userLocation, title: "Your location", zIndex: 1100 });
      }
      if (follow) map.panTo(userLocation);
    }
  }, [vehicles, selectedRoute, showAll, userLocation, follow, onBusClick]);

  // ── Route polyline ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    const g = window.google;

    fullRoutePolylineRef.current.forEach((polyline) => polyline.setMap(null));
    fullRoutePolylineRef.current = [];
    travelledPolylineRef.current?.setMap(null);
    travelledPolylineRef.current = null;

    const paths = routePaths?.length ? routePaths : routePath?.length ? [routePath] : [];
    if (!paths.length) return;

    fullRoutePolylineRef.current = paths.filter((path) => path.length >= 2).map((path) => new g.maps.Polyline({
      path,
      strokeColor: "#1a73e8",
      strokeOpacity: 0.92,
      strokeWeight: 6,
      geodesic: true,
      zIndex: 10,
      map,
    }));
    if (routePath && routePath.length >= 2) travelledPolylineRef.current = new g.maps.Polyline({
      path: [],
      strokeColor: "#55e4dc",
      strokeOpacity: 1,
      strokeWeight: 6,
      geodesic: true,
      zIndex: 11,
      map,
    });

    // Fit the map to the polyline bounds with comfortable padding
    const bounds = new g.maps.LatLngBounds();
    paths.forEach((path) => path.forEach((point) => bounds.extend(point)));
    map.fitBounds(bounds, { top: 70, right: 50, bottom: 70, left: 50 });
  }, [routePath, routePaths, routeColor, mapReady]);

  useEffect(() => {
    if (!travelledPolylineRef.current || !routePath || routePath.length < 2) return;
    const progress = positionAlongRoute(routePath, travelledMeters).travelledPath;
    travelledPolylineRef.current.setPath(progress.length > 1 ? progress : []);
  }, [routePath, travelledMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !routePath || routePath.length < 2 || !simulationRuntime) {
      if (simulatedBusMarkerRef.current) simulatedBusMarkerRef.current.map = null;
      simulatedBusMarkerRef.current = null;
      simulatedBusContentRef.current = null;
      return;
    }
    const content = document.createElement("div");
    content.className = "simulated-bus-marker";
    content.innerHTML = "<span>🚌</span><small>DEMO</small>";
    const AdvancedMarker = (window.google?.maps.marker as any)?.AdvancedMarkerElement;
    if (!AdvancedMarker) return;
    const marker = new AdvancedMarker({
      map,
      position: routePath[0],
      content,
      title: "Demo simulated bus; not live GPS",
      zIndex: 1000,
    });
    simulatedBusMarkerRef.current = marker;
    simulatedBusContentRef.current = content;
    let frame = 0;
    let lastProgressUpdate = 0;
    const animate = (now: number) => {
      const runtime = simulationRuntime.current;
      if (runtime && simulatedBusMarkerRef.current === marker) {
        const { position, heading } = routePositionAtDistance(routePath, runtime.travelledMeters);
        marker.position = position;
        content.style.setProperty("--bus-bearing", `${heading}deg`);
        if (now - lastProgressUpdate >= 250) {
          const progress = positionAlongRoute(routePath, runtime.travelledMeters).travelledPath;
          travelledPolylineRef.current?.setPath(progress.length > 1 ? progress : []);
          lastProgressUpdate = now;
        }
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      marker.map = null;
      if (simulatedBusMarkerRef.current === marker) simulatedBusMarkerRef.current = null;
      simulatedBusContentRef.current = null;
    };
  }, [routePath, simulationRuntime, mapReady]);

  // ── Stop markers along the route ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    const g = window.google;

    // Clear previous stop markers & InfoWindow
    stopMarkersRef.current.forEach((m) => { try { m.map = null; } catch { /* noop */ } });
    stopMarkersRef.current = [];
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    if (!stopMarkers || stopMarkers.length === 0) return;

    const showInfoWindowForStop = (stop: StopMarker, markerPos: LatLng) => {
      if (!infoWindowRef.current) {
        infoWindowRef.current = new g.maps.InfoWindow();
      }
      const roleText =
        stop.kind === "origin"
          ? "🏁 Starting Terminal"
          : stop.kind === "destination"
          ? "🎯 Final Terminal"
          : `🚏 Stoppage #${(stop.index ?? 0) + 1}`;
      const roleColor =
        stop.kind === "origin"
          ? "#059669"
          : stop.kind === "destination"
          ? "#e11d48"
          : "#0284c7";

      infoWindowRef.current.setContent(
        `<div style="font-family:'DM Sans',sans-serif;padding:6px 8px;color:#07121f;font-size:12px;min-width:140px;">` +
        `<strong style="font-size:13px;display:block;margin-bottom:2px;color:#0f172a;">${stop.label}</strong>` +
        `<span style="color:${roleColor};font-weight:700;font-size:11px;">${roleText}</span>` +
        `</div>`
      );
      infoWindowRef.current.setPosition(markerPos);
      infoWindowRef.current.open(map);
      onStopClick?.(stop);
    };

    stopMarkers.forEach((stop) => {
      const el = document.createElement("div");
      el.className = `route-stop-marker route-stop-${stop.kind}`;
      el.title = `${stop.label} (${stop.kind})`;
      el.addEventListener("click", () => showInfoWindowForStop(stop, stop.coord));

      const AdvancedMarker = (g.maps.marker as any)?.AdvancedMarkerElement;
      if (AdvancedMarker) {
        const m = new AdvancedMarker({
          map,
          position: stop.coord,
          content: el,
          title: stop.label,
        });
        m.addListener("click", () => showInfoWindowForStop(stop, stop.coord));
        stopMarkersRef.current.push(m);
      } else {
        const pinColor = stop.kind === "origin" ? "#10b981" : stop.kind === "destination" ? "#ff6b62" : "#45d9d0";
        const m = new (g.maps as any).Marker({
          map,
          position: stop.coord,
          title: stop.label,
          icon: {
            path: (g.maps as any).SymbolPath.CIRCLE,
            scale: stop.kind === "stop" ? 5 : 8,
            fillColor: pinColor,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        m.addListener("click", () => showInfoWindowForStop(stop, stop.coord));
        stopMarkersRef.current.push(m);
      }
    });
  }, [stopMarkers, onStopClick]);

  // ── Focus on active stop when selected in list ───────────────────────────
  useEffect(() => {
    if (!activeStop || !mapRef.current || !window.google?.maps) return;
    const map = mapRef.current;
    map.panTo(activeStop.coord);
    if ((map.getZoom() ?? 12) < 14) {
      map.setZoom(14);
    }
    if (!infoWindowRef.current) {
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }
    const roleText =
      activeStop.kind === "origin"
        ? "🏁 Starting Terminal"
        : activeStop.kind === "destination"
        ? "🎯 Final Terminal"
        : `🚏 Stoppage #${(activeStop.index ?? 0) + 1}`;
    const roleColor =
      activeStop.kind === "origin"
        ? "#059669"
        : activeStop.kind === "destination"
        ? "#e11d48"
        : "#0284c7";

    infoWindowRef.current.setContent(
      `<div style="font-family:'DM Sans',sans-serif;padding:6px 8px;color:#07121f;font-size:12px;min-width:140px;">` +
      `<strong style="font-size:13px;display:block;margin-bottom:2px;color:#0f172a;">${activeStop.label}</strong>` +
      `<span style="color:${roleColor};font-weight:700;font-size:11px;">${roleText}</span>` +
      `</div>`
    );
    infoWindowRef.current.setPosition(activeStop.coord);
    infoWindowRef.current.open(map);
  }, [activeStop]);

  // ── Traffic + transit layers ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    trafficRef.current?.setMap(mapRef.current);
    transitRef.current?.setMap(mapRef.current);
  }, [vehicles.length]);

  return (
    <>
      <div
        ref={container}
        className={cn("google-kolkata-map", darkMode && "google-kolkata-map-dark")}
        aria-label="Interactive Google map of Kolkata with bus routes and stops"
      />
      {mapLoadFailed && (
        <iframe
          title="Map of Kolkata"
          className="google-kolkata-map google-kolkata-map-fallback"
          src="https://www.openstreetmap.org/export/embed.html?bbox=88.22%2C22.46%2C88.48%2C22.69&layer=mapnik&marker=22.5726%2C88.3639"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </>
  );
}

export function MapView({
  className,
  initialCenter = { lat: 22.5726, lng: 88.3639 },
  initialZoom = 12,
  onMapReady,
}: {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}) {
  return (
    <div className={cn("w-full h-[500px]", className)}>
      <GoogleKolkataMap
        vehicles={[]}
        selectedRoute=""
        showAll
        userLocation={null}
        follow={false}
        darkMode={false}
        onBusClick={() => undefined}
        onReady={(map) => {
          map.setCenter(initialCenter);
          map.setZoom(initialZoom);
          onMapReady?.(map);
        }}
      />
    </div>
  );
}
