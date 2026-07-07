type NamedDivision = { id?: string; name?: string | null };

const EASTERN_TIMEZONE = "America/New_York";

/** Today's date as YYYY-MM-DD in US Eastern (for bulletin sends at 4 AM ET). */
export function easternTodayYMD(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function easternSeasonYear(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
  }).format(now);
}

/** Camp-local timestamp for emails and notifications (America/New_York). */
export function formatEasternDateTime(
  iso: string | null | undefined,
  fallback = "N/A",
): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString("en-US", {
    timeZone: EASTERN_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

/** Long-form calendar label for a YYYY-MM-DD string (avoids UTC midnight off-by-one). */
export function formatBulletinDisplayDate(dateYMD: string): string {
  const [y, m, d] = dateYMD.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return anchor.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: EASTERN_TIMEZONE,
  });
}

const PLACEHOLDER_TIME_VALUES = new Set(["", "tbd", "all day", "n/a"]);

function isPlaceholderTime(raw?: string | null): boolean {
  return PLACEHOLDER_TIME_VALUES.has((raw || "").trim().toLowerCase());
}

function formatTime12Hour(time24: string): string {
  if (!time24) return "";
  if (time24.toUpperCase().includes("AM") || time24.toUpperCase().includes("PM")) {
    return time24;
  }
  const parts = time24.split(":");
  if (parts.length < 2) return time24;
  const hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return time24;
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${parts[1]} ${ampm}`;
}

function formatTimeSlotForDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const formatted = parts.map((p) => formatTime12Hour(p)).filter(Boolean);
      if (formatted.length >= 2) return `${formatted[0]} – ${formatted[1]}`;
    }
  }
  const formatted = formatTime12Hour(trimmed);
  return formatted && !isPlaceholderTime(formatted) ? formatted : "";
}

export function mergeActivityDivisions(event: {
  division?: NamedDivision | null;
  special_events_divisions?: { division?: NamedDivision | null }[] | null;
}): NamedDivision[] {
  const fromJunction =
    event.special_events_divisions?.map((row) => row.division).filter(Boolean) ?? [];
  const legacy = event.division ? [event.division] : [];
  const byId = new Map<string, NamedDivision>();
  for (const div of [...fromJunction, ...legacy] as NamedDivision[]) {
    if (!div?.name) continue;
    byId.set(div.id ?? div.name, div);
  }
  return [...byId.values()];
}

function divisionNamesLabel(divisions: NamedDivision[]): string {
  return divisions.map((d) => d.name).filter(Boolean).join(", ");
}

function resolveEventTimeRaw(event: {
  time_slot?: string | null;
  time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}): string {
  const slot = (event.time_slot || "").trim();
  if (slot && !isPlaceholderTime(slot)) return slot;

  const start = (event.start_time || "").trim();
  const end = (event.end_time || "").trim();
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;

  const legacy = (event.time || "").trim();
  if (legacy && !isPlaceholderTime(legacy)) return legacy;
  return "";
}

/** Match Nest dashboard subtitle: 12-hour time • division name(s). */
export function formatDashboardSpecialEventSubtitle(event: {
  time_slot?: string | null;
  time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  divisions?: NamedDivision[];
  division?: NamedDivision | null;
  special_events_divisions?: { division?: NamedDivision | null }[] | null;
}): string {
  const parts: string[] = [];

  const rawTime = resolveEventTimeRaw(event);
  if (rawTime) {
    const displayTime = formatTimeSlotForDisplay(rawTime);
    if (displayTime) parts.push(displayTime);
  }

  const divisions =
    event.divisions && event.divisions.length > 0
      ? event.divisions
      : mergeActivityDivisions(event);
  const label = divisionNamesLabel(divisions);
  if (label) parts.push(label);

  if (parts.length === 0) return "All divisions";
  return parts.join(" • ");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatSpecialEventEmailItem(event: {
  title?: string | null;
  time_slot?: string | null;
  time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  division?: NamedDivision | null;
  special_events_divisions?: { division?: NamedDivision | null }[] | null;
}): string {
  const title = escapeHtml(String(event.title || "Untitled"));
  const subtitle = escapeHtml(
    formatDashboardSpecialEventSubtitle({
      ...event,
      divisions: mergeActivityDivisions(event),
    }),
  );
  return `<li><strong>${title}</strong><br/><span style="color:#555;font-size:14px;">${subtitle}</span></li>`;
}

export function buildSpecialEventsEmailSection(
  heading: string,
  events: Array<{
    title?: string | null;
    time_slot?: string | null;
    time?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    division?: NamedDivision | null;
    special_events_divisions?: { division?: NamedDivision | null }[] | null;
  }>,
): string {
  if (!events.length) return "";
  const items = events.map((ev) => formatSpecialEventEmailItem(ev)).join("");
  return `<h3>${escapeHtml(heading)}</h3><ul>${items}</ul>`;
}
