import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchRoadGeometriesForRoutes,
  readCachedRoadPath,
  routeGeometryCacheKey,
  type LatLng,
} from "@/lib/transportRouteGeometry";
import { isValidRouteCoordinate } from "@/lib/transportStopTimes";

interface RouteStop {
  name: string;
  address: string;
  lat: number;
  lng: number;
  pickupTime: string;
  passengers: number;
  camperNames?: string[];
}

interface MapRoute {
  id: number;
  name: string;
  bus: string;
  color: string;
  stops: RouteStop[];
}

interface UnplottedCamper {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  age: number;
  session: string;
}

interface TransportRouteMapProps {
  routes: MapRoute[];
  allRoutes?: MapRoute[];
  unplottedCampers?: UnplottedCamper[];
  /** Camp address — excluded from stop numbering; shown as "C" marker. */
  campAddress?: string;
  /** When false, map container may be hidden behind a loading overlay — refresh size when true. */
  layoutReady?: boolean;
  onMoveStop?: (fromRouteId: number, stopIndex: number, toRouteId: number) => void;
  onRemoveStop?: (routeId: number, stopIndex: number) => void;
  onAssignCamper?: (camperId: number, routeId: number) => void;
}

declare global {
  interface Window {
    __transportMapMoveStop?: (fromRouteId: number, stopIndex: number, toRouteId: number) => void;
    __transportMapRemoveStop?: (routeId: number, stopIndex: number) => void;
    __transportMapAssignCamper?: (camperId: number, routeId: number) => void;
  }
}

const UNPLOTTED_COLOR = "#8b5cf6";
const FADED_COLOR = "#9ca3af";

const routeCoordinates = (route: MapRoute) =>
  route.stops.reduce<[number, number][]>((coords, stop) => {
    if (!isValidRouteCoordinate(stop.lat, stop.lng)) return coords;
    const next: [number, number] = [stop.lng, stop.lat];
    const prev = coords[coords.length - 1];
    if (!prev || Math.abs(prev[0] - next[0]) > 0.000001 || Math.abs(prev[1] - next[1]) > 0.000001) {
      coords.push(next);
    }
    return coords;
  }, []);

const normAddr = (a: string) => a.toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();

const isCampStop = (stop: RouteStop, campAddress?: string) =>
  !!campAddress && normAddr(stop.address) === normAddr(campAddress);

/** Numbered circle for route stops; null = camp marker ("C"). Empty stops use a ring style. */
const createStopIcon = (
  color: string,
  stopNumber: number | null,
  opacity = 1,
  empty = false,
) => {
  const label = stopNumber != null ? String(stopNumber) : "C";
  const size = stopNumber != null && stopNumber >= 10 ? 24 : 22;
  const fontSize = stopNumber != null && stopNumber >= 10 ? 9 : 10;
  const half = size / 2;
  const fill = empty ? "white" : color;
  const textColor = empty ? color : "white";
  const border = empty ? `2px dashed ${color}` : "2px solid white";
  return L.divIcon({
    html: `<div style="background:${fill};width:${size}px;height:${size}px;border-radius:9999px;border:${border};box-shadow:0 2px 6px rgba(0,0,0,0.35);opacity:${opacity};display:flex;align-items:center;justify-content:center;color:${textColor};font-size:${fontSize}px;font-weight:700;line-height:1;font-family:system-ui,sans-serif;">${label}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half - 2],
  });
};

const isEmptyRouteStop = (stop: RouteStop) =>
  (stop.passengers ?? 0) === 0 && (!stop.camperNames || stop.camperNames.length === 0);

const createCamperIcon = () =>
  L.divIcon({
    html: `<div style="background:${UNPLOTTED_COLOR};width:16px;height:16px;border-radius:9999px;border:2px solid white;box-shadow:0 0 10px ${UNPLOTTED_COLOR}80,0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -12],
  });

interface StopMarkerRef {
  marker: L.Marker;
  stopNumber: number | null;
  empty: boolean;
}

interface RouteLayerRefs {
  polyline?: L.Polyline;
  markers: StopMarkerRef[];
  color: string;
  onRoad?: boolean;
}

export function TransportRouteMap({ routes, allRoutes, unplottedCampers = [], campAddress, layoutReady = true, onMoveStop, onRemoveStop, onAssignCamper }: TransportRouteMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLayersRef = useRef<Map<number, RouteLayerRefs>>(new Map());
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  /** undefined = loading, null = failed, LatLng[] = road path ready */
  const [roadPaths, setRoadPaths] = useState<Record<number, LatLng[] | null | undefined>>({});
  const roadPathsRef = useRef(roadPaths);
  roadPathsRef.current = roadPaths;
  const routesRef = useRef(routes);
  routesRef.current = routes;
  /** Per-route coord signature — avoids cancelling in-flight fetches when unrelated routes update. */
  const routeCoordSigRef = useRef<Map<number, string>>(new Map());
  const syncAllPolylinesRef = useRef<() => void>(() => {});
  const syncPolylinesScheduledRef = useRef(false);
  const visibleRoutesKey = useMemo(() => routes.map((r) => r.id).join(","), [routes]);

  const roadFetchSignature = useMemo(
    () =>
      routes
        .map((route) => {
          const coords = routeCoordinates(route);
          return `${route.id}:${coords.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";")}`;
        })
        .join("|"),
    [routes],
  );

  const allPoints = useMemo(() => {
    const routePoints = routes.flatMap((r) =>
      r.stops
        .filter((s) => isValidRouteCoordinate(s.lat, s.lng))
        .map((s) => [s.lat, s.lng] as [number, number]),
    );
    const camperPoints = unplottedCampers
      .filter((c) => isValidRouteCoordinate(c.lat, c.lng))
      .map((c) => [c.lat, c.lng] as [number, number]);
    return [...routePoints, ...camperPoints];
  }, [routes, unplottedCampers]);

  const bounds = useMemo(() => allPoints.length > 0 ? L.latLngBounds(allPoints) : null, [allPoints]);

  const onMoveStopRef = useRef(onMoveStop);
  const onRemoveStopRef = useRef(onRemoveStop);
  const onAssignCamperRef = useRef(onAssignCamper);
  onMoveStopRef.current = onMoveStop;
  onRemoveStopRef.current = onRemoveStop;
  onAssignCamperRef.current = onAssignCamper;

  useEffect(() => {
    window.__transportMapMoveStop = (fromRouteId, stopIndex, toRouteId) => {
      onMoveStopRef.current?.(fromRouteId, stopIndex, toRouteId);
    };
    window.__transportMapRemoveStop = (routeId, stopIndex) => {
      onRemoveStopRef.current?.(routeId, stopIndex);
    };
    window.__transportMapAssignCamper = (camperId, routeId) => {
      onAssignCamperRef.current?.(camperId, routeId);
    };
    return () => {
      delete window.__transportMapMoveStop;
      delete window.__transportMapRemoveStop;
      delete window.__transportMapAssignCamper;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true, fadeAnimation: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    leafletMapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);
    map.on("click", () => setSelectedRouteId(null));
    return () => {
      layerGroupRef.current?.clearLayers();
      leafletMapRef.current?.remove();
      layerGroupRef.current = null;
      leafletMapRef.current = null;
      routeLayersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const currentRoutes = routesRef.current;
    if (!currentRoutes.length) {
      routeCoordSigRef.current.clear();
      setRoadPaths({});
      return;
    }

    const visibleIds = new Set(currentRoutes.map((route) => route.id));
    const pendingSigById = new Map<number, string>();
    const needsFetch: { id: number; coords: [number, number][] }[] = [];
    const pathUpdates: Record<number, LatLng[] | null | undefined> = {};

    for (const route of currentRoutes) {
      const coords = routeCoordinates(route);
      if (coords.length < 2) {
        routeCoordSigRef.current.delete(route.id);
        continue;
      }

      const sig = coords.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
      pendingSigById.set(route.id, sig);

      if (routeCoordSigRef.current.get(route.id) === sig) continue;

      routeCoordSigRef.current.set(route.id, sig);
      const cacheKey = routeGeometryCacheKey(coords);
      const cached = readCachedRoadPath(cacheKey);
      if (cached) pathUpdates[route.id] = cached;
      else {
        pathUpdates[route.id] = undefined;
        needsFetch.push({ id: route.id, coords });
      }
    }

    for (const id of [...routeCoordSigRef.current.keys()]) {
      if (!visibleIds.has(id)) routeCoordSigRef.current.delete(id);
    }

    if (Object.keys(pathUpdates).length > 0) {
      setRoadPaths((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next).map(Number)) {
          if (!visibleIds.has(id)) delete next[id];
        }
        for (const [id, path] of Object.entries(pathUpdates)) {
          next[Number(id)] = path;
        }
        return next;
      });
    } else {
      setRoadPaths((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id of Object.keys(next).map(Number)) {
          if (!visibleIds.has(id)) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    if (!needsFetch.length) {
      queueMicrotask(() => syncAllPolylinesRef.current());
      return;
    }

    void (async () => {
      await fetchRoadGeometriesForRoutes(supabase, needsFetch, {
        concurrency: 4,
        onRouteComplete: ({ id, path }) => {
          if (routeCoordSigRef.current.get(id) !== pendingSigById.get(id)) return;
          setRoadPaths((prev) => ({ ...prev, [id]: path }));
          queueMicrotask(() => syncAllPolylinesRef.current());
        },
      });
    })();
  }, [roadFetchSignature]);

  const availableRoutes = allRoutes || routes;

  const attachRoutePolyline = useCallback((
    route: MapRoute,
    path: LatLng[],
    layerGroup: L.LayerGroup,
  ) => {
    const layerRefs = routeLayersRef.current.get(route.id);
    if (!layerRefs || path.length < 2) return;

    const polylineOptions: L.PolylineOptions = {
      color: route.color,
      weight: 5,
      opacity: 0.85,
    };

    layerRefs.onRoad = true;

    if (layerRefs.polyline) {
      layerRefs.polyline.setLatLngs(path);
      layerRefs.polyline.setStyle(polylineOptions);
      return;
    }

    const polyline = L.polyline(path, polylineOptions).addTo(layerGroup);
    polyline.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      setSelectedRouteId((curr) => (curr === route.id ? null : route.id));
    });
    layerRefs.polyline = polyline;
  }, []);

  const syncAllPolylines = useCallback(() => {
    const layerGroup = layerGroupRef.current;
    if (!layerGroup) return;

    for (const route of routesRef.current) {
      const layerRefs = routeLayersRef.current.get(route.id);
      if (!layerRefs) continue;

      const roadPath = roadPathsRef.current[route.id];
      if (roadPath && roadPath.length > 1) {
        attachRoutePolyline(route, roadPath, layerGroup);
        continue;
      }

      if (layerRefs.polyline) {
        layerGroup.removeLayer(layerRefs.polyline);
        layerRefs.polyline = undefined;
        layerRefs.onRoad = false;
      }
    }
  }, [attachRoutePolyline]);

  syncAllPolylinesRef.current = syncAllPolylines;

  const scheduleSyncPolylines = useCallback(() => {
    if (syncPolylinesScheduledRef.current) return;
    syncPolylinesScheduledRef.current = true;
    requestAnimationFrame(() => {
      syncPolylinesScheduledRef.current = false;
      syncAllPolylinesRef.current();
    });
  }, []);

  // Build/rebuild layers ONLY when underlying data actually changes (NOT on selection change, NOT on parent re-render)
  const buildSignatureRef = useRef<string>("");
  useEffect(() => {
    const map = leafletMapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    // Build a stable signature of everything that affects layer geometry/content.
    const signature = JSON.stringify({
      r: routes.map(r => ({
        id: r.id, name: r.name, bus: r.bus, color: r.color,
        s: r.stops.map(s => [s.lat.toFixed(5), s.lng.toFixed(5), s.name, s.address, s.pickupTime, s.passengers, (s.camperNames || []).join(",")]),
      })),
      ar: (allRoutes || routes).map(r => ({ id: r.id, name: r.name, color: r.color })),
      u: unplottedCampers.map(c => [c.id, c.lat.toFixed(5), c.lng.toFixed(5), c.name, c.address, c.age, c.session]),
    });
    if (signature === buildSignatureRef.current) return;
    buildSignatureRef.current = signature;

    layerGroup.clearLayers();
    routeLayersRef.current.clear();

    const unplottedByAddress = new Map<string, UnplottedCamper[]>();
    unplottedCampers.forEach((camper) => {
      const key = normAddr(camper.address);
      if (!key) return;
      const list = unplottedByAddress.get(key) ?? [];
      list.push(camper);
      unplottedByAddress.set(key, list);
    });

    routes.forEach((route) => {
      const layerRefs: RouteLayerRefs = { markers: [], color: route.color };

      let routeStopNum = 0;
      route.stops.forEach((stop, stopIndex) => {
        if (!isValidRouteCoordinate(stop.lat, stop.lng)) return;
        const isCamp = isCampStop(stop, campAddress);
        const stopNumber = isCamp ? null : ++routeStopNum;
        const otherRoutes = availableRoutes.filter(r => r.id !== route.id);
        const moveOptions = onMoveStop && otherRoutes.length > 0
          ? `<div style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:8px;">
              <label style="font-size:11px;font-weight:600;display:block;margin:0 0 4px;color:#6b7280;">Move to route:</label>
              <select onchange="if(this.value){window.__transportMapMoveStop(${route.id},${stopIndex},Number(this.value));this.value='';}" style="width:100%;padding:5px 6px;border:1px solid #e5e7eb;border-radius:6px;background:white;font-size:11px;color:#1f2937;cursor:pointer;">
                <option value="">Select route…</option>
                ${otherRoutes.map(r => `<option value="${r.id}">${r.name}</option>`).join("")}
              </select>
            </div>` : "";
        const removeBtn = onRemoveStop
          ? `<button onclick="window.__transportMapRemoveStop(${route.id},${stopIndex})" style="display:block;width:100%;margin-top:6px;padding:5px 8px;border:1px solid #fca5a5;border-radius:6px;background:#fef2f2;font-size:11px;cursor:pointer;color:#dc2626;font-weight:500;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'">✕ Unpin from route</button>` : "";
        const emptyStop = isEmptyRouteStop(stop);
        const pendingAtStop = unplottedByAddress.get(normAddr(stop.address)) ?? [];
        const names = stop.camperNames && stop.camperNames.length > 0 ? stop.camperNames : [stop.name];
        const title = emptyStop
          ? (pendingAtStop.length > 0
            ? `Open stop · ${pendingAtStop.length} unassigned`
            : "Open stop · no campers")
          : names.length > 1
            ? `${names.length} kids at this stop`
            : names[0];
        const namesList = !emptyStop && names.length > 1
          ? `<ul style="margin:4px 0 6px 16px;padding:0;list-style:disc;">${names.map(n => `<li style="margin:1px 0;">${n}</li>`).join("")}</ul>`
          : "";
        const pendingList = pendingAtStop.length > 0
          ? `<div style="margin:6px 0 0;padding:6px 8px;border-radius:6px;background:#f5f3ff;border:1px solid #ddd6fe;">
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${UNPLOTTED_COLOR};text-transform:uppercase;">Unassigned at this stop</p>
              ${pendingAtStop.map((c) => `<p style="margin:0;font-size:12px;font-weight:600;">${c.name}</p>`).join("")}
            </div>`
          : "";
        const stopLabel = stopNumber != null ? `Stop #${stopNumber}` : "Camp";
        const marker = L.marker([stop.lat, stop.lng], {
          icon: createStopIcon(route.color, stopNumber, 1, emptyStop),
        })
          .bindPopup(`
            <div style="min-width:220px;max-width:260px;font-size:12px;color:#1f2937;line-height:1.4;">
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${route.color};text-transform:uppercase;letter-spacing:0.5px;">${stopLabel}</p>
              <p style="font-weight:700;font-size:14px;margin:0 0 4px;">${title}</p>
              ${namesList}
              <p style="margin:2px 0;">📍 ${stop.address}</p>
              <p style="margin:2px 0;">🕐 ${stop.pickupTime}</p>
              <p style="margin:2px 0;">👥 ${emptyStop ? 0 : names.length} ${emptyStop ? "kids (open stop)" : names.length === 1 ? "kid" : "kids"}</p>
              ${pendingList}
              <p style="margin:6px 0 0;font-weight:600;color:${route.color};">🚌 ${route.name} (${route.bus})</p>
              ${moveOptions}${removeBtn}
            </div>
          `, { maxWidth: 300, autoPan: true, autoPanPadding: [24, 24], autoClose: false, closeOnClick: false, className: "transport-stop-popup" })
          .on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            setSelectedRouteId(route.id);
          })
          .addTo(layerGroup);
        layerRefs.markers.push({ marker, stopNumber, empty: emptyStop });
      });

      routeLayersRef.current.set(route.id, layerRefs);
    });

    unplottedCampers.forEach((camper) => {
      if (!isValidRouteCoordinate(camper.lat, camper.lng)) return;

      const assignDropdown = availableRoutes.length > 0
        ? `<div style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:8px;">
            <label style="font-size:11px;font-weight:600;display:block;margin:0 0 4px;color:#6b7280;">Assign to route:</label>
            <select onchange="if(this.value){window.__transportMapAssignCamper(${camper.id},Number(this.value));this.value='';}" style="width:100%;padding:5px 6px;border:1px solid #e5e7eb;border-radius:6px;background:white;font-size:11px;color:#1f2937;cursor:pointer;">
              <option value="">Select route…</option>
              ${availableRoutes.map(r => `<option value="${r.id}">${r.name}</option>`).join("")}
            </select>
          </div>` : "";

      // Find siblings: other unplotted campers at the same address
      const siblings = unplottedCampers.filter(c => c.id !== camper.id && normAddr(c.address) === normAddr(camper.address));
      const allKids = [camper, ...siblings];
      const isHousehold = siblings.length > 0;

      // Header: name(s) — bold and large. If household, list every kid.
      const nameHeader = isHousehold
        ? `<div style="margin:0 0 8px;">
            <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:${UNPLOTTED_COLOR};text-transform:uppercase;letter-spacing:0.5px;">👨‍👩‍👧 Household · ${allKids.length} kids</p>
            ${allKids.map(k => `<p style="margin:0;font-weight:700;font-size:15px;line-height:1.25;">${k.name} <span style="font-weight:500;font-size:12px;color:#6b7280;">· age ${k.age}</span></p>`).join("")}
          </div>`
        : `<p style="font-weight:700;font-size:15px;margin:0 0 6px;">${camper.name}</p>`;

      // Shared details below
      const sharedSession = allKids.every(k => k.session === camper.session) ? camper.session : `${camper.session} (+others)`;
      const detailsBlock = `
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb;color:#4b5563;font-size:12px;line-height:1.5;">
          <p style="margin:1px 0;">📍 ${camper.address}</p>
          ${!isHousehold ? `<p style="margin:1px 0;">🎂 Age ${camper.age}</p>` : ""}
          <p style="margin:1px 0;">📅 ${sharedSession}</p>
          ${isHousehold ? `<p style="margin:4px 0 0;font-size:10px;color:#6b7280;font-style:italic;">You'll choose which kids to assign — siblings are not added automatically.</p>` : ""}
        </div>`;

      L.marker([camper.lat, camper.lng], { icon: createCamperIcon() })
        .bindPopup(`
          <div style="min-width:240px;max-width:280px;font-size:12px;color:#1f2937;line-height:1.4;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <span style="background:${UNPLOTTED_COLOR};color:white;font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;">UNASSIGNED</span>
            </div>
            ${nameHeader}
            ${detailsBlock}
            ${assignDropdown}
          </div>
        `, { maxWidth: 320, autoPan: true, autoPanPadding: [24, 24], autoClose: false, closeOnClick: false, className: "transport-camper-popup" })
        .addTo(layerGroup);
    });

    syncAllPolylines();
    scheduleSyncPolylines();
  }, [routes, availableRoutes, unplottedCampers, bounds, campAddress, syncAllPolylines, scheduleSyncPolylines]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40] });
      return;
    }
    map.setView([40.82, -73.75], 10);
  }, [visibleRoutesKey, bounds]);

  useEffect(() => {
    syncAllPolylines();
    scheduleSyncPolylines();
  }, [roadPaths, syncAllPolylines, scheduleSyncPolylines]);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      leafletMapRef.current?.invalidateSize({ animate: false });
      scheduleSyncPolylines();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleSyncPolylines]);

  useEffect(() => {
    if (!layoutReady) return;
    const map = leafletMapRef.current;
    if (!map) return;
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      scheduleSyncPolylines();
    });
  }, [layoutReady, scheduleSyncPolylines]);

  // Restyle existing layers when selection changes — no clearing/redraw
  useEffect(() => {
    routeLayersRef.current.forEach((layerRefs, routeId) => {
      const isFaded = selectedRouteId !== null && selectedRouteId !== routeId;
      const lineColor = isFaded ? FADED_COLOR : layerRefs.color;

      if (layerRefs.polyline) {
        layerRefs.polyline.setStyle({
          color: lineColor,
          weight: isFaded ? 3 : 5,
          opacity: isFaded ? 0.25 : 0.85,
        });
      }
      layerRefs.markers.forEach(({ marker, stopNumber, empty }) => {
        marker.setIcon(createStopIcon(lineColor, stopNumber, isFaded ? 0.4 : 1, empty));
      });
    });
  }, [selectedRouteId]);

  return <div ref={mapRef} className="h-full w-full" />;
}
