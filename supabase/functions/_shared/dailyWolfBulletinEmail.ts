import {
  escapeHtml,
  mergeActivityDivisions,
} from "./dailyDashboardFormat.ts";

type NamedDivision = { id?: string; name?: string | null };

const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;

export type DailyWolfBulletinConfig = {
  mastheadTitle: string;
  campSubtitle: string;
  defaultNotes: string;
};

export type DailyWolfBulletinData = {
  birthdayNames: string[];
  meals: Array<{
    meal_type: string;
    items?: string | null;
    allergens?: string | null;
  }>;
  sportsEvents: Array<{
    id: string;
    title: string;
    opponent?: string | null;
    location?: string | null;
    time?: string | null;
    start_time_field?: string | null;
    depart_time?: string | null;
    divisions: NamedDivision[];
  }>;
  specialEvents: Array<{
    id: string;
    title: string;
    time_slot?: string | null;
    location?: string | null;
    description?: string | null;
    divisions: NamedDivision[];
  }>;
  dailyContent: {
    quote_of_the_day?: string | null;
    notes?: string | null;
    officer_of_day?: string | null;
    laundry_info?: string | null;
    phone_calls_info?: string | null;
  };
};

function isActiveRosterStatus(status: unknown): boolean {
  if (status == null) return true;
  const s = String(status).trim().toLowerCase();
  if (!s) return true;
  return s !== "inactive";
}

function parseBirthdayParts(value: unknown): { month: number; day: number } | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return { month: parseInt(iso[2], 10), day: parseInt(iso[3], 10) };
  }

  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return { month: parseInt(us[1], 10), day: parseInt(us[2], 10) };
  }

  return null;
}

function isBirthdayToday(dateValue: unknown, todayMonth: number, todayDay: number): boolean {
  const p = parseBirthdayParts(dateValue);
  return p != null && p.month === todayMonth && p.day === todayDay;
}

function formatTime12Hour(time24: string): string {
  if (!time24) return "";
  if (/AM|PM/i.test(time24)) return time24;
  const parts = time24.split(":");
  if (parts.length < 2) return time24;
  const hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return time24;
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${parts[1]} ${ampm}`;
}

export function formatPrintableTime(raw?: string | null): string {
  if (!raw?.trim()) return "TBD";
  const formatted = formatTime12Hour(raw.trim());
  return formatted || "TBD";
}

function mergeSportsDivisions(event: {
  sports_calendar_divisions?: { division?: NamedDivision | null }[] | null;
}): NamedDivision[] {
  const fromJunction =
    event.sports_calendar_divisions?.map((row) => row.division).filter(Boolean) ?? [];
  const byId = new Map<string, NamedDivision>();
  for (const div of fromJunction as NamedDivision[]) {
    if (!div?.name) continue;
    byId.set(div.id ?? div.name, div);
  }
  return [...byId.values()];
}

function divisionNamesLabel(divisions: NamedDivision[]): string {
  return divisions.map((d) => d.name).filter(Boolean).join(", ");
}

function formatDisplayDate(todayYMD: string): string {
  const [y, m, d] = todayYMD.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

function sectionHeading(title: string): string {
  return `<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #ccc;padding-bottom:6px;">${escapeHtml(title)}</p>`;
}

export async function fetchDailyWolfBulletinData(
  supabase: any,
  companyId: string,
  todayYMD: string,
  season: string,
): Promise<DailyWolfBulletinData> {
  const [, monthStr, dayStr] = todayYMD.split("-");
  const todayMonth = parseInt(monthStr, 10);
  const todayDay = parseInt(dayStr, 10);

  const { data: childrenRaw } = await supabase
    .from("children")
    .select("id, name, date_of_birth, status")
    .eq("company_id", companyId)
    .eq("season", season)
    .not("date_of_birth", "is", null);

  const birthdayChildren = (childrenRaw || [])
    .filter((child: { status?: string | null }) => isActiveRosterStatus(child.status))
    .filter((child: { date_of_birth: string }) =>
      isBirthdayToday(child.date_of_birth, todayMonth, todayDay)
    );

  const { data: staffRaw } = await supabase
    .from("staff")
    .select("id, name, date_of_birth, status")
    .eq("company_id", companyId)
    .eq("season", season)
    .not("date_of_birth", "is", null);

  const birthdayStaff = (staffRaw || [])
    .filter((staff: { status?: string | null }) => isActiveRosterStatus(staff.status))
    .filter((staff: { date_of_birth: string }) =>
      isBirthdayToday(staff.date_of_birth, todayMonth, todayDay)
    );

  const birthdayNames = [...birthdayChildren, ...birthdayStaff].map(
    (p: { name: string }) => p.name,
  );

  let menuQuery = supabase
    .from("menu_items")
    .select("meal_type, items, allergens")
    .eq("company_id", companyId)
    .eq("date", todayYMD)
    .order("meal_type");
  if (season) {
    menuQuery = menuQuery.or(`season.eq.${season},season.is.null`);
  }
  const { data: mealsData, error: mealsError } = await menuQuery;
  if (mealsError) {
    console.error("Error fetching menu_items for daily bulletin:", mealsError);
  }

  const { data: allSportsData } = await supabase
    .from("sports_calendar")
    .select(`
      id, title, time, start_time_field, depart_time, location, opponent,
      sports_calendar_divisions(division_id, division:divisions(id, name))
    `)
    .eq("company_id", companyId)
    .eq("event_date", todayYMD)
    .eq("season", season)
    .order("time");

  const sportsEvents = (allSportsData || []).map((event: any) => ({
    id: event.id,
    title: event.title,
    opponent: event.opponent,
    location: event.location,
    time: event.time,
    start_time_field: event.start_time_field,
    depart_time: event.depart_time,
    divisions: mergeSportsDivisions(event),
  }));

  const { data: activitiesData } = await supabase
    .from("special_events_activities")
    .select(`
      id, title, time_slot, location, description, season,
      division:divisions(id, name),
      special_events_divisions(division_id, division:divisions(id, name))
    `)
    .eq("company_id", companyId)
    .eq("event_date", todayYMD)
    .order("time_slot");

  const allTodayEvents = (activitiesData || []).map((event: any) => ({
    id: event.id,
    title: event.title,
    time_slot: event.time_slot,
    location: event.location,
    description: event.description,
    season: event.season,
    divisions: mergeActivityDivisions(event),
  }));

  let specialEvents = allTodayEvents;
  if (season) {
    const seasonMatched = allTodayEvents.filter(
      (e: { season?: string | null }) => !e.season || e.season === season,
    );
    specialEvents = seasonMatched.length > 0 ? seasonMatched : allTodayEvents;
  }

  const { data: contentData } = await supabase
    .from("daily_wolf_content")
    .select("quote_of_the_day, notes, officer_of_day, laundry_info, phone_calls_info")
    .eq("company_id", companyId)
    .eq("date", todayYMD)
    .eq("season", season)
    .maybeSingle();

  return {
    birthdayNames,
    meals: mealsData || [],
    sportsEvents,
    specialEvents,
    dailyContent: contentData || {},
  };
}

export function buildDailyWolfBulletinHtml(
  todayYMD: string,
  data: DailyWolfBulletinData,
  config: DailyWolfBulletinConfig,
): string {
  const displayDate = formatDisplayDate(todayYMD);
  const mealByType = (type: string) =>
    data.meals.find((m) => (m.meal_type || "").toLowerCase() === type);

  const birthdayHtml = data.birthdayNames.length > 0
    ? `<p style="margin:0;font-size:15px;font-weight:600;">🎉 ${escapeHtml(data.birthdayNames.join(", "))}</p>`
    : `<p style="margin:0;font-style:italic;color:#666;">No birthdays today</p>`;

  const menuCells = MEAL_ORDER.map((mealType) => {
    const meal = mealByType(mealType);
    const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    const text = meal?.items?.trim() || "";
    const allergenLine = meal?.allergens
      ? `<p style="margin:4px 0 0;font-size:11px;font-style:italic;color:#666;">Allergens: ${escapeHtml(meal.allergens)}</p>`
      : "";
    return `<td style="width:25%;vertical-align:top;padding:8px;border:1px solid #ddd;background:#fafafa;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;color:#0d6e6e;">${label}</p>
      <p style="margin:0;font-size:13px;">${text ? nl2br(text) : "&nbsp;"}</p>
      ${allergenLine}
    </td>`;
  }).join("");

  const opsCells = [
    { title: "Super OD", value: data.dailyContent.officer_of_day?.trim() || "TBD" },
    { title: "Laundry", value: data.dailyContent.laundry_info?.trim() || "TBD" },
    { title: "Phone Calls", value: data.dailyContent.phone_calls_info?.trim() || "TBD" },
  ].map(({ title, value }) =>
    `<td style="width:33%;vertical-align:top;padding:10px;border:1px solid #ddd;">
      ${sectionHeading(title)}
      <p style="margin:0;font-size:14px;font-weight:500;">${nl2br(value)}</p>
    </td>`
  ).join("");

  const athleticsHtml = data.sportsEvents.length > 0
    ? `<ul style="margin:0;padding:0;list-style:none;">${
      data.sportsEvents.map((event) => {
        const divisionLabel = divisionNamesLabel(event.divisions);
        const eventTime = formatPrintableTime(
          event.start_time_field || event.time || event.depart_time,
        );
        const opponent = event.opponent
          ? ` <span style="color:#666;">vs ${escapeHtml(event.opponent)}</span>`
          : "";
        const division = divisionLabel
          ? `<br/><span style="font-size:12px;font-weight:600;color:#0d6e6e;">${escapeHtml(divisionLabel)}</span>`
          : "";
        const location = event.location
          ? `<br/><span style="font-size:12px;color:#666;">${escapeHtml(event.location)}</span>`
          : "";
        return `<li style="padding:8px 0;border-bottom:1px solid #eee;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="width:70px;vertical-align:top;font-size:12px;font-weight:bold;color:#0d6e6e;">${escapeHtml(eventTime)}</td>
            <td style="vertical-align:top;font-size:14px;">
              <strong>${escapeHtml(event.title)}</strong>${opponent}${division}${location}
            </td>
          </tr></table>
        </li>`;
      }).join("")
    }</ul>`
    : `<p style="margin:0;font-style:italic;color:#666;">No athletic events scheduled</p>`;

  const specialEventsHtml = data.specialEvents.length > 0
    ? `<ul style="margin:0;padding:0;list-style:none;">${
      data.specialEvents.map((event) => {
        const divisionLabel = divisionNamesLabel(event.divisions);
        const time = formatPrintableTime(event.time_slot);
        const division = divisionLabel
          ? ` <span style="font-size:12px;font-weight:600;color:#0d6e6e;">(${escapeHtml(divisionLabel)})</span>`
          : "";
        const location = event.location
          ? ` <span style="color:#666;">@ ${escapeHtml(event.location)}</span>`
          : "";
        const description = event.description
          ? `<p style="margin:4px 0 0;font-size:12px;font-style:italic;color:#666;">${nl2br(event.description)}</p>`
          : "";
        return `<li style="padding:8px 0;border-bottom:1px solid #eee;">
          <p style="margin:0;font-size:14px;">
            <span style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#0d6e6e;margin-right:6px;">${escapeHtml(time)}</span>
            <strong>${escapeHtml(event.title)}</strong>${division}${location}
          </p>
          ${description}
        </li>`;
      }).join("")
    }</ul>`
    : `<p style="margin:0;font-style:italic;color:#666;">No special events scheduled</p>`;

  const quote = data.dailyContent.quote_of_the_day?.trim()
    ? `"${escapeHtml(data.dailyContent.quote_of_the_day.trim())}"`
    : '"Make today amazing!"';

  const notes = data.dailyContent.notes?.trim() || config.defaultNotes;

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:640px;margin:0 auto;background:#fdf8f0;padding:16px;">
    <div style="text-align:center;border-bottom:3px double #333;background:#f5efe3;padding:20px 12px;margin-bottom:16px;">
      <p style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:bold;letter-spacing:0.15em;">${escapeHtml(config.mastheadTitle)}</p>
      <p style="margin:8px 0 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#666;">${escapeHtml(config.campSubtitle)}</p>
      <p style="margin:10px 0 0;font-size:15px;font-weight:500;">${escapeHtml(displayDate)}</p>
    </div>

    <div style="border:1px solid #ddd;background:#fff;padding:12px;margin-bottom:16px;">
      ${sectionHeading("Birthday Wishes")}
      ${birthdayHtml}
    </div>

    <div style="border:1px solid #ddd;background:#fff;padding:12px;margin-bottom:16px;">
      ${sectionHeading("Menu")}
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${menuCells}</tr></table>
    </div>

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;"><tr>${opsCells}</tr></table>

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:8px;">
          <div style="border:1px solid #ddd;background:#fff;padding:12px;">
            ${sectionHeading("Athletics")}
            ${athleticsHtml}
          </div>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:8px;">
          <div style="border:1px solid #ddd;background:#fff;padding:12px;">
            ${sectionHeading("Special Events")}
            ${specialEventsHtml}
          </div>
        </td>
      </tr>
    </table>

    <div style="border:2px solid #ccc;background:#f5f5f5;padding:16px;text-align:center;margin-bottom:16px;">
      ${sectionHeading("Quote of the Day")}
      <p style="margin:0;font-family:Georgia,serif;font-size:17px;font-style:italic;">${quote}</p>
    </div>

    <div style="border:1px solid #ddd;background:#fff;padding:12px;">
      ${sectionHeading("Notes")}
      <p style="margin:0;font-size:14px;">${nl2br(notes)}</p>
    </div>
  </div>`;
}
