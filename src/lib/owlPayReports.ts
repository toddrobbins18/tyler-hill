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
  totalRevenue: number;
  totalItems: number;
  freeItems: number;
  mostPopular: string;
  avgTransaction: number;
};

export type OwlPayReportData = {
  salesByItem: { id: string; name: string; category: string; quantity: number; revenue: number }[];
  salesOverTime: { date: string; revenue: number; count: number }[];
  purchases: {
    id: string;
    buyer_type: "camper" | "staff";
    camper_name: string;
    item_name: string;
    item_category: string;
    amount: number;
    is_free: boolean;
    purchased_at: string;
  }[];
  stats: OwlPayReportStats;
};

/** Match the live/production query shape that is known to work. */
const TX_SELECT =
  "id, created_at, amount, is_free, transaction_type, item_id, child_id, staff_id, owl_pay_items(*), children(name), staff(name)";

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

function addDaysToYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return getCampYmd(dt);
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

  const match = tzName?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
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
  const txYmd = getCampYmd(new Date(createdAt));
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

/** Widen DB query window by one camp day on each side; filter precisely in aggregate. */
export function getOwlPayReportFetchBounds(fromYmd: string, toYmd: string): {
  startISO: string;
  endInclusiveISO: string;
} {
  return {
    startISO: campYmdToUtcStart(addDaysToYmd(fromYmd, -1)).toISOString(),
    endInclusiveISO: campYmdToUtcEnd(addDaysToYmd(toYmd, 1)).toISOString(),
  };
}

export function formatCampReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: OWL_PAY_CAMP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCampReportDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: OWL_PAY_CAMP_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
  const dateMap = new Map<string, { revenue: number; count: number }>();
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

    const dateKey = formatCampReportDate(tx.created_at);
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, { revenue: 0, count: 0 });
    const dayRow = dateMap.get(dateKey)!;
    if (!isFree) {
      dayRow.revenue += amount;
      dayRow.count += 1;
    }

    purchases.push({
      id: tx.id,
      buyer_type: buyer === "staff" ? "staff" : "camper",
      camper_name: child?.name || staffMember?.name || "Unknown",
      item_name: itemName,
      item_category: itemCategory,
      amount,
      is_free: isFree,
      purchased_at: tx.created_at,
    });
  });

  const salesByItem = Array.from(itemMap.values())
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);
  const salesOverTime = Array.from(dateMap.entries())
    .map(([date, d]) => ({ date, revenue: d.revenue, count: d.count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    salesByItem,
    salesOverTime,
    purchases,
    stats: {
      totalRevenue,
      totalItems,
      freeItems,
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
    endExclusiveISO: campYmdToUtcEnd(addDaysToYmd(toYmd, 1)).toISOString(),
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
