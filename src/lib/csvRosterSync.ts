import type { SupabaseClient } from "@supabase/supabase-js";

export type CsvImportMode = "merge" | "replace";

export type RosterSyncResult = {
  inserted: number;
  updated: number;
  dropped: number;
  updateErrors: number;
  message: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function buildRosterSummary(result: Omit<RosterSyncResult, "message">, label: string): RosterSyncResult {
  const summary: string[] = [];
  if (result.inserted > 0) summary.push(`${result.inserted} added`);
  if (result.updated > 0) summary.push(`${result.updated} updated`);
  if (result.dropped > 0) summary.push(`${result.dropped} marked inactive`);
  if (result.updateErrors > 0) summary.push(`${result.updateErrors} update errors`);
  return {
    ...result,
    message: `${label}: ${summary.join(", ") || "no changes"}`,
  };
}

export async function syncChildrenFromCsv(
  client: SupabaseClient,
  validatedRows: Record<string, unknown>[],
  ctx: { companyId: string; season: string; mode: CsvImportMode },
): Promise<RosterSyncResult | { error: string }> {
  const { companyId, season, mode } = ctx;
  const csvPersonIds = new Set(
    validatedRows.map((r) => String(r.person_id ?? "").trim()).filter(Boolean),
  );

  const { data: existingChildren, error: fetchError } = await client
    .from("children")
    .select("id, name, person_id, status")
    .eq("company_id", companyId)
    .eq("season", season)
    .neq("status", "inactive");

  if (fetchError) return { error: fetchError.message };

  const existingByPersonId = new Map<string, { id: string; name: string; person_id: string }>();
  (existingChildren || []).forEach((child: { id: string; name: string; person_id: string | null }) => {
    const pid = String(child.person_id ?? "").trim();
    if (pid) existingByPersonId.set(pid, { id: child.id, name: child.name, person_id: pid });
  });

  const toUpdate: { existingId: string; data: Record<string, unknown> }[] = [];
  const toInsert: Record<string, unknown>[] = [];

  for (const row of validatedRows) {
    const personId = String(row.person_id ?? "").trim();
    const rowData: Record<string, unknown> = {
      ...row,
      company_id: companyId,
      season,
      status: "active",
    };

    if (personId && existingByPersonId.has(personId)) {
      toUpdate.push({ existingId: existingByPersonId.get(personId)!.id, data: rowData });
    } else {
      toInsert.push(rowData);
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await client.from("children").insert(toInsert as never);
    if (insertError) return { error: insertError.message };
  }

  let updateErrors = 0;
  for (const item of toUpdate) {
    const updatePayload = { ...item.data };
    delete updatePayload.person_id;
    const { error: updateError } = await client
      .from("children")
      .update(updatePayload as never)
      .eq("id", item.existingId);
    if (updateError) updateErrors++;
  }

  let dropped = 0;
  if (mode === "replace") {
    const toDrop = (existingChildren || []).filter(
      (child: { id: string; person_id: string | null; status: string | null }) => {
        const pid = String(child.person_id ?? "").trim();
        return pid && !csvPersonIds.has(pid) && child.status !== "inactive";
      },
    );

    if (toDrop.length > 0) {
      const { error: dropError } = await client
        .from("children")
        .update({ status: "inactive" } as never)
        .in(
          "id",
          toDrop.map((c: { id: string }) => c.id),
        );
      if (dropError) return { error: dropError.message };
      dropped = toDrop.length;
    }
  }

  return buildRosterSummary(
    { inserted: toInsert.length, updated: toUpdate.length, dropped, updateErrors },
    mode === "replace" ? "Camper roster replaced" : "Camper roster updated",
  );
}

export async function syncStaffFromCsv(
  client: SupabaseClient,
  validatedRows: Record<string, unknown>[],
  ctx: { companyId: string; season: string; mode: CsvImportMode },
): Promise<RosterSyncResult | { error: string }> {
  const { companyId, season, mode } = ctx;

  const csvPersonIds = new Set<string>();
  const csvNames = new Set<string>();
  for (const row of validatedRows) {
    const pid = String(row.person_id ?? "").trim();
    if (pid) csvPersonIds.add(pid);
    const name = normalizeName(String(row.name ?? ""));
    if (name) csvNames.add(name);
  }

  const { data: existingStaff, error: fetchError } = await client
    .from("staff")
    .select("id, name, person_id, status")
    .eq("company_id", companyId)
    .eq("season", season)
    .neq("status", "inactive");

  if (fetchError) return { error: fetchError.message };

  const existingByPersonId = new Map<string, string>();
  const existingByName = new Map<string, string>();
  (existingStaff || []).forEach((member: { id: string; name: string; person_id: string | null }) => {
    const pid = String(member.person_id ?? "").trim();
    if (pid) existingByPersonId.set(pid, member.id);
    const nameKey = normalizeName(member.name ?? "");
    if (nameKey && !existingByName.has(nameKey)) existingByName.set(nameKey, member.id);
  });

  const toUpdate: { existingId: string; data: Record<string, unknown> }[] = [];
  const toInsert: Record<string, unknown>[] = [];
  const matchedExistingIds = new Set<string>();

  for (const row of validatedRows) {
    const personId = String(row.person_id ?? "").trim();
    const nameKey = normalizeName(String(row.name ?? ""));
    const rowData: Record<string, unknown> = {
      ...row,
      company_id: companyId,
      season,
      status: "active",
    };

    let existingId: string | undefined;
    if (personId && existingByPersonId.has(personId)) {
      existingId = existingByPersonId.get(personId);
    } else if (nameKey && existingByName.has(nameKey)) {
      existingId = existingByName.get(nameKey);
    }

    if (existingId) {
      matchedExistingIds.add(existingId);
      toUpdate.push({ existingId, data: rowData });
    } else {
      toInsert.push(rowData);
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await client.from("staff").insert(toInsert as never);
    if (insertError) return { error: insertError.message };
  }

  let updateErrors = 0;
  for (const item of toUpdate) {
    const updatePayload = { ...item.data };
    delete updatePayload.person_id;
    const { error: updateError } = await client
      .from("staff")
      .update(updatePayload as never)
      .eq("id", item.existingId);
    if (updateError) updateErrors++;
  }

  let dropped = 0;
  if (mode === "replace") {
    const toDrop = (existingStaff || []).filter((member: { id: string; person_id: string | null; name: string; status: string | null }) => {
      if (matchedExistingIds.has(member.id)) return false;
      const pid = String(member.person_id ?? "").trim();
      if (pid && csvPersonIds.has(pid)) return false;
      const nameKey = normalizeName(member.name ?? "");
      if (nameKey && csvNames.has(nameKey)) return false;
      return member.status !== "inactive";
    });

    if (toDrop.length > 0) {
      const { error: dropError } = await client
        .from("staff")
        .update({ status: "inactive" } as never)
        .in(
          "id",
          toDrop.map((m: { id: string }) => m.id),
        );
      if (dropError) return { error: dropError.message };
      dropped = toDrop.length;
    }
  }

  return buildRosterSummary(
    { inserted: toInsert.length, updated: toUpdate.length, dropped, updateErrors },
    mode === "replace" ? "Staff roster replaced" : "Staff roster updated",
  );
}

export const CSV_REPLACE_CLEAR_TABLES = new Set([
  "awards",
  "daily_notes",
  "trips",
  "menu_items",
  "incident_reports",
  "medication_logs",
  "master_calendar",
  "sports_calendar",
  "daily_wolf_content",
  "sports_academy",
  "special_events_activities",
]);
