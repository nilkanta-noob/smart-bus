/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import type { LatLng, StopMarker } from "@/lib/kolkata-stops";
import { positionAlongRoute, routePositionAtDistance } from "@/lib/route-geometry";
import type { SimulationRuntime } from "@/lib/route-simulation";
import { toast } from "sonner";
import { KeyRound, Layers, MapPin, X, Check, ExternalLink } from "lucide-react";

declare global {
  interface Window {
    google?: typeof google;
  }
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

const STORAGE_KEY = "smart_bus_gmaps_key";

export function getActiveGoogleMapsKey(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (envKey && envKey.trim().length > 0) return envKey.trim();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.trim().length > 0) return stored.trim();
  return undefined;
}

let mapsPromise: Promise<typeof google> | null = null;

function loadGoogleMaps(apiKey?: string): Promise<typeof google> {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<typeof google>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-smart-bus-gmaps]");
    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.dataset.smartBusGmaps = "true";
    const keyParam = apiKey ? `key=${encodeURIComponent(apiKey)}&` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?${keyParam}v=weekly&libraries=marker,places,geometry`;
    script.async = true;
    script.defer = true;

    const timeout = setTimeout(() => {
      reject(new Error("Google Maps load timed out"));
    }, 9000);

    script.onload = () => {
      clearTimeout(timeout);
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps API failed to initialize"));
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Google Maps script failed to load"));
    };

    document.head.appendChild(script);
  });

  return mapsPromise;
}

/* =========================================================================
   Interactive Leaflet Map Engine
   ========================================================================= */
function LeafletKolkataMap({
  vehicles,
  selectedRoute,
  showAll,
  userLocation,
  follow,
  darkMode,
  onBusClick,
  routePath,
  routePaths,
  stopMarkers,
  routeColor = "#45d9d0",
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
  routePath?: LatLng[];
  routePaths?: LatLng[][];
  stopMarkers?: StopMarker[];
  routeColor?: string;
  activeStop?: StopMarker | null;
  onStopClick?: (stop: StopMarker) => void;
  travelledMeters?: number;
  simulationRuntime?: RefObject<SimulationRuntime>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const travelledPolylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const busMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const simulatedBusMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [22.5726, 88.3639],
      zoom: 12,
      minZoom: 10,
      maxZoom: 19,
      zoomControl: true,
      attributionControl: false,
    });

    const tileUrl = darkMode
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    stopMarkersLayerRef.current = L.layerGroup().addTo(map);
    busMarkersLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [darkMode]);

  // Handle route polylines
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old polylines
    polylinesRef.current.forEach((p) => p.remove());
    polylinesRef.current = [];
    travelledPolylineRef.current?.remove();
    travelledPolylineRef.current = null;

    const paths = routePaths?.length ? routePaths : routePath?.length ? [routePath] : [];
    if (!paths.length) return;

    const latLngBounds = L.latLngBounds([]);

    paths.forEach((path) => {
      if (path.length < 2) return;
      const latLngs = path.map((pt) => [pt.lat, pt.lng] as [number, number]);
      latLngs.forEach((pt) => latLngBounds.extend(pt));

      const poly = L.polyline(latLngs, {
        color: routeColor || "#45d9d0",
        weight: 6,
        opacity: 0.92,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      polylinesRef.current.push(poly);
    });

    if (routePath && routePath.length >= 2) {
      travelledPolylineRef.current = L.polyline([], {
        color: "#ffffff",
        weight: 6,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }

    if (latLngBounds.isValid()) {
      map.fitBounds(latLngBounds, { padding: [60, 60] });
    }
  }, [routePath, routePaths, routeColor]);

  // Handle travelled distance update
  useEffect(() => {
    if (!travelledPolylineRef.current || !routePath || routePath.length < 2) return;
    const progress = positionAlongRoute(routePath, travelledMeters).travelledPath;
    const latLngs = progress.map((pt) => [pt.lat, pt.lng] as [number, number]);
    travelledPolylineRef.current.setLatLngs(latLngs.length > 1 ? latLngs : []);
  }, [routePath, travelledMeters]);

  // Handle stop markers
  useEffect(() => {
    const group = stopMarkersLayerRef.current;
    if (!group) return;

    group.clearLayers();
    if (!stopMarkers || !stopMarkers.length) return;

    stopMarkers.forEach((stop) => {
      const isOrigin = stop.kind === "origin";
      const isDest = stop.kind === "destination";
      const color = isOrigin ? "#10b981" : isDest ? "#ff6b62" : "#45d9d0";
      const size = isOrigin || isDest ? 16 : 10;
      const border = isOrigin || isDest ? "2.5px solid #fff" : "2px solid #07121f";

      const html = `<div style="width:${size}px; height:${size}px; border-radius:50%; background:${color}; border:${border}; box-shadow:0 0 0 3px ${color}55, 0 3px 8px rgba(0,0,0,0.4); cursor:pointer;"></div>`;

      const icon = L.divIcon({
        className: "leaflet-stop-pin",
        html,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([stop.coord.lat, stop.coord.lng], { icon });

      const roleText = isOrigin
        ? "🏁 Starting Terminal"
        : isDest
        ? "🎯 Final Terminal"
        : `🚏 Stoppage #${(stop.index ?? 0) + 1}`;

      marker.bindPopup(
        `<div style="font-family:'DM Sans',sans-serif;padding:4px 6px;color:#07121f;font-size:12px;min-width:130px;">
          <strong style="font-size:13px;display:block;margin-bottom:2px;color:#0f172a;">${stop.label}</strong>
          <span style="color:${color};font-weight:700;font-size:11px;">${roleText}</span>
        </div>`,
        { closeButton: false }
      );

      marker.on("click", () => {
        onStopClick?.(stop);
      });

      group.addLayer(marker);
    });
  }, [stopMarkers, onStopClick]);

  // Focus active stop
  useEffect(() => {
    const map = mapRef.current;
    if (!activeStop || !map) return;
    map.panTo([activeStop.coord.lat, activeStop.coord.lng], { animate: true });
    if (map.getZoom() < 14) map.setZoom(14);
  }, [activeStop]);

  // Handle bus vehicle markers
  useEffect(() => {
    const group = busMarkersLayerRef.current;
    if (!group) return;

    group.clearLayers();

    const visible = showAll
      ? vehicles
      : vehicles
          .filter(
            (v) =>
              v.route.replace(/[^a-z0-9]/gi, "").toUpperCase() ===
              selectedRoute.replace(/[^a-z0-9]/gi, "").toUpperCase()
          )
          .slice(0, 1);

    visible.forEach((v) => {
      const isStopped = (v.speed ?? 0) <= 1;
      const html = `<button type="button" class="google-bus-marker ${isStopped ? "stopped" : "moving"}">
        <span>🚌</span><b>${v.route}</b>
      </button>`;

      const icon = L.divIcon({
        className: "leaflet-bus-icon",
        html,
        iconSize: [60, 28],
        iconAnchor: [30, 14],
      });

      const marker = L.marker([v.lat, v.lng], { icon });
      marker.on("click", () => onBusClick(v.route));
      group.addLayer(marker);
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation && mapRef.current) {
      const userHtml = `<div class="google-user-marker"></div>`;
      const userIcon = L.divIcon({
        className: "leaflet-user-icon",
        html: userHtml,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(mapRef.current);

      if (follow) {
        mapRef.current.panTo([userLocation.lat, userLocation.lng]);
      }
    }
  }, [vehicles, selectedRoute, showAll, userLocation, follow, onBusClick]);

  // Simulated bus animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routePath || routePath.length < 2 || !simulationRuntime) {
      if (simulatedBusMarkerRef.current) {
        simulatedBusMarkerRef.current.remove();
        simulatedBusMarkerRef.current = null;
      }
      return;
    }

    const html = `<div class="simulated-bus-marker"><span>🚌</span><small>DEMO</small></div>`;
    const icon = L.divIcon({
      className: "leaflet-sim-bus",
      html,
      iconSize: [40, 48],
      iconAnchor: [20, 24],
    });

    const marker = L.marker([routePath[0].lat, routePath[0].lng], {
      icon,
      zIndexOffset: 900,
    }).addTo(map);
    simulatedBusMarkerRef.current = marker;

    let frame = 0;
    const animate = () => {
      const runtime = simulationRuntime.current;
      if (runtime && simulatedBusMarkerRef.current === marker) {
        const { position, heading } = routePositionAtDistance(routePath, runtime.travelledMeters);
        marker.setLatLng([position.lat, position.lng]);
        const el = marker.getElement()?.querySelector(".simulated-bus-marker span") as HTMLElement | null;
        if (el) {
          el.style.transform = `rotate(${heading}deg)`;
        }
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      marker.remove();
      if (simulatedBusMarkerRef.current === marker) simulatedBusMarkerRef.current = null;
    };
  }, [routePath, simulationRuntime]);

  return (
    <div
      ref={containerRef}
      className={cn("google-kolkata-map", darkMode && "google-kolkata-map-dark")}
      style={{ zIndex: 1 }}
    />
  );
}

/* =========================================================================
   Primary Google Maps Component (with automatic Leaflet fallback)
   ========================================================================= */
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
  routePath?: LatLng[];
  routePaths?: LatLng[][];
  stopMarkers?: StopMarker[];
  routeColor?: string;
  activeStop?: StopMarker | null;
  onStopClick?: (stop: StopMarker) => void;
  travelledMeters?: number;
  simulationRuntime?: RefObject<SimulationRuntime>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<"google" | "leaflet">("leaflet");
  const [googleLoadFailed, setGoogleLoadFailed] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [activeKey, setActiveKey] = useState<string | undefined>(getActiveGoogleMapsKey);

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

  // Attempt Google Maps initialization if API key is present or on request
  const initGoogleMaps = useCallback(async (key?: string) => {
    try {
      const g = await loadGoogleMaps(key);
      if (!container.current) return;

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
        mapId: "DEMO_MAP_ID",
        styles: darkMode
          ? [
              { elementType: "geometry", stylers: [{ color: "#1b2b3b" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#c8d7e5" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#1b2b3b" }] },
            ]
          : undefined,
      });

      mapRef.current = map;
      setMapReady(true);
      setEngine("google");
      setGoogleLoadFailed(false);
      trafficRef.current = new g.maps.TrafficLayer();
      transitRef.current = new g.maps.TransitLayer();
      onReady?.(map);
    } catch {
      setGoogleLoadFailed(true);
      setEngine("leaflet");
    }
  }, [darkMode, onReady]);

  // Initial load check
  useEffect(() => {
    const key = getActiveGoogleMapsKey();
    if (key) {
      initGoogleMaps(key);
    } else {
      // Default to high-performance interactive Leaflet map
      setEngine("leaflet");
    }
  }, [initGoogleMaps]);

  // Save custom key
  const handleSaveKey = () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      localStorage.removeItem(STORAGE_KEY);
      setActiveKey(undefined);
      setEngine("leaflet");
      toast.info("Cleared custom Google Maps key; running OpenStreetMap engine.");
      setKeyModalOpen(false);
      return;
    }

    localStorage.setItem(STORAGE_KEY, trimmed);
    setActiveKey(trimmed);
    setKeyModalOpen(false);
    toast.success("Saved Google Maps API key! Initializing Google Maps...");
    mapsPromise = null;
    initGoogleMaps(trimmed);
  };

  // Google Maps Bus markers
  useEffect(() => {
    const map = mapRef.current;
    if (engine !== "google" || !map || !window.google?.maps) return;
    const g = window.google;

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current = [];

    const visible = showAll
      ? vehicles
      : vehicles
          .filter(
            (v) =>
              v.route.replace(/[^a-z0-9]/gi, "").toUpperCase() ===
              selectedRoute.replace(/[^a-z0-9]/gi, "").toUpperCase()
          )
          .slice(0, 1);

    visible.forEach((vehicle) => {
      const content = document.createElement("button");
      content.type = "button";
      content.className = `google-bus-marker ${(vehicle.speed ?? 0) <= 1 ? "stopped" : "moving"}`;
      content.innerHTML = `<span>🚌</span><b>${vehicle.route}</b>`;
      content.title = `${vehicle.route} ${(vehicle.speed ?? 0) <= 1 ? "stopped" : "live"}`;
      content.addEventListener("click", () => onBusClick(vehicle.route));

      const Marker = (g.maps.marker as any)?.AdvancedMarkerElement;
      if (Marker) {
        const marker = new Marker({
          map,
          position: { lat: vehicle.lat, lng: vehicle.lng },
          content,
          title: vehicle.route,
        });
        markersRef.current.push(marker);
      } else {
        const marker = new (g.maps as any).Marker({
          map,
          position: { lat: vehicle.lat, lng: vehicle.lng },
          label: vehicle.route,
          title: vehicle.route,
        });
        marker.addListener("click", () => onBusClick(vehicle.route));
        markersRef.current.push(marker);
      }
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.map = null;
      userMarkerRef.current = null;
    }

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
  }, [engine, vehicles, selectedRoute, showAll, userLocation, follow, onBusClick]);

  // Google Maps Route Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (engine !== "google" || !map || !window.google?.maps) return;
    const g = window.google;

    fullRoutePolylineRef.current.forEach((polyline) => polyline.setMap(null));
    fullRoutePolylineRef.current = [];
    travelledPolylineRef.current?.setMap(null);
    travelledPolylineRef.current = null;

    const paths = routePaths?.length ? routePaths : routePath?.length ? [routePath] : [];
    if (!paths.length) return;

    fullRoutePolylineRef.current = paths
      .filter((path) => path.length >= 2)
      .map(
        (path) =>
          new g.maps.Polyline({
            path,
            strokeColor: "#1a73e8",
            strokeOpacity: 0.92,
            strokeWeight: 6,
            geodesic: true,
            zIndex: 10,
            map,
          })
      );

    if (routePath && routePath.length >= 2) {
      travelledPolylineRef.current = new g.maps.Polyline({
        path: [],
        strokeColor: "#55e4dc",
        strokeOpacity: 1,
        strokeWeight: 6,
        geodesic: true,
        zIndex: 11,
        map,
      });
    }

    const bounds = new g.maps.LatLngBounds();
    paths.forEach((path) => path.forEach((point) => bounds.extend(point)));
    map.fitBounds(bounds, { top: 70, right: 50, bottom: 70, left: 50 });
  }, [engine, routePath, routePaths, routeColor, mapReady]);

  // Google Maps Travelled path progress
  useEffect(() => {
    if (engine !== "google" || !travelledPolylineRef.current || !routePath || routePath.length < 2) return;
    const progress = positionAlongRoute(routePath, travelledMeters).travelledPath;
    travelledPolylineRef.current.setPath(progress.length > 1 ? progress : []);
  }, [engine, routePath, travelledMeters]);

  // Google Maps Stop Markers
  useEffect(() => {
    const map = mapRef.current;
    if (engine !== "google" || !map || !window.google?.maps) return;
    const g = window.google;

    stopMarkersRef.current.forEach((m) => {
      try {
        m.map = null;
      } catch {
        /* noop */
      }
    });
    stopMarkersRef.current = [];
    if (infoWindowRef.current) infoWindowRef.current.close();
    if (!stopMarkers || stopMarkers.length === 0) return;

    const showInfoWindowForStop = (stop: StopMarker, markerPos: LatLng) => {
      if (!infoWindowRef.current) infoWindowRef.current = new g.maps.InfoWindow();
      const roleText =
        stop.kind === "origin"
          ? "🏁 Starting Terminal"
          : stop.kind === "destination"
          ? "🎯 Final Terminal"
          : `🚏 Stoppage #${(stop.index ?? 0) + 1}`;
      const roleColor =
        stop.kind === "origin" ? "#059669" : stop.kind === "destination" ? "#e11d48" : "#0284c7";

      infoWindowRef.current.setContent(
        `<div style="font-family:'DM Sans',sans-serif;padding:6px 8px;color:#07121f;font-size:12px;min-width:140px;">
          <strong style="font-size:13px;display:block;margin-bottom:2px;color:#0f172a;">${stop.label}</strong>
          <span style="color:${roleColor};font-weight:700;font-size:11px;">${roleText}</span>
        </div>`
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
  }, [engine, stopMarkers, onStopClick]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Engine 1: Google Maps */}
      <div
        ref={container}
        className={cn(
          "google-kolkata-map",
          darkMode && "google-kolkata-map-dark",
          engine !== "google" && "hidden"
        )}
        aria-label="Interactive Google Map of Kolkata"
      />

      {/* Engine 2: High Performance Leaflet Interactive Map */}
      {engine === "leaflet" && (
        <LeafletKolkataMap
          vehicles={vehicles}
          selectedRoute={selectedRoute}
          showAll={showAll}
          userLocation={userLocation}
          follow={follow}
          darkMode={darkMode}
          onBusClick={onBusClick}
          routePath={routePath}
          routePaths={routePaths}
          stopMarkers={stopMarkers}
          routeColor={routeColor}
          activeStop={activeStop}
          onStopClick={onStopClick}
          travelledMeters={travelledMeters}
          simulationRuntime={simulationRuntime}
        />
      )}

      {/* Floating Map Controls & Engine Status */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (engine === "google") {
              setEngine("leaflet");
              toast.info("Switched to OpenStreetMap Engine");
            } else {
              if (activeKey) {
                initGoogleMaps(activeKey);
              } else {
                setKeyModalOpen(true);
              }
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900/90 text-slate-100 backdrop-blur-md border border-slate-700/60 shadow-lg hover:bg-slate-800 transition"
          title="Toggle Map Engine"
        >
          <Layers size={13} className="text-cyan-400" />
          <span>{engine === "google" ? "Google Maps" : "OpenStreetMap"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setInputKey(activeKey || "");
            setKeyModalOpen(true);
          }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg backdrop-blur-md border shadow-lg transition",
            activeKey
              ? "bg-emerald-950/80 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900"
              : "bg-amber-950/80 text-amber-300 border-amber-600/50 hover:bg-amber-900"
          )}
          title="Configure Google Maps API Key"
        >
          <KeyRound size={13} />
          <span>{activeKey ? "Key Set" : "Add Key"}</span>
        </button>
      </div>

      {/* API Key Modal */}
      {keyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setKeyModalOpen(false)}
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Google Maps Platform Key</h3>
                  <p className="text-xs text-slate-400">Enable Google Maps JavaScript API</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKeyModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Paste your Google Maps API Key below. The key is saved locally in your browser and activates Google Maps JavaScript API.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">API Key</label>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none font-mono text-cyan-300"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href="https://console.cloud.google.com/google/maps-apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:underline"
              >
                <span>Get key on Google Cloud</span>
                <ExternalLink size={12} />
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInputKey("");
                    localStorage.removeItem(STORAGE_KEY);
                    setActiveKey(undefined);
                    setEngine("leaflet");
                    toast.info("Cleared custom key");
                    setKeyModalOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleSaveKey}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-lg shadow-cyan-500/20"
                >
                  <Check size={14} />
                  <span>Save Key</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
