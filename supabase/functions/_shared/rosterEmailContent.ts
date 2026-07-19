export type RosterCamper = {
  name: string;
  division_id?: string | null;
  division?: { id?: string; name?: string } | null;
  allergies?: string | null;
  grade?: string | null;
  age?: number | null;
};

export type RosterStaffAssignment = {
  role?: string | null;
  staff?: {
    name?: string | null;
    role?: string | null;
    allergies?: string | null;
  } | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lastNameKey(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] || name).toLowerCase();
}

export function sortCampersByLastName<T extends { name?: string | null }>(campers: T[]): T[] {
  return [...campers].sort((a, b) => {
    const lastCmp = lastNameKey(a.name || "").localeCompare(lastNameKey(b.name || ""));
    if (lastCmp !== 0) return lastCmp;
    return (a.name || "").localeCompare(b.name || "");
  });
}

export function buildRosterGroupedByDivisionHtml(
  campers: RosterCamper[],
  options?: { divisionFilter?: Set<string> },
): string {
  const filtered = options?.divisionFilter
    ? campers.filter((c) => c.division_id && options.divisionFilter!.has(c.division_id))
    : campers.filter((c) => c?.name);

  if (filtered.length === 0) {
    return "<p><em>No campers on roster yet.</em></p>";
  }

  const groups = new Map<string, { label: string; campers: RosterCamper[] }>();
  for (const camper of filtered) {
    const key = camper.division_id || "__none__";
    const label = camper.division?.name || "Other";
    if (!groups.has(key)) {
      groups.set(key, { label, campers: [] });
    }
    groups.get(key)!.campers.push(camper);
  }

  let html = "";
  for (const group of [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))) {
    const sorted = sortCampersByLastName(group.campers);
    html += `<h4 style="margin:14px 0 6px;color:#374151;">${escapeHtml(group.label)}</h4>`;
    html += `<ul style="margin:0 0 8px;padding-left:20px;">`;
    for (const camper of sorted) {
      const allergy = camper.allergies
        ? ` <span style="color:#b91c1c;">(Allergies: ${escapeHtml(camper.allergies)})</span>`
        : "";
      html += `<li><strong>${escapeHtml(camper.name)}</strong>${allergy}</li>`;
    }
    html += `</ul>`;
  }
  return html;
}

export function buildStaffAssignmentsHtml(assignments: RosterStaffAssignment[]): string {
  const rows = assignments.filter((a) => a.staff?.name);
  if (rows.length === 0) return "";

  let html = `<h4 style="margin:14px 0 6px;color:#374151;">Staff</h4><ul style="margin:0;padding-left:20px;">`;
  for (const row of rows) {
    const role = row.role || row.staff?.role || "Staff";
    const allergy = row.staff?.allergies
      ? ` <span style="color:#b91c1c;">(Allergies: ${escapeHtml(row.staff.allergies)})</span>`
      : "";
    html += `<li><strong>${escapeHtml(row.staff!.name!)}</strong> — ${escapeHtml(role)}${allergy}</li>`;
  }
  html += `</ul>`;
  return html;
}

export function buildAllergyAlertHtml(
  childAllergies: Array<{ name: string; allergies: string }>,
  staffAllergies: Array<{ name: string; role?: string; allergies: string }>,
): string {
  const total = childAllergies.length + staffAllergies.length;
  if (total === 0) return "";

  let html = `<div style="margin:16px 0;padding:12px;border:1px solid #fca5a5;background:#fef2f2;border-radius:8px;">`;
  html += `<p style="margin:0 0 8px;font-weight:700;color:#b91c1c;">ALLERGY ALERT: ${total} individual(s)</p>`;
  if (childAllergies.length > 0) {
    html += `<p style="margin:0 0 4px;font-weight:600;">Campers:</p><ul style="margin:0 0 8px;padding-left:20px;">`;
    for (const c of childAllergies) {
      html += `<li>${escapeHtml(c.name)}: ${escapeHtml(c.allergies)}</li>`;
    }
    html += `</ul>`;
  }
  if (staffAllergies.length > 0) {
    html += `<p style="margin:0 0 4px;font-weight:600;">Staff:</p><ul style="margin:0;padding-left:20px;">`;
    for (const s of staffAllergies) {
      html += `<li>${escapeHtml(s.name)}${s.role ? ` (${escapeHtml(s.role)})` : ""}: ${escapeHtml(s.allergies)}</li>`;
    }
    html += `</ul>`;
  }
  html += `</div>`;
  return html;
}

export function buildSportsEventEmailHtml(
  event: {
    title?: string | null;
    sport_type?: string | null;
    custom_sport_type?: string | null;
    event_date?: string | null;
    time?: string | null;
    location?: string | null;
    home_away?: string | null;
    opponent?: string | null;
    meal_options?: string[] | null;
    meal_notes?: string | null;
    sports_event_roster?: Array<{ child?: RosterCamper | null }>;
    sports_event_staff?: RosterStaffAssignment[];
  },
  trip?: {
    departure_time?: string | null;
    return_time?: string | null;
    transportation_type?: string | null;
    driver?: string | null;
  } | null,
  options?: { divisionFilter?: Set<string> },
): string {
  const displaySport =
    event.sport_type === "Other" || event.sport_type === "custom"
      ? event.custom_sport_type || event.sport_type
      : event.sport_type;

  const campers =
    event.sports_event_roster
      ?.map((r) => r.child)
      .filter((c): c is RosterCamper => !!c?.name) || [];

  const childAllergies = campers
    .filter((c) => c.allergies)
    .map((c) => ({ name: c.name, allergies: c.allergies! }));

  const staffAllergies =
    event.sports_event_staff
      ?.map((s) => s.staff)
      .filter((s) => s?.allergies)
      .map((s) => ({
        name: s!.name!,
        role: s!.role || undefined,
        allergies: s!.allergies!,
      })) || [];

  let html = `<h2 style="margin:0 0 12px;color:#13B4B2;">${escapeHtml(event.title || "Sports Event")}</h2>`;
  html += `<p style="margin:0 0 12px;">`;
  if (displaySport) html += `<strong>Sport:</strong> ${escapeHtml(displaySport)}<br/>`;
  if (event.event_date) {
    html += `<strong>Date:</strong> ${escapeHtml(new Date(event.event_date).toLocaleDateString())}<br/>`;
  }
  if (event.time) html += `<strong>Time:</strong> ${escapeHtml(event.time)}<br/>`;
  if (event.location) html += `<strong>Location:</strong> ${escapeHtml(event.location)}<br/>`;
  if (event.home_away) html += `<strong>Home/Away:</strong> ${escapeHtml(event.home_away)}<br/>`;
  if (event.opponent) html += `<strong>Opponent:</strong> ${escapeHtml(event.opponent)}`;
  html += `</p>`;

  html += `<h3 style="margin:16px 0 8px;">Roster</h3>`;
  html += buildRosterGroupedByDivisionHtml(campers, options);
  html += buildStaffAssignmentsHtml(event.sports_event_staff || []);
  html += buildAllergyAlertHtml(childAllergies, staffAllergies);

  if (trip) {
    html += `<h3 style="margin:16px 0 8px;">Transportation</h3><ul style="margin:0;padding-left:20px;">`;
    html += `<li><strong>Departure:</strong> ${escapeHtml(trip.departure_time || "TBD")}</li>`;
    html += `<li><strong>Return:</strong> ${escapeHtml(trip.return_time || "TBD")}</li>`;
    html += `<li><strong>Transportation:</strong> ${escapeHtml(trip.transportation_type || "TBD")}</li>`;
    html += `<li><strong>Driver:</strong> ${escapeHtml(trip.driver || "TBD")}</li>`;
    html += `</ul>`;
  }

  if (event.meal_options?.length) {
    html += `<p style="margin:12px 0 0;"><strong>Meal Options:</strong> ${escapeHtml(event.meal_options.join(", "))}</p>`;
  }
  if (event.meal_notes) {
    html += `<p style="margin:8px 0 0;"><strong>Meal Notes:</strong> ${escapeHtml(event.meal_notes)}</p>`;
  }

  return html;
}

export const SPORTS_EVENT_EMAIL_SELECT = `
  *,
  sports_calendar_divisions(division_id),
  division:divisions (
    name
  ),
  sports_event_roster (
    child:children (
      name,
      allergies,
      division_id,
      grade,
      age,
      division:divisions(id, name)
    )
  ),
  sports_event_staff (
    role,
    staff (
      name,
      role,
      allergies
    )
  )
`;
