import {
  escapeHtml,
  formatBulletinDisplayDate,
  formatDashboardSpecialEventSubtitle,
  mergeActivityDivisions,
} from "./dailyDashboardFormat.ts";
import { formatPrintableTime } from "./dailyWolfBulletinEmail.ts";

const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;

export type TylerHillBulletinData = {
  birthdayNames: string[];
  dashboardNotes: string;
  meals: Array<{
    meal_type: string;
    items?: string | null;
    allergens?: string | null;
  }>;
  specialMeals: Array<{
    meal_type: string;
    items?: string | null;
    allergens?: string | null;
  }>;
  scheduleEvents: Array<{
    id: string;
    title: string;
    time: string;
    location?: string | null;
    description?: string | null;
    type: string;
    subtitle?: string;
  }>;
  threeDayOutlook: Array<{
    id: string;
    title: string;
    event_date: string;
    time: string;
    sport_type?: string | null;
  }>;
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
  if (iso) return { month: parseInt(iso[2], 10), day: parseInt(iso[3], 10) };
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return { month: parseInt(us[1], 10), day: parseInt(us[2], 10) };
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

function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

function sectionHeading(title: string): string {
  return `<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #ccc;padding-bottom:6px;">${escapeHtml(title)}</p>`;
}

function formatOutlookDate(eventDate: string): string {
  // Anchor at noon UTC so converting to Eastern never rolls back to the
  // previous day. Building at local midnight (new Date(y, m-1, d)) on a UTC
  // server and then formatting in Eastern shifted every date one day early.
  const [y, m, d] = eventDate.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return anchor.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

function sportsTimeRaw(event: {
  start_time_field?: string | null;
  time?: string | null;
  depart_time?: string | null;
}): string {
  return event.start_time_field || event.time || event.depart_time || "";
}

export async function fetchTylerHillBulletinData(
  supabase: any,
  companyId: string,
  todayYMD: string,
  season: string,
): Promise<TylerHillBulletinData> {
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

  const { data: kanbanNote } = await supabase
    .from("kanban_notes")
    .select("content, title")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("column_status", "todo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dashboardNotes = (kanbanNote?.content || kanbanNote?.title || "").trim();

  const { data: mealsData } = await supabase
    .from("menu_items")
    .select("meal_type, items, allergens")
    .eq("company_id", companyId)
    .eq("date", todayYMD)
    .eq("season", season)
    .order("meal_type");

  const { data: specialMealsData } = await supabase
    .from("special_meals")
    .select("meal_type, items, allergens")
    .eq("company_id", companyId)
    .eq("date", todayYMD)
    .or(`season.eq.${season},season.is.null`)
    .order("meal_type");

  const mealOrder: Record<string, number> = {
    breakfast: 1,
    lunch: 2,
    snack: 3,
    dinner: 4,
  };
  const specialMeals = (specialMealsData || []).sort((a: { meal_type: string }, b: { meal_type: string }) =>
    (mealOrder[(a.meal_type || "").toLowerCase()] ?? 99) -
    (mealOrder[(b.meal_type || "").toLowerCase()] ?? 99)
  );

  const scheduleEvents: TylerHillBulletinData["scheduleEvents"] = [];

  const { data: sportsData } = await supabase
    .from("sports_calendar")
    .select("id, title, time, start_time_field, depart_time, location, description, sport_type")
    .eq("company_id", companyId)
    .eq("event_date", todayYMD)
    .eq("season", season)
    .order("time");

  for (const event of sportsData || []) {
    const raw = sportsTimeRaw(event);
    scheduleEvents.push({
      id: event.id,
      title: event.title,
      time: formatPrintableTime(raw),
      location: event.location,
      description: event.description,
      type: event.sport_type || "Sports",
    });
  }

  const { data: activitiesData } = await supabase
    .from("activities_field_trips")
    .select("id, title, time, location, description, activity_type")
    .eq("company_id", companyId)
    .eq("event_date", todayYMD)
    .eq("season", season)
    .order("time");

  for (const event of activitiesData || []) {
    scheduleEvents.push({
      id: event.id,
      title: event.title,
      time: formatPrintableTime(event.time),
      location: event.location,
      description: event.description,
      type: event.activity_type || "Activity",
    });
  }

  const { data: specialEventsData } = await supabase
    .from("special_events_activities")
    .select(`
      id, title, time_slot, start_time, end_time, location, description, event_type,
      division:divisions(id, name),
      special_events_divisions(division_id, division:divisions(id, name))
    `)
    .eq("company_id", companyId)
    .eq("event_date", todayYMD)
    .eq("season", season)
    .order("time_slot");

  for (const event of specialEventsData || []) {
    const divisions = mergeActivityDivisions(event);
    scheduleEvents.push({
      id: event.id,
      title: event.title,
      time: formatPrintableTime(event.time_slot),
      location: event.location,
      description: event.description,
      type: event.event_type || "Special Event",
      subtitle: formatDashboardSpecialEventSubtitle({ ...event, divisions }),
    });
  }

  scheduleEvents.sort((a, b) => {
    if (a.time === "TBD") return 1;
    if (b.time === "TBD") return -1;
    return a.time.localeCompare(b.time);
  });

  const threeDaysFromNow = new Date(todayYMD + "T12:00:00");
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const threeDaysEnd = threeDaysFromNow.toISOString().split("T")[0];

  const { data: outlookData } = await supabase
    .from("sports_calendar")
    .select("id, title, event_date, time, start_time_field, depart_time, sport_type")
    .eq("company_id", companyId)
    .gt("event_date", todayYMD)
    .lte("event_date", threeDaysEnd)
    .order("event_date", { ascending: true });

  const threeDayOutlook = (outlookData || []).map((event: {
    id: string;
    title: string;
    event_date: string;
    time?: string | null;
    start_time_field?: string | null;
    depart_time?: string | null;
    sport_type?: string | null;
  }) => {
    const raw = sportsTimeRaw(event);
    return {
      id: event.id,
      title: event.title,
      event_date: event.event_date,
      time: formatTime12Hour(raw) || formatPrintableTime(raw),
      sport_type: event.sport_type,
    };
  });

  return {
    birthdayNames,
    dashboardNotes,
    meals: mealsData || [],
    specialMeals,
    scheduleEvents,
    threeDayOutlook,
  };
}

export function buildTylerHillBulletinHtml(
  todayYMD: string,
  data: TylerHillBulletinData,
): string {
  const displayDate = formatBulletinDisplayDate(todayYMD);
  const mealByType = (type: string) =>
    data.meals.find((m) => (m.meal_type || "").toLowerCase() === type);

  const birthdayHtml = data.birthdayNames.length > 0
    ? `<p style="margin:0;font-size:15px;font-weight:600;">🎉 ${escapeHtml(data.birthdayNames.join(", "))}</p>`
    : `<p style="margin:0;font-style:italic;color:#666;">No birthdays today</p>`;

  const notesHtml = data.dashboardNotes
    ? `<div style="border:1px solid #ddd;background:#fff;padding:12px;margin-bottom:16px;">
        ${sectionHeading("Notes")}
        <p style="margin:0;font-size:14px;">${nl2br(data.dashboardNotes)}</p>
      </div>`
    : "";

  const menuCells = MEAL_ORDER.map((mealType) => {
    const meal = mealByType(mealType);
    const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    const text = meal?.items?.trim() || "TBD";
    const allergenLine = meal?.allergens
      ? `<p style="margin:4px 0 0;font-size:11px;font-style:italic;color:#666;">Allergens: ${escapeHtml(meal.allergens)}</p>`
      : "";
    return `<td style="width:25%;vertical-align:top;padding:8px;border:1px solid #ddd;background:#fafafa;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;color:#8B4513;">${label}</p>
      <p style="margin:0;font-size:13px;">${nl2br(text)}</p>
      ${allergenLine}
    </td>`;
  }).join("");

  const specialMealsHtml = data.specialMeals.length > 0
    ? `<div style="border:1px solid #ddd;background:#fff;padding:12px;margin-bottom:16px;">
        ${sectionHeading("Special Meals")}
        <ul style="margin:0;padding:0;list-style:none;">${
      data.specialMeals.map((meal) => {
        const label = (meal.meal_type || "Meal").charAt(0).toUpperCase() +
          (meal.meal_type || "Meal").slice(1);
        const allergens = meal.allergens
          ? `<br/><span style="font-size:12px;font-style:italic;color:#666;">Allergens: ${escapeHtml(meal.allergens)}</span>`
          : "";
        return `<li style="padding:6px 0;border-bottom:1px solid #eee;">
          <strong style="color:#8B4513;">${escapeHtml(label)}:</strong> ${nl2br(meal.items || "")}${allergens}
        </li>`;
      }).join("")
    }</ul>
      </div>`
    : "";

  const scheduleHtml = data.scheduleEvents.length > 0
    ? `<ul style="margin:0;padding:0;list-style:none;">${
      data.scheduleEvents.map((event) => {
        const location = event.location
          ? ` <span style="color:#666;">@ ${escapeHtml(event.location)}</span>`
          : "";
        const description = event.description
          ? `<p style="margin:2px 0 0;font-size:12px;font-style:italic;color:#666;">${nl2br(event.description)}</p>`
          : "";
        const subtitle = event.subtitle
          ? `<p style="margin:2px 0 0;font-size:12px;color:#8B4513;">${escapeHtml(event.subtitle)}</p>`
          : "";
        return `<li style="padding:8px 0;border-bottom:1px solid #eee;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="width:70px;vertical-align:top;font-size:12px;font-weight:bold;color:#8B4513;">${escapeHtml(event.time)}</td>
            <td style="vertical-align:top;font-size:14px;">
              <strong>${escapeHtml(event.title)}</strong>${location}
              ${subtitle}${description}
            </td>
            <td style="width:90px;vertical-align:top;text-align:right;font-size:11px;font-style:italic;color:#666;">[${escapeHtml(event.type)}]</td>
          </tr></table>
        </li>`;
      }).join("")
    }</ul>`
    : `<p style="margin:0;font-style:italic;color:#666;">No events scheduled for today</p>`;

  const outlookHtml = data.threeDayOutlook.length > 0
    ? `<div style="border:1px solid #ddd;background:#fff;padding:12px;margin-bottom:16px;">
        ${sectionHeading("Three Day Outlook — Athletics")}
        <ul style="margin:0;padding:0;list-style:none;">${
      data.threeDayOutlook.map((event) =>
        `<li style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px;">
          <strong>${escapeHtml(event.title)}</strong>
          <span style="color:#666;font-size:12px;"> — ${escapeHtml(formatOutlookDate(event.event_date))} • ${escapeHtml(event.time || "TBD")}${event.sport_type ? ` • ${escapeHtml(event.sport_type)}` : ""}</span>
        </li>`
      ).join("")
    }</ul>
      </div>`
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:640px;margin:0 auto;background:#fdf8f0;padding:16px;">
    <div style="text-align:center;border-bottom:3px double #333;background:#f5efe3;padding:20px 12px;margin-bottom:16px;">
      <p style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:bold;letter-spacing:0.12em;">TYLER HILL DAILY NEWS</p>
      <p style="margin:8px 0 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:#666;">Home of the Bears</p>
      <p style="margin:10px 0 0;font-size:15px;font-weight:500;">${escapeHtml(displayDate)}</p>
    </div>

    <div style="border:1px solid #ddd;background:#fff;padding:12px;margin-bottom:16px;">
      ${sectionHeading("Birthday Wishes")}
      ${birthdayHtml}
    </div>

    ${notesHtml}

    <div style="border:1px solid #ddd;background:#fff;padding:12px;margin-bottom:16px;">
      ${sectionHeading("Today's Menu")}
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${menuCells}</tr></table>
    </div>

    ${specialMealsHtml}

    <div style="border:1px solid #ddd;background:#fff;padding:12px;margin-bottom:16px;">
      ${sectionHeading("Today's Schedule")}
      ${scheduleHtml}
    </div>

    ${outlookHtml}
  </div>`;
}
