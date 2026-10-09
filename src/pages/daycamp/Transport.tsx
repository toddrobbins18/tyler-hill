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
import { Bus, MapPin, Users, Plus, FileText, Map as MapIcon, Route as RouteIcon, UserRound, Sun, Moon, Upload, Download, UserPlus, X, Sparkles, TrendingDown, ArrowRight, Pencil, Trash2, Maximize2, Minimize2, Eye, EyeOff, History, LayoutTemplate, Database, Car, CornerDownRight, Clock, Undo2, FlaskConical, CheckCircle2, Pin, Search } from "lucide-react";
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
  isParentTransportBusAssigned,
  isParentTransportScheduledForRun,
  parentTransportBusLabel,
  PARENT_TRANSPORT_NO_BUS_LABEL,
  parentTransportRidersForRoute,
  PARENT_TRANSPORT_WEEKDAYS,
  PARENT_TRANSPORT_STOP_LABEL,
  applyParentTransportExclusionToRoutes,
  ridersOnRoute,
  stableParentTransportId,
  stripParentTransportFromCoreStops,
  type ParentTransportCamper,
  type ParentTransportWeekday,
} from "@/lib/transportParentTransport";
import SearchableChildSelect from "@/components/SearchableChildSelect";
import {
  loadGroupRoster,
  normCamperName,
  type GroupRosterCamper,
} from "@/lib/transportGroupAttendance";
import {
  buildDayBusBubbleSheetPdf,
  buildGroupBubbleSheetPdf,
} from "@/lib/transportBubbleSheetPdf";
import {
  buildBusBubbleSheetRoutes,
  CAMPER_BUS_RUN_MODE_LABELS,
  CAMPER_BUS_RUN_MODE_OPTIONS,
  getCamperBusRunMode,
  normCamperBusRunKey,
  type CamperBusRunMode,
  type CamperBusRunSchedules,
} from "@/lib/transportCamperBusRun";
import { campersOnRoute } from "@/lib/transportBusAttendance";
import {
  attendanceEnrollmentWeek,
  camperEnrolledInWeek,
  enrollmentWeekForDate,
  enrollmentWeekDayColumns,
  formatEnrollmentWeekLabel,
  formatEnrollmentWeekRange,
  configuredEnrollmentWeekRows,
  getEnrollmentWeekRow,
  loadEnrollmentWeekCalendar,
  type EnrollmentWeekCalendar,
} from "@/lib/enrollmentWeekCalendar";
import { DAY_CAMP_ENROLLMENT_WEEKS } from "@/lib/enrolledWeeks";
import {
  applyEnrollmentWeekToRoutes,
  applySeasonRosterToRoutes,
  buildCamperEnrollmentLookup,
  camperEnrolledInWeekByLookup,
  filterUnplottedForWeek,
  filterUnplottedToSeasonRoster,
  stopRiderNames,
} from "@/lib/transportWeekView";
import {
  buildCarSeatCountByBusCsvRows,
  loadCamperCarSeatLookup,
  summarizeCarSeatsByBus,
} from "@/lib/transportCarSeatReport";
import { TransportReportPreviewDialog, type TransportReportPreview } from "@/components/TransportReportPreviewDialog";
import OperationLivePanel from "@/components/admin/OperationLivePanel";
import type { OperationStep } from "@/lib/operationLiveLog";
import {
  applyGeocodeResultsToTransportBoard,
  build2026MappointRouteTemplate,
  collectTransportAddressesNeedingGeocode,
  fixBoardAddressesFromEnrollment,
  loadEnrolledCampersForTransport,
  loadStopsOnlyTemplateFromSeason,
  normalizeTransportBoardForSeason,
  prepareBoardForPersist,
  transportBoardSeasonSyncChanged,
  type TransportRoutesSource,
} from "@/lib/transportRoster";
import {
  applyHistoricalAssignments,
  assignCampersDuringOptimize,
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
import { normalizeTransportAddress as normalizeAddress } from "@/lib/transportAddressNormalize";
import {
  consolidateRouteStopsByAddress,
  sanitizeRouteStops,
} from "@/lib/transportRouteStops";
import { optimizeStopsFromFirstStop, optimizeStopsWithPinned } from "@/lib/transportRouteOptimize";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { campminderIntegrationEnabled, isNestSandboxCompany } from "@/lib/camps";
import { SANDBOX_TRANSPORT_BOARD_SEASON } from "@/lib/nestSandboxTransport";
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
  haversineLegMinutesFromCoords,
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

type TransportLiveLogState = {
  visible: boolean;
  active: boolean;
  title: string;
  steps: OperationStep[];
  progressPct: number;
  subtitle?: string;
};

/** ISO timestamp for OperationLivePanel (date-fns `format(new Date(at))`). */
const transportLogAt = () => new Date().toISOString();

const transportLogTime = () =>
  new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });

const upsertTransportOpStep = (steps: OperationStep[], step: OperationStep): OperationStep[] => {
  const index = steps.findIndex((s) => s.id === step.id);
  if (index < 0) return [...steps, step];
  const next = [...steps];
  next[index] = { ...next[index], ...step };
  return next;
};

const geocodeFailureMessage = (result: GeocodeResult | null, address: string) =>
  result && "error" in result
    ? `${result.message || result.error} (${address})`
    : `could not geocode "${address}"`;

const UNPLOTTED_COLOR = "#8b5cf6";

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
    return {
      merged: false,
      next: consolidateRouteStopsByAddress([...stops, newStop]),
      mergedNames: newNames.length > 1 ? newNames : null,
    };
  }

  const existing = stops[idx];
  const existingNames =
    existing.camperNames?.length
      ? existing.camperNames
      : (existing.passengers ?? 0) > 0
        ? [existing.name].filter(Boolean)
        : [];
  const uniqueAdd = newNames.filter(
    (n) => !existingNames.some((e) => e.trim().toLowerCase() === n.trim().toLowerCase()),
  );
  if (uniqueAdd.length === 0) {
    return {
      merged: true,
      next: consolidateRouteStopsByAddress(stops),
      mergedNames: existingNames.length > 1 ? existingNames : null,
    };
  }

  const mergedNames = [...existingNames, ...uniqueAdd];
  const updated: RouteStop = {
    ...existing,
    passengers: mergedNames.length,
    camperNames: mergedNames,
    name:
      mergedNames.length === 1
        ? mergedNames[0]
        : `${mergedNames[0]} +${mergedNames.length - 1}`,
  };
  const next = [...stops];
  next[idx] = updated;
  return {
    merged: true,
    next: consolidateRouteStopsByAddress(next),
    mergedNames: mergedNames.length > 1 ? mergedNames : null,
  };
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
const ROUTE_LEG_CACHE_KEY = "transport-route-leg-cache-v1";
const OPTIMIZE_UNDO_KEY = "transport-optimize-undo-v1";

type OptimizeUndoSnapshot = {
  coreStops: Record<number, RouteStop[]>;
  unplottedCampers: UnplottedCamper[];
  description: string;
  savedAt: number;
};

const loadPersistedOptimizeUndoStack = (): OptimizeUndoSnapshot[] => {
  try {
    const raw = sessionStorage.getItem(OPTIMIZE_UNDO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OptimizeUndoSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistOptimizeUndoStack = (stack: OptimizeUndoSnapshot[]) => {
  try {
    if (stack.length === 0) sessionStorage.removeItem(OPTIMIZE_UNDO_KEY);
    else sessionStorage.setItem(OPTIMIZE_UNDO_KEY, JSON.stringify(stack));
  } catch {
    // ignore quota errors
  }
};

const loadPersistedRouteLegCache = (): Record<string, number[]> => {
  try {
    const raw = sessionStorage.getItem(ROUTE_LEG_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const persistRouteLegCache = (cache: Record<string, number[]>) => {
  try {
    sessionStorage.setItem(ROUTE_LEG_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
};

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
  /** Per-camper AM/PM bus (mini day, AM-only, PM-only). Key: normalized camper name. */
  camperBusRunSchedules?: CamperBusRunSchedules;
  settings?: TransportBoardSettings;
  routesConfigured?: boolean;
  routesSeason?: string;
  routesSource?: TransportRoutesSource;
  routesDraftMode?: boolean;
  routesConfirmed?: boolean;
};

const confirmedBoardCacheKey = (companyId: string, season: string) =>
  `transport-confirmed-board-v1:${companyId}:${season}`;

const loadConfirmedBoardSnapshot = (companyId: string, season: string): BoardPayload | null => {
  try {
    const key = confirmedBoardCacheKey(companyId, season);
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardPayload;
    if (!parsed?.coreStops || !Array.isArray(parsed.routeMeta)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistConfirmedBoardSnapshot = (companyId: string, season: string, payload: BoardPayload) => {
  try {
    const serialized = JSON.stringify(payload);
    const key = confirmedBoardCacheKey(companyId, season);
    localStorage.setItem(key, serialized);
    sessionStorage.setItem(key, serialized);
  } catch {
    // ignore quota errors
  }
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
  { name: "Master Change Sheet", desc: "All buses or pick specific buses — absences, changes, and attendance", href: "/day-camp/change-sheets" },
  { name: "Transport Exceptions", desc: "Absences, swim, office changes, and manual route edits for this date" },
  { name: "Bus Bubble Sheet", desc: "Per bus: AM & PM bubbles per camper. X = not on that run (mini day, PM-only, or today’s exception)" },
  { name: "Group Bubble Sheet", desc: "Everyone enrolled in the group this week. Exceptions are never removed" },
  { name: "Digital Attendance Log", desc: "Export Present/Absent saved in Bus Attendance for this date & run" },
  { name: "Bus Report", desc: "Day camp bus assignments" },
  { name: "Bus Route Summary", desc: "Route overview with stops" },
  { name: "Car Seat Count by Bus", desc: "Nursery & Pre-K riders per bus (car seats required)" },
  { name: "Car Report", desc: "All parent transport (PT) campers — with or without a bus assignment" },
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
  const campMinderTransportToolsEnabled = campminderIntegrationEnabled(currentCompany);
  const sandboxTransport = isNestSandboxCompany(currentCompany?.slug);

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
  const [camperBusRunSchedules, setCamperBusRunSchedules] = useState<CamperBusRunSchedules>({});
  const [busRunScheduleOpen, setBusRunScheduleOpen] = useState(false);
  const [busRunScheduleSearch, setBusRunScheduleSearch] = useState("");
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
  const [routesDraftMode, setRoutesDraftMode] = useState(false);
  const [routesConfirmed, setRoutesConfirmed] = useState(false);
  const [addRouteOpen, setAddRouteOpen] = useState(false);
  const [addCamperOpen, setAddCamperOpen] = useState(false);
  const [reportPreview, setReportPreview] = useState<TransportReportPreview | null>(null);
  const [newUnplotted, setNewUnplotted] = useState({ name: "", address: "", age: 10, session: "Session 1" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busListScrollRef = useRef<HTMLDivElement>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [newRoute, setNewRoute] = useState({ name: "", bus: "", departure: "", capacity: 50 });
  const [visibleRoutes, setVisibleRoutes] = useState<number[]>([]);
  const [focusedSidebarRouteId, setFocusedSidebarRouteId] = useState<number | null>(null);
  const [busSidebarSearch, setBusSidebarSearch] = useState("");
  const mapDefaultRoutesAppliedRef = useRef(false);
  const [timeOfDay, setTimeOfDay] = useState<"am" | "pm">("am");
  const [boardSettings, setBoardSettings] = useState<TransportBoardSettings>(
    () => ({ ...DEFAULT_TRANSPORT_BOARD_SETTINGS }),
  );
  const [routeLegMinutesCache, setRouteLegMinutesCache] = useState<Record<string, number[]>>(
    loadPersistedRouteLegCache,
  );
  const [optimizing, setOptimizing] = useState(false);
  const [applyingHistorical, setApplyingHistorical] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
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
  /** Active-season camper names from `children` — map filter source of truth (not only group roster). */
  const [seasonEnrolledNameKeys, setSeasonEnrolledNameKeys] = useState<Set<string>>(() => new Set());
  const [enrollmentWeekCalendar, setEnrollmentWeekCalendar] = useState<EnrollmentWeekCalendar>([]);
  const [routeEnrollmentWeek, setRouteEnrollmentWeek] = useState<number | "all">("all");
  const [attendanceWeekOverride, setAttendanceWeekOverride] = useState<number | null>(null);
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
    perRoute: {
      id: number;
      name: string;
      bus: string;
      beforeMi: number;
      afterMi: number;
      beforeStops: number;
      afterStops: number;
      changed: boolean;
      addedCampers: string[];
    }[];
    selectedRouteIds: number[];
  }>({ open: false, proposedCore: {}, proposedUnplotted: [], beforeMiles: 0, afterMiles: 0, reassignments: [], reorderedRoutes: 0, perRoute: [], selectedRouteIds: [] });

  const [optimizeUndoStack, setOptimizeUndoStack] = useState<OptimizeUndoSnapshot[]>(
    loadPersistedOptimizeUndoStack,
  );

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
    camperBusRunSchedules: {} as CamperBusRunSchedules,
    boardSettings: DEFAULT_TRANSPORT_BOARD_SETTINGS,
    routesConfigured: false,
    routesSource: undefined as TransportRoutesSource | undefined,
    routesDraftMode: false,
    routesConfirmed: false,
  });

  boardStateRef.current = {
    coreStops,
    routeMeta,
    unplottedCampers,
    parentTransportCampers,
    camperBusRunSchedules,
    boardSettings,
    routesConfigured,
    routesSource,
    routesDraftMode,
    routesConfirmed,
  };

  const draftModeAvailable = currentSeason !== "2026" && routesConfigured;
  const hasDraftBaseline = Boolean(companyId && currentSeason && loadConfirmedBoardSnapshot(companyId, currentSeason));

  const buildBoardPayload = useCallback((
    overrides: Partial<BoardPayload> = {},
  ): BoardPayload => {
    const draft: BoardPayload = {
      coreStops,
      routeMeta,
      unplottedCampers,
      parentTransportCampers,
      camperBusRunSchedules,
      settings: boardSettings,
      routesConfigured,
      routesSeason: routesConfigured ? currentSeason : undefined,
      routesSource,
      routesDraftMode,
      routesConfirmed,
      ...overrides,
    };
    const consolidatedCore: Record<number, RouteStop[]> = {};
    for (const [routeId, stops] of Object.entries(draft.coreStops ?? {})) {
      consolidatedCore[Number(routeId)] = sanitizeRouteStops(stops ?? []);
    }
    return { ...draft, coreStops: consolidatedCore };
  }, [coreStops, routeMeta, unplottedCampers, parentTransportCampers, camperBusRunSchedules, boardSettings, routesConfigured, routesSource, routesDraftMode, routesConfirmed, currentSeason]);

  const markRoutesConfigured = useCallback((source: TransportRoutesSource = "manual") => {
    setRoutesConfigured(true);
    setRoutesSource(source);
  }, []);

  const enterRoutesDraftMode = async () => {
    if (!companyId || !currentSeason) return;
    if (routesDraftMode) {
      toast({
        title: "Already in draft mode",
        description: "Your test edits are safe. Confirm or Discard when you are done testing.",
      });
      return;
    }
    if (!routesConfigured) {
      toast({
        title: "Add routes first",
        description: "Apply a route template or add buses before entering draft mode.",
        variant: "destructive",
      });
      return;
    }
    const baseline = buildBoardPayload({ routesDraftMode: false, routesConfirmed });
    persistConfirmedBoardSnapshot(companyId, currentSeason, baseline);
    const payload: BoardPayload = {
      ...baseline,
      routesDraftMode: true,
      routesConfirmed: false,
    };
    setRoutesDraftMode(true);
    setRoutesConfirmed(false);
    await persistBoard(payload);
    toast({
      title: "Draft mode ON",
      description: "Purple banner stays visible until you Confirm or Discard. Your pre-draft routes are saved.",
    });
  };

  const discardRoutesDraft = async () => {
    if (!companyId || !currentSeason) return;
    const snapshot = loadConfirmedBoardSnapshot(companyId, currentSeason);
    if (!snapshot) {
      toast({
        title: "Nothing to restore",
        description: "No pre-draft snapshot found — use Confirm Routes to keep current edits instead.",
        variant: "destructive",
      });
      return;
    }
    const restored: BoardPayload = {
      ...snapshot,
      routesDraftMode: false,
      routesConfirmed: snapshot.routesConfirmed === true,
    };
    applyBoardPayload(restored);
    await persistBoard(restored);
    toast({ title: "Draft mode OFF", description: "Restored routes from before you entered draft mode." });
  };

  const confirmRoutesBoard = async () => {
    if (!companyId || !currentSeason) return;
    const payload = buildBoardPayload({ routesDraftMode: false, routesConfirmed: true });
    persistConfirmedBoardSnapshot(companyId, currentSeason, payload);
    setRoutesDraftMode(false);
    setRoutesConfirmed(true);
    await persistBoard(payload);
    toast({
      title: "Draft mode OFF — routes confirmed",
      description: "These routes are saved as your live board. Enter Draft Mode again anytime to experiment.",
    });
  };

  const persistBoard = useCallback(async (payload: BoardPayload) => {
    if (!companyId || !currentSeason) return false;
    const ref = boardStateRef.current;
    const complete: BoardPayload = {
      ...payload,
      parentTransportCampers: payload.parentTransportCampers ?? ref.parentTransportCampers,
      camperBusRunSchedules: payload.camperBusRunSchedules ?? ref.camperBusRunSchedules,
      settings: payload.settings ?? ref.boardSettings,
      routesDraftMode: payload.routesDraftMode ?? ref.routesDraftMode,
      routesConfirmed: payload.routesConfirmed ?? ref.routesConfirmed,
    };
    const marked = prepareBoardForPersist(complete, currentSeason);
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
        !marked.routesDraftMode &&
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
      const filtered = (stops ?? []).filter((stop) => {
        if (stop.address === CAMP_LOCATION.address) return true;
        if (isValidRouteCoordinate(stop.lat, stop.lng)) return true;
        return !!stop.address?.trim();
      });
      coreStops[Number(routeId)] = consolidateRouteStopsByAddress(filtered);
    }
    return { ...payload, coreStops };
  };

  const applyBoardPayload = (payload: BoardPayload, source?: "supabase" | "cache") => {
    const scrubbed = scrubBrokenPlacements(payload);
    const normalizedMeta = normalizeRouteMeta(scrubbed.routeMeta);
    const metaIdSet = new Set(normalizedMeta.map((r) => r.id));
    setCoreStops(scrubbed.coreStops);
    setRouteMeta(normalizedMeta);
    setVisibleRoutes((prev) => {
      if ((source === "supabase" || source === "cache") && normalizedMeta.length > 0) {
        mapDefaultRoutesAppliedRef.current = true;
        return normalizedMeta.map((r) => r.id);
      }
      const kept = prev.filter((id) => metaIdSet.has(id));
      if (!mapDefaultRoutesAppliedRef.current && normalizedMeta.length > 0) {
        mapDefaultRoutesAppliedRef.current = true;
        return normalizedMeta.map((r) => r.id);
      }
      if (kept.length > 0) return kept;
      if (prev.length === 0 && normalizedMeta.length > 0) {
        return normalizedMeta.map((r) => r.id);
      }
      return prev;
    });
    setUnplottedCampers(scrubbed.unplottedCampers);
    setParentTransportCampers(scrubbed.parentTransportCampers ?? []);
    setCamperBusRunSchedules(scrubbed.camperBusRunSchedules ?? {});
    setBoardSettings(normalizeTransportBoardSettings(scrubbed.settings));
    setRoutesConfigured(scrubbed.routesConfigured === true);
    setRoutesSource(scrubbed.routesSource);
    setRoutesDraftMode(scrubbed.routesDraftMode === true);
    setRoutesConfirmed(scrubbed.routesConfirmed === true);
    lastKnownStopCountRef.current = countBoardStops(scrubbed.coreStops);
    if (companyId && currentSeason) {
      persistBoardCache(companyId, currentSeason, prepareBoardForPersist(scrubbed, currentSeason));
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
    const isRemoteLoad = source === "supabase" || source === "cache";
    const fullPayload = isRemoteLoad
      ? payload
      : { ...buildBoardPayload(), ...payload };
    const enrolled = await loadEnrolledCampersForTransport(supabase, companyId, currentSeason);
    setSeasonEnrolledNameKeys(new Set(enrolled.map((c) => normCamperName(c.name))));
    const normalized = await normalizeTransportBoardForSeason(supabase, companyId, currentSeason, fullPayload);
    const strippedLegacyRoutes =
      currentSeason !== "2026"
      && countBoardStops(fullPayload.coreStops) > 0
      && !fullPayload.routesConfigured;
    const rosterSyncChanged = transportBoardSeasonSyncChanged(fullPayload, normalized);
    applyBoardPayload(normalized, source);
    if (strippedLegacyRoutes || rosterSyncChanged) {
      await persistBoard({
        ...normalized,
        ...(strippedLegacyRoutes
          ? {
              routesConfigured: false,
              routesSeason: undefined,
              routesSource: undefined,
            }
          : {}),
      });
    }
  }, [companyId, currentSeason, persistBoard, buildBoardPayload]);

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
            routesDraftMode: saved.routesDraftMode,
            routesConfirmed: saved.routesConfirmed,
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
    setSeasonEnrolledNameKeys(new Set());
  }, [companyId, currentSeason]);

  useEffect(() => {
    setAttendanceWeekOverride(null);
  }, [companyId, currentSeason, overrideDate]);

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

    const debounceMs = routesDraftMode ? 0 : 600;

    if (stopCount === 0) {
      if (debounceMs === 0) {
        void persistBoard(payload).then((ok) => {
          if (ok) lastKnownStopCountRef.current = 0;
        });
        return;
      }
      const handle = setTimeout(() => {
        void persistBoard(payload).then((ok) => {
          if (ok) lastKnownStopCountRef.current = 0;
        });
      }, debounceMs);
      return () => clearTimeout(handle);
    }

    if (debounceMs === 0) {
      void persistBoard(payload).then((ok) => {
        if (ok) lastKnownStopCountRef.current = countBoardStops(coreStops);
      });
      return;
    }

    const handle = setTimeout(() => {
      void persistBoard(payload).then((ok) => {
        if (ok) lastKnownStopCountRef.current = countBoardStops(coreStops);
      });
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [coreStops, routeMeta, unplottedCampers, parentTransportCampers, camperBusRunSchedules, boardSettings, routesConfigured, routesSource, routesDraftMode, routesConfirmed, persistLoaded, companyId, currentSeason, persistBoard, buildBoardPayload]);

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
        routesDraftMode: draftMode,
        routesConfirmed: confirmed,
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
        routesDraftMode: draftMode,
        routesConfirmed: confirmed,
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
    return consolidateRouteStopsByAddress(
      applyRouteOverrides(
        coreStops[routeId] || [],
        routeId,
        todayOverrides,
        excludedCampers,
      ),
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

  // Local drive-time estimates for pickup times — avoids dozens of route-optimizer calls on load.
  useEffect(() => {
    if (
      routesNeedingLegDurations.length === 0
      || boardLoading
      || !persistLoaded
      || applyingTemplate
      || applyingHistorical
    ) return;

    setRouteLegMinutesCache((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of routesNeedingLegDurations) {
        if (next[item.sig]) continue;
        next[item.sig] = haversineLegMinutesFromCoords(item.coords);
        changed = true;
      }
      if (changed) persistRouteLegCache(next);
      return changed ? next : prev;
    });
  }, [routesNeedingLegDurations, boardLoading, persistLoaded, applyingTemplate, applyingHistorical]);

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

  const seasonRosterNames = useMemo(() => {
    if (seasonEnrolledNameKeys.size > 0) return seasonEnrolledNameKeys;
    if (groupRoster.length > 0) {
      return new Set(groupRoster.map((c) => normCamperName(c.name)));
    }
    return new Set<string>();
  }, [seasonEnrolledNameKeys, groupRoster]);

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
        busRunSchedules: camperBusRunSchedules,
      }),
    [
      getEffectiveCore,
      parentTransportCampers,
      camperBusRunSchedules,
      overrideDate,
      timeOfDay,
      activeRouteEnrollmentWeek,
      camperEnrollmentLookup,
    ],
  );

  const displayRoutes = useMemo(() => {
    const seasonFiltered =
      seasonRosterNames.size > 0
        ? applySeasonRosterToRoutes(routes, seasonRosterNames)
        : routes;
    const withoutPtOnStops = applyParentTransportExclusionToRoutes(
      seasonFiltered,
      parentTransportCampers,
    );
    const filtered = applyEnrollmentWeekToRoutes(
      withoutPtOnStops,
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
    seasonRosterNames,
    activeRouteEnrollmentWeek,
    camperEnrollmentLookup,
    parentTransportCampers,
    overrideDate,
    timeOfDay,
  ]);

  const displayedRoutes = useMemo(
    () => displayRoutes.filter((r) => visibleRoutes.includes(r.id)),
    [displayRoutes, visibleRoutes],
  );

  const unplottedForWeek = useMemo(() => {
    const onSeasonRoster = filterUnplottedToSeasonRoster(unplottedCampers, seasonRosterNames);
    return filterUnplottedForWeek(onSeasonRoster, activeRouteEnrollmentWeek, camperEnrollmentLookup);
  }, [unplottedCampers, seasonRosterNames, activeRouteEnrollmentWeek, camperEnrollmentLookup]);

  type SidebarCamperHit = {
    routeId: number;
    bus: string;
    routeName: string;
    camperName: string;
    address: string;
  };

  const sidebarCamperHits = useMemo((): SidebarCamperHit[] => {
    const q = busSidebarSearch.trim().toLowerCase();
    if (!q) return [];
    const hits: SidebarCamperHit[] = [];
    for (const route of displayRoutes) {
      for (const stop of route.stops) {
        if (stop.address === CAMP_LOCATION.address) continue;
        const riders = stopRiderNames(stop);
        if (riders.length === 0) continue;
        const address = stop.address?.trim() ?? "";
        for (const camperName of riders) {
          if (
            camperName.toLowerCase().includes(q)
            || address.toLowerCase().includes(q)
          ) {
            hits.push({
              routeId: route.id,
              bus: route.bus,
              routeName: route.name,
              camperName,
              address,
            });
          }
        }
      }
    }
    return hits.sort((a, b) => a.camperName.localeCompare(b.camperName));
  }, [busSidebarSearch, displayRoutes]);

  const sidebarUnplottedHits = useMemo(() => {
    const q = busSidebarSearch.trim().toLowerCase();
    if (!q) return [];
    return unplottedForWeek.filter(
      (c) =>
        c.name.toLowerCase().includes(q)
        || (c.address?.toLowerCase().includes(q) ?? false),
    );
  }, [busSidebarSearch, unplottedForWeek]);

  const sidebarRoutesToRender = useMemo(() => {
    const q = busSidebarSearch.trim().toLowerCase();
    if (!q) return displayRoutes;
    const routeIds = new Set(sidebarCamperHits.map((h) => h.routeId));
    return displayRoutes.filter(
      (r) =>
        routeIds.has(r.id)
        || r.bus.toLowerCase().includes(q)
        || r.name.toLowerCase().includes(q),
    );
  }, [busSidebarSearch, displayRoutes, sidebarCamperHits]);

  const focusSidebarRoute = useCallback((routeId: number) => {
    setFocusedSidebarRouteId(routeId);
    setVisibleRoutes((prev) => {
      if (prev.includes(routeId)) return prev;
      return [...prev, routeId];
    });
  }, []);

  /** Keep wheel on the bus list (native momentum scroll); block map zoom when list cannot scroll further. */
  const handleBusListWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const root = busListScrollRef.current;
    if (!root) return;

    const nested = (e.target as HTMLElement).closest("[data-stop-list-scroll]");
    if (nested instanceof HTMLElement && root.contains(nested) && nested !== root) {
      const { scrollTop, scrollHeight, clientHeight } = nested;
      const dy = e.deltaY;
      if (dy > 0 && scrollTop + clientHeight < scrollHeight - 1) {
        e.stopPropagation();
        return;
      }
      if (dy < 0 && scrollTop > 0) {
        e.stopPropagation();
        return;
      }
    }

    const { scrollTop, scrollHeight, clientHeight } = root;
    const max = scrollHeight - clientHeight;
    if (max <= 0) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const dy = e.deltaY;
    const atTop = scrollTop <= 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

    if ((dy < 0 && atTop) || (dy > 0 && atBottom)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    e.stopPropagation();
  }, []);

  const parentTransportForWeek = useMemo(() => {
    if (activeRouteEnrollmentWeek == null) return parentTransportCampers;
    return parentTransportCampers.filter((c) =>
      camperEnrolledInWeekByLookup(
        camperEnrollmentLookup,
        c.name,
        activeRouteEnrollmentWeek,
        c.session,
      ),
    );
  }, [parentTransportCampers, activeRouteEnrollmentWeek, camperEnrollmentLookup]);

  const parentTransportByRoute = useMemo(() => {
    const map = new Map<number, ParentTransportCamper[]>();
    for (const camper of parentTransportForWeek) {
      if (!isParentTransportBusAssigned(camper)) continue;
      const list = map.get(camper.routeId) ?? [];
      list.push(camper);
      map.set(camper.routeId, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [parentTransportForWeek]);

  const parentTransportNoBusForWeek = useMemo(
    () => parentTransportForWeek.filter((c) => !isParentTransportBusAssigned(c)),
    [parentTransportForWeek],
  );

  const busRunScheduleEntries = useMemo(() => {
    const seen = new Set<string>();
    const rows: { name: string; bus: string; stopName: string }[] = [];
    for (const route of routeMeta) {
      for (const camper of campersOnRoute(route.id, coreStops[route.id] || [])) {
        const key = normCamperBusRunKey(camper.name);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ name: camper.name, bus: route.bus, stopName: camper.stopName });
      }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [routeMeta, coreStops]);

  const filteredBusRunScheduleEntries = useMemo(() => {
    const q = busRunScheduleSearch.trim().toLowerCase();
    if (!q) return busRunScheduleEntries;
    return busRunScheduleEntries.filter(
      (row) =>
        row.name.toLowerCase().includes(q)
        || row.bus.toLowerCase().includes(q)
        || row.stopName.toLowerCase().includes(q),
    );
  }, [busRunScheduleEntries, busRunScheduleSearch]);

  const setCamperBusRunMode = useCallback((name: string, mode: CamperBusRunMode) => {
    const key = normCamperBusRunKey(name);
    setCamperBusRunSchedules((prev) => {
      if (mode === "both") {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: mode };
    });
  }, []);

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
  const [regeocoding, setRegeocoding] = useState(false);
  const [fixingAddresses, setFixingAddresses] = useState(false);
  const [transportLiveLog, setTransportLiveLog] = useState<TransportLiveLogState | null>(null);

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
    if (
      !persistLoaded
      || boardLoading
      || importInProgressRef.current
      || applyingTemplate
      || applyingHistorical
      || geocodingBoard
      || fixingAddresses
      || regeocoding
    ) return;

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
  }, [persistLoaded, boardLoading, applyingTemplate, applyingHistorical, geocodingBoard, fixingAddresses, regeocoding, unplottedCampers, coreStops, geocodeBoardAddresses, toast]);

  const enrollmentWeekForReport = useMemo(
    () => attendanceEnrollmentWeek(enrollmentWeekCalendar, overrideDate, attendanceWeekOverride),
    [enrollmentWeekCalendar, overrideDate, attendanceWeekOverride],
  );

  const reportDateOutsideEnrollmentWeeks = useMemo(() => {
    if (enrollmentWeekForReport == null) return false;
    return enrollmentWeekForDate(enrollmentWeekCalendar, overrideDate) == null;
  }, [enrollmentWeekCalendar, enrollmentWeekForReport, overrideDate]);

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

  /** Toggle buses on the map. Show all → first card click focuses one bus; then add/remove individually. */
  const selectRouteOnMap = (id: number) => {
    setFocusedSidebarRouteId(id);
    setVisibleRoutes((prev) => {
      const allIds = routeMeta.map((r) => r.id);
      const allSelected = allIds.length > 0 && allIds.every((routeId) => prev.includes(routeId));

      if (allSelected) return [id];

      if (prev.includes(id)) return prev.filter((routeId) => routeId !== id);
      return [...prev, id];
    });
  };

  useEffect(() => {
    const q = busSidebarSearch.trim();
    if (!q) return;
    const first = sidebarCamperHits[0];
    if (first) focusSidebarRoute(first.routeId);
  }, [busSidebarSearch, sidebarCamperHits, focusSidebarRoute]);

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
          const merged = mergeCampersIntoStops([coreMatch], assignable);
          mergedNames = merged.mergedNames ?? (names.length > 1 ? names : null);
          const excludedAddrs = [...(prev.excluded[routeId] ?? [])];
          if (!excludedAddrs.includes(coreMatch.address)) {
            excludedAddrs.push(coreMatch.address);
          }
          const addedBase = existingAdded.filter(
            (s) => normalizeAddress(s.address) !== normalizeAddress(coreMatch.address),
          );
          const added = mergeCampersIntoStops([...addedBase, ...merged.next], []).next;
          return {
            ...prev,
            excluded: { ...prev.excluded, [routeId]: excludedAddrs },
            added: { ...prev.added, [routeId]: added },
          };
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
      routeId: "none",
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
    const routeId =
      newParentTransport.routeId === "none" || newParentTransport.routeId === ""
        ? null
        : parseInt(newParentTransport.routeId, 10);
    if (routeId != null && !routeMeta.some((r) => r.id === routeId)) {
      toast({ title: "Pick a valid bus", description: "Choose a bus from the list or select PT only (no bus).", variant: "destructive" });
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
    const newCamper: ParentTransportCamper = {
      id,
      childId: child.id,
      name: child.name,
      routeId,
      am: newParentTransport.am,
      pm: newParentTransport.pm,
      weekdays: newParentTransport.weekdays,
      notes: newParentTransport.notes.trim() || null,
    };
    const nextPt = [...parentTransportCampers, newCamper];
    setParentTransportCampers(nextPt);
    setCoreStops((prev) => stripParentTransportFromCoreStops(prev, nextPt));
    setUnplottedCampers((prev) => prev.filter((c) => c.name.trim().toLowerCase() !== child.name.trim().toLowerCase()));
    setAddParentTransportOpen(false);
    resetNewParentTransportForm();
    markRoutesConfigured("manual");
    toast({
      title: "Parent transport added",
      description: routeId == null
        ? `${child.name} added — PT only (Car Report, no bus).`
        : `${child.name} on ${routeMeta.find((r) => r.id === routeId)?.bus ?? `Bus ${routeId}`} for PT + bus reports.`,
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
    async (
      payload: BoardPayload,
    ): Promise<
      BoardPayload & {
        placedCount: number;
        skippedNoBus: number;
        skippedNoPrior: number;
        skippedNoCoords: number;
      }
    > => {
      if (!companyId || !currentSeason || payload.unplottedCampers.length === 0) {
        return { ...payload, placedCount: 0, skippedNoBus: 0, skippedNoPrior: 0, skippedNoCoords: 0 };
      }
      const priorMap =
        priorMapRef.current ?? (await loadCamperPriorMap(supabase, companyId, currentSeason));
      priorMapRef.current = priorMap;

      // Use roster/prior/bundled coords only — template stops supply lat/lng for most placements.
      const enrichedUnplotted = await enrichUnplottedCampersForHistoricalPlacement(
        payload.unplottedCampers,
        priorMap,
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
        for (const [routeId, stops] of Object.entries(nextCore)) {
          nextCore[Number(routeId)] = consolidateRouteStopsByAddress(stops ?? []);
        }
      }

      return {
        ...payload,
        coreStops: nextCore,
        unplottedCampers: result.unplottedCampers,
        placedCount: result.placed.length,
        skippedNoBus: result.skippedNoBus.length,
        skippedNoPrior: result.skippedNoPrior.length,
        skippedNoCoords: result.skippedNoCoords.length,
      };
    },
    [companyId, currentSeason],
  );

  const handleApplyRouteTemplate = async () => {
    if (!companyId) return;
    setApplyingTemplate(true);
    try {
      let templateStops: BoardPayload["coreStops"];
      let templateMeta: BoardPayload["routeMeta"];
      let routesSource: TransportRoutesSource = "manual";
      let templateDescription: string;

      if (sandboxTransport) {
        const fromSeed = await loadStopsOnlyTemplateFromSeason(
          supabase,
          companyId,
          SANDBOX_TRANSPORT_BOARD_SEASON,
          ROUTE_COLORS,
        );
        if (!fromSeed?.routeMeta.length) {
          toast({
            title: "Sandbox routes not seeded",
            description:
              "Run seed_nest_sandbox_demo_data.sql in Supabase — it loads 4 demo buses for the training camp only (not North Shore MapPoint).",
            variant: "destructive",
          });
          return;
        }
        templateStops = fromSeed.coreStops;
        templateMeta = fromSeed.routeMeta;
        templateDescription = `${templateMeta.length} demo buses restored from sandbox seed (stops only). MapPoint / North Shore templates are disabled here.`;
      } else {
        const mappoint = build2026MappointRouteTemplate(ROUTE_COLORS);
        templateStops = mappoint.coreStops;
        templateMeta = mappoint.routeMeta;
        routesSource = "mappoint2026";
        templateDescription = `${templateMeta.length} buses loaded (stops only). Click "Place Using Prior Routes" when you want returning campers assigned.`;
      }

      const normalized = await normalizeTransportBoardForSeason(
        supabase,
        companyId,
        currentSeason,
        buildBoardPayload({
          coreStops: templateStops,
          routeMeta: templateMeta,
          routesConfigured: true,
          routesSeason: currentSeason,
          routesSource,
        }),
      );

      const fastPayload: BoardPayload = buildBoardPayload({
        coreStops: normalized.coreStops,
        routeMeta: normalized.routeMeta,
        unplottedCampers: normalized.unplottedCampers,
        parentTransportCampers: normalized.parentTransportCampers,
        routesConfigured: true,
        routesSeason: currentSeason,
        routesSource,
      });

      await persistBoard(fastPayload);
      await finalizeBoardForSeason(fastPayload);
      void refreshReferenceStatus();

      toast({
        title: sandboxTransport ? "Sandbox demo routes restored" : "Route template applied",
        description: templateDescription,
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
    geocodeAttemptRef.current = "";
    try {
      const withLearned = await applyLearnedPlacementsToPayload(buildBoardPayload());

      const payload: BoardPayload = buildBoardPayload({
        coreStops: withLearned.coreStops,
        unplottedCampers: withLearned.unplottedCampers,
        routesConfigured: true,
        routesSeason: currentSeason,
        routesSource: routesSource ?? "manual",
      });

      await persistBoard(payload);
      await finalizeBoardForSeason(payload);
      void refreshReferenceStatus();

      const description = withLearned.placedCount > 0
        ? `${withLearned.placedCount} campers placed on prior buses · ${withLearned.unplottedCampers.length} still unplotted${withLearned.skippedNoBus ? ` · ${withLearned.skippedNoBus} prior bus not on board` : ""}`
        : [
            "No new placements this run.",
            withLearned.skippedNoPrior > 0 ? `${withLearned.skippedNoPrior} new campers (no 2026 route)` : null,
            withLearned.skippedNoCoords > 0 ? `${withLearned.skippedNoCoords} need a geocoded address` : null,
            withLearned.skippedNoBus > 0 ? `${withLearned.skippedNoBus} prior bus not on board` : null,
            `${withLearned.unplottedCampers.length} still unplotted`,
          ].filter(Boolean).join(" · ");

      toast({
        title: withLearned.placedCount > 0 ? "Prior routes applied" : "Prior routes — nothing new to place",
        description,
        variant: withLearned.placedCount > 0 ? "default" : "destructive",
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
  const handleFixAddressesFromEnrollment = async () => {
    if (!companyId) return;
    if (!campMinderTransportToolsEnabled) {
      toast({
        title: "CampMinder disabled",
        description: "Training sandbox uses demo addresses only — not live CampMinder enrollment.",
        variant: "destructive",
      });
      return;
    }
    setFixingAddresses(true);
    let fixLogSteps: OperationStep[] = [
      {
        id: "load-enrollment",
        label: "Loading CampMinder addresses from enrollment",
        status: "running",
        at: transportLogAt(),
      },
    ];
    setTransportLiveLog({
      visible: true,
      active: true,
      title: "Fix addresses from CampMinder",
      steps: fixLogSteps,
      progressPct: 8,
      subtitle: "Starting…",
    });

    try {
      const enrolled = await loadEnrolledCampersForTransport(supabase, companyId, currentSeason);
      fixLogSteps = upsertTransportOpStep(fixLogSteps, {
        id: "load-enrollment",
        label: "Loading CampMinder addresses from enrollment",
        status: "done",
        detail: `${enrolled.length} enrolled campers`,
        at: transportLogAt(),
      });
      fixLogSteps = upsertTransportOpStep(fixLogSteps, {
        id: "apply-text",
        label: "Updating route / unplotted addresses on board",
        status: "running",
        at: transportLogAt(),
      });
      setTransportLiveLog((prev) => prev && {
        ...prev,
        steps: [...fixLogSteps],
        progressPct: 22,
        subtitle: `Loaded ${enrolled.length} campers · ${transportLogTime()}`,
      });

      const fixed = fixBoardAddressesFromEnrollment({
        enrolled,
        coreStops,
        unplottedCampers,
      });

      if (fixed.fixedStopCount === 0 && fixed.fixedUnplottedCount === 0) {
        fixLogSteps = upsertTransportOpStep(fixLogSteps, {
          id: "apply-text",
          label: "Updating route / unplotted addresses on board",
          status: "done",
          detail: "Already matched CampMinder",
          at: transportLogAt(),
        });
        fixLogSteps = upsertTransportOpStep(fixLogSteps, {
          id: "complete",
          label: "Nothing to change",
          status: "done",
          at: transportLogAt(),
        });
        setTransportLiveLog({
          visible: true,
          active: false,
          title: "Fix addresses from CampMinder",
          steps: fixLogSteps,
          progressPct: 100,
          subtitle: `Finished ${transportLogTime()}`,
        });
        toast({
          title: "Addresses already match CampMinder",
          description: "No route or unplotted addresses needed updating.",
        });
        return;
      }

      let nextUnplotted = fixed.unplottedCampers;
      let nextCoreStops = fixed.coreStops;
      const addresses = collectTransportAddressesNeedingGeocode(
        nextUnplotted,
        nextCoreStops,
        CAMP_LOCATION.address,
      );

      fixLogSteps = upsertTransportOpStep(fixLogSteps, {
        id: "apply-text",
        label: "Updating route / unplotted addresses on board",
        status: "done",
        detail: `${fixed.fixedStopCount} camper address(es) · ${fixed.splitStopCount} shared stop(s) split · ${fixed.fixedUnplottedCount} unplotted`,
        at: transportLogAt(),
      });
      fixLogSteps = upsertTransportOpStep(fixLogSteps, {
        id: "save-board",
        label: "Saving board to database",
        status: "running",
        at: transportLogAt(),
      });
      setTransportLiveLog((prev) => prev && {
        ...prev,
        steps: [...fixLogSteps],
        progressPct: 35,
        subtitle: `Text updated · saving… · ${transportLogTime()}`,
      });

      setUnplottedCampers(nextUnplotted);
      setCoreStops(nextCoreStops);
      await persistBoard(buildBoardPayload({
        coreStops: nextCoreStops,
        unplottedCampers: nextUnplotted,
      }));

      fixLogSteps = upsertTransportOpStep(fixLogSteps, {
        id: "save-board",
        label: "Saving board to database",
        status: "done",
        at: transportLogAt(),
      });

      if (addresses.length > 0) {
        seedGeocodeCacheFromBundled(geocodeCacheRef.current);
        fixLogSteps = upsertTransportOpStep(fixLogSteps, {
          id: "geocode",
          label: "Geocoding map pins (slow mode)",
          status: "running",
          detail: `0 / ${addresses.length} unique addresses`,
          at: transportLogAt(),
        });
        setTransportLiveLog((prev) => prev && {
          ...prev,
          steps: [...fixLogSteps],
          progressPct: 40,
          subtitle: `${addresses.length} addresses need pins · ${transportLogTime()}`,
        });

        const resolved = new Map<string, { lat: number; lng: number }>();
        const BATCH = 12;
        const batchTotal = Math.ceil(addresses.length / BATCH);
        for (let start = 0; start < addresses.length; start += BATCH) {
          const batchIndex = Math.floor(start / BATCH) + 1;
          const slice = addresses.slice(start, start + BATCH);
          fixLogSteps = upsertTransportOpStep(fixLogSteps, {
            id: "geocode",
            label: "Geocoding map pins (slow mode)",
            status: "running",
            detail: `Batch ${batchIndex}/${batchTotal} · ${Math.min(start + BATCH, addresses.length)}/${addresses.length} addresses`,
            at: transportLogAt(),
          });
          const pct = 40 + Math.round((Math.min(start + BATCH, addresses.length) / addresses.length) * 55);
          setTransportLiveLog((prev) => prev && {
            ...prev,
            steps: [...fixLogSteps],
            progressPct: pct,
            subtitle: `Batch ${batchIndex}/${batchTotal} — if this time stops updating for 3+ min, check route-optimizer logs · ${transportLogTime()}`,
          });

          const results = await geocodeBatch(slice, 1, () => {});
          slice.forEach((address, i) => {
            const r = results[i];
            if (isGeocodePoint(r)) {
              resolved.set(address.trim().toLowerCase(), { lat: r.lat, lng: r.lng });
            }
          });
          const applied = applyGeocodeResultsToTransportBoard(
            nextUnplotted,
            nextCoreStops,
            resolved,
            CAMP_LOCATION.address,
          );
          nextUnplotted = applied.unplotted;
          nextCoreStops = applied.coreStops;
          setUnplottedCampers(nextUnplotted);
          setCoreStops(nextCoreStops);
          if (start + BATCH < addresses.length) {
            fixLogSteps = upsertTransportOpStep(fixLogSteps, {
              id: "geocode-wait",
              label: "Pausing between batches (rate limit protection)",
              status: "running",
              detail: "2.5s",
              at: transportLogAt(),
            });
            setTransportLiveLog((prev) => prev && {
              ...prev,
              steps: [...fixLogSteps],
              subtitle: `Waiting 2.5s before batch ${batchIndex + 1}/${batchTotal} · ${transportLogTime()}`,
            });
            await new Promise((r) => setTimeout(r, 2500));
            fixLogSteps = fixLogSteps.filter((s) => s.id !== "geocode-wait");
          }
        }
        fixLogSteps = upsertTransportOpStep(fixLogSteps, {
          id: "geocode",
          label: "Geocoding map pins (slow mode)",
          status: "done",
          detail: `${resolved.size} of ${addresses.length} resolved`,
          at: transportLogAt(),
        });
        fixLogSteps = upsertTransportOpStep(fixLogSteps, {
          id: "save-geocode",
          label: "Saving geocoded pins",
          status: "running",
          at: transportLogAt(),
        });
        setTransportLiveLog((prev) => prev && { ...prev, steps: [...fixLogSteps], progressPct: 96 });

        persistGeocodeCache(geocodeCacheRef.current);
        await persistBoard(buildBoardPayload({
          coreStops: nextCoreStops,
          unplottedCampers: nextUnplotted,
        }));
        fixLogSteps = upsertTransportOpStep(fixLogSteps, {
          id: "save-geocode",
          label: "Saving geocoded pins",
          status: "done",
          at: transportLogAt(),
        });
      }

      const stillPending = collectTransportAddressesNeedingGeocode(
        nextUnplotted,
        nextCoreStops,
        CAMP_LOCATION.address,
      );
      fixLogSteps = upsertTransportOpStep(fixLogSteps, {
        id: "complete",
        label: stillPending.length > 0 ? "Finished with pending pins" : "All done",
        status: stillPending.length > 0 ? "error" : "done",
        detail: stillPending.length > 0
          ? `${stillPending.length} address(es) still need geocode — try Re-geocode All`
          : "Board matches CampMinder and pins are plotted",
        at: transportLogAt(),
      });
      setTransportLiveLog({
        visible: true,
        active: false,
        title: "Fix addresses from CampMinder",
        steps: fixLogSteps,
        progressPct: 100,
        subtitle: `Finished ${transportLogTime()}`,
      });

      toast({
        title: stillPending.length > 0 ? "Addresses updated — some pins pending" : "CampMinder addresses applied",
        description: stillPending.length > 0
          ? `${fixed.fixedStopCount} stop text fixed · ${stillPending.length} address(es) still need geocode — click Re-geocode All Placements or retry Fix in a few minutes.`
          : `${fixed.fixedStopCount} route stop(s) · ${fixed.fixedUnplottedCount} unplotted camper(s) updated.`,
        variant: stillPending.length > 0 ? "destructive" : "default",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      fixLogSteps = upsertTransportOpStep(fixLogSteps, {
        id: "failed",
        label: "Address fix failed",
        status: "error",
        detail: message,
        at: transportLogAt(),
      });
      setTransportLiveLog({
        visible: true,
        active: false,
        title: "Fix addresses from CampMinder",
        steps: fixLogSteps,
        progressPct: 100,
        subtitle: `Failed ${transportLogTime()}`,
      });
      toast({
        title: "Address fix failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setFixingAddresses(false);
    }
  };

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
    let regeoSteps: OperationStep[] = [{
      id: "regeo-run",
      label: "Re-geocoding all placements",
      status: "running",
      detail: `${addresses.length} unique addresses`,
      at: transportLogAt(),
    }];
    setTransportLiveLog({
      visible: true,
      active: true,
      title: "Re-geocode all placements",
      steps: regeoSteps,
      progressPct: 15,
      subtitle: `Calling geocoder · ${transportLogTime()}`,
    });
    geocodeCacheRef.current.clear();
    try { localStorage.removeItem(GEOCODE_CACHE_KEY); } catch { /* ignore */ }
    toast({ title: "Re-geocoding placements", description: `Checking ${addresses.length} address${addresses.length === 1 ? "" : "es"}…` });

    try {
      const results = await geocodeBatch(addresses, 6, (index) => {
        if (index % 5 !== 0 && index !== addresses.length - 1) return;
        regeoSteps = upsertTransportOpStep(regeoSteps, {
          id: "regeo-run",
          label: "Re-geocoding all placements",
          status: "running",
          detail: `${index + 1} / ${addresses.length} addresses`,
          at: transportLogAt(),
        });
        setTransportLiveLog((prev) => prev && {
          ...prev,
          steps: [...regeoSteps],
          progressPct: 15 + Math.round(((index + 1) / addresses.length) * 80),
          subtitle: `Still running — last update ${transportLogTime()}`,
        });
      });
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

      regeoSteps = upsertTransportOpStep(regeoSteps, {
        id: "regeo-run",
        label: "Re-geocoding all placements",
        status: failed > 0 ? "error" : "done",
        detail: `${moved} pins moved · ${addresses.length - failed} matched${failed ? ` · ${failed} failed` : ""}`,
        at: transportLogAt(),
      });
      setTransportLiveLog({
        visible: true,
        active: false,
        title: "Re-geocode all placements",
        steps: regeoSteps,
        progressPct: 100,
        subtitle: `Finished ${transportLogTime()}`,
      });

      toast({
        title: "Re-geocode complete",
        description: `${moved} pin${moved === 1 ? "" : "s"} repositioned · ${addresses.length - failed} matched${failed ? ` · ${failed} could not be geocoded` : ""}.`,
      });
    } catch (e: any) {
      regeoSteps = upsertTransportOpStep(regeoSteps, {
        id: "regeo-run",
        label: "Re-geocoding all placements",
        status: "error",
        detail: e?.message || String(e),
        at: transportLogAt(),
      });
      setTransportLiveLog({
        visible: true,
        active: false,
        title: "Re-geocode all placements",
        steps: regeoSteps,
        progressPct: 100,
        subtitle: `Failed ${transportLogTime()}`,
      });
      toast({ title: "Re-geocode failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setRegeocoding(false);
    }
  };

  /** Unmap all campers — empty every route, campers go back to purple map pins. */
  const handleUnmapAllCampers = useCallback(() => {
    let nextUnplotted = [...unplottedCampers];
    let restoredCount = 0;

    for (const stops of Object.values(coreStops)) {
      for (const stop of stops ?? []) {
        if (stop.address === CAMP_LOCATION.address) continue;
        const before = nextUnplotted.length;
        nextUnplotted = [
          ...nextUnplotted,
          ...restoreStopCampersToUnplotted(stop, nextUnplotted, groupRoster),
        ];
        restoredCount += nextUnplotted.length - before;
      }
    }

    const emptyCore: Record<number, RouteStop[]> = {};
    routeMeta.forEach((r) => {
      emptyCore[r.id] = [];
    });

    setUnplottedCampers(nextUnplotted);
    setCoreStops(emptyCore);
    setTodayOverrides(emptyManualOverrides());
    overrideLoadedKeyRef.current = null;
    markRoutesConfigured("manual");

    toast({
      title: "Campers unmapped",
      description: `${restoredCount} camper${restoredCount === 1 ? "" : "s"} unmapped to purple pins · ${routeMeta.length} empty bus${routeMeta.length === 1 ? "" : "es"} — place them on routes yourselves, then optimize.`,
    });
  }, [unplottedCampers, coreStops, routeMeta, groupRoster, markRoutesConfigured, toast]);

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
      title: "Remove stop from route",
      description: `Remove "${stop.name}" from this route for today only, or permanently (both AM & PM, every day)?`,
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
          toast({ title: "Removed for today", description: `"${stop.name}" removed from today's run only.` });
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

  const pinnedKeysForRoute = useCallback(
    (routeId: number) => boardSettings.pinnedStopsByRoute?.[routeId] ?? [],
    [boardSettings.pinnedStopsByRoute],
  );

  const isStopPinnedForOptimize = useCallback(
    (routeId: number, address: string) => {
      const key = normalizeAddress(address);
      return pinnedKeysForRoute(routeId).some((p) => normalizeAddress(p) === key);
    },
    [pinnedKeysForRoute],
  );

  const toggleStopPinForOptimize = useCallback((routeId: number, address: string) => {
    const key = normalizeAddress(address);
    if (!key) return;
    setBoardSettings((prev) => {
      const byRoute = { ...(prev.pinnedStopsByRoute ?? {}) };
      const list = [...(byRoute[routeId] ?? [])];
      const idx = list.findIndex((p) => normalizeAddress(p) === key);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(key);
      if (list.length === 0) delete byRoute[routeId];
      else byRoute[routeId] = list;
      return {
        ...prev,
        pinnedStopsByRoute: Object.keys(byRoute).length > 0 ? byRoute : undefined,
      };
    });
  }, []);

  const reorderRouteForOptimize = (
    stops: RouteStop[],
    options?: { fromFirstStop?: boolean; pinnedKeys?: string[] },
  ): RouteStop[] => {
    const consolidated = consolidateRouteStopsByAddress(stops);
    let pins = [...(options?.pinnedKeys ?? [])];
    if (options?.fromFirstStop && pins.length === 0 && consolidated[0]?.address) {
      pins = [normalizeAddress(consolidated[0].address)];
    }
    if (pins.length > 0) {
      return sanitizeRouteStops(optimizeStopsWithPinned(consolidated, pins));
    }
    if (options?.fromFirstStop) {
      return sanitizeRouteStops(optimizeStopsFromFirstStop(consolidated));
    }
    return sanitizeRouteStops(nearestNeighborOrder(consolidated));
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

  const defaultOptimizeSelectedRouteIds = (
    perRoute: { id: number; changed: boolean }[],
    focusRouteId?: number,
  ): number[] => {
    const ids = new Set<number>();
    if (focusRouteId != null) ids.add(focusRouteId);
    visibleRoutes.forEach((routeId) => ids.add(routeId));
    perRoute.filter((p) => p.changed).forEach((p) => ids.add(p.id));
    if (ids.size > 0) return [...ids];
    if (focusRouteId != null) return [focusRouteId];
    if (visibleRoutes.length > 0) return [...visibleRoutes];
    return perRoute.map((p) => p.id);
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

      // ─── Full-board optimize: reorder each bus locally + assign unplotted campers ───
      const proposedCore: Record<number, RouteStop[]> = {};
      const reassignments: { name: string; from: string; to: string }[] = [];

      if (targetRouteId !== undefined && options?.fromFirstStop) {
        const before = coreStops[targetRouteId] || [];
        const beforeConsolidated = consolidateRouteStopsByAddress(before);
        const assignResult = assignCampersDuringOptimize({
          coreStops: { ...coreStops, [targetRouteId]: beforeConsolidated },
          routeMeta,
          unplottedCampers,
          priorMap,
          limitToBusIds: [targetRouteId],
        });
        const withCampers = assignResult.coreStops[targetRouteId] ?? beforeConsolidated;
        const routeReassignments = assignResult.placed.map((p) => ({
          name: p.name,
          from: "Unplotted",
          to: routeMeta.find((r) => r.id === p.busNumber)?.bus || `Bus ${p.busNumber}`,
        }));
        const optimized = reorderRouteForOptimize(withCampers, {
          fromFirstStop: true,
          pinnedKeys: pinnedKeysForRoute(targetRouteId),
        });
        proposedCore[targetRouteId] = optimized;

        const meta = routeMeta.find((r) => r.id === targetRouteId);
        let beforeMiles = 0;
        let afterMiles = 0;
        let reorderedRoutes = 0;
        const beforeMi = routeMiles(before);
        const afterMi = routeMiles(optimized);
        beforeMiles = beforeMi;
        afterMiles = afterMi;
        const beforeSeq = beforeConsolidated.map((s) => s.address).join("|");
        const afterSeq = optimized.map((s) => s.address).join("|");
        const reordered = beforeSeq !== afterSeq && beforeConsolidated.length > 1;
        const addedCampers = assignResult.placed.map((p) => p.name);
        if (reordered || addedCampers.length > 0) reorderedRoutes = 1;

        setOptimizePreview({
          open: true,
          proposedCore,
          proposedUnplotted: assignResult.unplottedCampers,
          beforeMiles,
          afterMiles,
          reassignments: routeReassignments,
          reorderedRoutes,
          perRoute: [{
            id: targetRouteId,
            name: meta?.name || `Route ${targetRouteId}`,
            bus: meta?.bus || `Bus ${targetRouteId}`,
            beforeMi,
            afterMi,
            beforeStops: beforeConsolidated.length,
            afterStops: optimized.length,
            changed: reordered || beforeConsolidated.length !== optimized.length || addedCampers.length > 0,
            addedCampers,
          }],
          selectedRouteIds: [targetRouteId],
        });
        return;
      }

      // Single-bus optimize: assign unplotted campers to open stops, then reorder.
      if (targetRouteId !== undefined) {
        const before = coreStops[targetRouteId] || [];
        const beforeConsolidated = consolidateRouteStopsByAddress(before);
        const assignResult = assignCampersDuringOptimize({
          coreStops: { ...coreStops, [targetRouteId]: beforeConsolidated },
          routeMeta,
          unplottedCampers,
          priorMap,
          limitToBusIds: [targetRouteId],
        });
        const withCampers = assignResult.coreStops[targetRouteId] ?? beforeConsolidated;
        const routeReassignments = assignResult.placed.map((p) => ({
          name: p.name,
          from: "Unplotted",
          to: routeMeta.find((r) => r.id === p.busNumber)?.bus || `Bus ${p.busNumber}`,
        }));
        const optimized = reorderRouteForOptimize(withCampers, {
          pinnedKeys: pinnedKeysForRoute(targetRouteId),
        });
        proposedCore[targetRouteId] = optimized;

        const meta = routeMeta.find((r) => r.id === targetRouteId);
        const beforeMi = routeMiles(before);
        const afterMi = routeMiles(optimized);
        const beforeSeq = beforeConsolidated.map((s) => s.address).join("|");
        const afterSeq = optimized.map((s) => s.address).join("|");
        const reordered = beforeSeq !== afterSeq && beforeConsolidated.length > 1;
        const addedCampers = assignResult.placed.map((p) => p.name);

        setOptimizePreview({
          open: true,
          proposedCore,
          proposedUnplotted: assignResult.unplottedCampers,
          beforeMiles: beforeMi,
          afterMiles: afterMi,
          reassignments: routeReassignments,
          reorderedRoutes: reordered || addedCampers.length > 0 ? 1 : 0,
          perRoute: [{
            id: targetRouteId,
            name: meta?.name || `Route ${targetRouteId}`,
            bus: meta?.bus || `Bus ${targetRouteId}`,
            beforeMi,
            afterMi,
            beforeStops: beforeConsolidated.length,
            afterStops: optimized.length,
            changed: reordered || beforeMi !== afterMi || beforeConsolidated.length !== optimized.length || addedCampers.length > 0,
            addedCampers,
          }],
          selectedRouteIds: [targetRouteId],
        });
        return;
      }

      let remainingUnplotted: UnplottedCamper[] = [];
      targetRoutes.forEach((r) => {
        proposedCore[r.id] = consolidateRouteStopsByAddress(coreStops[r.id] || []);
      });

      const assignResult = assignCampersDuringOptimize({
        coreStops: proposedCore,
        routeMeta,
        unplottedCampers,
        priorMap,
      });
      Object.assign(proposedCore, assignResult.coreStops);
      remainingUnplotted = assignResult.unplottedCampers;
      reassignments.push(
        ...assignResult.placed.map((p) => ({
          name: p.name,
          from: "Unplotted",
          to: routeMeta.find((r) => r.id === p.busNumber)?.bus || `Bus ${p.busNumber}`,
        })),
      );

      targetRoutes.forEach((r) => {
        proposedCore[r.id] = reorderRouteForOptimize(proposedCore[r.id] ?? [], {
          pinnedKeys: pinnedKeysForRoute(r.id),
        });
      });
      if (priorMap.size > 0) {
        Object.assign(proposedCore, reorderStopsByHistoricalPriors(proposedCore, priorMap));
        targetRoutes.forEach((r) => {
          proposedCore[r.id] = reorderRouteForOptimize(proposedCore[r.id] ?? [], {
            pinnedKeys: pinnedKeysForRoute(r.id),
          });
        });
      }

      // Compute miles before/after using haversine for a fair comparison
      let beforeMiles = 0;
      let afterMiles = 0;
      let reorderedRoutes = 0;
      const perRoute: {
        id: number;
        name: string;
        bus: string;
        beforeMi: number;
        afterMi: number;
        beforeStops: number;
        afterStops: number;
        changed: boolean;
        addedCampers: string[];
      }[] = [];
      targetRoutes.forEach(r => {
        const before = coreStops[r.id] || [];
        const beforeConsolidated = consolidateRouteStopsByAddress(before);
        const afterStops = proposedCore[r.id] ?? [];
        const beforeMi = routeMiles(before);
        const afterMi = routeMiles(afterStops);
        beforeMiles += beforeMi;
        afterMiles += afterMi;
        const beforeAddrs = new Set(beforeConsolidated.map(s => s.address));
        const afterAddresses = afterStops.map(s => s.address);
        const afterSeq = afterAddresses.filter(address => beforeAddrs.has(address)).join("|");
        const beforeSeq = beforeConsolidated.map(s => s.address).join("|");
        const beforeSet = new Set(beforeConsolidated.map(s => s.address));
        const removedOrMoved = beforeConsolidated.some(s => !afterAddresses.includes(s.address));
        const reordered = (beforeSeq !== afterSeq && beforeConsolidated.length > 1) || removedOrMoved;
        const stopCountDrop = afterStops.length < beforeConsolidated.length;
        if (reordered) reorderedRoutes++;
        const placedOnRoute = assignResult.placed.filter((p) => p.busNumber === r.id).map((p) => p.name);
        const addedFromStops = afterStops
          .filter(s => !beforeSet.has(s.address))
          .flatMap(s => s.camperNames || [s.name]);
        const addedCampers = [...new Set([...placedOnRoute, ...addedFromStops])];
        perRoute.push({
          id: r.id, name: r.name, bus: r.bus,
          beforeMi, afterMi,
          beforeStops: beforeConsolidated.length,
          afterStops: afterStops.length,
          changed: reordered || addedCampers.length > 0 || stopCountDrop,
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
        selectedRouteIds: defaultOptimizeSelectedRouteIds(perRoute, targetRouteId),
      });

    } catch (e: any) {
      toast({ title: "Optimization failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setOptimizing(false);
    }
  };

  const applyOptimization = async () => {
    const selected = new Set(optimizePreview.selectedRouteIds);
    if (selected.size === 0) {
      toast({ title: "No routes selected", description: "Pick at least one route to apply.", variant: "destructive" });
      return;
    }

    const collapsedRoutes = optimizePreview.perRoute.filter(
      (p) => selected.has(p.id) && p.afterStops < p.beforeStops && p.beforeStops >= 3,
    );
    if (collapsedRoutes.length > 0) {
      toast({
        title: "Stop count would drop",
        description: `${collapsedRoutes.map((p) => p.bus).join(", ")} would lose stops — check preview before applying.`,
        variant: "destructive",
      });
      return;
    }

    const undoSnapshot: OptimizeUndoSnapshot = {
      coreStops: JSON.parse(JSON.stringify(coreStops)) as Record<number, RouteStop[]>,
      unplottedCampers: JSON.parse(JSON.stringify(unplottedCampers)) as UnplottedCamper[],
      description: `Before optimizing ${selected.size} route${selected.size === 1 ? "" : "s"}`,
      savedAt: Date.now(),
    };

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
        nextCore[p.id] = sanitizeRouteStops(proposed);
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

    setOptimizeUndoStack(prev => {
      const next = [...prev.slice(-4), undoSnapshot];
      persistOptimizeUndoStack(next);
      return next;
    });
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

    const payload: BoardPayload = buildBoardPayload({
      coreStops: nextCore,
      unplottedCampers: nextUnplotted,
      routesConfigured: true,
      routesSeason: currentSeason,
      routesSource: routesSource ?? "manual",
    });
    await persistBoard(payload);
    await finalizeBoardForSeason(payload);

    toast({
      title: `Optimized ${selected.size} route${selected.size === 1 ? "" : "s"}`,
      description: `Saved ${savedMi.toFixed(1)} mi/run · ${appliedReassignments} camper${appliedReassignments === 1 ? "" : "s"} assigned. Use Undo Optimization to revert.`,
    });
  };

  const handleUndoOptimization = async () => {
    const snapshot = optimizeUndoStack[optimizeUndoStack.length - 1];
    if (!snapshot) {
      toast({ title: "Nothing to undo", description: "No optimization has been applied yet this session.", variant: "destructive" });
      return;
    }

    setOptimizeUndoStack(prev => {
      const next = prev.slice(0, -1);
      persistOptimizeUndoStack(next);
      return next;
    });
    setCoreStops(snapshot.coreStops);
    setUnplottedCampers(snapshot.unplottedCampers);
    markRoutesConfigured("manual");
    setTodayOverrides(emptyManualOverrides());

    const payload: BoardPayload = buildBoardPayload({
      coreStops: snapshot.coreStops,
      unplottedCampers: snapshot.unplottedCampers,
      routesConfigured: true,
      routesSeason: currentSeason,
      routesSource: routesSource ?? "manual",
    });
    await persistBoard(payload);
    await finalizeBoardForSeason(payload);

    toast({
      title: "Optimization undone",
      description: snapshot.description,
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

    if (reportName === "Bus Bubble Sheet" || reportName === "Group Bubble Sheet") {
      let calendar = enrollmentWeekCalendar;
      let week = attendanceEnrollmentWeek(calendar, overrideDate, attendanceWeekOverride);
      if (week == null && companyId) {
        calendar = await loadEnrollmentWeekCalendar(supabase, companyId, currentSeason);
        setEnrollmentWeekCalendar(calendar);
        groupLoadedKeyRef.current = `${companyId}:${currentSeason}`;
        week = attendanceEnrollmentWeek(calendar, overrideDate, attendanceWeekOverride);
      }
      if (week == null) {
        toast({
          title: "Enrollment week required",
          description: "Set enrollment week calendar dates on Group Bubble Sheets before printing attendance sheets.",
          variant: "destructive",
        });
        return;
      }
      const weekRow = getEnrollmentWeekRow(calendar, week);
      const weekLabel = formatEnrollmentWeekLabel(week, calendar);

      if (reportName === "Group Bubble Sheet") {
        const rosterForWeek = groupRoster.filter((c) =>
          camperEnrolledInWeek(c.enrolledWeeks, c.session, week),
        );
        const groupMap = new Map<string, GroupRosterCamper[]>();
        for (const camper of rosterForWeek) {
          const list = groupMap.get(camper.groupName) ?? [];
          list.push(camper);
          groupMap.set(camper.groupName, list);
        }
        const groups = Array.from(groupMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([groupName, campers]) => ({
            groupName,
            campers: campers.map((c) => ({ name: c.name, detail: groupName })),
          }));
        const built = buildGroupBubbleSheetPdf({
          companyName: currentCompany?.name ?? "Day Camp",
          enrollmentWeek: week,
          weekDateRange: weekRow ? formatEnrollmentWeekRange(weekRow) : undefined,
          weekDays: enrollmentWeekDayColumns(weekRow),
          groups,
        });
        if (!built) {
          toast({ title: "No campers to print", variant: "destructive" });
        } else {
          openReportPreview({
            title: "Group Attendance Bubble Sheet",
            description: `${weekLabel} · enrolled campers only`,
            kind: "pdf",
            blob: built.blob,
            filename: built.filename,
          });
        }
        return;
      }

      const coreForRun = (routeId: number, period: "am" | "pm") =>
        consolidateRouteStopsByAddress(
          applyRouteOverrides(
            coreStops[routeId] || [],
            routeId,
            todayOverrides,
            excludedCamperSet(transportExceptions, period),
          ),
        );

      const mergedBusRoutes = buildBusBubbleSheetRoutes({
        routes: routeMeta.map((route) => ({
          id: route.id,
          bus: route.bus,
          routeName: route.name,
        })),
        baseCoreByRoute: (routeId) =>
          consolidateRouteStopsByAddress(coreStops[routeId] || []),
        coreForRun,
        schedules: camperBusRunSchedules,
        runDate: overrideDate,
        parentTransportCampers,
        enrollmentWeek: week,
        enrollmentLookup: camperEnrollmentLookup,
        includeCamper: (name) =>
          camperEnrolledInWeekByLookup(camperEnrollmentLookup, name, week),
      });

      const built = buildDayBusBubbleSheetPdf({
        companyName: currentCompany?.name ?? "Day Camp",
        date: overrideDate,
        enrollmentWeek: week,
        weekDateRange: weekRow ? formatEnrollmentWeekRange(weekRow) : undefined,
        routes: mergedBusRoutes,
      });
      if (!built) {
        toast({ title: "No campers to print", variant: "destructive" });
      } else {
        openReportPreview({
          title: "Bus Bubble Sheet",
          description: `${overrideDate} · AM & PM per camper (X = not on that run) · ${weekLabel}`,
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
        rows.push(["Camper Name", "Bus assignment", "Schedule", "AM", "PM", "Notes"]);
        parentTransportCampers.forEach((c) => {
          rows.push([
            c.name,
            parentTransportBusLabel(c, routeMeta),
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
  const totalCamperCount = assignedCamperCount + unplottedForWeek.length + parentTransportNoBusForWeek.length;

  const transportLiveLogPanel =
    transportLiveLog?.visible && !mapFullscreen ? (
      <OperationLivePanel
        title={transportLiveLog.title}
        subtitle={transportLiveLog.subtitle}
        steps={transportLiveLog.steps}
        active={transportLiveLog.active}
        progressPct={transportLiveLog.progressPct}
        onDismiss={
          transportLiveLog.active
            ? undefined
            : () => setTransportLiveLog(null)
        }
        className="shadow-lg bg-background/95 backdrop-blur-sm"
      />
    ) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 min-w-0">
      {transportLiveLogPanel && activeTransportTab !== "map" ? (
        <div className="fixed bottom-4 left-4 z-40 w-[min(100vw-2rem,22rem)] sm:left-6">
          {transportLiveLogPanel}
        </div>
      ) : null}
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
                    ({assignedCamperCount} on routes{parentTransportCountForWeek > 0 ? ` incl. ${parentTransportCountForWeek} PT` : ""}{parentTransportNoBusForWeek.length > 0 ? ` · ${parentTransportNoBusForWeek.length} PT-only` : ""} · {unplottedForWeek.length} unplotted
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
            {draftModeAvailable && (
              routesDraftMode ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap border-violet-500/60 bg-violet-500/15 text-violet-950 dark:text-violet-100"
                  title="Changes are sandboxed until you Confirm Routes or Discard Draft"
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-600" />
                  </span>
                  Draft mode ON
                </Badge>
              ) : routesConfirmed ? (
                <Badge
                  variant="outline"
                  className="gap-1 px-2.5 py-1 text-[10px] font-medium whitespace-nowrap border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                  title={`Routes confirmed for ${currentSeason} — enter Draft Mode to experiment safely`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Routes confirmed
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 px-2.5 py-1 text-[10px] font-normal whitespace-nowrap"
                  title="Live board — use Draft Mode before big changes"
                >
                  Live board
                </Badge>
              )
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleApplyRouteTemplate}
            disabled={applyingTemplate}
            title={
              sandboxTransport
                ? "Restore 4 demo buses from sandbox seed — never North Shore MapPoint"
                : "Load starter bus routes (stops only, no campers)"
            }
          >
            <LayoutTemplate className={`h-4 w-4 ${applyingTemplate ? "animate-pulse" : ""}`} />
            {applyingTemplate
              ? "Applying template…"
              : sandboxTransport
                ? "Reset sandbox routes (4 buses)"
                : "Apply Route Template"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleApplyHistoricalAssignments}
            disabled={applyingHistorical || unplottedCampers.length === 0}
            title={
              sandboxTransport
                ? "Place demo campers using this camp's own saved routes only (no MapPoint priors)"
                : "Place unplotted campers on buses from learned routing history"
            }
          >
            <History className={`h-4 w-4 ${applyingHistorical ? "animate-pulse" : ""}`} />
            {applyingHistorical
              ? "Placing from prior routes…"
              : sandboxTransport
                ? "Place demo campers on routes"
                : "Place Using Prior Routes"}
          </Button>
          {currentSeason !== "2026" && routesConfigured && !routesDraftMode && (
            <Button
              variant="outline"
              className="gap-2 border-violet-500/60 bg-violet-50 text-violet-950 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-100"
              onClick={() => void enterRoutesDraftMode()}
              title="Sandbox — test template, prior routes, and optimize without committing"
            >
              <FlaskConical className="h-4 w-4" />
              Draft Mode
            </Button>
          )}
          {currentSeason !== "2026" && routesDraftMode && (
            <>
              <Badge
                variant="outline"
                className="gap-1.5 h-9 px-3 text-xs font-semibold border-violet-500/60 bg-violet-500/15 text-violet-950 dark:text-violet-100 pointer-events-none"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Draft ON
              </Badge>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void discardRoutesDraft()}
                disabled={!hasDraftBaseline}
                title={hasDraftBaseline ? "Revert to routes from before Draft Mode" : "No saved snapshot — use Confirm Routes to keep current edits"}
              >
                <Undo2 className="h-4 w-4" />
                Discard Draft
              </Button>
              <Button
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => void confirmRoutesBoard()}
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Routes
              </Button>
            </>
          )}
          {optimizeUndoStack.length > 0 && (
            <Button
              variant="outline"
              className="gap-2 border-amber-500/70 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
              onClick={() => void handleUndoOptimization()}
              title={optimizeUndoStack[optimizeUndoStack.length - 1]?.description}
            >
              <Undo2 className="h-4 w-4" />
              Undo Optimization
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => setBulkImport(prev => ({ ...prev, open: true, log: { ok: 0, skipped: 0, failed: 0, messages: [] }, progress: { done: 0, total: 0 }, failedRows: [] }))}>
            <Upload className="h-4 w-4" /> Bulk Upload Addresses
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setAddCamperOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add Camper
          </Button>
          {campMinderTransportToolsEnabled ? (
            <Button
              variant="outline"
              className="gap-2 border-emerald-600/50 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100"
              onClick={() => void handleFixAddressesFromEnrollment()}
              disabled={fixingAddresses || regeocoding}
              title="Replace wrong route pins with home_address from CampMinder enrollment, then geocode"
            >
              <MapPin className={`h-4 w-4 ${fixingAddresses ? "animate-pulse" : ""}`} />
              {fixingAddresses ? "Fixing addresses…" : "Fix Addresses from CampMinder"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleRegeocodeAll}
            disabled={regeocoding || fixingAddresses}
            title="Re-run every camper and stop address through the latest geocoder"
          >
            <MapPin className={`h-4 w-4 ${regeocoding ? "animate-pulse" : ""}`} />
            {regeocoding ? "Re-geocoding…" : "Re-geocode All Placements"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2" title="Unmap every camper from buses — place them on routes yourselves">
                <MapPin className="h-4 w-4" /> Unmap All Campers
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unmap all campers?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every camper comes off the buses and goes back to the map as purple pins. Empty bus routes stay on the board so you can place campers on routes yourselves, then optimize.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleUnmapAllCampers}>
                  Unmap all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

        {draftModeAvailable && routesDraftMode && (
          <div className="sticky top-0 z-20 rounded-lg border-2 border-violet-500/50 bg-violet-500/10 px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
            <FlaskConical className="h-5 w-5 text-violet-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">
                Draft mode is ON — changes are not final
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Test optimize, drag campers, and reorder stops freely.
                {" "}
                <strong>Confirm Routes</strong> saves this board and turns draft OFF.
                {" "}
                <strong>Discard Draft</strong> restores routes from before you entered draft mode.
              </p>
              {!hasDraftBaseline && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Restore snapshot unavailable — confirm to keep edits, or re-enter Draft Mode after a refresh.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void discardRoutesDraft()}
                disabled={!hasDraftBaseline}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Discard
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => void confirmRoutesBoard()}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm
              </Button>
            </div>
          </div>
        )}

        {draftModeAvailable && routesConfirmed && !routesDraftMode && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>
              Routes confirmed for {currentSeason}. Edits save live — use <strong>Draft Mode</strong> to experiment without committing.
            </span>
          </div>
        )}
      </div>

      <Tabs
        value={activeTransportTab}
        onValueChange={setActiveTransportTab}
        className={`min-w-0 ${routesDraftMode && draftModeAvailable ? "rounded-xl ring-2 ring-violet-500/30 ring-offset-2 ring-offset-background p-0.5" : ""}`}
      >
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
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setBusRunScheduleOpen(true)}
            >
              <Clock className="h-3.5 w-3.5" />
              AM/PM bus schedule
              {Object.keys(camperBusRunSchedules).length > 0 ? (
                <Badge variant="secondary" className="text-[9px] px-1.5 ml-0.5">
                  {Object.keys(camperBusRunSchedules).length}
                </Badge>
              ) : null}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOptimizeRoutes()}
                disabled={optimizing}
                className="gap-1.5 text-xs border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <Sparkles className={`h-3.5 w-3.5 ${optimizing ? "animate-pulse" : ""}`} />
                {optimizing ? "Optimizing…" : "Optimize Routes"}
              </Button>
            </div>
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

          <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(340px,420px),1fr] lg:items-stretch">
            {/* Route sidebar — fixed height; wheel anywhere on list column scrolls bus cards */}
            <div
              className={`flex min-h-0 max-h-full flex-col overflow-hidden ${MAP_PANEL_HEIGHT[mapHeight]} lg:sticky lg:top-4`}
            >
              <div className="relative shrink-0 mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busSidebarSearch}
                  onChange={(e) => setBusSidebarSearch(e.target.value)}
                  placeholder="Find camper or address (e.g. Corn, Wood Lane)…"
                  className="h-9 pl-8 pr-8 text-xs"
                />
                {busSidebarSearch.trim() ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setBusSidebarSearch("")}
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {busSidebarSearch.trim() && sidebarCamperHits.length > 0 && (
                <div className="shrink-0 mb-2 space-y-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                    On a bus ({sidebarCamperHits.length})
                  </p>
                  {sidebarCamperHits.slice(0, 6).map((hit) => (
                    <button
                      key={`${hit.routeId}-${hit.camperName}-${hit.address}`}
                      type="button"
                      className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-background/80"
                      onClick={() => focusSidebarRoute(hit.routeId)}
                    >
                      <span className="font-semibold text-foreground">{hit.camperName}</span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {hit.bus}
                        {hit.routeName && hit.routeName !== hit.bus ? ` (${hit.routeName})` : ""}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">{hit.address}</span>
                    </button>
                  ))}
                  {sidebarCamperHits.length > 6 ? (
                    <p className="text-[10px] text-muted-foreground px-2">
                      +{sidebarCamperHits.length - 6} more — narrow your search
                    </p>
                  ) : null}
                </div>
              )}
              {busSidebarSearch.trim() && sidebarCamperHits.length === 0 && sidebarUnplottedHits.length > 0 && (
                <div className="shrink-0 mb-2 rounded-lg border border-violet-500/30 bg-violet-500/5 px-2.5 py-2 text-[11px]">
                  <p className="font-semibold text-violet-800 dark:text-violet-200">Not on a route — unplotted</p>
                  {sidebarUnplottedHits.map((c) => (
                    <p key={c.id} className="mt-1 text-muted-foreground">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.address ? ` · ${c.address}` : ""}
                    </p>
                  ))}
                </div>
              )}
              {busSidebarSearch.trim() && sidebarCamperHits.length === 0 && sidebarUnplottedHits.length === 0 && (
                <p className="shrink-0 mb-2 text-[11px] text-amber-800 dark:text-amber-200 px-0.5">
                  No match on routes or unplotted — try <strong>Corn</strong> (CampMinder spelling), not Korn.
                </p>
              )}
              <div
                ref={busListScrollRef}
                className="scroll-pane-polished flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain touch-pan-y"
                onWheel={handleBusListWheel}
              >
              <div className="sticky top-0 z-10 shrink-0 space-y-2 bg-background/95 pb-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
                <div className="flex items-center justify-between gap-2 px-0.5 pt-0.5">
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
                {visibleRoutes.length === 0 ? (
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 px-0.5">
                    Map hidden — click buses to add routes, or use Show all.
                  </p>
                ) : visibleRoutes.length === routeMeta.length ? (
                  <p className="text-[10px] text-muted-foreground px-0.5">
                    All buses on map — click a card to focus one bus, or Hide all.
                  </p>
                ) : visibleRoutes.length === 1 ? (
                  <p className="text-[10px] text-muted-foreground px-0.5">
                    Showing {displayRoutes.find((r) => r.id === visibleRoutes[0])?.bus ?? "1 bus"} — click another bus to add it to the map.
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground px-0.5">
                    {visibleRoutes.length} buses on map — click a card to add or remove.
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground px-0.5 flex items-center gap-1">
                  <Pin className="h-3 w-3 shrink-0 opacity-70" />
                  Scroll here to move through buses · pin stops before ✨ Optimize
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 pr-0.5 pb-4 pt-0.5">
              {sidebarRoutesToRender.map(r => {
                const isVisible = visibleRoutes.includes(r.id);
                const isFocused = focusedSidebarRouteId === r.id;
                const core = coreStops[r.id] || [];
                const ptOnRoute = parentTransportByRoute.get(r.id) ?? [];
                const ptActiveToday = ptOnRoute.filter((c) =>
                  isParentTransportScheduledForRun(c, overrideDate, timeOfDay),
                );
                return (
                  <Card
                    key={r.id}
                    id={`transport-bus-card-${r.id}`}
                    className={`cursor-pointer transition-[opacity,box-shadow,transform] duration-200 ease-out shrink-0 ${
                      isFocused
                        ? "ring-2 ring-primary shadow-md"
                        : isVisible
                          ? "ring-2 ring-primary/30"
                          : "opacity-50 hover:opacity-70"
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
                                title={
                                  pinnedKeysForRoute(r.id).length > 0
                                    ? `Optimize — ${pinnedKeysForRoute(r.id).length} pinned stop(s) stay put`
                                    : "Optimize this route (full reorder)"
                                }
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
                                title="Pin stop #1 and optimize the rest from that direction"
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
                          {pinnedKeysForRoute(r.id).length > 0 && (
                            <p className="text-[10px] text-primary/90 mt-1 flex items-center gap-1">
                              <Pin className="h-3 w-3 shrink-0 fill-current" />
                              {pinnedKeysForRoute(r.id).length} pinned — optimize reorders the rest
                            </p>
                          )}
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
                          data-stop-list-scroll
                          className={`scroll-pane-polished mt-2 pl-6 border-l-2 space-y-1.5 overflow-y-auto overscroll-y-contain pr-0.5 ${
                            isFocused || visibleRoutes.length <= 1
                              ? "max-h-[min(40vh,420px)]"
                              : "max-h-[120px]"
                          }`}
                          style={{ borderColor: r.color + "40" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.stops.map((stop, i) => {
                            const isCamp = stop.address === CAMP_LOCATION.address;
                            const stopLines = routeStopListLines(stop, {
                              isCamp,
                            });
                            const isDragging = reorderDrag?.routeId === r.id && reorderDrag.displayIndex === i;
                            const stopPinned = !isCamp && isStopPinnedForOptimize(r.id, stop.address);
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
                                } ${isDragging ? "opacity-40" : ""} ${stopPinned ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}
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
                                      className={
                                        isCamp
                                          ? "truncate font-medium text-foreground"
                                          : stopLines.isOpenStop && stopLines.camperNames.length === 0
                                            ? "truncate text-muted-foreground"
                                            : stopLines.camperNames.length > 1
                                              ? "font-medium text-foreground leading-tight break-words [overflow-wrap:anywhere]"
                                              : "truncate font-medium text-foreground"
                                      }
                                    >
                                      {stopLines.title}
                                    </p>
                                    {stopLines.camperNames.length > 1 && !stopLines.isOpenStop ? (
                                      <p className="text-[9px] text-muted-foreground/90 mt-0.5">
                                        {stopLines.camperNames.length} campers · same stop
                                      </p>
                                    ) : null}
                                    {stopLines.subtitle ? (
                                      <p
                                        className={`${
                                          stopLines.camperNames.length > 1 ? "break-words" : "truncate"
                                        } ${
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
                                <div className="flex items-center gap-1 shrink-0">
                                  {!isCamp && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleStopPinForOptimize(r.id, stop.address);
                                      }}
                                      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors ${
                                        stopPinned
                                          ? "text-primary bg-primary/10"
                                          : "text-muted-foreground hover:text-primary hover:bg-muted/60"
                                      }`}
                                      title={
                                        stopPinned
                                          ? "Pinned — click to allow optimize to move this stop"
                                          : "Pin this pickup — keep it here when optimizing"
                                      }
                                    >
                                      <Pin className={`h-3.5 w-3.5 ${stopPinned ? "fill-current" : ""}`} />
                                      <span className="text-[9px] font-medium">{stopPinned ? "Pinned" : "Pin"}</span>
                                    </button>
                                  )}
                                  {stop.pickupTime ? (
                                    <span className="text-muted-foreground whitespace-nowrap">{stop.pickupTime}</span>
                                  ) : null}
                                </div>
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
            </div>

            {/* Map */}
            <Card className="relative isolate overflow-visible shadow-sm">
              {transportLiveLogPanel ? (
                <div className="absolute bottom-3 left-3 z-[1002] w-[min(calc(100%-5.5rem),22rem)] pointer-events-auto">
                  {transportLiveLogPanel}
                </div>
              ) : null}
              <div className="absolute top-3 right-3 z-[1003] flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/95 p-1 shadow-md backdrop-blur-sm pointer-events-auto">
                <select
                  value={mapHeight}
                  onChange={(e) => setMapHeight(e.target.value as "sm" | "md" | "lg" | "xl")}
                  className="h-8 rounded-md border-0 bg-transparent px-2 text-xs font-medium focus:outline-none focus:ring-0"
                  title="Map height"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">X-Large</option>
                </select>
                <div className="h-5 w-px bg-border/60" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-xs font-medium hover:bg-muted/80"
                  onClick={() => setMapFullscreen(true)}
                  title="Expand to fullscreen"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Fullscreen
                </Button>
              </div>
              <div className={`${MAP_PANEL_HEIGHT[mapHeight]} w-full relative rounded-lg [&_.leaflet-container]:rounded-lg`}>
                {(boardLoading || companyLoading || authLoading) && (
                  <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-background/60 backdrop-blur-[1px] text-sm text-muted-foreground">
                    Loading saved board…
                  </div>
                )}
                <TransportRouteMap
                  routes={displayedRoutes}
                  allRoutes={routes}
                  campAddress={CAMP_LOCATION.address}
                  layoutReady={!boardLoading && !companyLoading && !authLoading}
                  onMoveStop={handleMoveStop}
                  onRemoveStop={handleRemoveStop}
                  unplottedCampers={unplottedForWeek}
                  onAssignCamper={handleAssignCamperToRoute}
                />
              </div>
            </Card>

            {/* Fullscreen map dialog */}
            <Dialog open={mapFullscreen} onOpenChange={setMapFullscreen}>
              <DialogContent
                className="!flex fixed inset-3 z-50 h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-xl border border-border/60 p-0 shadow-2xl sm:rounded-xl [&>button.absolute]:hidden"
              >
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/50 bg-gradient-to-r from-muted/50 via-background to-background px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
                      <MapIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-base font-semibold leading-tight sm:text-lg">
                        Transport route map
                      </DialogTitle>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                        {currentCompany?.name ?? "Camp"}
                        {" · "}
                        {currentSeason} season
                        {" · "}
                        {timeOfDay === "am" ? "AM pickup → camp" : "PM dropoff ← camp"}
                        {" · "}
                        {overrideDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="hidden h-7 px-2.5 text-xs font-medium sm:inline-flex">
                      {displayedRoutes.length} bus{displayedRoutes.length === 1 ? "" : "es"}
                    </Badge>
                    <Badge variant="outline" className="hidden h-7 px-2.5 text-xs font-medium md:inline-flex">
                      {unplottedForWeek.length} unplotted
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 bg-background/80 px-3 shadow-sm"
                      onClick={() => setMapFullscreen(false)}
                    >
                      <Minimize2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Exit fullscreen</span>
                      <span className="sm:hidden">Exit</span>
                    </Button>
                  </div>
                </div>
                <div className="relative min-h-0 flex-1 bg-muted/15">
                  {transportLiveLog?.visible ? (
                    <div className="absolute bottom-3 left-3 z-[60] w-[min(calc(100%-1.5rem),22rem)] pointer-events-auto">
                      <OperationLivePanel
                        title={transportLiveLog.title}
                        subtitle={transportLiveLog.subtitle}
                        steps={transportLiveLog.steps}
                        active={transportLiveLog.active}
                        progressPct={transportLiveLog.progressPct}
                        onDismiss={
                          transportLiveLog.active
                            ? undefined
                            : () => setTransportLiveLog(null)
                        }
                        className="shadow-lg bg-background/95 backdrop-blur-sm"
                      />
                    </div>
                  ) : null}
                  <TransportRouteMap
                    routes={displayedRoutes}
                    allRoutes={routes}
                    campAddress={CAMP_LOCATION.address}
                    layoutReady={!boardLoading && !companyLoading && !authLoading && mapFullscreen}
                    onMoveStop={handleMoveStop}
                    onRemoveStop={handleRemoveStop}
                    unplottedCampers={unplottedForWeek}
                    onAssignCamper={handleAssignCamperToRoute}
                  />
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/50 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground sm:px-5 sm:text-xs">
                  <span>Click a numbered stop for camper details, pickup time, and route actions.</span>
                  <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" />
                    Purple = unassigned camper
                  </span>
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
                Parents drop off or pick up — no map address. Optional bus for attendance roll-up; otherwise <strong>PT only (no bus)</strong> and they appear on the <strong>Car Report</strong> only.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                resetNewParentTransportForm();
                setAddParentTransportOpen(true);
              }}
            >
              <UserPlus className="h-3.5 w-3.5" /> Add to PT
            </Button>
          </div>

          {parentTransportForWeek.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {parentTransportCampers.length === 0
                  ? "No parent transport campers yet."
                  : `${parentTransportCampers.length} saved on this board, but none match the selected enrollment week. Try “All weeks” in the route week filter, or confirm enrollment weeks synced from CampMinder.`}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {parentTransportNoBusForWeek.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    PT only — no bus ({parentTransportNoBusForWeek.length})
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {parentTransportNoBusForWeek.map((c) => (
                      <Card key={c.id} className="border-dashed border-amber-500/40 bg-amber-500/5">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="rounded-full bg-amber-500/15 p-2">
                              <Car className="h-4 w-4 text-amber-700 dark:text-amber-400" />
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
                              <p className="text-xs text-muted-foreground mt-1">{formatParentTransportSchedule(c)}</p>
                              {c.notes ? (
                                <p className="text-xs text-muted-foreground mt-2">{c.notes}</p>
                              ) : null}
                              <Badge variant="outline" className="mt-2 text-[10px] border-amber-500/40">
                                {PARENT_TRANSPORT_NO_BUS_LABEL} · Car Report only
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {parentTransportForWeek.some((c) => isParentTransportBusAssigned(c)) && (
                <div className="space-y-2">
                  {parentTransportNoBusForWeek.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      PT with bus assignment
                    </p>
                  )}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {parentTransportForWeek.filter(isParentTransportBusAssigned).map((c) => (
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
                                🚌 {parentTransportBusLabel(c, routeMeta)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatParentTransportSchedule(c)}
                              </p>
                              {c.notes ? (
                                <p className="text-xs text-muted-foreground mt-2">{c.notes}</p>
                              ) : null}
                              <Badge variant="outline" className="mt-2 text-[10px]">
                                Counts on bus + Car Report · no map pin
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Dialog open={addParentTransportOpen} onOpenChange={setAddParentTransportOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add parent transport camper</DialogTitle>
                <DialogDescription>
                  Pick AM/PM and weekdays. Bus is optional — choose <strong>PT only (no bus)</strong> for Car Report without a bus assignment.
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
                  <Label>Bus assignment (optional)</Label>
                  <Select
                    value={newParentTransport.routeId || "none"}
                    onValueChange={(routeId) => setNewParentTransport((prev) => ({ ...prev, routeId }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{PARENT_TRANSPORT_NO_BUS_LABEL}</SelectItem>
                      {routeMeta.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.bus} · {r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    No bus = listed on Car Report only. With a bus = also rolls up on that bus attendance.
                  </p>
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
            {configuredEnrollmentWeekRows(enrollmentWeekCalendar).length > 0 ? (
              <div className="flex items-center gap-2">
                <Label htmlFor="attendance-enrollment-week" className="text-xs text-muted-foreground whitespace-nowrap">
                  Attendance week
                </Label>
                <Select
                  value={enrollmentWeekForReport != null ? String(enrollmentWeekForReport) : undefined}
                  onValueChange={(v) => setAttendanceWeekOverride(parseInt(v, 10))}
                >
                  <SelectTrigger id="attendance-enrollment-week" className="h-8 w-[min(280px,70vw)] text-xs">
                    <SelectValue placeholder="Week" />
                  </SelectTrigger>
                  <SelectContent>
                    {configuredEnrollmentWeekRows(enrollmentWeekCalendar).map((row) => (
                      <SelectItem key={row.weekNumber} value={String(row.weekNumber)}>
                        {formatEnrollmentWeekLabel(row.weekNumber, enrollmentWeekCalendar)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <span className="text-[10px] text-destructive">
                Enrollment weeks are not set.{" "}
                <Link to="/day-camp/group-bubble-sheets" className="underline">
                  Set them on Group Bubble Sheets
                </Link>
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              Same date as Map / Attendance · manual edits are per season ({currentSeason})
              {reportDateOutsideEnrollmentWeeks
                ? " · report date is outside camp weeks, so these sheets use the week selected here"
                : ""}
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
                  . Bus Bubble Sheet lists who is actually on each bus today. Group Bubble Sheet lists everyone enrolled that week.
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
            {dayCampReports.map((r) =>
              "href" in r && r.href ? (
                <Card key={r.name} className="cursor-pointer hover:shadow-md transition-shadow" asChild>
                  <Link to={r.href}>
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-primary">{r.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                    </CardContent>
                  </Link>
                </Card>
              ) : (
                <Card key={r.name} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleGenerateReport(r.name)}>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-primary">{r.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                  </CardContent>
                </Card>
              ),
            )}
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
              Assigns unplotted campers onto open stops (by prior route or matching address), reorders each bus for a shorter drive, and keeps stops on the same bus.
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
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {p.beforeStops}→{p.afterStops} stops
                      </span>
                      {p.afterStops < p.beforeStops ? (
                        <span className="text-[10px] text-destructive whitespace-nowrap">fewer stops</span>
                      ) : p.changed ? (
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

      <Dialog open={busRunScheduleOpen} onOpenChange={setBusRunScheduleOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>AM/PM bus schedule</DialogTitle>
            <DialogDescription>
              Set mini day (AM bus only), PM-only, or full day per camper on their assigned bus. Bus bubble sheets show an X on runs they do not use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 min-h-0 flex-1 flex flex-col">
            <Input
              placeholder="Search camper, bus, or stop…"
              value={busRunScheduleSearch}
              onChange={(e) => setBusRunScheduleSearch(e.target.value)}
              className="h-9"
            />
            {busRunScheduleEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campers on bus routes yet.</p>
            ) : (
              <div className="border rounded-lg overflow-auto flex-1 min-h-[200px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left font-medium p-2">Camper</th>
                      <th className="text-left font-medium p-2">Bus</th>
                      <th className="text-left font-medium p-2 hidden sm:table-cell">Stop</th>
                      <th className="text-left font-medium p-2">Bus runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBusRunScheduleEntries.map((row) => (
                      <tr key={row.name} className="border-t border-border/50">
                        <td className="p-2 font-medium">{row.name}</td>
                        <td className="p-2 text-muted-foreground">{row.bus}</td>
                        <td className="p-2 text-muted-foreground hidden sm:table-cell truncate max-w-[140px]">
                          {row.stopName}
                        </td>
                        <td className="p-2">
                          <Select
                            value={getCamperBusRunMode(camperBusRunSchedules, row.name)}
                            onValueChange={(v) => setCamperBusRunMode(row.name, v as CamperBusRunMode)}
                          >
                            <SelectTrigger className="h-8 text-xs w-[min(100%,220px)]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CAMPER_BUS_RUN_MODE_OPTIONS.map((mode) => (
                                <SelectItem key={mode} value={mode} className="text-xs">
                                  {CAMPER_BUS_RUN_MODE_LABELS[mode]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredBusRunScheduleEntries.length === 0 && busRunScheduleEntries.length > 0 ? (
              <p className="text-sm text-muted-foreground">No campers match your search.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBusRunScheduleOpen(false)}>Done</Button>
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
