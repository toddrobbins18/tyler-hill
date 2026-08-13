import type { SupabaseClient } from "@supabase/supabase-js";

export const OWL_PAY_CAMP_TIMEZONE = "America/New_York";
const PAGE_SIZE = 1000;

export type OwlPayReportAudience = "all" | "campers" | "staff";

export type OwlPayReportTransaction = {
  id: string;
  created_at: string;
  amount: number;
  is_free: boolean | null;
  item_id: string | null;
  child_id: string | null;
  staff_id: string | null;
  owl_pay_items: { name: string; category: string; price?: number } | { name: string; category: string; price?: number }[] | null;
  children: { name: string } | { name: string }[] | null;
  staff: { name: string } | { name: string }[] | null;
};

export type OwlPayReportStats = {
  /** Paid purchases in the selected date range (and audience). */
  totalRevenue: number;
  /** Sum of season_spent for all active campers — matches balance-report Column F total. */
  seasonCamperRevenue: number;
  /** Paid (non-free) item lines */
  totalItems: number;
  freeItems: number;
  /** All purchase lines, paid + free */
  totalPurchaseLines: number;
  mostPopular: string;
  avgTransaction: number;
};

export type OwlPayReportDailyRow = {
  ymd: string;
  date: string;
  revenue: number;
  paidItems: number;
  freeItems: number;
  totalLines: number;
};

export type OwlPayReportData = {
  salesByItem: { id: string; name: string; category: string; quantity: number; revenue: number }[];
  salesOverTime: OwlPayReportDailyRow[];
  purchases: {
    id: string;
    buyer_type: "camper" | "staff";
    buyer_key: string;
    child_id: string | null;
    staff_id: string | null;
    camper_name: string;
    item_name: string;
    item_category: string;
    amount: number;
    is_free: boolean;
    purchased_at: string;
    camp_date: string;
  }[];
  stats: OwlPayReportStats;
};

export type OwlPayCamperFinancial = {
  child_id: string;
  name: string;
  season: string;
  person_id: string | null;
  owl_pay_balance: number;
  cm_deposits: number;
  season_spent: number;
  full_balance: number;
};

export type OwlPayBuyerSummary = {
  buyer_key: string;
  buyer_type: "camper" | "staff";
  name: string;
  season: string | null;
  child_id: string | null;
  staff_id: string | null;
  period_spent: number;
  period_items: number;
  season_spent: number | null;
  cm_deposits: number | null;
  current_balance: number | null;
  full_balance: number | null;
  person_id: string | null;
};

export type OwlPayReportBundle = OwlPayReportData & {
  buyerSummaries: OwlPayBuyerSummary[];
};

/** Match the live/production query shape that is known to work. */
const TX_SELECT =
  "id, created_at, amount, is_free, transaction_type, item_id, child_id, staff_id, owl_pay_items(*), children(name), staff!owl_pay_transactions_staff_id_fkey(name)";

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function getCampYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OWL_PAY_CAMP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getCampWeekday(date: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: OWL_PAY_CAMP_TIMEZONE,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** User-facing camp calendar date, e.g. 05-07-2026 */
export function formatCampYmdDisplay(ymd: string): string {
  if (!ymd) return "";
  const { y, m, d } = parseYmd(ymd);
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
}

function addDaysToYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return getCampYmd(dt);
}

export function listCampDaysInRange(fromYmd: string, toYmd: string): string[] {
  const days: string[] = [];
  let cur = fromYmd;
  while (cur <= toYmd) {
    days.push(cur);
    cur = addDaysToYmd(cur, 1);
  }
  return days;
}

/** Newest camp dates first for tables/CSV (includes empty days in range). */
export function getOwlPayDailyRowsForDisplay(rows: OwlPayReportDailyRow[]): OwlPayReportDailyRow[] {
  return [...rows].sort((a, b) => b.ymd.localeCompare(a.ymd));
}

/** Chart axis: activity days only, oldest → newest. */
export function getOwlPayDailyRowsForChart(rows: OwlPayReportDailyRow[]): OwlPayReportDailyRow[] {
  return rows.filter((d) => d.totalLines > 0).sort((a, b) => a.ymd.localeCompare(b.ymd));
}

export function getCampYmdFromIso(iso: string): string {
  const parsed = parseOwlPayTimestamp(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return getCampYmd(parsed);
}

export function formatCampYmdLabel(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString("en-US", {
    timeZone: OWL_PAY_CAMP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Parse API timestamps as UTC when no offset is present (avoids browser-local misreads). */
export function parseOwlPayTimestamp(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) return new Date(Number.NaN);

  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(trimmed) && !hasExplicitZone) {
    return new Date(trimmed.replace(" ", "T") + "Z");
  }

  return new Date(trimmed);
}

/** DST-aware offset for a camp calendar day, e.g. "-04:00". */
function getCampUtcOffsetIso(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: OWL_PAY_CAMP_TIMEZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(probe)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = tzName?.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return "-04:00";
  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = (match[3] ?? "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

/** Start of a camp calendar day in UTC. */
export function campYmdToUtcStart(ymd: string): Date {
  const offset = getCampUtcOffsetIso(ymd);
  return new Date(`${ymd}T00:00:00.000${offset}`);
}

/** End of a camp calendar day in UTC (inclusive for lte queries). */
export function campYmdToUtcEnd(ymd: string): Date {
  const offset = getCampUtcOffsetIso(ymd);
  return new Date(`${ymd}T23:59:59.999${offset}`);
}

export function isTransactionInCampDateRange(
  createdAt: string,
  fromYmd: string,
  toYmd: string,
): boolean {
  if (!createdAt) return false;
  const parsed = parseOwlPayTimestamp(createdAt);
  if (Number.isNaN(parsed.getTime())) return false;
  const txYmd = getCampYmd(parsed);
  return txYmd >= fromYmd && txYmd <= toYmd;
}

export function getOwlPayQuickRangeYmd(range: "today" | "week" | "month" | "all"): {
  fromYmd: string;
  toYmd: string;
} {
  const today = getCampYmd(new Date());
  if (range === "today") return { fromYmd: today, toYmd: today };
  if (range === "week") {
    return { fromYmd: addDaysToYmd(today, -getCampWeekday(new Date())), toYmd: today };
  }
  if (range === "month") {
    const { y, m } = parseYmd(today);
    return { fromYmd: formatYmd(y, m, 1), toYmd: today };
  }
  return { fromYmd: "2020-01-01", toYmd: today };
}

export function isOwlPayAllTimeRange(fromYmd: string, toYmd: string): boolean {
  const allTime = getOwlPayQuickRangeYmd("all");
  return fromYmd === allTime.fromYmd && toYmd === allTime.toYmd;
}

export function sumSeasonCamperRevenue(camperFinancials: OwlPayCamperFinancial[]): number {
  return camperFinancials.reduce((sum, camper) => sum + camper.season_spent, 0);
}

/** Exact camp-calendar UTC bounds for the selected report range. */
export function getOwlPayReportFetchBounds(fromYmd: string, toYmd: string): {
  startISO: string;
  endInclusiveISO: string;
} {
  return {
    startISO: campYmdToUtcStart(fromYmd).toISOString(),
    endInclusiveISO: campYmdToUtcEnd(toYmd).toISOString(),
  };
}

export function formatCampReportDate(iso: string): string {
  return parseOwlPayTimestamp(iso).toLocaleDateString("en-US", {
    timeZone: OWL_PAY_CAMP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCampReportDateTime(iso: string): string {
  const parsed = parseOwlPayTimestamp(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${formatCampYmdDisplay(getCampYmd(parsed))} ${formatCampReportTime(iso)}`;
}

export function formatCampReportTime(iso: string): string {
  const parsed = parseOwlPayTimestamp(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-GB", {
    timeZone: OWL_PAY_CAMP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Camp datetime for CSV export, e.g. 06-07-2026 23:04:59 */
export function formatCampReportDateTimeCsv(iso: string): string {
  const parsed = parseOwlPayTimestamp(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const campYmd = getCampYmd(parsed);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OWL_PAY_CAMP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(parsed);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${formatCampYmdDisplay(campYmd)} ${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

function classifyPurchaseBuyer(tx: OwlPayReportTransaction): "camper" | "staff" | "unknown" {
  if (tx.staff_id) return "staff";
  if (tx.child_id) return "camper";
  return "unknown";
}

function matchesAudience(
  buyer: "camper" | "staff" | "unknown",
  audience: OwlPayReportAudience,
): boolean {
  if (audience === "all") return buyer === "camper" || buyer === "staff";
  if (audience === "campers") return buyer === "camper";
  return buyer === "staff";
}

export async function fetchAllOwlPayPurchaseTransactions(
  supabase: SupabaseClient,
  companyId: string,
  startISO: string,
  endInclusiveISO: string,
): Promise<OwlPayReportTransaction[]> {
  const rows: OwlPayReportTransaction[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("owl_pay_transactions" as any)
      .select(TX_SELECT)
      .eq("company_id", companyId)
      .eq("transaction_type", "purchase")
      .gte("created_at", startISO)
      .lte("created_at", endInclusiveISO)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const batch = (data || []) as unknown as OwlPayReportTransaction[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

export function aggregateOwlPayReports(
  transactions: OwlPayReportTransaction[],
  audience: OwlPayReportAudience,
  fromYmd: string,
  toYmd: string,
): OwlPayReportData {
  const itemMap = new Map<
    string,
    { id: string; name: string; category: string; quantity: number; revenue: number }
  >();
  const dateMap = new Map<string, { revenue: number; paidItems: number; freeItems: number; totalLines: number }>();
  const purchases: OwlPayReportData["purchases"] = [];
  let totalRevenue = 0;
  let totalItems = 0;
  let freeItems = 0;
  let paidTransactions = 0;

  transactions.forEach((tx) => {
    if (!isTransactionInCampDateRange(tx.created_at, fromYmd, toYmd)) return;

    const buyer = classifyPurchaseBuyer(tx);
    if (!matchesAudience(buyer, audience)) return;

    const item = asOne(tx.owl_pay_items);
    const child = asOne(tx.children);
    const staffMember = asOne(tx.staff);
    const amount = Number(tx.amount ?? 0);
    const isFree = tx.is_free === true;
    const itemName = item?.name || (isFree ? "Free daily item" : "Unknown item");
    const itemCategory = item?.category || "other";
    const groupKey = tx.item_id || (isFree ? "__free_daily__" : `unknown-${tx.id}`);
    const campDate = getCampYmdFromIso(tx.created_at);

    if (!itemMap.has(groupKey)) {
      itemMap.set(groupKey, {
        id: groupKey,
        name: itemName,
        category: itemCategory,
        quantity: 0,
        revenue: 0,
      });
    }

    const itemRow = itemMap.get(groupKey)!;
    if (!isFree) {
      itemRow.quantity += 1;
      itemRow.revenue += amount;
      totalRevenue += amount;
      totalItems += 1;
      paidTransactions += 1;
    } else {
      freeItems += 1;
    }

    if (campDate) {
      if (!dateMap.has(campDate)) {
        dateMap.set(campDate, { revenue: 0, paidItems: 0, freeItems: 0, totalLines: 0 });
      }
      const dayRow = dateMap.get(campDate)!;
      dayRow.totalLines += 1;
      if (isFree) {
        dayRow.freeItems += 1;
      } else {
        dayRow.revenue += amount;
        dayRow.paidItems += 1;
      }
    }

    purchases.push({
      id: tx.id,
      buyer_type: buyer === "staff" ? "staff" : "camper",
      buyer_key:
        buyer === "staff" && tx.staff_id
          ? `staff:${tx.staff_id}`
          : buyer === "camper" && tx.child_id
            ? `camper:${tx.child_id}`
            : `${buyer}-name:${child?.name || staffMember?.name || "unknown"}`,
      child_id: tx.child_id ?? null,
      staff_id: tx.staff_id ?? null,
      camper_name: child?.name || staffMember?.name || "Unknown",
      item_name: itemName,
      item_category: itemCategory,
      amount,
      is_free: isFree,
      purchased_at: tx.created_at,
      camp_date: campDate,
    });
  });

  const salesByItem = Array.from(itemMap.values())
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);
  const salesOverTime = listCampDaysInRange(fromYmd, toYmd).map((ymd) => {
    const d = dateMap.get(ymd) ?? { revenue: 0, paidItems: 0, freeItems: 0, totalLines: 0 };
    return {
      ymd,
      date: formatCampYmdDisplay(ymd),
      revenue: d.revenue,
      paidItems: d.paidItems,
      freeItems: d.freeItems,
      totalLines: d.totalLines,
    };
  });

  return {
    salesByItem,
    salesOverTime,
    purchases,
    stats: {
      totalRevenue,
      seasonCamperRevenue: 0,
      totalItems,
      freeItems,
      totalPurchaseLines: purchases.length,
      mostPopular: salesByItem[0]?.name || "N/A",
      avgTransaction: paidTransactions > 0 ? totalRevenue / paidTransactions : 0,
    },
  };
}

/** @deprecated Use getOwlPayReportFetchBounds */
export function getOwlPayReportUtcBounds(fromYmd: string, toYmd: string) {
  const bounds = getOwlPayReportFetchBounds(fromYmd, toYmd);
  return {
    startISO: bounds.startISO,
    endExclusiveISO: campYmdToUtcStart(addDaysToYmd(toYmd, 1)).toISOString(),
  };
}

export function dateToCampYmd(date: Date): string {
  return getCampYmd(date);
}

export function isTransactionOnCampDate(createdAt: string, ymd: string): boolean {
  return isTransactionInCampDateRange(createdAt, ymd, ymd);
}

export function campYmdToUtcEndExclusive(ymd: string): Date {
  return campYmdToUtcStart(addDaysToYmd(ymd, 1));
}

export function campLocalToUtc(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  ms = 0,
): Date {
  const offset = getCampUtcOffsetIso(ymd);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");
  const base = new Date(`${ymd}T${hh}:${mm}:${ss}${offset}`);
  return new Date(base.getTime() + ms);
}

export async function fetchOwlPayCamperFinancials(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<OwlPayCamperFinancial[]> {
  const [{ data: campers, error: camperErr }, { data: cmRows, error: cmErr }, { data: spendRows, error: spendErr }] =
    await Promise.all([
    supabase
      .from("children")
      .select("id, name, season, person_id, owl_pay_balance")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive"),
    supabase.from("campminder_transactions").select("person_id, amount").eq("company_id", companyId),
    supabase.rpc("get_owl_pay_purchase_totals", { _company_id: companyId }),
  ]);

  if (camperErr) throw camperErr;
  if (cmErr) throw cmErr;
  if (spendErr) throw spendErr;

  const depositsByPerson = new Map<string, number>();
  for (const row of cmRows || []) {
    const personId = String(row.person_id || "");
    if (!personId) continue;
    depositsByPerson.set(personId, (depositsByPerson.get(personId) || 0) + Number(row.amount || 0));
  }

  const spentByChild = new Map<string, number>();
  for (const row of spendRows || []) {
    spentByChild.set(String(row.child_id), Number(row.total_spent || 0));
  }

  return (campers || []).map((camper) => {
    const cmDeposits = camper.person_id ? depositsByPerson.get(String(camper.person_id)) || 0 : 0;
    const seasonSpent = spentByChild.get(camper.id) || 0;
    const fullBalance = cmDeposits - seasonSpent;
    return {
      child_id: camper.id,
      name: camper.name,
      season: camper.season,
      person_id: camper.person_id,
      owl_pay_balance: Number(camper.owl_pay_balance || 0),
      cm_deposits: cmDeposits,
      season_spent: seasonSpent,
      full_balance: fullBalance,
    };
  });
}

export function buildOwlPayBuyerSummaries(
  purchases: OwlPayReportData["purchases"],
  camperFinancials: OwlPayCamperFinancial[],
): OwlPayBuyerSummary[] {
  const camperById = new Map(camperFinancials.map((camper) => [camper.child_id, camper]));
  const byKey = new Map<string, OwlPayBuyerSummary>();

  for (const purchase of purchases) {
    if (purchase.is_free) continue;

    if (!byKey.has(purchase.buyer_key)) {
      const camper = purchase.child_id ? camperById.get(purchase.child_id) : undefined;
      byKey.set(purchase.buyer_key, {
        buyer_key: purchase.buyer_key,
        buyer_type: purchase.buyer_type,
        name: purchase.camper_name,
        season: camper?.season ?? null,
        child_id: purchase.child_id,
        staff_id: purchase.staff_id,
        period_spent: 0,
        period_items: 0,
        season_spent: camper ? camper.season_spent : null,
        cm_deposits: camper ? camper.cm_deposits : null,
        current_balance: camper ? camper.owl_pay_balance : null,
        full_balance: camper ? camper.full_balance : null,
        person_id: camper?.person_id ?? null,
      });
    }

    const summary = byKey.get(purchase.buyer_key)!;
    summary.period_spent += purchase.amount;
    summary.period_items += 1;
  }

  return Array.from(byKey.values()).sort((a, b) => b.period_spent - a.period_spent);
}

export async function fetchOwlPayReportBundle(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    season: string;
    fromYmd: string;
    toYmd: string;
    audience: OwlPayReportAudience;
  },
): Promise<OwlPayReportBundle> {
  const { companyId, season, fromYmd, toYmd, audience } = params;
  const { startISO, endInclusiveISO } = getOwlPayReportFetchBounds(fromYmd, toYmd);
  const [transactions, camperFinancials] = await Promise.all([
    fetchAllOwlPayPurchaseTransactions(supabase, companyId, startISO, endInclusiveISO),
    fetchOwlPayCamperFinancials(supabase, companyId, season),
  ]);
  const aggregated = aggregateOwlPayReports(transactions, audience, fromYmd, toYmd);
  const seasonCamperRevenue = sumSeasonCamperRevenue(camperFinancials);
  return {
    ...aggregated,
    stats: {
      ...aggregated.stats,
      seasonCamperRevenue,
    },
    buyerSummaries: buildOwlPayBuyerSummaries(aggregated.purchases, camperFinancials),
  };
}
