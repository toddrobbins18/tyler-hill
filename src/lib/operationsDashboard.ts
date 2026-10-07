import { formatDistanceToNow, intervalToDuration } from "date-fns";

export type SyncJobRow = {
  id: string;
  company_id: string | null;
  entity_type: string;
  status: string;
  progress: Record<string, unknown> | null;
  total_counts: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type EmailLogRow = {
  id: string;
  subject: string;
  status: string | null;
  recipient_count: number;
  recipient_tags: string[] | null;
  sent_at: string | null;
  sent_by: string | null;
  error_details: unknown;
  delivery_methods: Record<string, unknown> | null;
};

export function syncJobSyncType(job: SyncJobRow): string {
  const progress = job.progress ?? {};
  return String(progress.syncType ?? progress.sync_type ?? "full");
}

export function syncJobStep(job: SyncJobRow): string {
  const progress = job.progress ?? {};
  return String(progress.step ?? "—");
}

export function formatSyncCounts(totalCounts: Record<string, unknown> | null): string {
  if (!totalCounts || Object.keys(totalCounts).length === 0) return "—";
  const parts: string[] = [];
  const campers = totalCounts.campers ?? totalCounts.campers_synced;
  const staff = totalCounts.staff ?? totalCounts.staff_synced;
  if (campers != null && campers !== "") parts.push(`campers ${campers}`);
  if (staff != null && staff !== "") parts.push(`staff ${staff}`);
  if (parts.length === 0) {
    return Object.entries(totalCounts)
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  return parts.join(" · ");
}

export function formatJobDuration(job: SyncJobRow): string {
  const start = job.started_at ?? job.created_at;
  const end = job.completed_at ?? job.updated_at;
  if (!start || !end) return "—";
  const duration = intervalToDuration({
    start: new Date(start),
    end: new Date(end),
  });
  if (duration.hours) return `${duration.hours}h ${duration.minutes ?? 0}m`;
  if (duration.minutes) return `${duration.minutes}m ${duration.seconds ?? 0}s`;
  return `${duration.seconds ?? 0}s`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function syncStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  const s = status.toLowerCase();
  if (s === "completed") return "default";
  if (s === "running" || s === "pending") return "secondary";
  if (s === "failed") return "destructive";
  return "outline";
}

export function emailStatusVariant(
  status: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  const s = (status ?? "").toLowerCase();
  if (s === "sent") return "default";
  if (s === "partial") return "secondary";
  if (s === "failed") return "destructive";
  return "outline";
}

/** Jobs stuck in pending/running longer than this are treated as stale (matches server cleanup). */
export const SYNC_JOB_STALE_MINUTES = 150;

export function isStaleSyncJob(job: SyncJobRow, staleMinutes = SYNC_JOB_STALE_MINUTES): boolean {
  const status = job.status.toLowerCase();
  if (!["pending", "running"].includes(status)) return false;
  const ref = job.updated_at ?? job.started_at ?? job.created_at;
  if (!ref) return false;
  return Date.now() - new Date(ref).getTime() > staleMinutes * 60 * 1000;
}

export function isLiveSyncJob(job: SyncJobRow): boolean {
  const status = job.status.toLowerCase();
  return ["pending", "running"].includes(status) && !isStaleSyncJob(job);
}

export function formatEmailTags(tags: string[] | null | undefined): string {
  if (!tags?.length) return "—";
  return tags
    .map((t) => {
      if (t.startsWith("swim_progress:")) return `Swim ${t.replace("swim_progress:", "")}`;
      if (t.startsWith("parent_template:")) return `Template ${t.replace("parent_template:", "")}`;
      return t;
    })
    .join(", ");
}
