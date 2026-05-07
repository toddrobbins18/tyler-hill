import { supabase } from "@/integrations/supabase/client";

export type MessageProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

/** Display names for message senders/recipients in the selected camp (RPC matches compose recipient auth). */
export async function fetchMessageProfileLabels(
  profileIds: string[],
  targetCompanyId: string | undefined
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const canon = (id: string) => id.trim().toLowerCase();
  const ids = [...new Set(profileIds.filter(Boolean).map(canon))].filter((x) => x && x !== "null" && x !== "undefined");
  if (ids.length === 0) return map;

  let rows: MessageProfileRow[] | null = null;

  if (targetCompanyId) {
    const { data, error } = await supabase.rpc("resolve_message_profile_labels", {
      profile_ids: ids,
      target_company_id: targetCompanyId,
    });
    if (!error && data) {
      rows = data as MessageProfileRow[];
    } else {
      const missingRpc =
        error?.code === "PGRST202" ||
        (typeof error?.message === "string" && error.message.includes("could not find the function"));
      if (error && !missingRpc) {
        console.warn("[fetchMessageProfileLabels] rpc:", error);
      }
    }
  }

  if (rows === null) {
    const { data: fb, error: qErr } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    if (qErr) {
      console.warn("[fetchMessageProfileLabels] profiles fallback:", qErr);
      rows = [];
    } else {
      rows = (fb || []) as MessageProfileRow[];
    }
  }

  for (const p of rows) {
    const pid = canon(p.id);
    if (!pid) continue;
    map.set(pid, p.full_name?.trim() || p.email?.split("@")[0] || "Unknown sender");
  }

  const stillMissing = ids.filter((id) => !map.has(id) || map.get(id) === "Unknown sender");
  if (stillMissing.length > 0) {
    const { data: partnerRows, error: pErr } = await supabase.rpc("resolve_profile_names_for_message_partners", {
      profile_ids: stillMissing,
    });
    if (!pErr && partnerRows) {
      for (const p of partnerRows as MessageProfileRow[]) {
        const pid = canon(p.id);
        if (!pid) continue;
        const label = p.full_name?.trim() || p.email?.split("@")[0] || "Unknown sender";
        map.set(pid, label);
      }
    } else if (
      pErr &&
      pErr.code !== "PGRST202" &&
      !(typeof pErr.message === "string" && pErr.message.includes("could not find the function"))
    ) {
      console.warn("[fetchMessageProfileLabels] resolve_profile_names_for_message_partners:", pErr);
    }
  }

  return map;
}
