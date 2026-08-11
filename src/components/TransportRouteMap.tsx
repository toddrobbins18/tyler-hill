import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";

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

const routeGeometryKey = (route: MapRoute) =>
  `${route.id}:${route.stops.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join("|")}`;

const routeCoordinates = (route: MapRoute) =>
  route.stops.reduce<[number, number][]>((coords, stop) => {
    const next: [number, number] = [stop.lng, stop.lat];
    const prev = coords[coords.length - 1];
    if (!prev || Math.abs(prev[0] - next[0]) > 0.000001 || Math.abs(prev[1] - next[1]) > 0.000001) {
      coords.push(next);
    }
    return coords;
  }, []);

const createColoredIcon = (color: string, opacity = 1) =>
  L.divIcon({
    html: `<div style="background:${color};width:14px;height:14px;border-radius:9999px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);opacity:${opacity};"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });

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

interface RouteLayerRefs {
  polyline?: L.Polyline;
  markers: L.Marker[];
  color: string;
}

export function TransportRouteMap({ routes, allRoutes, unplottedCampers = [], onMoveStop, onRemoveStop, onAssignCamper }: TransportRouteMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLayersRef = useRef<Map<number, RouteLayerRefs>>(new Map());
  const roadPathCacheRef = useRef<Map<string, [number, number][] | null>>(new Map());
  const [roadPaths, setRoadPaths] = useState<Record<number, [number, number][] | null>>({});
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const hasFitBoundsRef = useRef(false);

  const allPoints = useMemo(() => {
    const routePoints = routes.flatMap((r) => r.stops.map((s) => [s.lat, s.lng] as [number, number]));
    const camperPoints = unplottedCampers.map((c) => [c.lat, c.lng] as [number, number]);
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

  const availableRoutes = allRoutes || routes;

  useEffect(() => {
    let cancelled = false;
    const drawableRoutes = routes.filter((route) => routeCoordinates(route).length > 1);

    const loadRoadPaths = async () => {
      const nextPaths: Record<number, [number, number][] | null> = {};
      const missing = drawableRoutes.filter((route) => {
        const key = routeGeometryKey(route);
        if (roadPathCacheRef.current.has(key)) {
          nextPaths[route.id] = roadPathCacheRef.current.get(key) ?? null;
          return false;
        }
        return true;
      });

      if (missing.length === 0) {
        if (!cancelled) setRoadPaths(nextPaths);
        return;
      }

      await Promise.all(missing.map(async (route) => {
        const key = routeGeometryKey(route);
        try {
          const { data, error } = await supabase.functions.invoke("route-optimizer", {
            body: { action: "directions", coordinates: routeCoordinates(route), includeGeometry: true },
          });
          if (error || data?.error || !Array.isArray(data?.geometry)) {
            roadPathCacheRef.current.set(key, null);
            nextPaths[route.id] = null;
            return;
          }
          const path = data.geometry as [number, number][];
          const usablePath = path.length > 1 ? path : null;
          roadPathCacheRef.current.set(key, usablePath);
          nextPaths[route.id] = usablePath;
        } catch {
          roadPathCacheRef.current.set(key, null);
          nextPaths[route.id] = null;
        }
      }));

      if (!cancelled) setRoadPaths(nextPaths);
    };

    loadRoadPaths();
    return () => { cancelled = true; };
  }, [routes]);

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
      p: Object.entries(roadPaths).map(([id, path]) => [id, path ? path.length : 0]),
    });
    if (signature === buildSignatureRef.current) return;
    buildSignatureRef.current = signature;

    layerGroup.clearLayers();
    routeLayersRef.current.clear();

    routes.forEach((route) => {
      const layerRefs: RouteLayerRefs = { markers: [], color: route.color };

      const roadPath = roadPaths[route.id];
      if (Array.isArray(roadPath) && roadPath.length > 1) {
        const polyline = L.polyline(roadPath, {
          color: route.color,
          weight: 5,
          opacity: 0.85,
          dashArray: "8 6",
        }).addTo(layerGroup);
        polyline.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedRouteId((curr) => (curr === route.id ? null : route.id));
        });
        layerRefs.polyline = polyline;
      }

      route.stops.forEach((stop, stopIndex) => {
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
        const names = stop.camperNames && stop.camperNames.length > 0 ? stop.camperNames : [stop.name];
        const title = names.length > 1 ? `${names.length} kids at this stop` : names[0];
        const namesList = names.length > 1
          ? `<ul style="margin:4px 0 6px 16px;padding:0;list-style:disc;">${names.map(n => `<li style="margin:1px 0;">${n}</li>`).join("")}</ul>`
          : "";
        const marker = L.marker([stop.lat, stop.lng], { icon: createColoredIcon(route.color) })
          .bindPopup(`
            <div style="min-width:220px;max-width:260px;font-size:12px;color:#1f2937;line-height:1.4;">
              <p style="font-weight:700;font-size:14px;margin:0 0 4px;">${title}</p>
              ${namesList}
              <p style="margin:2px 0;">📍 ${stop.address}</p>
              <p style="margin:2px 0;">🕐 ${stop.pickupTime}</p>
              <p style="margin:2px 0;">👥 ${names.length} ${names.length === 1 ? "kid" : "kids"}</p>
              <p style="margin:6px 0 0;font-weight:600;color:${route.color};">🚌 ${route.name} (${route.bus})</p>
              ${moveOptions}${removeBtn}
            </div>
          `, { maxWidth: 280, autoPan: false, autoClose: false })
          .on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            setSelectedRouteId(route.id);
          })
          .addTo(layerGroup);
        layerRefs.markers.push(marker);
      });

      routeLayersRef.current.set(route.id, layerRefs);
    });

    const normAddr = (a: string) => a.toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();

    unplottedCampers.forEach((camper) => {
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
          ${isHousehold ? `<p style="margin:4px 0 0;font-size:10px;color:#6b7280;font-style:italic;">Assigning will auto-group all ${allKids.length} kids at this stop (+${allKids.length} riders)</p>` : ""}
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
        `, { maxWidth: 300, autoPan: false, autoClose: false })
        .addTo(layerGroup);
    });

    if (!hasFitBoundsRef.current) {
      if (bounds) {
        map.fitBounds(bounds, { padding: [40, 40] });
      } else {
        map.setView([40.82, -73.75], 10);
      }
      hasFitBoundsRef.current = true;
    }
  }, [routes, availableRoutes, unplottedCampers, roadPaths, bounds]);

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
      layerRefs.markers.forEach((marker) => {
        marker.setIcon(createColoredIcon(lineColor, isFaded ? 0.4 : 1));
      });
    });
  }, [selectedRouteId]);

  return <div ref={mapRef} className="h-full w-full" />;
}
