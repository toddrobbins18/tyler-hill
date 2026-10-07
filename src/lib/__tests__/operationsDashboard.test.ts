import { describe, expect, it } from "vitest";
import {
  formatEmailTags,
  formatSyncCounts,
  isLiveSyncJob,
  isStaleSyncJob,
  syncJobSyncType,
  syncJobStep,
  type SyncJobRow,
} from "@/lib/operationsDashboard";

describe("operationsDashboard", () => {
  it("formats sync job progress fields", () => {
    const job = {
      id: "1",
      company_id: "c1",
      entity_type: "campminder",
      status: "completed",
      progress: { syncType: "staff", step: "Syncing staff" },
      total_counts: { staff: 120, staff_synced: 118 },
      started_at: null,
      completed_at: null,
      error_message: null,
      created_at: null,
      updated_at: null,
    };
    expect(syncJobSyncType(job)).toBe("staff");
    expect(syncJobStep(job)).toBe("Syncing staff");
    expect(formatSyncCounts(job.total_counts)).toContain("staff 120");
  });

  it("formats swim progress email tags", () => {
    expect(formatEmailTags(["swim_progress:red-cross-1", "bulk"])).toContain("Swim red-cross-1");
  });

  it("detects stale running sync jobs", () => {
    const stale: SyncJobRow = {
      id: "1",
      company_id: "c1",
      entity_type: "campminder",
      status: "running",
      progress: { step: "Fetching Camp Grade custom fields" },
      total_counts: null,
      started_at: null,
      completed_at: null,
      error_message: null,
      created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    };
    expect(isStaleSyncJob(stale)).toBe(true);
    expect(isLiveSyncJob(stale)).toBe(false);
  });
});
