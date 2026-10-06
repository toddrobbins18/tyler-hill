import { useRef, useState, useCallback, useEffect, useMemo } from "react";
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
import { Bus, MapPin, Users, Plus, FileText, Map as MapIcon, Route as RouteIcon, UserRound, Sun, Moon, Upload, Download, UserPlus, X, Sparkles, TrendingDown, ArrowRight, Pencil, Trash2, Maximize2, Minimize2, Eye, EyeOff, History, LayoutTemplate, Database, Car, CornerDownRight, Clock } from "lucide-react";
import { pickFirst } from "@/lib/csv";
import { isSpreadsheetFileName, loadSpreadsheetRowsFromFile } from "@/lib/spreadsheetImport";
import {
  resolveBundledGeocodeResult,
  seedGeocodeCacheFromBundled,
} from "@/lib/mappointTransportImport";
import {
  applyRouteOverrides,
  emptyManualOverrides,
  excludedCamperSet,
  buildTransportExceptionsReportRows,
  fetchTransportExceptions,
  fetchTransportExceptionsForReport,
  loadManualOverrides,
  saveManualOverrides,
  todayDateString,
  type TransportException,
} from "@/lib/transportDailyOverrides";
import {
  buildDigitalBusAttendanceCsvRows,
  isRouteBusSubmitted,
  loadBusAttendance,
  type DigitalBusAttendanceRider,
} from "@/lib/transportBusAttendance";
import {
  countParentTransportOnRoute,
  formatParentTransportSchedule,
  isParentTransportScheduledForRun,
  parentTransportRidersForRoute,
  PARENT_TRANSPORT_WEEKDAYS,
  PARENT_TRANSPORT_STOP_LABEL,
  ridersOnRoute,
  stableParentTransportId,
  type ParentTransportCamper,
  type ParentTransportWeekday,
} from "@/lib/transportParentTransport";
import SearchableChildSelect from "@/components/SearchableChildSelect";
import {
  loadGroupRoster,
  type GroupRosterCamper,
} from "@/lib/transportGroupAttendance";
import {
  buildCombinedAttendanceBubbleSheetPdf,
} from "@/lib/transportBubbleSheetPdf";
import {
  camperEnrolledInWeek,
  enrollmentWeekForDate,
  enrollmentWeekDayColumns,
  formatEnrollmentWeekLabel,
  formatEnrollmentWeekRange,
  getEnrollmentWeekRow,
  loadEnrollmentWeekCalendar,
  type EnrollmentWeekCalendar,
} from "@/lib/enrollmentWeekCalendar";
import { DAY_CAMP_ENROLLMENT_WEEKS } from "@/lib/enrolledWeeks";
import {
  applyEnrollmentWeekToRoutes,
  buildCamperEnrollmentLookup,
  camperEnrolledInWeekByLookup,
  filterUnplottedForWeek,
} from "@/lib/transportWeekView";
import {
  buildCarSeatCountByBusCsvRows,
  loadCamperCarSeatLookup,
  summarizeCarSeatsByBus,
} from "@/lib/transportCarSeatReport";
import { TransportReportPreviewDialog, type TransportReportPreview } from "@/components/TransportReportPreviewDialog";
import {
  applyGeocodeResultsToTransportBoard,
  build2026MappointRouteTemplate,
  collectTransportAddressesNeedingGeocode,
  normalizeTransportBoardForSeason,
  prepareBoardForPersist,
  type TransportRoutesSource,
} from "@/lib/transportRoster";
import {
  applyHistoricalAssignments,
  enrichUnplottedCampersForHistoricalPlacement,
  getHistoricalRouteSuggestion,
  getReferenceDatasetStatus,
  loadCamperPriorMap,
  pickHistoricalBusForCamper,
  reorderStopsByHistoricalPriors,
  syncTransportBoardToRoutingWarehouse,
  type ReferenceDatasetStatus,
} from "@/lib/historicalRouteLearning";
import {
  DEFAULT_TRANSPORT_BOARD_SETTINGS,
  effectiveStopDwellMinutes,
  normalizeTransportBoardSettings,
  type TransportBoardSettings,
} from "@/lib/transportBoardSettings";
import { optimizeStopsFromFirstStop } from "@/lib/transportRouteOptimize";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useSearchParams } from "react-router-dom";
import {
  CAMP_LOCATION,
  haversineMiles,
  buildAMStops,
  buildPMStops,
  displayStopToCoreIndex,
  getRouteStopLabel,
  isValidRouteCoordinate,
  routeStopListLines,
} from "@/lib/transportStopTimes";
import {
  fetchRouteLegDurationsSec,
  legDurationsSecToMinutes,
  routeStopCoordinateSignature,
} from "@/lib/transportRouteLegDurations";

const TRANSPORT_TABS = ["map", "unplotted", "pt", "daycamp"] as const;
type TransportTab = (typeof TRANSPORT_TABS)[number];

function isTransportTab(value: string | null): value is TransportTab {
  return !!value && (TRANSPORT_TABS as readonly string[]).includes(value);
}

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

const MAP_PANEL_HEIGHT: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "h-[480px]",
  md: "h-[760px]",
  lg: "h-[1000px]",
  xl: "h-[80vh]",
};

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

type AssignableCamper = Pick<UnplottedCamper, "name" | "address" | "lat" | "lng">;

function unplottedSiblingsAtAddress(
  camper: Pick<UnplottedCamper, "id" | "address">,
  all: UnplottedCamper[],
): UnplottedCamper[] {
  const camperNorm = normalizeAddress(camper.address);
  if (!camperNorm) return [];
  return all.filter(
    (c) => c.id !== camper.id && normalizeAddress(c.address) === camperNorm,
  );
}

function mergeCampersIntoStops(
  stops: RouteStop[],
  campers: AssignableCamper[],
): { merged: boolean; next: RouteStop[]; mergedNames: string[] | null } {
  if (campers.length === 0) return { merged: false, next: stops, mergedNames: null };

  const address = campers[0].address;
  const camperNorm = normalizeAddress(address);
  const newNames = campers.map((c) => c.name);
  const idx = stops.findIndex((s) => normalizeAddress(s.address) === camperNorm);

  if (idx === -1) {
    const newStop: RouteStop = {
      name: newNames.length === 1 ? newNames[0] : `${newNames.length} kids at this stop`,
      address,
      lat: campers[0].lat,
      lng: campers[0].lng,
      pickupTime: "TBD",
      passengers: newNames.length,
      camperNames: newNames,
    };
    return { merged: false, next: [...stops, newStop], mergedNames: newNames.length > 1 ? newNames : null };
  }

  const existing = stops[idx];
  const existingNames = existing.camperNames?.length ? existing.camperNames : [existing.name];
  const uniqueAdd = newNames.filter(
    (n) => !existingNames.some((e) => e.trim().toLowerCase() === n.trim().toLowerCase()),
  );
  if (uniqueAdd.length === 0) {
    return { merged: true, next: stops, mergedNames: existingNames.length > 1 ? existingNames : null };
  }

  const mergedNames = [...existingNames, ...uniqueAdd];
  const updated: RouteStop = {
    ...existing,
    passengers: mergedNames.length,
    camperNames: mergedNames,
  };
  const next = [...stops];
  next[idx] = updated;
  return { merged: true, next, mergedNames: mergedNames.length > 1 ? mergedNames : null };
}

/** Put routed campers back on the unplotted list when a stop is unpinned. */
function restoreStopCampersToUnplotted(
  stop: RouteStop,
  existing: UnplottedCamper[],
  roster: GroupRosterCamper[],
): UnplottedCamper[] {
  const names = (stop.camperNames?.length ? stop.camperNames : [stop.name]).filter(Boolean);
  const existingKeys = new Set(
    existing.map((c) => `${c.name.trim().toLowerCase()}|${normalizeAddress(c.address)}`),
  );
  let nextId = Math.max(300, ...existing.map((c) => c.id), 0);
  const restored: UnplottedCamper[] = [];
  for (const name of names) {
    const key = `${name.trim().toLowerCase()}|${normalizeAddress(stop.address)}`;
    if (existingKeys.has(key)) continue;
    const rosterMatch = roster.find((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase());
    nextId += 1;
    restored.push({
      id: nextId,
      name,
      address: stop.address,
      lat: stop.lat,
      lng: stop.lng,
      age: rosterMatch?.age ?? 10,
      session: rosterMatch?.session ?? "Session 1",
    });
  }
  return restored;
}

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
  parentTransportCampers?: ParentTransportCamper[];
  settings?: TransportBoardSettings;
  routesConfigured?: boolean;
  routesSeason?: string;
  routesSource?: TransportRoutesSource;
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

const dayCampReports = [
  { name: "Transport Exceptions", desc: "Absences, swim, office changes, and manual route edits for this date" },
  { name: "Attendance", desc: "Weekly bubble sheet — AM & PM Mon–Fri (paper backup)" },
  { name: "Digital Attendance Log", desc: "Export Present/Absent saved in Bus Attendance for this date & run" },
  { name: "Bus Report", desc: "Day camp bus assignments" },
  { name: "Bus Route Summary", desc: "Route overview with stops" },
  { name: "Car Seat Count by Bus", desc: "Nursery & Pre-K riders per bus (car seats required)" },
  { name: "Car Report", desc: "Parent transport (PT) campers by bus and schedule" },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const companyId = currentCompany?.id;

  const tabParam = searchParams.get("tab");
  const activeTransportTab: TransportTab = isTransportTab(tabParam) ? tabParam : "map";
  const setActiveTransportTab = useCallback((tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "map") next.delete("tab");
      else next.set("tab", tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  // Core stops are the source of truth (without camp stop)
  const [coreStops, setCoreStops] = useState<Record<number, RouteStop[]>>(
    () => (currentSeason === "2026" ? initialCoreStops : {}),
  );
  const [routeMeta, setRouteMeta] = useState(
    () => (currentSeason === "2026" ? initialRouteMeta : []),
  );
  const [unplottedCampers, setUnplottedCampers] = useState<UnplottedCamper[]>(
    () => (currentSeason === "2026" ? initialUnplottedCampers : []),
  );
  const [parentTransportCampers, setParentTransportCampers] = useState<ParentTransportCamper[]>([]);
  const [addParentTransportOpen, setAddParentTransportOpen] = useState(false);
  const [newParentTransport, setNewParentTransport] = useState<{
    childId: string;
    routeId: string;
    am: boolean;
    pm: boolean;
    weekdays: ParentTransportWeekday[];
    notes: string;
  }>({
    childId: "",
    routeId: "",
    am: true,
    pm: true,
    weekdays: [],
    notes: "",
  });
  const [routesConfigured, setRoutesConfigured] = useState(false);
  const [routesSource, setRoutesSource] = useState<TransportRoutesSource | undefined>();
  const [addRouteOpen, setAddRouteOpen] = useState(false);
  const [addCamperOpen, setAddCamperOpen] = useState(false);
  const [reportPreview, setReportPreview] = useState<TransportReportPreview | null>(null);
  const [newUnplotted, setNewUnplotted] = useState({ name: "", address: "", age: 10, session: "Session 1" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [newRoute, setNewRoute] = useState({ name: "", bus: "", departure: "", capacity: 50 });
  const [visibleRoutes, setVisibleRoutes] = useState<number[]>(initialRouteMeta.map(r => r.id));
  const [timeOfDay, setTimeOfDay] = useState<"am" | "pm">("am");
  const [boardSettings, setBoardSettings] = useState<TransportBoardSettings>(
    () => ({ ...DEFAULT_TRANSPORT_BOARD_SETTINGS }),
  );
  const [routeLegMinutesCache, setRouteLegMinutesCache] = useState<Record<string, number[]>>({});
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

  // Today-only overrides: per route, stops added or addresses excluded for the selected date
  const [overrideDate, setOverrideDate] = useState(todayDateString);
  const [todayOverrides, setTodayOverrides] = useState<{
    excluded: Record<number, string[]>;
    added: Record<number, RouteStop[]>;
  }>(emptyManualOverrides());
  const [transportExceptions, setTransportExceptions] = useState<TransportException[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(true);
  const skipOverridePersistRef = useRef(true);
  const overrideLoadedKeyRef = useRef<string | null>(null);
  const excludedCampers = useMemo(
    () => excludedCamperSet(transportExceptions, timeOfDay),
    [transportExceptions, timeOfDay],
  );

  const [groupRoster, setGroupRoster] = useState<GroupRosterCamper[]>([]);
  const [enrollmentWeekCalendar, setEnrollmentWeekCalendar] = useState<EnrollmentWeekCalendar>([]);
  const [routeEnrollmentWeek, setRouteEnrollmentWeek] = useState<number | "all">("all");
  const groupLoadedKeyRef = useRef<string | null>(null);

  // Scope-choice dialog (Today only vs Permanent vs Cancel)
  const [scopeDialog, setScopeDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onChoose: (scope: "today" | "permanent") => void;
  }>({ open: false, title: "", description: "", onChoose: () => {} });

  /** Same-address siblings — user picks who rides (never auto-add all). */
  const [siblingAssignDialog, setSiblingAssignDialog] = useState<{
    open: boolean;
    routeId: number;
    candidates: UnplottedCamper[];
    selectedIds: number[];
  }>({ open: false, routeId: 0, candidates: [], selectedIds: [] });

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
  const refreshReferenceStatusRef = useRef<(() => Promise<void>) | null>(null);
  const boardStateRef = useRef({
    coreStops: {} as Record<number, RouteStop[]>,
    routeMeta: [] as typeof initialRouteMeta,
    unplottedCampers: [] as UnplottedCamper[],
    parentTransportCampers: [] as ParentTransportCamper[],
    routesConfigured: false,
    routesSource: undefined as TransportRoutesSource | undefined,
  });

  boardStateRef.current = {
    coreStops,
    routeMeta,
    unplottedCampers,
    parentTransportCampers,
    routesConfigured,
    routesSource,
  };

  const buildBoardPayload = useCallback((
    overrides: Partial<BoardPayload> = {},
  ): BoardPayload => ({
    coreStops,
    routeMeta,
    unplottedCampers,
    parentTransportCampers,
    settings: boardSettings,
    routesConfigured,
    routesSeason: routesConfigured ? currentSeason : undefined,
    routesSource,
    ...overrides,
  }), [coreStops, routeMeta, unplottedCampers, parentTransportCampers, boardSettings, routesConfigured, routesSource, currentSeason]);

  const markRoutesConfigured = useCallback((source: TransportRoutesSource = "manual") => {
    setRoutesConfigured(true);
    setRoutesSource(source);
  }, []);

  const persistBoard = useCallback(async (payload: BoardPayload) => {
    if (!companyId || !currentSeason) return false;
    const marked = prepareBoardForPersist(payload, currentSeason);
    persistBoardCache(companyId, currentSeason, marked);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("transport_boards").upsert({
        company_id: companyId,
        season: currentSeason,
        data: marked,
        updated_by: userRes.user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error("[Transport] Save board failed:", error.message);
        return false;
      }

      if (
        marked.routesConfigured &&
        marked.routeMeta.length > 0 &&
        countBoardStops(marked.coreStops) > 0
      ) {
        try {
          await syncTransportBoardToRoutingWarehouse(supabase, companyId, {
            referenceSeason: currentSeason,
            coreStops: marked.coreStops,
            routeMeta: marked.routeMeta,
            userId: userRes.user?.id,
            excludeAddress: CAMP_LOCATION.address,
          });
        } catch (learnErr) {
          console.warn("[Transport] Routing learn sync failed:", learnErr);
        }
        void refreshReferenceStatusRef.current?.();
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

  const scrubBrokenPlacements = (payload: BoardPayload): BoardPayload => {
    const coreStops: BoardPayload["coreStops"] = {};
    for (const [routeId, stops] of Object.entries(payload.coreStops ?? {})) {
      coreStops[Number(routeId)] = (stops ?? []).filter((stop) => {
        if (stop.address === CAMP_LOCATION.address) return true;
        if (isValidRouteCoordinate(stop.lat, stop.lng)) return true;
        return !!stop.address?.trim();
      });
    }
    return { ...payload, coreStops };
  };

  const applyBoardPayload = (payload: BoardPayload, source?: "supabase" | "cache") => {
    const scrubbed = scrubBrokenPlacements(payload);
    const normalizedMeta = normalizeRouteMeta(scrubbed.routeMeta);
    setCoreStops(scrubbed.coreStops);
    setRouteMeta(normalizedMeta);
    setVisibleRoutes(normalizedMeta.map((r) => r.id));
    setUnplottedCampers(scrubbed.unplottedCampers);
    setParentTransportCampers(scrubbed.parentTransportCampers ?? []);
    setBoardSettings(normalizeTransportBoardSettings(scrubbed.settings));
    setRoutesConfigured(scrubbed.routesConfigured === true);
    setRoutesSource(scrubbed.routesSource);
    lastKnownStopCountRef.current = countBoardStops(scrubbed.coreStops);
    if (companyId && currentSeason) {
      persistBoardCache(companyId, currentSeason, prepareBoardForPersist(payload, currentSeason));
    }
    const stops = lastKnownStopCountRef.current;
    if (source) {
      console.info(
        `[Transport] Board loaded (${source}): ${stops} stops, ${normalizedMeta.length} routes, ${scrubbed.unplottedCampers.length} unplotted · season ${currentSeason}`,
      );
    }
  };

  const finalizeBoardForSeason = useCallback(async (payload: BoardPayload, source?: "supabase" | "cache") => {
    if (!companyId || !currentSeason) return;
    const normalized = await normalizeTransportBoardForSeason(supabase, companyId, currentSeason, payload);
    const strippedLegacyRoutes =
      currentSeason !== "2026"
      && countBoardStops(payload.coreStops) > 0
      && !payload.routesConfigured;
    applyBoardPayload(normalized, source);
    if (strippedLegacyRoutes) {
      await persistBoard({
        ...normalized,
        routesConfigured: false,
        routesSeason: undefined,
        routesSource: undefined,
      });
    }
  }, [companyId, currentSeason, persistBoard]);

  const restoreBoardFromCache = async () => {
    if (!companyId || !currentSeason) return false;
    const cached = loadBoardCache(companyId, currentSeason);
    if (!cached) return false;
    await finalizeBoardForSeason(cached, "cache");
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
    if (currentSeason !== "2026") {
      setCoreStops({});
      setRouteMeta([]);
      setVisibleRoutes([]);
      setRoutesConfigured(false);
      setRoutesSource(undefined);
    }
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
          if (!(await restoreBoardFromCache())) {
            toast({
              title: "Could not load transport board",
              description: error.message,
              variant: "destructive",
            });
          }
        } else if (data?.data && typeof data.data === "object" && !Array.isArray(data.data)) {
          const saved = data.data as unknown as BoardPayload;
          const restoredStops: Record<number, RouteStop[]> = saved.coreStops && typeof saved.coreStops === "object"
            ? Object.fromEntries(
              Object.entries(saved.coreStops).map(([k, v]) => [Number(k), v as RouteStop[]]),
            )
            : {};

          const meta = Array.isArray(saved.routeMeta)
            ? saved.routeMeta.map((r, i) => ({
              ...r,
              id: Number(r.id),
              color: r.color || ROUTE_COLORS[i % ROUTE_COLORS.length],
            }))
            : [];

          await finalizeBoardForSeason({
            coreStops: restoredStops,
            routeMeta: meta,
            unplottedCampers: Array.isArray(saved.unplottedCampers) ? saved.unplottedCampers : [],
            parentTransportCampers: Array.isArray(saved.parentTransportCampers)
              ? saved.parentTransportCampers
              : [],
            settings: normalizeTransportBoardSettings(saved.settings),
            routesConfigured: saved.routesConfigured,
            routesSeason: saved.routesSeason,
            routesSource: saved.routesSource,
          }, "supabase");
        } else if (!(await restoreBoardFromCache()) && lastKnownStopCountRef.current === 0) {
          const emptyPayload: BoardPayload = currentSeason === "2026"
            ? { coreStops: initialCoreStops, routeMeta: initialRouteMeta, unplottedCampers: initialUnplottedCampers, parentTransportCampers: [] }
            : { coreStops: {}, routeMeta: [], unplottedCampers: [], parentTransportCampers: [] };
          await finalizeBoardForSeason(emptyPayload);
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

  // Load daily overrides + external exceptions (parent, office, nurse, swim) for selected date
  useEffect(() => {
    if (!companyId) {
      setOverridesLoading(true);
      return;
    }
    const key = `${companyId}:${currentSeason}:${overrideDate}`;
    if (overrideLoadedKeyRef.current === key) {
      setOverridesLoading(false);
      return;
    }
    let cancelled = false;
    skipOverridePersistRef.current = true;
    setOverridesLoading(true);
    (async () => {
      try {
        const [manual, exceptions] = await Promise.all([
          loadManualOverrides(supabase, companyId, currentSeason, overrideDate),
          fetchTransportExceptions(supabase, companyId, overrideDate),
        ]);
        if (cancelled) return;
        setTodayOverrides(manual);
        setTransportExceptions(exceptions);
        overrideLoadedKeyRef.current = key;
      } catch (err) {
        console.error("[Transport] Load daily overrides error:", err);
      } finally {
        if (!cancelled) {
          skipOverridePersistRef.current = false;
          setOverridesLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, currentSeason, overrideDate]);

  // Persist manual daily overrides (stop moves / pins for selected date only)
  useEffect(() => {
    if (!companyId || skipOverridePersistRef.current || overridesLoading) return;
    const handle = setTimeout(() => {
      void (async () => {
        const { data: userRes } = await supabase.auth.getUser();
        await saveManualOverrides(
          supabase,
          companyId,
          currentSeason,
          overrideDate,
          todayOverrides,
          userRes.user?.id,
        );
      })();
    }, 600);
    return () => clearTimeout(handle);
  }, [todayOverrides, companyId, currentSeason, overrideDate, overridesLoading]);

  // Load group roster + enrollment week calendar for attendance reports
  useEffect(() => {
    if (!companyId) return;
    const key = `${companyId}:${currentSeason}`;
    if (groupLoadedKeyRef.current === key) return;
    let cancelled = false;
    void (async () => {
      try {
        const [roster, calendar] = await Promise.all([
          loadGroupRoster(supabase, companyId, currentSeason),
          loadEnrollmentWeekCalendar(supabase, companyId, currentSeason),
        ]);
        if (!cancelled) {
          setGroupRoster(roster);
          setEnrollmentWeekCalendar(calendar);
          groupLoadedKeyRef.current = key;
        }
      } catch (err) {
        console.error("[Transport] Load group roster error:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, currentSeason]);

  useEffect(() => {
    setRouteEnrollmentWeek("all");
  }, [companyId, currentSeason]);

  useEffect(() => {
    if (!persistLoaded || !companyId || skipPersistRef.current || importInProgressRef.current) return;
    const stopCount = countBoardStops(coreStops);
    const payload = buildBoardPayload();

    if (stopCount === 0 && unplottedCampers.length === 0 && parentTransportCampers.length === 0 && !routesConfigured) {
      if (lastKnownStopCountRef.current > 0) {
        void persistBoard(payload).then((ok) => {
          if (ok) lastKnownStopCountRef.current = 0;
        });
      }
      return;
    }

    if (stopCount === 0) {
      const handle = setTimeout(() => {
        void persistBoard(payload).then((ok) => {
          if (ok) lastKnownStopCountRef.current = 0;
        });
      }, 600);
      return () => clearTimeout(handle);
    }

    const handle = setTimeout(() => {
      void persistBoard(payload).then((ok) => {
        if (ok) lastKnownStopCountRef.current = countBoardStops(coreStops);
      });
    }, 600);
    return () => clearTimeout(handle);
  }, [coreStops, routeMeta, unplottedCampers, parentTransportCampers, boardSettings, routesConfigured, routesSource, persistLoaded, companyId, currentSeason, persistBoard, buildBoardPayload]);

  // Flush unsaved board state when leaving the page (debounced save may not have fired yet).
  useEffect(() => {
    return () => {
      if (skipPersistRef.current || importInProgressRef.current || !companyId) return;
      const {
        coreStops: stops,
        routeMeta: meta,
        unplottedCampers: unplotted,
        parentTransportCampers: parentTransport,
        routesConfigured: configured,
        routesSource: source,
      } = boardStateRef.current;
      if (countBoardStops(stops) === 0 && unplotted.length === 0 && parentTransport.length === 0 && !configured) return;
      void persistBoard({
        coreStops: stops,
        routeMeta: meta,
        unplottedCampers: unplotted,
        parentTransportCampers: parentTransport,
        routesConfigured: configured,
        routesSeason: configured ? currentSeason : undefined,
        routesSource: source,
      });
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

  useEffect(() => {
    seedGeocodeCacheFromBundled(
      geocodeCacheRef.current as Map<string, { lat: number; lng: number; provider?: string } | null>,
    );
  }, []);

  const cacheGeocodeResult = (address: string, result: GeocodeResult | null) => {
    const cacheKey = address.trim().toLowerCase();
    const isRetryable = result && "retryable" in result && result.retryable;
    if (!isRetryable) geocodeCacheRef.current.set(cacheKey, result);
  };

  const geocodeAddress = async (address: string): Promise<GeocodeResult | null> => {
    const cacheKey = address.trim().toLowerCase();
    const cached = geocodeCacheRef.current.get(cacheKey);
    if (cached !== undefined) return cached;
    const bundled = resolveBundledGeocodeResult(address);
    if (bundled) {
      cacheGeocodeResult(address, bundled);
      return bundled;
    }
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
        return;
      }
      const bundled = resolveBundledGeocodeResult(address);
      if (bundled) {
        cacheGeocodeResult(address, bundled);
        results[i] = bundled;
        onEach?.(i, bundled);
        return;
      }
      pending.push({ index: i, address });
    });

    const CHUNK = 50;
    const batchConcurrency = Math.min(concurrency, 6);
    let sawRateLimit = false;
    for (let start = 0; start < pending.length; start += CHUNK) {
      const slice = pending.slice(start, start + CHUNK);
      const chunkAddresses = slice.map((p) => p.address);
      let batchResults: Record<string, unknown>[] | null = null;

      try {
        const { data, error } = await supabase.functions.invoke("route-optimizer", {
          body: {
            action: "geocodeBatch",
            addresses: chunkAddresses,
            concurrency: batchConcurrency,
          },
        });
        if (!error && Array.isArray((data as { results?: unknown[] })?.results)) {
          batchResults = (data as { results: Record<string, unknown>[] }).results;
        }
      } catch {
        // retry unresolved addresses below
      }

      const unresolved: typeof slice = [];
      if (batchResults) {
        batchResults.forEach((item, j) => {
          const entry = slice[j];
          if (!entry) return;
          const result = geocodePayloadToResult(item);
          if (!isRetryableGeocodeFailure(result)) cacheGeocodeResult(entry.address, result);
          results[entry.index] = result;
          onEach?.(entry.index, result);
          if (!isGeocodePoint(result) && isRetryableGeocodeFailure(result)) {
            sawRateLimit = true;
            unresolved.push(entry);
          } else if (!isGeocodePoint(result)) {
            unresolved.push(entry);
          }
        });
      } else {
        unresolved.push(...slice);
      }

      if (unresolved.length > 0) {
        const parallel = Math.min(Math.max(concurrency, 1), 4);
        for (let u = 0; u < unresolved.length; u += parallel) {
          const group = unresolved.slice(u, u + parallel);
          const groupResults = await Promise.all(group.map((entry) => geocodeAddress(entry.address)));
          group.forEach((entry, j) => {
            const result = groupResults[j] ?? null;
            results[entry.index] = result;
            onEach?.(entry.index, result);
          });
        }
      }

      if (sawRateLimit && start + CHUNK < pending.length) {
        await new Promise((r) => setTimeout(r, 1200));
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
      if (!isSpreadsheetFileName(file.name)) {
        toast({ title: "Unsupported file", description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls).", variant: "destructive" });
        return;
      }
      const rows = await loadSpreadsheetRowsFromFile(file);
      if (!rows.length) { toast({ title: "Empty file", variant: "destructive" }); return; }

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
        if (newStops.length) markRoutesConfigured("manual");
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

  // Compute the effective core stops for a given route, applying manual + external exceptions
  const getEffectiveCore = useCallback((routeId: number): RouteStop[] => {
    return applyRouteOverrides(
      coreStops[routeId] || [],
      routeId,
      todayOverrides,
      excludedCampers,
    );
  }, [coreStops, todayOverrides, excludedCampers]);

  // Drag-to-reorder stops within a single route
  const [reorderDrag, setReorderDrag] = useState<{ routeId: number; displayIndex: number } | null>(null);

  const handleReorderStop = (routeId: number, fromDisplayIdx: number, toDisplayIdx: number) => {
    if (fromDisplayIdx === toDisplayIdx) return;
    const effective = getEffectiveCore(routeId);
    if (!effective.length) return;

    // AM display: [...core, CAMP]  → core idx = display idx (camp is last, not draggable)
    // PM display: [CAMP, ...core]  → core idx = display idx - 1
    const isAM = timeOfDay === "am";
    const fromCore = displayStopToCoreIndex(fromDisplayIdx, isAM);
    const toCore = displayStopToCoreIndex(toDisplayIdx, isAM);
    if (fromCore < 0 || fromCore >= effective.length || toCore < 0 || toCore >= effective.length) return;

    const next = [...effective];
    const [moved] = next.splice(fromCore, 1);
    next.splice(toCore, 0, moved);

    // Persist as the new base; clear today's overrides for this route since the order is now canonical.
    markRoutesConfigured("manual");
    setCoreStops(prev => ({ ...prev, [routeId]: next }));
    setTodayOverrides(prev => ({
      excluded: { ...prev.excluded, [routeId]: [] },
      added: { ...prev.added, [routeId]: [] },
    }));
    toast({ title: "Stop reordered", description: `Moved "${moved.camperNames?.join(", ") || moved.name}" in this route.` });
  };

  const routeLegMinutesById = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const meta of routeMeta) {
      const core = getEffectiveCore(meta.id);
      const orderedStops =
        timeOfDay === "am"
          ? [...core, { ...CAMP_LOCATION, pickupTime: "", passengers: 0 }]
          : [{ ...CAMP_LOCATION, pickupTime: "", passengers: 0 }, ...core];
      const validStops = orderedStops.filter((s) => isValidRouteCoordinate(s.lat, s.lng));
      if (validStops.length < 2) continue;
      const sig = `${meta.id}-${timeOfDay}-${routeStopCoordinateSignature(validStops)}`;
      const cached = routeLegMinutesCache[sig];
      if (cached?.length === validStops.length - 1) {
        map.set(meta.id, cached);
      }
    }
    return map;
  }, [routeMeta, getEffectiveCore, timeOfDay, routeLegMinutesCache]);

  const routesNeedingLegDurations = useMemo(() => {
    const pending: { sig: string; coords: [number, number][] }[] = [];
    for (const meta of routeMeta) {
      const core = getEffectiveCore(meta.id);
      const orderedStops =
        timeOfDay === "am"
          ? [...core, { ...CAMP_LOCATION, pickupTime: "", passengers: 0 }]
          : [{ ...CAMP_LOCATION, pickupTime: "", passengers: 0 }, ...core];
      const validStops = orderedStops.filter((s) => isValidRouteCoordinate(s.lat, s.lng));
      if (validStops.length < 2) continue;

      const sig = `${meta.id}-${timeOfDay}-${routeStopCoordinateSignature(validStops)}`;
      if (routeLegMinutesCache[sig]) continue;

      pending.push({
        sig,
        coords: validStops.map((s) => [s.lng, s.lat] as [number, number]),
      });
    }
    return pending;
  }, [
    routeMeta,
    getEffectiveCore,
    timeOfDay,
    coreStops,
    todayOverrides,
    excludedCampers,
    routeLegMinutesCache,
  ]);

  useEffect(() => {
    if (routesNeedingLegDurations.length === 0) return;

    let cancelled = false;
    const pending = routesNeedingLegDurations;

    const handle = setTimeout(async () => {
      for (let i = 0; i < pending.length; i += 2) {
        if (cancelled) return;
        const batch = pending.slice(i, i + 2);
        const results = await Promise.all(
          batch.map((item) =>
            fetchRouteLegDurationsSec(
              (body) => supabase.functions.invoke("route-optimizer", { body }),
              item.coords,
            ),
          ),
        );
        if (cancelled) return;

        setRouteLegMinutesCache((prev) => {
          const next = { ...prev };
          let changed = false;
          batch.forEach((item, idx) => {
            const sec = results[idx];
            if (sec && sec.length === item.coords.length - 1) {
              next[item.sig] = legDurationsSecToMinutes(sec);
              changed = true;
            }
          });
          return changed ? next : prev;
        });

        if (i + 2 < pending.length) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }, 900);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [routesNeedingLegDurations]);

  const stopDwellMinutes = effectiveStopDwellMinutes(boardSettings);

  // Build display routes from effective core stops + meta
  const buildRoutes = useCallback((tod: "am" | "pm"): Route[] => {
    const stopTimeOptions = {
      dwellMinutesPerStop: stopDwellMinutes,
    };
    return routeMeta.map(meta => {
      const core = getEffectiveCore(meta.id);
      const legMinutes = routeLegMinutesById.get(meta.id);
      const stops =
        tod === "am"
          ? buildAMStops(core, meta.departure, { ...stopTimeOptions, legMinutes })
          : buildPMStops(core, meta.departure, { ...stopTimeOptions, legMinutes });
      const campers = core.reduce((sum, s) => sum + s.passengers, 0);
      return {
        ...meta,
        stops,
        campers,
        direction: tod === "am" ? "Inbound" : "Outbound",
      };
    });
  }, [getEffectiveCore, routeMeta, routeLegMinutesById, stopDwellMinutes]);

  const camperEnrollmentLookup = useMemo(
    () => buildCamperEnrollmentLookup(groupRoster),
    [groupRoster],
  );

  const activeRouteEnrollmentWeek =
    routeEnrollmentWeek === "all" ? null : routeEnrollmentWeek;

  const routes = useMemo(() => {
    const base = buildRoutes(timeOfDay);
    return base.map((route) => ({
      ...route,
      campers:
        route.campers
        + countParentTransportOnRoute(route.id, parentTransportCampers, {
          runDate: overrideDate,
          runPeriod: timeOfDay,
          enrollmentWeek: activeRouteEnrollmentWeek,
          enrollmentLookup: camperEnrollmentLookup,
        }),
    }));
  }, [
    buildRoutes,
    timeOfDay,
    parentTransportCampers,
    overrideDate,
    activeRouteEnrollmentWeek,
    camperEnrollmentLookup,
  ]);

  const ridersForRoute = useCallback(
    (routeId: number) =>
      ridersOnRoute(routeId, getEffectiveCore(routeId), parentTransportCampers, {
        runDate: overrideDate,
        runPeriod: timeOfDay,
        enrollmentWeek: activeRouteEnrollmentWeek,
        enrollmentLookup: camperEnrollmentLookup,
      }),
    [
      getEffectiveCore,
      parentTransportCampers,
      overrideDate,
      timeOfDay,
      activeRouteEnrollmentWeek,
      camperEnrollmentLookup,
    ],
  );

  const displayRoutes = useMemo(() => {
    const filtered = applyEnrollmentWeekToRoutes(
      routes,
      activeRouteEnrollmentWeek,
      camperEnrollmentLookup,
    );
    return filtered.map((route) => {
      const pt = countParentTransportOnRoute(route.id, parentTransportCampers, {
        runDate: overrideDate,
        runPeriod: timeOfDay,
        enrollmentWeek: activeRouteEnrollmentWeek,
        enrollmentLookup: camperEnrollmentLookup,
      });
      const busStopCampers = route.stops
        .filter((s) => s.address !== CAMP_LOCATION.address)
        .reduce((sum, s) => sum + (s.passengers || 0), 0);
      return { ...route, campers: busStopCampers + pt };
    });
  }, [
    routes,
    activeRouteEnrollmentWeek,
    camperEnrollmentLookup,
    parentTransportCampers,
    overrideDate,
    timeOfDay,
  ]);

  const displayedRoutes = displayRoutes.filter((r) => visibleRoutes.includes(r.id));

  const unplottedForWeek = useMemo(
    () => filterUnplottedForWeek(unplottedCampers, activeRouteEnrollmentWeek, camperEnrollmentLookup),
    [unplottedCampers, activeRouteEnrollmentWeek, camperEnrollmentLookup],
  );

  const parentTransportForWeek = useMemo(() => {
    if (activeRouteEnrollmentWeek == null) return parentTransportCampers;
    return parentTransportCampers.filter((c) =>
      camperEnrolledInWeekByLookup(camperEnrollmentLookup, c.name, activeRouteEnrollmentWeek),
    );
  }, [parentTransportCampers, activeRouteEnrollmentWeek, camperEnrollmentLookup]);

  const parentTransportByRoute = useMemo(() => {
    const map = new Map<number, ParentTransportCamper[]>();
    for (const camper of parentTransportForWeek) {
      const list = map.get(camper.routeId) ?? [];
      list.push(camper);
      map.set(camper.routeId, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [parentTransportForWeek]);

  const rosterChildOptions = useMemo(
    () => groupRoster.map((c) => ({ id: c.id, name: c.name, guardian_email: null })),
    [groupRoster],
  );

  const unplottedNeedingGeocode = useMemo(
    () =>
      unplottedForWeek.filter(
        (c) => c.address?.trim() && !isValidRouteCoordinate(c.lat, c.lng),
      ).length,
    [unplottedForWeek],
  );

  const hiddenByWeekFilter = useMemo(
    () => Math.max(0, unplottedCampers.length - unplottedForWeek.length),
    [unplottedCampers.length, unplottedForWeek.length],
  );

  const geocodeAttemptRef = useRef<string>("");
  const [geocodingBoard, setGeocodingBoard] = useState(false);

  const geocodeBoardAddresses = useCallback(async (addresses: string[]) => {
    if (addresses.length === 0) return 0;
    setGeocodingBoard(true);
    try {
      const results = await geocodeBatch(addresses, 8);
      const resultsByAddress = new Map<string, { lat: number; lng: number }>();
      addresses.forEach((address, index) => {
        const result = results[index];
        if (isGeocodePoint(result)) {
          resultsByAddress.set(address.trim().toLowerCase(), {
            lat: result.lat,
            lng: result.lng,
          });
        }
      });

      if (resultsByAddress.size === 0) return 0;

      const board = boardStateRef.current;
      const applied = applyGeocodeResultsToTransportBoard(
        board.unplottedCampers,
        board.coreStops,
        resultsByAddress,
        CAMP_LOCATION.address,
      );
      if (applied.updatedCount > 0) {
        setUnplottedCampers(applied.unplotted);
        setCoreStops(applied.coreStops);
      }
      return applied.updatedCount;
    } finally {
      setGeocodingBoard(false);
    }
  }, [geocodeBatch]);

  useEffect(() => {
    if (!persistLoaded || boardLoading || importInProgressRef.current) return;

    const pending = collectTransportAddressesNeedingGeocode(
      unplottedCampers,
      coreStops,
      CAMP_LOCATION.address,
    );
    if (pending.length === 0) return;

    const signature = pending.sort().join("|");
    if (geocodeAttemptRef.current === signature) return;
    geocodeAttemptRef.current = signature;

    void (async () => {
      const updated = await geocodeBoardAddresses(pending);
      if (updated > 0) {
        toast({
          title: "Map pins updated",
          description: `${updated} stop${updated === 1 ? "" : "s"} geocoded and plotted on the map.`,
        });
      }
    })();
  }, [persistLoaded, boardLoading, unplottedCampers, coreStops, geocodeBoardAddresses, toast]);

  const enrollmentWeekForReport = useMemo(
    () => enrollmentWeekForDate(enrollmentWeekCalendar, overrideDate),
    [enrollmentWeekCalendar, overrideDate],
  );

  const groupRosterForReport = useMemo(() => {
    if (enrollmentWeekForReport == null) return groupRoster;
    return groupRoster.filter((c) =>
      camperEnrolledInWeek(c.enrolledWeeks, c.session, enrollmentWeekForReport),
    );
  }, [groupRoster, enrollmentWeekForReport]);

  const groupRosterByGroup = useMemo(() => {
    const map = new Map<string, GroupRosterCamper[]>();
    for (const c of groupRosterForReport) {
      const list = map.get(c.groupName) ?? [];
      list.push(c);
      map.set(c.groupName, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [groupRosterForReport]);

  const [busAttendanceSummary, setBusAttendanceSummary] = useState<{
    submittedBuses: number;
    totalBuses: number;
    markedCampers: number;
    scheduledCampers: number;
  } | null>(null);

  const busAttendanceRouteSignature = useMemo(
    () =>
      displayRoutes
        .map((r) => {
          const riders = ridersForRoute(r.id);
          return `${r.id}:${riders.length}:${riders.map((c) => c.key).join(",")}`;
        })
        .join("|"),
    [displayRoutes, ridersForRoute],
  );

  useEffect(() => {
    if (!companyId) {
      setBusAttendanceSummary(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        const loaded = await loadBusAttendance(
          supabase,
          companyId,
          currentSeason,
          overrideDate,
          timeOfDay,
        );
        if (cancelled) return;
        const busesWithRiders = displayRoutes.filter(
          (r) => ridersForRoute(r.id).length > 0,
        );
        let markedCampers = 0;
        let scheduledCampers = 0;
        for (const r of busesWithRiders) {
          for (const c of ridersForRoute(r.id)) {
            scheduledCampers++;
            if (loaded.records[c.key]) markedCampers++;
          }
        }
        setBusAttendanceSummary({
          submittedBuses: busesWithRiders.filter((r) =>
            isRouteBusSubmitted(r.id, loaded.busSubmissions),
          ).length,
          totalBuses: busesWithRiders.length,
          markedCampers,
          scheduledCampers,
        });
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [companyId, currentSeason, overrideDate, timeOfDay, busAttendanceRouteSignature, displayRoutes, ridersForRoute]);

  const openReportPreview = (preview: Omit<TransportReportPreview, "open">) => {
    setReportPreview({ ...preview, open: true });
  };


  const hideAllRoutes = () => setVisibleRoutes([]);

  const showAllRoutes = () => setVisibleRoutes(routeMeta.map(r => r.id));

  /** Show one route on the map; click the same card again to hide it. */
  const selectRouteOnMap = (id: number) => {
    setVisibleRoutes(prev => (prev.length === 1 && prev[0] === id ? [] : [id]));
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
    markRoutesConfigured("manual");
    setAddRouteOpen(false);
    setNewRoute({ name: "", bus: "", departure: "", capacity: 50 });
    toast({ title: "Route added", description: `"${newRoute.name}" has been created for both AM and PM runs.` });
  };

  const executeAssignCampersToRoute = useCallback((
    camperIds: number[],
    routeId: number,
    scope: "today" | "permanent",
  ) => {
    const campers = camperIds
      .map((id) => unplottedCampers.find((c) => c.id === id))
      .filter((c): c is UnplottedCamper => !!c);
    if (campers.length === 0) return;

    const assignable: AssignableCamper[] = campers.map((c) => ({
      name: c.name,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
    }));
    const names = campers.map((c) => c.name);
    const idSet = new Set(camperIds);

    if (scope === "today") {
      let mergedNames: string[] | null = null;
      setTodayOverrides((prev) => {
        const existingAdded = prev.added[routeId] || [];
        const core = coreStops[routeId] || [];
        const tryAdded = mergeCampersIntoStops(existingAdded, assignable);
        if (tryAdded.merged) {
          mergedNames = tryAdded.mergedNames;
          return { ...prev, added: { ...prev.added, [routeId]: tryAdded.next } };
        }
        const coreMatch = core.find(
          (s) => normalizeAddress(s.address) === normalizeAddress(campers[0].address),
        );
        if (coreMatch) {
          mergedNames = [...(coreMatch.camperNames || [coreMatch.name]), ...names];
          const newStop: RouteStop = {
            name: names.length === 1 ? names[0] : `${names.length} kids at this stop`,
            address: campers[0].address,
            lat: campers[0].lat,
            lng: campers[0].lng,
            pickupTime: "TBD",
            passengers: names.length,
            camperNames: names,
          };
          return { ...prev, added: { ...prev.added, [routeId]: [...existingAdded, newStop] } };
        }
        mergedNames = names.length > 1 ? names : null;
        return { ...prev, added: { ...prev.added, [routeId]: tryAdded.next } };
      });
      setUnplottedCampers((prev) => prev.filter((c) => !idSet.has(c.id)));
      if (names.length > 1) {
        toast({
          title: "Added for today",
          description: `${names.join(", ")} added to today's run.`,
        });
      } else if (mergedNames && mergedNames.length > 1) {
        toast({
          title: "Grouped at stop",
          description: `${names[0]} joined other riders at this address (+1 for today).`,
        });
      } else {
        toast({ title: "Added for today", description: `${names[0]} added to today's run only.` });
      }
    } else {
      let mergedNames: string[] | null = null;
      markRoutesConfigured("manual");
      setCoreStops((cs) => {
        const { next, mergedNames: mn } = mergeCampersIntoStops(cs[routeId] || [], assignable);
        mergedNames = mn;
        return { ...cs, [routeId]: next };
      });
      setUnplottedCampers((prev) => prev.filter((c) => !idSet.has(c.id)));
      if (names.length > 1) {
        toast({
          title: "Campers assigned",
          description: `${names.join(", ")} added permanently (AM & PM).`,
        });
      } else if (mergedNames && mergedNames.length > 1) {
        toast({
          title: "Grouped at stop",
          description: `${names[0]} joined other riders at this address (+1 permanent).`,
        });
      } else {
        toast({ title: "Camper assigned", description: `${names[0]} added permanently (AM & PM).` });
      }
    }
  }, [unplottedCampers, coreStops, toast, markRoutesConfigured]);

  const openScopeDialogForAssign = useCallback((camperIds: number[], routeId: number) => {
    const names = camperIds
      .map((id) => unplottedCampers.find((c) => c.id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length === 0) return;

    const label = names.length === 1 ? names[0] : names.join(", ");
    setScopeDialog({
      open: true,
      title: names.length === 1 ? "Assign camper" : "Assign campers",
      description: `Add ${label} to this route for today only, or permanently (both AM & PM, every day)?`,
      onChoose: (scope) => {
        executeAssignCampersToRoute(camperIds, routeId, scope);
        setScopeDialog((prev) => ({ ...prev, open: false }));
      },
    });
  }, [unplottedCampers, executeAssignCampersToRoute]);

  const handleAssignCamperToRoute = useCallback(async (camperId: number, routeId: number) => {
    const camper = unplottedCampers.find(c => c.id === camperId);
    if (!camper) return;

    const address = camper.address?.trim();
    if (!address) {
      toast({
        title: "Address required",
        description: `${camper.name} has no home address yet. Add one from Unplotted Campers (Add Camper or Import File).`,
        variant: "destructive",
      });
      return;
    }

    let lat = camper.lat;
    let lng = camper.lng;
    if (!isValidRouteCoordinate(lat, lng)) {
      toast({ title: "Geocoding address", description: `Looking up ${camper.name}'s address…` });
      const geo = await geocodeAddress(address);
      if (!isGeocodePoint(geo)) {
        toast({
          title: "Could not map address",
          description: geocodeFailureMessage(geo, address),
          variant: "destructive",
        });
        return;
      }
      lat = geo.lat;
      lng = geo.lng;
      const camperNorm = normalizeAddress(address);
      setUnplottedCampers((prev) =>
        prev.map((c) =>
          normalizeAddress(c.address) === camperNorm ? { ...c, lat, lng } : c,
        ),
      );
    }

    const siblings = unplottedSiblingsAtAddress(camper, unplottedCampers);
    if (siblings.length > 0) {
      setSiblingAssignDialog({
        open: true,
        routeId,
        candidates: [camper, ...siblings],
        selectedIds: [camperId],
      });
      return;
    }

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

    openScopeDialogForAssign([camperId], routeId);
  }, [unplottedCampers, routeMeta, coreStops, todayOverrides, toast, geocodeAddress, openScopeDialogForAssign]);

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

  const resetNewParentTransportForm = () => {
    setNewParentTransport({
      childId: "",
      routeId: routeMeta[0] ? String(routeMeta[0].id) : "",
      am: true,
      pm: true,
      weekdays: [],
      notes: "",
    });
  };

  const handleAddParentTransport = () => {
    const child = rosterChildOptions.find((c) => c.id === newParentTransport.childId);
    if (!child) {
      toast({ title: "Pick a camper", variant: "destructive" });
      return;
    }
    const routeId = parseInt(newParentTransport.routeId, 10);
    if (!routeId || !routeMeta.some((r) => r.id === routeId)) {
      toast({ title: "Pick a bus", description: "Parent transport campers still roll up to a bus for reports.", variant: "destructive" });
      return;
    }
    if (!newParentTransport.am && !newParentTransport.pm) {
      toast({ title: "Pick AM and/or PM", variant: "destructive" });
      return;
    }
    if (parentTransportCampers.some((c) => c.name.trim().toLowerCase() === child.name.trim().toLowerCase())) {
      toast({ title: "Already on Parent Transport", description: `${child.name} is already listed.` });
      return;
    }

    const id = stableParentTransportId(child.id, Math.max(500, ...parentTransportCampers.map((c) => c.id), 0) + 1);
    setParentTransportCampers((prev) => [
      ...prev,
      {
        id,
        childId: child.id,
        name: child.name,
        routeId,
        am: newParentTransport.am,
        pm: newParentTransport.pm,
        weekdays: newParentTransport.weekdays,
        notes: newParentTransport.notes.trim() || null,
      },
    ]);
    setUnplottedCampers((prev) => prev.filter((c) => c.name.trim().toLowerCase() !== child.name.trim().toLowerCase()));
    setAddParentTransportOpen(false);
    resetNewParentTransportForm();
    markRoutesConfigured("manual");
    toast({
      title: "Parent transport added",
      description: `${child.name} assigned to ${routeMeta.find((r) => r.id === routeId)?.bus ?? `Bus ${routeId}`} for reporting.`,
    });
  };

  const handleRemoveParentTransport = (id: number) => {
    setParentTransportCampers((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleParentTransportWeekday = (day: ParentTransportWeekday) => {
    setNewParentTransport((prev) => {
      const has = prev.weekdays.includes(day);
      return {
        ...prev,
        weekdays: has ? prev.weekdays.filter((d) => d !== day) : [...prev.weekdays, day],
      };
    });
  };

  const handleCSVImport = async (file: File) => {
    try {
      if (!isSpreadsheetFileName(file.name)) {
        toast({ title: "Unsupported file", description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls).", variant: "destructive" });
        return;
      }
      const rows = await loadSpreadsheetRowsFromFile(file);
      if (!rows.length) { toast({ title: "Empty file", variant: "destructive" }); return; }
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

  const [applyingHistorical, setApplyingHistorical] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState<ReferenceDatasetStatus | null>(null);
  const priorMapRef = useRef<Map<string, import("@/lib/routeReferenceWarehouse").CamperRoutingPrior> | null>(null);

  const refreshReferenceStatus = useCallback(async () => {
    if (!companyId || !currentSeason) return;
    const status = await getReferenceDatasetStatus(supabase, companyId, currentSeason);
    setReferenceStatus(status);
    priorMapRef.current = await loadCamperPriorMap(supabase, companyId, currentSeason);
  }, [companyId, currentSeason]);

  useEffect(() => {
    refreshReferenceStatusRef.current = refreshReferenceStatus;
    void refreshReferenceStatus();
  }, [refreshReferenceStatus]);

  const priorRouteSuggestions = useMemo(() => {
    const priorMap = priorMapRef.current;
    if (!priorMap?.size) return new Map<number, ReturnType<typeof getHistoricalRouteSuggestion>>();
    const map = new Map<number, ReturnType<typeof getHistoricalRouteSuggestion>>();
    for (const camper of unplottedCampers) {
      const suggestion = getHistoricalRouteSuggestion(camper, priorMap, routeMeta);
      if (suggestion) map.set(camper.id, suggestion);
    }
    return map;
  }, [unplottedCampers, routeMeta, referenceStatus]);

  const applyLearnedPlacementsToPayload = useCallback(
    async (payload: BoardPayload): Promise<BoardPayload & { placedCount: number; skippedNoBus: number }> => {
      if (!companyId || !currentSeason || payload.unplottedCampers.length === 0) {
        return { ...payload, placedCount: 0, skippedNoBus: 0 };
      }
      const priorMap =
        priorMapRef.current ?? (await loadCamperPriorMap(supabase, companyId, currentSeason));
      priorMapRef.current = priorMap;

      const enrichedUnplotted = await enrichUnplottedCampersForHistoricalPlacement(
        payload.unplottedCampers,
        priorMap,
        async (address) => {
          const geo = await geocodeAddress(address);
          if (geo && isGeocodePoint(geo)) return { lat: geo.lat, lng: geo.lng };
          return null;
        },
      );

      const result = applyHistoricalAssignments({
        coreStops: payload.coreStops,
        routeMeta: payload.routeMeta,
        unplottedCampers: enrichedUnplotted,
        priorMap,
      });

      let nextCore = result.coreStops;
      if (result.placed.length > 0) {
        nextCore = reorderStopsByHistoricalPriors(nextCore, priorMap);
      }

      return {
        ...payload,
        coreStops: nextCore,
        unplottedCampers: result.unplottedCampers,
        placedCount: result.placed.length,
        skippedNoBus: result.skippedNoBus.length,
      };
    },
    [companyId, currentSeason],
  );

  const handleApplyRouteTemplate = async () => {
    setApplyingTemplate(true);
    try {
      const { coreStops: templateStops, routeMeta: templateMeta } =
        build2026MappointRouteTemplate(ROUTE_COLORS);

      let payload: BoardPayload = {
        coreStops: templateStops,
        routeMeta: templateMeta,
        unplottedCampers,
        routesConfigured: true,
        routesSeason: currentSeason,
        routesSource: "mappoint2026",
      };

      const normalized = await normalizeTransportBoardForSeason(
        supabase,
        companyId!,
        currentSeason,
        payload,
      );

      const withLearned = await applyLearnedPlacementsToPayload(normalized);
      payload = {
        ...withLearned,
        routesConfigured: true,
        routesSeason: currentSeason,
        routesSource: "mappoint2026",
      };

      await persistBoard(payload);
      await finalizeBoardForSeason(payload);
      void refreshReferenceStatus();

      toast({
        title: "Route template applied",
        description:
          withLearned.placedCount > 0
            ? `${templateMeta.length} buses loaded · ${withLearned.placedCount} returning campers placed from prior routes${withLearned.skippedNoBus ? ` · ${withLearned.skippedNoBus} prior bus not on board` : ""}`
            : `${templateMeta.length} buses loaded (stops only). No prior route match for unplotted campers yet — assign manually and Nest will remember.`,
      });
    } catch (e: unknown) {
      toast({
        title: "Template apply failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleApplyHistoricalAssignments = async () => {
    if (!companyId) return;
    setApplyingHistorical(true);
    try {
      const withLearned = await applyLearnedPlacementsToPayload(buildBoardPayload());

      const payload: BoardPayload = {
        coreStops: withLearned.coreStops,
        routeMeta,
        unplottedCampers: withLearned.unplottedCampers,
        routesConfigured: true,
        routesSeason: currentSeason,
        routesSource: routesSource ?? "manual",
      };

      await persistBoard(payload);
      await finalizeBoardForSeason(payload);
      void refreshReferenceStatus();

      toast({
        title: "Prior routes applied",
        description: `${withLearned.placedCount} campers placed on prior buses · ${withLearned.unplottedCampers.length} still unplotted${withLearned.skippedNoBus ? ` · ${withLearned.skippedNoBus} prior bus not on board` : ""}`,
        variant: withLearned.placedCount ? "default" : "destructive",
      });
    } catch (e: unknown) {
      toast({
        title: "Historical apply failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setApplyingHistorical(false);
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
    const coreIndex = displayStopToCoreIndex(stopIndex, timeOfDay === "am");
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
          markRoutesConfigured("manual");
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
    const coreIndex = displayStopToCoreIndex(stopIndex, timeOfDay === "am");
    if (coreIndex < 0 || coreIndex >= effective.length) return;
    const stop = effective[coreIndex];

    setScopeDialog({
      open: true,
      title: "Unpin stop",
      description: `Unpin "${stop.name}" from this route for today only, or permanently (both AM & PM, every day)?`,
      onChoose: (scope) => {
        if (scope === "today") {
          let restoredToday: UnplottedCamper[] = [];
          setTodayOverrides(prev => {
            // If this is a today-added stop, just remove it from added
            const added = prev.added[routeId] || [];
            const addedIdx = added.findIndex(s => s.address === stop.address);
            if (addedIdx >= 0) {
              restoredToday = restoreStopCampersToUnplotted(stop, unplottedCampers, groupRoster);
              return { ...prev, added: { ...prev.added, [routeId]: added.filter((_, i) => i !== addedIdx) } };
            }
            return {
              ...prev,
              excluded: { ...prev.excluded, [routeId]: [...(prev.excluded[routeId] || []), stop.address] },
            };
          });
          if (restoredToday.length > 0) {
            setUnplottedCampers((prev) => [...prev, ...restoredToday]);
          }
          toast({ title: "Unpinned for today", description: `"${stop.name}" removed from today's run only.` });
        } else {
          const restored = restoreStopCampersToUnplotted(stop, unplottedCampers, groupRoster);
          markRoutesConfigured("manual");
          setCoreStops(prev => ({
            ...prev,
            [routeId]: (prev[routeId] || []).filter(s => s.address !== stop.address),
          }));
          setTodayOverrides(prev => ({
            excluded: { ...prev.excluded, [routeId]: (prev.excluded[routeId] || []).filter(a => a !== stop.address) },
            added: { ...prev.added, [routeId]: (prev.added[routeId] || []).filter(s => s.address !== stop.address) },
          }));
          if (restored.length > 0) {
            setUnplottedCampers((prev) => [...prev, ...restored]);
          }
          toast({ title: "Stop removed", description: "Removed permanently from both AM and PM runs." });
        }
        setScopeDialog(prev => ({ ...prev, open: false }));
      },
    });
  };

  // ─── Route Optimization ─────────────────────────────────────────────
  // Compute total miles for an ordered list of stops, anchored at camp.
  // AM: stops → camp. PM: camp → stops (same order). Core order is shared for both runs.
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

  const handleOptimizeRoutes = async (
    targetRouteId?: number,
    options?: { fromFirstStop?: boolean },
  ) => {
    setOptimizing(true);
    try {
      if (options?.fromFirstStop && targetRouteId === undefined) {
        toast({
          title: "Pick a bus first",
          description: "Optimize from stop #1 works on one route at a time — use the button on that bus.",
          variant: "destructive",
        });
        return;
      }

      if (companyId) {
        priorMapRef.current =
          priorMapRef.current ?? (await loadCamperPriorMap(supabase, companyId, currentSeason));
      }
      const priorMap = priorMapRef.current ?? new Map();

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

      if (options?.fromFirstStop && targetRouteId !== undefined) {
        const before = coreStops[targetRouteId] || [];
        const optimized = optimizeStopsFromFirstStop(before);
        proposedCore[targetRouteId] = optimized;

        const meta = routeMeta.find((r) => r.id === targetRouteId);
        let beforeMiles = 0;
        let afterMiles = 0;
        let reorderedRoutes = 0;
        const beforeMi = routeMiles(before);
        const afterMi = routeMiles(optimized);
        beforeMiles = beforeMi;
        afterMiles = afterMi;
        const beforeSeq = before.map((s) => s.address).join("|");
        const afterSeq = optimized.map((s) => s.address).join("|");
        const reordered = beforeSeq !== afterSeq && before.length > 1;
        if (reordered) reorderedRoutes = 1;

        setOptimizePreview({
          open: true,
          proposedCore,
          proposedUnplotted: [],
          beforeMiles,
          afterMiles,
          reassignments,
          reorderedRoutes,
          perRoute: [{
            id: targetRouteId,
            name: meta?.name || `Route ${targetRouteId}`,
            bus: meta?.bus || `Bus ${targetRouteId}`,
            beforeMi,
            afterMi,
            changed: reordered,
            addedCampers: [],
          }],
          selectedRouteIds: reordered ? [targetRouteId] : [],
        });
        return;
      }

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
            let bestRouteId = pickHistoricalBusForCamper(camper, priorMap, routeMeta);
            let bestDist = bestRouteId !== undefined ? 0 : Infinity;

            if (bestRouteId === undefined) {
              bestRouteId = targetRoutes[0]?.id;
              targetRoutes.forEach(r => {
                const stops = proposedCore[r.id];
                const refPoints = stops.length > 0
                  ? stops.map(s => ({ lat: s.lat, lng: s.lng }))
                  : [{ lat: CAMP_LOCATION.lat, lng: CAMP_LOCATION.lng }];
                const minD = Math.min(...refPoints.map(p => haversineMiles(camper.lat, camper.lng, p.lat, p.lng)));
                if (minD < bestDist) { bestDist = minD; bestRouteId = r.id; }
              });
            }

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
        if (priorMap.size > 0) {
          Object.assign(proposedCore, reorderStopsByHistoricalPriors(proposedCore, priorMap));
        }
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

    markRoutesConfigured("manual");
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
  const csvRowsToBlob = (rows: (string | number)[][]) => {
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    return new Blob([csv], { type: "text/csv" });
  };

  const handleGenerateReport = async (reportName: string) => {
    if (reportName === "Transport Exceptions") {
      if (!companyId) {
        toast({ title: "Company not loaded", variant: "destructive" });
        return;
      }
      const exceptions = await fetchTransportExceptionsForReport(supabase, companyId, overrideDate);
      const rows = buildTransportExceptionsReportRows({
        overrideDate,
        exceptions,
        manual: todayOverrides,
        routeMeta: routeMeta.map((r) => ({ id: r.id, name: r.name, bus: r.bus })),
        coreStops,
      });
      const dataRowCount = rows.length > 1 && String(rows[1][0]).startsWith("(") ? 0 : rows.length - 1;
      openReportPreview({
        title: "Transport Exceptions",
        description: `${overrideDate} · ${dataRowCount} change${dataRowCount === 1 ? "" : "s"} · season ${currentSeason}`,
        kind: "csv",
        blob: csvRowsToBlob(rows),
        filename: `daycamp-transport-exceptions-${overrideDate}.csv`,
        rows,
      });
      return;
    }

    if (reportName === "Attendance") {
      if (enrollmentWeekForReport == null) {
        toast({
          title: "Enrollment week required",
          description: "Set enrollment week calendar dates before printing attendance sheets.",
          variant: "destructive",
        });
        return;
      }
      const sheetRoutes = displayRoutes
        .map((r) => ({
          bus: r.bus,
          routeName: r.name,
          campers: ridersOnRoute(
            r.id,
            getEffectiveCore(r.id),
            parentTransportCampers,
            {
              runDate: overrideDate,
              runPeriod: timeOfDay,
              enrollmentWeek: enrollmentWeekForReport,
              enrollmentLookup: camperEnrollmentLookup,
            },
          ).map((c) => ({
            name: c.name,
            detail: c.stopName,
          })),
        }))
        .filter((r) => r.campers.length > 0);
      const groups = groupRosterByGroup.map(([groupName, campers]) => ({
        groupName,
        campers: campers.map((c) => ({ name: c.name, detail: groupName })),
      }));
      const weekRow =
        enrollmentWeekForReport != null
          ? getEnrollmentWeekRow(enrollmentWeekCalendar, enrollmentWeekForReport)
          : null;
      const built = buildCombinedAttendanceBubbleSheetPdf({
        companyName: currentCompany?.name ?? "Day Camp",
        date: overrideDate,
        runPeriod: timeOfDay,
        enrollmentWeek: enrollmentWeekForReport ?? undefined,
        weekDateRange: weekRow ? formatEnrollmentWeekRange(weekRow) : undefined,
        weekDays: enrollmentWeekDayColumns(weekRow),
        busRoutes: sheetRoutes,
        groups,
      });
      if (!built) {
        toast({ title: "No campers to print", variant: "destructive" });
      } else {
        openReportPreview({
          title: "Day Camp Attendance Bubble Sheet",
          description: `Week ${enrollmentWeekForReport} · bus (weekly AM/PM) + group`,
          kind: "pdf",
          blob: built.blob,
          filename: built.filename,
        });
      }
      return;
    }

    if (reportName === "Car Seat Count by Bus") {
      if (!companyId) {
        toast({ title: "Company not loaded", variant: "destructive" });
        return;
      }
      const lookup = await loadCamperCarSeatLookup(supabase, companyId, currentSeason);
      const coreForRoute = (routeId: number) => {
        const route = displayRoutes.find((r) => r.id === routeId);
        if (!route) return [];
        return route.stops
          .filter((s) => s.address !== CAMP_LOCATION.address)
          .map((s) => ({ name: s.name, camperNames: s.camperNames }));
      };
      const summaries = summarizeCarSeatsByBus(
        displayRoutes.map((r) => ({ id: r.id, bus: r.bus, name: r.name })),
        coreForRoute,
        lookup,
        { includeEmptyBuses: true },
      );
      const rows = buildCarSeatCountByBusCsvRows(summaries, {
        date: overrideDate,
        runPeriod: timeOfDay,
      });
      const totalCarSeats = summaries.reduce((sum, s) => sum + s.carSeatsRequired, 0);
      const weekNote =
        activeRouteEnrollmentWeek != null ? ` · Week ${activeRouteEnrollmentWeek} riders` : "";
      openReportPreview({
        title: "Car Seat Count by Bus",
        description: `${overrideDate} · ${timeOfDay.toUpperCase()} · ${totalCarSeats} car seat${totalCarSeats === 1 ? "" : "s"} (Nursery + Pre-K)${weekNote}`,
        kind: "csv",
        blob: csvRowsToBlob(rows),
        filename: `daycamp-car-seats-by-bus-${overrideDate}-${timeOfDay}.csv`,
        rows,
      });
      return;
    }

    if (reportName === "Digital Attendance Log") {
      if (!companyId) {
        toast({ title: "Company not loaded", variant: "destructive" });
        return;
      }
      const loaded = await loadBusAttendance(
        supabase,
        companyId,
        currentSeason,
        overrideDate,
        timeOfDay,
      );
      const ptRiders: DigitalBusAttendanceRider[] = displayRoutes.flatMap((route) =>
        parentTransportRidersForRoute(route.id, parentTransportCampers, {
          runDate: overrideDate,
          runPeriod: timeOfDay,
          enrollmentWeek: activeRouteEnrollmentWeek,
          enrollmentLookup: camperEnrollmentLookup,
        }).map((rider) => ({
          routeId: route.id,
          bus: route.bus,
          routeName: route.name,
          camperName: rider.name,
          stopName: rider.stopName,
          transportMode: "parent" as const,
        })),
      );
      const rows = buildDigitalBusAttendanceCsvRows(
        displayRoutes,
        CAMP_LOCATION.address,
        loaded.records,
        loaded.busSubmissions,
        { date: overrideDate, runPeriod: timeOfDay },
        ptRiders,
      );
      const marked = rows.slice(1).filter((r) => r[9] === "Present" || r[9] === "Absent").length;
      openReportPreview({
        title: "Digital Attendance Log",
        description: `${overrideDate} · ${timeOfDay.toUpperCase()} · ${marked} marked in system · ${loaded.submittedAt ? "all buses submitted" : "in progress"}`,
        kind: "csv",
        blob: csvRowsToBlob(rows),
        filename: `daycamp-digital-attendance-${overrideDate}-${timeOfDay}.csv`,
        rows,
      });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const safeName = reportName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filename = `daycamp-${safeName}-${today}.csv`;

    // Build rows specific to each report type
    let rows: (string | number)[][] = [];

    switch (reportName) {
      case "Bus Report": {
        rows.push(["Bus", "Route", "Direction", "Departure", "Total Stops", "Bus Campers", "Parent Transport", "Total Campers", "Status"]);
        routes.forEach(r => {
          const ptCount = countParentTransportOnRoute(r.id, parentTransportCampers, {
            runDate: overrideDate,
            runPeriod: timeOfDay,
            enrollmentWeek: activeRouteEnrollmentWeek,
            enrollmentLookup: camperEnrollmentLookup,
          });
          const busCount = Math.max(0, r.campers - ptCount);
          rows.push([
            r.bus,
            r.name,
            r.direction,
            r.departure,
            (coreStops[r.id] || []).length,
            busCount,
            ptCount,
            r.campers,
            r.status,
          ]);
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
        rows.push(["Camper Name", "Bus", "Schedule", "AM", "PM", "Notes"]);
        parentTransportCampers.forEach((c) => {
          const meta = routeMeta.find((r) => r.id === c.routeId);
          rows.push([
            c.name,
            meta?.bus ?? `Bus ${c.routeId}`,
            formatParentTransportSchedule(c),
            c.am ? "Yes" : "No",
            c.pm ? "Yes" : "No",
            c.notes ?? "",
          ]);
        });
        if (rows.length === 1) rows.push(["(No parent transport campers)", "", "", "", "", ""]);
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
      default: {
        rows.push(["Report", reportName]);
        rows.push(["Generated", today]);
      }
    }

    openReportPreview({
      title: reportName,
      description: `Day Camp · ${rows.length - 1} row${rows.length - 1 === 1 ? "" : "s"}`,
      kind: "csv",
      blob: csvRowsToBlob(rows),
      filename,
      rows,
    });
  };

  const assignedCamperCount = useMemo(
    () => displayRoutes.reduce((sum, r) => sum + r.campers, 0),
    [displayRoutes],
  );
  const parentTransportCountForWeek = parentTransportForWeek.length;
  const totalCamperCount = assignedCamperCount + unplottedForWeek.length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 min-w-0">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="page-header">Transport</h1>
            <p className="page-subheader">Bus routes, maps, coordination, and travel reports</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
              <Users className="h-4 w-4 text-primary" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Campers</span>
                <span className="text-sm font-semibold">
                  {totalCamperCount}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    ({assignedCamperCount} on routes{parentTransportCountForWeek > 0 ? ` incl. ${parentTransportCountForWeek} PT` : ""} · {unplottedForWeek.length} unplotted
                    {activeRouteEnrollmentWeek != null ? ` · Week ${activeRouteEnrollmentWeek}` : ""})
                  </span>
                </span>
              </div>
            </div>
            {referenceStatus && (
              <Badge
                variant={referenceStatus.loaded ? "secondary" : "outline"}
                className="gap-1 px-2 py-1 text-[10px] font-normal whitespace-nowrap"
                title={
                  referenceStatus.source === "nest"
                    ? `${referenceStatus.priorCount} campers learned from your saved routes`
                    : referenceStatus.source === "mappoint"
                      ? `${referenceStatus.priorCount} campers from imported reference data`
                      : "No learned routes yet — assign campers and Nest will remember"
                }
              >
                <Database className="h-3 w-3" />
                {referenceStatus.loaded
                  ? referenceStatus.source === "nest"
                    ? `Learned · ${referenceStatus.priorCount} campers`
                    : `${referenceStatus.referenceSeason} reference · ${referenceStatus.priorCount}`
                  : "No learned routes yet"}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleApplyRouteTemplate}
            disabled={applyingTemplate}
            title="Load starter bus routes (stops only, no campers)"
          >
            <LayoutTemplate className={`h-4 w-4 ${applyingTemplate ? "animate-pulse" : ""}`} />
            {applyingTemplate ? "Applying template…" : "Apply Route Template"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleApplyHistoricalAssignments}
            disabled={applyingHistorical || unplottedCampers.length === 0}
            title="Place unplotted campers on buses from learned routing history"
          >
            <History className={`h-4 w-4 ${applyingHistorical ? "animate-pulse" : ""}`} />
            {applyingHistorical ? "Placing from prior routes…" : "Place Using Prior Routes"}
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
                    setTodayOverrides(emptyManualOverrides());
      overrideLoadedKeyRef.current = null;
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

      <Tabs value={activeTransportTab} onValueChange={setActiveTransportTab} className="min-w-0">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="map" className="text-xs gap-1"><MapIcon className="h-3.5 w-3.5" /> Route Map</TabsTrigger>
          <TabsTrigger value="unplotted" className="text-xs gap-1"><UserRound className="h-3.5 w-3.5" /> Unplotted Campers{unplottedForWeek.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1.5">{unplottedForWeek.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="pt" className="text-xs gap-1"><Car className="h-3.5 w-3.5" /> Parent Transport{parentTransportForWeek.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1.5">{parentTransportForWeek.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="daycamp" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" /> Reports</TabsTrigger>
        </TabsList>

        {/* ─── Route Map Tab ─── */}
        <TabsContent value="map" className="mt-4">
          {/* Date + AM / PM */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="transport-date" className="text-xs text-muted-foreground whitespace-nowrap">Run date</Label>
              <Input
                id="transport-date"
                type="date"
                value={overrideDate}
                onChange={(e) => {
                  overrideLoadedKeyRef.current = null;
                  setOverrideDate(e.target.value || todayDateString());
                }}
                className="h-8 w-[140px] text-xs"
              />
              {overrideDate === todayDateString() && (
                <Badge variant="secondary" className="text-[10px]">Today</Badge>
              )}
            </div>
            {transportExceptions.length > 0 && (
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                {transportExceptions.length} bus exception{transportExceptions.length === 1 ? "" : "s"}
              </Badge>
            )}
            {overridesLoading && (
              <span className="text-[10px] text-muted-foreground">Loading exceptions…</span>
            )}
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
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5">
              <Checkbox
                id="stop-pickup-enabled"
                checked={boardSettings.stopPickupEnabled}
                onCheckedChange={(checked) => {
                  setBoardSettings((prev) => ({
                    ...prev,
                    stopPickupEnabled: checked === true,
                  }));
                }}
              />
              <Label htmlFor="stop-pickup-enabled" className="text-xs flex items-center gap-1.5 cursor-pointer">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Pickup time at stops
              </Label>
              <Input
                type="number"
                min={0}
                max={15}
                step={1}
                disabled={!boardSettings.stopPickupEnabled}
                value={boardSettings.stopPickupMinutes}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setBoardSettings((prev) => ({
                    ...prev,
                    stopPickupMinutes: Number.isFinite(n) ? Math.min(15, Math.max(0, n)) : prev.stopPickupMinutes,
                  }));
                }}
                className="h-7 w-14 text-xs text-center"
                title="Minutes added at each passenger stop (AM & PM)"
              />
              <span className="text-[10px] text-muted-foreground">min · all buses</span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="route-enrollment-week" className="text-xs text-muted-foreground whitespace-nowrap">
                Enrollment week
              </Label>
              <Select
                value={routeEnrollmentWeek === "all" ? "all" : String(routeEnrollmentWeek)}
                onValueChange={(v) => setRouteEnrollmentWeek(v === "all" ? "all" : parseInt(v, 10))}
              >
                <SelectTrigger id="route-enrollment-week" className="h-8 w-[min(280px,100vw)] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All weeks (full roster)</SelectItem>
                  {Array.from({ length: DAY_CAMP_ENROLLMENT_WEEKS }, (_, i) => i + 1).map((week) => (
                    <SelectItem key={week} value={String(week)}>
                      {formatEnrollmentWeekLabel(week, enrollmentWeekCalendar)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeRouteEnrollmentWeek != null && (
              <Badge variant="secondary" className="text-[10px]">
                Week {activeRouteEnrollmentWeek} riders only
                {hiddenByWeekFilter > 0 ? ` · ${hiddenByWeekFilter} hidden` : ""}
              </Badge>
            )}
            {geocodingBoard && (
              <Badge variant="outline" className="text-[10px]">
                Geocoding addresses…
              </Badge>
            )}
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

          {(hiddenByWeekFilter > 0 || unplottedNeedingGeocode > 0) && (
            <div className="mb-4 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 space-y-1">
              {hiddenByWeekFilter > 0 && (
                <p className="text-xs text-muted-foreground">
                  {hiddenByWeekFilter} unplotted camper{hiddenByWeekFilter === 1 ? "" : "s"} hidden by enrollment week filter.{" "}
                  <button
                    type="button"
                    className="underline hover:text-foreground font-medium"
                    onClick={() => setRouteEnrollmentWeek("all")}
                  >
                    Show all weeks
                  </button>
                </p>
              )}
              {unplottedNeedingGeocode > 0 && (
                <p className="text-xs text-muted-foreground">
                  {unplottedNeedingGeocode} camper{unplottedNeedingGeocode === 1 ? "" : "s"} have an address but aren&apos;t on the map yet
                  {geocodingBoard ? " — geocoding…" : "."}
                  {!geocodingBoard && (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="underline hover:text-foreground font-medium"
                        onClick={() => {
                          geocodeAttemptRef.current = "";
                          void geocodeBoardAddresses(
                            collectTransportAddressesNeedingGeocode(
                              unplottedCampers,
                              coreStops,
                              CAMP_LOCATION.address,
                            ),
                          );
                        }}
                      >
                        Retry geocoding
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {transportExceptions.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                Today&apos;s bus exceptions (auto-applied)
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                {transportExceptions.map((ex, i) => (
                  <li key={`${ex.source}-${ex.camperName}-${i}`}>
                    <span className="font-medium text-foreground">{ex.camperName}</span>
                    {" · "}{ex.label}
                    {ex.detail ? ` — ${ex.detail}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px),1fr] lg:items-start">
            {/* Route sidebar — full map height, scroll bus list; stop lists scroll inside each card */}
            <div className={`flex flex-col min-h-0 ${MAP_PANEL_HEIGHT[mapHeight]}`}>
              <div className="shrink-0 flex items-center justify-between gap-2 mb-2 px-0.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {timeOfDay === "am" ? "AM Routes (→ Camp)" : "PM Routes (Camp →)"}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] gap-1"
                    onClick={hideAllRoutes}
                    title="Hide all routes on the map"
                  >
                    <EyeOff className="h-3 w-3" />
                    Hide all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] gap-1"
                    onClick={showAllRoutes}
                    disabled={visibleRoutes.length === routeMeta.length}
                    title="Show every route on the map"
                  >
                    <Eye className="h-3 w-3" />
                    Show all
                  </Button>
                </div>
              </div>
              {visibleRoutes.length === 0 && (
                <p className="shrink-0 text-[10px] text-muted-foreground mb-2 px-0.5">
                  Map is clear — click a bus below to view one route at a time.
                </p>
              )}
              {visibleRoutes.length === 1 && (
                <p className="shrink-0 text-[10px] text-muted-foreground mb-2 px-0.5">
                  Showing {displayRoutes.find(r => r.id === visibleRoutes[0])?.bus ?? "1 bus"} only — click again to hide.
                </p>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {displayRoutes.map(r => {
                const isVisible = visibleRoutes.includes(r.id);
                const isSolo = visibleRoutes.length === 1 && visibleRoutes[0] === r.id;
                const core = coreStops[r.id] || [];
                const ptOnRoute = parentTransportByRoute.get(r.id) ?? [];
                const ptActiveToday = ptOnRoute.filter((c) =>
                  isParentTransportScheduledForRun(c, overrideDate, timeOfDay),
                );
                return (
                  <Card
                    key={r.id}
                    className={`cursor-pointer transition-all shrink-0 ${
                      isSolo ? "ring-2 ring-primary/40 shadow-md" : isVisible ? "hover:shadow-md" : "opacity-50"
                    }`}
                    onClick={() => selectRouteOnMap(r.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2.5 shrink-0">
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
                                title="Optimize this route (full reorder)"
                              >
                                <Sparkles className={`h-3 w-3 ${optimizing ? "animate-pulse" : ""}`} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOptimizeRoutes(r.id, { fromFirstStop: true });
                                }}
                                disabled={optimizing || (coreStops[r.id]?.length ?? 0) < 2}
                                className="text-muted-foreground hover:text-primary p-1 rounded transition-colors disabled:opacity-50"
                                title="Keep stop #1 fixed — optimize the rest from there"
                              >
                                <CornerDownRight className={`h-3 w-3 ${optimizing ? "animate-pulse" : ""}`} />
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
                              {ptOnRoute.length > 0 ? (
                                <span className="text-sky-700 dark:text-sky-400">
                                  {" "}· {ptOnRoute.length} PT
                                  {ptActiveToday.length !== ptOnRoute.length
                                    ? ` (${ptActiveToday.length} today)`
                                    : ""}
                                </span>
                              ) : null}
                            </span>
                            <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 ${statusColors[r.status]}`}>
                              {r.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {isVisible && (r.stops.length > 0 || ptOnRoute.length > 0) && (
                        <div
                          className="mt-2 pl-6 border-l-2 space-y-1.5 max-h-[220px] overflow-y-auto overscroll-y-contain pr-1"
                          style={{ borderColor: r.color + "40" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.stops.map((stop, i) => {
                            const isCamp = stop.address === CAMP_LOCATION.address;
                            const stopAddressNorm = normalizeAddress(stop.address);
                            const pendingAtStop = !isCamp && stopAddressNorm
                              ? unplottedForWeek.filter(
                                  (c) => normalizeAddress(c.address) === stopAddressNorm,
                                )
                              : [];
                            const stopLines = routeStopListLines(stop, {
                              isCamp,
                              pendingNames: pendingAtStop.map((c) => c.name),
                            });
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
                                <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                  <span
                                    className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none text-white mt-0.5"
                                    style={{ backgroundColor: isCamp ? "#16a34a" : r.color }}
                                  >
                                    {getRouteStopLabel(r.stops, i)}
                                  </span>
                                  <div className="min-w-0 flex-1 leading-snug">
                                    <p
                                      className={`truncate ${
                                        isCamp
                                          ? "font-medium text-foreground"
                                          : stopLines.isOpenStop && stopLines.camperNames.length === 0
                                            ? "text-muted-foreground"
                                            : "font-medium text-foreground"
                                      }`}
                                    >
                                      {stopLines.title}
                                    </p>
                                    {stopLines.subtitle ? (
                                      <p
                                        className={`truncate ${
                                          stopLines.isOpenStop
                                            ? "text-amber-700 dark:text-amber-400 italic"
                                            : "text-muted-foreground"
                                        }`}
                                      >
                                        {stopLines.subtitle}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                {stop.pickupTime ? (
                                  <span className="text-muted-foreground shrink-0 whitespace-nowrap">{stop.pickupTime}</span>
                                ) : null}
                              </div>
                            );
                          })}
                          {ptOnRoute.length > 0 ? (
                            <div className="pt-2 mt-1 border-t border-dashed border-sky-500/30 space-y-1">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-400 px-1">
                                {PARENT_TRANSPORT_STOP_LABEL}
                              </p>
                              {ptOnRoute.map((camper) => {
                                const activeToday = isParentTransportScheduledForRun(
                                  camper,
                                  overrideDate,
                                  timeOfDay,
                                );
                                return (
                                  <div
                                    key={camper.id}
                                    className={`flex items-start gap-1.5 rounded px-1 py-0.5 text-[10px] ${
                                      activeToday ? "bg-sky-500/5" : "opacity-60"
                                    }`}
                                  >
                                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[8px] font-bold text-white mt-0.5">
                                      PT
                                    </span>
                                    <div className="min-w-0 flex-1 leading-snug">
                                      <p className="font-medium text-foreground truncate">{camper.name}</p>
                                      <p className="text-muted-foreground truncate">
                                        {formatParentTransportSchedule(camper)}
                                        {!activeToday ? " · not on this run date" : ""}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              </div>
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
              <div className={`${MAP_PANEL_HEIGHT[mapHeight]} w-full relative`}>
                {(boardLoading || companyLoading || authLoading) && (
                  <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-background/60 backdrop-blur-[1px] text-sm text-muted-foreground">
                    Loading saved board…
                  </div>
                )}
                <TransportRouteMap
                  routes={displayedRoutes}
                  allRoutes={routes}
                  campAddress={CAMP_LOCATION.address}
                  onMoveStop={handleMoveStop}
                  onRemoveStop={handleRemoveStop}
                  unplottedCampers={unplottedForWeek}
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
                    campAddress={CAMP_LOCATION.address}
                    onMoveStop={handleMoveStop}
                    onRemoveStop={handleRemoveStop}
                    unplottedCampers={unplottedForWeek}
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
              accept=".csv,.xlsx,.xls,text/csv"
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
              <Upload className="h-3.5 w-3.5" /> Import File
            </Button>
            <Button size="sm" onClick={() => setAddCamperOpen(true)} className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" /> Add Camper
            </Button>
          </div>
          {activeRouteEnrollmentWeek != null && (
            <p className="text-xs text-muted-foreground">
              Showing unplotted campers enrolled for{" "}
              {formatEnrollmentWeekLabel(activeRouteEnrollmentWeek, enrollmentWeekCalendar)}.
              {" "}
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => setRouteEnrollmentWeek("all")}
              >
                Show all weeks
              </button>
            </p>
          )}
          {unplottedForWeek.length === 0 ? (
            <Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">{unplottedCampers.length === 0 ? "All campers have been assigned to routes! 🎉" : "No unplotted campers for this enrollment week."}</p></CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {unplottedForWeek.map((c) => {
                const priorSuggestion = priorRouteSuggestions.get(c.id);
                return (
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
                        <p className="text-xs text-muted-foreground mt-0.5">
                          📍 {c.address?.trim() || "No address — add before assigning to a route"}
                        </p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground">Age {c.age}</span>
                          <span className="text-[10px] text-muted-foreground">{c.session}</span>
                        </div>
                        {priorSuggestion ? (
                          <div className="mt-2 space-y-2">
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              Prior route · Bus {priorSuggestion.priorBusNumber} ({priorSuggestion.referenceSeason})
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-full text-xs"
                              onClick={() => handleAssignCamperToRoute(c.id, priorSuggestion.routeId)}
                            >
                              Place on prior bus
                            </Button>
                          </div>
                        ) : null}
                        <div className={priorSuggestion ? "mt-2" : "mt-2"}>
                          <Select onValueChange={(v) => handleAssignCamperToRoute(c.id, parseInt(v))}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign to route..." /></SelectTrigger>
                            <SelectContent>
                              {routeMeta.map(r => (
                                <SelectItem key={r.id} value={String(r.id)}>
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                                    {r.name}
                                    {priorSuggestion?.routeId === r.id ? " (prior)" : ""}
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
              );
              })}
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

        <TabsContent value="pt" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Parent Transport (PT)</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Parents drop off or pick up — no map address needed. Campers still count on their assigned bus for attendance and all bus reports.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                resetNewParentTransportForm();
                setAddParentTransportOpen(true);
              }}
              disabled={routeMeta.length === 0}
            >
              <UserPlus className="h-3.5 w-3.5" /> Add to PT
            </Button>
          </div>

          {routeMeta.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Apply a route template or add routes first — PT campers still need a bus assignment for reporting.
              </CardContent>
            </Card>
          ) : parentTransportForWeek.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {parentTransportCampers.length === 0
                  ? "No parent transport campers yet."
                  : "No parent transport campers for this enrollment week."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {parentTransportForWeek.map((c) => {
                const meta = routeMeta.find((r) => r.id === c.routeId);
                return (
                  <Card key={c.id} className="border-dashed border-sky-500/40">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-sky-500/10 p-2">
                          <Car className="h-4 w-4 text-sky-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{c.name}</p>
                            <button
                              type="button"
                              onClick={() => handleRemoveParentTransport(c.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            🚌 {meta?.name ?? `Bus ${c.routeId}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatParentTransportSchedule(c)}
                          </p>
                          {c.notes ? (
                            <p className="text-xs text-muted-foreground mt-2">{c.notes}</p>
                          ) : null}
                          <Badge variant="outline" className="mt-2 text-[10px]">
                            Counts on bus reports · no map pin
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Dialog open={addParentTransportOpen} onOpenChange={setAddParentTransportOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add parent transport camper</DialogTitle>
                <DialogDescription>
                  Assign a bus for reporting. Pick which runs the parent handles and which weekdays apply.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label>Camper</Label>
                  <SearchableChildSelect
                    children={rosterChildOptions}
                    value={newParentTransport.childId}
                    onValueChange={(childId) => setNewParentTransport((prev) => ({ ...prev, childId }))}
                    placeholder="Search roster…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assigned bus (for reports)</Label>
                  <Select
                    value={newParentTransport.routeId}
                    onValueChange={(routeId) => setNewParentTransport((prev) => ({ ...prev, routeId }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select bus…" /></SelectTrigger>
                    <SelectContent>
                      {routeMeta.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.bus} · {r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newParentTransport.am}
                      onCheckedChange={(checked) => setNewParentTransport((prev) => ({ ...prev, am: checked === true }))}
                    />
                    AM parent drop-off
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newParentTransport.pm}
                      onCheckedChange={(checked) => setNewParentTransport((prev) => ({ ...prev, pm: checked === true }))}
                    />
                    PM parent pick-up
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Weekdays</Label>
                  <p className="text-xs text-muted-foreground">Leave all unchecked for every camp day.</p>
                  <div className="flex flex-wrap gap-2">
                    {PARENT_TRANSPORT_WEEKDAYS.map((day) => (
                      <Button
                        key={day}
                        type="button"
                        size="sm"
                        variant={newParentTransport.weekdays.includes(day) ? "default" : "outline"}
                        className="h-7 px-2 text-xs capitalize"
                        onClick={() => toggleParentTransportWeekday(day)}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt-notes">Notes</Label>
                  <Input
                    id="pt-notes"
                    value={newParentTransport.notes}
                    onChange={(e) => setNewParentTransport((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="e.g. Grandparent pickup Wed only"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddParentTransportOpen(false)}>Cancel</Button>
                <Button onClick={handleAddParentTransport}>Add to PT</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="daycamp" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="daycamp-report-date" className="text-xs text-muted-foreground whitespace-nowrap">
              Report date
            </Label>
            <Input
              id="daycamp-report-date"
              type="date"
              value={overrideDate}
              onChange={(e) => {
                overrideLoadedKeyRef.current = null;
                setOverrideDate(e.target.value || todayDateString());
              }}
              className="h-8 w-[140px] text-xs"
            />
            {overrideDate === todayDateString() && (
              <Badge variant="secondary" className="text-[10px]">Today</Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              Same date as Map / Attendance · manual edits are per season ({currentSeason})
            </span>
          </div>
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Digital bus attendance (required)</p>
                <p className="text-xs text-muted-foreground">
                  Mark Present / Absent on each bus — saves live (AM &amp; PM). Bus arrived / depart is on{" "}
                  <Link to="/day-camp/bus-check-ins" className="text-primary underline-offset-2 hover:underline">
                    Bus Check-ins
                  </Link>
                  . Weekly bubble sheet below is optional paper backup.
                </p>
                {busAttendanceSummary && busAttendanceSummary.totalBuses > 0 ? (
                  <p className="text-[11px] text-foreground/80">
                    {overrideDate} · {timeOfDay.toUpperCase()}:{" "}
                    {busAttendanceSummary.markedCampers}/{busAttendanceSummary.scheduledCampers} campers marked ·{" "}
                    {busAttendanceSummary.submittedBuses}/{busAttendanceSummary.totalBuses} buses submitted
                  </p>
                ) : busAttendanceSummary ? (
                  <p className="text-[11px] text-muted-foreground">No riders scheduled for this date/run.</p>
                ) : null}
              </div>
              <Button size="sm" className="shrink-0" asChild>
                <Link to="/day-camp/bus-attendance">Take Bus Attendance</Link>
              </Button>
            </CardContent>
          </Card>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {dayCampReports.map((r) => (
              <Card key={r.name} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleGenerateReport(r.name)}>
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

      {/* Same-address siblings — choose who rides before today/permanent */}
      <Dialog
        open={siblingAssignDialog.open}
        onOpenChange={(open) => {
          if (!open) setSiblingAssignDialog((prev) => ({ ...prev, open: false }));
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Who rides this bus?</DialogTitle>
            <DialogDescription>
              These campers share the same home address. Select who to assign — siblings are never added automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {siblingAssignDialog.candidates.map((c) => {
              const checked = siblingAssignDialog.selectedIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(on) => {
                      setSiblingAssignDialog((prev) => ({
                        ...prev,
                        selectedIds: on
                          ? [...prev.selectedIds, c.id]
                          : prev.selectedIds.filter((id) => id !== c.id),
                      }));
                    }}
                  />
                  <span className="text-sm font-medium">{c.name}</span>
                </label>
              );
            })}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setSiblingAssignDialog((prev) => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            <Button
              disabled={siblingAssignDialog.selectedIds.length === 0}
              onClick={() => {
                const { routeId, selectedIds } = siblingAssignDialog;
                setSiblingAssignDialog((prev) => ({ ...prev, open: false }));
                openScopeDialogForAssign(selectedIds, routeId);
              }}
            >
              Continue
            </Button>
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
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: editRoute?.color }} />
              Edit Route
            </DialogTitle>
            <DialogDescription>Update bus name, route details, status, and color. Applies to both AM & PM runs.</DialogDescription>
          </DialogHeader>
          {editRoute && (
            <div className="space-y-3 py-2 min-w-0 max-w-full">
              <div className="min-w-0">
                <Label htmlFor="edit-name">Route Name</Label>
                <Input
                  id="edit-name"
                  className="w-full max-w-full"
                  value={editRoute.name}
                  onChange={(e) => setEditRoute({ ...editRoute, name: e.target.value })}
                  placeholder="e.g. North Shore Pickup"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="edit-bus">Bus Name</Label>
                <Input
                  id="edit-bus"
                  className="w-full max-w-full"
                  value={editRoute.bus}
                  onChange={(e) => setEditRoute({ ...editRoute, bus: e.target.value })}
                  placeholder="e.g. Bus A"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 min-w-0">
                <div className="min-w-0">
                  <Label htmlFor="edit-departure">Departure Time</Label>
                  <Input
                    id="edit-departure"
                    className="w-full max-w-full"
                    value={editRoute.departure}
                    onChange={(e) => setEditRoute({ ...editRoute, departure: e.target.value })}
                    placeholder="e.g. 7:00 AM"
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editRoute.status} onValueChange={(v) => setEditRoute({ ...editRoute, status: v })}>
                    <SelectTrigger id="edit-status" className="w-full max-w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Confirmed">Confirmed</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="min-w-0">
                <Label htmlFor="edit-capacity">Max Capacity (campers)</Label>
                <Input
                  id="edit-capacity"
                  className="w-full max-w-full"
                  type="number"
                  min={1}
                  max={200}
                  value={editRoute.capacity}
                  onChange={(e) => setEditRoute({ ...editRoute, capacity: parseInt(e.target.value, 10) || 0 })}
                  placeholder="e.g. 50"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Maximum total children allowed on this bus.</p>
              </div>
              <div className="min-w-0">
                <Label>Route Color</Label>
                <div className="mt-2 max-h-36 overflow-y-auto overflow-x-hidden rounded-md border border-border/40 p-2">
                  <div className="flex flex-wrap gap-2">
                    {ROUTE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditRoute({ ...editRoute, color })}
                        className={`h-8 w-8 shrink-0 rounded-full border-2 transition-all ${
                          editRoute.color === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                        title={color}
                      />
                    ))}
                  </div>
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
                      const stopLines = routeStopListLines(stop, { isCamp });
                      const riders = stopLines.camperNames;
                      const isHousehold = riders.length > 1;
                      return (
                        <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                          <div className="flex flex-col items-center gap-1 pt-0.5">
                            <span
                              className="flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                              style={{ backgroundColor: isCamp ? "#16a34a" : selectedRoute.color }}
                            >
                              {getRouteStopLabel(selectedRoute.stops, i)}
                            </span>
                            {i < selectedRoute.stops.length - 1 && <div className="w-0.5 h-4 bg-border" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{stopLines.title}</p>
                              {isHousehold && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                  <Users className="h-2.5 w-2.5 mr-0.5" />
                                  Household · {riders.length}
                                </Badge>
                              )}
                            </div>
                            {!isCamp && stopLines.camperNames.length > 0 ? (
                              <p className="text-[10px] text-muted-foreground mt-1">{stop.address}</p>
                            ) : null}
                            {!isCamp && stopLines.isOpenStop && stopLines.subtitle ? (
                              <p className="text-[10px] text-amber-700 dark:text-amber-400 italic mt-1">{stopLines.subtitle}</p>
                            ) : null}
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
                  campAddress={CAMP_LOCATION.address}
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
              accept=".csv,.xlsx,.xls,text/csv"
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

      <TransportReportPreviewDialog
        preview={reportPreview}
        onOpenChange={(open) => {
          if (!open) setReportPreview(null);
        }}
      />
    </motion.div>
  );
}
