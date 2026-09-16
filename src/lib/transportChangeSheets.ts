import type {
  TransportException,
  TransportManualOverrides,
  TransportRouteMeta,
  TransportRouteStop,
  TransportRunPeriod,
} from "./transportDailyOverrides";
import { buildTransportExceptionsReportRows } from "./transportDailyOverrides";

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

function rowMatchesSelectedRoutes(
  row: TransportChangeSheetRow,
  selectedRouteIds: number[],
  routeMeta: TransportRouteMeta[],
  coreStops: Record<number, TransportRouteStop[]>,
): boolean {
  if (!selectedRouteIds.length) return true;
  const selectedMeta = routeMeta.filter((r) => selectedRouteIds.includes(r.id));
  const selectedBuses = new Set(selectedMeta.map((r) => r.bus));
  const selectedNames = new Set(selectedMeta.map((r) => r.name));

  if (row.bus && selectedBuses.has(row.bus)) return true;
  if (row.route && selectedNames.has(row.route)) return true;

  if (!row.camper || row.camper.startsWith("(")) return false;

  const assignment = findCamperRouteAssignment(row.camper, selectedMeta, coreStops);
  return assignment != null;
}

function exceptionMatchesRun(ex: TransportException, runPeriod: TransportRunPeriod): boolean {
  if (!ex.appliesTo) return true;
  return ex.appliesTo === runPeriod;
}

export function buildApprovedChangeSheetRows(options: {
  overrideDate: string;
  runPeriod: TransportRunPeriod;
  exceptions: TransportException[];
  manual: TransportManualOverrides;
  routeMeta: TransportRouteMeta[];
  coreStops: Record<number, TransportRouteStop[]>;
  selectedRouteIds: number[];
}): TransportChangeSheetRow[] {
  const { overrideDate, runPeriod, exceptions, manual, routeMeta, coreStops, selectedRouteIds } =
    options;

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
  });

  const dataRows = reportRows.slice(1).map(reportRowToChangeSheet);
  if (!selectedRouteIds.length) return dataRows;

  return dataRows.filter((row) =>
    rowMatchesSelectedRoutes(row, selectedRouteIds, routeMeta, coreStops),
  );
}

export function buildPendingChangeSheetRows(options: {
  overrideDate: string;
  runPeriod: TransportRunPeriod;
  exceptions: TransportException[];
  routeMeta: TransportRouteMeta[];
  coreStops: Record<number, TransportRouteStop[]>;
  selectedRouteIds: number[];
}): TransportChangeSheetRow[] {
  const { overrideDate, runPeriod, exceptions, routeMeta, coreStops, selectedRouteIds } = options;

  const pending = exceptions.filter(
    (ex) => ex.appliedToRoutes === false && exceptionMatchesRun(ex, runPeriod),
  );

  const reportRows = buildTransportExceptionsReportRows({
    overrideDate,
    exceptions: pending,
    manual: { excluded: {}, added: {} },
    routeMeta,
    coreStops,
  });

  const dataRows = reportRows.slice(1).map(reportRowToChangeSheet);
  if (!selectedRouteIds.length) return dataRows;

  return dataRows.filter((row) =>
    rowMatchesSelectedRoutes(row, selectedRouteIds, routeMeta, coreStops),
  );
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
