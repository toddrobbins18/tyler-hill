import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDayCampGradeKey } from "@/lib/divisionFilterUtils";
import { normCamperName } from "@/lib/transportGroupAttendance";
import { campersOnRoute } from "@/lib/transportBusAttendance";

export type CarSeatCategory = "nursery" | "pre-k";

export type CarSeatCamperInfo = {
  name: string;
  divisionLabel: string;
  category: CarSeatCategory;
};

export type CarSeatBusSummary = {
  routeId: number;
  bus: string;
  routeName: string;
  totalRiders: number;
  nursery: number;
  preK: number;
  carSeatsRequired: number;
  carSeatCampers: CarSeatCamperInfo[];
};

export function carSeatCategoryFromLabels(
  divisionName?: string | null,
  grade?: string | null,
): CarSeatCategory | null {
  const key =
    normalizeDayCampGradeKey(divisionName) ?? normalizeDayCampGradeKey(grade);
  if (key === "nursery") return "nursery";
  if (key === "pre-k") return "pre-k";
  return null;
}

export type CamperCarSeatLookup = Map<
  string,
  { category: CarSeatCategory; divisionLabel: string }
>;

export async function loadCamperCarSeatLookup(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<CamperCarSeatLookup> {
  const map: CamperCarSeatLookup = new Map();
  let from = 0;
  const pageSize = 1000;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("children")
      .select("name, grade, division:divisions(name)")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .range(from, to);

    if (error) {
      console.error("[Transport] Car seat lookup failed:", error.message);
      break;
    }

    for (const row of data ?? []) {
      const name = (row as { name?: string }).name?.trim();
      if (!name) continue;
      const divisionRaw = (row as { division?: { name?: string } | { name?: string }[] | null })
        .division;
      const divisionName = Array.isArray(divisionRaw)
        ? divisionRaw[0]?.name
        : divisionRaw?.name;
      const grade = (row as { grade?: string | null }).grade;
      const category = carSeatCategoryFromLabels(divisionName, grade);
      if (!category) continue;
      const divisionLabel =
        divisionName?.trim() ||
        grade?.trim() ||
        (category === "nursery" ? "Nursery" : "Pre-K");
      map.set(normCamperName(name), { category, divisionLabel });
    }

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return map;
}

export function summarizeCarSeatsByBus(
  routes: { id: number; bus: string; name: string }[],
  getCoreStops: (routeId: number) => { name: string; camperNames?: string[] }[],
  lookup: CamperCarSeatLookup,
  options?: { includeEmptyBuses?: boolean },
): CarSeatBusSummary[] {
  const summaries: CarSeatBusSummary[] = [];

  for (const route of routes) {
    const riders = campersOnRoute(route.id, getCoreStops(route.id));
    const carSeatCampers: CarSeatCamperInfo[] = [];
    let nursery = 0;
    let preK = 0;

    for (const rider of riders) {
      const info = lookup.get(normCamperName(rider.name));
      if (!info) continue;
      if (info.category === "nursery") nursery += 1;
      else preK += 1;
      carSeatCampers.push({
        name: rider.name,
        divisionLabel: info.divisionLabel,
        category: info.category,
      });
    }

    if (!options?.includeEmptyBuses && riders.length === 0) continue;

    summaries.push({
      routeId: route.id,
      bus: route.bus,
      routeName: route.name,
      totalRiders: riders.length,
      nursery,
      preK,
      carSeatsRequired: nursery + preK,
      carSeatCampers: carSeatCampers.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return summaries.sort((a, b) =>
    a.bus.localeCompare(b.bus, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export function buildCarSeatCountByBusCsvRows(
  summaries: CarSeatBusSummary[],
  options: { date: string; runPeriod: "am" | "pm" },
): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
      "Date",
      "Run",
      "Bus",
      "Route",
      "Total Riders",
      "Nursery",
      "Pre-K",
      "Car Seats Required",
    ],
  ];

  let totalNursery = 0;
  let totalPreK = 0;
  let totalRiders = 0;

  for (const s of summaries) {
    totalNursery += s.nursery;
    totalPreK += s.preK;
    totalRiders += s.totalRiders;
    rows.push([
      options.date,
      options.runPeriod.toUpperCase(),
      s.bus,
      s.routeName,
      s.totalRiders,
      s.nursery,
      s.preK,
      s.carSeatsRequired,
    ]);
  }

  rows.push([]);
  rows.push([
    "TOTAL",
    "",
    "",
    "",
    totalRiders,
    totalNursery,
    totalPreK,
    totalNursery + totalPreK,
  ]);

  rows.push([]);
  rows.push(["Detail — campers requiring car seats"]);
  rows.push(["Bus", "Camper Name", "Division", "Category"]);

  for (const s of summaries) {
    for (const c of s.carSeatCampers) {
      rows.push([
        s.bus,
        c.name,
        c.divisionLabel,
        c.category === "nursery" ? "Nursery" : "Pre-K",
      ]);
    }
  }

  if (summaries.every((s) => s.carSeatCampers.length === 0)) {
    rows.push(["(No Nursery or Pre-K campers on routes)", "", "", ""]);
  }

  return rows;
}
