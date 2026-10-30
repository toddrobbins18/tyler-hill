import type {
  TransportException,
  TransportManualOverrides,
  TransportRouteMeta,
  TransportRouteStop,
  TransportRunPeriod,
} from "./transportDailyOverrides";
import { buildTransportExceptionsReportRows } from "./transportDailyOverrides";
import {
  compareBusLabels,
  parseAttendanceRecordKey,
  type BusAttendanceMap,
} from "./transportBusAttendance";
import {
  PARENT_TRANSPORT_CHANGE_SHEET_BUS,
  PARENT_TRANSPORT_STOP_LABEL,
} from "./transportParentTransport";

export { PARENT_TRANSPORT_CHANGE_SHEET_BUS };

export type ChangeSheetParentTransportCamper = {
  routeId: number | null;
  name: string;
};

export type ChangeSheetSelectionFilter = {
  selectedRouteIds: number[];
  includeParentTransport: boolean;
};

export type TransportChangeSheetRow = {
  date: string;
  run: string;
  camper: string;
  source: string;
  description: string;
  status: string;
  route: string;
  bus: string;
  stop: string;
  notes: string;
};

const normName = (name: string) => name.trim().toLowerCase();

function camperNamesAtStop(stop: TransportRouteStop): string[] {
  return stop.camperNames?.length ? stop.camperNames : [stop.name];
}

export function findCamperRouteAssignment(
  camperName: string,
  routeMeta: TransportRouteMeta[],
  coreStops: Record<number, TransportRouteStop[]>,
): { routeId: number; routeName: string; bus: string; address: string } | null {
  const target = normName(camperName);
  for (const meta of routeMeta) {
    for (const stop of coreStops[meta.id] ?? []) {
      if (camperNamesAtStop(stop).some((n) => normName(n) === target)) {
        return { routeId: meta.id, routeName: meta.name, bus: meta.bus, address: stop.address };
      }
    }
  }
  return null;
}

function reportRowToChangeSheet(row: (string | number)[]): TransportChangeSheetRow {
  return {
    date: String(row[0] ?? ""),
    run: String(row[1] ?? ""),
    camper: String(row[2] ?? ""),
    source: String(row[3] ?? ""),
    description: String(row[4] ?? ""),
    status: String(row[5] ?? ""),
    route: String(row[7] ?? ""),
    bus: String(row[8] ?? ""),
    stop: String(row[9] ?? ""),
    notes: String(row[10] ?? ""),
  };
}

function isParentTransportCamper(
  camperName: string,
  parentTransportCampers: ChangeSheetParentTransportCamper[],
): ChangeSheetParentTransportCamper | undefined {
  const target = normName(camperName);
  return parentTransportCampers.find((c) => normName(c.name) === target);
}

function rowMatchesChangeSheetFilter(
  row: TransportChangeSheetRow,
  filter: ChangeSheetSelectionFilter,
  routeMeta: TransportRouteMeta[],
  coreStops: Record<number, TransportRouteStop[]>,
  parentTransportCampers: ChangeSheetParentTransportCamper[],
): boolean {
  const { selectedRouteIds, includeParentTransport } = filter;
  if (!selectedRouteIds.length && !includeParentTransport) return false;

  const ptCamper =
    row.camper && !row.camper.startsWith("(")
      ? isParentTransportCamper(row.camper, parentTransportCampers)
      : undefined;

  if (!selectedRouteIds.length) {
    if (!includeParentTransport) return false;
    return row.bus === PARENT_TRANSPORT_CHANGE_SHEET_BUS || ptCamper != null;
  }

  if (includeParentTransport) {
    if (row.bus === PARENT_TRANSPORT_CHANGE_SHEET_BUS) return true;
    if (ptCamper) return true;
  }

  const selectedMeta = routeMeta.filter((r) => selectedRouteIds.includes(r.id));
  const selectedBuses = new Set(selectedMeta.map((r) => r.bus));
  const selectedNames = new Set(selectedMeta.map((r) => r.name));

  if (row.bus && selectedBuses.has(row.bus)) return true;
  if (row.route && selectedNames.has(row.route)) return true;

  if (!row.camper || row.camper.startsWith("(")) return false;

  if (ptCamper?.routeId != null && selectedRouteIds.includes(ptCamper.routeId)) return true;

  const assignment = findCamperRouteAssignment(row.camper, selectedMeta, coreStops);
  return assignment != null;
}

function exceptionMatchesRun(ex: TransportException, runPeriod: TransportRunPeriod): boolean {
  if (!ex.appliesTo) return true;
  return ex.appliesTo === runPeriod;
}

function resolveAttendanceCamper(
  routeId: number,
  camperNameLower: string,
  coreStops: Record<number, TransportRouteStop[]>,
  parentTransportCampers: { routeId: number | null; name: string }[],
): { camperName: string; stopName: string; address: string } {
  for (const stop of coreStops[routeId] ?? []) {
    for (const name of camperNamesAtStop(stop)) {
      if (normName(name) === camperNameLower) {
        return { camperName: name, stopName: stop.name, address: stop.address };
      }
    }
  }
  const pt = parentTransportCampers.find(
    (c) => c.routeId === routeId && normName(c.name) === camperNameLower,
  );
  if (pt) {
    return {
      camperName: pt.name,
      stopName: "Parent Transport",
      address: "",
    };
  }
  return { camperName: camperNameLower, stopName: "", address: "" };
}

/** Absent marks from Bus Attendance (P/A screen) for the selected run. */
export function buildBusAttendanceAbsentRows(options: {
  overrideDate: string;
  runPeriod: TransportRunPeriod;
  busAttendance: BusAttendanceMap;
  routeMeta: TransportRouteMeta[];
  coreStops: Record<number, TransportRouteStop[]>;
  parentTransportCampers?: { routeId: number | null; name: string }[];
  selectedRouteIds: number[];
}): TransportChangeSheetRow[] {
  const {
    overrideDate,
    runPeriod,
    busAttendance,
    routeMeta,
    coreStops,
    parentTransportCampers = [],
    selectedRouteIds,
  } = options;

  const routeFilter =
    selectedRouteIds.length > 0 ? new Set(selectedRouteIds) : new Set(routeMeta.map((r) => r.id));
  const metaById = new Map(routeMeta.map((r) => [r.id, r]));
  const rows: TransportChangeSheetRow[] = [];

  for (const [key, status] of Object.entries(busAttendance)) {
    if (status !== "absent") continue;
    const parsed = parseAttendanceRecordKey(key);
    if (!parsed || !routeFilter.has(parsed.routeId)) continue;

    const meta = metaById.get(parsed.routeId);
    if (!meta) continue;

    const camper = resolveAttendanceCamper(
      parsed.routeId,
      parsed.camperNameLower,
      coreStops,
      parentTransportCampers,
    );

    const ptOnRoute = parentTransportCampers.some(
      (c) => c.routeId === parsed.routeId && normName(c.name) === parsed.camperNameLower,
    );
    const ptOnly = parentTransportCampers.some(
      (c) => c.routeId == null && normName(c.name) === parsed.camperNameLower,
    );
    const isPt = ptOnRoute || ptOnly || camper.stopName.includes("Parent Transport");

    rows.push({
      date: overrideDate,
      run: runPeriod.toUpperCase(),
      camper: camper.camperName,
      source: "Bus attendance",
      description: "Marked absent on bus",
      status: "saved",
      route: isPt ? `${meta.name} · PT` : meta.name,
      bus: isPt ? PARENT_TRANSPORT_CHANGE_SHEET_BUS : meta.bus,
      stop: camper.stopName || camper.address || PARENT_TRANSPORT_STOP_LABEL,
      notes: "",
    });
  }

  rows.sort((a, b) => a.camper.localeCompare(b.camper));
  return rows;
}

function mergeChangeSheetRows(
  primary: TransportChangeSheetRow[],
  extra: TransportChangeSheetRow[],
): TransportChangeSheetRow[] {
  const seen = new Set(primary.map((r) => normName(r.camper)));
  const merged = [...primary];
  for (const row of extra) {
    if (seen.has(normName(row.camper))) continue;
    seen.add(normName(row.camper));
    merged.push(row);
  }
  return merged;
}

export function buildApprovedChangeSheetRows(options: {
  overrideDate: string;
  runPeriod: TransportRunPeriod;
  exceptions: TransportException[];
  manual: TransportManualOverrides;
  routeMeta: TransportRouteMeta[];
  coreStops: Record<number, TransportRouteStop[]>;
  selectedRouteIds: number[];
  includeParentTransport?: boolean;
  busAttendance?: BusAttendanceMap;
  parentTransportCampers?: ChangeSheetParentTransportCamper[];
}): TransportChangeSheetRow[] {
  const {
    overrideDate,
    runPeriod,
    exceptions,
    manual,
    routeMeta,
    coreStops,
    selectedRouteIds,
    includeParentTransport = true,
    busAttendance,
    parentTransportCampers = [],
  } = options;

  const selectionFilter: ChangeSheetSelectionFilter = {
    selectedRouteIds,
    includeParentTransport,
  };

  const approvedExceptions = exceptions.filter(
    (ex) => ex.appliedToRoutes !== false && exceptionMatchesRun(ex, runPeriod),
  );

  const filteredManual: TransportManualOverrides = { excluded: {}, added: {} };
  const routeFilter =
    selectedRouteIds.length > 0 ? new Set(selectedRouteIds) : new Set(routeMeta.map((r) => r.id));

  for (const meta of routeMeta) {
    if (!routeFilter.has(meta.id)) continue;
    if (manual.excluded[meta.id]?.length) filteredManual.excluded[meta.id] = manual.excluded[meta.id];
    if (manual.added[meta.id]?.length) filteredManual.added[meta.id] = manual.added[meta.id];
  }

  const reportRows = buildTransportExceptionsReportRows({
    overrideDate,
    exceptions: approvedExceptions,
    manual: filteredManual,
    routeMeta,
    coreStops,
    parentTransportCampers,
  });

  let dataRows = reportRows.slice(1).map(reportRowToChangeSheet);
  dataRows = dataRows.filter((row) =>
    rowMatchesChangeSheetFilter(
      row,
      selectionFilter,
      routeMeta,
      coreStops,
      parentTransportCampers,
    ),
  );

  if (!busAttendance || !Object.keys(busAttendance).length) return dataRows;

  const attendanceRows = buildBusAttendanceAbsentRows({
    overrideDate,
    runPeriod,
    busAttendance,
    routeMeta,
    coreStops,
    parentTransportCampers,
    selectedRouteIds,
  }).filter((row) =>
    rowMatchesChangeSheetFilter(
      row,
      selectionFilter,
      routeMeta,
      coreStops,
      parentTransportCampers,
    ),
  );

  return mergeChangeSheetRows(dataRows, attendanceRows);
}

export function buildPendingChangeSheetRows(options: {
  overrideDate: string;
  runPeriod: TransportRunPeriod;
  exceptions: TransportException[];
  routeMeta: TransportRouteMeta[];
  coreStops: Record<number, TransportRouteStop[]>;
  selectedRouteIds: number[];
  includeParentTransport?: boolean;
  parentTransportCampers?: ChangeSheetParentTransportCamper[];
}): TransportChangeSheetRow[] {
  const {
    overrideDate,
    runPeriod,
    exceptions,
    routeMeta,
    coreStops,
    selectedRouteIds,
    includeParentTransport = true,
    parentTransportCampers = [],
  } = options;

  const selectionFilter: ChangeSheetSelectionFilter = {
    selectedRouteIds,
    includeParentTransport,
  };

  const pending = exceptions.filter(
    (ex) => ex.appliedToRoutes === false && exceptionMatchesRun(ex, runPeriod),
  );

  const reportRows = buildTransportExceptionsReportRows({
    overrideDate,
    exceptions: pending,
    manual: { excluded: {}, added: {} },
    routeMeta,
    coreStops,
    parentTransportCampers,
  });

  const dataRows = reportRows.slice(1).map(reportRowToChangeSheet);
  return dataRows.filter((row) =>
    rowMatchesChangeSheetFilter(
      row,
      selectionFilter,
      routeMeta,
      coreStops,
      parentTransportCampers,
    ),
  );
}

export function sortChangeSheetRowsByBus(
  rows: TransportChangeSheetRow[],
  routeMeta: TransportRouteMeta[],
): TransportChangeSheetRow[] {
  const busOrder = new Map(
    [...routeMeta]
      .sort((a, b) => compareBusLabels(a.bus, b.bus))
      .map((r, index) => [r.bus, index]),
  );
  const ptOrder = routeMeta.length;
  busOrder.set(PARENT_TRANSPORT_CHANGE_SHEET_BUS, ptOrder);
  return [...rows].sort((a, b) => {
    const busA = busOrder.get(a.bus) ?? 999;
    const busB = busOrder.get(b.bus) ?? 999;
    if (busA !== busB) return busA - busB;
    return a.camper.localeCompare(b.camper, undefined, { sensitivity: "base" });
  });
}

export type ChangeSheetBusGroup = {
  bus: string;
  routeName: string;
  rows: TransportChangeSheetRow[];
};

export function groupChangeSheetRowsByBus(
  rows: TransportChangeSheetRow[],
  routeMeta: TransportRouteMeta[],
): ChangeSheetBusGroup[] {
  const sorted = sortChangeSheetRowsByBus(rows, routeMeta);
  const metaByBus = new Map(routeMeta.map((r) => [r.bus, r]));
  const groups = new Map<string, TransportChangeSheetRow[]>();

  for (const row of sorted) {
    const key = row.bus.trim() || "Unassigned";
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()].map(([bus, groupRows]) => ({
    bus,
    routeName: groupRows[0]?.route || metaByBus.get(bus)?.name || "",
    rows: groupRows,
  }));
}

export function changeSheetRowsToCsv(rows: TransportChangeSheetRow[]): string {
  const header = [
    "Date",
    "Run",
    "Camper",
    "Change Source",
    "Description",
    "Status",
    "Route",
    "Bus",
    "Stop / Address",
    "Notes",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [r.date, r.run, r.camper, r.source, r.description, r.status, r.route, r.bus, r.stop, r.notes]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  return lines.join("\r\n");
}
