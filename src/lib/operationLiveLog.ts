import type { SyncJobRow } from "@/lib/operationsDashboard";
import { isStaleSyncJob, syncJobStep, syncJobSyncType } from "@/lib/operationsDashboard";

export type OperationStepStatus = "pending" | "running" | "done" | "error";

export type OperationStep = {
  id: string;
  label: string;
  status: OperationStepStatus;
  detail?: string;
  at?: string;
};

export function syncJobTerminal(status: string): boolean {
  const s = status.toLowerCase();
  return s === "completed" || s === "failed" || s === "skipped";
}

export function syncJobIsLive(job: SyncJobRow | null | undefined): boolean {
  if (!job) return false;
  const s = job.status.toLowerCase();
  return (s === "pending" || s === "running") && !isStaleSyncJob(job);
}

/** Human-readable line from sync_jobs.progress + total_counts. */
export function formatSyncProgressDetail(job: SyncJobRow): string | undefined {
  const progress = job.progress ?? {};
  const counts = job.total_counts ?? {};
  const parts: string[] = [];

  const numericKeys = ["total", "campers", "staff", "divisions", "bunks", "imported", "updated"];
  for (const key of numericKeys) {
    const val = progress[key] ?? counts[key];
    if (val != null && val !== "") parts.push(`${key}: ${val}`);
  }

  if (progress.season) parts.push(`season ${progress.season}`);
  if (progress.syncType) parts.push(String(progress.syncType));

  return parts.length ? parts.join(" · ") : undefined;
}

export function buildSyncJobLogSteps(
  job: SyncJobRow,
  priorStepLabels: string[],
): { steps: OperationStep[]; stepLabels: string[] } {
  const stepLabel = syncJobStep(job);
  const labels = [...priorStepLabels];
  const terminal = syncJobTerminal(job.status);
  const live = syncJobIsLive(job);
  const stale = isStaleSyncJob(job);

  if (stepLabel && stepLabel !== "—" && labels[labels.length - 1] !== stepLabel) {
    labels.push(stepLabel);
  }

  if (labels.length === 0) {
    const waitingLabel =
      job.status.toLowerCase() === "pending" ? "Sync queued…" : live ? "Sync starting…" : "Waiting for sync…";
    labels.push(waitingLabel);
  }

  const steps: OperationStep[] = labels.map((label, index) => {
    const isLast = index === labels.length - 1;
    let status: OperationStepStatus = "done";
    if (isLast) {
      if (job.status.toLowerCase() === "failed" || stale) status = "error";
      else if (terminal) status = "done";
      else if (live) status = "running";
      else status = "pending";
    }
    return {
      id: `${index}-${label}`,
      label,
      status,
      detail: isLast ? formatSyncProgressDetail(job) : undefined,
      at: isLast ? job.updated_at ?? job.created_at ?? undefined : undefined,
    };
  });

  if (terminal && job.status.toLowerCase() === "completed") {
    steps.push({
      id: "complete",
      label: "Sync completed",
      status: "done",
      detail: formatSyncProgressDetail(job),
      at: job.completed_at ?? undefined,
    });
  } else if (job.status.toLowerCase() === "failed" || stale) {
    steps.push({
      id: "failed",
      label: stale ? "Sync stalled (timed out)" : "Sync failed",
      status: "error",
      detail: job.error_message ?? undefined,
      at: job.updated_at ?? undefined,
    });
  }

  return { steps, stepLabels: labels };
}

export function initialSyncJobSteps(job: SyncJobRow | null): OperationStep[] {
  if (!job) {
    return [{ id: "wait", label: "Waiting for sync job…", status: "running" }];
  }
  return buildSyncJobLogSteps(job, []).steps;
}

export function syncJobTitle(job: SyncJobRow | null): string {
  if (!job) return "CampMinder sync";
  return `CampMinder sync · ${syncJobSyncType(job)}`;
}
