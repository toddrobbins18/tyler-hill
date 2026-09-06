import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { TransportRouteMap } from "@/components/TransportRouteMap";
import { Bus, MapPin, Users, Plus, FileText, Car, Plane, ClipboardList, Map as MapIcon, Route as RouteIcon, UserRound, Sun, Moon, Upload, Download, UserPlus, X, Sparkles, TrendingDown, ArrowRight, Pencil, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { parseCSV, pickFirst, readFileAsText } from "@/lib/csv";
import {
  getBundledMappointRoutesCsv2026,
  mappointRoutesSummary,
  parseMappointRoutesCsv,
} from "@/lib/mappointTransportImport";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useAuth } from "@/contexts/AuthContext";

const ROUTE_COLORS = [
  "#3eb8a0", "#4a9eff", "#f59e0b", "#ef4444", "#a855f7",
  "#ec4899", "#22c55e", "#eab308", "#06b6d4", "#f97316",
  "#8b5cf6", "#14b8a6", "#6366f1", "#84cc16", "#d946ef",
  "#0ea5e9", "#dc2626", "#facc15", "#10b981", "#f43f5e",
  "#7c3aed", "#0891b2", "#65a30d", "#ea580c", "#be123c",
  "#2563eb", "#16a34a", "#ca8a04", "#9333ea", "#0d9488",
  "#db2777", "#4f46e5", "#059669", "#b45309", "#9f1239",
  "#1d4ed8", "#15803d", "#a16207", "#7e22ce", "#0f766e",
  "#be185d", "#4338ca", "#047857", "#92400e", "#881337",
  "#1e40af", "#166534", "#854d0e", "#6b21a8", "#134e4a",
];

const CAMP_LOCATION = {
  name: "Camp — 85 Crescent Beach Rd",
  address: "85 Crescent Beach Road, Glen Cove, NY 11542",
  lat: 40.879993,
  lng: -73.642634,
  pickupTime: "",
  passengers: 0,
};

interface RouteStop {
  name: string;
  address: string;
  lat: number;
  lng: number;
  pickupTime: string;
  passengers: number;
  camperNames?: string[];
}

interface Route {
  id: number;
  name: string;
  bus: string;
  stops: RouteStop[];
  campers: number;
  capacity: number;
  departure: string;
  status: string;
  direction: string;
  color: string;
}

// Haversine distance in miles between two lat/lng points
const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Estimate driving minutes between two points (~25 mph avg on LI roads, 1.4x road factor)
const drivingMinutes = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const miles = haversineMiles(lat1, lng1, lat2, lng2) * 1.4; // road winding factor
  return Math.round((miles / 25) * 60); // 25 mph average
};

// Assign "Start", "+X min" labels to an ordered list of stops
const assignDrivingTimes = (stops: RouteStop[]): RouteStop[] => {
  if (stops.length === 0) return stops;
  let cumulativeMin = 0;
  return stops.map((stop, i) => {
    if (i === 0) {
      return { ...stop, pickupTime: "Start" };
    }
    const prev = stops[i - 1];
    const legMin = Math.max(drivingMinutes(prev.lat, prev.lng, stop.lat, stop.lng), 2);
    cumulativeMin += legMin;
    return { ...stop, pickupTime: `+${cumulativeMin} min` };
  });
};

// AM routes: stops → camp (camp is last stop)
const buildAMStops = (stops: RouteStop[]): RouteStop[] =>
  assignDrivingTimes([...stops, { ...CAMP_LOCATION, pickupTime: "", passengers: 0 }]);

// PM routes: camp → stops reversed (camp is first stop)
const buildPMStops = (stops: RouteStop[]): RouteStop[] =>
  assignDrivingTimes([{ ...CAMP_LOCATION, pickupTime: "", passengers: 0 }, ...[...stops].reverse()]);

// Core stops without camp
const coreStopsFromAM = (stops: RouteStop[]): RouteStop[] =>
  stops.filter(s => s.address !== CAMP_LOCATION.address);

const coreStopsFromPM = (stops: RouteStop[]): RouteStop[] =>
  [...stops.filter(s => s.address !== CAMP_LOCATION.address)].reverse();

const initialCoreStops: Record<number, RouteStop[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
};

const initialRouteMeta = Array.from({ length: 38 }, (_, i) => ({
  id: i + 1,
  name: `Bus ${i + 1} Route`,
  bus: `Bus ${i + 1}`,
  departure: "7:00 AM",
  status: "Confirmed",
  color: ROUTE_COLORS[i % ROUTE_COLORS.length],
  capacity: 22,
}));

interface UnplottedCamper {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  age: number;
  session: string;
}

type GeocodeProvider = "ors" | "nominatim" | "census";
type GeocodeResult =
  | { lat: number; lng: number; provider?: GeocodeProvider; label?: string }
  | { error: string; retryable?: boolean; message?: string };

const isGeocodePoint = (result: GeocodeResult | null): result is { lat: number; lng: number; provider?: GeocodeProvider; label?: string } =>
  !!result && "lat" in result && "lng" in result;

const PROVIDER_LABEL: Record<GeocodeProvider, string> = {
  ors: "OpenRouteService",
  nominatim: "OpenStreetMap",
  census: "US Census",
};

const geocodeFailureMessage = (result: GeocodeResult | null, address: string) =>
  result && "error" in result
    ? `${result.message || result.error} (${address})`
    : `could not geocode "${address}"`;

const UNPLOTTED_COLOR = "#8b5cf6";

// Normalize an address so abbreviations match full words (Ln↔Lane, Rd↔Road, St↔Street, etc.)
const STREET_SUFFIX_MAP: Record<string, string> = {
  st: "street", str: "street", street: "street",
  rd: "road", road: "road",
  ln: "lane", lane: "lane",
  ave: "avenue", av: "avenue", avenue: "avenue",
  blvd: "boulevard", boulevard: "boulevard",
  dr: "drive", drive: "drive",
  ct: "court", court: "court",
  pl: "place", place: "place",
  pkwy: "parkway", parkway: "parkway",
  hwy: "highway", highway: "highway",
  ter: "terrace", terr: "terrace", terrace: "terrace",
  cir: "circle", circle: "circle",
  trl: "trail", trail: "trail",
  way: "way",
  sq: "square", square: "square",
  hl: "hill", hill: "hill",
  hts: "heights", heights: "heights",
  pt: "point", point: "point",
  cv: "cove", cove: "cove",
  xing: "crossing", crossing: "crossing",
  n: "north", s: "south", e: "east", w: "west",
  north: "north", south: "south", east: "east", west: "west",
  ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
};
const normalizeAddress = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((tok) => STREET_SUFFIX_MAP[tok] ?? tok)
    .join(" ");

const initialUnplottedCampers: UnplottedCamper[] = [];

const GEOCODE_CACHE_KEY = "transport-geocode-cache-v1";

const loadPersistedGeocodeCache = (): Map<string, GeocodeResult | null> => {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as [string, GeocodeResult | null][];
    return new Map(entries);
  } catch {
    return new Map();
  }
};

const persistGeocodeCache = (cache: Map<string, GeocodeResult | null>) => {
  try {
    const entries = [...cache.entries()].slice(-2500);
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
};

const geocodePayloadToResult = (data: Record<string, unknown> | null | undefined): GeocodeResult | null => {
  if (!data) return null;
  if (typeof data.error === "string") {
    return {
      error: data.error,
      retryable: data.retryable === true,
      message: typeof data.message === "string" ? data.message : undefined,
    };
  }
  if (data.found && typeof data.lat === "number" && typeof data.lng === "number") {
    return {
      lat: data.lat,
      lng: data.lng,
      provider: data.provider as GeocodeProvider | undefined,
      label: typeof data.label === "string" ? data.label : undefined,
    };
  }
  return null;
};

const isRetryableGeocodeFailure = (result: GeocodeResult | null) =>
  !!result && "retryable" in result && result.retryable === true;

type BoardPayload = {
  coreStops: Record<number, RouteStop[]>;
  routeMeta: typeof initialRouteMeta;
  unplottedCampers: UnplottedCamper[];
};

const boardCacheKey = (companyId: string, season: string) =>
  `transport-board-v1:${companyId}:${season}`;

const loadBoardCache = (companyId: string, season: string): BoardPayload | null => {
  try {
    const raw = localStorage.getItem(boardCacheKey(companyId, season));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardPayload;
    if (!parsed?.coreStops || !Array.isArray(parsed.routeMeta)) return null;
    const coreStops = Object.fromEntries(
      Object.entries(parsed.coreStops).map(([k, v]) => [Number(k), v as RouteStop[]]),
    );
    return { ...parsed, coreStops };
  } catch {
    return null;
  }
};

const persistBoardCache = (companyId: string, season: string, payload: BoardPayload) => {
  try {
    localStorage.setItem(boardCacheKey(companyId, season), JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
};

const residentReports = [
  { name: "Baggage Report", desc: "Track camper luggage and belongings", icon: ClipboardList },
  { name: "Bus Report", desc: "Bus manifest and seating", icon: Bus },
  { name: "Car Report", desc: "Private car arrivals/departures", icon: Car },
  { name: "Consolidated Summary", desc: "All transport modes combined", icon: FileText },
  { name: "Group Flights", desc: "Organized group flight coordination", icon: Plane },
  { name: "Master Report", desc: "Master transportation roster", icon: ClipboardList },
  { name: "Shuttles", desc: "Airport shuttle assignments", icon: Bus },
  { name: "Vehicle Allocation", desc: "Vehicle assignment overview", icon: Car },
];

const dayCampReports = [
  { name: "Attendance", desc: "Daily attendance tracking" },
  { name: "Bus Report", desc: "Day camp bus assignments" },
  { name: "Bus Route Summary", desc: "Route overview with stops" },
  { name: "Car Report", desc: "Car pickup/dropoff log" },
  { name: "Daily Passenger Update", desc: "Real-time passenger counts" },
  { name: "Extended Care", desc: "Before/after care transport" },
];

const countBoardStops = (stops: Record<number, RouteStop[]>) =>
  Object.values(stops).reduce((sum, arr) => sum + (arr?.length || 0), 0);

const statusColors: Record<string, string> = {
  Confirmed: "bg-success/10 text-success",
  Pending: "bg-warning/10 text-warning",
  Draft: "bg-muted text-muted-foreground",
};

export default function Transport() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { currentCompany, loading: companyLoading } = useCompany();
  const { currentSeason } = useSeason();
  const companyId = currentCompany?.id;
  // Core stops are the source of truth (without camp stop)
  const [coreStops, setCoreStops] = useState<Record<number, RouteStop[]>>(initialCoreStops);
  const [routeMeta, setRouteMeta] = useState(initialRouteMeta);
  const [unplottedCampers, setUnplottedCampers] = useState(initialUnplottedCampers);
  const [addRouteOpen, setAddRouteOpen] = useState(false);
  const [addCamperOpen, setAddCamperOpen] = useState(false);
  const [newUnplotted, setNewUnplotted] = useState({ name: "", address: "", age: 10, session: "Session 1" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [newRoute, setNewRoute] = useState({ name: "", bus: "", departure: "", capacity: 50 });
  const [visibleRoutes, setVisibleRoutes] = useState<number[]>(initialRouteMeta.map(r => r.id));
  const [timeOfDay, setTimeOfDay] = useState<"am" | "pm">("am");
  const [optimizing, setOptimizing] = useState(false);
  const [editRoute, setEditRoute] = useState<{
    id: number;
    name: string;
    bus: string;
    departure: string;
    status: string;
    color: string;
    capacity: number;
  } | null>(null);

  // Today-only overrides: per route, stops added or addresses excluded for today's run only
  // Keyed by route id; address used as stop identifier
  const [todayOverrides, setTodayOverrides] = useState<{
    excluded: Record<number, string[]>; // route id -> excluded stop addresses (today only)
    added: Record<number, RouteStop[]>; // route id -> stops added today only
  }>({ excluded: {}, added: {} });

  // Scope-choice dialog (Today only vs Permanent vs Cancel)
  const [scopeDialog, setScopeDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onChoose: (scope: "today" | "permanent") => void;
  }>({ open: false, title: "", description: "", onChoose: () => {} });

  // Optimize routes preview dialog
  const [optimizePreview, setOptimizePreview] = useState<{
    open: boolean;
    proposedCore: Record<number, RouteStop[]>;
    proposedUnplotted: UnplottedCamper[];
    beforeMiles: number;
    afterMiles: number;
    reassignments: { name: string; from: string; to: string }[];
    reorderedRoutes: number;
    perRoute: { id: number; name: string; bus: string; beforeMi: number; afterMi: number; changed: boolean; addedCampers: string[] }[];
    selectedRouteIds: number[];
  }>({ open: false, proposedCore: {}, proposedUnplotted: [], beforeMiles: 0, afterMiles: 0, reassignments: [], reorderedRoutes: 0, perRoute: [], selectedRouteIds: [] });

  // Turn-by-turn directions dialog
  const [directionsDialog, setDirectionsDialog] = useState<{
    open: boolean;
    routeId: number | null;
    routeName: string;
    bus: string;
    color: string;
    loading: boolean;
    error: string | null;
    totalDistanceMi: number;
    totalDurationSec: number;
    steps: { instruction: string; name: string; distanceMi: number; durationSec: number; type: number; segmentIndex?: number }[];
    stopLabels: string[];
    mapStops: { name: string; address: string; lat: number; lng: number; pickupTime: string; passengers: number; camperNames?: string[] }[];
  }>({ open: false, routeId: null, routeName: "", bus: "", color: "#3b82f6", loading: false, error: null, totalDistanceMi: 0, totalDurationSec: 0, steps: [], stopLabels: [], mapStops: [] });


  const [mapHeight, setMapHeight] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Bulk address import dialog
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [bulkImport, setBulkImport] = useState<{
    open: boolean;
    target: "campers" | "stops" | "staff";
    routeId: number | null;
    mode: "append" | "replace";
    running: boolean;
    progress: { done: number; total: number };
    log: { ok: number; skipped: number; failed: number; messages: string[]; providerCounts?: Record<string, number> };
    failedRows: { name: string; address: string; age: number; session: string; reason: string }[];
  }>({ open: false, target: "campers", routeId: null, mode: "append", running: false, progress: { done: 0, total: 0 }, log: { ok: 0, skipped: 0, failed: 0, messages: [], providerCounts: {} }, failedRows: [] });

  // Persist transport board (routes + stops + unplotted campers) to Supabase so uploads survive refresh
  const [persistLoaded, setPersistLoaded] = useState(false);
  const [boardLoading, setBoardLoading] = useState(true);
  const skipPersistRef = useRef(true);
  const importInProgressRef = useRef(false);
  const loadedScopeRef = useRef<string | null>(null);
  const lastKnownStopCountRef = useRef(0);
  const boardStateRef = useRef({
    coreStops: initialCoreStops as Record<number, RouteStop[]>,
    routeMeta: initialRouteMeta,
    unplottedCampers: initialUnplottedCampers,
  });

  boardStateRef.current = { coreStops, routeMeta, unplottedCampers };

  const persistBoard = useCallback(async (payload: BoardPayload) => {
    if (!companyId) return false;
    persistBoardCache(companyId, currentSeason, payload);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("transport_boards" as "profiles").upsert({
        company_id: companyId,
        season: currentSeason,
        data: payload as never,
        updated_by: userRes.user?.id ?? null,
        updated_at: new Date().toISOString(),
      } as never);
      if (error) {
        console.error("[Transport] Save board failed:", error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error("[Transport] Save board error:", err);
      return false;
    }
  }, [companyId, currentSeason]);

  const normalizeRouteMeta = (meta: typeof initialRouteMeta) =>
    meta.map((r, i) => ({
      ...r,
      id: Number(r.id),
      color: ROUTE_COLORS[i % ROUTE_COLORS.length],
    }));

  const applyBoardPayload = (payload: BoardPayload, source?: "supabase" | "cache") => {
    const normalizedMeta = normalizeRouteMeta(payload.routeMeta);
    setCoreStops(payload.coreStops);
    setRouteMeta(normalizedMeta);
    setVisibleRoutes(normalizedMeta.map((r) => r.id));
    setUnplottedCampers(payload.unplottedCampers);
    lastKnownStopCountRef.current = countBoardStops(payload.coreStops);
    if (companyId) persistBoardCache(companyId, currentSeason, payload);
    const stops = lastKnownStopCountRef.current;
    if (stops > 0 && source) {
      console.info(`[Transport] Board loaded (${source}): ${stops} stops, ${normalizedMeta.length} routes`);
    }
  };

  const restoreBoardFromCache = () => {
    if (!companyId) return false;
    const cached = loadBoardCache(companyId, currentSeason);
    if (!cached || countBoardStops(cached.coreStops) === 0) return false;
    applyBoardPayload(cached, "cache");
    toast({
      title: "Transport board restored",
      description: `${countBoardStops(cached.coreStops)} stops loaded from browser cache.`,
    });
    return true;
  };

  useEffect(() => {
    if (authLoading || companyLoading || !user || !companyId) {
      setBoardLoading(true);
      return;
    }
    const scope = `${companyId}:${currentSeason}`;
    if (loadedScopeRef.current === scope) {
      setBoardLoading(false);
      return;
    }
    let cancelled = false;
    skipPersistRef.current = true;
    setPersistLoaded(false);
    setBoardLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("transport_boards")
          .select("data")
          .eq("company_id", companyId)
          .eq("season", currentSeason)
          .maybeSingle();
        if (cancelled) return;
        if (importInProgressRef.current) {
          loadedScopeRef.current = scope;
          return;
        }
        if (error) {
          console.error("[Transport] Failed to load board:", error.message);
          if (!restoreBoardFromCache()) {
            toast({
              title: "Could not load transport board",
              description: error.message,
              variant: "destructive",
            });
          }
        } else if (data?.data && typeof data.data === "object") {
          const saved = data.data as any;
          const restoredStops: Record<number, RouteStop[]> = saved.coreStops && typeof saved.coreStops === "object"
            ? Object.fromEntries(
              Object.entries(saved.coreStops).map(([k, v]) => [Number(k), v as RouteStop[]]),
            )
            : initialCoreStops;

          let meta = initialRouteMeta;
          if (Array.isArray(saved.routeMeta) && saved.routeMeta.length) {
            const savedIds = new Set(saved.routeMeta.map((r: any) => Number(r.id)));
            meta = [...saved.routeMeta, ...initialRouteMeta.filter(r => !savedIds.has(r.id))];
          }

          applyBoardPayload({
            coreStops: restoredStops,
            routeMeta: meta,
            unplottedCampers: Array.isArray(saved.unplottedCampers)
              ? saved.unplottedCampers
              : initialUnplottedCampers,
          }, "supabase");
          if (countBoardStops(restoredStops) > 0) {
            toast({
              title: "Transport board restored",
              description: `${countBoardStops(restoredStops)} stops across ${meta.length} buses loaded from Supabase.`,
            });
          }
        } else if (!restoreBoardFromCache() && lastKnownStopCountRef.current === 0) {
          applyBoardPayload({
            coreStops: initialCoreStops,
            routeMeta: initialRouteMeta,
            unplottedCampers: initialUnplottedCampers,
          });
        }
      } catch (err) {
        console.error("[Transport] Load board error:", err);
      } finally {
        if (!cancelled) {
          loadedScopeRef.current = scope;
          skipPersistRef.current = false;
          setPersistLoaded(true);
          setBoardLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, companyLoading, user, companyId, currentSeason, toast]);

  useEffect(() => {
    if (!persistLoaded || !companyId || skipPersistRef.current || importInProgressRef.current) return;
    const stopCount = countBoardStops(coreStops);
    if (stopCount === 0) {
      if (lastKnownStopCountRef.current > 0) return;
      if (routeMeta.length <= initialRouteMeta.length) return;
    }

    const handle = setTimeout(() => {
      void persistBoard({ coreStops, routeMeta, unplottedCampers }).then((ok) => {
        if (ok) lastKnownStopCountRef.current = countBoardStops(coreStops);
      });
    }, 600);
    return () => clearTimeout(handle);
  }, [coreStops, routeMeta, unplottedCampers, persistLoaded, companyId, currentSeason, persistBoard]);

  // Flush unsaved board state when leaving the page (debounced save may not have fired yet).
  useEffect(() => {
    return () => {
      if (skipPersistRef.current || importInProgressRef.current || !companyId) return;
      const { coreStops: stops, routeMeta: meta, unplottedCampers: unplotted } = boardStateRef.current;
      if (countBoardStops(stops) === 0) return;
      void persistBoard({ coreStops: stops, routeMeta: meta, unplottedCampers: unplotted });
    };
  }, [companyId, currentSeason, persistBoard]);


  const downloadBulkTemplate = (target: "campers" | "stops" | "staff") => {
    const templates: Record<typeof target, string> = {
      campers: "name,address,city,state,zip,age,session\nJane Doe,123 Main St,East Hampton,NY,11937,11,Session 1\n",
      stops: "stop_name,address,city,state,zip\nEast Hampton Library,159 Main St,East Hampton,NY,11937\n",
      staff: "first_name,last_name,email,phone,address,position\nAlex,Stone,alex@camp.com,5165550101,12 Oak Ln Roslyn NY,Counselor\n",
    };
    const blob = new Blob([templates[target]], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `bulk-${target}-template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Session-level cache so repeated addresses skip the network entirely
  const geocodeCacheRef = useRef<Map<string, GeocodeResult | null>>(loadPersistedGeocodeCache());

  const cacheGeocodeResult = (address: string, result: GeocodeResult | null) => {
    const cacheKey = address.trim().toLowerCase();
    const isRetryable = result && "retryable" in result && result.retryable;
    if (!isRetryable) geocodeCacheRef.current.set(cacheKey, result);
  };

  const geocodeAddress = async (address: string): Promise<GeocodeResult | null> => {
    const cacheKey = address.trim().toLowerCase();
    const cached = geocodeCacheRef.current.get(cacheKey);
    if (cached !== undefined) return cached;
    // Retry transient errors (404 NOT_FOUND during cold-start, network blips)
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke("route-optimizer", {
          body: { action: "geocode", address },
        });
        if (error) {
          const msg = error.message || "";
          const isTransient = /not found|404|fetch|network|failed to send/i.test(msg);
          if (isTransient && attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 400 * attempt));
            continue;
          }
          return { error: msg, retryable: true };
        }
        const result = geocodePayloadToResult(data as Record<string, unknown>);
        cacheGeocodeResult(address, result);
        return result;
      } catch (e: unknown) {
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 400 * attempt));
          continue;
        }
      }
    }
    return null;
  };

  // Parallel geocoder with concurrency limit. Preserves input order.
  const geocodeBatch = async (
    addresses: string[],
    concurrency: number,
    onEach?: (index: number, result: GeocodeResult | null) => void,
  ): Promise<(GeocodeResult | null)[]> => {
    const results: (GeocodeResult | null)[] = new Array(addresses.length).fill(null);
    const pending: { index: number; address: string }[] = [];

    addresses.forEach((address, i) => {
      const cacheKey = address.trim().toLowerCase();
      const cached = geocodeCacheRef.current.get(cacheKey);
      if (cached !== undefined) {
        results[i] = cached;
        onEach?.(i, cached);
      } else {
        pending.push({ index: i, address });
      }
    });

    const CHUNK = 20;
    const batchConcurrency = Math.min(concurrency, 2);
    for (let start = 0; start < pending.length; start += CHUNK) {
      const slice = pending.slice(start, start + CHUNK);
      const chunkAddresses = slice.map((p) => p.address);
      let usedBatch = false;

      try {
        const { data, error } = await supabase.functions.invoke("route-optimizer", {
          body: {
            action: "geocodeBatch",
            addresses: chunkAddresses,
            concurrency: batchConcurrency,
          },
        });
        if (!error && Array.isArray((data as { results?: unknown[] })?.results)) {
          usedBatch = true;
          ((data as { results: Record<string, unknown>[] }).results).forEach((item, j) => {
            const entry = slice[j];
            if (!entry) return;
            const result = geocodePayloadToResult(item);
            if (!isRetryableGeocodeFailure(result)) cacheGeocodeResult(entry.address, result);
            results[entry.index] = result;
            onEach?.(entry.index, result);
          });
        }
      } catch {
        // fall through to per-address geocode
      }

      if (!usedBatch) {
        for (const entry of slice) {
          const result = await geocodeAddress(entry.address);
          results[entry.index] = result;
          onEach?.(entry.index, result);
        }
      }

      if (start + CHUNK < pending.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Retry rate-limited / transient failures slowly (cached successes are skipped above).
    for (let attempt = 0; attempt < 3; attempt++) {
      const retryEntries = pending.filter(({ index, address }) => {
        const current = results[index];
        return !isGeocodePoint(current) && isRetryableGeocodeFailure(current);
      });
      if (!retryEntries.length) break;
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      for (let start = 0; start < retryEntries.length; start += CHUNK) {
        const slice = retryEntries.slice(start, start + CHUNK);
        const chunkAddresses = slice.map((p) => p.address);
        try {
          const { data, error } = await supabase.functions.invoke("route-optimizer", {
            body: {
              action: "geocodeBatch",
              addresses: chunkAddresses,
              concurrency: 1,
            },
          });
          if (error || !Array.isArray((data as { results?: unknown[] })?.results)) continue;
          ((data as { results: Record<string, unknown>[] }).results).forEach((item, j) => {
            const entry = slice[j];
            if (!entry) return;
            const result = geocodePayloadToResult(item);
            if (!isRetryableGeocodeFailure(result)) cacheGeocodeResult(entry.address, result);
            results[entry.index] = result;
            onEach?.(entry.index, result);
          });
        } catch {
          // keep partial results; user can click import again
        }
        if (start + CHUNK < retryEntries.length) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    persistGeocodeCache(geocodeCacheRef.current);
    return results;
  };

  const handleBulkImportFile = async (file: File) => {
    const { target, routeId, mode } = bulkImport;
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (!rows.length) { toast({ title: "Empty CSV", variant: "destructive" }); return; }

      setBulkImport(prev => ({ ...prev, running: true, progress: { done: 0, total: rows.length }, log: { ok: 0, skipped: 0, failed: 0, messages: [] }, failedRows: [] }));

      let ok = 0, skipped = 0, failed = 0;
      const messages: string[] = [];
      const providerCounts: Record<GeocodeProvider | "unknown", number> = { ors: 0, nominatim: 0, census: 0, unknown: 0 };
      const failedRows: { name: string; address: string; age: number; session: string; reason: string }[] = [];
      let geocodingInterrupted = false;

      if (target === "campers") {
        // Clear existing immediately on replace so partial imports don't duplicate
        if (mode === "replace") setUnplottedCampers([]);
        const existingKeys = mode === "replace"
          ? new Set<string>()
          : new Set(unplottedCampers.map(c => `${c.name.toLowerCase()}|${normalizeAddress(c.address)}`));
        let nextId = Math.max(300, ...unplottedCampers.map(c => c.id));

        // Pre-validate + dedupe rows in one pass (no network)
        type Pending = { rowIdx: number; name: string; fullAddress: string; age: number; session: string };
        const pending: Pending[] = [];
        const seen = new Set<string>();
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const name = pickFirst(r, ["name", "camper", "full name"]).trim();
          const street = pickFirst(r, ["address", "home address", "street"]).trim();
          const city = pickFirst(r, ["city", "town"]).trim();
          const state = pickFirst(r, ["state"]).trim();
          const zip = pickFirst(r, ["zip", "zipcode", "postal", "postal code"]).trim();
          const fullAddress = [street, city, state, zip].filter(Boolean).join(", ");
          if (!name || !street) { skipped++; messages.push(`Row ${i + 2}: missing name/address`); continue; }
          const dedupKey = `${name.toLowerCase()}|${normalizeAddress(fullAddress)}`;
          if (seen.has(dedupKey) || existingKeys.has(dedupKey)) {
            skipped++; messages.push(`Row ${i + 2}: duplicate (${name})`); continue;
          }
          seen.add(dedupKey);
          const age = parseInt(pickFirst(r, ["age"]) || "10", 10) || 10;
          const session = pickFirst(r, ["session"]) || "Session 1";
          pending.push({ rowIdx: i, name, fullAddress, age, session });
        }

        // Geocode in parallel (8 concurrent) — main speedup
        const newOnes: UnplottedCamper[] = [];
        let done = 0;
        const geos = await geocodeBatch(pending.map(p => p.fullAddress), 8, () => {
          done++;
          setBulkImport(prev => ({ ...prev, progress: { done, total: pending.length } }));
        });
        for (let k = 0; k < pending.length; k++) {
          const p = pending[k];
          const geo = geos[k];
          if (!isGeocodePoint(geo)) {
            const reason = geocodeFailureMessage(geo, p.fullAddress);
            failed++; messages.push(`Row ${p.rowIdx + 2}: ${reason}`);
            failedRows.push({ name: p.name, address: p.fullAddress, age: p.age, session: p.session, reason });
            if (geo && "error" in geo && geo.retryable) geocodingInterrupted = true;
          } else {
            nextId++;
            newOnes.push({ id: nextId, name: p.name, address: p.fullAddress, lat: geo.lat, lng: geo.lng, age: p.age, session: p.session });
            const prov = geo.provider ?? "unknown";
            providerCounts[prov]++;
            messages.push(`Row ${p.rowIdx + 2}: ✓ ${prov === "unknown" ? "geocoded" : PROVIDER_LABEL[prov as GeocodeProvider]} matched "${p.fullAddress}"`);
            ok++;
          }
        }
        if (mode === "replace") setUnplottedCampers(newOnes);
        else if (newOnes.length) setUnplottedCampers(prev => [...prev, ...newOnes]);
      } else if (target === "stops") {
        if (!routeId) { toast({ title: "Pick a route", variant: "destructive" }); setBulkImport(prev => ({ ...prev, running: false })); return; }
        if (mode === "replace") setCoreStops(prev => ({ ...prev, [routeId]: [] }));
        const existingKeys = mode === "replace"
          ? new Set<string>()
          : new Set((coreStops[routeId] || []).map(s => `${s.name.toLowerCase()}|${normalizeAddress(s.address)}`));

        type PendingStop = { rowIdx: number; stopName: string; fullAddress: string };
        const pending: PendingStop[] = [];
        const seen = new Set<string>();
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const stopName = pickFirst(r, ["stop_name", "name", "stop"]).trim();
          const street = pickFirst(r, ["address", "street"]).trim();
          const city = pickFirst(r, ["city", "town"]).trim();
          const state = pickFirst(r, ["state"]).trim();
          const zip = pickFirst(r, ["zip", "zipcode", "postal", "postal code"]).trim();
          const fullAddress = [street, city, state, zip].filter(Boolean).join(", ");
          if (!stopName || !street) { skipped++; messages.push(`Row ${i + 2}: missing name/address`); continue; }
          const dedupKey = `${stopName.toLowerCase()}|${normalizeAddress(fullAddress)}`;
          if (seen.has(dedupKey) || existingKeys.has(dedupKey)) {
            skipped++; messages.push(`Row ${i + 2}: duplicate (${stopName})`); continue;
          }
          seen.add(dedupKey);
          pending.push({ rowIdx: i, stopName, fullAddress });
        }

        const newStops: RouteStop[] = [];
        let done = 0;
        const geos = await geocodeBatch(pending.map(p => p.fullAddress), 8, () => {
          done++;
          setBulkImport(prev => ({ ...prev, progress: { done, total: pending.length } }));
        });
        for (let k = 0; k < pending.length; k++) {
          const p = pending[k];
          const geo = geos[k];
          if (!isGeocodePoint(geo)) {
            failed++; messages.push(`Row ${p.rowIdx + 2}: ${geocodeFailureMessage(geo, p.fullAddress)}`);
            if (geo && "error" in geo && geo.retryable) geocodingInterrupted = true;
          } else {
            newStops.push({ name: p.stopName, address: p.fullAddress, lat: geo.lat, lng: geo.lng, pickupTime: "", passengers: 0 });
            const prov = geo.provider ?? "unknown";
            providerCounts[prov]++;
            messages.push(`Row ${p.rowIdx + 2}: ✓ ${prov === "unknown" ? "geocoded" : PROVIDER_LABEL[prov as GeocodeProvider]} matched "${p.fullAddress}"`);
            ok++;
          }
        }
        if (mode === "replace") setCoreStops(prev => ({ ...prev, [routeId]: newStops }));
        else if (newStops.length) setCoreStops(prev => ({ ...prev, [routeId]: [...(prev[routeId] || []), ...newStops] }));
      } else if (target === "staff") {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const first_name = pickFirst(r, ["first_name", "first name", "first"]).trim();
          const last_name = pickFirst(r, ["last_name", "last name", "last"]).trim();
          const address = pickFirst(r, ["address", "home address"]).trim();
          if (!first_name || !last_name) { skipped++; messages.push(`Row ${i + 2}: missing first/last name`); }
          else {
            // Geocode for verification (not stored — staff table has no lat/lng)
            if (address) await geocodeAddress(address);
            const payload: Record<string, unknown> = {
              first_name,
              last_name,
              email: pickFirst(r, ["email"]).trim() || null,
              phone: pickFirst(r, ["phone"]).trim() || null,
              position: pickFirst(r, ["position", "role", "title"]).trim() || null,
            };
            const { error } = await supabase.from("staff").insert(payload as never);
            if (error) { failed++; messages.push(`Row ${i + 2}: ${error.message}`); }
            else ok++;
          }
          setBulkImport(prev => ({ ...prev, progress: { done: i + 1, total: rows.length } }));
        }
      }

      setBulkImport(prev => ({ ...prev, running: false, log: { ok, skipped, failed, messages, providerCounts }, failedRows }));
      toast({ title: geocodingInterrupted ? "Import paused" : "Bulk import done", description: `${ok} added · ${skipped} skipped · ${failed} failed` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setBulkImport(prev => ({ ...prev, running: false }));
      toast({ title: "Import error", description: msg, variant: "destructive" });
    }
  };

  const handleShowDirections = async (route: Route) => {
    if (!route.stops || route.stops.length < 2) {
      toast({ title: "Not enough stops", description: "Add at least two stops to generate directions.", variant: "destructive" });
      return;
    }
    setDirectionsDialog({
      open: true, routeId: route.id, routeName: route.name, bus: route.bus, color: route.color,
      loading: true, error: null,
      totalDistanceMi: 0, totalDurationSec: 0, steps: [],
      stopLabels: route.stops.map(s => s.camperNames?.join(", ") || s.name),
      mapStops: route.stops.map(s => ({ name: s.name, address: s.address, lat: s.lat, lng: s.lng, pickupTime: s.pickupTime, passengers: s.passengers, camperNames: s.camperNames })),
    });
    try {
      const coordinates = route.stops.map(s => [s.lng, s.lat] as [number, number]);
      const { data, error } = await supabase.functions.invoke("route-optimizer", {
        body: { action: "directions", coordinates },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDirectionsDialog(prev => ({
        ...prev,
        loading: false,
        totalDistanceMi: data.totalDistanceMi || 0,
        totalDurationSec: data.totalDurationSec || 0,
        steps: data.steps || [],
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDirectionsDialog(prev => ({ ...prev, loading: false, error: msg }));
    }
  };

  // Compute the effective core stops for a given route, applying today's overrides
  const getEffectiveCore = useCallback((routeId: number): RouteStop[] => {
    const base = coreStops[routeId] || [];
    const excl = new Set(todayOverrides.excluded[routeId] || []);
    const filtered = base.filter(s => !excl.has(s.address));
    const added = todayOverrides.added[routeId] || [];
    return [...filtered, ...added];
  }, [coreStops, todayOverrides]);

  // Drag-to-reorder stops within a single route
  const [reorderDrag, setReorderDrag] = useState<{ routeId: number; displayIndex: number } | null>(null);

  const handleReorderStop = (routeId: number, fromDisplayIdx: number, toDisplayIdx: number) => {
    if (fromDisplayIdx === toDisplayIdx) return;
    const effective = getEffectiveCore(routeId);
    if (!effective.length) return;

    // Convert display indices to core indices.
    // AM display: [...core, CAMP]  → core idx = display idx (camp is last, skip it)
    // PM display: [CAMP, ...core.reverse()] → core idx = core.length - 1 - (display - 1)
    const toCoreIdx = (displayIdx: number, isAM: boolean): number =>
      isAM ? displayIdx : effective.length - 1 - (displayIdx - 1);

    const isAM = timeOfDay === "am";
    const fromCore = toCoreIdx(fromDisplayIdx, isAM);
    const toCore = toCoreIdx(toDisplayIdx, isAM);
    if (fromCore < 0 || fromCore >= effective.length || toCore < 0 || toCore >= effective.length) return;

    const next = [...effective];
    const [moved] = next.splice(fromCore, 1);
    next.splice(toCore, 0, moved);

    // Persist as the new base; clear today's overrides for this route since the order is now canonical.
    setCoreStops(prev => ({ ...prev, [routeId]: next }));
    setTodayOverrides(prev => ({
      excluded: { ...prev.excluded, [routeId]: [] },
      added: { ...prev.added, [routeId]: [] },
    }));
    toast({ title: "Stop reordered", description: `Moved "${moved.camperNames?.join(", ") || moved.name}" in this route.` });
  };

  // Build display routes from effective core stops + meta
  const buildRoutes = useCallback((tod: "am" | "pm"): Route[] => {
    return routeMeta.map(meta => {
      const core = getEffectiveCore(meta.id);
      const stops = tod === "am" ? buildAMStops(core) : buildPMStops(core);
      const campers = core.reduce((sum, s) => sum + s.passengers, 0);
      return {
        ...meta,
        stops,
        campers,
        direction: tod === "am" ? "Inbound" : "Outbound",
      };
    });
  }, [getEffectiveCore, routeMeta]);

  const routes = buildRoutes(timeOfDay);
  const displayedRoutes = routes.filter(r => visibleRoutes.includes(r.id));

  const toggleRouteVisibility = (id: number) => {
    setVisibleRoutes(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleAddRoute = () => {
    if (!newRoute.name || !newRoute.bus) {
      toast({ title: "Missing info", description: "Route name and bus are required.", variant: "destructive" });
      return;
    }
    const id = Math.max(0, ...routeMeta.map(r => r.id)) + 1;
    setRouteMeta(prev => [...prev, {
      id, name: newRoute.name, bus: newRoute.bus,
      departure: newRoute.departure || "TBD",
      status: "Pending",
      color: ROUTE_COLORS[(routeMeta.length) % ROUTE_COLORS.length],
      capacity: Math.max(1, newRoute.capacity || 50),
    }]);
    setCoreStops(prev => ({ ...prev, [id]: [] }));
    setVisibleRoutes(prev => [...prev, id]);
    setAddRouteOpen(false);
    setNewRoute({ name: "", bus: "", departure: "", capacity: 50 });
    toast({ title: "Route added", description: `"${newRoute.name}" has been created for both AM and PM runs.` });
  };

  const handleAssignCamperToRoute = useCallback((camperId: number, routeId: number) => {
    const camper = unplottedCampers.find(c => c.id === camperId);
    if (!camper) return;
    const meta = routeMeta.find(r => r.id === routeId);
    const currentLoad = (coreStops[routeId] || []).reduce((sum, s) => sum + s.passengers, 0)
      + (todayOverrides.added[routeId] || []).reduce((sum, s) => sum + s.passengers, 0);
    if (meta && currentLoad >= meta.capacity) {
      toast({
        title: "Bus over capacity",
        description: `${meta.bus} is already at ${currentLoad}/${meta.capacity}. Adding ${camper.name} will exceed the limit.`,
        variant: "destructive",
      });
    }
    const newStop: RouteStop = {
      name: camper.name,
      address: camper.address,
      lat: camper.lat,
      lng: camper.lng,
      pickupTime: "TBD",
      passengers: 1,
      camperNames: [camper.name],
    };
    // Merge into existing stop at the same address (siblings/shared household)
    const mergeIntoStops = (stops: RouteStop[]): { merged: boolean; next: RouteStop[] } => {
      const norm = (a: string) => normalizeAddress(a);
      const idx = stops.findIndex(s => norm(s.address) === norm(camper.address));
      if (idx === -1) return { merged: false, next: [...stops, newStop] };
      const existing = stops[idx];
      const updated: RouteStop = {
        ...existing,
        passengers: existing.passengers + 1,
        camperNames: [...(existing.camperNames || [existing.name]), camper.name],
      };
      const next = [...stops];
      next[idx] = updated;
      return { merged: true, next };
    };
    setScopeDialog({
      open: true,
      title: "Assign camper",
      description: `Add ${camper.name} to this route for today only, or permanently (both AM & PM, every day)?`,
      onChoose: (scope) => {
        if (scope === "today") {
          let mergedSiblings: string[] | null = null;
          setTodayOverrides(prev => {
            const existingAdded = prev.added[routeId] || [];
            const core = coreStops[routeId] || [];
            const tryAdded = mergeIntoStops(existingAdded);
            if (tryAdded.merged) {
              const mergedStop = tryAdded.next.find(s => normalizeAddress(s.address) === normalizeAddress(camper.address));
              mergedSiblings = mergedStop?.camperNames || null;
              return { ...prev, added: { ...prev.added, [routeId]: tryAdded.next } };
            }
            const coreMatch = core.find(s => normalizeAddress(s.address) === normalizeAddress(camper.address));
            if (coreMatch) {
              mergedSiblings = [...(coreMatch.camperNames || [coreMatch.name]), camper.name];
              return { ...prev, added: { ...prev.added, [routeId]: [...existingAdded, newStop] } };
            }
            return { ...prev, added: { ...prev.added, [routeId]: [...existingAdded, newStop] } };
          });
          setUnplottedCampers(prev => prev.filter(c => c.id !== camperId));
          if (mergedSiblings && mergedSiblings.length > 1) {
            toast({ title: "Sibling grouped at stop", description: `${camper.name} joined ${mergedSiblings.length - 1} sibling${mergedSiblings.length > 2 ? "s" : ""} at this address. Bus +1 rider.` });
          } else {
            toast({ title: "Added for today", description: `${camper.name} added to today's run only.` });
          }
        } else {
          let mergedSiblings: string[] | null = null;
          setCoreStops(cs => {
            const { merged, next } = mergeIntoStops(cs[routeId] || []);
            if (merged) {
              const mergedStop = next.find(s => normalizeAddress(s.address) === normalizeAddress(camper.address));
              mergedSiblings = mergedStop?.camperNames || null;
            }
            return { ...cs, [routeId]: next };
          });
          setUnplottedCampers(prev => prev.filter(c => c.id !== camperId));
          if (mergedSiblings && mergedSiblings.length > 1) {
            toast({ title: "Sibling grouped at stop", description: `${camper.name} joined ${mergedSiblings.length - 1} sibling${mergedSiblings.length > 2 ? "s" : ""} at this address. Bus +1 rider (permanent).` });
          } else {
            toast({ title: "Camper assigned", description: `${camper.name} added permanently (AM & PM).` });
          }
        }
        setScopeDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [unplottedCampers, routeMeta, coreStops, todayOverrides, toast]);

  const handleAddUnplottedCamper = async () => {
    if (!newUnplotted.name.trim() || !newUnplotted.address.trim()) {
      toast({ title: "Missing info", description: "Name and address are required.", variant: "destructive" });
      return;
    }
    // Geocode via OpenRouteService; fall back to randomized point if unavailable
    let lat = 40.85 + (Math.random() - 0.5) * 0.1;
    let lng = -73.65 + (Math.random() - 0.5) * 0.1;
    try {
      const { data } = await supabase.functions.invoke("route-optimizer", {
        body: { action: "geocode", address: newUnplotted.address.trim() },
      });
      if (data?.found) { lat = data.lat; lng = data.lng; }
    } catch { /* silent fallback */ }

    const id = Math.max(300, ...unplottedCampers.map(c => c.id)) + 1;
    setUnplottedCampers(prev => [...prev, {
      id, name: newUnplotted.name.trim(), address: newUnplotted.address.trim(),
      lat, lng,
      age: Number(newUnplotted.age) || 10, session: newUnplotted.session,
    }]);
    setAddCamperOpen(false);
    setNewUnplotted({ name: "", address: "", age: 10, session: "Session 1" });
    toast({ title: "Camper added", description: "Address geocoded and pinned on the map." });
  };

  const handleRemoveUnplotted = (id: number) => {
    setUnplottedCampers(prev => prev.filter(c => c.id !== id));
  };

  const handleCSVImport = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (!rows.length) { toast({ title: "Empty CSV", variant: "destructive" }); return; }
      let skipped = 0;
      const newOnes: UnplottedCamper[] = [];
      let nextId = Math.max(300, ...unplottedCampers.map(c => c.id));

      // Geocode each row via ORS in sequence (ORS free tier: ~40 req/min on geocoding)
      for (const r of rows) {
        const name = pickFirst(r, ["name", "camper", "full name"]).trim();
        const street = pickFirst(r, ["address", "home address", "street"]).trim();
        const city = pickFirst(r, ["city", "town"]).trim();
        const state = pickFirst(r, ["state"]).trim();
        const zip = pickFirst(r, ["zip", "zipcode", "postal", "postal code"]).trim();
        const address = [street, city, state, zip].filter(Boolean).join(", ");
        if (!name || !street) { skipped++; continue; }
        const age = parseInt(pickFirst(r, ["age"]) || "10", 10) || 10;
        const session = pickFirst(r, ["session"]) || "Session 1";

        let lat = 40.85 + (Math.random() - 0.5) * 0.1;
        let lng = -73.65 + (Math.random() - 0.5) * 0.1;
        try {
          const { data } = await supabase.functions.invoke("route-optimizer", {
            body: { action: "geocode", address },
          });
          if (data?.found) { lat = data.lat; lng = data.lng; }
        } catch { /* fall back to random */ }

        nextId++;
        newOnes.push({ id: nextId, name, address, lat, lng, age, session });
      }
      setUnplottedCampers(prev => [...prev, ...newOnes]);
      toast({
        title: "Import complete",
        description: `Added ${newOnes.length}${skipped ? `, skipped ${skipped}` : ""} (addresses geocoded).`,
      });
    } catch (e: any) {
      toast({ title: "Import error", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const handleDownloadTemplate = () => {
    const csv = "name,address,age,session\nJane Doe,123 Main St East Hampton NY,11,Session 1\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "transport-campers-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const [mappointImporting, setMappointImporting] = useState(false);
  const handleLoadMappointRoutes = async () => {
    setMappointImporting(true);
    importInProgressRef.current = true;
    skipPersistRef.current = true;
    try {
      const routes = parseMappointRoutesCsv(getBundledMappointRoutesCsv2026(), { direction: "AM" });
      const summary = mappointRoutesSummary(routes);
      if (!routes.length) {
        toast({ title: "No routes found", description: "MapPoint CSV had no AM routes.", variant: "destructive" });
        return;
      }

      const uniqueAddresses = Array.from(
        new Set(routes.flatMap((r) => r.stops.map((s) => s.address))),
      );
      toast({
        title: "Loading MapPoint routes",
        description: `Geocoding ${uniqueAddresses.length} stops across ${summary.routeCount} buses…`,
      });

      const uncachedCount = uniqueAddresses.filter(
        (addr) => !geocodeCacheRef.current.has(addr.trim().toLowerCase()),
      ).length;

      const geos = await geocodeBatch(uniqueAddresses, 2);
      const geoByAddress = new Map<string, GeocodeResult | null>();
      uniqueAddresses.forEach((addr, i) => geoByAddress.set(addr, geos[i] ?? null));

      const geocodedCount = geos.filter(isGeocodePoint).length;

      const nextCore: Record<number, RouteStop[]> = {};
      const nextMeta: typeof initialRouteMeta = [];
      let geocodeFailed = 0;

      for (const route of routes) {
        const stops: RouteStop[] = [];
        for (const stop of route.stops) {
          const geo = geoByAddress.get(stop.address);
          if (!isGeocodePoint(geo)) {
            geocodeFailed++;
            continue;
          }
          stops.push({
            name: stop.label,
            address: stop.address,
            lat: geo.lat,
            lng: geo.lng,
            pickupTime: "",
            passengers: stop.camperNames.length,
            camperNames: stop.camperNames,
          });
        }
        if (!stops.length) continue;
        nextCore[route.busNumber] = stops;
        nextMeta.push({
          id: route.busNumber,
          name: `${route.routeName} · Bus ${route.busNumber}`,
          bus: route.busCounselor
            ? `Bus ${route.busNumber} (${route.busCounselor})`
            : `Bus ${route.busNumber}`,
          departure: "7:00 AM",
          status: "Confirmed",
          color: ROUTE_COLORS[(route.busNumber - 1) % ROUTE_COLORS.length],
          capacity: Math.max(22, stops.reduce((n, s) => n + (s.passengers || 0), 0)),
        });
      }

      const saved = await persistBoard({
        coreStops: nextCore,
        routeMeta: nextMeta,
        unplottedCampers: [],
      });
      if (saved) {
        lastKnownStopCountRef.current = countBoardStops(nextCore);
        loadedScopeRef.current = companyId ? `${companyId}:${currentSeason}` : null;
      }

      applyBoardPayload({
        coreStops: nextCore,
        routeMeta: nextMeta,
        unplottedCampers: [],
      });
      setTodayOverrides({ excluded: {}, added: {} });

      toast({
        title: geocodeFailed ? "MapPoint routes loaded (partial)" : "MapPoint routes loaded",
        description: geocodeFailed
          ? `${nextMeta.length} buses · ${geocodedCount}/${uniqueAddresses.length} addresses geocoded · ${geocodeFailed} stops skipped${saved ? "" : " · save failed, stay on page and retry"}`
          : `${nextMeta.length} buses · ${summary.camperCount} campers · ${saved ? "saved to board" : "save failed — click Load MapPoint again"}${uncachedCount === 0 ? " · used geocode cache (no new API calls)" : ""}`,
        variant: geocodeFailed || !saved ? "destructive" : "default",
      });
    } catch (e: unknown) {
      toast({
        title: "MapPoint import failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      importInProgressRef.current = false;
      skipPersistRef.current = false;
      setMappointImporting(false);
    }
  };

  // Re-run every existing pin (unplotted campers + routed stops) through the current
  // geocoder so stale/incorrect coordinates get corrected.
  const [regeocoding, setRegeocoding] = useState(false);
  const handleRegeocodeAll = async () => {
    const stopEntries = Object.entries(coreStops).flatMap(([routeId, stops]) =>
      (stops || []).map((stop, index) => ({ routeId: Number(routeId), index, address: stop.address }))
    ).filter(e => e.address && e.address !== CAMP_LOCATION.address);
    const camperEntries = unplottedCampers.filter(c => c.address);

    const addresses = Array.from(new Set([
      ...camperEntries.map(c => c.address),
      ...stopEntries.map(s => s.address),
    ]));

    if (addresses.length === 0) {
      toast({ title: "Nothing to re-geocode", description: "No camper or stop addresses on the board yet." });
      return;
    }

    setRegeocoding(true);
    geocodeCacheRef.current.clear();
    try { localStorage.removeItem(GEOCODE_CACHE_KEY); } catch { /* ignore */ }
    toast({ title: "Re-geocoding placements", description: `Checking ${addresses.length} address${addresses.length === 1 ? "" : "es"}…` });

    try {
      const results = await geocodeBatch(addresses, 6, () => {});
      const resolved = new Map<string, { lat: number; lng: number }>();
      let failed = 0;
      addresses.forEach((address, i) => {
        const r = results[i];
        if (isGeocodePoint(r)) resolved.set(address, { lat: r.lat, lng: r.lng });
        else failed++;
      });

      let moved = 0;
      const changed = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
        Math.abs(a.lat - b.lat) > 0.0002 || Math.abs(a.lng - b.lng) > 0.0002;

      setUnplottedCampers(prev => prev.map(c => {
        const hit = resolved.get(c.address);
        if (hit && changed(c, hit)) { moved++; return { ...c, lat: hit.lat, lng: hit.lng }; }
        return c;
      }));

      setCoreStops(prev => {
        const next: typeof prev = {};
        Object.entries(prev).forEach(([routeId, stops]) => {
          next[Number(routeId)] = (stops || []).map(stop => {
            const hit = resolved.get(stop.address);
            if (hit && changed(stop, hit)) { moved++; return { ...stop, lat: hit.lat, lng: hit.lng }; }
            return stop;
          });
        });
        return next;
      });

      toast({
        title: "Re-geocode complete",
        description: `${moved} pin${moved === 1 ? "" : "s"} repositioned · ${addresses.length - failed} matched${failed ? ` · ${failed} could not be geocoded` : ""}.`,
      });
    } catch (e: any) {
      toast({ title: "Re-geocode failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setRegeocoding(false);
    }
  };

  const handleMoveStop = (fromRouteId: number, stopIndex: number, toRouteId: number) => {
    // Map display index to effective core index (effective = core minus today-excluded + today-added)
    const effective = getEffectiveCore(fromRouteId);
    const coreIndex = timeOfDay === "am" ? stopIndex : effective.length - 1 - stopIndex;
    if (coreIndex < 0 || coreIndex >= effective.length) return;
    const stop = effective[coreIndex];

    setScopeDialog({
      open: true,
      title: "Move stop",
      description: `Move "${stop.name}" to a different route for today only, or permanently (both AM & PM, every day)?`,
      onChoose: (scope) => {
        if (scope === "today") {
          setTodayOverrides(prev => {
            // Was this stop a today-added one? If so, move the entry between added lists.
            const fromAdded = prev.added[fromRouteId] || [];
            const addedIdx = fromAdded.findIndex(s => s.address === stop.address);
            if (addedIdx >= 0) {
              const newFromAdded = fromAdded.filter((_, i) => i !== addedIdx);
              const newToAdded = [...(prev.added[toRouteId] || []), stop];
              return { ...prev, added: { ...prev.added, [fromRouteId]: newFromAdded, [toRouteId]: newToAdded } };
            }
            // Otherwise exclude from origin (today only) and add to destination (today only)
            return {
              excluded: { ...prev.excluded, [fromRouteId]: [...(prev.excluded[fromRouteId] || []), stop.address] },
              added: { ...prev.added, [toRouteId]: [...(prev.added[toRouteId] || []), stop] },
            };
          });
          toast({ title: "Moved for today", description: `"${stop.name}" moved on today's run only.` });
        } else {
          setCoreStops(prev => {
            const baseFrom = prev[fromRouteId] || [];
            const newFrom = baseFrom.filter(s => s.address !== stop.address);
            const newTo = [...(prev[toRouteId] || []), stop];
            return { ...prev, [fromRouteId]: newFrom, [toRouteId]: newTo };
          });
          // Clear any today-only overrides for this stop on either route to avoid duplicates
          setTodayOverrides(prev => ({
            excluded: {
              ...prev.excluded,
              [fromRouteId]: (prev.excluded[fromRouteId] || []).filter(a => a !== stop.address),
            },
            added: {
              ...prev.added,
              [fromRouteId]: (prev.added[fromRouteId] || []).filter(s => s.address !== stop.address),
              [toRouteId]: (prev.added[toRouteId] || []).filter(s => s.address !== stop.address),
            },
          }));
          toast({ title: "Stop moved", description: "Moved permanently on both AM and PM runs." });
        }
        setScopeDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  const handleRemoveStop = (routeId: number, stopIndex: number) => {
    const effective = getEffectiveCore(routeId);
    const coreIndex = timeOfDay === "am" ? stopIndex : effective.length - 1 - stopIndex;
    if (coreIndex < 0 || coreIndex >= effective.length) return;
    const stop = effective[coreIndex];

    setScopeDialog({
      open: true,
      title: "Unpin stop",
      description: `Unpin "${stop.name}" from this route for today only, or permanently (both AM & PM, every day)?`,
      onChoose: (scope) => {
        if (scope === "today") {
          setTodayOverrides(prev => {
            // If this is a today-added stop, just remove it from added
            const added = prev.added[routeId] || [];
            const addedIdx = added.findIndex(s => s.address === stop.address);
            if (addedIdx >= 0) {
              return { ...prev, added: { ...prev.added, [routeId]: added.filter((_, i) => i !== addedIdx) } };
            }
            return {
              ...prev,
              excluded: { ...prev.excluded, [routeId]: [...(prev.excluded[routeId] || []), stop.address] },
            };
          });
          toast({ title: "Unpinned for today", description: `"${stop.name}" removed from today's run only.` });
        } else {
          setCoreStops(prev => ({
            ...prev,
            [routeId]: (prev[routeId] || []).filter(s => s.address !== stop.address),
          }));
          setTodayOverrides(prev => ({
            excluded: { ...prev.excluded, [routeId]: (prev.excluded[routeId] || []).filter(a => a !== stop.address) },
            added: { ...prev.added, [routeId]: (prev.added[routeId] || []).filter(s => s.address !== stop.address) },
          }));
          toast({ title: "Stop removed", description: "Removed permanently from both AM and PM runs." });
        }
        setScopeDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  // ─── Route Optimization ─────────────────────────────────────────────
  // Compute total miles for an ordered list of stops, anchored at camp.
  // AM: stops -> camp. PM: camp -> stops reversed. We use AM ordering for cost.
  const routeMiles = (stops: RouteStop[]): number => {
    if (stops.length === 0) return 0;
    const seq = [...stops, { lat: CAMP_LOCATION.lat, lng: CAMP_LOCATION.lng } as any];
    let total = 0;
    let prev = seq[0];
    for (let i = 1; i < seq.length; i++) {
      total += haversineMiles(prev.lat, prev.lng, seq[i].lat, seq[i].lng) * 1.4;
      prev = seq[i];
    }
    return total;
  };

  // Nearest-neighbor TSP starting from camp; ends at camp implicitly.
  const nearestNeighborOrder = (stops: RouteStop[]): RouteStop[] => {
    if (stops.length <= 1) return [...stops];
    const remaining = [...stops];
    const ordered: RouteStop[] = [];
    let curLat = CAMP_LOCATION.lat;
    let curLng = CAMP_LOCATION.lng;
    while (remaining.length) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineMiles(curLat, curLng, remaining[i].lat, remaining[i].lng);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      ordered.push(next);
      curLat = next.lat; curLng = next.lng;
    }
    // Reverse so the NEAREST stop to camp is the LAST one (camp is the final destination on AM run)
    return ordered.reverse();
  };

  const handleOptimizeRoutes = async (targetRouteId?: number) => {
    setOptimizing(true);
    try {
      // If targetRouteId provided, only optimize that single route's existing stops/campers.
      const targetRoutes = targetRouteId !== undefined
        ? routeMeta.filter(r => r.id === targetRouteId)
        : [...routeMeta].sort((a, b) => {
            const aHasStops = (coreStops[a.id] || []).length > 0 ? 0 : 1;
            const bHasStops = (coreStops[b.id] || []).length > 0 ? 0 : 1;
            return aHasStops - bHasStops || a.id - b.id;
          });

      // Build all stops to optimize: existing core + unplotted campers (only for full-batch mode)
      const proposedCore: Record<number, RouteStop[]> = {};
      targetRoutes.forEach(r => { proposedCore[r.id] = []; });

      // Collect every stop and unplotted camper as a "job" for ORS optimization.
      // ORS uses [lng, lat] order.
      type JobRef = { kind: "stop"; stop: RouteStop } | { kind: "camper"; camper: UnplottedCamper };
      const jobRefs: JobRef[] = [];
      targetRoutes.forEach(r => {
        (coreStops[r.id] || []).forEach(stop => jobRefs.push({ kind: "stop", stop }));
      });
      // Only include unplotted campers when optimizing ALL routes — single-route mode
      // just re-orders that route's existing stops without grabbing new campers.
      if (targetRouteId === undefined) {
        unplottedCampers.forEach(camper => jobRefs.push({ kind: "camper", camper }));
      }

      const jobs = jobRefs.map((ref, i) => ({
        id: i + 1,
        location: ref.kind === "stop"
          ? [ref.stop.lng, ref.stop.lat] as [number, number]
          : [ref.camper.lng, ref.camper.lat] as [number, number],
        // ORS uses `amount` to enforce vehicle capacity. Stops carry their passenger count;
        // each unplotted camper is 1 seat.
        amount: ref.kind === "stop"
          ? [Math.max(1, ref.stop.passengers || 1)]
          : [1],
      }));

      // Each route = one vehicle, starts AND ends at camp (round trip).
      // In single-route mode we send only that one vehicle so the optimizer
      // doesn't try to reshuffle other buses.
      const vehicles = targetRoutes.map(r => ({
        id: r.id,
        start: [CAMP_LOCATION.lng, CAMP_LOCATION.lat] as [number, number],
        end: [CAMP_LOCATION.lng, CAMP_LOCATION.lat] as [number, number],
        capacity: [r.capacity],
      }));

      let usedORS = false;
      const reassignments: { name: string; from: string; to: string }[] = [];

      if (jobs.length > 0 && vehicles.length > 0) {
        const { data, error } = await supabase.functions.invoke("route-optimizer", {
          body: { action: "optimize", vehicles, jobs },
        });

        if (!error && data?.routes) {
          usedORS = true;
          // Map ORS results back to our RouteStops, in optimized order
          for (const orsRoute of data.routes) {
            const vehicleId = orsRoute.vehicle as number;
            const ordered: RouteStop[] = [];
            for (const step of orsRoute.steps || []) {
              if (step.type !== "job") continue;
              const ref = jobRefs[(step.job as number) - 1];
              if (!ref) continue;
              if (ref.kind === "stop") {
                ordered.push(ref.stop);
              } else {
                const c = ref.camper;
                ordered.push({
                  name: c.name, address: c.address, lat: c.lat, lng: c.lng,
                  pickupTime: "TBD", passengers: 1, camperNames: [c.name],
                });
                const routeName = routeMeta.find(r => r.id === vehicleId)?.name || `Route ${vehicleId}`;
                reassignments.push({ name: c.name, from: "Unplotted", to: routeName });
              }
            }
            // For AM run: nearest stop to camp should be LAST (camp = final destination).
            // ORS round-trip ordering already minimizes total drive, but for cabin pickup
            // logic we keep the order ORS returned (start→...→end at camp).
            proposedCore[vehicleId] = ordered;
          }
          // Routes with no assignments
          targetRoutes.forEach(r => { if (!proposedCore[r.id]) proposedCore[r.id] = []; });
        }
      }

      // Fallback: nearest-neighbor heuristic (haversine) if ORS unavailable
      let remainingUnplotted: UnplottedCamper[] = [];
      if (!usedORS) {
        targetRoutes.forEach(r => { proposedCore[r.id] = [...(coreStops[r.id] || [])]; });
        if (targetRouteId === undefined) {
          unplottedCampers.forEach(camper => {
            let bestRouteId = targetRoutes[0]?.id;
            let bestDist = Infinity;
            targetRoutes.forEach(r => {
              const stops = proposedCore[r.id];
              const refPoints = stops.length > 0
                ? stops.map(s => ({ lat: s.lat, lng: s.lng }))
                : [{ lat: CAMP_LOCATION.lat, lng: CAMP_LOCATION.lng }];
              const minD = Math.min(...refPoints.map(p => haversineMiles(camper.lat, camper.lng, p.lat, p.lng)));
              if (minD < bestDist) { bestDist = minD; bestRouteId = r.id; }
            });
            if (bestRouteId !== undefined) {
              proposedCore[bestRouteId].push({
                name: camper.name, address: camper.address, lat: camper.lat, lng: camper.lng,
                pickupTime: "TBD", passengers: 1, camperNames: [camper.name],
              });
              const routeName = routeMeta.find(r => r.id === bestRouteId)?.name || `Route ${bestRouteId}`;
              reassignments.push({ name: camper.name, from: "Unplotted", to: routeName });
            } else {
              remainingUnplotted.push(camper);
            }
          });
        }
        targetRoutes.forEach(r => {
          proposedCore[r.id] = nearestNeighborOrder(proposedCore[r.id]);
        });
      }

      // Compute miles before/after using haversine for a fair comparison
      let beforeMiles = 0;
      let afterMiles = 0;
      let reorderedRoutes = 0;
      const perRoute: { id: number; name: string; bus: string; beforeMi: number; afterMi: number; changed: boolean; addedCampers: string[] }[] = [];
      targetRoutes.forEach(r => {
        const before = coreStops[r.id] || [];
        const beforeMi = routeMiles(before);
        const afterMi = routeMiles(proposedCore[r.id]);
        beforeMiles += beforeMi;
        afterMiles += afterMi;
        const beforeAddrs = new Set(before.map(s => s.address));
        const afterAddresses = proposedCore[r.id].map(s => s.address);
        const afterSeq = afterAddresses.filter(address => beforeAddrs.has(address)).join("|");
        const beforeSeq = before.map(s => s.address).join("|");
        const beforeSet = new Set(before.map(s => s.address));
        const removedOrMoved = before.some(s => !afterAddresses.includes(s.address));
        const reordered = (beforeSeq !== afterSeq && before.length > 1) || removedOrMoved;
        if (reordered) reorderedRoutes++;
        const addedCampers = proposedCore[r.id]
          .filter(s => !beforeSet.has(s.address))
          .flatMap(s => s.camperNames || [s.name]);
        perRoute.push({
          id: r.id, name: r.name, bus: r.bus,
          beforeMi, afterMi,
          changed: reordered || addedCampers.length > 0,
          addedCampers,
        });
      });

      setOptimizePreview({
        open: true,
        proposedCore,
        proposedUnplotted: remainingUnplotted,
        beforeMiles,
        afterMiles,
        reassignments,
        reorderedRoutes,
        perRoute,
        // By default, pre-select only routes that actually changed
        selectedRouteIds: perRoute.filter(p => p.changed).map(p => p.id),
      });

      if (!usedORS && unplottedCampers.length > 0) {
        toast({
          title: "Used local optimizer",
          description: "Couldn't reach OpenRouteService — fell back to haversine optimization.",
        });
      }
    } catch (e: any) {
      toast({ title: "Optimization failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setOptimizing(false);
    }
  };

  const applyOptimization = () => {
    const selected = new Set(optimizePreview.selectedRouteIds);
    if (selected.size === 0) {
      toast({ title: "No routes selected", description: "Pick at least one route to apply.", variant: "destructive" });
      return;
    }
    // Merge: keep current order for unselected routes, apply proposed for selected
    const nextCore: Record<number, RouteStop[]> = { ...coreStops };
    let savedMi = 0;
    let appliedReassignments = 0;
    optimizePreview.perRoute.forEach(p => {
      if (!selected.has(p.id)) return;
      // Only overwrite if optimizer actually produced stops for this route.
      // Unchanged routes have no proposedCore entry — preserve their existing stops.
      const proposed = optimizePreview.proposedCore[p.id];
      if (proposed && proposed.length > 0) {
        nextCore[p.id] = proposed;
      }
      savedMi += Math.max(0, p.beforeMi - p.afterMi);
      appliedReassignments += p.addedCampers.length;
    });

    // Compute which unplotted campers were absorbed by SELECTED routes only
    const reassignedNames = new Set<string>();
    optimizePreview.perRoute.forEach(p => {
      if (selected.has(p.id)) p.addedCampers.forEach(n => reassignedNames.add(n));
    });
    const nextUnplotted = unplottedCampers.filter(c => !reassignedNames.has(c.name));

    setCoreStops(nextCore);
    setUnplottedCampers(nextUnplotted);
    // Clear today-overrides for the routes we just changed
    setTodayOverrides(prev => {
      const excluded = { ...prev.excluded };
      const added = { ...prev.added };
      selected.forEach(id => { delete excluded[id]; delete added[id]; });
      return { excluded, added };
    });
    setOptimizePreview(prev => ({ ...prev, open: false }));
    toast({
      title: `Optimized ${selected.size} route${selected.size === 1 ? "" : "s"}`,
      description: `Saved ${savedMi.toFixed(1)} mi/run · ${appliedReassignments} camper${appliedReassignments === 1 ? "" : "s"} assigned.`,
    });
  };

  // ─── Report Generation ──────────────────────────────────────────────
  const downloadCSV = (filename: string, rows: (string | number)[][]) => {
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateReport = (reportName: string, category: "resident" | "daycamp") => {
    const today = new Date().toISOString().slice(0, 10);
    const safeName = reportName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filename = `${category}-${safeName}-${today}.csv`;

    // Build rows specific to each report type
    let rows: (string | number)[][] = [];

    switch (reportName) {
      case "Attendance": {
        rows.push(["Camper Name", "Route", "Pickup Stop", "Pickup Time", "Status"]);
        routes.forEach(r => {
          r.stops.forEach(s => {
            if (s.address === CAMP_LOCATION.address) return;
            (s.camperNames || [s.name]).forEach(name => {
              rows.push([name, r.name, s.address, s.pickupTime, "Scheduled"]);
            });
          });
        });
        break;
      }
      case "Bus Report": {
        rows.push(["Bus", "Route", "Direction", "Departure", "Total Stops", "Total Campers", "Status"]);
        routes.forEach(r => {
          rows.push([r.bus, r.name, r.direction, r.departure, (coreStops[r.id] || []).length, r.campers, r.status]);
        });
        break;
      }
      case "Bus Route Summary": {
        rows.push(["Route", "Bus", "Stop #", "Stop Name", "Address", "Time", "Passengers"]);
        routes.forEach(r => {
          r.stops.forEach((s, i) => {
            rows.push([r.name, r.bus, i + 1, s.name, s.address, s.pickupTime, s.passengers]);
          });
        });
        break;
      }
      case "Car Report": {
        rows.push(["Camper Name", "Address", "Age", "Session", "Notes"]);
        unplottedCampers.forEach(c => {
          rows.push([c.name, c.address, c.age, c.session, "Private car / unassigned"]);
        });
        if (rows.length === 1) rows.push(["(No private car / unassigned campers today)", "", "", "", ""]);
        break;
      }
      case "Daily Passenger Update": {
        rows.push(["Date", "Route", "Bus", "Direction", "Passengers", "Capacity Used"]);
        routes.forEach(r => {
          rows.push([today, r.name, r.bus, r.direction, r.campers, `${Math.round((r.campers / r.capacity) * 100)}%`]);
        });
        break;
      }
      case "Extended Care": {
        rows.push(["Camper Name", "Route", "Care Type", "Time", "Notes"]);
        routes.forEach(r => {
          r.stops.forEach(s => {
            if (s.address === CAMP_LOCATION.address) return;
            (s.camperNames || [s.name]).forEach(name => {
              rows.push([name, r.name, "After-care", s.pickupTime, ""]);
            });
          });
        });
        break;
      }
      case "Baggage Report": {
        rows.push(["Camper Name", "Route", "Baggage Count", "Special Items", "Status"]);
        routes.forEach(r => {
          r.stops.forEach(s => {
            if (s.address === CAMP_LOCATION.address) return;
            (s.camperNames || [s.name]).forEach(name => {
              rows.push([name, r.name, 1, "", "Pending check-in"]);
            });
          });
        });
        break;
      }
      case "Consolidated Summary":
      case "Master Report": {
        rows.push(["Route", "Bus", "Direction", "Departure", "Stops", "Campers", "Status"]);
        routes.forEach(r => {
          rows.push([r.name, r.bus, r.direction, r.departure, (coreStops[r.id] || []).length, r.campers, r.status]);
        });
        rows.push([]);
        rows.push(["Camper Roster"]);
        rows.push(["Camper Name", "Route", "Stop", "Time"]);
        routes.forEach(r => {
          r.stops.forEach(s => {
            if (s.address === CAMP_LOCATION.address) return;
            (s.camperNames || [s.name]).forEach(name => {
              rows.push([name, r.name, s.address, s.pickupTime]);
            });
          });
        });
        break;
      }
      case "Group Flights":
      case "Shuttles": {
        rows.push(["Camper Name", "Route", "Type", "Departure", "Notes"]);
        routes.forEach(r => {
          r.stops.forEach(s => {
            if (s.address === CAMP_LOCATION.address) return;
            (s.camperNames || [s.name]).forEach(name => {
              rows.push([name, r.name, reportName === "Group Flights" ? "Flight" : "Shuttle", r.departure, ""]);
            });
          });
        });
        break;
      }
      case "Vehicle Allocation": {
        rows.push(["Bus / Vehicle", "Route", "Capacity", "Assigned Campers", "Utilization"]);
        routes.forEach(r => {
          rows.push([r.bus, r.name, r.capacity, r.campers, `${Math.round((r.campers / r.capacity) * 100)}%`]);
        });
        break;
      }
      default: {
        rows.push(["Report", reportName]);
        rows.push(["Generated", today]);
      }
    }

    downloadCSV(filename, rows);
    toast({ title: `${reportName} generated`, description: `Downloaded ${filename}` });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Transport</h1>
          <p className="page-subheader">Bus routes, maps, coordination, and travel reports</p>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const assigned = Object.values(coreStops).reduce(
              (sum, stops) => sum + stops.reduce((s, st) => s + (st.passengers || 0), 0),
              0
            );
            const total = assigned + unplottedCampers.length;
            return (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                <Users className="h-4 w-4 text-primary" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Campers</span>
                  <span className="text-sm font-semibold">
                    {total}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      ({assigned} routed · {unplottedCampers.length} unplotted)
                    </span>
                  </span>
                </div>
              </div>
            );
          })()}
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleLoadMappointRoutes}
            disabled={mappointImporting}
          >
            <RouteIcon className={`h-4 w-4 ${mappointImporting ? "animate-pulse" : ""}`} />
            {mappointImporting ? "Loading MapPoint…" : "Load MapPoint Routes"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setBulkImport(prev => ({ ...prev, open: true, log: { ok: 0, skipped: 0, failed: 0, messages: [] }, progress: { done: 0, total: 0 }, failedRows: [] }))}>
            <Upload className="h-4 w-4" /> Bulk Upload Addresses
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setAddCamperOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add Camper
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleRegeocodeAll}
            disabled={regeocoding}
            title="Re-run every camper and stop address through the latest geocoder"
          >
            <MapPin className={`h-4 w-4 ${regeocoding ? "animate-pulse" : ""}`} />
            {regeocoding ? "Re-geocoding…" : "Re-geocode All Placements"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Clear All Campers
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove all campers?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove every camper from the transport board — both unplotted campers and all stops assigned to routes. Routes themselves will remain. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const totalUnplotted = unplottedCampers.length;
                    const totalStops = Object.values(coreStops).reduce((sum, s) => sum + (s?.length || 0), 0);
                    setUnplottedCampers([]);
                    setCoreStops({});
                    setTodayOverrides({ excluded: {}, added: {} });
                    toast({ title: "All campers removed", description: `Cleared ${totalUnplotted} unplotted and ${totalStops} routed campers.` });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button className="gap-2" onClick={() => setAddRouteOpen(true)}><Plus className="h-4 w-4" /> Add Route</Button>
        </div>
      </div>

      <Tabs defaultValue="map">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="map" className="text-xs gap-1"><MapIcon className="h-3.5 w-3.5" /> Route Map</TabsTrigger>
          <TabsTrigger value="unplotted" className="text-xs gap-1"><UserRound className="h-3.5 w-3.5" /> Unplotted Campers{unplottedCampers.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1.5">{unplottedCampers.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="resident" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" /> Resident Camp Reports</TabsTrigger>
          <TabsTrigger value="daycamp" className="text-xs gap-1"><Car className="h-3.5 w-3.5" /> Day Camp</TabsTrigger>
        </TabsList>

        {/* ─── Route Map Tab ─── */}
        <TabsContent value="map" className="mt-4">
          {/* AM / PM Toggle */}
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  timeOfDay === "am"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTimeOfDay("am")}
              >
                <Sun className="h-3.5 w-3.5" />
                AM Pickup
              </button>
              <button
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  timeOfDay === "pm"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTimeOfDay("pm")}
              >
                <Moon className="h-3.5 w-3.5" />
                PM Dropoff
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {timeOfDay === "am"
                ? "Routes end at 85 Crescent Beach Rd, Glen Cove"
                : "Routes start at 85 Crescent Beach Rd, Glen Cove"}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOptimizeRoutes()}
              disabled={optimizing}
              className="ml-auto gap-1.5 text-xs border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              <Sparkles className={`h-3.5 w-3.5 ${optimizing ? "animate-pulse" : ""}`} />
              {optimizing ? "Optimizing…" : "Optimize Routes"}
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
            {/* Route sidebar */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {timeOfDay === "am" ? "AM Routes (→ Camp)" : "PM Routes (Camp →)"}
              </p>
              {routes.map(r => {
                const isVisible = visibleRoutes.includes(r.id);
                const core = coreStops[r.id] || [];
                return (
                  <Card
                    key={r.id}
                    className={`cursor-pointer transition-all ${isVisible ? "hover:shadow-md" : "opacity-50"}`}
                    onClick={() => toggleRouteVisibility(r.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 mt-1 border-2 border-background"
                          style={{ backgroundColor: r.color, boxShadow: isVisible ? `0 0 8px ${r.color}60` : "none" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{r.bus}</p>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShowDirections(r);
                                }}
                                className="text-muted-foreground hover:text-primary p-1 rounded transition-colors"
                                title="Turn-by-turn directions"
                              >
                                <RouteIcon className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOptimizeRoutes(r.id);
                                }}
                                disabled={optimizing}
                                className="text-muted-foreground hover:text-primary p-1 rounded transition-colors disabled:opacity-50"
                                title="Optimize this route"
                              >
                                <Sparkles className={`h-3 w-3 ${optimizing ? "animate-pulse" : ""}`} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditRoute({ id: r.id, name: r.name, bus: r.bus, departure: r.departure, status: r.status, color: r.color, capacity: r.capacity });
                                }}
                                className="text-muted-foreground hover:text-primary p-1 rounded transition-colors"
                                title="Edit route"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[10px] text-muted-foreground truncate max-w-full">{r.name}</span>
                            <span className="text-[10px] text-muted-foreground">{core.length} stops</span>
                            <span className={`text-[10px] ${r.campers > r.capacity ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                              {r.campers}/{r.capacity} campers{r.campers > r.capacity ? " ⚠" : ""}
                            </span>
                            <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 ${statusColors[r.status]}`}>
                              {r.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {isVisible && r.stops.length > 0 && (
                        <div className="mt-2 pl-6 border-l-2 space-y-1.5" style={{ borderColor: r.color + "40" }}>
                          {r.stops.map((stop, i) => {
                            const isCamp = stop.address === CAMP_LOCATION.address;
                            const isDragging = reorderDrag?.routeId === r.id && reorderDrag.displayIndex === i;
                            return (
                              <div
                                key={i}
                                draggable={!isCamp}
                                onDragStart={(e) => {
                                  if (isCamp) return;
                                  e.stopPropagation();
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/x-reorder", `${r.id}:${i}`);
                                  setReorderDrag({ routeId: r.id, displayIndex: i });
                                }}
                                onDragOver={(e) => {
                                  if (isCamp) return;
                                  if (reorderDrag?.routeId === r.id && reorderDrag.displayIndex !== i) {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                  }
                                }}
                                onDrop={(e) => {
                                  if (isCamp) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (reorderDrag && reorderDrag.routeId === r.id) {
                                    handleReorderStop(r.id, reorderDrag.displayIndex, i);
                                  }
                                  setReorderDrag(null);
                                }}
                                onDragEnd={() => setReorderDrag(null)}
                                className={`flex items-start justify-between gap-2 text-[10px] rounded px-1 py-0.5 transition-all ${
                                  !isCamp ? "cursor-grab active:cursor-grabbing hover:bg-muted/40" : ""
                                } ${isDragging ? "opacity-40" : ""}`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <div
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
                                    style={{ backgroundColor: isCamp ? "#16a34a" : r.color }}
                                  />
                                  <span className={`truncate ${isCamp ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                    {isCamp ? stop.name : (stop.camperNames && stop.camperNames.length > 0 ? stop.camperNames.join(", ") : stop.name)}
                                  </span>
                                </div>
                                {stop.pickupTime ? (
                                  <span className="text-muted-foreground shrink-0 whitespace-nowrap">{stop.pickupTime}</span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Map */}
            <Card className="overflow-hidden relative">
              <div className="absolute top-2 right-2 z-[1000] flex gap-1">
                <select
                  value={mapHeight}
                  onChange={(e) => setMapHeight(e.target.value as "sm" | "md" | "lg" | "xl")}
                  className="h-8 rounded-md border border-border/60 bg-background/90 backdrop-blur px-2 text-xs"
                  title="Map height"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">X-Large</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 bg-background/90 backdrop-blur"
                  onClick={() => setMapFullscreen(true)}
                  title="Expand to fullscreen"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className={
                mapHeight === "sm" ? "h-[480px] w-full relative" :
                mapHeight === "md" ? "h-[760px] w-full relative" :
                mapHeight === "lg" ? "h-[1000px] w-full relative" :
                "h-[80vh] w-full relative"
              }>
                {(boardLoading || companyLoading || authLoading || mappointImporting) && (
                  <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-background/60 backdrop-blur-[1px] text-sm text-muted-foreground">
                    {mappointImporting ? "Loading MapPoint routes…" : "Loading saved board…"}
                  </div>
                )}
                <TransportRouteMap
                  routes={displayedRoutes}
                  allRoutes={routes}
                  onMoveStop={handleMoveStop}
                  onRemoveStop={handleRemoveStop}
                  unplottedCampers={unplottedCampers}
                  onAssignCamper={handleAssignCamperToRoute}
                />
              </div>
            </Card>

            {/* Fullscreen map dialog */}
            <Dialog open={mapFullscreen} onOpenChange={setMapFullscreen}>
              <DialogContent className="max-w-[98vw] w-[98vw] h-[96vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-4 py-2 border-b border-border/40 flex-row items-center justify-between space-y-0">
                  <DialogTitle className="text-sm">Transport map — fullscreen</DialogTitle>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setMapFullscreen(false)}>
                    <Minimize2 className="h-3.5 w-3.5 mr-1" /> Exit
                  </Button>
                </DialogHeader>
                <div className="flex-1 min-h-0">
                  <TransportRouteMap
                    routes={displayedRoutes}
                    allRoutes={routes}
                    onMoveStop={handleMoveStop}
                    onRemoveStop={handleRemoveStop}
                    unplottedCampers={unplottedCampers}
                    onAssignCamper={handleAssignCamperToRoute}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        {/* ─── Unplotted Campers Tab ─── */}
        <TabsContent value="unplotted" className="mt-4 space-y-3">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCSVImport(f);
                if (e.target) e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
            <Button size="sm" onClick={() => setAddCamperOpen(true)} className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" /> Add Camper
            </Button>
          </div>
          {unplottedCampers.length === 0 ? (
            <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">All campers have been assigned to routes! 🎉</p></CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {unplottedCampers.map((c) => (
                <Card key={c.id} className="border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-[#8b5cf6]/10 p-2"><UserRound className="h-4 w-4 text-[#8b5cf6]" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{c.name}</p>
                          <button onClick={() => handleRemoveUnplotted(c.id)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">📍 {c.address}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground">Age {c.age}</span>
                          <span className="text-[10px] text-muted-foreground">{c.session}</span>
                        </div>
                        <div className="mt-2">
                          <Select onValueChange={(v) => handleAssignCamperToRoute(c.id, parseInt(v))}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign to route..." /></SelectTrigger>
                            <SelectContent>
                              {routeMeta.map(r => (
                                <SelectItem key={r.id} value={String(r.id)}>
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                                    {r.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={addCamperOpen} onOpenChange={setAddCamperOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Camper</DialogTitle>
                <DialogDescription>Add a camper to the unplotted list, then assign to a route.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label htmlFor="up-name">Name</Label>
                  <Input id="up-name" autoFocus value={newUnplotted.name} onChange={(e) => setNewUnplotted({ ...newUnplotted, name: e.target.value })} placeholder="e.g. Jamie Lee" />
                </div>
                <div>
                  <Label htmlFor="up-address">Home Address</Label>
                  <Input id="up-address" value={newUnplotted.address} onChange={(e) => setNewUnplotted({ ...newUnplotted, address: e.target.value })} placeholder="e.g. 123 Main St, East Hampton, NY" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="up-age">Age</Label>
                    <Input id="up-age" type="number" min={3} max={18} value={newUnplotted.age} onChange={(e) => setNewUnplotted({ ...newUnplotted, age: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label htmlFor="up-session">Session</Label>
                    <Input id="up-session" value={newUnplotted.session} onChange={(e) => setNewUnplotted({ ...newUnplotted, session: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddCamperOpen(false)}>Cancel</Button>
                <Button onClick={handleAddUnplottedCamper}>Add Camper</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="resident">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {residentReports.map((r) => (
              <Card key={r.name} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleGenerateReport(r.name, "resident")}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2"><r.icon className="h-4 w-4 text-primary" /></div>
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="daycamp">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {dayCampReports.map((r) => (
              <Card key={r.name} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleGenerateReport(r.name, "daycamp")}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-primary">{r.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Route Dialog */}
      <Dialog open={addRouteOpen} onOpenChange={setAddRouteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add New Route</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">This will create both an AM pickup and PM dropoff run.</p>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Route Name</Label>
              <Input placeholder="e.g. NYC — Midtown Pickup" value={newRoute.name} onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Bus / Vehicle</Label>
                <Input placeholder="e.g. Bus E" value={newRoute.bus} onChange={(e) => setNewRoute({ ...newRoute, bus: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">AM Departure Time</Label>
                <Input placeholder="e.g. 7:00 AM" value={newRoute.departure} onChange={(e) => setNewRoute({ ...newRoute, departure: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Capacity (campers)</Label>
              <Input
                type="number"
                min={1}
                max={200}
                placeholder="50"
                value={newRoute.capacity}
                onChange={(e) => setNewRoute({ ...newRoute, capacity: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRouteOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRoute}>Add Route</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scope Choice Dialog (Today only vs Permanent) */}
      <Dialog open={scopeDialog.open} onOpenChange={(open) => { if (!open) setScopeDialog(prev => ({ ...prev, open: false })); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{scopeDialog.title}</DialogTitle>
            <DialogDescription>{scopeDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setScopeDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
            <Button variant="outline" onClick={() => scopeDialog.onChoose("today")}>Today only</Button>
            <Button onClick={() => scopeDialog.onChoose("permanent")}>Permanent (AM & PM)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Route Dialog */}
      <Dialog open={!!editRoute} onOpenChange={(open) => { if (!open) setEditRoute(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: editRoute?.color }} />
              Edit Route
            </DialogTitle>
            <DialogDescription>Update bus name, route details, status, and color. Applies to both AM & PM runs.</DialogDescription>
          </DialogHeader>
          {editRoute && (
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="edit-name">Route Name</Label>
                <Input
                  id="edit-name"
                  value={editRoute.name}
                  onChange={(e) => setEditRoute({ ...editRoute, name: e.target.value })}
                  placeholder="e.g. North Shore Pickup"
                />
              </div>
              <div>
                <Label htmlFor="edit-bus">Bus Name</Label>
                <Input
                  id="edit-bus"
                  value={editRoute.bus}
                  onChange={(e) => setEditRoute({ ...editRoute, bus: e.target.value })}
                  placeholder="e.g. Bus A"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-departure">Departure Time</Label>
                  <Input
                    id="edit-departure"
                    value={editRoute.departure}
                    onChange={(e) => setEditRoute({ ...editRoute, departure: e.target.value })}
                    placeholder="e.g. 7:00 AM"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editRoute.status} onValueChange={(v) => setEditRoute({ ...editRoute, status: v })}>
                    <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Confirmed">Confirmed</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-capacity">Max Capacity (campers)</Label>
                <Input
                  id="edit-capacity"
                  type="number"
                  min={1}
                  max={200}
                  value={editRoute.capacity}
                  onChange={(e) => setEditRoute({ ...editRoute, capacity: parseInt(e.target.value, 10) || 0 })}
                  placeholder="e.g. 50"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Maximum total children allowed on this bus.</p>
              </div>
              <div>
                <Label>Route Color</Label>
                <div className="flex gap-2 mt-2">
                  {ROUTE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditRoute({ ...editRoute, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        editRoute.color === color ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
              onClick={() => {
                if (!editRoute) return;
                if (routeMeta.length <= 1) {
                  toast({ title: "Can't delete", description: "At least one route must remain.", variant: "destructive" });
                  return;
                }
                const name = editRoute.name;
                setRouteMeta(prev => prev.filter(r => r.id !== editRoute.id));
                setCoreStops(prev => {
                  const next = { ...prev };
                  delete next[editRoute.id];
                  return next;
                });
                setVisibleRoutes(prev => prev.filter(id => id !== editRoute.id));
                setTodayOverrides(prev => {
                  const excluded = { ...prev.excluded }; delete excluded[editRoute.id];
                  const added = { ...prev.added }; delete added[editRoute.id];
                  return { excluded, added };
                });
                setEditRoute(null);
                toast({ title: "Route deleted", description: `"${name}" has been removed.` });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Route
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditRoute(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!editRoute) return;
                  if (!editRoute.name.trim() || !editRoute.bus.trim()) {
                    toast({ title: "Missing info", description: "Route name and bus are required.", variant: "destructive" });
                    return;
                  }
                  if (!editRoute.capacity || editRoute.capacity < 1) {
                    toast({ title: "Invalid capacity", description: "Max capacity must be at least 1.", variant: "destructive" });
                    return;
                  }
                  setRouteMeta(prev => prev.map(r => r.id === editRoute.id ? {
                    ...r,
                    name: editRoute.name.trim(),
                    bus: editRoute.bus.trim(),
                    departure: editRoute.departure.trim() || "TBD",
                    status: editRoute.status,
                    color: editRoute.color,
                    capacity: editRoute.capacity,
                  } : r));
                  setEditRoute(null);
                  toast({ title: "Route updated", description: "Changes applied to AM & PM runs." });
                }}
              >
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Optimize Routes Preview Dialog */}
      <Dialog open={optimizePreview.open} onOpenChange={(open) => { if (!open) setOptimizePreview(prev => ({ ...prev, open: false })); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Route Optimization Preview
            </DialogTitle>
            <DialogDescription>
              Groups nearby stops into compact bus clusters first, then orders each bus route. Applies permanently to AM & PM runs.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 py-3">
            <Card className="bg-muted/30">
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Before</p>
                <p className="text-2xl font-semibold mt-1">{optimizePreview.beforeMiles.toFixed(1)} <span className="text-xs text-muted-foreground font-normal">mi</span></p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">After</p>
                <p className="text-2xl font-semibold mt-1 text-primary">{optimizePreview.afterMiles.toFixed(1)} <span className="text-xs text-muted-foreground font-normal">mi</span></p>
              </CardContent>
            </Card>
            <Card className="bg-success/5 border-success/30">
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Saved</p>
                <p className="text-2xl font-semibold mt-1 text-success">
                  {Math.max(0, optimizePreview.beforeMiles - optimizePreview.afterMiles).toFixed(1)} <span className="text-xs text-muted-foreground font-normal">mi</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {optimizePreview.beforeMiles > 0 ? `${(((optimizePreview.beforeMiles - optimizePreview.afterMiles) / optimizePreview.beforeMiles) * 100).toFixed(0)}% shorter` : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="text-xs">
              <span className="font-medium">{optimizePreview.reorderedRoutes}</span>
              <span className="text-muted-foreground"> route{optimizePreview.reorderedRoutes === 1 ? "" : "s"} re-ordered · </span>
              <span className="font-medium">{optimizePreview.reassignments.length}</span>
              <span className="text-muted-foreground"> camper{optimizePreview.reassignments.length === 1 ? "" : "s"} assigned from unplotted</span>
            </div>

            {/* Per-route selector */}
            <div className="border border-border rounded-lg p-3 max-h-56 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Choose routes to apply</p>
                <div className="flex gap-2 text-[10px]">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setOptimizePreview(prev => ({ ...prev, selectedRouteIds: prev.perRoute.map(p => p.id) }))}
                  >Select all</button>
                  <span className="text-muted-foreground/40">·</span>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setOptimizePreview(prev => ({ ...prev, selectedRouteIds: prev.perRoute.filter(p => p.changed).map(p => p.id) }))}
                  >Only changed</button>
                  <span className="text-muted-foreground/40">·</span>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setOptimizePreview(prev => ({ ...prev, selectedRouteIds: [] }))}
                  >None</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {optimizePreview.perRoute.map(p => {
                  const checked = optimizePreview.selectedRouteIds.includes(p.id);
                  const saved = Math.max(0, p.beforeMi - p.afterMi);
                  return (
                    <label key={p.id} className={`flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer hover:bg-muted/40 ${!p.changed ? "opacity-60" : ""}`}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setOptimizePreview(prev => ({
                            ...prev,
                            selectedRouteIds: v
                              ? [...prev.selectedRouteIds, p.id]
                              : prev.selectedRouteIds.filter(id => id !== p.id),
                          }));
                        }}
                      />
                      <span className="font-medium truncate flex-1">{p.bus} <span className="text-muted-foreground font-normal">· {p.name}</span></span>
                      {p.changed ? (
                        <span className="text-[10px] text-success whitespace-nowrap">−{saved.toFixed(1)} mi{p.addedCampers.length ? ` · +${p.addedCampers.length} camper${p.addedCampers.length === 1 ? "" : "s"}` : ""}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">no change</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {optimizePreview.reassignments.length > 0 && (
              <div className="border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Camper Assignments (proposed)</p>
                <div className="space-y-1.5">
                  {optimizePreview.reassignments.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <UserRound className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{r.name}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground truncate">{r.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setOptimizePreview(prev => ({ ...prev, open: false }))}>Cancel</Button>
            <Button onClick={applyOptimization} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Apply Optimization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Detail Dialog */}
      <Dialog open={!!selectedRoute} onOpenChange={() => setSelectedRoute(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedRoute?.color }} />
              {selectedRoute?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedRoute && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Bus</p><p className="text-sm font-medium">{selectedRoute.bus}</p></div>
                <div><p className="text-xs text-muted-foreground">Direction</p><p className="text-sm font-medium">{selectedRoute.direction}</p></div>
                <div><p className="text-xs text-muted-foreground">Departure</p><p className="text-sm font-medium">{selectedRoute.departure}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Campers</p><p className="text-sm font-medium">{selectedRoute.campers}</p></div>
              </div>
              {selectedRoute.stops.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Stops</p>
                  <div className="space-y-2">
                    {selectedRoute.stops.map((stop, i) => {
                      const isCamp = stop.address === CAMP_LOCATION.address;
                      const riders = stop.camperNames && stop.camperNames.length > 0 ? stop.camperNames : (isCamp ? [] : [stop.name]);
                      const isHousehold = riders.length > 1;
                      return (
                        <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                          <div className="flex flex-col items-center gap-1 pt-1">
                            <div
                              className="w-3 h-3 rounded-full border-2 border-background"
                              style={{ backgroundColor: isCamp ? "#16a34a" : selectedRoute.color }}
                            />
                            {i < selectedRoute.stops.length - 1 && <div className="w-0.5 h-4 bg-border" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{isCamp ? stop.name : riders[0]}</p>
                              {isHousehold && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                  <Users className="h-2.5 w-2.5 mr-0.5" />
                                  Household · {riders.length}
                                </Badge>
                              )}
                            </div>
                            {isHousehold && (
                              <ul className="mt-1 ml-2 space-y-0.5">
                                {riders.slice(1).map((sib, idx) => (
                                  <li key={idx} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
                                    {sib} <span className="text-muted-foreground/60">· sibling</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">{stop.address}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-medium">{stop.pickupTime}</p>
                            {stop.passengers > 0 && <p className="text-[10px] text-muted-foreground">{stop.passengers} {stop.passengers === 1 ? "rider" : "riders"}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRoute(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Turn-by-turn directions dialog */}
      <Dialog open={directionsDialog.open} onOpenChange={(open) => setDirectionsDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RouteIcon className="h-4 w-4 text-primary" />
              Turn-by-Turn Directions
            </DialogTitle>
            <DialogDescription>
              {directionsDialog.bus} · {directionsDialog.routeName}
              {!directionsDialog.loading && !directionsDialog.error && directionsDialog.steps.length > 0 && (
                <span className="ml-2">
                  · {directionsDialog.totalDistanceMi.toFixed(1)} mi · ~{Math.round(directionsDialog.totalDurationSec / 60)} min
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {directionsDialog.mapStops.length >= 2 && (
              <div className="rounded-lg overflow-hidden border border-border h-64">
                <TransportRouteMap
                  routes={[{
                    id: directionsDialog.routeId ?? 0,
                    name: directionsDialog.routeName,
                    bus: directionsDialog.bus,
                    color: directionsDialog.color,
                    stops: directionsDialog.mapStops,
                  }]}
                />
              </div>
            )}
            {directionsDialog.loading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Calculating turn-by-turn directions…
              </div>
            )}
            {directionsDialog.error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                Could not load directions: {directionsDialog.error}
              </div>
            )}
            {!directionsDialog.loading && !directionsDialog.error && directionsDialog.steps.length > 0 && (
              <ol className="space-y-1.5">
                {(() => {
                  // Group steps by segment (each segment ends at a waypoint/stop)
                  const elements: JSX.Element[] = [];
                  let currentSegment = -1;
                  directionsDialog.steps.forEach((step, idx) => {
                    const seg = (step as any).segmentIndex ?? 0;
                    if (seg !== currentSegment) {
                      currentSegment = seg;
                      const fromLabel = directionsDialog.stopLabels[seg] || `Stop ${seg + 1}`;
                      const toLabel = directionsDialog.stopLabels[seg + 1] || `Stop ${seg + 2}`;
                      elements.push(
                        <li key={`hdr-${seg}`} className="mt-3 first:mt-0 pt-2 border-t border-border first:border-t-0 first:pt-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                            Leg {seg + 1}: {fromLabel} → {toLabel}
                          </div>
                        </li>
                      );
                    }
                    elements.push(
                      <li key={idx} className="flex gap-3 text-sm py-1.5 border-b border-border/30 last:border-b-0">
                        <span className="text-muted-foreground font-mono text-xs w-6 shrink-0 mt-0.5">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground">{step.instruction}</p>
                          {step.name && step.name !== "-" && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">on {step.name}</p>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground text-right shrink-0 mt-0.5">
                          <div>{step.distanceMi < 0.1 ? `${(step.distanceMi * 5280).toFixed(0)} ft` : `${step.distanceMi.toFixed(2)} mi`}</div>
                          <div>{Math.max(1, Math.round(step.durationSec / 60))} min</div>
                        </div>
                      </li>
                    );
                  });
                  return elements;
                })()}
              </ol>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const sections: string[] = [];
                let curSeg = -1;
                let legItems: string[] = [];
                const flushLeg = () => {
                  if (legItems.length) {
                    sections.push(`<ol>${legItems.join("")}</ol>`);
                    legItems = [];
                  }
                };
                directionsDialog.steps.forEach((s, i) => {
                  const seg = (s as any).segmentIndex ?? 0;
                  if (seg !== curSeg) {
                    flushLeg();
                    curSeg = seg;
                    const from = directionsDialog.stopLabels[seg] || `Stop ${seg + 1}`;
                    const to = directionsDialog.stopLabels[seg + 1] || `Stop ${seg + 2}`;
                    sections.push(`<h2 style="font-family:Arial;font-size:14pt;color:#1f4e79;">Leg ${seg + 1}: ${esc(from)} → ${esc(to)}</h2>`);
                  }
                  const dist = s.distanceMi < 0.1 ? `${(s.distanceMi * 5280).toFixed(0)} ft` : `${s.distanceMi.toFixed(2)} mi`;
                  const onStreet = s.name && s.name !== "-" ? ` <i>(on ${esc(s.name)})</i>` : "";
                  legItems.push(`<li style="margin-bottom:4pt;">${esc(s.instruction)}${onStreet} — <b>${dist}</b></li>`);
                });
                flushLeg();

                const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Directions</title>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
<style>body{font-family:Arial,sans-serif;font-size:11pt;color:#222;} h1{font-size:18pt;color:#0f3a5f;margin-bottom:4pt;} .meta{color:#555;font-size:10pt;margin-bottom:18pt;}</style>
</head><body>
<h1>${esc(directionsDialog.bus)} — ${esc(directionsDialog.routeName)}</h1>
<div class="meta">Total distance: <b>${directionsDialog.totalDistanceMi.toFixed(1)} mi</b> · Estimated time: <b>~${Math.round(directionsDialog.totalDurationSec / 60)} min</b></div>
${(() => {
  const stops = directionsDialog.mapStops;
  if (stops.length < 2) return "";
  // Static map: OSM-based, supports markers + polyline
  const markers = stops.map((s, i) => `markers=${s.lat},${s.lng},lightblue${i + 1}`).join("&");
  const path = `path=color:0x${(directionsDialog.color || "#3b82f6").replace("#", "")}|weight:4|${stops.map(s => `${s.lat},${s.lng}`).join("|")}`;
  const staticUrl = `https://staticmap.openstreetmap.de/staticmap.php?size=720x360&maptype=mapnik&${markers}&${path}`;
  const gmapsUrl = `https://www.google.com/maps/dir/${stops.map(s => `${s.lat},${s.lng}`).join("/")}`;
  return `<div style="margin-bottom:16pt;"><img src="${staticUrl}" alt="Route map" style="max-width:100%;border:1px solid #ccc;" /><div style="font-size:9pt;color:#555;margin-top:4pt;">Open in Google Maps: <a href="${esc(gmapsUrl)}">${esc(gmapsUrl)}</a></div></div>`;
})()}
${sections.join("\n")}
</body></html>`;

                const blob = new Blob(['\ufeff', html], { type: "application/msword" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${directionsDialog.bus.replace(/\s+/g, "_")}_directions.doc`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={directionsDialog.loading || !!directionsDialog.error || directionsDialog.steps.length === 0}
            >
              <Download className="h-3 w-3 mr-1" /> Download
            </Button>
            <Button onClick={() => setDirectionsDialog(prev => ({ ...prev, open: false }))}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Address Upload Dialog */}
      <Dialog open={bulkImport.open} onOpenChange={(open) => !bulkImport.running && setBulkImport(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Bulk Upload Addresses</DialogTitle>
            <DialogDescription>Import addresses from a CSV. Each address is geocoded via OpenRouteService so it appears on the map immediately.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-xs">What are you uploading?</Label>
              <Select
                value={bulkImport.target}
                onValueChange={(v: "campers" | "stops" | "staff") => setBulkImport(prev => ({ ...prev, target: v }))}
                disabled={bulkImport.running}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="campers">Camper home addresses (unplotted)</SelectItem>
                  <SelectItem value="stops">Bus stops (assign to a route)</SelectItem>
                  <SelectItem value="staff">Staff records (with address)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkImport.target === "stops" && (
              <div className="grid gap-2">
                <Label className="text-xs">Add to which route?</Label>
                <Select
                  value={bulkImport.routeId?.toString() || ""}
                  onValueChange={(v) => setBulkImport(prev => ({ ...prev, routeId: parseInt(v, 10) }))}
                  disabled={bulkImport.running}
                >
                  <SelectTrigger><SelectValue placeholder="Select a route" /></SelectTrigger>
                  <SelectContent>
                    {routeMeta.map(rm => (
                      <SelectItem key={rm.id} value={rm.id.toString()}>{rm.name} — {rm.bus}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-md border border-border/40 bg-muted/20 p-3 text-xs space-y-1">
              <p className="font-medium">Required columns:</p>
              {bulkImport.target === "campers" && <p className="text-muted-foreground"><code>name</code>, <code>address</code>, <code>city</code> (optional: <code>state</code>, <code>zip</code>, <code>age</code>, <code>session</code>)</p>}
              {bulkImport.target === "stops" && <p className="text-muted-foreground"><code>stop_name</code>, <code>address</code>, <code>city</code> (optional: <code>state</code>, <code>zip</code>)</p>}
              {bulkImport.target === "staff" && <p className="text-muted-foreground"><code>first_name</code>, <code>last_name</code> (optional: <code>email</code>, <code>phone</code>, <code>address</code>, <code>position</code>)</p>}
            </div>

            {bulkImport.target !== "staff" && (
              <div className="space-y-2">
                <Label className="text-xs">How should we handle existing {bulkImport.target === "stops" ? "stops on this route" : "addresses"}?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={bulkImport.running}
                    onClick={() => setBulkImport(prev => ({ ...prev, mode: "append" }))}
                    className={`text-left rounded-md border p-2.5 text-xs transition ${bulkImport.mode === "append" ? "border-primary bg-primary/10" : "border-border/40 hover:bg-muted/40"}`}
                  >
                    <div className="font-medium">Add to existing</div>
                    <div className="text-muted-foreground">Keep current entries and append new ones.</div>
                  </button>
                  <button
                    type="button"
                    disabled={bulkImport.running}
                    onClick={() => setBulkImport(prev => ({ ...prev, mode: "replace" }))}
                    className={`text-left rounded-md border p-2.5 text-xs transition ${bulkImport.mode === "replace" ? "border-destructive bg-destructive/10" : "border-border/40 hover:bg-muted/40"}`}
                  >
                    <div className="font-medium">Replace existing</div>
                    <div className="text-muted-foreground">Remove current {bulkImport.target === "stops" ? "stops on this route" : "unplotted campers"} first.</div>
                  </button>
                </div>
              </div>
            )}

            <input
              ref={bulkFileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleBulkImportFile(f);
                if (e.target) e.target.value = "";
              }}
            />

            {bulkImport.running && (
              <div className="text-xs space-y-1">
                <p>Processing {bulkImport.progress.done} of {bulkImport.progress.total}…</p>
                <div className="h-1.5 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${bulkImport.progress.total ? (bulkImport.progress.done / bulkImport.progress.total) * 100 : 0}%` }} />
                </div>
              </div>
            )}

            {!bulkImport.running && (bulkImport.log.ok + bulkImport.log.skipped + bulkImport.log.failed) > 0 && (
              <div className="text-xs space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-500">✓ {bulkImport.log.ok} added</span>
                  <span className="text-amber-500">⚠ {bulkImport.log.skipped} skipped</span>
                  <span className="text-destructive">✗ {bulkImport.log.failed} failed</span>
                  {bulkImport.log.messages.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 text-[11px]"
                      onClick={() => {
                        const csv = "row_or_address,reason\n" + bulkImport.log.messages.map(m => `"${m.replace(/"/g, '""')}"`).join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `bulk-upload-failures-${Date.now()}.csv`; a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" /> Download failures
                    </Button>
                  )}
                </div>
                {bulkImport.log.providerCounts && Object.values(bulkImport.log.providerCounts).some(v => v > 0) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Geocoded by:</span>
                    {bulkImport.log.providerCounts.ors > 0 && <span>OpenRouteService: <span className="text-foreground">{bulkImport.log.providerCounts.ors}</span></span>}
                    {bulkImport.log.providerCounts.nominatim > 0 && <span>OpenStreetMap: <span className="text-foreground">{bulkImport.log.providerCounts.nominatim}</span></span>}
                    {bulkImport.log.providerCounts.census > 0 && <span>US Census: <span className="text-foreground">{bulkImport.log.providerCounts.census}</span></span>}
                    {bulkImport.log.providerCounts.unknown > 0 && <span>Unknown: <span className="text-foreground">{bulkImport.log.providerCounts.unknown}</span></span>}
                  </div>
                )}
                {bulkImport.log.messages.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded border border-border/40 bg-background/50 p-2 space-y-0.5 font-mono text-[11px]">
                    {bulkImport.log.messages.map((m, i) => <div key={i} className="text-muted-foreground break-words">{m}</div>)}
                  </div>
                )}

                {bulkImport.target === "campers" && bulkImport.failedRows.length > 0 && (
                  <div className="rounded border border-border/40 bg-background/30 p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Edit & retry failed rows ({bulkImport.failedRows.length})</span>
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={async () => {
                          const rowsToRetry = bulkImport.failedRows;
                          if (!rowsToRetry.length) return;
                          setBulkImport(prev => ({ ...prev, running: true, progress: { done: 0, total: rowsToRetry.length } }));
                          let done = 0;
                          const geos = await geocodeBatch(rowsToRetry.map(r => r.address), 8, () => {
                            done++;
                            setBulkImport(prev => ({ ...prev, progress: { done, total: rowsToRetry.length } }));
                          });
                          let nextId = Math.max(300, ...unplottedCampers.map(c => c.id));
                          const added: UnplottedCamper[] = [];
                          const stillFailed: typeof rowsToRetry = [];
                          for (let i = 0; i < rowsToRetry.length; i++) {
                            const r = rowsToRetry[i];
                            const g = geos[i];
                            if (isGeocodePoint(g)) {
                              nextId++;
                              added.push({ id: nextId, name: r.name, address: r.address, lat: g.lat, lng: g.lng, age: r.age, session: r.session });
                            } else {
                              stillFailed.push({ ...r, reason: geocodeFailureMessage(g, r.address) });
                            }
                          }
                          if (added.length) setUnplottedCampers(prev => [...prev, ...added]);
                          setBulkImport(prev => ({
                            ...prev,
                            running: false,
                            log: {
                              ok: prev.log.ok + added.length,
                              skipped: prev.log.skipped,
                              failed: stillFailed.length,
                              messages: stillFailed.map((r, i) => `${i + 1}. ${r.name}: ${r.reason}`),
                            },
                            failedRows: stillFailed,
                          }));
                          toast({
                            title: "Retry complete",
                            description: `${added.length} geocoded · ${stillFailed.length} still failing`,
                          });
                        }}
                      >
                        <Sparkles className="h-3 w-3 mr-1" /> Retry geocoding
                      </Button>
                    </div>
                    <div className="max-h-72 overflow-y-auto space-y-1.5">
                      {bulkImport.failedRows.map((r, i) => (
                        <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-1.5 items-center">
                          <Input
                            value={r.name}
                            onChange={(e) => setBulkImport(prev => {
                              const next = [...prev.failedRows];
                              next[i] = { ...next[i], name: e.target.value };
                              return { ...prev, failedRows: next };
                            })}
                            className="h-7 text-[11px]"
                            placeholder="Name"
                          />
                          <Input
                            value={r.address}
                            onChange={(e) => setBulkImport(prev => {
                              const next = [...prev.failedRows];
                              next[i] = { ...next[i], address: e.target.value };
                              return { ...prev, failedRows: next };
                            })}
                            className="h-7 text-[11px]"
                            placeholder="Full address"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => setBulkImport(prev => ({
                              ...prev,
                              failedRows: prev.failedRows.filter((_, j) => j !== i),
                            }))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => downloadBulkTemplate(bulkImport.target)} disabled={bulkImport.running}>
              <Download className="h-3.5 w-3.5 mr-1" /> Download Template
            </Button>
            <Button
              onClick={() => bulkFileRef.current?.click()}
              disabled={bulkImport.running || (bulkImport.target === "stops" && !bulkImport.routeId)}
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> {bulkImport.running ? "Importing…" : "Choose CSV & Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
